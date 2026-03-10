import * as path from 'path';
import * as fs from 'fs';
import { PythonFunctionResolver } from '../../pythonFunctionResolver';

export interface PythonDiagnostic {
	line: number;
	startChar: number;
	endChar: number;
	message: string;
	severity: 'error' | 'warning' | 'info';
	code: string;
}

export interface PythonCheckOptions {
	flowStepNames?: string[];
	flowNames?: string[];
}

/**
 * Checks a Python file for Agent Studio rule violations
 * @param text - The file content as a string
 * @param filePath - The absolute path to the file
 * @param options - Optional overrides (e.g. step names for testing)
 */
export function checkPythonFile(text: string, filePath: string, options?: PythonCheckOptions): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	const lines = text.split('\n');
	const fileName = path.basename(filePath, '.py');

	// Only check files in functions/ or function_steps/ directories
	if (!isInFunctionsDirectory(filePath)) {
		if (isFlowFunctionStep(filePath)) {
			diagnostics.push(...checkGotoStepExists(lines, filePath, options?.flowStepNames));
			diagnostics.push(...checkGotoFlowExists(lines, filePath, options?.flowNames));
		}
		return diagnostics;
	}

	// Check for missing imports statement
	diagnostics.push(...checkMissingImportsStar(lines));

	// Check for manual poly_platform imports
	diagnostics.push(...checkManualPolyImports(lines));

	// Check for function name matching filename
	diagnostics.push(...checkFunctionNameMatchesFilename(lines, fileName));

	// Check for decorated helper functions
	diagnostics.push(...checkDecoratedHelperFunctions(lines, fileName));

	// Check for missing decorators on main function
	diagnostics.push(...checkMissingDecorators(lines, fileName));

	// Check for missing @func_parameter decorators
	diagnostics.push(...checkMissingFuncParameters(lines, fileName));

	// Check for silent error swallowing
	diagnostics.push(...checkSilentErrorSwallowing(lines));

	// Check flow function specific rules
	if (isFlowFunction(filePath)) {
		diagnostics.push(...checkFlowFunctionRules(lines, fileName));
		diagnostics.push(...checkGotoStepExists(lines, filePath, options?.flowStepNames));
	}

	// Check for return conv.say() anti-pattern
	diagnostics.push(...checkReturnConvSay(lines));

	// Check for exit_flow before transition anti-pattern
	diagnostics.push(...checkExitFlowBeforeTransition(lines));

	// Check for plog usage (should use conv.log instead)
	diagnostics.push(...checkPlogUsage(lines));

	// Check goto_flow references valid flow names
	diagnostics.push(...checkGotoFlowExists(lines, filePath, options?.flowNames));

	return diagnostics;
}

/**
 * Checks if file is in a functions directory
 */
function isInFunctionsDirectory(filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, '/');
	return normalizedPath.includes('/functions/');
}

/**
 * Checks if file is a flow function (in flows/{flow_name}/functions/)
 */
function isFlowFunction(filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, '/');
	return normalizedPath.includes('/flows/') && normalizedPath.includes('/functions/');
}

/**
 * Checks if file is a flow function step (in flows/{flow_name}/function_steps/)
 */
function isFlowFunctionStep(filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, '/');
	return normalizedPath.includes('/flows/') && normalizedPath.includes('/function_steps/');
}

/**
 * Rule: missing-imports-star
 * Files must contain `from imports import *  # <AUTO GENERATED>`
 */
function checkMissingImportsStar(lines: string[]): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	// Search the entire file for the imports statement
	let foundImportsStar = false;
	let firstCodeLine = -1;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		
		// Skip empty lines and comments
		if (line === '' || line.startsWith('#')) {
			continue;
		}
		
		if (firstCodeLine === -1) {
			firstCodeLine = i;
		}
		
		// Check if this line is the imports statement (either from imports or from _gen)
		if (line.startsWith('from imports import *') || line.startsWith('from imports import*') ||
			line.startsWith('from _gen import *') || line.startsWith('from _gen import*')) {
			foundImportsStar = true;
			break;
		}
		
		// Stop searching once we hit actual code (function/class definitions)
		if (line.startsWith('def ') || line.startsWith('class ') || line.startsWith('@')) {
			break;
		}
	}
	
	if (!foundImportsStar && firstCodeLine !== -1) {
		diagnostics.push({
			line: firstCodeLine,
			startChar: 0,
			endChar: lines[firstCodeLine].length,
			message: 'Missing required import: from _gen import *  # <AUTO GENERATED>',
			severity: 'error',
			code: 'missing-imports-star'
		});
	}
	
	return diagnostics;
}

