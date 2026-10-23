import * as vscode from 'vscode';
import { PythonFunctionResolver } from './pythonFunctionResolver';

/** Matches {{fn:function_name}} (global function) and {{ft:function_name}} (flow function) references. */
const FUNCTION_TAG_PATTERN = /\{\{(fn|ft):(\w+)\}\}/g;

/** Matches {{attr:attribute_name}} references, which resolve to config/variant_attributes.yaml. */
const ATTR_TAG_PATTERN = /\{\{attr:(\w+)\}\}/g;

type FunctionTagMatch = { kind: 'fn' | 'ft'; functionName: string; range: vscode.Range };

/**
 * Finds all {{fn:X}} / {{ft:X}} references on a single line.
 */
function findFunctionTagsOnLine(lineText: string, lineNumber: number): FunctionTagMatch[] {
	const matches: FunctionTagMatch[] = [];
	FUNCTION_TAG_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = FUNCTION_TAG_PATTERN.exec(lineText)) !== null) {
		const kind = match[1] as 'fn' | 'ft';
		const functionName = match[2];
		// "{{" + kind ("fn"/"ft") + ":" always precedes the name — compute the offset
		// analytically rather than searching for the name text, which can falsely match
		// inside the prefix itself (e.g. name "n" inside "{{fn:n}}").
		const nameStart = match.index + 2 + kind.length + 1;
		matches.push({
			kind,
			functionName,
			range: new vscode.Range(
				new vscode.Position(lineNumber, nameStart),
				new vscode.Position(lineNumber, nameStart + functionName.length),
			),
		});
	}
	return matches;
}

/**
 * Resolves a {{fn:X}} / {{ft:X}} reference to its function file path.
 */
function resolveFunctionTag(kind: 'fn' | 'ft', functionName: string, filePath: string): string | null {
	return kind === 'fn'
		? PythonFunctionResolver.resolveConvFunctionPath(functionName, filePath)
		: PythonFunctionResolver.resolveFlowFunctionPath(functionName, filePath);
}

/** Finds all {{attr:X}} references on a single line. */
function findAttrTagsOnLine(lineText: string, lineNumber: number): { attrName: string; range: vscode.Range }[] {
	const matches: { attrName: string; range: vscode.Range }[] = [];
	ATTR_TAG_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = ATTR_TAG_PATTERN.exec(lineText)) !== null) {
		const attrName = match[1];
		// "{{attr:" is always 7 chars — compute the offset analytically rather than searching
		// for the name text, which can falsely match inside the prefix (e.g. name "attr" inside "{{attr:attr}}").
		const nameStart = match.index + '{{attr:'.length;
		matches.push({
			attrName,
			range: new vscode.Range(
				new vscode.Position(lineNumber, nameStart),
				new vscode.Position(lineNumber, nameStart + attrName.length),
			),
		});
	}
	return matches;
}

/**
 * Document link provider for {{fn:X}} / {{ft:X}} references in YAML files.
 * Mirrors PythonFunctionLinkProvider so Cmd/Ctrl-click navigates straight to the function file.
 */
export class YamlFunctionLinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(
		document: vscode.TextDocument,
		_token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.DocumentLink[]> {
		const links: vscode.DocumentLink[] = [];

		for (let i = 0; i < document.lineCount; i++) {
			const lineText = document.lineAt(i).text;
			if (!lineText.includes('{{fn:') && !lineText.includes('{{ft:')) {
				continue;
			}

			for (const tag of findFunctionTagsOnLine(lineText, i)) {
				const functionPath = resolveFunctionTag(tag.kind, tag.functionName, document.uri.fsPath);
				if (functionPath) {
					links.push(new vscode.DocumentLink(tag.range, vscode.Uri.file(functionPath)));
				}
			}
		}

		return links;
	}
}

/**
 * Hover provider for {{fn:X}} / {{ft:X}} references in YAML files.
 * Shows the resolved function's description and parameters, reusing the same
 * @func_description / @func_parameter extraction used for Python conv/flow.functions hovers.
 */
export class YamlFunctionHoverProvider implements vscode.HoverProvider {
	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.Hover> {
		const lineText = document.lineAt(position).text;
		if (!lineText.includes('{{fn:') && !lineText.includes('{{ft:')) {
			return undefined;
		}

		const tag = findFunctionTagsOnLine(lineText, position.line).find(
			t => position.character >= t.range.start.character && position.character <= t.range.end.character
		);
		if (!tag) {
			return undefined;
		}

		const functionPath = resolveFunctionTag(tag.kind, tag.functionName, document.uri.fsPath);
		if (!functionPath) {
			return undefined;
		}

		const description = PythonFunctionResolver.getFunctionDescription(functionPath);
		const parameters = PythonFunctionResolver.getFunctionParameters(functionPath);
		const functionType = tag.kind === 'fn' ? 'Global function' : 'Flow function';

		const hoverText = new vscode.MarkdownString();
		hoverText.appendMarkdown(`**${functionType}**: \`${tag.functionName}\``);

		if (description) {
			hoverText.appendMarkdown(`\n\n${description}`);
		}

		if (parameters.length > 0) {
			hoverText.appendMarkdown(`\n\n**Parameters:**`);
			for (const param of parameters) {
				hoverText.appendMarkdown(
					param.description ? `\n- \`${param.name}\`: ${param.description}` : `\n- \`${param.name}\``
				);
			}
		}

		hoverText.appendMarkdown(`\n\n*${functionPath}*`);

		return new vscode.Hover(hoverText, tag.range);
	}
}

/**
 * Document link provider for {{attr:X}} references in YAML files.
 * {{attr:X}} resolves to the `- name: X` entry under `attributes:` in config/variant_attributes.yaml.
 */
export class YamlAttrLinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(
		document: vscode.TextDocument,
		_token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.DocumentLink[]> {
		const links: vscode.DocumentLink[] = [];

		for (let i = 0; i < document.lineCount; i++) {
			const lineText = document.lineAt(i).text;
			if (!lineText.includes('{{attr:')) {
				continue;
			}

			for (const tag of findAttrTagsOnLine(lineText, i)) {
				const location = PythonFunctionResolver.resolveVariantAttributeLocation(tag.attrName, document.uri.fsPath);
				if (location) {
					const target = vscode.Uri.file(location.filePath).with({ fragment: `${location.line + 1}` });
					links.push(new vscode.DocumentLink(tag.range, target));
				}
			}
		}

		return links;
	}
}

/**
 * Hover provider for {{attr:X}} references in YAML files.
 * Shows where the attribute is defined in config/variant_attributes.yaml.
 */
export class YamlAttrHoverProvider implements vscode.HoverProvider {
	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.Hover> {
		const lineText = document.lineAt(position).text;
		if (!lineText.includes('{{attr:')) {
			return undefined;
		}

		const tag = findAttrTagsOnLine(lineText, position.line).find(
			t => position.character >= t.range.start.character && position.character <= t.range.end.character
		);
		if (!tag) {
			return undefined;
		}

		const location = PythonFunctionResolver.resolveVariantAttributeLocation(tag.attrName, document.uri.fsPath);
		if (!location) {
			return undefined;
		}

		const hoverText = new vscode.MarkdownString();
		hoverText.appendMarkdown(`**Variant attribute**: \`${tag.attrName}\``);
		hoverText.appendMarkdown(`\n\n*${location.filePath}:${location.line + 1}*`);

		return new vscode.Hover(hoverText, tag.range);
	}
}
