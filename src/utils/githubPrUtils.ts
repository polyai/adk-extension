import * as https from 'https';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitHubPR {
	number: number;
	html_url: string;
	body: string;
	title: string;
}

/**
 * Gets the GitHub repository owner and name from the current git repository
 */
export async function getGitHubRepo(workspaceRoot: string): Promise<{ owner: string; repo: string } | null> {
	try {
		const { stdout } = await execAsync('git remote get-url origin', {
			cwd: workspaceRoot
		});
		
		const remoteUrl = stdout.trim();
		
		// Parse different git remote URL formats
		// https://github.com/owner/repo.git
		// https://github.com/owner/repo
		// git@github.com:owner/repo.git
		const httpsMatch = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
		if (httpsMatch) {
			return {
				owner: httpsMatch[1],
				repo: httpsMatch[2]
			};
		}
		
		return null;
	} catch (error) {
		return null;
	}
}

/**
 * Finds a PR associated with the current branch
 */
export async function findPRForBranch(
	owner: string,
	repo: string,
	branch: string
): Promise<GitHubPR | null> {
	return new Promise((resolve, reject) => {
		const githubToken = process.env.GITHUB_ACCESS_TOKEN;
		
		if (!githubToken) {
			reject(new Error('GITHUB_ACCESS_TOKEN environment variable is required'));
			return;
		}
		
		const apiPath = `/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=open`;
		
		const options = {
			hostname: 'api.github.com',
			path: apiPath,
			method: 'GET',
			headers: {
				'User-Agent': 'adk-extension',
				'Accept': 'application/vnd.github.v3+json',
				'Authorization': `Bearer ${githubToken}`
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
						const prs = JSON.parse(data) as GitHubPR[];
						if (prs.length > 0) {
							resolve(prs[0]); // Return the first open PR
						} else {
							resolve(null);
						}
					} catch (error) {
						reject(new Error('Failed to parse GitHub API response'));
					}
				} else if (res.statusCode === 404) {
					resolve(null);
				} else {
					reject(new Error(`GitHub API returned status ${res.statusCode}`));
				}
			});
		});
		
		req.on('error', (error) => {
			reject(error);
		});
		
		req.setTimeout(10000, () => {
			req.destroy();
			reject(new Error('Request timeout'));
		});
		
		req.end();
	});
}

/**
 * Updates a PR description with JIRA ticket information
 */
export async function updatePRDescription(
	owner: string,
	repo: string,
	prNumber: number,
	jiraTicketUrl: string,
	jiraTicketKey: string
): Promise<void> {
	return new Promise((resolve, reject) => {
		const githubToken = process.env.GITHUB_ACCESS_TOKEN;
		
		if (!githubToken) {
			reject(new Error('GITHUB_ACCESS_TOKEN environment variable is required'));
			return;
		}
		
		// First, get the current PR to preserve existing description
		const getOptions = {
			hostname: 'api.github.com',
			path: `/repos/${owner}/${repo}/pulls/${prNumber}`,
			method: 'GET',
			headers: {
				'User-Agent': 'adk-extension',
				'Accept': 'application/vnd.github.v3+json',
				'Authorization': `Bearer ${githubToken}`
			}
		};
		
		const getReq = https.request(getOptions, (getRes) => {
			let data = '';
			
			getRes.on('data', (chunk) => {
				data += chunk;
			});
			
			getRes.on('end', () => {
				if (getRes.statusCode !== 200) {
					reject(new Error(`Failed to get PR: ${getRes.statusCode}`));
					return;
				}
				
				try {
					const pr = JSON.parse(data) as GitHubPR;
					let updatedBody = pr.body || '';
					
					// Check if JIRA ticket link already exists
					if (updatedBody.includes(jiraTicketKey) || updatedBody.includes(jiraTicketUrl)) {
						// Already exists, no need to update
						resolve();
						return;
					}
					
					// Add JIRA ticket link to description
					const jiraSection = `\n\n## JIRA Ticket\n${jiraTicketKey}: ${jiraTicketUrl}`;
					updatedBody = updatedBody + jiraSection;
					
					// Update the PR
					const updateOptions = {
						hostname: 'api.github.com',
						path: `/repos/${owner}/${repo}/pulls/${prNumber}`,
						method: 'PATCH',
						headers: {
							'User-Agent': 'adk-extension',
							'Accept': 'application/vnd.github.v3+json',
							'Authorization': `Bearer ${githubToken}`,
							'Content-Type': 'application/json',
							'Content-Length': Buffer.byteLength(JSON.stringify({ body: updatedBody }))
						}
					};
					
					const updateReq = https.request(updateOptions, (updateRes) => {
						let updateData = '';
						
						updateRes.on('data', (chunk) => {
							updateData += chunk;
						});
						
						updateRes.on('end', () => {
							if (updateRes.statusCode === 200) {
								resolve();
							} else {
								reject(new Error(`Failed to update PR: ${updateRes.statusCode}`));
							}
						});
					});
					
					updateReq.on('error', (error) => {
						reject(error);
					});
					
					updateReq.setTimeout(10000, () => {
						updateReq.destroy();
						reject(new Error('Request timeout'));
					});
					
					updateReq.write(JSON.stringify({ body: updatedBody }));
					updateReq.end();
				} catch (error) {
					reject(new Error('Failed to parse PR data'));
				}
			});
		});
		
		getReq.on('error', (error) => {
			reject(error);
		});
		
		getReq.setTimeout(10000, () => {
			getReq.destroy();
			reject(new Error('Request timeout'));
		});
		
		getReq.end();
	});
}

