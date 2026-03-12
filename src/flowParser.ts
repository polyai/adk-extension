import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore - js-yaml types may not be available
import * as yaml from 'js-yaml';

export interface FlowConfig {
	name: string;
	description: string;
	start_step: string;
}

export interface StepCondition {
	name: string;
	description: string;
	condition_type: 'exit_flow_condition' | 'step_condition';
	child_step?: string; // Required for step_condition
	required_entities?: string[];
}

export interface Step {
	name: string;
	step_type: 'advanced_step' | 'default_step';
	prompt: string;
	asr_biasing?: any;
	dtmf_config?: any;
	// No Code Step (default_step) specific fields
	conditions?: StepCondition[];
	extracted_entities?: string[];
}

export interface FlowNode {
	id: string;
	label: string;
	type: 'step' | 'no-code-step' | 'function' | 'function-step' | 'end' | 'exit';
	step?: Step;
	details?: string;
	stepFilePath?: string; // Path to the YAML file for this step, or Python file for function-step
}

export interface FlowEdge {
	from: string;
	to: string;
	label: string;
	condition?: string;
	/** When this edge represents a function transition, path to the function's Python file. */
	functionFilePath?: string;
	/** Edge type - 'condition' for condition-based transitions */
	type?: 'condition' | 'default';
}

export interface FunctionReference {
	name: string;
	description: string;
	gotoStep?: string;
	type: 'flow-function' | 'global-function';
	filePath: string;
}

export type EntityType = 'numeric' | 'alphanumeric' | 'enum' | 'date' | 'phone_number' | 'time' | 'address' | 'free_text' | 'name';

export interface Entity {
	name: string;
	description?: string;
	entity_type: EntityType;
	config: {
		// numeric
		has_decimal?: boolean;
		has_range?: boolean;
		min?: number;
		max?: number;
		// alphanumeric
		enabled?: boolean;
		validation_type?: string;
		regular_expression?: string;
		// enum
		options?: string[];
		// date
		relative_date?: boolean;
		// phone_number
		country_codes?: string[];
		// time
		start_time?: string;
		end_time?: string;
	};
}

export interface FlowGraph {
	nodes: FlowNode[];
	edges: FlowEdge[];
	config: FlowConfig;
	flowFunctions: FunctionReference[];
	globalFunctions: FunctionReference[];
	entities: Entity[];
}

interface FunctionInfo {
	description: string;
	gotoSteps?: string[]; // Array of all possible goto_step targets
	hasExitFlow?: boolean; // True if function calls conv.exit_flow()
}

/** Function step info: flow_name > function_steps > step_name (Python files) */
interface FunctionStepInfo {
	filePath: string;
	description: string;
	gotoSteps: string[];
	hasExitFlow: boolean;
}

export class FlowParser {
	private flowDir: string;

	constructor(flowDir: string) {
		this.flowDir = flowDir;
	}