/**
 * Rule: manual-poly-import
 * Never import from poly_platform directly
 */
function checkManualPolyImports(lines: string[]): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.includes('poly_platform') && (line.trim().startsWith('from ') || line.trim().startsWith('import '))) {
			diagnostics.push({
				line: i,
				startChar: 0,
				endChar: line.length,
				message: 'Do not import from poly_platform directly. Use `from imports import *` instead.',
				severity: 'error',
				code: 'manual-poly-import'
			});
		}
	}
	
	return diagnostics;
}

/**
 * Rule: function-name-mismatch
 * Main function name must match filename
 */
function checkFunctionNameMatchesFilename(lines: string[], fileName: string): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	// Find all function definitions
	const functionPattern = /^def\s+(\w+)\s*\(/;
	let foundMatchingFunction = false;
	let firstFunctionLine = -1;
	let firstFunctionName = '';
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const match = line.match(functionPattern);
		
		if (match) {
			const funcName = match[1];
			
			if (firstFunctionLine === -1) {
				firstFunctionLine = i;
				firstFunctionName = funcName;
			}
			
			if (funcName === fileName) {
				foundMatchingFunction = true;
				break;
			}
		}
	}
	
	if (!foundMatchingFunction && firstFunctionLine !== -1) {
		diagnostics.push({
			line: firstFunctionLine,
			startChar: 0,
			endChar: lines[firstFunctionLine].length,
			message: `File "${fileName}.py" must contain a function named "${fileName}". Found "${firstFunctionName}" instead.`,
			severity: 'error',
			code: 'function-name-mismatch'
		});
	} else if (!foundMatchingFunction && firstFunctionLine === -1) {
		// No functions found at all
		diagnostics.push({
			line: 0,
			startChar: 0,
			endChar: lines[0]?.length || 0,
			message: `File "${fileName}.py" must contain a function named "${fileName}".`,
			severity: 'error',
			code: 'function-name-mismatch'
		});
	}
	
	return diagnostics;
}

/**
 * Finds all function definition lines in a file
 * @param lines - All lines of the file
 * @returns Array of {name, line} for each function found
 */
function findAllFunctionLines(lines: string[]): Array<{name: string, line: number}> {
	const functions: Array<{name: string, line: number}> = [];
	const funcPattern = /^def\s+(\w+)\s*\(/;
	
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].trim().match(funcPattern);
		if (match) {
			functions.push({ name: match[1], line: i });
		}
	}
	
	return functions;
}

/**
 * Finds the first line of a decorator block (the line where the first decorator starts)
 * @param lines - All lines of the file
 * @param funcLineIndex - The line index where the function definition starts
 * @returns The line index of the first decorator, or -1 if no decorators
 */
function getDecoratorBlockStartLine(lines: string[], funcLineIndex: number): number {
	let firstDecoratorLine = -1;
	let parenDepth = 0;
	
	// Walk backwards from the line before the function
	for (let i = funcLineIndex - 1; i >= 0; i--) {
		const line = lines[i];
		const trimmed = line.trim();
		
		// Count parens to track if we're inside a multiline decorator
		for (const char of trimmed) {
			if (char === ')') parenDepth++;
			else if (char === '(') parenDepth--;
		}
		
		// If we're inside parentheses (from a multiline decorator), continue
		if (parenDepth > 0) {
			continue;
		}
		
		// Found a decorator line
		if (trimmed.startsWith('@')) {
			firstDecoratorLine = i;
			parenDepth = 0;
			continue;
		}
		
		// Skip empty lines and comments between decorators
		if (trimmed === '' || trimmed.startsWith('#')) {
			continue;
		}
		
		// Hit actual code - stop
		break;
	}
	
	return firstDecoratorLine;
}

/**
 * Rule: decorated-helper-function
 * Only the main function (matching filename) should have decorators
 */
