import * as vscode from 'vscode';
import { FunctionPathResolver } from './functionPathResolver';

/**
 * vscode-dependent convenience wrappers around FunctionPathResolver, for use from
 * providers that operate on an open vscode.TextDocument (go-to-definition, hover, etc).
 * Pure path-resolution logic lives in FunctionPathResolver so it can also be used from
 * the standalone `adk-lint` CLI, which has no `vscode` module at runtime.
 */
export class PythonFunctionResolver {
	static findProjectRoot(filePath: string): string | null {
		return FunctionPathResolver.findProjectRoot(filePath);
	}

	static findFlowDirectory(filePath: string): string | null {
		return FunctionPathResolver.findFlowDirectory(filePath);
	}

	static getFlowName(filePath: string): string | null {
		return FunctionPathResolver.getFlowName(filePath);
	}

	static resolveConvFunctionPath(functionName: string, filePath: string): string | null {
		return FunctionPathResolver.resolveConvFunctionPath(functionName, filePath);
	}

	/**
	 * Resolves conv.functions.function_name() to the global function file path
	 */
	static resolveConvFunction(functionName: string, document: vscode.TextDocument): vscode.Location | null {
		const functionPath = this.resolveConvFunctionPath(functionName, document.uri.fsPath);
		if (!functionPath) {
			return null;
		}
		return new vscode.Location(vscode.Uri.file(functionPath), new vscode.Position(0, 0));
	}

	static resolveFlowFunctionPath(functionName: string, filePath: string): string | null {
		return FunctionPathResolver.resolveFlowFunctionPath(functionName, filePath);
	}

	/**
	 * Resolves flow.functions.function_name() to the flow function file path.
	 */
	static resolveFlowFunction(functionName: string, document: vscode.TextDocument): vscode.Location | null {
		const functionPath = this.resolveFlowFunctionPath(functionName, document.uri.fsPath);
		if (!functionPath) {
			return null;
		}
		return new vscode.Location(vscode.Uri.file(functionPath), new vscode.Position(0, 0));
	}

	/**
	 * Gets all available global function names
	 */
	static getGlobalFunctionNames(document: vscode.TextDocument): string[] {
		return FunctionPathResolver.getGlobalFunctionNames(document.uri.fsPath);
	}

	/**
	 * Gets all available flow function names for the current file's flow
	 */
	static getFlowFunctionNames(document: vscode.TextDocument): string[] {
		return FunctionPathResolver.getFlowFunctionNames(document.uri.fsPath);
	}

	static getFunctionDescription(filePath: string): string {
		return FunctionPathResolver.getFunctionDescription(filePath);
	}

	static getFunctionParameters(filePath: string): Array<{ name: string; description?: string }> {
		return FunctionPathResolver.getFunctionParameters(filePath);
	}

	static findVariantAttributesPath(filePath: string): string | null {
		return FunctionPathResolver.findVariantAttributesPath(filePath);
	}

	static findVariantAttributeNames(filePath: string): Set<string> {
		return FunctionPathResolver.findVariantAttributeNames(filePath);
	}

	static resolveVariantAttributeLocation(
		attrName: string,
		filePath: string
	): { filePath: string; line: number; character: number } | null {
		return FunctionPathResolver.resolveVariantAttributeLocation(attrName, filePath);
	}

	static buildVariantAttributeIndex(
		filePath: string
	): Map<string, { filePath: string; line: number; character: number }> {
		return FunctionPathResolver.buildVariantAttributeIndex(filePath);
	}
}
