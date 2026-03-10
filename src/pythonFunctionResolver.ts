import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { debugLog } from './utils/debug';

/**
 * Resolves function paths for conv.functions and flow.functions in Python files
 */
export class PythonFunctionResolver {
	/**
	 * Finds the project root (directory containing a functions folder that's not inside flows)
	 */
	static findProjectRoot(filePath: string): string | null {
		let currentDir = path.dirname(filePath);
		
		while (currentDir !== path.dirname(currentDir)) {
			const functionsDir = path.join(currentDir, 'functions');
			const flowsDir = path.join(currentDir, 'flows');
			
			// Check if this directory has a functions folder but is not inside a flows directory
			if (fs.existsSync(functionsDir)) {
				// Check if we're not inside a flows directory
				if (!currentDir.includes(path.sep + 'flows' + path.sep) && 
				    !currentDir.endsWith(path.sep + 'flows')) {
					return currentDir;
				}
			}
			
			currentDir = path.dirname(currentDir);
		}
		
		return null;
	}

	/**
	 * Finds the flow directory that contains the given file
	 * A flow directory is identified by containing a flow_config.yaml file
	 */
	static findFlowDirectory(filePath: string): string | null {
		let currentDir = path.dirname(filePath);
		
		while (currentDir !== path.dirname(currentDir)) {
			const configPath = path.join(currentDir, 'flow_config.yaml');
			if (fs.existsSync(configPath)) {
				return currentDir;
			}
			currentDir = path.dirname(currentDir);
		}
		
		return null;
	}

	/**
	 * Gets the flow name for a given file path
	 * Checks two locations:
	 * 1. If file is in a flow directory (has flow_config.yaml), use that directory name
	 * 2. If file is in functions/flow_name/, use that flow_name
	 */
	static getFlowName(filePath: string): string | null {
		const projectRoot = this.findProjectRoot(filePath);
		if (!projectRoot) {
			return null;
		}

		// First, check if we're in a flow directory (has flow_config.yaml)
		const flowDir = this.findFlowDirectory(filePath);
		if (flowDir) {
			return path.basename(flowDir);
		}

		// If not, check if we're in functions/flow_name/
		const functionsDir = path.join(projectRoot, 'functions');
		const fileDir = path.dirname(filePath);
		
		// Check if the file is inside functions/flow_name/
		if (fileDir.startsWith(functionsDir + path.sep)) {
			const relativePath = path.relative(functionsDir, fileDir);
			const parts = relativePath.split(path.sep);
			
			// If we're in functions/flow_name/ or functions/flow_name/subdir/, use flow_name
			if (parts.length > 0 && parts[0]) {
				// Check if this is actually a flow directory (not a .py file in functions/)
				// If parts[0] exists and we're not directly in functions/, it's a flow subdirectory
				if (parts[0] !== '.' && parts[0] !== '') {
					return parts[0];
				}
			}
		}

		return null;
	}

	/**
	 * Resolves conv.functions.function_name() to the global function file path
	 */
	static resolveConvFunction(functionName: string, document: vscode.TextDocument): vscode.Location | null {
		debugLog('Resolving conv function:', functionName, 'for file:', document.uri.fsPath);
		const projectRoot = this.findProjectRoot(document.uri.fsPath);
		debugLog('Project root found:', projectRoot);
		
		if (!projectRoot) {
			debugLog('No project root found');
			return null;
		}

		const functionPath = path.join(projectRoot, 'functions', `${functionName}.py`);
		debugLog('Looking for function at:', functionPath, 'exists:', fs.existsSync(functionPath));
		
		if (fs.existsSync(functionPath)) {
			return new vscode.Location(
				vscode.Uri.file(functionPath),
				new vscode.Position(0, 0)
			);
		}

		return null;
	}

	/**
	 * Resolves flow.functions.function_name() to the flow function file path
	 * Flow functions are located at: project_root/functions/flow_name/function_name.py
	 * The flow is determined by finding which flow the current file belongs to
	 */
	static resolveFlowFunction(functionName: string, document: vscode.TextDocument): vscode.Location | null {
		debugLog('Resolving flow function:', functionName, 'for file:', document.uri.fsPath);
		
		const projectRoot = this.findProjectRoot(document.uri.fsPath);
		debugLog('Project root found:', projectRoot);
		
		if (!projectRoot) {
			debugLog('No project root found');
			return null;
		}

		const flowName = this.getFlowName(document.uri.fsPath);
		debugLog('Flow name:', flowName);
		
		if (!flowName) {
			debugLog('No flow name found');
			return null;
		}

		// Flow functions are in project_root/functions/flow_name/function_name.py
		const functionPath = path.join(projectRoot, 'functions', flowName, `${functionName}.py`);
		debugLog('Looking for flow function at:', functionPath, 'exists:', fs.existsSync(functionPath));
		
		if (fs.existsSync(functionPath)) {
			return new vscode.Location(
				vscode.Uri.file(functionPath),
				new vscode.Position(0, 0)
			);
		}

		return null;
	}

