import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PythonFunctionResolver } from './pythonFunctionResolver';
import { debugLog } from './utils/debug';

/**
 * Helper function to extract function call pattern from a line at a given position
 * Returns { type: 'conv' | 'flow', functionName: string, range: vscode.Range } or null
 */
function extractFunctionCall(
	document: vscode.TextDocument,
	position: vscode.Position
): { type: 'conv' | 'flow'; functionName: string; range: vscode.Range } | null {
	const line = document.lineAt(position);
	const lineText = line.text;
	const offset = position.character;

	// Quick check: if the line doesn't contain "conv.functions" or "flow.functions", return immediately
	if (!lineText.includes('conv.functions') && !lineText.includes('flow.functions')) {
		return null;
	}

	// First, try to get the word at the cursor position
	// This helps when user clicks directly on the function name
	const wordRange = document.getWordRangeAtPosition(position, /\w+/);
	let searchStart = 0;
	let searchEnd = lineText.length;
	
	if (wordRange) {
		// Expand search to include context around the word
		// Look backwards up to 50 characters to find "conv.functions." or "flow.functions."
		searchStart = Math.max(0, wordRange.start.character - 50);
		searchEnd = Math.min(lineText.length, wordRange.end.character + 50);
	}
	
	const searchText = lineText.substring(searchStart, searchEnd);

	// Try to match conv.functions.function_name or flow.functions.function_name
	// This regex matches the full pattern including the function name
	const patterns = [
		// Match conv.functions.function_name (with optional parentheses and arguments)
		{
			regex: /conv\.functions\.(\w+)(?:\([^)]*\))?/g,
			type: 'conv' as const
		},
		// Match flow.functions.function_name (with optional parentheses and arguments)
		{
			regex: /flow\.functions\.(\w+)(?:\([^)]*\))?/g,
			type: 'flow' as const
		}
	];

	for (const pattern of patterns) {
		let match;
		pattern.regex.lastIndex = 0; // Reset regex
		while ((match = pattern.regex.exec(searchText)) !== null) {
			const matchStart = match.index;
			const matchEnd = match.index + match[0].length;
			
			// The match position is relative to searchText, so we need to adjust
			const absoluteMatchStart = searchStart + matchStart;
			const absoluteMatchEnd = searchStart + matchEnd;
			
			// Check if the cursor position is within this match
			if (offset >= absoluteMatchStart && offset <= absoluteMatchEnd) {
				const functionName = match[1];
				// Find where the function name starts in the match
				const functionNameOffset = match[0].indexOf(functionName);
				const functionNameStart = absoluteMatchStart + functionNameOffset;
				const functionNameEnd = functionNameStart + functionName.length;
				
				// Only return a result if the cursor is specifically on the function name part
				// Not on "conv", "flow", or "functions"
				if (offset >= functionNameStart && offset <= functionNameEnd) {
					const startPos = new vscode.Position(position.line, functionNameStart);
					const endPos = new vscode.Position(position.line, functionNameEnd);
					return {
						type: pattern.type,
						functionName,
						range: new vscode.Range(startPos, endPos)
					};
				}
				// If cursor is on "conv", "flow", or "functions", return null
				return null;
			}
		}
	}

	return null;
}

/**
 * Definition provider for conv.functions and flow.functions
 */
export class PythonDefinitionProvider implements vscode.DefinitionProvider {
	provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
		// Ultra-quick check: if line doesn't contain our patterns, return undefined immediately
		// This allows VS Code to skip our provider and use others
		const line = document.lineAt(position);
		if (!line.text.includes('conv.functions') && !line.text.includes('flow.functions')) {
			return undefined; // Return undefined to let other providers handle it
		}

		// Only process if we have our specific patterns
		const functionCall = extractFunctionCall(document, position);
		
		if (!functionCall) {
			return undefined; // Let other providers handle it
		}

