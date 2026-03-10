import * as vscode from 'vscode';

const DEBUG_MODE_KEY = 'adk-extension.debugMode';

let extensionContext: vscode.ExtensionContext | null = null;
let debugMode: boolean = false;

/**
 * Initializes the debug utility with the extension context
 */
export function initializeDebug(context: vscode.ExtensionContext): void {
	extensionContext = context;
	debugMode = context.globalState.get<boolean>(DEBUG_MODE_KEY, false);
}

/**
 * Gets the current debug mode state
 */
export function isDebugMode(): boolean {
	return debugMode;
}

/**
 * Toggles debug mode on/off
 */
export async function toggleDebugMode(): Promise<boolean> {
	if (!extensionContext) {
		return false;
	}
	
	debugMode = !debugMode;
	await extensionContext.globalState.update(DEBUG_MODE_KEY, debugMode);
	
	const status = debugMode ? 'enabled' : 'disabled';
	vscode.window.showInformationMessage(`ADK Extension: Debug mode ${status}`);
	
	return debugMode;
}

/**
 * Debug log - only logs if debug mode is enabled
 */
export function debugLog(...args: any[]): void {
	if (debugMode) {
		console.log('[ADK Extension]', ...args);
	}
}

/**
 * Debug error - always logs errors regardless of debug mode
 */
export function debugError(...args: any[]): void {
	console.error('[ADK Extension]', ...args);
}

