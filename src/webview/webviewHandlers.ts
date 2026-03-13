import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { FlowParser, Entity, VariantAttributeDefinition } from '../flowParser';
import { extractFunctionReferences, areFunctionSetsEqual } from '../utils/functionUtils';

/**
 * Converts a string to snake_case
 * Handles: camelCase, PascalCase, spaces, hyphens, and mixed formats
 */
function toSnakeCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, '$1_$2')  // camelCase -> camel_Case
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')  // XMLParser -> XML_Parser
		.replace(/[\s\-]+/g, '_')  // spaces and hyphens to underscores
		.replace(/[^a-zA-Z0-9_]/g, '')  // remove non-alphanumeric (except underscores)
		.replace(/_+/g, '_')  // collapse multiple underscores
		.replace(/^_|_$/g, '')  // trim leading/trailing underscores
		.toLowerCase();
}

export interface WebviewMessage {
	command: string;
	[key: string]: any;
}

/**
 * Handles messages from the webview
 */
export class WebviewMessageHandler {
	private panel: vscode.WebviewPanel;
	private flowDir: string;
	private flowGraphData: any;

	constructor(panel: vscode.WebviewPanel, flowDir: string) {
		this.panel = panel;
		this.flowDir = flowDir;
	}

	/**
	 * Gets the path to the entities.yaml file
	 */
	private getEntitiesFilePath(): string | null {
		let currentDir = this.flowDir;
		
		while (currentDir !== path.dirname(currentDir)) {
			const parentDir = path.dirname(currentDir);
			const dirName = path.basename(currentDir);
			
			if (dirName === 'flows' || path.basename(parentDir) === 'flows') {
				currentDir = parentDir;
				continue;
			}
			
			const configDir = path.join(currentDir, 'config');
			if (fs.existsSync(configDir)) {
				return path.join(configDir, 'entities.yaml');
			}
			
			currentDir = parentDir;
		}
		
		return null;
	}

	/**
	 * Gets the path to the variant_attributes.yaml file (same config dir as entities).
	 */
	private getVariantAttributesFilePath(): string | null {
		const entitiesPath = this.getEntitiesFilePath();
		if (!entitiesPath) return null;
		return path.join(path.dirname(entitiesPath), 'variant_attributes.yaml');
	}

	/**
	 * Sets the current flow graph data
	 */
	setFlowGraphData(data: any) {
		this.flowGraphData = data;
	}

	/**
	 * Handles incoming messages from the webview
	 */
	async handleMessage(message: WebviewMessage): Promise<void> {
		switch (message.command) {
			case 'ready':
				await this.handleReady();
				break;
			case 'openFunction':
				await this.handleOpenFunction(message.filePath);
				break;
			case 'confirmDiscardAll':
				await this.handleConfirmDiscardAll(message.count);
				break;
			case 'saveStep':
				await this.handleSaveStep(message);
				break;
			case 'showMessage':
				this.handleShowMessage(message.type, message.text);
				break;
			case 'saveEntities':
				await this.handleSaveEntities(message.entities);
				break;
			case 'saveVariantAttributes':
				await this.handleSaveVariantAttributes(message.attributes);
				break;
			case 'createStep':
				await this.handleCreateStep(message.stepName, message.stepType, message.forCondition);
				break;
			case 'deleteStep':
				await this.handleDeleteStep(message.nodeId, message.filePath);
				break;
			case 'setStartStep':
				await this.handleSetStartStep(message.nodeId);
				break;
			case 'showError':
				vscode.window.showErrorMessage(message.message);
				break;
		}
	}

	private handleShowMessage(type: string, text: string): void {
		switch (type) {
			case 'info':
				vscode.window.showInformationMessage(text);
				break;
			case 'warning':
				vscode.window.showWarningMessage(text);
				break;
			case 'error':
				vscode.window.showErrorMessage(text);
				break;
			default:
				vscode.window.showInformationMessage(text);
		}
	}

	private async handleReady(): Promise<void> {
		console.log('Webview ready, sending flow graph');
		if (this.flowGraphData) {
			this.panel.webview.postMessage({
				command: 'loadFlow',
				flowGraph: this.flowGraphData
			});
		} else {
			console.warn('Webview ready but flow graph not yet parsed');
		}
	}