		if (functionCall.type === 'conv') {
			return PythonFunctionResolver.resolveConvFunction(functionCall.functionName, document);
		} else if (functionCall.type === 'flow') {
			return PythonFunctionResolver.resolveFlowFunction(functionCall.functionName, document);
		}

		return undefined;
	}
}

/**
 * Hover provider for conv.functions and flow.functions
 */
export class PythonHoverProvider implements vscode.HoverProvider {
	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.Hover> {
		// Ultra-quick check: if line doesn't contain our patterns, return undefined immediately
		const line = document.lineAt(position);
		if (!line.text.includes('conv.functions') && !line.text.includes('flow.functions')) {
			return undefined; // Return undefined to let other providers handle it
		}

		const functionCall = extractFunctionCall(document, position);
		
		if (!functionCall) {
			return undefined;
		}

		let functionPath: string | null = null;
		let functionType: string = '';

		if (functionCall.type === 'conv') {
			const location = PythonFunctionResolver.resolveConvFunction(functionCall.functionName, document);
			if (location) {
				functionPath = location.uri.fsPath;
				functionType = 'Global function';
			}
		} else if (functionCall.type === 'flow') {
			const location = PythonFunctionResolver.resolveFlowFunction(functionCall.functionName, document);
			if (location) {
				functionPath = location.uri.fsPath;
				functionType = 'Flow function';
			}
		}

		if (functionPath) {
			const description = PythonFunctionResolver.getFunctionDescription(functionPath);
			const parameters = PythonFunctionResolver.getFunctionParameters(functionPath);
			const hoverText = new vscode.MarkdownString();
			hoverText.appendMarkdown(`**${functionType}**: \`${functionCall.functionName}\``);
			
			if (description) {
				hoverText.appendMarkdown(`\n\n${description}`);
			}
			
			if (parameters.length > 0) {
				hoverText.appendMarkdown(`\n\n**Parameters:**`);
				for (const param of parameters) {
					if (param.description) {
						hoverText.appendMarkdown(`\n- \`${param.name}\`: ${param.description}`);
					} else {
						hoverText.appendMarkdown(`\n- \`${param.name}\``);
					}
				}
			}
			
			hoverText.appendMarkdown(`\n\n*${functionPath}*`);
			
			return new vscode.Hover(hoverText, functionCall.range);
		}

		return undefined;
	}
}

/**
 * Helper function to determine if a file is a function definition file
 * and extract the function name and type
 */
function getFunctionInfoFromFile(filePath: string): { functionName: string; type: 'conv' | 'flow' } | null {
	const fileName = path.basename(filePath, '.py');
	const dirName = path.dirname(filePath);
	
	// Check if this is a global function (in project_root/functions/function_name.py)
	const projectRoot = PythonFunctionResolver.findProjectRoot(filePath);
	if (projectRoot) {
		const globalFunctionsDir = path.join(projectRoot, 'functions');
		if (dirName === globalFunctionsDir) {
			return { functionName: fileName, type: 'conv' };
		}
		
		// Check if this is a flow function (in project_root/functions/flow_name/function_name.py)
		const relativePath = path.relative(globalFunctionsDir, dirName);
		const parts = relativePath.split(path.sep);
		if (parts.length === 1 && parts[0] && parts[0] !== '.') {
			// We're in functions/flow_name/, so this is a flow function
			return { functionName: fileName, type: 'flow' };
		}
	}
	
	return null;
}

/**
 * Searches for all references to a function in Python files
 * Optimized to use direct file reads instead of opening documents
 */
