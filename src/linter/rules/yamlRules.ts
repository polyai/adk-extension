import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore - js-yaml types may not be available
import * as yaml from 'js-yaml';

export interface YamlDiagnostic {
	line: number;
	startChar: number;
	endChar: number;
	message: string;
	severity: 'error' | 'warning' | 'info';
	code: string;
}

export interface YamlCheckOptions {
	childStepTargets?: string[];
}

/**
 * Checks a YAML file for Agent Studio rule violations
 * @param text - The file content as a string
 * @param filePath - The absolute path to the file
 * @param options - Optional overrides (e.g. valid child_step targets for testing)
 */
export function checkYamlFile(text: string, filePath: string, options?: YamlCheckOptions): YamlDiagnostic[] {
	const diagnostics: YamlDiagnostic[] = [];
	const fileName = path.basename(filePath);
	const lines = text.split('\n');

	// Determine file type and apply appropriate rules
	if (fileName === 'flow_config.yaml') {
		diagnostics.push(...checkFlowConfig(lines, text, filePath));
	} else if (isStepFile(filePath)) {
		diagnostics.push(...checkStepFile(lines, text, filePath, options));
	} else if (isTopicFile(filePath)) {
		diagnostics.push(...checkTopicFile(lines, text));
	}

	return diagnostics;
}

/**
 * Checks if file is a step file (in flows/{flow_name}/steps/)
 */
function isStepFile(filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, '/');
	return normalizedPath.includes('/flows/') && normalizedPath.includes('/steps/');
}

/**
 * Checks if file is a topic file (in topics/)
 */
function isTopicFile(filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, '/');
	return normalizedPath.includes('/topics/');
}

/**
 * Rule: flow-config-missing-description
 * Flow config must have non-empty description
 */
function checkFlowConfig(lines: string[], text: string, filePath: string): YamlDiagnostic[] {
	const diagnostics: YamlDiagnostic[] = [];
	
	try {
		const config = yaml.load(text) as Record<string, any>;
		
		// Check for required fields
		if (!config) {
			diagnostics.push({
				line: 0,
				startChar: 0,
				endChar: lines[0]?.length || 0,
				message: 'flow_config.yaml appears to be empty.',
				severity: 'error',
				code: 'empty-flow-config'
			});
			return diagnostics;
		}
		
		// Check name field
		if (!config.name) {
			diagnostics.push({
				line: 0,
				startChar: 0,
				endChar: lines[0]?.length || 0,
				message: 'flow_config.yaml is missing required "name" field.',
				severity: 'error',
				code: 'flow-config-missing-name'
			});
		}
		
		// Check description field
		if (!config.description || config.description.trim() === '') {
			const descLine = findYamlKeyLine(lines, 'description');
			diagnostics.push({
				line: descLine !== -1 ? descLine : 0,
				startChar: 0,
				endChar: lines[descLine !== -1 ? descLine : 0]?.length || 0,
				message: 'flow_config.yaml requires a non-empty "description" field.',
				severity: 'error',
				code: 'flow-config-missing-description'
			});
		}
		
		// Check start_step field
		if (!config.start_step) {
			diagnostics.push({
				line: 0,
				startChar: 0,
				endChar: lines[0]?.length || 0,
				message: 'flow_config.yaml is missing required "start_step" field.',
				severity: 'error',
				code: 'flow-config-missing-start-step'
			});
		} else {
			// Validate that start_step references an existing step
			const flowDir = path.dirname(filePath);
			const stepsDir = path.join(flowDir, 'steps');
			
			if (fs.existsSync(stepsDir)) {
				const stepFiles = fs.readdirSync(stepsDir)
					.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
				
				// Read step names from files
				const stepNames: string[] = [];
				for (const stepFile of stepFiles) {
					try {
						const stepContent = fs.readFileSync(path.join(stepsDir, stepFile), 'utf8');
						const stepConfig = yaml.load(stepContent) as Record<string, any>;
						if (stepConfig && stepConfig.name) {
							stepNames.push(stepConfig.name);
						}
					} catch {
						// Skip files that can't be parsed
					}
				}
				
				if (stepNames.length > 0 && !stepNames.includes(config.start_step)) {
					const startStepLine = findYamlKeyLine(lines, 'start_step');
					diagnostics.push({
						line: startStepLine !== -1 ? startStepLine : 0,
						startChar: 0,
						endChar: lines[startStepLine !== -1 ? startStepLine : 0]?.length || 0,
						message: `start_step "${config.start_step}" does not match any step in the steps/ directory. Available steps: ${stepNames.join(', ')}`,
						severity: 'error',
						code: 'invalid-start-step'
					});
				}
			}
		}
		
	} catch (e) {
		// YAML parsing error - let the YAML language server handle it
	}
	
	return diagnostics;
}

