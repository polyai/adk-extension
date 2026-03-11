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
		pythonDefinitionProvider,
		pythonHoverProvider,
		pythonReferencesProvider
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