	async parseFlow(): Promise<FlowGraph> {
		const config = await this.parseConfig();
		const steps = await this.parseSteps();
		const functionSteps = await this.parseFunctionSteps();
		const flowFunctions = await this.parseFlowFunctions();
		const globalFunctions = await this.parseGlobalFunctions();
		const entities = await this.parseEntities();

		console.log(`Parsing flow: ${config.name}`);
		console.log(`Found ${steps.size} steps:`, Array.from(steps.keys()));
		console.log(`Found ${functionSteps.size} function steps:`, Array.from(functionSteps.keys()));
		console.log(`Found ${flowFunctions.size} flow functions:`, Array.from(flowFunctions.keys()));
		console.log(`Found ${globalFunctions.size} global functions:`, Array.from(globalFunctions.keys()));
		console.log(`Found ${entities.length} entities:`, entities.map(e => e.name));

		const nodes: FlowNode[] = [];
		const edges: FlowEdge[] = [];
		const nodeMap = new Map<string, FlowNode>();

		// Add start node
		const startNode: FlowNode = {
			id: 'start',
			label: 'Start',
			type: 'end',
			details: `Flow: ${config.name}\n${config.description || ''}\n\nStart Step: ${config.start_step || 'N/A'}`
		};
		nodes.push(startNode);
		nodeMap.set('start', startNode);

		// Add exit node (steps that call conv.exit_flow() transition here)
		const exitNode: FlowNode = {
			id: 'exit',
			label: 'Exit',
			type: 'exit',
			details: 'Flow exit. Reached when a step\'s function calls conv.exit_flow().'
		};
		nodes.push(exitNode);
		nodeMap.set('exit', exitNode);

		// Add step nodes
		for (const [stepName, stepData] of steps.entries()) {
			// Determine node type based on step_type
			const isNoCodeStep = stepData.step.step_type === 'default_step';
			const node: FlowNode = {
				id: stepName,
				label: stepName,
				type: isNoCodeStep ? 'no-code-step' : 'step',
				step: stepData.step,
				stepFilePath: stepData.filePath,
				details: this.formatStepDetails(stepData.step, flowFunctions, globalFunctions)
			};
			nodes.push(node);
			nodeMap.set(stepName, node);
		}

		// Add function step nodes (flow_name > function_steps > step_name — Python functions as steps)
		for (const [stepName, stepData] of functionSteps.entries()) {
			if (nodeMap.has(stepName)) {
				// Avoid duplicate id: regular step with same name takes precedence
				continue;
			}
			const node: FlowNode = {
				id: stepName,
				label: stepName,
				type: 'function-step',
				details: stepData.description || `Python function: ${stepName}`,
				stepFilePath: stepData.filePath
			};
			nodes.push(node);
			nodeMap.set(stepName, node);
		}

		// Don't create function nodes - functions will be shown as clickable links in step details
		// Store function info for step details and transitions

		// Add edge from start to first step
		if (config.start_step && nodeMap.has(config.start_step)) {
			edges.push({
				from: 'start',
				to: config.start_step,
				label: 'start'
			});
		}

		// Parse transitions from step prompts
		// Functions are not shown as nodes, but we create edges directly to target steps if functions have goto_step
		for (const [stepName, stepData] of steps.entries()) {
			const transitions = this.parseTransitions(stepData.step.prompt);
			for (const transition of transitions) {
				let targetIds: string[] = [];
				
				const globalFuncPath = transition.type === 'function' ? this.getGlobalFunctionPath(transition.target) : '';
				const flowFuncPath = transition.type === 'flow-function' ? this.getFlowFunctionPath(transition.target) : '';
				const functionFilePath = globalFuncPath || flowFuncPath || undefined;

				if (transition.type === 'function') {
					// Global function (fn:) - check if it has goto_steps and/or exit_flow
					const funcInfo = globalFunctions.get(transition.target);
					if (funcInfo && funcInfo.gotoSteps && funcInfo.gotoSteps.length > 0) {
						targetIds = funcInfo.gotoSteps;
					}
					// If function calls conv.exit_flow(), add edge to exit node
					if (funcInfo?.hasExitFlow) {
						edges.push({
							from: stepName,
							to: 'exit',
							label: transition.condition || `${transition.target} (exit)`,
							condition: transition.condition,
							functionFilePath
						});
					}
				} else if (transition.type === 'flow-function') {
					// Flow function (ft:) - check if it has goto_steps and/or exit_flow
					const funcInfo = flowFunctions.get(transition.target);
					if (funcInfo && funcInfo.gotoSteps && funcInfo.gotoSteps.length > 0) {
						targetIds = funcInfo.gotoSteps;
					}
					// If function calls conv.exit_flow(), add edge to exit node
					if (funcInfo?.hasExitFlow) {
						edges.push({
							from: stepName,
							to: 'exit',
							label: transition.condition || `${transition.target} (exit)`,
							condition: transition.condition,
							functionFilePath
						});
					}
				} else {
					// Step transition
					targetIds = [transition.target];
				}

				// Create edges for all valid target steps (including function-step nodes)
				for (const targetId of targetIds) {
					if (nodeMap.has(targetId)) {
						edges.push({
							from: stepName,
							to: targetId,
							label: transition.condition || transition.target,
							condition: transition.condition,
							functionFilePath
						});
					} else {
						// Log missing target for debugging
						console.warn(`Transition target not found: ${targetId} from step ${stepName}`);
					}
				}
			}
		}

		// Add edges FROM function steps (they are Python functions that can call goto_step / exit_flow)
		for (const [stepName, stepData] of functionSteps.entries()) {
			if (stepData.hasExitFlow) {
				edges.push({
					from: stepName,
					to: 'exit',
					label: `${stepName} (exit)`,
					functionFilePath: stepData.filePath
				});
			}
			for (const targetId of stepData.gotoSteps || []) {
				if (nodeMap.has(targetId)) {
					edges.push({
						from: stepName,
						to: targetId,
						label: stepName,
						functionFilePath: stepData.filePath
					});
				} else {
					console.warn(`Function step ${stepName} goto target not found: ${targetId}`);
				}
			}
		}

		// Add edges for No Code Steps (default_step) conditions
		for (const [stepName, stepData] of steps.entries()) {
			if (stepData.step.step_type === 'default_step' && stepData.step.conditions) {
				for (const condition of stepData.step.conditions) {
					if (condition.condition_type === 'exit_flow_condition') {
						// Exit flow condition - add edge to exit node
						edges.push({
							from: stepName,
							to: 'exit',
							label: condition.name || 'Exit Flow',
							condition: condition.description,
							type: 'condition'
						});
					} else if (condition.condition_type === 'step_condition' && condition.child_step) {
						// Step condition - add edge to target step
						if (nodeMap.has(condition.child_step)) {
							edges.push({
								from: stepName,
								to: condition.child_step,
								label: condition.name || condition.child_step,
								condition: condition.description,
								type: 'condition'
							});
						} else {
							console.warn(`No Code Step condition target not found: ${condition.child_step} from step ${stepName}`);
						}
					}
				}
			}
		}

		// Deduplicate edges: same from+to+label should only appear once
		const edgeKey = (e: FlowEdge) => `${e.from}|${e.to}|${e.label}`;
		const seen = new Set<string>();
		const uniqueEdges: FlowEdge[] = [];
		for (const edge of edges) {
			const key = edgeKey(edge);
			if (!seen.has(key)) {
				seen.add(key);
				uniqueEdges.push(edge);
			}
		}

		return { 
			nodes, 
			edges: uniqueEdges, 
			config,
			flowFunctions: Array.from(flowFunctions.entries()).map(([name, info]) => ({
				name,
				description: info.description,
				gotoStep: info.gotoSteps && info.gotoSteps.length > 0 ? info.gotoSteps[0] : undefined, // Keep for backward compatibility
				type: 'flow-function',
				filePath: this.getFlowFunctionPath(name)
			})),
			globalFunctions: Array.from(globalFunctions.entries()).map(([name, info]) => ({
				name,
				description: info.description,
				gotoStep: info.gotoSteps && info.gotoSteps.length > 0 ? info.gotoSteps[0] : undefined, // Keep for backward compatibility
				type: 'global-function',
				filePath: this.getGlobalFunctionPath(name)
			})),
			entities
		};
	}

