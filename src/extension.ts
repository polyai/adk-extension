// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore - js-yaml types may not be available
import * as yaml from 'js-yaml';
import { FlowParser } from './flowParser';
import { getWebviewContent, getErrorWebviewContent } from './webview/webviewContent';
import { WebviewMessageHandler } from './webview/webviewHandlers';
import { PythonDefinitionProvider, PythonHoverProvider, PythonReferencesProvider } from './pythonLanguageFeatures';
import { initializeDebug, toggleDebugMode, debugLog } from './utils/debug';
import { createJiraTicket, getJiraTicketUrl, getJiraProjects, getJiraComponents } from './utils/jiraUtils';
import { getCurrentBranch, getBranchDiff, getChangedFiles, getProjectDirectory, formatDiffForJira, createSummaryFromBranch, getProjectName } from './utils/gitUtils';
import { getGitHubRepo, findPRForBranch, updatePRDescription } from './utils/githubPrUtils';
import { AgentStudioLinter } from './linter';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Initialize debug utility
	initializeDebug(context);
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	debugLog('Extension "adk-extension" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const viewFlowDisposable = vscode.commands.registerCommand('adk-extension.viewFlow', async (uri?: vscode.Uri) => {
		let flowDir: string;

		if (uri && uri.fsPath) {
			flowDir = uri.fsPath;
			// If a file was selected, get its directory
			if (!fs.statSync(flowDir).isDirectory()) {
				flowDir = path.dirname(flowDir);
			}
		} else {
			// If no URI provided, try to use the workspace folder
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders && workspaceFolders.length > 0) {
				// Check if workspace root has flow_config.yaml
				const workspaceRoot = workspaceFolders[0].uri.fsPath;
				if (fs.existsSync(path.join(workspaceRoot, 'flow_config.yaml'))) {
					flowDir = workspaceRoot;
				} else {
					// Ask user to select a folder
					const selectedFolders = await vscode.window.showOpenDialog({
						canSelectFiles: false,
						canSelectFolders: true,
						canSelectMany: false,
						openLabel: 'Select Flow Directory',
						defaultUri: vscode.Uri.file(workspaceRoot)
					});

					if (!selectedFolders || selectedFolders.length === 0) {
						return;
					}

					flowDir = selectedFolders[0].fsPath;
				}
			} else {
				// Ask user to select a folder
				const selectedFolders = await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: 'Select Flow Directory'
				});

				if (!selectedFolders || selectedFolders.length === 0) {
					return;
				}

				flowDir = selectedFolders[0].fsPath;
			}
		}

		// Validate flow directory structure
		const configPath = path.join(flowDir, 'flow_config.yaml');
		if (!fs.existsSync(configPath)) {
			vscode.window.showErrorMessage(
				`Flow directory must contain a flow_config.yaml file.\nSelected: ${flowDir}`,
				'OK'
			);
			return;
		}

		// Check if it's a directory
		if (!fs.statSync(flowDir).isDirectory()) {
			vscode.window.showErrorMessage(`Selected path is not a directory: ${flowDir}`);
			return;
		}

		// Get flow name from config for better title
		let flowName = path.basename(flowDir);
		try {
			const configContent = fs.readFileSync(configPath, 'utf8');
			const config = yaml.load(configContent) as { name?: string };
			if (config && config.name) {
				flowName = config.name;
			}
		} catch (error) {
			// Use directory name if config parsing fails
		}

		// Create and show webview
		const panel = vscode.window.createWebviewPanel(
			'flowViewer',
			`Flow Viewer: ${flowName}`,
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.file(path.join(context.extensionPath, 'src'))
				],
				enableCommandUris: true
			}
		);

		// Create message handler
		const messageHandler = new WebviewMessageHandler(panel, flowDir);

		// Set up message handler BEFORE setting HTML to avoid race condition
		panel.webview.onDidReceiveMessage(
			async message => {
				await messageHandler.handleMessage(message);
			},
			undefined,
			context.subscriptions
		);

		// Get webview HTML content
		panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

		// Parse and load flow
		try {
			const parser = new FlowParser(flowDir);
			const flowGraph = await parser.parseFlow();
			messageHandler.setFlowGraphData(flowGraph);

			// Log for debugging
			console.log('Parsed flow graph:', {
				nodeCount: flowGraph.nodes.length,
				edgeCount: flowGraph.edges.length,
				nodes: flowGraph.nodes.map(n => ({ id: n.id, label: n.label, type: n.type })),
				edges: flowGraph.edges.map(e => ({ from: e.from, to: e.to, label: e.label }))
			});

			// Send flow data to webview immediately if it's already ready
			panel.webview.postMessage({
				command: 'loadFlow',
				flowGraph: flowGraph
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(
				`Error parsing flow: ${errorMessage}`,
				'OK'
			);
			console.error('Flow parsing error:', error);
			
			// Show error in webview
			panel.webview.html = getErrorWebviewContent(errorMessage);
		}	
	});

	// Toggle debug mode command
	const toggleDebugDisposable = vscode.commands.registerCommand(
		'adk-extension.toggleDebugMode',
		async () => {
			await toggleDebugMode();
		}
	);

	// Create JIRA ticket from branch commands
	const createJiraTicketDisposable = vscode.commands.registerCommand(
		'adk-extension.createJiraTicket',
		async () => {
			await createJiraTicketFromBranch(context);
		}
	);

	const clearJiraMappingsDisposable = vscode.commands.registerCommand(
		'adk-extension.clearJiraMappings',
		async () => {
			await clearJiraMappings(context);
		}
	);

	// Register Python language features for function resolution
	debugLog('Registering Python language features...');
	const pythonDefinitionProvider = vscode.languages.registerDefinitionProvider(
		{ language: 'python', scheme: 'file' },
		new PythonDefinitionProvider()
	);

	const pythonHoverProvider = vscode.languages.registerHoverProvider(
		{ language: 'python', scheme: 'file' },
		new PythonHoverProvider()
	);

	const pythonReferencesProvider = vscode.languages.registerReferenceProvider(
		{ language: 'python', scheme: 'file' },
		new PythonReferencesProvider()
	);
	debugLog('Python language features registered');

	// Initialize and activate the Agent Studio Linter
	debugLog('Activating Agent Studio Linter...');
	const linter = new AgentStudioLinter();
	linter.activate(context);
	debugLog('Agent Studio Linter activated');

	context.subscriptions.push(
		viewFlowDisposable,
		toggleDebugDisposable,
		createJiraTicketDisposable,
		clearJiraMappingsDisposable,
		pythonDefinitionProvider,
		pythonHoverProvider,
		pythonReferencesProvider
	);
}