/**
 * Checks step files for Agent Studio rule violations
 */
function checkStepFile(lines: string[], text: string, filePath: string, options?: YamlCheckOptions): YamlDiagnostic[] {
	const diagnostics: YamlDiagnostic[] = [];
	
	try {
		const step = yaml.load(text) as Record<string, any>;
		
		if (!step) {
			return diagnostics;
		}
		
		// Check for name field
		if (!step.name) {
			diagnostics.push({
				line: 0,
				startChar: 0,
				endChar: lines[0]?.length || 0,
				message: 'Step file is missing required "name" field.',
				severity: 'error',
				code: 'step-missing-name'
			});
		}
		
		// Check prompt field for issues
		if (step.prompt) {
			const promptLine = findYamlKeyLine(lines, 'prompt');
			const promptContent = typeof step.prompt === 'string' ? step.prompt : '';
			
			// Check for conv.state in prompt (should use $variable)
			diagnostics.push(...checkConvStateInPrompt(lines, promptLine, promptContent));
		}

		// Check child_step references in conditions
		if (step.conditions && Array.isArray(step.conditions)) {
			diagnostics.push(...checkChildStepExists(lines, step.conditions, filePath, options?.childStepTargets));
		}
		
	} catch (e) {
		// YAML parsing error
	}
	
	return diagnostics;
}

/**
 * Checks topic files for Agent Studio rule violations
 */
function checkTopicFile(lines: string[], text: string): YamlDiagnostic[] {
	const diagnostics: YamlDiagnostic[] = [];
	
	try {
		const topic = yaml.load(text) as Record<string, any>;
		
		if (!topic) {
			return diagnostics;
		}
		
		// Check example_queries count (should be <= 10)
		if (topic.example_queries && Array.isArray(topic.example_queries)) {
			if (topic.example_queries.length > 10) {
				const exampleLine = findYamlKeyLine(lines, 'example_queries');
				diagnostics.push({
					line: exampleLine !== -1 ? exampleLine : 0,
					startChar: 0,
					endChar: lines[exampleLine !== -1 ? exampleLine : 0]?.length || 0,
					message: `Topics should have at most 10 example_queries. Found ${topic.example_queries.length}. Use diverse phrasings rather than tiny variations.`,
					severity: 'info',
					code: 'too-many-example-queries'
				});
			}
		}
		
		// Check for functions/variables in content field (should only be in actions)
		if (topic.content && typeof topic.content === 'string') {
			const contentLine = findYamlKeyLine(lines, 'content');
			
			// Check for {{fn:...}} in content
			if (topic.content.includes('{{fn:') || topic.content.includes('{{ft:')) {
				diagnostics.push({
					line: contentLine !== -1 ? contentLine : 0,
					startChar: 0,
					endChar: lines[contentLine !== -1 ? contentLine : 0]?.length || 0,
					message: 'Function references ({{fn:...}} or {{ft:...}}) should only be in the "actions" field, not "content".',
					severity: 'warning',
					code: 'functions-outside-actions'
				});
			}
			
			// Check for $variable in content (except for {{attr:}})
			const dollarVarPattern = /\$\w+/g;
			if (dollarVarPattern.test(topic.content) && !topic.content.includes('{{attr:')) {
				diagnostics.push({
					line: contentLine !== -1 ? contentLine : 0,
					startChar: 0,
					endChar: lines[contentLine !== -1 ? contentLine : 0]?.length || 0,
					message: 'State variables ($variable) should only be in the "actions" field, not "content".',
					severity: 'warning',
					code: 'variables-outside-actions'
				});
			}
		}
		
		// Check for output-oriented prompts in actions
		if (topic.actions && typeof topic.actions === 'string') {
			diagnostics.push(...checkOutputOrientedPrompts(lines, topic.actions));
		}
		
	} catch (e) {
		// YAML parsing error
	}
	
	return diagnostics;
}

/**
 * Rule: conv-state-in-prompt
 * Use $variable in prompts, not conv.state.variable
 */