	private async parseConfig(): Promise<FlowConfig> {
		const configPath = path.join(this.flowDir, 'flow_config.yaml');
		const content = fs.readFileSync(configPath, 'utf8');
		return yaml.load(content) as FlowConfig;
	}

	private async parseSteps(): Promise<Map<string, { step: Step; filePath: string }>> {
		const stepsDir = path.join(this.flowDir, 'steps');
		const steps = new Map<string, { step: Step; filePath: string }>();

		if (!fs.existsSync(stepsDir)) {
			return steps;
		}

		const files = fs.readdirSync(stepsDir);
		for (const file of files) {
			if (file.endsWith('.yaml') || file.endsWith('.yml')) {
				const filePath = path.join(stepsDir, file);
				const content = fs.readFileSync(filePath, 'utf8');
				const step = yaml.load(content) as Step;
				steps.set(step.name, { step, filePath });
			}
		}

		return steps;
	}

	private async parseFunctionSteps(): Promise<Map<string, FunctionStepInfo>> {
		const functionStepsDir = path.join(this.flowDir, 'function_steps');
		const result = new Map<string, FunctionStepInfo>();

		if (!fs.existsSync(functionStepsDir)) {
			return result;
		}

		const files = fs.readdirSync(functionStepsDir);
		for (const file of files) {
			if (file.endsWith('.py')) {
				const stepName = path.basename(file, '.py');
				const filePath = path.join(functionStepsDir, file);
				const description = this.extractFunctionDescription(filePath);
				const gotoSteps = this.extractGotoSteps(filePath);
				const hasExitFlow = this.extractHasExitFlow(filePath);
				result.set(stepName, { filePath, description, gotoSteps, hasExitFlow });
			}
		}

		return result;
	}

