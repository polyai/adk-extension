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

function toSnakeCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, '$1_$2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
		.replace(/[\s\-]+/g, '_')
		.replace(/[^a-zA-Z0-9_]/g, '')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '')
		.toLowerCase();
}

async function openFlowViewer(flowDir: string, context: vscode.ExtensionContext): Promise<void> {
	const configPath = path.join(flowDir, 'flow_config.yaml');
	if (!fs.existsSync(configPath)) {
		vscode.window.showErrorMessage(
			`Flow directory must contain a flow_config.yaml file.\nSelected: ${flowDir}`,
			'OK'
		);
		return;
	}
	if (!fs.statSync(flowDir).isDirectory()) {
		vscode.window.showErrorMessage(`Selected path is not a directory: ${flowDir}`);
		return;
	}

	let flowName = path.basename(flowDir);
	try {
		const configContent = fs.readFileSync(configPath, 'utf8');
		const config = yaml.load(configContent) as { name?: string };
		if (config && config.name) {
			flowName = config.name;
		}
	} catch {
		// Use directory name if config parsing fails
	}

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

	const messageHandler = new WebviewMessageHandler(panel, flowDir);
	panel.webview.onDidReceiveMessage(
		async message => {
			await messageHandler.handleMessage(message);
		},
		undefined,
		context.subscriptions
	);

	panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

	try {
		const parser = new FlowParser(flowDir);
		const flowGraph = await parser.parseFlow();
		messageHandler.setFlowGraphData(flowGraph);
		panel.webview.postMessage({
			command: 'loadFlow',
			flowGraph: flowGraph
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Error parsing flow: ${errorMessage}`, 'OK');
		console.error('Flow parsing error:', error);
		panel.webview.html = getErrorWebviewContent(errorMessage);
	}
}

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
			if (!fs.statSync(flowDir).isDirectory()) {
				flowDir = path.dirname(flowDir);
			}
		} else {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (workspaceFolders && workspaceFolders.length > 0) {
				const workspaceRoot = workspaceFolders[0].uri.fsPath;
				if (fs.existsSync(path.join(workspaceRoot, 'flow_config.yaml'))) {
					flowDir = workspaceRoot;
				} else {
					const selectedFolders = await vscode.window.showOpenDialog({
						canSelectFiles: false,
						canSelectFolders: true,
						canSelectMany: false,
						openLabel: 'Select Flow Directory',
						defaultUri: vscode.Uri.file(workspaceRoot)
					});
					if (!selectedFolders || selectedFolders.length === 0) return;
					flowDir = selectedFolders[0].fsPath;
				}
			} else {
				const selectedFolders = await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: 'Select Flow Directory'
				});
				if (!selectedFolders || selectedFolders.length === 0) return;
				flowDir = selectedFolders[0].fsPath;
			}
		}

		await openFlowViewer(flowDir, context);
	});

	const createFlowDisposable = vscode.commands.registerCommand('adk-extension.createFlow', async (uri?: vscode.Uri) => {
		const flowName = await vscode.window.showInputBox({
			prompt: 'Enter a name for the new flow',
			placeHolder: 'e.g. My Flow',
			validateInput: (value) => {
				const trimmed = value.trim();
				if (!trimmed) return 'Name is required';
				if (/[<>:"/\\|?*]/.test(trimmed)) return 'Name cannot contain \\ / : * ? " < > |';
				return undefined;
			}
		});
		if (!flowName || !flowName.trim()) return;

		let parentDir: string;
		if (uri && uri.fsPath) {
			const stat = fs.statSync(uri.fsPath);
			parentDir = stat.isDirectory() ? uri.fsPath : path.dirname(uri.fsPath);
		} else {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			const defaultUri = workspaceFolders && workspaceFolders.length > 0
				? workspaceFolders[0].uri
				: undefined;

			const selectedFolders = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Select parent folder for the new flow',
				defaultUri
			});
			if (!selectedFolders || selectedFolders.length === 0) return;
			parentDir = selectedFolders[0].fsPath;
		}
		const folderName = toSnakeCase(flowName.trim()) || 'new_flow';
		const flowDir = path.join(parentDir, folderName);

		if (fs.existsSync(flowDir)) {
			vscode.window.showErrorMessage(`A folder "${folderName}" already exists at that location.`);
			return;
		}

		try {
			fs.mkdirSync(flowDir, { recursive: true });
			const stepsDir = path.join(flowDir, 'steps');
			fs.mkdirSync(stepsDir, { recursive: true });

			const flowConfig = {
				name: flowName.trim(),
				description: 'New flow.',
				start_step: 'greeting'
			};
			const flowConfigPath = path.join(flowDir, 'flow_config.yaml');
			fs.writeFileSync(flowConfigPath, yaml.dump(flowConfig, { indent: 2, lineWidth: 100 }), 'utf8');

			const greetingStep = `name: greeting
step_type: default_step
prompt: |
  Enter your prompt here.
extracted_entities: []
conditions: []
`;
			fs.writeFileSync(path.join(stepsDir, 'greeting.yaml'), greetingStep, 'utf8');

			vscode.window.showInformationMessage(`Flow "${flowName.trim()}" created. Opening flow viewer.`);
			await openFlowViewer(flowDir, context);

			const flowUri = vscode.Uri.file(flowDir);
			await vscode.commands.executeCommand('revealInExplorer', flowUri);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error creating flow: ${errorMessage}`);
			console.error('Error creating flow:', error);
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
		createFlowDisposable,
		toggleDebugDisposable,
		pythonDefinitionProvider,
		pythonHoverProvider,
		pythonReferencesProvider
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