function checkDecoratedHelperFunctions(lines: string[], fileName: string): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	// Find all functions in the file
	const functions = findAllFunctionLines(lines);
	
	// Check each non-main function for decorators
	for (const func of functions) {
		if (func.name === fileName) {
			continue; // Skip main function - it's allowed to have decorators
		}
		
		// Get the decorator block for this function
		const decoratorBlock = getDecoratorBlock(lines, func.line);
		
		// Check if this helper function has func_description or func_parameter decorators
		if (/@func_description\s*\(/s.test(decoratorBlock) || /@func_parameter\s*\(/s.test(decoratorBlock)) {
			const decoratorStartLine = getDecoratorBlockStartLine(lines, func.line);
			diagnostics.push({
				line: decoratorStartLine !== -1 ? decoratorStartLine : func.line,
				startChar: 0,
				endChar: lines[decoratorStartLine !== -1 ? decoratorStartLine : func.line].length,
				message: `Only the main function "${fileName}" should have decorators. Decorating helper functions will crash imports.`,
				severity: 'error',
				code: 'decorated-helper-function'
			});
		}
	}
	
	return diagnostics;
}

/**
 * Extracts the decorator block immediately preceding a function definition.
 * Walks backwards from the function line, collecting decorator lines (including multiline decorators).
 * Stops when it hits non-decorator code (another function, class, or regular code).
 * 
 * @param lines - All lines of the file
 * @param funcLineIndex - The line index where the function definition starts
 * @returns The decorator block as a single string
 */
function getDecoratorBlock(lines: string[], funcLineIndex: number): string {
	const decoratorLines: string[] = [];
	let parenDepth = 0;
	
	// Walk backwards from the line before the function
	for (let i = funcLineIndex - 1; i >= 0; i--) {
		const line = lines[i];
		const trimmed = line.trim();
		
		// Count parens to track if we're inside a multiline decorator
		// We're walking backwards, so closing parens increase depth, opening parens decrease
		for (const char of trimmed) {
			if (char === ')') parenDepth++;
			else if (char === '(') parenDepth--;
		}
		
		// If we're inside parentheses (from a multiline decorator), include this line
		if (parenDepth > 0) {
			decoratorLines.unshift(line);
			continue;
		}
		
		// Include decorator lines
		if (trimmed.startsWith('@')) {
			decoratorLines.unshift(line);
			// Reset paren depth for the next decorator
			parenDepth = 0;
			continue;
		}
		
		// Include empty lines and comments between decorators
		if (trimmed === '' || trimmed.startsWith('#')) {
			decoratorLines.unshift(line);
			continue;
		}
		
		// Hit actual code - stop
		break;
	}
	
	return decoratorLines.join('\n');
}

/**
 * Finds the line number where a specific function is defined
 * @param lines - All lines of the file  
 * @param funcName - The function name to find
 * @returns The line index, or -1 if not found
 */
function findFunctionLine(lines: string[], funcName: string): number {
	const funcPattern = new RegExp(`^def\\s+${funcName}\\s*\\(`);
	for (let i = 0; i < lines.length; i++) {
		if (funcPattern.test(lines[i].trim())) {
			return i;
		}
	}
	return -1;
}

/**
 * Rule: missing-func-description
 * Main function must have @func_description decorator
 */
function checkMissingDecorators(lines: string[], fileName: string): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	// Skip special lifecycle functions that don't require decorators
	const lifecycleFunctions = ['start_function', 'end_function'];
	if (lifecycleFunctions.includes(fileName)) {
		return diagnostics;
	}
	
	// Find the main function line
	const funcLine = findFunctionLine(lines, fileName);
	if (funcLine === -1) {
		return diagnostics; // No main function found
	}
	
	// Get the decorator block for this function
	const decoratorBlock = getDecoratorBlock(lines, funcLine);
	
	// Check if @func_description appears in the decorator block
	const hasDescription = /@func_description\s*\(/s.test(decoratorBlock);
	
	if (!hasDescription) {
		diagnostics.push({
			line: funcLine,
			startChar: 0,
			endChar: lines[funcLine]?.length || 0,
			message: `Main function "${fileName}" is missing @func_description decorator.`,
			severity: 'error',
			code: 'missing-func-description'
		});
	}
	
	return diagnostics;
}

/**
 * Rule: missing-func-parameter
 * All parameters (except conv and flow) need @func_parameter
 */
function checkMissingFuncParameters(lines: string[], fileName: string): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	// Skip special lifecycle functions that don't require decorators
	const lifecycleFunctions = ['start_function', 'end_function'];
	if (lifecycleFunctions.includes(fileName)) {
		return diagnostics;
	}
	
	// Find the main function line
	const funcLine = findFunctionLine(lines, fileName);
	if (funcLine === -1) {
		return diagnostics; // No main function found
	}
	
	// Join all lines to handle multi-line function signatures
	const fullText = lines.join('\n');
	
	// Find the main function and its parameters
	const mainFuncPattern = new RegExp(`def\\s+${fileName}\\s*\\(([^)]+)\\)`, 's');
	const mainFuncMatch = fullText.match(mainFuncPattern);
	
	if (!mainFuncMatch) {
		return diagnostics; // No main function found (shouldn't happen since we found funcLine)
	}
	
	// Parse the function parameters
	const paramsStr = mainFuncMatch[1];
	const params = paramsStr.split(',').map(p => {
		// Extract parameter name (before : or =), handling multiline
		const paramName = p.trim().split(':')[0].split('=')[0].trim();
		return paramName;
	}).filter(p => p && p !== 'conv' && p !== 'flow' && p !== 'self');
	
	// Get the decorator block for this function
	const decoratorBlock = getDecoratorBlock(lines, funcLine);
	
	// Find all @func_parameter decorators in the decorator block
	// Pattern matches @func_parameter( followed by quoted string (the param name)
	const paramDecoratorPattern = /@func_parameter\s*\(\s*["'](\w+)["']/gs;
	const decoratedParams: string[] = [];
	
	let match;
	while ((match = paramDecoratorPattern.exec(decoratorBlock)) !== null) {
		decoratedParams.push(match[1]);
	}
	
	// Check for missing @func_parameter decorators
	for (const param of params) {
		if (!decoratedParams.includes(param)) {
			diagnostics.push({
				line: funcLine,
				startChar: 0,
				endChar: lines[funcLine]?.length || 0,
				message: `Parameter "${param}" is missing @func_parameter decorator.`,
				severity: 'warning',
				code: 'missing-func-parameter'
			});
		}
	}
	
	return diagnostics;
}

/**
 * Rule: silent-error-swallowing
 * try/except with pass or just print is forbidden
 */
function checkSilentErrorSwallowing(lines: string[]): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	let inExceptBlock = false;
	let exceptLine = -1;
	let exceptIndent = 0;
	let hasOnlyPassOrPrint = true;
	let hasMeaningfulCode = false;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmedLine = line.trim();
		const currentIndent = line.length - line.trimStart().length;
		
		// Detect except block start
		if (trimmedLine.startsWith('except') && trimmedLine.includes(':')) {
			inExceptBlock = true;
			exceptLine = i;
			exceptIndent = currentIndent;
			hasOnlyPassOrPrint = true;
			hasMeaningfulCode = false;
			continue;
		}
		
		if (inExceptBlock) {
			// Check if we've exited the except block (same or less indentation)
			if (trimmedLine !== '' && currentIndent <= exceptIndent && !trimmedLine.startsWith('#')) {
				// End of except block
				if (hasOnlyPassOrPrint && !hasMeaningfulCode) {
					diagnostics.push({
						line: exceptLine,
						startChar: 0,
						endChar: lines[exceptLine].length,
						message: 'Silent error swallowing detected. Exceptions should be logged and handled properly (e.g., handoff to CSR).',
						severity: 'info',
						code: 'silent-error-swallowing'
					});
				}
				inExceptBlock = false;
				
				// Check if this line starts a new except
				if (trimmedLine.startsWith('except') && trimmedLine.includes(':')) {
					inExceptBlock = true;
					exceptLine = i;
					exceptIndent = currentIndent;
					hasOnlyPassOrPrint = true;
					hasMeaningfulCode = false;
				}
				continue;
			}
			
			// Inside except block - check content
			if (trimmedLine === 'pass') {
				// pass is ok for now, will trigger warning if nothing else
			} else if (trimmedLine.startsWith('print(') || trimmedLine.startsWith('print ')) {
				// print alone is not proper error handling
			} else if (trimmedLine !== '' && !trimmedLine.startsWith('#')) {
				// Some other code - might be meaningful
				if (trimmedLine.includes('conv.log.') || 
				    trimmedLine.includes('write_metric') || 
				    trimmedLine.includes('handoff') ||
				    trimmedLine.includes('return')) {
					hasMeaningfulCode = true;
				}
				hasOnlyPassOrPrint = false;
			}
		}
	}
	
	// Check final except block
	if (inExceptBlock && hasOnlyPassOrPrint && !hasMeaningfulCode) {
		diagnostics.push({
			line: exceptLine,
			startChar: 0,
			endChar: lines[exceptLine].length,
			message: 'Silent error swallowing detected. Exceptions should be logged and handled properly (e.g., handoff to CSR).',
			severity: 'info',
			code: 'silent-error-swallowing'
		});
	}
	
	return diagnostics;
}