	// Parse flow functions (ft:) - functions in the flow's functions directory
	private async parseFlowFunctions(): Promise<Map<string, FunctionInfo>> {
		const functionsDir = path.join(this.flowDir, 'functions');
		const functions = new Map<string, FunctionInfo>();

		if (!fs.existsSync(functionsDir)) {
			return functions;
		}

		const files = fs.readdirSync(functionsDir);
		for (const file of files) {
			if (file.endsWith('.py')) {
				const funcName = path.basename(file, '.py');
				const filePath = path.join(functionsDir, file);
				const description = this.extractFunctionDescription(filePath);
				const gotoSteps = this.extractGotoSteps(filePath);
				const hasExitFlow = this.extractHasExitFlow(filePath);
				functions.set(funcName, { description, gotoSteps, hasExitFlow });
			}
		}

		return functions;
	}

	// Parse global functions (fn:) - functions in the project's functions directory
	private async parseGlobalFunctions(): Promise<Map<string, FunctionInfo>> {
		const functions = new Map<string, FunctionInfo>();
		
		// Find project root by looking for a functions directory that's not inside a flows directory
		let currentDir = this.flowDir;
		let projectRoot: string | null = null;
		
		// Go up the directory tree to find the project root
		while (currentDir !== path.dirname(currentDir)) {
			const functionsDir = path.join(currentDir, 'functions');
			const flowsDir = path.join(currentDir, 'flows');
			
			// Check if this directory has a functions folder but is not inside a flows directory
			if (fs.existsSync(functionsDir)) {
				// Check if we're not inside a flows directory
				if (!currentDir.includes(path.sep + 'flows' + path.sep) && 
				    !currentDir.endsWith(path.sep + 'flows')) {
					projectRoot = currentDir;
					break;
				}
			}
			
			currentDir = path.dirname(currentDir);
		}
		
		if (!projectRoot) {
			console.warn('Could not find project root with functions directory');
			return functions;
		}
		
		const functionsDir = path.join(projectRoot, 'functions');
		if (!fs.existsSync(functionsDir)) {
			return functions;
		}

		const files = fs.readdirSync(functionsDir);
		for (const file of files) {
			if (file.endsWith('.py')) {
				const funcName = path.basename(file, '.py');
				const filePath = path.join(functionsDir, file);
				const description = this.extractFunctionDescription(filePath);
				const gotoSteps = this.extractGotoSteps(filePath);
				const hasExitFlow = this.extractHasExitFlow(filePath);
				functions.set(funcName, { description, gotoSteps, hasExitFlow });
			}
		}

		return functions;
	}

	private async parseEntities(): Promise<Entity[]> {
		// Find project root to locate config/entities.yaml
		// Project root is the parent of the 'flows' directory
		let currentDir = this.flowDir;
		let projectRoot: string | null = null;
		
		// Go up the directory tree to find the project root (parent of flows directory)
		while (currentDir !== path.dirname(currentDir)) {
			const parentDir = path.dirname(currentDir);
			const dirName = path.basename(currentDir);
			
			// If we're in a flow directory inside 'flows', the project root is the parent of 'flows'
			if (dirName === 'flows' || path.basename(parentDir) === 'flows') {
				// Keep going up to find project root
				currentDir = parentDir;
				continue;
			}
			
			// Check if this directory has a config folder
			const configDir = path.join(currentDir, 'config');
			if (fs.existsSync(configDir)) {
				projectRoot = currentDir;
				break;
			}
			
			currentDir = parentDir;
		}
		
		if (!projectRoot) {
			console.warn('Could not find project root with config directory');
			return [];
		}
		
		console.log('Found project root:', projectRoot);
		
		const entitiesPath = path.join(projectRoot, 'config', 'entities.yaml');
		if (!fs.existsSync(entitiesPath)) {
			console.warn('entities.yaml not found at', entitiesPath);
			return [];
		}

		console.log('Reading entities from:', entitiesPath);

		try {
			const content = fs.readFileSync(entitiesPath, 'utf8');
			const parsed = yaml.load(content) as any;
			
			console.log('Parsed entities YAML:', JSON.stringify(parsed, null, 2).substring(0, 500));
			
			// Handle different YAML formats:
			// 1. { entities: [...] } - root 'entities' key with array
			// 2. [...] - direct array
			// 3. { entityName: { ... }, ... } - object with entity names as keys
			
			let entitiesArray: any[] = [];
			
			if (parsed && parsed.entities && Array.isArray(parsed.entities)) {
				// Format: { entities: [...] }
				entitiesArray = parsed.entities;
			} else if (Array.isArray(parsed)) {
				// Format: direct array
				entitiesArray = parsed;
			} else if (parsed && typeof parsed === 'object') {
				// Format: { entityName: { ... }, ... }
				entitiesArray = Object.entries(parsed).map(([name, data]: [string, any]) => ({
					name: data.name || name,
					description: data.description,
					entity_type: data.entity_type,
					config: data.config || {}
				}));
			}
			
			console.log(`Found ${entitiesArray.length} entities`);
			
			return entitiesArray.map((entity: any) => ({
				name: entity.name,
				description: entity.description || '',
				entity_type: entity.entity_type,
				config: entity.config || {}
			}));
		} catch (error) {
			console.error('Error parsing entities.yaml:', error);
		}
		
		return [];
	}