	/**
	 * Gets all available global function names
	 */
	static getGlobalFunctionNames(document: vscode.TextDocument): string[] {
		const projectRoot = this.findProjectRoot(document.uri.fsPath);
		if (!projectRoot) {
			return [];
		}

		const functionsDir = path.join(projectRoot, 'functions');
		if (!fs.existsSync(functionsDir)) {
			return [];
		}

		const files = fs.readdirSync(functionsDir);
		return files
			.filter(file => file.endsWith('.py'))
			.map(file => path.basename(file, '.py'));
	}

	/**
	 * Gets all available flow function names for the current file's flow
	 * Flow functions are located at: project_root/functions/flow_name/
	 */
	static getFlowFunctionNames(document: vscode.TextDocument): string[] {
		const projectRoot = this.findProjectRoot(document.uri.fsPath);
		if (!projectRoot) {
			return [];
		}

		const flowName = this.getFlowName(document.uri.fsPath);
		if (!flowName) {
			return [];
		}

		// Flow functions are in project_root/functions/flow_name/
		const functionsDir = path.join(projectRoot, 'functions', flowName);
		if (!fs.existsSync(functionsDir)) {
			return [];
		}

		const files = fs.readdirSync(functionsDir);
		return files
			.filter(file => file.endsWith('.py'))
			.map(file => path.basename(file, '.py'));
	}

	/**
	 * Extracts function description from a Python file
	 * Only returns description if @func_description decorator is present
	 */
	static getFunctionDescription(filePath: string): string {
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			
			// Only extract @func_description decorator
			const descMatch = content.match(/@func_description\(["']([^"']+)["']\)/);
			if (descMatch) {
				return descMatch[1];
			}
		} catch (error) {
			// Ignore errors reading function files
		}
		
		return '';
	}

	/**
	 * Extracts function parameters from @func_parameter decorators
	 * Returns an array of { name: string, description?: string }
	 */
	static getFunctionParameters(filePath: string): Array<{ name: string; description?: string }> {
		const parameters: Array<{ name: string; description?: string }> = [];
		
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			const lines = content.split('\n');
			
			for (const line of lines) {
				// Look for @func_parameter decorator
				if (!line.trim().startsWith('@func_parameter')) {
					continue;
				}
				
				// Extract the content inside the parentheses
				const parenMatch = line.match(/@func_parameter\s*\((.*)\)/);
				if (!parenMatch) {
					continue;
				}
				
				const argsStr = parenMatch[1].trim();
				
				// Parse the arguments - handle both single and double quotes
				// Split by comma, but be careful about commas inside quoted strings
				let paramName = '';
				let paramDescription: string | undefined = undefined;
				
				// Find the first quoted string (parameter name)
				const firstQuoteMatch = argsStr.match(/^(["'])((?:(?!\1)[^\\]|\\.)*)\1/);
				if (firstQuoteMatch) {
					paramName = firstQuoteMatch[2].replace(/\\(.)/g, '$1');
					
					// Check if there's a second quoted string (description)
					const remaining = argsStr.substring(firstQuoteMatch[0].length).trim();
					if (remaining.startsWith(',')) {
						const afterComma = remaining.substring(1).trim();
						const secondQuoteMatch = afterComma.match(/^(["'])((?:(?!\1)[^\\]|\\.)*)\1/);
						if (secondQuoteMatch) {
							paramDescription = secondQuoteMatch[2].replace(/\\(.)/g, '$1');
						}
					}
				}
				
				if (paramName) {
					debugLog('Found parameter:', paramName, 'description:', paramDescription);
					parameters.push({
						name: paramName,
						description: paramDescription
					});
				}
			}
		} catch (error) {
			console.error('[ADK Extension] Error extracting function parameters:', error);
		}
		
		return parameters;
	}
}