/**
 * Rule: flow-function-missing-flow-param
 * Flow functions must have flow: Flow parameter
 */
function checkFlowFunctionRules(lines: string[], fileName: string): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	// Find main function
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		
		if (line.startsWith('def ')) {
			const funcMatch = line.match(/^def\s+(\w+)\s*\(([^)]*)\)/);
			if (funcMatch && funcMatch[1] === fileName) {
				const paramsStr = funcMatch[2];
				
				// Check for flow: Flow parameter
				if (!paramsStr.includes('flow:') && !paramsStr.includes('flow :')) {
					diagnostics.push({
						line: i,
						startChar: 0,
						endChar: lines[i].length,
						message: 'Flow functions must include "flow: Flow" parameter.',
						severity: 'error',
						code: 'flow-function-missing-flow-param'
					});
				}
				
				// Check for conv: Conversation parameter
				if (!paramsStr.includes('conv:') && !paramsStr.includes('conv :')) {
					diagnostics.push({
						line: i,
						startChar: 0,
						endChar: lines[i].length,
						message: 'Flow functions must include "conv: Conversation" parameter.',
						severity: 'error',
						code: 'flow-function-missing-conv-param'
					});
				}
				
				break;
			}
		}
	}
	
	return diagnostics;
}

/**
 * Rule: return-conv-say
 * Don't return conv.say() - call it then return separately
 */