	private getFlowFunctionPath(funcName: string): string {
		return path.join(this.flowDir, 'functions', `${funcName}.py`);
	}

	private getGlobalFunctionPath(funcName: string): string {
		// Find project root (same logic as parseGlobalFunctions)
		let currentDir = this.flowDir;
		let projectRoot: string | null = null;
		
		while (currentDir !== path.dirname(currentDir)) {
			const functionsDir = path.join(currentDir, 'functions');
			if (fs.existsSync(functionsDir)) {
				if (!currentDir.includes(path.sep + 'flows' + path.sep) && 
				    !currentDir.endsWith(path.sep + 'flows')) {
					projectRoot = currentDir;
					break;
				}
			}
			currentDir = path.dirname(currentDir);
		}
		
		if (projectRoot) {
			return path.join(projectRoot, 'functions', `${funcName}.py`);
		}
		return '';
	}

	private extractFunctionDescription(filePath: string): string {
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			// Try to extract @func_description decorator
			const descMatch = content.match(/@func_description\(["']([^"']+)["']\)/);
			if (descMatch) {
				return descMatch[1];
			}
			// Try to extract docstring
			const docstringMatch = content.match(/"""(.*?)"""/s);
			if (docstringMatch) {
				return docstringMatch[1].trim();
			}
			// Try to extract single-line docstring
			const singleLineMatch = content.match(/""([^"]+)""/);
			if (singleLineMatch) {
				return singleLineMatch[1].trim();
			}
		} catch (error) {
			// Ignore errors reading function files
		}
		return '';
	}

	private extractGotoSteps(filePath: string): string[] {
		const gotoSteps: string[] = [];
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			
			// Match all flow.goto_step('step_name') or flow.goto_step("step_name") occurrences
			const gotoStepRegex = /flow\.goto_step\(["']([^"']+)["']\)/g;
			let match;
			while ((match = gotoStepRegex.exec(content)) !== null) {
				const stepName = match[1];
				// Only add unique step names
				if (!gotoSteps.includes(stepName)) {
					gotoSteps.push(stepName);
				}
			}
			
			// Match "goto_step": "step_name" in JSON-like structures
			const jsonRegex = /"goto_step"\s*:\s*["']([^"']+)["']/g;
			while ((match = jsonRegex.exec(content)) !== null) {
				const stepName = match[1];
				if (!gotoSteps.includes(stepName)) {
					gotoSteps.push(stepName);
				}
			}
			
			// Match 'goto_step': 'step_name' (single quotes)
			const singleQuoteRegex = /'goto_step'\s*:\s*["']([^"']+)["']/g;
			while ((match = singleQuoteRegex.exec(content)) !== null) {
				const stepName = match[1];
				if (!gotoSteps.includes(stepName)) {
					gotoSteps.push(stepName);
				}
			}
		} catch (error) {
			// Ignore errors reading function files
		}
		return gotoSteps;
	}

	private extractHasExitFlow(filePath: string): boolean {
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			return /conv\.exit_flow\s*\(/.test(content);
		} catch (error) {
			return false;
		}
	}

	private parseTransitions(prompt: string): Array<{ type: 'function' | 'flow-function' | 'step'; target: string; condition?: string }> {
		const transitions: Array<{ type: 'function' | 'flow-function' | 'step'; target: string; condition?: string }> = [];

		// Match {{fn:function_name}} or {{fn:function_name}}('param') - global functions
		const seenTargets = new Set<string>();
		const fnRegex = /\{\{fn:(\w+)\}\}(?:\([^)]*\))?/g;
		let match;
		while ((match = fnRegex.exec(prompt)) !== null) {
			const key = `function:${match[1]}`;
			if (!seenTargets.has(key)) {
				seenTargets.add(key);
				transitions.push({
					type: 'function',
					target: match[1]
				});
			}
		}

		// Match {{ft:function_name}} - flow functions
		const ftRegex = /\{\{ft:(\w+)\}\}/g;
		while ((match = ftRegex.exec(prompt)) !== null) {
			const key = `flow-function:${match[1]}`;
			if (!seenTargets.has(key)) {
				seenTargets.add(key);
				transitions.push({
					type: 'flow-function',
					target: match[1]
				});
			}
		}

		// Try to extract conditions from markdown bold text before transitions
		const lines = prompt.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const boldMatch = line.match(/\*\*([^*]+)\*\*:/);
			if (boldMatch) {
				const condition = boldMatch[1].trim();
				// Look for transitions in the next few lines
				for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
					const fnMatch = lines[j].match(/\{\{fn:(\w+)\}\}/);
					const ftMatch = lines[j].match(/\{\{ft:(\w+)\}\}/);
					if (fnMatch) {
						const existing = transitions.find(t => t.target === fnMatch[1] && t.type === 'function');
						if (existing && !existing.condition) {
							existing.condition = condition;
						}
					}
					if (ftMatch) {
						const existing = transitions.find(t => t.target === ftMatch[1] && t.type === 'flow-function');
						if (existing && !existing.condition) {
							existing.condition = condition;
						}
					}
				}
			}
		}

		return transitions;
	}

	private formatStepDetails(step: Step, flowFunctions: Map<string, FunctionInfo>, globalFunctions: Map<string, FunctionInfo>): string {
		let details = `Step: ${step.name}\n`;
		details += `Type: ${step.step_type}\n\n`;
		
		if (step.prompt) {
			// Extract function references for clickable links
			const fnMatches = step.prompt.matchAll(/\{\{fn:(\w+)\}\}(?:\([^)]*\))?/g);
			const ftMatches = step.prompt.matchAll(/\{\{ft:(\w+)\}\}/g);
			
			// Clean up the prompt for display, replacing function references with placeholders
			let cleanPrompt = step.prompt
				.replace(/\{\{fn:(\w+)\}\}(?:\([^)]*\))?/g, '[FN:$1]')
				.replace(/\{\{ft:(\w+)\}\}/g, '[FT:$1]')
				.replace(/\$(\w+)/g, '[$1]');
			
			details += `Prompt:\n${cleanPrompt}\n\n`;
		}

		// Configuration details for advanced_step
		const configDetails: string[] = [];
		if (step.asr_biasing?.is_enabled) {
			configDetails.push('ASR Biasing: Enabled');
		}

		if (step.dtmf_config?.is_enabled) {
			configDetails.push('DTMF: Enabled');
			if (step.dtmf_config.max_digits) {
				configDetails.push(`  Max Digits: ${step.dtmf_config.max_digits}`);
			}
		}

		if (configDetails.length > 0) {
			details += `Configuration:\n${configDetails.join('\n')}\n`;
		}

		// No Code Step (default_step) specific details
		if (step.step_type === 'default_step') {
			if (step.extracted_entities && step.extracted_entities.length > 0) {
				details += `\nExtracted Entities:\n${step.extracted_entities.map(e => `  - ${e}`).join('\n')}\n`;
			}

			if (step.conditions && step.conditions.length > 0) {
				details += `\nConditions:\n`;
				for (const condition of step.conditions) {
					details += `  [${condition.condition_type}] ${condition.name}\n`;
					if (condition.description) {
						details += `    Description: ${condition.description}\n`;
					}
					if (condition.child_step) {
						details += `    → ${condition.child_step}\n`;
					}
					if (condition.required_entities && condition.required_entities.length > 0) {
						details += `    Required: ${condition.required_entities.join(', ')}\n`;
					}
				}
			}
		}

		return details;
	}
}

