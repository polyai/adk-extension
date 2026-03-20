import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PythonFunctionResolver } from './pythonFunctionResolver';
import { debugLog } from './utils/debug';
import { conversationMembers, flowMembers, RuntimeMember } from './generated/runtimeDescriptions';

/** Shared regex for matching flow.goto_step("...") calls. Also used in flowParser.ts and pythonRules.ts. */
export const GOTO_STEP_PATTERN = /flow\.goto_step\(\s*["']([^"']+)["']/g;

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
 * Extract a conv.attribute or flow.attribute reference at the cursor position.
 * Returns null if the cursor is on conv.functions.X (handled by extractFunctionCall).
 */
function extractRuntimeAttribute(
	document: vscode.TextDocument,
	position: vscode.Position
): { object: 'conv' | 'flow'; attribute: string; range: vscode.Range } | null {
	const lineText = document.lineAt(position).text;
	const offset = position.character;

	// Quick check
	if (!lineText.includes('conv.') && !lineText.includes('flow.')) {
		return null;
	}

	// Match conv.xxx or flow.xxx — but skip conv.functions.X / flow.functions.X
	const pattern = /\b(conv|flow)\.(\w+)/g;
	let match;
	while ((match = pattern.exec(lineText)) !== null) {
		const obj = match[1] as 'conv' | 'flow';
		const attr = match[2];

		// Skip the "functions" accessor — that's handled by extractFunctionCall
		if (attr === 'functions') continue;

		// Check the attribute is in our known members
		const members = obj === 'conv' ? conversationMembers : flowMembers;
		if (!members[attr]) continue;

		const attrStart = match.index + obj.length + 1; // after "conv." or "flow."
		const attrEnd = attrStart + attr.length;

		if (offset >= attrStart && offset <= attrEnd) {
			return {
				object: obj,
				attribute: attr,
				range: new vscode.Range(
					new vscode.Position(position.line, attrStart),
					new vscode.Position(position.line, attrEnd),
				),
			};
		}
	}

	return null;
}

/**
 * Extract a flow.goto_step("Step Name") reference, with cursor on the step name string.
 * Returns the step name and range of the string literal.
 */
function extractGotoStep(
	document: vscode.TextDocument,
	position: vscode.Position
): { stepName: string; range: vscode.Range } | null {
	const lineText = document.lineAt(position).text;
	const offset = position.character;

	GOTO_STEP_PATTERN.lastIndex = 0;
	let match;
	while ((match = GOTO_STEP_PATTERN.exec(lineText)) !== null) {
		const stepName = match[1];
		// Find the position of the step name string (inside the quotes)
		const nameIdx = match[0].indexOf(stepName);
		const nameStart = match.index + nameIdx;
		const nameEnd = nameStart + stepName.length;

		if (offset >= nameStart && offset <= nameEnd) {
			return {
				stepName,
				range: new vscode.Range(
					new vscode.Position(position.line, nameStart),
					new vscode.Position(position.line, nameEnd),
				),
			};
		}
	}

	return null;
}

/**
 * Resolve a step name to the YAML file that defines it.
 * Walks up from the current file to find the flow directory, then scans steps/*.yaml.
 */
function resolveStepFile(
	stepName: string,
	document: vscode.TextDocument
): vscode.Location | null {
	// Find the flow directory (contains flow_config.yaml)
	const flowDir = PythonFunctionResolver.findFlowDirectory(document.uri.fsPath);
	if (!flowDir) {
		debugLog('resolveStepFile: no flow directory found');
		return null;
	}

	const stepsDir = path.join(flowDir, 'steps');
	if (!fs.existsSync(stepsDir)) {
		debugLog('resolveStepFile: no steps/ directory in', flowDir);
		return null;
	}

	// Also check function_steps/
	const functionStepsDir = path.join(flowDir, 'function_steps');

	// Scan steps/*.yaml for matching name: field
	const yamlFiles = fs.readdirSync(stepsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
	for (const file of yamlFiles) {
		const filePath = path.join(stepsDir, file);
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/m);
			if (nameMatch && nameMatch[1] === stepName) {
				return new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0));
			}
		} catch {
			// skip unreadable files
		}
	}

	// Check function_steps/*.py (step name matches filename without .py)
	if (fs.existsSync(functionStepsDir)) {
		const pyFiles = fs.readdirSync(functionStepsDir).filter(f => f.endsWith('.py'));
		for (const file of pyFiles) {
			if (path.basename(file, '.py') === stepName) {
				const filePath = path.join(functionStepsDir, file);
				return new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0));
			}
		}
	}

	debugLog(`resolveStepFile: step "${stepName}" not found in ${stepsDir}`);
	return null;
}

/**
 * Build a markdown hover tooltip from a RuntimeMember.
 */
function buildRuntimeHover(obj: 'conv' | 'flow', member: RuntimeMember): vscode.MarkdownString {
	const className = obj === 'conv' ? 'Conversation' : 'Flow';
	const kindLabel = member.kind === 'property' ? 'property' : 'method';

	const md = new vscode.MarkdownString();
	md.appendMarkdown(`**${className} ${kindLabel}**: \`${member.name}\``);

	if (member.signature) {
		md.appendCodeblock(`${obj}.${member.name}${member.signature}`, 'python');
	} else if (member.returnType) {
		md.appendCodeblock(`${obj}.${member.name}: ${member.returnType}`, 'python');
	}

	if (member.description) {
		md.appendMarkdown(`\n\n${member.description}`);
	}

	if (member.parameters && member.parameters.length > 0) {
		md.appendMarkdown(`\n\n**Parameters:**`);
		for (const p of member.parameters) {
			const typeStr = p.type ? `: ${p.type}` : '';
			const descStr = p.description ? ` — ${p.description}` : '';
			md.appendMarkdown(`\n- \`${p.name}${typeStr}\`${descStr}`);
		}
	}

	return md;
}