function checkReturnConvSay(lines: string[]): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		if (line.includes('return conv.say(') || line.includes('return  conv.say(')) {
			diagnostics.push({
				line: i,
				startChar: line.indexOf('return'),
				endChar: line.length,
				message: "Don't return conv.say() result. Call conv.say() for its side effect, then return separately.",
				severity: 'error',
				code: 'return-conv-say'
			});
		}
	}
	
	return diagnostics;
}

/**
 * Rule: exit-flow-before-transition
 * Don't combine conv.exit_flow() with transition/goto_flow
 */
function checkExitFlowBeforeTransition(lines: string[]): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	// Track if we see exit_flow followed by transition in the same function
	let inFunction = false;
	let functionIndent = 0;
	let exitFlowLine = -1;
	let hasTransitionAfterExit = false;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmedLine = line.trim();
		const currentIndent = line.length - line.trimStart().length;
		
		// Track function boundaries
		if (trimmedLine.startsWith('def ')) {
			// New function - reset tracking
			if (exitFlowLine !== -1 && hasTransitionAfterExit) {
				diagnostics.push({
					line: exitFlowLine,
					startChar: 0,
					endChar: lines[exitFlowLine].length,
					message: "Don't combine conv.exit_flow() with transition or goto_flow. The transition handles flow routing.",
					severity: 'warning',
					code: 'exit-flow-before-transition'
				});
			}
			
			inFunction = true;
			functionIndent = currentIndent;
			exitFlowLine = -1;
			hasTransitionAfterExit = false;
			continue;
		}
		
		if (!inFunction) {
			continue;
		}
		
		// Check for exit_flow
		if (trimmedLine.includes('conv.exit_flow(')) {
			exitFlowLine = i;
			hasTransitionAfterExit = false;
		}
		
		// Check for transition after exit_flow
		if (exitFlowLine !== -1) {
			if (trimmedLine.includes('return transition(') ||
			    trimmedLine.includes('conv.goto_flow(') ||
			    (trimmedLine.includes('"transition"') || trimmedLine.includes("'transition'"))) {
				hasTransitionAfterExit = true;
			}
		}
	}
	
	// Check final function
	if (exitFlowLine !== -1 && hasTransitionAfterExit) {
		diagnostics.push({
			line: exitFlowLine,
			startChar: 0,
			endChar: lines[exitFlowLine].length,
			message: "Don't combine conv.exit_flow() with transition or goto_flow. The transition handles flow routing.",
			severity: 'warning',
			code: 'exit-flow-before-transition'
		});
	}
	
	return diagnostics;
}

