import * as https from 'https';
import * as vscode from 'vscode';

export interface JiraTicket {
	key: string;
	self: string;
	id: string;
}

export interface JiraIssueFields {
	summary: string;
	description: string;
	project: {
		key: string;
	};
	issuetype: {
		name: string;
	};
	components?: Array<{
		name: string;
	}>;
	assignee?: {
		accountId?: string;
		emailAddress?: string;
	};
}

export interface JiraProject {
	key: string;
	name: string;
	id: string;
}

export interface JiraComponent {
	name: string;
	id: string;
}

/**
 * Gets the current user's account ID from JIRA
 */
async function getCurrentUserAccountId(jiraUrl: string, jiraEmail: string, jiraApiToken: string): Promise<string | null> {
	return new Promise((resolve, reject) => {
		let hostname: string;
		let basePath: string = '';
		
		try {
			const url = new URL(jiraUrl);
			hostname = url.hostname;
			basePath = url.pathname.replace(/\/$/, '');
		} catch (error) {
			reject(new Error(`Invalid JIRA_URL: ${jiraUrl}`));
			return;
		}

		const apiPath = `${basePath}/rest/api/3/myself`;
		const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');

		const options = {
			hostname,
			path: apiPath,
			method: 'GET',
			headers: {
				'Authorization': `Basic ${auth}`,
				'Accept': 'application/json'
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode === 200) {
					try {
						const user = JSON.parse(data) as any;
						// JIRA API v3 returns accountId
						resolve(user.accountId || null);
					} catch (error) {
						reject(new Error('Failed to parse JIRA API response'));
					}
				} else {
					// If we can't get the user info, return null (assignment will be skipped)
					resolve(null);
				}
			});
		});

		req.on('error', (error) => {
			// On error, return null instead of rejecting (assignment will be skipped)
			resolve(null);
		});

		req.setTimeout(10000, () => {
			req.destroy();
			resolve(null);
		});

		req.end();
	});
}

/**
 * Creates a JIRA ticket with the given details
 */