/**
 * Interface for storing project/component mappings
 */
interface ProjectComponentMapping {
	[projectDir: string]: {
		project: string;
		component?: string;
	};
}

/**
 * Gets the stored project/component mapping for a project directory
 */
function getProjectComponentMapping(
	context: vscode.ExtensionContext,
	projectDir: string
): { project: string; component?: string } | null {
	const mappings = context.workspaceState.get<ProjectComponentMapping>('jiraProjectMappings', {});
	return mappings[projectDir] || null;
}

/**
 * Stores the project/component mapping for a project directory
 */
async function setProjectComponentMapping(
	context: vscode.ExtensionContext,
	projectDir: string,
	project: string,
	component?: string
): Promise<void> {
	const mappings = context.workspaceState.get<ProjectComponentMapping>('jiraProjectMappings', {});
	mappings[projectDir] = { project, component };
	await context.workspaceState.update('jiraProjectMappings', mappings);
}

/**
 * Clears all stored JIRA project/component mappings for this workspace
 */
async function clearJiraMappings(context: vscode.ExtensionContext): Promise<void> {
	await context.workspaceState.update('jiraProjectMappings', {});
	vscode.window.showInformationMessage('JIRA project mappings cleared. You will be prompted to select project/component on the next ticket creation.');
}

/**
 * Creates a JIRA ticket from the current branch changes
 */