/**
 * Rule: plog-usage
 * Detect plog imports and usage, recommend conv.log instead
 */
function checkPlogUsage(lines: string[]): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmedLine = line.trim();
		
		// Check for plog import
		if (trimmedLine.startsWith('import plog') || trimmedLine.includes('from plog import') || trimmedLine.includes('import plog')) {
			diagnostics.push({
				line: i,
				startChar: 0,
				endChar: line.length,
				message: 'Use conv.log instead of plog for logging. Example: conv.log.info("message", is_pii=False)',
				severity: 'warning',
				code: 'plog-usage'
			});
		}
		
		// Check for plog function calls
		const plogPatterns = [
			/plog\.info\s*\(/,
			/plog\.warn\s*\(/,
			/plog\.warning\s*\(/,
			/plog\.error\s*\(/,
			/plog\.exception\s*\(/,
		];
		
		for (const pattern of plogPatterns) {
			if (pattern.test(line)) {
				const match = line.match(pattern);
				if (match) {
					const startChar = line.indexOf(match[0]);
					diagnostics.push({
						line: i,
						startChar: startChar,
						endChar: startChar + match[0].length,
						message: 'Use conv.log instead of plog. Example: conv.log.info("message", is_pii=False)',
						severity: 'warning',
						code: 'plog-usage'
					});
				}
				break; // Only one warning per line
			}
		}
	}
	
	return diagnostics;
}

/**
 * Derives the flow directory from a file inside functions/ or function_steps/.
 */
function getFlowDirFromFile(filePath: string): string | null {
	const normalizedPath = filePath.replace(/\\/g, '/');
	let idx = normalizedPath.lastIndexOf('/functions/');
	if (idx === -1) {
		idx = normalizedPath.lastIndexOf('/function_steps/');
	}
	if (idx === -1) {
		return null;
	}
	return normalizedPath.substring(0, idx);
}

/**
 * Collects all valid goto_step / child_step targets from a flow directory:
 * - Step names from steps/*.yaml (the `name:` field)
 * - Function step filenames from function_steps/*.py (without extension)
 */
export function getFlowStepTargetsFromDisk(flowDir: string): string[] | null {
	const targets: string[] = [];

	const stepsDir = path.join(flowDir, 'steps');
	if (fs.existsSync(stepsDir)) {
		for (const file of fs.readdirSync(stepsDir)) {
			if (!file.endsWith('.yaml') && !file.endsWith('.yml')) {
				continue;
			}
			const content = fs.readFileSync(path.join(stepsDir, file), 'utf-8');
			const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/m);
			if (nameMatch) {
				targets.push(nameMatch[1]);
			}
		}
	}

	const functionStepsDir = path.join(flowDir, 'function_steps');
	if (fs.existsSync(functionStepsDir)) {
		for (const file of fs.readdirSync(functionStepsDir)) {
			if (file.endsWith('.py')) {
				targets.push(file.replace(/\.py$/, ''));
			}
		}
	}

	return targets.length > 0 ? targets : null;
}

/**
 * Reads all valid goto_step targets for a Python file in a flow.
 */
function getFlowStepNamesFromDisk(filePath: string): string[] | null {
	const flowDir = getFlowDirFromFile(filePath);
	if (!flowDir) {
		return null;
	}
	return getFlowStepTargetsFromDisk(flowDir);
}

/**
 * Returns the index of the first comment on the line (first #), or line.length if none.
 * Used to only validate code that is not commented out.
 */
function getCommentStartIndex(line: string): number {
	const idx = line.indexOf('#');
	return idx >= 0 ? idx : line.length;
}

/**
 * Rule: invalid-goto-step
 * flow.goto_step() must reference a step name that exists in the flow's steps/ directory.
 * Only validates uncommented lines (full-line comments and content after # are ignored).
 */
function checkGotoStepExists(lines: string[], filePath: string, overrideStepNames?: string[]): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];

	const stepNames = overrideStepNames ?? getFlowStepNamesFromDisk(filePath);
	if (!stepNames) {
		return diagnostics;
	}

	const gotoPattern = /flow\.goto_step\(\s*["']([^"']+)["']/g;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// Skip full-line comments
		if (line.trim().startsWith('#')) {
			continue;
		}
		const commentStart = getCommentStartIndex(line);
		let match;
		gotoPattern.lastIndex = 0;
		while ((match = gotoPattern.exec(line)) !== null) {
			// Only validate matches that appear before the first #
			if (match.index >= commentStart) {
				continue;
			}
			const targetStep = match[1];
			if (!stepNames.includes(targetStep)) {
				const startChar = match.index;
				const endChar = match.index + match[0].length;
				diagnostics.push({
					line: i,
					startChar,
					endChar,
					message: `Step "${targetStep}" does not exist in this flow. Available steps: ${stepNames.join(', ')}`,
					severity: 'error',
					code: 'invalid-goto-step'
				});
			}
		}
	}

	return diagnostics;
}