export async function createJiraTicket(
	summary: string,
	description: string,
	project: string,
	component?: string
): Promise<JiraTicket> {
	return new Promise(async (resolve, reject) => {
		const jiraUrl = process.env.JIRA_URL || 'https://poly-ai.atlassian.net';
		const jiraEmail = process.env.JIRA_USER;
		const jiraApiToken = process.env.JIRA_API_TOKEN;

		if (!jiraEmail || !jiraApiToken) {
			reject(new Error('JIRA_USER and JIRA_API_TOKEN environment variables are required'));
			return;
		}

		// Parse JIRA URL to get hostname and path
		let hostname: string;
		let basePath: string = '';
		
		try {
			const url = new URL(jiraUrl);
			hostname = url.hostname;
			basePath = url.pathname.replace(/\/$/, ''); // Remove trailing slash
		} catch (error) {
			reject(new Error(`Invalid JIRA_URL: ${jiraUrl}`));
			return;
		}

		const apiPath = `${basePath}/rest/api/3/issue`;
		const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');

		// Convert description to Atlassian Document Format (ADF)
		// JIRA API v3 requires ADF format for description field
		const descriptionADF = convertTextToADF(description);

		// Get current user's account ID for assignment
		let accountId: string | null = null;
		try {
			accountId = await getCurrentUserAccountId(jiraUrl, jiraEmail, jiraApiToken);
		} catch (error) {
			console.error('[JIRA] Failed to get current user account ID:', error);
			// Continue without assignment if we can't get account ID
		}

		// Build fields object - start with required fields
		const fields: any = {
			summary,
			description: descriptionADF,
			project: {
				key: project
			},
			issuetype: {
				name: 'Task' 
			}
		};

		// Add assignee (the JIRA user) using accountId
		// JIRA API v3 requires accountId for assignment
		if (accountId) {
			fields.assignee = {
				accountId: accountId
			};
		}

		// Only add components if provided and not empty
		// Note: Component name must match exactly (case-sensitive) with existing component in JIRA
		if (component && component.trim().length > 0) {
			fields.components = [{ name: component.trim() }];
		}

		const requestData = JSON.stringify({
			fields
		});

		const options = {
			hostname,
			path: apiPath,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Basic ${auth}`,
				'Content-Length': Buffer.byteLength(requestData)
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode === 201) {
					try {
						const issue = JSON.parse(data) as JiraTicket;
						resolve(issue);
					} catch (error) {
						reject(new Error('Failed to parse JIRA API response'));
					}
				} else {
					let errorMessage = `JIRA API returned status ${res.statusCode}`;
					try {
						const errorData = JSON.parse(data);
						if (errorData.errorMessages && errorData.errorMessages.length > 0) {
							errorMessage = errorData.errorMessages.join(', ');
						} else if (errorData.errors) {
							// JIRA v3 API uses 'errors' object for field-level errors
							const errorKeys = Object.keys(errorData.errors);
							const errorValues = errorKeys.map(key => `${key}: ${errorData.errors[key]}`);
							errorMessage = errorValues.join(', ');
						} else if (errorData.message) {
							errorMessage = errorData.message;
						}
						// Log the full error for debugging
						console.error('[JIRA] Full error response:', JSON.stringify(errorData, null, 2));
					} catch {
						// If parsing fails, use the raw data
						errorMessage = data.substring(0, 500);
					}
					// Log the request payload for debugging
					console.error('[JIRA] Request payload:', requestData);
					reject(new Error(errorMessage));
				}
			});
		});

		req.on('error', (error) => {
			reject(error);
		});

		req.setTimeout(30000, () => {
			req.destroy();
			reject(new Error('Request timeout'));
		});

		req.write(requestData);
		req.end();
	});
}

/**
 * Converts plain text to Atlassian Document Format (ADF)
 * JIRA API v3 requires descriptions in ADF format
 * Simplified version to keep content size manageable
 */
function convertTextToADF(text: string): any {
	if (!text || text.trim().length === 0) {
		return {
			type: 'doc',
			version: 1,
			content: []
		};
	}

	const content: any[] = [];
	
	// Split by {code} markers to separate regular text from code blocks
	const parts = text.split(/{code}/);
	let inCodeBlock = text.trim().startsWith('{code}');
	
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i].trim();
		if (!part) {
			continue;
		}
		
		if (inCodeBlock) {
			// This is code content - use codeBlock node
			content.push({
				type: 'codeBlock',
				attrs: {
					language: 'text'
				},
				content: [
					{
						type: 'text',
						text: part
					}
				]
			});
		} else {
			// This is regular text - split into paragraphs
			const paragraphs = part.split(/\n\n+/).filter(p => p.trim().length > 0);
			for (const para of paragraphs) {
				const lines = para.split('\n').filter(l => l.trim().length > 0);
				if (lines.length === 0) {
					continue;
				}
				
				const paraContent: any[] = [];
				lines.forEach((line, idx) => {
					paraContent.push({
						type: 'text',
						text: line
					});
					if (idx < lines.length - 1) {
						paraContent.push({
							type: 'hardBreak'
						});
					}
				});
				
				content.push({
					type: 'paragraph',
					content: paraContent
				});
			}
		}
		
		// Toggle code block state after each part
		inCodeBlock = !inCodeBlock;
	}

	// If no content was created, add an empty paragraph
	if (content.length === 0) {
		content.push({
			type: 'paragraph',
			content: []
		});
	}

	return {
		type: 'doc',
		version: 1,
		content: content
	};
}

/**
 * Fetches all accessible JIRA projects
 */
export async function getJiraProjects(): Promise<JiraProject[]> {
	return new Promise((resolve, reject) => {
		const jiraUrl = process.env.JIRA_URL || 'https://poly-ai.atlassian.net';
		const jiraEmail = process.env.JIRA_USER;
		const jiraApiToken = process.env.JIRA_API_TOKEN;

		if (!jiraEmail || !jiraApiToken) {
			reject(new Error('JIRA_USER and JIRA_API_TOKEN environment variables are required'));
			return;
		}

		let hostname: string;
		let basePath: string = '';
		
		try {
			const url = new URL(jiraUrl);
			hostname = url.hostname;
			basePath = url.pathname.replace(/\/$/, '');
		} catch (error) {
			reject(new Error(`Invalid JIRA_URL: ${jiraUrl}`));
			return;
		}

		const apiPath = `${basePath}/rest/api/3/project`;
		const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');

		const options = {
			hostname,
			path: apiPath,
			method: 'GET',
			headers: {
				'Authorization': `Basic ${auth}`,
				'Accept': 'application/json'
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode === 200) {
					try {
						const projects = JSON.parse(data) as JiraProject[];
						resolve(projects);
					} catch (error) {
						reject(new Error('Failed to parse JIRA API response'));
					}
				} else {
					reject(new Error(`JIRA API returned status ${res.statusCode}`));
				}
			});
		});

		req.on('error', (error) => {
			reject(error);
		});

		req.setTimeout(30000, () => {
			req.destroy();
			reject(new Error('Request timeout'));
		});

		req.end();
	});
}

/**
 * Fetches components for a specific JIRA project
 */
export async function getJiraComponents(projectKey: string): Promise<JiraComponent[]> {
	return new Promise((resolve, reject) => {
		const jiraUrl = process.env.JIRA_URL || 'https://poly-ai.atlassian.net';
		const jiraEmail = process.env.JIRA_USER;
		const jiraApiToken = process.env.JIRA_API_TOKEN;

		if (!jiraEmail || !jiraApiToken) {
			reject(new Error('JIRA_USER and JIRA_API_TOKEN environment variables are required'));
			return;
		}

		let hostname: string;
		let basePath: string = '';
		
		try {
			const url = new URL(jiraUrl);
			hostname = url.hostname;
			basePath = url.pathname.replace(/\/$/, '');
		} catch (error) {
			reject(new Error(`Invalid JIRA_URL: ${jiraUrl}`));
			return;
		}

		const apiPath = `${basePath}/rest/api/3/project/${projectKey}`;
		const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');

		const options = {
			hostname,
			path: apiPath,
			method: 'GET',
			headers: {
				'Authorization': `Basic ${auth}`,
				'Accept': 'application/json'
			}
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode === 200) {
					try {
						const project = JSON.parse(data) as any;
						const components = (project.components || []) as JiraComponent[];
						resolve(components);
					} catch (error) {
						reject(new Error('Failed to parse JIRA API response'));
					}
				} else {
					reject(new Error(`JIRA API returned status ${res.statusCode}`));
				}
			});
		});

		req.on('error', (error) => {
			reject(error);
		});

		req.setTimeout(30000, () => {
			req.destroy();
			reject(new Error('Request timeout'));
		});

		req.end();
	});
}

/**
 * Gets the JIRA ticket URL from a ticket key
 */
export function getJiraTicketUrl(ticketKey: string): string {
	const jiraUrl = process.env.JIRA_URL || 'https://poly-ai.atlassian.net';
	return `${jiraUrl.replace(/\/$/, '')}/browse/${ticketKey}`;
}