/**
 * Definition provider for conv.functions, flow.functions, and flow.goto_step
 */
export class PythonDefinitionProvider implements vscode.DefinitionProvider {
	provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
		const lineText = document.lineAt(position).text;

		// Ultra-quick check: if line doesn't contain our patterns, return undefined immediately
		// This allows VS Code to skip our provider and use others
		if (!lineText.includes('conv.') && !lineText.includes('flow.')) {
			return undefined; // Return undefined to let other providers handle it
		}

		// Only process if we have our specific patterns
		// 1. conv.functions.X / flow.functions.X → navigate to function file
		const functionCall = extractFunctionCall(document, position);
		if (functionCall) {
			if (functionCall.type === 'conv') {
				return PythonFunctionResolver.resolveConvFunction(functionCall.functionName, document);
			} else if (functionCall.type === 'flow') {
				return PythonFunctionResolver.resolveFlowFunction(functionCall.functionName, document);
			}
		}

		// 2. flow.goto_step("Step Name") → navigate to step YAML file
		// Uses LocationLink with originSelectionRange so the entire step name
		// (including spaces) is treated as one continuous clickable link.
		if (lineText.includes('goto_step')) {
			const gotoStep = extractGotoStep(document, position);
			if (gotoStep) {
				const target = resolveStepFile(gotoStep.stepName, document);
				if (target) {
					const link: vscode.LocationLink = {
						originSelectionRange: gotoStep.range,
						targetUri: target.uri,
						targetRange: target.range,
						targetSelectionRange: target.range,
					};
					return [link];
				}
			}
		}

		return undefined; // Let other providers handle it
	}
}

/**
 * Hover provider for conv.functions and flow.functions
 */
export class PythonHoverProvider implements vscode.HoverProvider {
	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.Hover> {
		const lineText = document.lineAt(position).text;

		// Ultra-quick check: if line doesn't contain our patterns, return undefined immediately
		if (!lineText.includes('conv.') && !lineText.includes('flow.')) {
			return undefined; // Return undefined to let other providers handle it
		}

		// 1. conv.functions.X / flow.functions.X → show function description from file
		const functionCall = extractFunctionCall(document, position);
		if (functionCall) {
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
		}

		// 2. conv.attribute / flow.attribute → show runtime description
		const runtimeAttr = extractRuntimeAttribute(document, position);
		if (runtimeAttr) {
			const members = runtimeAttr.object === 'conv' ? conversationMembers : flowMembers;
			const member = members[runtimeAttr.attribute];
			if (member) {
				return new vscode.Hover(buildRuntimeHover(runtimeAttr.object, member), runtimeAttr.range);
			}
		}

		return undefined;
	}
}

/**
 * Completion provider for conv. and flow. attributes.
 * Triggered when the user types "." after conv or flow, showing all available
 * members with descriptions, types, and snippet placeholders for method parameters.
 */
export class PythonCompletionProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext
	): vscode.ProviderResult<vscode.CompletionItem[]> {
		const lineText = document.lineAt(position).text;
		const textBeforeCursor = lineText.substring(0, position.character);

		// Check if the user just typed "conv." or "flow."
		const triggerMatch = textBeforeCursor.match(/\b(conv|flow)\.\w*$/);
		if (!triggerMatch) {
			return undefined;
		}

		const obj = triggerMatch[1] as 'conv' | 'flow';
		const members = obj === 'conv' ? conversationMembers : flowMembers;

		return Object.values(members).map(member => {
			const item = new vscode.CompletionItem(
				member.name,
				member.kind === 'method'
					? vscode.CompletionItemKind.Method
					: vscode.CompletionItemKind.Property,
			);

			// Detail line shown next to the suggestion (signature or type)
			if (member.signature) {
				item.detail = `${member.name}${member.signature}`;
			} else if (member.returnType) {
				item.detail = `${member.name}: ${member.returnType}`;
			}

			// Documentation shown in the side panel
			const doc = new vscode.MarkdownString();
			if (member.description) {
				doc.appendMarkdown(member.description);
			}
			if (member.parameters && member.parameters.length > 0) {
				doc.appendMarkdown(`\n\n**Parameters:**`);
				for (const p of member.parameters) {
					const typeStr = p.type ? `: ${p.type}` : '';
					const descStr = p.description ? ` — ${p.description}` : '';
					doc.appendMarkdown(`\n- \`${p.name}${typeStr}\`${descStr}`);
				}
			}
			item.documentation = doc;

			// For methods, insert a snippet with parameter placeholders
			if (member.kind === 'method' && member.parameters && member.parameters.length > 0) {
				const placeholders = member.parameters.map((p, i) =>
					`\${${i + 1}:${p.name}}`
				).join(', ');
				item.insertText = new vscode.SnippetString(`${member.name}(${placeholders})`);
			}

			return item;
		});
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