	private async handleOpenFunction(filePath: string): Promise<void> {
		if (filePath && fs.existsSync(filePath)) {
			const doc = await vscode.workspace.openTextDocument(filePath);
			await vscode.window.showTextDocument(doc);
		} else {
			vscode.window.showErrorMessage(`Function file not found: ${filePath}`);
		}
	}

	private async handleConfirmDiscardAll(count: number): Promise<void> {
		const result = await vscode.window.showWarningMessage(
			`Are you sure you want to discard all ${count} modified node(s)? This cannot be undone.`,
			{ modal: true },
			'Discard All',
			'Cancel'
		);
		
		// Send result back to webview
		this.panel.webview.postMessage({
			command: 'discardAllConfirmed',
			confirmed: result === 'Discard All'
		});
	}

	private async handleSaveStep(message: WebviewMessage): Promise<void> {
		const { stepFilePath, prompt, asrBiasing, dtmfConfig, extractedEntities, conditions, nodeId, isDefaultStep } = message;
		
		try {
			// Read existing YAML file
			const content = fs.readFileSync(stepFilePath, 'utf8');
			const stepData = yaml.load(content) as any;
			
			// Extract function references from old and new prompts
			const oldPrompt = stepData.prompt || '';
			const oldFunctions = extractFunctionReferences(oldPrompt);
			const newFunctions = extractFunctionReferences(prompt);
			
			// Check if functions were added or removed
			const functionsChanged = !areFunctionSetsEqual(oldFunctions, newFunctions);
			
			// Check if conditions changed (affects edges in the flow graph)
			const oldConditions = stepData.conditions || [];
			const conditionsChanged = conditions !== null && conditions !== undefined && 
				JSON.stringify(oldConditions) !== JSON.stringify(conditions);
			
			// Update prompt field
			stepData.prompt = prompt;
			
			// Handle ASR biasing and DTMF config based on step type
			if (isDefaultStep) {
				// Default steps don't support ASR biasing or DTMF - remove these fields if present
				delete stepData.asr_biasing;
				delete stepData.dtmf_config;
			} else {
				// Update ASR biasing for non-default steps
				if (asrBiasing) {
					stepData.asr_biasing = asrBiasing;
				}
				
				// Update DTMF config for non-default steps
				if (dtmfConfig) {
					stepData.dtmf_config = dtmfConfig;
				}
			}
			
			// Update extracted entities (for default_step)
			if (extractedEntities !== null && extractedEntities !== undefined) {
				stepData.extracted_entities = extractedEntities;
			}
			
			// Update conditions (for default_step)
			if (conditions !== null && conditions !== undefined) {
				stepData.conditions = conditions;
			}
			
			// Write back to file
			const yamlContent = yaml.dump(stepData, {
				indent: 2,
				lineWidth: -1,
				noRefs: true,
				quotingType: '"',
				forceQuotes: false
			});
			
			fs.writeFileSync(stepFilePath, yamlContent, 'utf8');
			
			// Show success message
			vscode.window.showInformationMessage(`Step "${nodeId}" saved successfully`);
			
			// Reload the flow if functions or conditions changed (both affect edges)
			if (functionsChanged || conditionsChanged) {
				const parser = new FlowParser(this.flowDir);
				const updatedFlowGraph = await parser.parseFlow();
				this.flowGraphData = updatedFlowGraph;
				
				// Send updated flow to webview
				this.panel.webview.postMessage({
					command: 'loadFlow',
					flowGraph: updatedFlowGraph
				});
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error saving step: ${errorMessage}`);
			console.error('Error saving step:', error);
		}
	}

	private async handleSaveEntities(entities: Entity[]): Promise<void> {
		try {
			const entitiesFilePath = this.getEntitiesFilePath();
			
			if (!entitiesFilePath) {
				vscode.window.showErrorMessage('Could not find entities.yaml file location');
				return;
			}
			
			// Ensure the config directory exists
			const configDir = path.dirname(entitiesFilePath);
			if (!fs.existsSync(configDir)) {
				fs.mkdirSync(configDir, { recursive: true });
			}
			
			// Format the entities data with the root 'entities' key
			const entitiesData = { entities: entities };
			
			// Write to file
			const yamlContent = yaml.dump(entitiesData, {
				indent: 2,
				lineWidth: 100,
				noRefs: true,
				quotingType: '"',
				forceQuotes: false
			});
			
			fs.writeFileSync(entitiesFilePath, yamlContent, 'utf8');
			
			// Show success message
			vscode.window.showInformationMessage('Entity saved');
			
			// Reload the flow to update entities in the graph
			const parser = new FlowParser(this.flowDir);
			const updatedFlowGraph = await parser.parseFlow();
			this.flowGraphData = updatedFlowGraph;
			
			// Send updated flow to webview
			this.panel.webview.postMessage({
				command: 'loadFlow',
				flowGraph: updatedFlowGraph
			});
			
			// Notify webview that save was successful
			this.panel.webview.postMessage({
				command: 'entitiesSaved',
				success: true
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error saving entities: ${errorMessage}`);
			console.error('Error saving entities:', error);
			
			// Notify webview of failure
			this.panel.webview.postMessage({
				command: 'entitiesSaved',
				success: false,
				error: errorMessage
			});
		}
	}

