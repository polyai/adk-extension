import * as path from 'path';
import * as fs from 'fs';
import { parseDocument, LineCounter, isMap, isSeq, isScalar, Document } from 'yaml';

/**
 * Pure filesystem-based resolution for Agent Studio projects: locating functions,
 * flows, and variant attributes on disk. No `vscode` dependency, so this module is safe
 * to use from both the extension (via pythonFunctionResolver.ts) and the standalone
 * `adk-lint` CLI (src/cli.ts), which has no `vscode` module available at runtime.
 */
export class FunctionPathResolver {
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
	 * Resolves conv.functions.function_name() to the global function file path.
	 */
	static resolveConvFunctionPath(functionName: string, filePath: string): string | null {
		const projectRoot = this.findProjectRoot(filePath);
		if (!projectRoot) {
			return null;
		}

		const functionPath = path.join(projectRoot, 'functions', `${functionName}.py`);
		return fs.existsSync(functionPath) ? functionPath : null;
	}

	/**
	 * Resolves flow.functions.function_name() to the flow function file path.
	 * Flow functions are located at: flows/flow_name/functions/function_name.py
	 * The flow is determined by finding the flow_config.yaml ancestor of the current file.
	 */
	static resolveFlowFunctionPath(functionName: string, filePath: string): string | null {
		const flowDir = this.findFlowDirectory(filePath);
		if (!flowDir) {
			return null;
		}

		const functionPath = path.join(flowDir, 'functions', `${functionName}.py`);
		return fs.existsSync(functionPath) ? functionPath : null;
	}

	/**
	 * Gets all available global function names
	 */
	static getGlobalFunctionNames(filePath: string): string[] {
		const projectRoot = this.findProjectRoot(filePath);
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
	 * Flow functions are located at: flows/flow_name/functions/
	 */
	static getFlowFunctionNames(filePath: string): string[] {
		const flowDir = this.findFlowDirectory(filePath);
		if (!flowDir) {
			return [];
		}

		const functionsDir = path.join(flowDir, 'functions');
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

	/**
	 * Finds the project's config/variant_attributes.yaml, which defines {{attr:X}} targets.
	 * Walks up from the file independently of findProjectRoot, since a project can have
	 * variant_attributes.yaml without a global functions/ directory (e.g. all-flow-scoped projects).
	 */
	static findVariantAttributesPath(filePath: string): string | null {
		let currentDir = path.dirname(filePath);

		while (currentDir !== path.dirname(currentDir)) {
			const attrPath = path.join(currentDir, 'config', 'variant_attributes.yaml');
			if (fs.existsSync(attrPath)) {
				return attrPath;
			}
			currentDir = path.dirname(currentDir);
		}

		return null;
	}

	/**
	 * Finds all distinct attribute names defined under `attributes:` in config/variant_attributes.yaml.
	 * Used to validate {{attr:X}} references in YAML files.
	 */
	static findVariantAttributeNames(filePath: string): Set<string> {
		return new Set(this.buildVariantAttributeIndex(filePath).keys());
	}

	/**
	 * Builds a name -> location index for every attribute entry in config/variant_attributes.yaml,
	 * in a single read + parse. Used instead of re-reading/re-parsing the file per {{attr:X}}
	 * reference, which would otherwise repeat O(file size) work for every tag in a document.
	 *
	 * Uses a real YAML parser (source-position aware) rather than a line-based heuristic, so every
	 * valid form resolves correctly: block and flow-style sequences/maps, dash-only entries,
	 * comments, and block scalars (whose literal text can never be mistaken for structure, since
	 * the parser treats it as an opaque string rather than re-scanning it for "name:"-shaped text).
	 */
	static buildVariantAttributeIndex(
		filePath: string
	): Map<string, { filePath: string; line: number; character: number }> {
		const index = new Map<string, { filePath: string; line: number; character: number }>();
		const attrPath = this.findVariantAttributesPath(filePath);
		if (!attrPath) {
			return index;
		}

		let content: string;
		try {
			content = fs.readFileSync(attrPath, 'utf8');
		} catch {
			return index;
		}

		const lineCounter = new LineCounter();
		let doc: Document;
		try {
			doc = parseDocument(content, { lineCounter });
		} catch {
			return index;
		}

		const root = doc.contents;
		if (!isMap(root)) {
			return index;
		}

		const attributesPair = root.items.find(pair => isScalar(pair.key) && pair.key.value === 'attributes');
		const attributesNode = attributesPair?.value;
		if (!isSeq(attributesNode)) {
			return index;
		}

		for (const entry of attributesNode.items) {
			if (!isMap(entry)) {
				continue;
			}
			const namePair = entry.items.find(pair => isScalar(pair.key) && pair.key.value === 'name');
			const nameValue = namePair?.value;
			if (!isScalar(nameValue) || typeof nameValue.value !== 'string' || !nameValue.range) {
				continue;
			}
			if (index.has(nameValue.value)) {
				continue;
			}
			const pos = lineCounter.linePos(nameValue.range[0]);
			index.set(nameValue.value, { filePath: attrPath, line: pos.line - 1, character: pos.col - 1 });
		}

		return index;
	}

	/**
	 * Finds the `name: attrName` entry under `attributes:` in config/variant_attributes.yaml, for navigation.
	 * Returns the file path and 0-based line/character of the start of the attribute name.
	 */
	static resolveVariantAttributeLocation(
		attrName: string,
		filePath: string
	): { filePath: string; line: number; character: number } | null {
		return this.buildVariantAttributeIndex(filePath).get(attrName) ?? null;
	}
}
