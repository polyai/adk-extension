import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Generates the webview HTML content with proper CSP
 */
export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	// Load HTML content from the extension directory
	const htmlPath = path.join(extensionUri.fsPath, 'src', 'flowViewer.html');
	let htmlContent = fs.readFileSync(htmlPath, 'utf8');

	// Replace CDN script URLs with local webview URIs for offline support
	const jointUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'joint.min.js')));
	const graphlibUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'graphlib.min.js')));
	const dagreUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'dagre.min.js')));
	const directedGraphUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'DirectedGraph.min.js')));
	const msaglCoreUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'msagl-core.min.js')));
	const msaglLayoutUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'msagl-layout.min.js')));
	htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@joint/core/dist/joint.min.js', jointUri.toString());
	htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@dagrejs/graphlib/dist/graphlib.min.js', graphlibUri.toString());
	htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@dagrejs/dagre/dist/dagre.min.js', dagreUri.toString());
	htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@joint/layout-directed-graph/dist/DirectedGraph.min.js', directedGraphUri.toString());
	htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@msagl/core/dist.min.js', msaglCoreUri.toString());
	htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@joint/layout-msagl/dist/umd/index.min.js', msaglLayoutUri.toString());
	
	// Add CSP meta tag if not present
	const cspSource = webview.cspSource;
	const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource} 'unsafe-inline' 'unsafe-eval'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} https: data:; font-src ${cspSource} https: data:;">`;
	
	// Replace existing CSP or insert new one
	if (htmlContent.includes('Content-Security-Policy')) {
		// Replace existing CSP
		htmlContent = htmlContent.replace(
			/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i,
			cspMeta
		);
	} else {
		// Insert CSP meta tag after the viewport meta tag
		htmlContent = htmlContent.replace(
			'<meta name="viewport" content="width=device-width, initial-scale=1.0">',
			`<meta name="viewport" content="width=device-width, initial-scale=1.0">\n    ${cspMeta}`
		);
	}
	
	return htmlContent;
}

/**
 * Generates an error webview HTML content
 */
export function getErrorWebviewContent(errorMessage: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Viewer - Error</title>
    <style>
        body {
            margin: 0;
            padding: 40px;
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .error-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
        }
        h1 {
            color: var(--vscode-errorForeground);
            margin-top: 0;
        }
        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>Error Loading Flow</h1>
        <p>An error occurred while parsing the flow:</p>
        <pre>${errorMessage}</pre>
        <p>Please check that:</p>
        <ul>
            <li>The flow directory contains a valid <code>flow_config.yaml</code> file</li>
            <li>Step files in the <code>steps/</code> directory are valid YAML</li>
            <li>Function files in the <code>functions/</code> directory are properly named</li>
        </ul>
    </div>
</body>
</html>`;
}

