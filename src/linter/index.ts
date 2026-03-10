import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PythonFunctionResolver } from '../pythonFunctionResolver';
import { debugLog } from '../utils/debug';
import { checkPythonFile, PythonDiagnostic } from './rules/pythonRules';
import { checkYamlFile, YamlDiagnostic } from './rules/yamlRules';
import { findLasConfig, findLasConfigPath, LasConfig } from './config';

/**
 * Agent Studio Linter
 * Provides real-time diagnostics for Agent Studio projects based on cursor rules
 */
export class AgentStudioLinter {
	private diagnosticCollection: vscode.DiagnosticCollection;
	private disposables: vscode.Disposable[] = [];
	private configCache: Map<string, { config: LasConfig; mtime: number }> = new Map();

	constructor() {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('agent-studio');
	}

	/**
	 * Activates the linter and sets up file watchers
	 */
	activate(context: vscode.ExtensionContext): void {
		debugLog('Activating Agent Studio Linter...');

		// Lint on file open
		this.disposables.push(
			vscode.workspace.onDidOpenTextDocument((document) => {
				this.lintDocument(document);
			})
		);

		// Lint on file save
		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument((document) => {
				this.lintDocument(document);
			})
		);

		// Lint on file change (with debounce)
		let timeout: NodeJS.Timeout | undefined;
		this.disposables.push(
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (timeout) {
					clearTimeout(timeout);
				}
				timeout = setTimeout(() => {
					this.lintDocument(event.document);
				}, 500); // 500ms debounce
			})
		);

		// Clear diagnostics when file is closed
		this.disposables.push(
			vscode.workspace.onDidCloseTextDocument((document) => {
				this.diagnosticCollection.delete(document.uri);
			})
		);

		// Watch for .adkrc and .lasrc (legacy) file changes to re-lint affected documents
		const adkrcWatcher = vscode.workspace.createFileSystemWatcher('**/.adkrc');
		const lasrcWatcher = vscode.workspace.createFileSystemWatcher('**/.lasrc');
		
		const handleConfigChange = () => {
			this.configCache.clear();
			this.relintAllOpenDocuments();
		};
		
		this.disposables.push(
			adkrcWatcher.onDidChange(handleConfigChange),
			adkrcWatcher.onDidCreate(handleConfigChange),
			adkrcWatcher.onDidDelete(handleConfigChange),
			adkrcWatcher,
			lasrcWatcher.onDidChange(handleConfigChange),
			lasrcWatcher.onDidCreate(handleConfigChange),
			lasrcWatcher.onDidDelete(handleConfigChange),
			lasrcWatcher
		);

		// Lint all currently open documents
		vscode.workspace.textDocuments.forEach((document) => {
			this.lintDocument(document);
		});

		// Add to subscriptions
		context.subscriptions.push(this.diagnosticCollection);
		this.disposables.forEach(d => context.subscriptions.push(d));

		debugLog('Agent Deployment Kit Linter activated');
	}

	/**
	 * Re-lints all currently open documents (used when .adkrc or .lasrc changes)
	 */
	private relintAllOpenDocuments(): void {
		vscode.workspace.textDocuments.forEach((document) => {
			this.lintDocument(document);
		});
	}

	/**
	 * Lints a document based on its language/file type
	 */
	private lintDocument(document: vscode.TextDocument): void {
		// Skip non-file documents
		if (document.uri.scheme !== 'file') {
			return;
		}

		const filePath = document.uri.fsPath;

		// Check if this is an Agent Studio project file
		if (!this.isAgentStudioFile(filePath)) {
			return;
		}

		// Get config to check for disabled rules
		const config = this.getConfig(filePath);

		let diagnostics: vscode.Diagnostic[] = [];

		const text = document.getText();

		if (document.languageId === 'python') {
			const pythonDiagnostics = checkPythonFile(text, filePath);
			diagnostics.push(...this.convertPythonDiagnostics(pythonDiagnostics, document));
		} else if (document.languageId === 'yaml' || filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
			const yamlDiagnostics = checkYamlFile(text, filePath);
			diagnostics.push(...this.convertYamlDiagnostics(yamlDiagnostics, document));
		}

		// Filter out disabled rules
		if (config.disabledRules.length > 0) {
			diagnostics = diagnostics.filter(d => {
				const code = typeof d.code === 'object' ? String(d.code.value) : String(d.code);
				return !config.disabledRules.includes(code);
			});
		}

		this.diagnosticCollection.set(document.uri, diagnostics);
	}

	/**
	 * Gets the .adkrc (or .lasrc) config for a file, using cache when possible
	 */
	private getConfig(filePath: string): LasConfig {
		const dir = path.dirname(filePath);
		let currentDir = dir;
		const root = path.parse(currentDir).root;
		
		// Find the .adkrc or .lasrc (legacy) file path first
		let configPath: string | null = null;
		while (currentDir !== root) {
			// Check for .adkrc first (preferred), then .lasrc (legacy)
			const adkCandidate = path.join(currentDir, '.adkrc');
			const lasCandidate = path.join(currentDir, '.lasrc');
			if (fs.existsSync(adkCandidate)) {
				configPath = adkCandidate;
				break;
			}
			if (fs.existsSync(lasCandidate)) {
				configPath = lasCandidate;
				break;
			}
			if (fs.existsSync(path.join(currentDir, 'imports.py')) ||
			    fs.existsSync(path.join(currentDir, 'gen_decorators.py'))) {
				break;
			}
			currentDir = path.dirname(currentDir);
		}
		
		if (!configPath) {
			return { disabledRules: [] };
		}
		
		// Check cache
		const cached = this.configCache.get(configPath);
		const stats = fs.statSync(configPath);
		
		if (cached && cached.mtime === stats.mtimeMs) {
			return cached.config;
		}
		
		// Load and cache config
		const config = findLasConfig(filePath);
		this.configCache.set(configPath, { config, mtime: stats.mtimeMs });
		
		if (config.disabledRules.length > 0) {
			debugLog('Loaded config, disabled rules:', config.disabledRules);
		}
		
		return config;
	}

	/**
	 * Checks if a file is part of an Agent Studio project
	 */
	private isAgentStudioFile(filePath: string): boolean {
		// Check if file is in a directory that has Agent Studio markers
		// (functions/, flows/, topics/, or has imports.py/gen_decorators.py nearby)
		const projectRoot = PythonFunctionResolver.findProjectRoot(filePath);
		if (projectRoot) {
			return true;
		}

		// Also check for common Agent Studio paths
		const normalizedPath = filePath.replace(/\\/g, '/');
		if (
			normalizedPath.includes('/functions/') ||
			normalizedPath.includes('/flows/') ||
			normalizedPath.includes('/topics/') ||
			normalizedPath.includes('/agent_settings/')
		) {
			return true;
		}

		return false;
	}

	/**
	 * Converts Python diagnostics to VS Code diagnostics
	 */
	private convertPythonDiagnostics(
		pythonDiagnostics: PythonDiagnostic[],
		document: vscode.TextDocument
	): vscode.Diagnostic[] {
		return pythonDiagnostics.map(pd => {
			const range = new vscode.Range(
				new vscode.Position(pd.line, pd.startChar),
				new vscode.Position(pd.line, pd.endChar)
			);

			const diagnostic = new vscode.Diagnostic(
				range,
				pd.message,
				this.getSeverity(pd.severity)
			);

			diagnostic.code = pd.code;
			diagnostic.source = 'Agent Studio';

			return diagnostic;
		});
	}

	/**
	 * Converts YAML diagnostics to VS Code diagnostics
	 */
	private convertYamlDiagnostics(
		yamlDiagnostics: YamlDiagnostic[],
		document: vscode.TextDocument
	): vscode.Diagnostic[] {
		return yamlDiagnostics.map(yd => {
			const range = new vscode.Range(
				new vscode.Position(yd.line, yd.startChar),
				new vscode.Position(yd.line, yd.endChar)
			);

			const diagnostic = new vscode.Diagnostic(
				range,
				yd.message,
				this.getSeverity(yd.severity)
			);

			diagnostic.code = yd.code;
			diagnostic.source = 'Agent Studio';

			return diagnostic;
		});
	}

	/**
	 * Converts string severity to VS Code DiagnosticSeverity
	 */
	private getSeverity(severity: 'error' | 'warning' | 'info'): vscode.DiagnosticSeverity {
		switch (severity) {
			case 'error':
				return vscode.DiagnosticSeverity.Error;
			case 'warning':
				return vscode.DiagnosticSeverity.Warning;
			case 'info':
				return vscode.DiagnosticSeverity.Information;
			default:
				return vscode.DiagnosticSeverity.Warning;
		}
	}

	/**
	 * Disposes the linter resources
	 */
	dispose(): void {
		this.diagnosticCollection.dispose();
		this.disposables.forEach(d => d.dispose());
	}
}

