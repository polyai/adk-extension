/**
 * Utility functions for working with function references in prompts
 */

/**
 * Extracts function references from a prompt string.
 * Returns a Set of function identifiers in the format "type:name" (e.g., "fn:functionName" or "ft:functionName")
 */
export function extractFunctionReferences(prompt: string): Set<string> {
	const functions = new Set<string>();
	
	// Match {{fn:function_name}} or {{fn:function_name}}('param') - global functions
	const fnRegex = /\{\{fn:(\w+)\}\}(?:\([^)]*\))?/g;
	let match;
	while ((match = fnRegex.exec(prompt)) !== null) {
		functions.add(`fn:${match[1]}`);
	}
	
	// Match {{ft:function_name}} - flow functions
	const ftRegex = /\{\{ft:(\w+)\}\}/g;
	while ((match = ftRegex.exec(prompt)) !== null) {
		functions.add(`ft:${match[1]}`);
	}
	
	return functions;
}

/**
 * Compares two sets of function references to see if they are equal.
 */
export function areFunctionSetsEqual(set1: Set<string>, set2: Set<string>): boolean {
	if (set1.size !== set2.size) {
		return false;
	}
	for (const item of set1) {
		if (!set2.has(item)) {
			return false;
		}
	}
	return true;
}