async function createJiraTicketFromBranch(context: vscode.ExtensionContext): Promise<void> {
	try {
		// Get workspace root
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}
		const workspaceRoot = workspaceFolders[0].uri.fsPath;

		// Show progress
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Creating JIRA Ticket',
				cancellable: false
			},
			async (progress) => {
				progress.report({ increment: 0, message: 'Getting branch information...' });

				// Get current branch
				const branch = await getCurrentBranch(workspaceRoot);
				debugLog(`Current branch: ${branch}`);

				progress.report({ increment: 20, message: 'Getting changed files...' });

				// Get changed files
				const changedFiles = await getChangedFiles(workspaceRoot, branch);
				debugLog(`Changed files: ${changedFiles.length}`);

				if (changedFiles.length === 0) {
					vscode.window.showWarningMessage('No changes found in current branch');
					return;
				}

				// Determine project directory
				const dirInfo = getProjectDirectory(changedFiles, workspaceRoot);
				// Use project directory for caching (more specific), fallback to account directory
				const projectDir = dirInfo.projectDir || dirInfo.accountDir;
				debugLog(`Account directory: ${dirInfo.accountDir || 'none'}, Project directory: ${dirInfo.projectDir || 'none'}`);

				progress.report({ increment: 30, message: 'Getting branch diff...' });

				// Get diff
				const diff = await getBranchDiff(workspaceRoot, branch);
				debugLog(`Diff length: ${diff.length}`);

				// Get or prompt for project and component
				let project: string | undefined;
				let component: string | undefined;

				if (projectDir) {
					// Check if we have a cached mapping
					const mapping = getProjectComponentMapping(context, projectDir);
					if (mapping) {
						project = mapping.project;
						component = mapping.component;
						debugLog(`Using cached mapping for ${projectDir}: project=${project}, component=${component}`);
					} else {
						// Build a descriptive prompt showing account/project info with project name
						let placeHolderText = '';
						
						if (dirInfo.projectDir) {
							const [accountDir, projDir] = dirInfo.projectDir.split('/');
							// Try to get project name from project.yaml
							const projectName = getProjectName(workspaceRoot, accountDir, projDir);
							
							if (projectName) {
								placeHolderText = `Select project for "${projectName}" (${accountDir}/${projDir})`;
							} else {
								placeHolderText = `Select project for "${accountDir}/${projDir}"`;
							}
						} else if (dirInfo.accountDir) {
							placeHolderText = `Select project for "${dirInfo.accountDir}"`;
						} else {
							placeHolderText = 'Select JIRA project';
						}
						
						progress.report({ increment: 40, message: 'Fetching JIRA projects...' });
						
						// Fetch projects from JIRA
						let projects;
						try {
							projects = await getJiraProjects();
						} catch (error) {
							debugLog(`Failed to fetch JIRA projects: ${error}`);
							// Fallback to input box if API call fails
							project = await vscode.window.showInputBox({
								prompt: 'Enter JIRA project key',
								placeHolder: 'e.g., PROJ',
								validateInput: (value) => {
									if (!value || value.trim().length === 0) {
										return 'Project key is required';
									}
									return null;
								}
							}) || '';
							
							if (!project) {
								return; // User cancelled
							}
							// Set component to undefined if we used fallback
							component = undefined;
						}
						
						if (projects && projects.length > 0) {
							// Show dropdown for project selection
							const projectItems = projects.map(p => ({
								label: p.key,
								description: p.name,
								detail: `Project: ${p.name}`,
								value: p.key
							}));
							
							const selectedProject = await vscode.window.showQuickPick(projectItems, {
								placeHolder: placeHolderText,
								canPickMany: false
							});
							
							if (!selectedProject) {
								return; // User cancelled
							}
							
							project = selectedProject.value;
							
							// Fetch components for the selected project
							progress.report({ increment: 45, message: 'Fetching components...' });
							
							let components: Array<{ name: string; id: string }> = [];
							try {
								components = await getJiraComponents(project);
							} catch (error) {
								debugLog(`Failed to fetch JIRA components: ${error}`);
							}
							
							if (components && components.length > 0) {
								// Show dropdown for component selection
								const componentItems = [
									{ label: 'None', description: 'No component', value: undefined },
									...components.map(c => ({
										label: c.name,
										description: `Component: ${c.name}`,
										value: c.name
									}))
								];
								
								const selectedComponent = await vscode.window.showQuickPick(componentItems, {
									placeHolder: 'Select component (optional)',
									canPickMany: false
								});
								
								if (selectedComponent) {
									component = selectedComponent.value;
								}
							} else {
								// No components available, skip component selection
								component = undefined;
							}
							
							// Store the mapping for future use (using projectDir which is more specific)
							if (project) {
								await setProjectComponentMapping(context, projectDir, project, component);
							}
						} else if (!project) {
							// No projects found and no fallback was used
							vscode.window.showErrorMessage('No JIRA projects found and unable to enter project key manually');
							return;
						}
					}
				} else {
					// No specific project directory, ask user
					progress.report({ increment: 40, message: 'Fetching JIRA projects...' });
					
					// Fetch projects from JIRA
					let projects;
					try {
						projects = await getJiraProjects();
					} catch (error) {
						debugLog(`Failed to fetch JIRA projects: ${error}`);
						// Fallback to input box if API call fails
						project = await vscode.window.showInputBox({
							prompt: 'Enter JIRA project key',
							placeHolder: 'e.g., PROJ',
							validateInput: (value) => {
								if (!value || value.trim().length === 0) {
									return 'Project key is required';
								}
								return null;
							}
						}) || '';
						
						if (!project) {
							return; // User cancelled
						}
						// Set component to undefined if we used fallback
						component = undefined;
					}
					
					if (projects && projects.length > 0) {
						// Show dropdown for project selection
						const projectItems = projects.map(p => ({
							label: p.key,
							description: p.name,
							detail: `Project: ${p.name}`,
							value: p.key
						}));
					
						const selectedProject = await vscode.window.showQuickPick(projectItems, {
							placeHolder: 'Select JIRA project',
							canPickMany: false
						});
						
						if (!selectedProject) {
							return; // User cancelled
						}
						
						project = selectedProject.value;
						
						// Fetch components for the selected project
						progress.report({ increment: 45, message: 'Fetching components...' });
						
						let components: Array<{ name: string; id: string }> = [];
						try {
							components = await getJiraComponents(project);
						} catch (error) {
							debugLog(`Failed to fetch JIRA components: ${error}`);
						}
						
						if (components && components.length > 0) {
							// Show dropdown for component selection
							const componentItems = [
								{ label: 'None', description: 'No component', value: undefined },
								...components.map(c => ({
									label: c.name,
									description: `Component: ${c.name}`,
									value: c.name
								}))
							];
							
							const selectedComponent = await vscode.window.showQuickPick(componentItems, {
								placeHolder: 'Select component (optional)',
								canPickMany: false
							});
							
							if (selectedComponent) {
								component = selectedComponent.value;
							}
						} else {
							// No components available, skip component selection
							component = undefined;
						}
					} else if (!project) {
						// No projects found and no fallback was used
						vscode.window.showErrorMessage('No JIRA projects found and unable to enter project key manually');
						return;
					}
				}

				// Ensure project is set before creating ticket
				if (!project) {
					vscode.window.showErrorMessage('Project key is required');
					return;
				}

				progress.report({ increment: 50, message: 'Creating JIRA ticket...' });

				// Create summary and description
				const summary = createSummaryFromBranch(branch, changedFiles);
				// Keep description concise - only show changed files, no diff
				const maxFilesToShow = 50;
				const filesList = changedFiles.slice(0, maxFilesToShow).map(f => `- ${f}`).join('\n');
				const filesSummary = changedFiles.length > maxFilesToShow 
					? `${filesList}\n... and ${changedFiles.length - maxFilesToShow} more files (${changedFiles.length} total)`
					: filesList;
				
				const description = `Branch: ${branch}\n\nChanged files (${changedFiles.length}):\n${filesSummary}`;

				// Create JIRA ticket
				const ticket = await createJiraTicket(summary, description, project, component);
				const ticketUrl = getJiraTicketUrl(ticket.key);

				debugLog(`Created JIRA ticket: ${ticket.key}`);

				progress.report({ increment: 80, message: 'Updating PR description...' });

				// Try to find and update PR
				try {
					const repoInfo = await getGitHubRepo(workspaceRoot);
					if (repoInfo) {
						const pr = await findPRForBranch(repoInfo.owner, repoInfo.repo, branch);
						if (pr) {
							await updatePRDescription(repoInfo.owner, repoInfo.repo, pr.number, ticketUrl, ticket.key);
							debugLog(`Updated PR #${pr.number} with JIRA ticket`);
							vscode.window.showInformationMessage(
								`JIRA ticket ${ticket.key} created and added to PR #${pr.number}`,
								'Open Ticket',
								'Open PR'
							).then(action => {
								if (action === 'Open Ticket') {
									vscode.env.openExternal(vscode.Uri.parse(ticketUrl));
								} else if (action === 'Open PR') {
									vscode.env.openExternal(vscode.Uri.parse(pr.html_url));
								}
							});
						} else {
							// No PR found
							vscode.window.showInformationMessage(
								`JIRA ticket ${ticket.key} created (no PR found for this branch)`,
								'Open Ticket'
							).then(action => {
								if (action === 'Open Ticket') {
									vscode.env.openExternal(vscode.Uri.parse(ticketUrl));
								}
							});
						}
					} else {
						// Could not determine GitHub repo
						vscode.window.showInformationMessage(
							`JIRA ticket ${ticket.key} created`,
							'Open Ticket'
						).then(action => {
							if (action === 'Open Ticket') {
								vscode.env.openExternal(vscode.Uri.parse(ticketUrl));
							}
						});
					}
				} catch (error) {
					// PR update failed, but ticket was created
					debugLog(`Failed to update PR: ${error}`);
					vscode.window.showInformationMessage(
						`JIRA ticket ${ticket.key} created (failed to update PR)`,
						'Open Ticket'
					).then(action => {
						if (action === 'Open Ticket') {
							vscode.env.openExternal(vscode.Uri.parse(ticketUrl));
						}
					});
				}

				progress.report({ increment: 100, message: 'Complete!' });
			}
		);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Failed to create JIRA ticket: ${errorMessage}`);
		debugLog(`Error creating JIRA ticket: ${error}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