function checkConvStateInPrompt(lines: string[], promptStartLine: number, promptContent: string): YamlDiagnostic[] {
	const diagnostics: YamlDiagnostic[] = [];
	
	if (promptContent.includes('conv.state.')) {
		// Find the exact line within the prompt
		const promptLines = promptContent.split('\n');
		for (let i = 0; i < promptLines.length; i++) {
			if (promptLines[i].includes('conv.state.')) {
				const actualLine = promptStartLine + i + 1; // +1 for the prompt: line itself
				if (actualLine < lines.length) {
					diagnostics.push({
						line: actualLine,
						startChar: 0,
						endChar: lines[actualLine]?.length || 0,
						message: 'Use $variable notation in prompts, not conv.state.variable. Example: $user_name instead of conv.state.user_name',
						severity: 'error',
						code: 'conv-state-in-prompt'
					});
				}
				break; // One warning is enough
			}
		}
	}
	
	return diagnostics;
}

/**
 * Rule: output-oriented-prompt
 * Avoid "Say: '...'" patterns - use instructional prompts
 */
function checkOutputOrientedPrompts(lines: string[], actionsContent: string): YamlDiagnostic[] {
	const diagnostics: YamlDiagnostic[] = [];
	
	// Patterns that indicate output-oriented prompts
	const outputPatterns = [
		/Say:\s*["']/i,           // Say: "..." or Say: '...'
		/Say\s+["']/i,            // Say "..." or Say '...'
		/respond with\s*["']/i,   // respond with "..."
		/reply\s*["']/i,          // reply "..."
	];
	
	const actionsLine = findYamlKeyLine(lines, 'actions');
	
	for (const pattern of outputPatterns) {
		if (pattern.test(actionsContent)) {
			diagnostics.push({
				line: actionsLine !== -1 ? actionsLine : 0,
				startChar: 0,
				endChar: lines[actionsLine !== -1 ? actionsLine : 0]?.length || 0,
				message: 'Avoid output-oriented prompts like "Say: \'...\'". Use instructional prompts instead: "Tell the user that..." This helps with multilingual support.',
				severity: 'warning',
				code: 'output-oriented-prompt'
			});
			break;
		}
	}
	
	return diagnostics;
}

/**
 * Gets valid child_step targets from disk for a step YAML file.
 * Valid targets are step names (from sibling YAML files) and function step filenames.
 */
function getChildStepTargetsFromDisk(filePath: string): string[] | null {
	const normalizedPath = filePath.replace(/\\/g, '/');
	const stepsIdx = normalizedPath.lastIndexOf('/steps/');
	if (stepsIdx === -1) {
		return null;
	}

	const flowDir = normalizedPath.substring(0, stepsIdx);

	// Re-use the shared helper from pythonRules if available, or inline the logic
	const targets: string[] = [];

	const stepsDir = path.join(flowDir, 'steps');
	if (fs.existsSync(stepsDir)) {
		for (const file of fs.readdirSync(stepsDir)) {
			if (!file.endsWith('.yaml') && !file.endsWith('.yml')) {
				continue;
			}
			try {
				const content = fs.readFileSync(path.join(stepsDir, file), 'utf-8');
				const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/m);
				if (nameMatch) {
					targets.push(nameMatch[1]);
				}
			} catch {
				// Skip files that can't be read
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
 * Rule: invalid-child-step
 * child_step in conditions must reference a valid step name or function step filename
 */
function checkChildStepExists(
	lines: string[],
	conditions: Array<Record<string, any>>,
	filePath: string,
	overrideTargets?: string[]
): YamlDiagnostic[] {
	const diagnostics: YamlDiagnostic[] = [];

	const targets = overrideTargets ?? getChildStepTargetsFromDisk(filePath);
	if (!targets) {
		return diagnostics;
	}

	for (const condition of conditions) {
		const childStep = condition.child_step;
		if (typeof childStep !== 'string' || childStep === '') {
			continue;
		}

		if (!targets.includes(childStep)) {
			const lineIdx = findChildStepLine(lines, childStep);
			diagnostics.push({
				line: lineIdx !== -1 ? lineIdx : 0,
				startChar: 0,
				endChar: lines[lineIdx !== -1 ? lineIdx : 0]?.length || 0,
				message: `child_step "${childStep}" does not exist in this flow. Available targets: ${targets.join(', ')}`,
				severity: 'error',
				code: 'invalid-child-step'
			});
		}
	}

	return diagnostics;
}

/**
 * Finds the line number of a specific child_step value in the YAML text
 */
function findChildStepLine(lines: string[], value: string): number {
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (trimmed.startsWith('child_step:') && trimmed.includes(value)) {
			return i;
		}
	}
	return -1;
}

/**
 * Helper to find the line number of a YAML key
 */
function findYamlKeyLine(lines: string[], key: string): number {
	const keyPattern = new RegExp(`^${key}\\s*:`);
	for (let i = 0; i < lines.length; i++) {
		if (keyPattern.test(lines[i].trim())) {
			return i;
		}
	}
	return -1;
}