async function findFunctionReferences(
	functionName: string,
	type: 'conv' | 'flow',
	excludeFile: string | undefined,
	token: vscode.CancellationToken
): Promise<vscode.Location[]> {
	const locations: vscode.Location[] = [];
	
	// Escape the function name for regex
	const escapedFunctionName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	
	// Build search pattern - match conv.functions.functionName or flow.functions.functionName
	// with optional whitespace and parentheses
	const pattern = type === 'conv'
		? new RegExp(`conv\\.functions\\.${escapedFunctionName}(?:\\s*\\([^)]*\\))?`, 'g')
		: new RegExp(`flow\\.functions\\.${escapedFunctionName}(?:\\s*\\([^)]*\\))?`, 'g');
	
	// Quick string check pattern (for fast filtering before regex)
	const quickCheckPattern = type === 'conv'
		? `conv.functions.${functionName}`
		: `flow.functions.${functionName}`;
	
	debugLog(`Searching for ${type === 'conv' ? 'conv' : 'flow'}.functions.${functionName}`);
	
	try {
		// Get all Python files in the workspace (with limit)
		const pythonFiles = await vscode.workspace.findFiles(
			'**/*.py',
			'**/node_modules/**',
			5000 // Limit to 5000 files for performance
		);
		
		debugLog(`Checking ${pythonFiles.length} Python files`);
		
		// Process files in batches to avoid blocking
		const batchSize = 50;
		for (let i = 0; i < pythonFiles.length; i += batchSize) {
			// Check cancellation token
			if (token.isCancellationRequested) {
				break;
			}
			
			const batch = pythonFiles.slice(i, i + batchSize);
			
			// Process batch
			for (const fileUri of batch) {
				// Skip the function definition file itself
				if (excludeFile && fileUri.fsPath === excludeFile) {
					continue;
				}
				
				if (token.isCancellationRequested) {
					break;
				}
				
				try {
					// Read file directly (faster than opening as document)
					const fileContent = fs.readFileSync(fileUri.fsPath, 'utf8');
					
					// Quick check: skip if pattern not found
					if (!fileContent.includes(quickCheckPattern)) {
						continue;
					}
					
					// Split into lines and search
					const lines = fileContent.split('\n');
					for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
						if (token.isCancellationRequested) {
							break;
						}
						
						const line = lines[lineIndex];
						let match;
						pattern.lastIndex = 0; // Reset regex
						
						while ((match = pattern.exec(line)) !== null) {
							// Find the function name within the match
							const functionNameOffset = match[0].indexOf(functionName);
							if (functionNameOffset !== -1) {
								const functionNameStart = match.index + functionNameOffset;
								const functionNameEnd = functionNameStart + functionName.length;
								
								locations.push(new vscode.Location(
									fileUri,
									new vscode.Range(
										new vscode.Position(lineIndex, functionNameStart),
										new vscode.Position(lineIndex, functionNameEnd)
									)
								));
							}
						}
					}
				} catch (error) {
					// Skip files that can't be read
					debugLog(`Error reading file ${fileUri.fsPath}:`, error);
				}
			}
			
			// Yield control periodically to prevent blocking
			if (i + batchSize < pythonFiles.length) {
				await new Promise(resolve => setImmediate(resolve));
			}
		}
	} catch (error) {
		// If search fails, fall back to empty results
		debugLog(`Error searching for references:`, error);
	}
	
	debugLog(`Found ${locations.length} references to ${functionName}`);
	return locations;
}

/**
 * References provider for Python functions
 * Finds all places where a function is called using conv.functions.functionName or flow.functions.functionName
 */
export class PythonReferencesProvider implements vscode.ReferenceProvider {
	provideReferences(
		document: vscode.TextDocument,
		position: vscode.Position,
		context: vscode.ReferenceContext,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.Location[]> {
		// Check if we're in a function definition file
		const functionInfo = getFunctionInfoFromFile(document.uri.fsPath);
		
		if (!functionInfo) {
			// Not a function file, check if we're on a function call
			const functionCall = extractFunctionCall(document, position);
			if (functionCall) {
				// We're on a function call, find all references to this function
				return findFunctionReferences(functionCall.functionName, functionCall.type, undefined, token);
			}
			return undefined;
		}
		
		// We're in a function definition file, find all references to this function
		return findFunctionReferences(functionInfo.functionName, functionInfo.type, document.uri.fsPath, token);
	}
}