	private async handleSaveVariantAttributes(attributes: VariantAttributeDefinition[]): Promise<void> {
		try {
			const filePath = this.getVariantAttributesFilePath();
			if (!filePath) {
				vscode.window.showErrorMessage('Could not find variant_attributes.yaml file location');
				return;
			}
			const configDir = path.dirname(filePath);
			if (!fs.existsSync(configDir)) {
				fs.mkdirSync(configDir, { recursive: true });
			}
			const data = { attributes };
			const yamlContent = yaml.dump(data, {
				indent: 2,
				lineWidth: 100,
				noRefs: true,
				quotingType: '"',
				forceQuotes: false
			});
			fs.writeFileSync(filePath, yamlContent, 'utf8');
			vscode.window.showInformationMessage('Variant attribute saved');
			const parser = new FlowParser(this.flowDir);
			const updatedFlowGraph = await parser.parseFlow();
			this.flowGraphData = updatedFlowGraph;
			this.panel.webview.postMessage({ command: 'loadFlow', flowGraph: updatedFlowGraph });
			this.panel.webview.postMessage({ command: 'variantAttributesSaved', success: true });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error saving variant attributes: ${errorMessage}`);
			console.error('Error saving variant attributes:', error);
			this.panel.webview.postMessage({ command: 'variantAttributesSaved', success: false, error: errorMessage });
		}
	}

	private async handleSetStartStep(nodeId: string): Promise<void> {
		try {
			const configPath = path.join(this.flowDir, 'flow_config.yaml');
			if (!fs.existsSync(configPath)) {
				vscode.window.showErrorMessage('flow_config.yaml not found');
				return;
			}
			const content = fs.readFileSync(configPath, 'utf8');
			const config = yaml.load(content) as { name?: string; description?: string; start_step?: string; [key: string]: unknown };
			if (!config || typeof config !== 'object') {
				vscode.window.showErrorMessage('Invalid flow_config.yaml');
				return;
			}
			config.start_step = nodeId;
			const yamlContent = yaml.dump(config, {
				indent: 2,
				lineWidth: 100,
				noRefs: true,
				quotingType: '"',
				forceQuotes: false
			});
			fs.writeFileSync(configPath, yamlContent, 'utf8');
			vscode.window.showInformationMessage('Start step updated');
			const parser = new FlowParser(this.flowDir);
			const updatedFlowGraph = await parser.parseFlow();
			this.flowGraphData = updatedFlowGraph;
			this.panel.webview.postMessage({ command: 'loadFlow', flowGraph: updatedFlowGraph });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error updating start step: ${errorMessage}`);
		}
	}

	private async handleCreateStep(stepName: string, stepType: string, forCondition?: boolean): Promise<void> {
		try {
			// Convert step name to snake_case for file naming only
			// The name field in YAML keeps the original user input
			const snakeCaseName = toSnakeCase(stepName);
			
			// Determine target directory and file content based on step type
			let targetDir: string;
			let fileContent: string;
			let fileName: string;

			if (stepType === 'function_step') {
				// Function steps go in function_steps directory as Python files
				// Function name must be snake_case for valid Python
				targetDir = path.join(this.flowDir, 'function_steps');
				fileName = `${snakeCaseName}.py`;
				fileContent = this.getFunctionStepTemplate(snakeCaseName);
			} else {
				// default_step and advanced_step go in steps directory as YAML files
				// File name is snake_case, but name field keeps original input
				targetDir = path.join(this.flowDir, 'steps');
				fileName = `${snakeCaseName}.yaml`;
				fileContent = this.getStepTemplate(stepName, stepType);
			}

			// Ensure the target directory exists
			if (!fs.existsSync(targetDir)) {
				fs.mkdirSync(targetDir, { recursive: true });
			}

			const filePath = path.join(targetDir, fileName);

			// Check if file already exists
			if (fs.existsSync(filePath)) {
				vscode.window.showErrorMessage(`A step file "${fileName}" already exists`);
				return;
			}

			// Write the file
			fs.writeFileSync(filePath, fileContent, 'utf8');

			// Show success message
			vscode.window.showInformationMessage(`Step "${stepName}" created successfully`);

			// Reload the flow to include the new step
			const parser = new FlowParser(this.flowDir);
			const updatedFlowGraph = await parser.parseFlow();
			this.flowGraphData = updatedFlowGraph;

			// Send updated flow to webview
			this.panel.webview.postMessage({
				command: 'loadFlow',
				flowGraph: updatedFlowGraph
			});

			// If step was created for a condition, restore the condition form
			if (forCondition) {
				this.panel.webview.postMessage({
					command: 'stepCreatedForCondition',
					stepName: snakeCaseName
				});
			} else if (stepType === 'function_step') {
				// For function steps, open the Python file in editor
				const doc = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(doc);
			} else {
				// Tell the webview to select and show the new step
				this.panel.webview.postMessage({
					command: 'selectNode',
					nodeId: snakeCaseName
				});
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error creating step: ${errorMessage}`);
			console.error('Error creating step:', error);
		}
	}

	private getStepTemplate(stepName: string, stepType: string): string {
		if (stepType === 'default_step') {
			// No Code Step template
			return `name: ${stepName}
step_type: default_step
prompt: |
  Enter your prompt here.
extracted_entities: []
conditions: []
`;
		} else {
			// Advanced Step template
			return `name: ${stepName}
step_type: advanced_step
prompt: |
  Enter your prompt here.
`;
		}
	}

	private getFunctionStepTemplate(stepName: string): string {
		return `from imports import *  # <AUTO GENERATED>


def ${stepName}(conv: Conversation, flow: Flow):

    condition_1 = False
    if condition_1:
        pass
`;
	}

	private async handleDeleteStep(nodeId: string, filePath: string): Promise<void> {
		try {
			// Confirm deletion
			const result = await vscode.window.showWarningMessage(
				`Are you sure you want to delete the step "${nodeId}"? This cannot be undone.`,
				{ modal: true },
				'Delete',
				'Cancel'
			);

			if (result !== 'Delete') {
				return;
			}

			// Check if file exists
			if (!fs.existsSync(filePath)) {
				vscode.window.showErrorMessage(`Step file not found: ${filePath}`);
				return;
			}

			// Delete the file
			fs.unlinkSync(filePath);

			// Show success message
			vscode.window.showInformationMessage(`Step "${nodeId}" deleted successfully`);

			// Reload the flow
			const parser = new FlowParser(this.flowDir);
			const updatedFlowGraph = await parser.parseFlow();
			this.flowGraphData = updatedFlowGraph;

			// Send updated flow to webview
			this.panel.webview.postMessage({
				command: 'loadFlow',
				flowGraph: updatedFlowGraph
			});

			// Close the details panel
			this.panel.webview.postMessage({
				command: 'closeDetails'
			});

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Error deleting step: ${errorMessage}`);
			console.error('Error deleting step:', error);
		}
	}
}