/**
 * Finds the project root (the directory containing the flows/ directory)
 * by walking up from a Python file path.
 */
function getProjectRoot(filePath: string): string | null {
	const normalizedPath = filePath.replace(/\\/g, '/');

	// If inside flows/, project root is the parent of flows/
	const flowsIdx = normalizedPath.indexOf('/flows/');
	if (flowsIdx !== -1) {
		return normalizedPath.substring(0, flowsIdx);
	}

	// If inside project-level functions/, project root is the parent of functions/
	const functionsIdx = normalizedPath.lastIndexOf('/functions/');
	if (functionsIdx !== -1) {
		const candidate = normalizedPath.substring(0, functionsIdx);
		const flowsDir = path.join(candidate, 'flows');
		if (fs.existsSync(flowsDir)) {
			return candidate;
		}
	}

	return null;
}

/**
 * Reads flow names from all flow_config.yaml files under flows/ in the project.
 */
function getFlowNamesFromDisk(filePath: string): string[] | null {
	const projectRoot = getProjectRoot(filePath);
	if (!projectRoot) {
		return null;
	}

	const flowsDir = path.join(projectRoot, 'flows');
	if (!fs.existsSync(flowsDir)) {
		return null;
	}

	const flowNames: string[] = [];
	for (const dir of fs.readdirSync(flowsDir)) {
		const configPath = path.join(flowsDir, dir, 'flow_config.yaml');
		if (!fs.existsSync(configPath)) {
			continue;
		}
		try {
			const content = fs.readFileSync(configPath, 'utf-8');
			const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/m);
			if (nameMatch) {
				flowNames.push(nameMatch[1]);
			}
		} catch {
			// Skip files that can't be read
		}
	}

	return flowNames.length > 0 ? flowNames : null;
}

/**
 * Rule: invalid-goto-flow
 * conv.goto_flow() must reference a flow name defined in a flow_config.yaml.
 * Only validates uncommented lines (full-line comments and content after # are ignored).
 */
function checkGotoFlowExists(lines: string[], filePath: string, overrideFlowNames?: string[]): PythonDiagnostic[] {
	const diagnostics: PythonDiagnostic[] = [];

	const flowNames = overrideFlowNames ?? getFlowNamesFromDisk(filePath);
	if (!flowNames) {
		return diagnostics;
	}

	const gotoFlowPattern = /conv\.goto_flow\(\s*["']([^"']+)["']/g;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// Skip full-line comments
		if (line.trim().startsWith('#')) {
			continue;
		}
		const commentStart = getCommentStartIndex(line);
		let match;
		gotoFlowPattern.lastIndex = 0;
		while ((match = gotoFlowPattern.exec(line)) !== null) {
			// Only validate matches that appear before the first #
			if (match.index >= commentStart) {
				continue;
			}
			const targetFlow = match[1];
			if (!flowNames.includes(targetFlow)) {
				const startChar = match.index;
				const endChar = match.index + match[0].length;
				diagnostics.push({
					line: i,
					startChar,
					endChar,
					message: `Flow "${targetFlow}" does not exist in this project. Available flows: ${flowNames.join(', ')}`,
					severity: 'error',
					code: 'invalid-goto-flow'
				});
			}
		}
	}

	return diagnostics;
}

