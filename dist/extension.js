/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
// @ts-ignore - js-yaml types may not be available
const yaml = __importStar(__webpack_require__(4));
const flowParser_1 = __webpack_require__(29);
const webviewContent_1 = __webpack_require__(30);
const webviewHandlers_1 = __webpack_require__(31);
const pythonLanguageFeatures_1 = __webpack_require__(33);
const debug_1 = __webpack_require__(35);
const jiraUtils_1 = __webpack_require__(36);
const gitUtils_1 = __webpack_require__(38);
const githubPrUtils_1 = __webpack_require__(41);
const linter_1 = __webpack_require__(42);
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // Initialize debug utility
    (0, debug_1.initializeDebug)(context);
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    (0, debug_1.debugLog)('Extension "adk-extension" is now active!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const viewFlowDisposable = vscode.commands.registerCommand('adk-extension.viewFlow', async (uri) => {
        let flowDir;
        if (uri && uri.fsPath) {
            flowDir = uri.fsPath;
            // If a file was selected, get its directory
            if (!fs.statSync(flowDir).isDirectory()) {
                flowDir = path.dirname(flowDir);
            }
        }
        else {
            // If no URI provided, try to use the workspace folder
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                // Check if workspace root has flow_config.yaml
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                if (fs.existsSync(path.join(workspaceRoot, 'flow_config.yaml'))) {
                    flowDir = workspaceRoot;
                }
                else {
                    // Ask user to select a folder
                    const selectedFolders = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Flow Directory',
                        defaultUri: vscode.Uri.file(workspaceRoot)
                    });
                    if (!selectedFolders || selectedFolders.length === 0) {
                        return;
                    }
                    flowDir = selectedFolders[0].fsPath;
                }
            }
            else {
                // Ask user to select a folder
                const selectedFolders = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select Flow Directory'
                });
                if (!selectedFolders || selectedFolders.length === 0) {
                    return;
                }
                flowDir = selectedFolders[0].fsPath;
            }
        }
        // Validate flow directory structure
        const configPath = path.join(flowDir, 'flow_config.yaml');
        if (!fs.existsSync(configPath)) {
            vscode.window.showErrorMessage(`Flow directory must contain a flow_config.yaml file.\nSelected: ${flowDir}`, 'OK');
            return;
        }
        // Check if it's a directory
        if (!fs.statSync(flowDir).isDirectory()) {
            vscode.window.showErrorMessage(`Selected path is not a directory: ${flowDir}`);
            return;
        }
        // Get flow name from config for better title
        let flowName = path.basename(flowDir);
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = yaml.load(configContent);
            if (config && config.name) {
                flowName = config.name;
            }
        }
        catch (error) {
            // Use directory name if config parsing fails
        }
        // Create and show webview
        const panel = vscode.window.createWebviewPanel('flowViewer', `Flow Viewer: ${flowName}`, vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'src'))
            ],
            enableCommandUris: true
        });
        // Create message handler
        const messageHandler = new webviewHandlers_1.WebviewMessageHandler(panel, flowDir);
        // Set up message handler BEFORE setting HTML to avoid race condition
        panel.webview.onDidReceiveMessage(async (message) => {
            await messageHandler.handleMessage(message);
        }, undefined, context.subscriptions);
        // Get webview HTML content
        panel.webview.html = (0, webviewContent_1.getWebviewContent)(panel.webview, context.extensionUri);
        // Parse and load flow
        try {
            const parser = new flowParser_1.FlowParser(flowDir);
            const flowGraph = await parser.parseFlow();
            messageHandler.setFlowGraphData(flowGraph);
            // Log for debugging
            console.log('Parsed flow graph:', {
                nodeCount: flowGraph.nodes.length,
                edgeCount: flowGraph.edges.length,
                nodes: flowGraph.nodes.map(n => ({ id: n.id, label: n.label, type: n.type })),
                edges: flowGraph.edges.map(e => ({ from: e.from, to: e.to, label: e.label }))
            });
            // Send flow data to webview immediately if it's already ready
            panel.webview.postMessage({
                command: 'loadFlow',
                flowGraph: flowGraph
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error parsing flow: ${errorMessage}`, 'OK');
            console.error('Flow parsing error:', error);
            // Show error in webview
            panel.webview.html = (0, webviewContent_1.getErrorWebviewContent)(errorMessage);
        }
    });
    // Toggle debug mode command
    const toggleDebugDisposable = vscode.commands.registerCommand('adk-extension.toggleDebugMode', async () => {
        await (0, debug_1.toggleDebugMode)();
    });
    // Create JIRA ticket from branch commands
    const createJiraTicketDisposable = vscode.commands.registerCommand('adk-extension.createJiraTicket', async () => {
        await createJiraTicketFromBranch(context);
    });
    const clearJiraMappingsDisposable = vscode.commands.registerCommand('adk-extension.clearJiraMappings', async () => {
        await clearJiraMappings(context);
    });
    // Register Python language features for function resolution
    (0, debug_1.debugLog)('Registering Python language features...');
    const pythonDefinitionProvider = vscode.languages.registerDefinitionProvider({ language: 'python', scheme: 'file' }, new pythonLanguageFeatures_1.PythonDefinitionProvider());
    const pythonHoverProvider = vscode.languages.registerHoverProvider({ language: 'python', scheme: 'file' }, new pythonLanguageFeatures_1.PythonHoverProvider());
    const pythonReferencesProvider = vscode.languages.registerReferenceProvider({ language: 'python', scheme: 'file' }, new pythonLanguageFeatures_1.PythonReferencesProvider());
    (0, debug_1.debugLog)('Python language features registered');
    // Initialize and activate the Agent Studio Linter
    (0, debug_1.debugLog)('Activating Agent Studio Linter...');
    const linter = new linter_1.AgentStudioLinter();
    linter.activate(context);
    (0, debug_1.debugLog)('Agent Studio Linter activated');
    context.subscriptions.push(viewFlowDisposable, toggleDebugDisposable, createJiraTicketDisposable, clearJiraMappingsDisposable, pythonDefinitionProvider, pythonHoverProvider, pythonReferencesProvider);
}
/**
 * Gets the stored project/component mapping for a project directory
 */
function getProjectComponentMapping(context, projectDir) {
    const mappings = context.workspaceState.get('jiraProjectMappings', {});
    return mappings[projectDir] || null;
}
/**
 * Stores the project/component mapping for a project directory
 */
async function setProjectComponentMapping(context, projectDir, project, component) {
    const mappings = context.workspaceState.get('jiraProjectMappings', {});
    mappings[projectDir] = { project, component };
    await context.workspaceState.update('jiraProjectMappings', mappings);
}
/**
 * Clears all stored JIRA project/component mappings for this workspace
 */
async function clearJiraMappings(context) {
    await context.workspaceState.update('jiraProjectMappings', {});
    vscode.window.showInformationMessage('JIRA project mappings cleared. You will be prompted to select project/component on the next ticket creation.');
}
/**
 * Creates a JIRA ticket from the current branch changes
 */
async function createJiraTicketFromBranch(context) {
    try {
        // Get workspace root
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating JIRA Ticket',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Getting branch information...' });
            // Get current branch
            const branch = await (0, gitUtils_1.getCurrentBranch)(workspaceRoot);
            (0, debug_1.debugLog)(`Current branch: ${branch}`);
            progress.report({ increment: 20, message: 'Getting changed files...' });
            // Get changed files
            const changedFiles = await (0, gitUtils_1.getChangedFiles)(workspaceRoot, branch);
            (0, debug_1.debugLog)(`Changed files: ${changedFiles.length}`);
            if (changedFiles.length === 0) {
                vscode.window.showWarningMessage('No changes found in current branch');
                return;
            }
            // Determine project directory
            const dirInfo = (0, gitUtils_1.getProjectDirectory)(changedFiles, workspaceRoot);
            // Use project directory for caching (more specific), fallback to account directory
            const projectDir = dirInfo.projectDir || dirInfo.accountDir;
            (0, debug_1.debugLog)(`Account directory: ${dirInfo.accountDir || 'none'}, Project directory: ${dirInfo.projectDir || 'none'}`);
            progress.report({ increment: 30, message: 'Getting branch diff...' });
            // Get diff
            const diff = await (0, gitUtils_1.getBranchDiff)(workspaceRoot, branch);
            (0, debug_1.debugLog)(`Diff length: ${diff.length}`);
            // Get or prompt for project and component
            let project;
            let component;
            if (projectDir) {
                // Check if we have a cached mapping
                const mapping = getProjectComponentMapping(context, projectDir);
                if (mapping) {
                    project = mapping.project;
                    component = mapping.component;
                    (0, debug_1.debugLog)(`Using cached mapping for ${projectDir}: project=${project}, component=${component}`);
                }
                else {
                    // Build a descriptive prompt showing account/project info with project name
                    let placeHolderText = '';
                    if (dirInfo.projectDir) {
                        const [accountDir, projDir] = dirInfo.projectDir.split('/');
                        // Try to get project name from project.yaml
                        const projectName = (0, gitUtils_1.getProjectName)(workspaceRoot, accountDir, projDir);
                        if (projectName) {
                            placeHolderText = `Select project for "${projectName}" (${accountDir}/${projDir})`;
                        }
                        else {
                            placeHolderText = `Select project for "${accountDir}/${projDir}"`;
                        }
                    }
                    else if (dirInfo.accountDir) {
                        placeHolderText = `Select project for "${dirInfo.accountDir}"`;
                    }
                    else {
                        placeHolderText = 'Select JIRA project';
                    }
                    progress.report({ increment: 40, message: 'Fetching JIRA projects...' });
                    // Fetch projects from JIRA
                    let projects;
                    try {
                        projects = await (0, jiraUtils_1.getJiraProjects)();
                    }
                    catch (error) {
                        (0, debug_1.debugLog)(`Failed to fetch JIRA projects: ${error}`);
                        // Fallback to input box if API call fails
                        project = await vscode.window.showInputBox({
                            prompt: 'Enter JIRA project key',
                            placeHolder: 'e.g., PROJ',
                            validateInput: (value) => {
                                if (!value || value.trim().length === 0) {
                                    return 'Project key is required';
                                }
                                return null;
                            }
                        }) || '';
                        if (!project) {
                            return; // User cancelled
                        }
                        // Set component to undefined if we used fallback
                        component = undefined;
                    }
                    if (projects && projects.length > 0) {
                        // Show dropdown for project selection
                        const projectItems = projects.map(p => ({
                            label: p.key,
                            description: p.name,
                            detail: `Project: ${p.name}`,
                            value: p.key
                        }));
                        const selectedProject = await vscode.window.showQuickPick(projectItems, {
                            placeHolder: placeHolderText,
                            canPickMany: false
                        });
                        if (!selectedProject) {
                            return; // User cancelled
                        }
                        project = selectedProject.value;
                        // Fetch components for the selected project
                        progress.report({ increment: 45, message: 'Fetching components...' });
                        let components = [];
                        try {
                            components = await (0, jiraUtils_1.getJiraComponents)(project);
                        }
                        catch (error) {
                            (0, debug_1.debugLog)(`Failed to fetch JIRA components: ${error}`);
                        }
                        if (components && components.length > 0) {
                            // Show dropdown for component selection
                            const componentItems = [
                                { label: 'None', description: 'No component', value: undefined },
                                ...components.map(c => ({
                                    label: c.name,
                                    description: `Component: ${c.name}`,
                                    value: c.name
                                }))
                            ];
                            const selectedComponent = await vscode.window.showQuickPick(componentItems, {
                                placeHolder: 'Select component (optional)',
                                canPickMany: false
                            });
                            if (selectedComponent) {
                                component = selectedComponent.value;
                            }
                        }
                        else {
                            // No components available, skip component selection
                            component = undefined;
                        }
                        // Store the mapping for future use (using projectDir which is more specific)
                        if (project) {
                            await setProjectComponentMapping(context, projectDir, project, component);
                        }
                    }
                    else if (!project) {
                        // No projects found and no fallback was used
                        vscode.window.showErrorMessage('No JIRA projects found and unable to enter project key manually');
                        return;
                    }
                }
            }
            else {
                // No specific project directory, ask user
                progress.report({ increment: 40, message: 'Fetching JIRA projects...' });
                // Fetch projects from JIRA
                let projects;
                try {
                    projects = await (0, jiraUtils_1.getJiraProjects)();
                }
                catch (error) {
                    (0, debug_1.debugLog)(`Failed to fetch JIRA projects: ${error}`);
                    // Fallback to input box if API call fails
                    project = await vscode.window.showInputBox({
                        prompt: 'Enter JIRA project key',
                        placeHolder: 'e.g., PROJ',
                        validateInput: (value) => {
                            if (!value || value.trim().length === 0) {
                                return 'Project key is required';
                            }
                            return null;
                        }
                    }) || '';
                    if (!project) {
                        return; // User cancelled
                    }
                    // Set component to undefined if we used fallback
                    component = undefined;
                }
                if (projects && projects.length > 0) {
                    // Show dropdown for project selection
                    const projectItems = projects.map(p => ({
                        label: p.key,
                        description: p.name,
                        detail: `Project: ${p.name}`,
                        value: p.key
                    }));
                    const selectedProject = await vscode.window.showQuickPick(projectItems, {
                        placeHolder: 'Select JIRA project',
                        canPickMany: false
                    });
                    if (!selectedProject) {
                        return; // User cancelled
                    }
                    project = selectedProject.value;
                    // Fetch components for the selected project
                    progress.report({ increment: 45, message: 'Fetching components...' });
                    let components = [];
                    try {
                        components = await (0, jiraUtils_1.getJiraComponents)(project);
                    }
                    catch (error) {
                        (0, debug_1.debugLog)(`Failed to fetch JIRA components: ${error}`);
                    }
                    if (components && components.length > 0) {
                        // Show dropdown for component selection
                        const componentItems = [
                            { label: 'None', description: 'No component', value: undefined },
                            ...components.map(c => ({
                                label: c.name,
                                description: `Component: ${c.name}`,
                                value: c.name
                            }))
                        ];
                        const selectedComponent = await vscode.window.showQuickPick(componentItems, {
                            placeHolder: 'Select component (optional)',
                            canPickMany: false
                        });
                        if (selectedComponent) {
                            component = selectedComponent.value;
                        }
                    }
                    else {
                        // No components available, skip component selection
                        component = undefined;
                    }
                }
                else if (!project) {
                    // No projects found and no fallback was used
                    vscode.window.showErrorMessage('No JIRA projects found and unable to enter project key manually');
                    return;
                }
            }
            // Ensure project is set before creating ticket
            if (!project) {
                vscode.window.showErrorMessage('Project key is required');
                return;
            }
            progress.report({ increment: 50, message: 'Creating JIRA ticket...' });
            // Create summary and description
            const summary = (0, gitUtils_1.createSummaryFromBranch)(branch, changedFiles);
            // Keep description concise - only show changed files, no diff
            const maxFilesToShow = 50;
            const filesList = changedFiles.slice(0, maxFilesToShow).map(f => `- ${f}`).join('\n');
            const filesSummary = changedFiles.length > maxFilesToShow
                ? `${filesList}\n... and ${changedFiles.length - maxFilesToShow} more files (${changedFiles.length} total)`
                : filesList;
            const description = `Branch: ${branch}\n\nChanged files (${changedFiles.length}):\n${filesSummary}`;
            // Create JIRA ticket
            const ticket = await (0, jiraUtils_1.createJiraTicket)(summary, description, project, component);
            const ticketUrl = (0, jiraUtils_1.getJiraTicketUrl)(ticket.key);
            (0, debug_1.debugLog)(`Created JIRA ticket: ${ticket.key}`);
            progress.report({ increment: 80, message: 'Updating PR description...' });
            // Try to find and update PR
            try {
                const repoInfo = await (0, githubPrUtils_1.getGitHubRepo)(workspaceRoot);
                if (repoInfo) {
                    const pr = await (0, githubPrUtils_1.findPRForBranch)(repoInfo.owner, repoInfo.repo, branch);
                    if (pr) {
                        await (0, githubPrUtils_1.updatePRDescription)(repoInfo.owner, repoInfo.repo, pr.number, ticketUrl, ticket.key);
                        (0, debug_1.debugLog)(`Updated PR #${pr.number} with JIRA ticket`);
                        vscode.window.showInformationMessage(`JIRA ticket ${ticket.key} created and added to PR #${pr.number}`, 'Open Ticket', 'Open PR').then(action => {
                            if (action === 'Open Ticket') {
                                vscode.env.openExternal(vscode.Uri.parse(ticketUrl));
                            }
                            else if (action === 'Open PR') {
                                vscode.env.openExternal(vscode.Uri.parse(pr.html_url));
                            }
                        });
                    }
                    else {
                        // No PR found
                        vscode.window.showInformationMessage(`JIRA ticket ${ticket.key} created (no PR found for this branch)`, 'Open Ticket').then(action => {
                            if (action === 'Open Ticket') {
                                vscode.env.openExternal(vscode.Uri.parse(ticketUrl));
                            }
                        });
                    }
                }
                else {
                    // Could not determine GitHub repo
                    vscode.window.showInformationMessage(`JIRA ticket ${ticket.key} created`, 'Open Ticket').then(action => {
                        if (action === 'Open Ticket') {
                            vscode.env.openExternal(vscode.Uri.parse(ticketUrl));
                        }
                    });
                }
            }
            catch (error) {
                // PR update failed, but ticket was created
                (0, debug_1.debugLog)(`Failed to update PR: ${error}`);
                vscode.window.showInformationMessage(`JIRA ticket ${ticket.key} created (failed to update PR)`, 'Open Ticket').then(action => {
                    if (action === 'Open Ticket') {
                        vscode.env.openExternal(vscode.Uri.parse(ticketUrl));
                    }
                });
            }
            progress.report({ increment: 100, message: 'Complete!' });
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to create JIRA ticket: ${errorMessage}`);
        (0, debug_1.debugLog)(`Error creating JIRA ticket: ${error}`);
    }
}
// This method is called when your extension is deactivated
function deactivate() { }


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 4 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {




var loader = __webpack_require__(5);
var dumper = __webpack_require__(28);


function renamed(from, to) {
  return function () {
    throw new Error('Function yaml.' + from + ' is removed in js-yaml 4. ' +
      'Use yaml.' + to + ' instead, which is now safe by default.');
  };
}


module.exports.Type = __webpack_require__(14);
module.exports.Schema = __webpack_require__(13);
module.exports.FAILSAFE_SCHEMA = __webpack_require__(12);
module.exports.JSON_SCHEMA = __webpack_require__(11);
module.exports.CORE_SCHEMA = __webpack_require__(10);
module.exports.DEFAULT_SCHEMA = __webpack_require__(9);
module.exports.load                = loader.load;
module.exports.loadAll             = loader.loadAll;
module.exports.dump                = dumper.dump;
module.exports.YAMLException = __webpack_require__(7);

// Re-export all types in case user wants to create custom schema
module.exports.types = {
  binary:    __webpack_require__(24),
  float:     __webpack_require__(21),
  map:       __webpack_require__(17),
  null:      __webpack_require__(18),
  pairs:     __webpack_require__(26),
  set:       __webpack_require__(27),
  timestamp: __webpack_require__(22),
  bool:      __webpack_require__(19),
  int:       __webpack_require__(20),
  merge:     __webpack_require__(23),
  omap:      __webpack_require__(25),
  seq:       __webpack_require__(16),
  str:       __webpack_require__(15)
};

// Removed functions from JS-YAML 3.0.x
module.exports.safeLoad            = renamed('safeLoad', 'load');
module.exports.safeLoadAll         = renamed('safeLoadAll', 'loadAll');
module.exports.safeDump            = renamed('safeDump', 'dump');


/***/ }),
/* 5 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



/*eslint-disable max-len,no-use-before-define*/

var common              = __webpack_require__(6);
var YAMLException       = __webpack_require__(7);
var makeSnippet         = __webpack_require__(8);
var DEFAULT_SCHEMA      = __webpack_require__(9);


var _hasOwnProperty = Object.prototype.hasOwnProperty;


var CONTEXT_FLOW_IN   = 1;
var CONTEXT_FLOW_OUT  = 2;
var CONTEXT_BLOCK_IN  = 3;
var CONTEXT_BLOCK_OUT = 4;


var CHOMPING_CLIP  = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP  = 3;


var PATTERN_NON_PRINTABLE         = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS       = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE            = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI               = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;


function _class(obj) { return Object.prototype.toString.call(obj); }

function is_EOL(c) {
  return (c === 0x0A/* LF */) || (c === 0x0D/* CR */);
}

function is_WHITE_SPACE(c) {
  return (c === 0x09/* Tab */) || (c === 0x20/* Space */);
}

function is_WS_OR_EOL(c) {
  return (c === 0x09/* Tab */) ||
         (c === 0x20/* Space */) ||
         (c === 0x0A/* LF */) ||
         (c === 0x0D/* CR */);
}

function is_FLOW_INDICATOR(c) {
  return c === 0x2C/* , */ ||
         c === 0x5B/* [ */ ||
         c === 0x5D/* ] */ ||
         c === 0x7B/* { */ ||
         c === 0x7D/* } */;
}

function fromHexCode(c) {
  var lc;

  if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
    return c - 0x30;
  }

  /*eslint-disable no-bitwise*/
  lc = c | 0x20;

  if ((0x61/* a */ <= lc) && (lc <= 0x66/* f */)) {
    return lc - 0x61 + 10;
  }

  return -1;
}

function escapedHexLen(c) {
  if (c === 0x78/* x */) { return 2; }
  if (c === 0x75/* u */) { return 4; }
  if (c === 0x55/* U */) { return 8; }
  return 0;
}

function fromDecimalCode(c) {
  if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
    return c - 0x30;
  }

  return -1;
}

function simpleEscapeSequence(c) {
  /* eslint-disable indent */
  return (c === 0x30/* 0 */) ? '\x00' :
        (c === 0x61/* a */) ? '\x07' :
        (c === 0x62/* b */) ? '\x08' :
        (c === 0x74/* t */) ? '\x09' :
        (c === 0x09/* Tab */) ? '\x09' :
        (c === 0x6E/* n */) ? '\x0A' :
        (c === 0x76/* v */) ? '\x0B' :
        (c === 0x66/* f */) ? '\x0C' :
        (c === 0x72/* r */) ? '\x0D' :
        (c === 0x65/* e */) ? '\x1B' :
        (c === 0x20/* Space */) ? ' ' :
        (c === 0x22/* " */) ? '\x22' :
        (c === 0x2F/* / */) ? '/' :
        (c === 0x5C/* \ */) ? '\x5C' :
        (c === 0x4E/* N */) ? '\x85' :
        (c === 0x5F/* _ */) ? '\xA0' :
        (c === 0x4C/* L */) ? '\u2028' :
        (c === 0x50/* P */) ? '\u2029' : '';
}

function charFromCodepoint(c) {
  if (c <= 0xFFFF) {
    return String.fromCharCode(c);
  }
  // Encode UTF-16 surrogate pair
  // https://en.wikipedia.org/wiki/UTF-16#Code_points_U.2B010000_to_U.2B10FFFF
  return String.fromCharCode(
    ((c - 0x010000) >> 10) + 0xD800,
    ((c - 0x010000) & 0x03FF) + 0xDC00
  );
}

// set a property of a literal object, while protecting against prototype pollution,
// see https://github.com/nodeca/js-yaml/issues/164 for more details
function setProperty(object, key, value) {
  // used for this specific key only because Object.defineProperty is slow
  if (key === '__proto__') {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: value
    });
  } else {
    object[key] = value;
  }
}

var simpleEscapeCheck = new Array(256); // integer, for fast access
var simpleEscapeMap = new Array(256);
for (var i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}


function State(input, options) {
  this.input = input;

  this.filename  = options['filename']  || null;
  this.schema    = options['schema']    || DEFAULT_SCHEMA;
  this.onWarning = options['onWarning'] || null;
  // (Hidden) Remove? makes the loader to expect YAML 1.1 documents
  // if such documents have no explicit %YAML directive
  this.legacy    = options['legacy']    || false;

  this.json      = options['json']      || false;
  this.listener  = options['listener']  || null;

  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap       = this.schema.compiledTypeMap;

  this.length     = input.length;
  this.position   = 0;
  this.line       = 0;
  this.lineStart  = 0;
  this.lineIndent = 0;

  // position of first leading tab in the current line,
  // used to make sure there are no tabs in the indentation
  this.firstTabInLine = -1;

  this.documents = [];

  /*
  this.version;
  this.checkLineBreaks;
  this.tagMap;
  this.anchorMap;
  this.tag;
  this.anchor;
  this.kind;
  this.result;*/

}


function generateError(state, message) {
  var mark = {
    name:     state.filename,
    buffer:   state.input.slice(0, -1), // omit trailing \0
    position: state.position,
    line:     state.line,
    column:   state.position - state.lineStart
  };

  mark.snippet = makeSnippet(mark);

  return new YAMLException(message, mark);
}

function throwError(state, message) {
  throw generateError(state, message);
}

function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}


var directiveHandlers = {

  YAML: function handleYamlDirective(state, name, args) {

    var match, major, minor;

    if (state.version !== null) {
      throwError(state, 'duplication of %YAML directive');
    }

    if (args.length !== 1) {
      throwError(state, 'YAML directive accepts exactly one argument');
    }

    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);

    if (match === null) {
      throwError(state, 'ill-formed argument of the YAML directive');
    }

    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);

    if (major !== 1) {
      throwError(state, 'unacceptable YAML version of the document');
    }

    state.version = args[0];
    state.checkLineBreaks = (minor < 2);

    if (minor !== 1 && minor !== 2) {
      throwWarning(state, 'unsupported YAML version of the document');
    }
  },

  TAG: function handleTagDirective(state, name, args) {

    var handle, prefix;

    if (args.length !== 2) {
      throwError(state, 'TAG directive accepts exactly two arguments');
    }

    handle = args[0];
    prefix = args[1];

    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, 'ill-formed tag handle (first argument) of the TAG directive');
    }

    if (_hasOwnProperty.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }

    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, 'ill-formed tag prefix (second argument) of the TAG directive');
    }

    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, 'tag prefix is malformed: ' + prefix);
    }

    state.tagMap[handle] = prefix;
  }
};


function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;

  if (start < end) {
    _result = state.input.slice(start, end);

    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 0x09 ||
              (0x20 <= _character && _character <= 0x10FFFF))) {
          throwError(state, 'expected valid JSON character');
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, 'the stream contains non-printable characters');
    }

    state.result += _result;
  }
}

function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;

  if (!common.isObject(source)) {
    throwError(state, 'cannot merge mappings; the provided source object is unacceptable');
  }

  sourceKeys = Object.keys(source);

  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key = sourceKeys[index];

    if (!_hasOwnProperty.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}

function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode,
  startLine, startLineStart, startPos) {

  var index, quantity;

  // The output is a plain object here, so keys can only be strings.
  // We need to convert keyNode to a string, but doing so can hang the process
  // (deeply nested arrays that explode exponentially using aliases).
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);

    for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, 'nested arrays are not supported inside keys');
      }

      if (typeof keyNode === 'object' && _class(keyNode[index]) === '[object Object]') {
        keyNode[index] = '[object Object]';
      }
    }
  }

  // Avoid code execution in load() via toString property
  // (still use its own toString for arrays, timestamps,
  // and whatever user schema extensions happen to have @@toStringTag)
  if (typeof keyNode === 'object' && _class(keyNode) === '[object Object]') {
    keyNode = '[object Object]';
  }


  keyNode = String(keyNode);

  if (_result === null) {
    _result = {};
  }

  if (keyTag === 'tag:yaml.org,2002:merge') {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json &&
        !_hasOwnProperty.call(overridableKeys, keyNode) &&
        _hasOwnProperty.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, 'duplicated mapping key');
    }

    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }

  return _result;
}

function readLineBreak(state) {
  var ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x0A/* LF */) {
    state.position++;
  } else if (ch === 0x0D/* CR */) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 0x0A/* LF */) {
      state.position++;
    }
  } else {
    throwError(state, 'a line break is expected');
  }

  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}

function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0,
      ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 0x09/* Tab */ && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }

    if (allowComments && ch === 0x23/* # */) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0x0A/* LF */ && ch !== 0x0D/* CR */ && ch !== 0);
    }

    if (is_EOL(ch)) {
      readLineBreak(state);

      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;

      while (ch === 0x20/* Space */) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }

  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, 'deficient indentation');
  }

  return lineBreaks;
}

function testDocumentSeparator(state) {
  var _position = state.position,
      ch;

  ch = state.input.charCodeAt(_position);

  // Condition state.position === state.lineStart is tested
  // in parent on each call, for efficiency. No needs to test here again.
  if ((ch === 0x2D/* - */ || ch === 0x2E/* . */) &&
      ch === state.input.charCodeAt(_position + 1) &&
      ch === state.input.charCodeAt(_position + 2)) {

    _position += 3;

    ch = state.input.charCodeAt(_position);

    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }

  return false;
}

function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += ' ';
  } else if (count > 1) {
    state.result += common.repeat('\n', count - 1);
  }
}


function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding,
      following,
      captureStart,
      captureEnd,
      hasPendingContent,
      _line,
      _lineStart,
      _lineIndent,
      _kind = state.kind,
      _result = state.result,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (is_WS_OR_EOL(ch)      ||
      is_FLOW_INDICATOR(ch) ||
      ch === 0x23/* # */    ||
      ch === 0x26/* & */    ||
      ch === 0x2A/* * */    ||
      ch === 0x21/* ! */    ||
      ch === 0x7C/* | */    ||
      ch === 0x3E/* > */    ||
      ch === 0x27/* ' */    ||
      ch === 0x22/* " */    ||
      ch === 0x25/* % */    ||
      ch === 0x40/* @ */    ||
      ch === 0x60/* ` */) {
    return false;
  }

  if (ch === 0x3F/* ? */ || ch === 0x2D/* - */) {
    following = state.input.charCodeAt(state.position + 1);

    if (is_WS_OR_EOL(following) ||
        withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }

  state.kind = 'scalar';
  state.result = '';
  captureStart = captureEnd = state.position;
  hasPendingContent = false;

  while (ch !== 0) {
    if (ch === 0x3A/* : */) {
      following = state.input.charCodeAt(state.position + 1);

      if (is_WS_OR_EOL(following) ||
          withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }

    } else if (ch === 0x23/* # */) {
      preceding = state.input.charCodeAt(state.position - 1);

      if (is_WS_OR_EOL(preceding)) {
        break;
      }

    } else if ((state.position === state.lineStart && testDocumentSeparator(state)) ||
               withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;

    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);

      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }

    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }

    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }

    ch = state.input.charCodeAt(++state.position);
  }

  captureSegment(state, captureStart, captureEnd, false);

  if (state.result) {
    return true;
  }

  state.kind = _kind;
  state.result = _result;
  return false;
}

function readSingleQuotedScalar(state, nodeIndent) {
  var ch,
      captureStart, captureEnd;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x27/* ' */) {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x27/* ' */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (ch === 0x27/* ' */) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }

    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;

    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a single quoted scalar');

    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  throwError(state, 'unexpected end of the stream within a single quoted scalar');
}

function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart,
      captureEnd,
      hexLength,
      hexResult,
      tmp,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x22/* " */) {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x22/* " */) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;

    } else if (ch === 0x5C/* \ */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);

        // TODO: rework to inline fn with no type cast?
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;

      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;

        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);

          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;

          } else {
            throwError(state, 'expected hexadecimal character');
          }
        }

        state.result += charFromCodepoint(hexResult);

        state.position++;

      } else {
        throwError(state, 'unknown escape sequence');
      }

      captureStart = captureEnd = state.position;

    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;

    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a double quoted scalar');

    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  throwError(state, 'unexpected end of the stream within a double quoted scalar');
}

function readFlowCollection(state, nodeIndent) {
  var readNext = true,
      _line,
      _lineStart,
      _pos,
      _tag     = state.tag,
      _result,
      _anchor  = state.anchor,
      following,
      terminator,
      isPair,
      isExplicitPair,
      isMapping,
      overridableKeys = Object.create(null),
      keyNode,
      keyTag,
      valueNode,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x5B/* [ */) {
    terminator = 0x5D;/* ] */
    isMapping = false;
    _result = [];
  } else if (ch === 0x7B/* { */) {
    terminator = 0x7D;/* } */
    isMapping = true;
    _result = {};
  } else {
    return false;
  }

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(++state.position);

  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? 'mapping' : 'sequence';
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, 'missed comma between flow collection entries');
    } else if (ch === 0x2C/* , */) {
      // "flow collection entries can never be completely empty", as per YAML 1.2, section 7.4
      throwError(state, "expected the node content, but found ','");
    }

    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;

    if (ch === 0x3F/* ? */) {
      following = state.input.charCodeAt(state.position + 1);

      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }

    _line = state.line; // Save the current line.
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if ((isExplicitPair || state.line === _line) && ch === 0x3A/* : */) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }

    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }

    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === 0x2C/* , */) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }

  throwError(state, 'unexpected end of the stream within a flow collection');
}

function readBlockScalar(state, nodeIndent) {
  var captureStart,
      folding,
      chomping       = CHOMPING_CLIP,
      didReadContent = false,
      detectedIndent = false,
      textIndent     = nodeIndent,
      emptyLines     = 0,
      atMoreIndented = false,
      tmp,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x7C/* | */) {
    folding = false;
  } else if (ch === 0x3E/* > */) {
    folding = true;
  } else {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';

  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);

    if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
      if (CHOMPING_CLIP === chomping) {
        chomping = (ch === 0x2B/* + */) ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, 'repeat of a chomping mode identifier');
      }

    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, 'bad explicit indentation width of a block scalar; it cannot be less than one');
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, 'repeat of an indentation width identifier');
      }

    } else {
      break;
    }
  }

  if (is_WHITE_SPACE(ch)) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (is_WHITE_SPACE(ch));

    if (ch === 0x23/* # */) {
      do { ch = state.input.charCodeAt(++state.position); }
      while (!is_EOL(ch) && (ch !== 0));
    }
  }

  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;

    ch = state.input.charCodeAt(state.position);

    while ((!detectedIndent || state.lineIndent < textIndent) &&
           (ch === 0x20/* Space */)) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }

    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }

    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }

    // End of the scalar.
    if (state.lineIndent < textIndent) {

      // Perform the chomping.
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) { // i.e. only if the scalar is not empty.
          state.result += '\n';
        }
      }

      // Break this `while` cycle and go to the funciton's epilogue.
      break;
    }

    // Folded style: use fancy rules to handle line breaks.
    if (folding) {

      // Lines starting with white space characters (more-indented lines) are not folded.
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        // except for the first content line (cf. Example 8.1)
        state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);

      // End of more-indented block.
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat('\n', emptyLines + 1);

      // Just one line break - perceive as the same line.
      } else if (emptyLines === 0) {
        if (didReadContent) { // i.e. only if we have already read some scalar content.
          state.result += ' ';
        }

      // Several line breaks - perceive as different lines.
      } else {
        state.result += common.repeat('\n', emptyLines);
      }

    // Literal style: just add exact number of line breaks between content lines.
    } else {
      // Keep all line breaks except the header line break.
      state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
    }

    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;

    while (!is_EOL(ch) && (ch !== 0)) {
      ch = state.input.charCodeAt(++state.position);
    }

    captureSegment(state, captureStart, state.position, false);
  }

  return true;
}

function readBlockSequence(state, nodeIndent) {
  var _line,
      _tag      = state.tag,
      _anchor   = state.anchor,
      _result   = [],
      following,
      detected  = false,
      ch;

  // there is a leading tab before this token, so it can't be a block sequence/mapping;
  // it can still be flow sequence/mapping or a scalar
  if (state.firstTabInLine !== -1) return false;

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, 'tab characters must not be used in indentation');
    }

    if (ch !== 0x2D/* - */) {
      break;
    }

    following = state.input.charCodeAt(state.position + 1);

    if (!is_WS_OR_EOL(following)) {
      break;
    }

    detected = true;
    state.position++;

    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }

    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
      throwError(state, 'bad indentation of a sequence entry');
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'sequence';
    state.result = _result;
    return true;
  }
  return false;
}

function readBlockMapping(state, nodeIndent, flowIndent) {
  var following,
      allowCompact,
      _line,
      _keyLine,
      _keyLineStart,
      _keyPos,
      _tag          = state.tag,
      _anchor       = state.anchor,
      _result       = {},
      overridableKeys = Object.create(null),
      keyTag        = null,
      keyNode       = null,
      valueNode     = null,
      atExplicitKey = false,
      detected      = false,
      ch;

  // there is a leading tab before this token, so it can't be a block sequence/mapping;
  // it can still be flow sequence/mapping or a scalar
  if (state.firstTabInLine !== -1) return false;

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, 'tab characters must not be used in indentation');
    }

    following = state.input.charCodeAt(state.position + 1);
    _line = state.line; // Save the current line.

    //
    // Explicit notation case. There are two separate blocks:
    // first for the key (denoted by "?") and second for the value (denoted by ":")
    //
    if ((ch === 0x3F/* ? */ || ch === 0x3A/* : */) && is_WS_OR_EOL(following)) {

      if (ch === 0x3F/* ? */) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }

        detected = true;
        atExplicitKey = true;
        allowCompact = true;

      } else if (atExplicitKey) {
        // i.e. 0x3A/* : */ === character after the explicit key.
        atExplicitKey = false;
        allowCompact = true;

      } else {
        throwError(state, 'incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line');
      }

      state.position += 1;
      ch = following;

    //
    // Implicit notation case. Flow-style node as the key first, then ":", and the value.
    //
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;

      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        // Neither implicit nor explicit notation.
        // Reading is done. Go to the epilogue.
        break;
      }

      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);

        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }

        if (ch === 0x3A/* : */) {
          ch = state.input.charCodeAt(++state.position);

          if (!is_WS_OR_EOL(ch)) {
            throwError(state, 'a whitespace character is expected after the key-value separator within a block mapping');
          }

          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }

          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;

        } else if (detected) {
          throwError(state, 'can not read an implicit mapping pair; a colon is missed');

        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true; // Keep the result of `composeNode`.
        }

      } else if (detected) {
        throwError(state, 'can not read a block mapping entry; a multiline key may not be an implicit key');

      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true; // Keep the result of `composeNode`.
      }
    }

    //
    // Common reading code for both explicit and implicit notations.
    //
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }

      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }

      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }

      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }

    if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
      throwError(state, 'bad indentation of a mapping entry');
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  //
  // Epilogue.
  //

  // Special case: last mapping's node contains only the key in explicit notation.
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }

  // Expose the resulting mapping.
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'mapping';
    state.result = _result;
  }

  return detected;
}

function readTagProperty(state) {
  var _position,
      isVerbatim = false,
      isNamed    = false,
      tagHandle,
      tagName,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x21/* ! */) return false;

  if (state.tag !== null) {
    throwError(state, 'duplication of a tag property');
  }

  ch = state.input.charCodeAt(++state.position);

  if (ch === 0x3C/* < */) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);

  } else if (ch === 0x21/* ! */) {
    isNamed = true;
    tagHandle = '!!';
    ch = state.input.charCodeAt(++state.position);

  } else {
    tagHandle = '!';
  }

  _position = state.position;

  if (isVerbatim) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (ch !== 0 && ch !== 0x3E/* > */);

    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, 'unexpected end of the stream within a verbatim tag');
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {

      if (ch === 0x21/* ! */) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);

          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, 'named tag handle cannot contain such characters');
          }

          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, 'tag suffix cannot contain exclamation marks');
        }
      }

      ch = state.input.charCodeAt(++state.position);
    }

    tagName = state.input.slice(_position, state.position);

    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, 'tag suffix cannot contain flow indicator characters');
    }
  }

  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, 'tag name cannot contain such characters: ' + tagName);
  }

  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, 'tag name is malformed: ' + tagName);
  }

  if (isVerbatim) {
    state.tag = tagName;

  } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;

  } else if (tagHandle === '!') {
    state.tag = '!' + tagName;

  } else if (tagHandle === '!!') {
    state.tag = 'tag:yaml.org,2002:' + tagName;

  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }

  return true;
}

function readAnchorProperty(state) {
  var _position,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x26/* & */) return false;

  if (state.anchor !== null) {
    throwError(state, 'duplication of an anchor property');
  }

  ch = state.input.charCodeAt(++state.position);
  _position = state.position;

  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an anchor node must contain at least one character');
  }

  state.anchor = state.input.slice(_position, state.position);
  return true;
}

function readAlias(state) {
  var _position, alias,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x2A/* * */) return false;

  ch = state.input.charCodeAt(++state.position);
  _position = state.position;

  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an alias node must contain at least one character');
  }

  alias = state.input.slice(_position, state.position);

  if (!_hasOwnProperty.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }

  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}

function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles,
      allowBlockScalars,
      allowBlockCollections,
      indentStatus = 1, // 1: this>parent, 0: this=parent, -1: this<parent
      atNewLine  = false,
      hasContent = false,
      typeIndex,
      typeQuantity,
      typeList,
      type,
      flowIndent,
      blockIndent;

  if (state.listener !== null) {
    state.listener('open', state);
  }

  state.tag    = null;
  state.anchor = null;
  state.kind   = null;
  state.result = null;

  allowBlockStyles = allowBlockScalars = allowBlockCollections =
    CONTEXT_BLOCK_OUT === nodeContext ||
    CONTEXT_BLOCK_IN  === nodeContext;

  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;

      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }

  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;

        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }

  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }

  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }

    blockIndent = state.position - state.lineStart;

    if (indentStatus === 1) {
      if (allowBlockCollections &&
          (readBlockSequence(state, blockIndent) ||
           readBlockMapping(state, blockIndent, flowIndent)) ||
          readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if ((allowBlockScalars && readBlockScalar(state, flowIndent)) ||
            readSingleQuotedScalar(state, flowIndent) ||
            readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;

        } else if (readAlias(state)) {
          hasContent = true;

          if (state.tag !== null || state.anchor !== null) {
            throwError(state, 'alias node should not have any properties');
          }

        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;

          if (state.tag === null) {
            state.tag = '?';
          }
        }

        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      // Special case: block sequences are allowed to have same indentation level as the parent.
      // http://www.yaml.org/spec/1.2/spec.html#id2799784
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }

  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }

  } else if (state.tag === '?') {
    // Implicit resolving is not allowed for non-scalar types, and '?'
    // non-specific tag is only automatically assigned to plain scalars.
    //
    // We only need to check kind conformity in case user explicitly assigns '?'
    // tag, for example like this: "!<?> [0]"
    //
    if (state.result !== null && state.kind !== 'scalar') {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }

    for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type = state.implicitTypes[typeIndex];

      if (type.resolve(state.result)) { // `state.result` updated in resolver if matched
        state.result = type.construct(state.result);
        state.tag = type.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== '!') {
    if (_hasOwnProperty.call(state.typeMap[state.kind || 'fallback'], state.tag)) {
      type = state.typeMap[state.kind || 'fallback'][state.tag];
    } else {
      // looking for multi type
      type = null;
      typeList = state.typeMap.multi[state.kind || 'fallback'];

      for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type = typeList[typeIndex];
          break;
        }
      }
    }

    if (!type) {
      throwError(state, 'unknown tag !<' + state.tag + '>');
    }

    if (state.result !== null && type.kind !== state.kind) {
      throwError(state, 'unacceptable node kind for !<' + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
    }

    if (!type.resolve(state.result, state.tag)) { // `state.result` updated in resolver if matched
      throwError(state, 'cannot resolve a node with !<' + state.tag + '> explicit tag');
    } else {
      state.result = type.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }

  if (state.listener !== null) {
    state.listener('close', state);
  }
  return state.tag !== null ||  state.anchor !== null || hasContent;
}

function readDocument(state) {
  var documentStart = state.position,
      _position,
      directiveName,
      directiveArgs,
      hasDirectives = false,
      ch;

  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = Object.create(null);
  state.anchorMap = Object.create(null);

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if (state.lineIndent > 0 || ch !== 0x25/* % */) {
      break;
    }

    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;

    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }

    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];

    if (directiveName.length < 1) {
      throwError(state, 'directive name must not be less than one character in length');
    }

    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      if (ch === 0x23/* # */) {
        do { ch = state.input.charCodeAt(++state.position); }
        while (ch !== 0 && !is_EOL(ch));
        break;
      }

      if (is_EOL(ch)) break;

      _position = state.position;

      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      directiveArgs.push(state.input.slice(_position, state.position));
    }

    if (ch !== 0) readLineBreak(state);

    if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }

  skipSeparationSpace(state, true, -1);

  if (state.lineIndent === 0 &&
      state.input.charCodeAt(state.position)     === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 1) === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 2) === 0x2D/* - */) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);

  } else if (hasDirectives) {
    throwError(state, 'directives end mark is expected');
  }

  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);

  if (state.checkLineBreaks &&
      PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, 'non-ASCII line breaks are interpreted as content');
  }

  state.documents.push(state.result);

  if (state.position === state.lineStart && testDocumentSeparator(state)) {

    if (state.input.charCodeAt(state.position) === 0x2E/* . */) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }

  if (state.position < (state.length - 1)) {
    throwError(state, 'end of the stream or a document separator is expected');
  } else {
    return;
  }
}


function loadDocuments(input, options) {
  input = String(input);
  options = options || {};

  if (input.length !== 0) {

    // Add tailing `\n` if not exists
    if (input.charCodeAt(input.length - 1) !== 0x0A/* LF */ &&
        input.charCodeAt(input.length - 1) !== 0x0D/* CR */) {
      input += '\n';
    }

    // Strip BOM
    if (input.charCodeAt(0) === 0xFEFF) {
      input = input.slice(1);
    }
  }

  var state = new State(input, options);

  var nullpos = input.indexOf('\0');

  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, 'null byte is not allowed in input');
  }

  // Use 0 as string terminator. That significantly simplifies bounds check.
  state.input += '\0';

  while (state.input.charCodeAt(state.position) === 0x20/* Space */) {
    state.lineIndent += 1;
    state.position += 1;
  }

  while (state.position < (state.length - 1)) {
    readDocument(state);
  }

  return state.documents;
}


function loadAll(input, iterator, options) {
  if (iterator !== null && typeof iterator === 'object' && typeof options === 'undefined') {
    options = iterator;
    iterator = null;
  }

  var documents = loadDocuments(input, options);

  if (typeof iterator !== 'function') {
    return documents;
  }

  for (var index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}


function load(input, options) {
  var documents = loadDocuments(input, options);

  if (documents.length === 0) {
    /*eslint-disable no-undefined*/
    return undefined;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new YAMLException('expected a single document in the stream, but found more');
}


module.exports.loadAll = loadAll;
module.exports.load    = load;


/***/ }),
/* 6 */
/***/ ((module) => {




function isNothing(subject) {
  return (typeof subject === 'undefined') || (subject === null);
}


function isObject(subject) {
  return (typeof subject === 'object') && (subject !== null);
}


function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];

  return [ sequence ];
}


function extend(target, source) {
  var index, length, key, sourceKeys;

  if (source) {
    sourceKeys = Object.keys(source);

    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }

  return target;
}


function repeat(string, count) {
  var result = '', cycle;

  for (cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }

  return result;
}


function isNegativeZero(number) {
  return (number === 0) && (Number.NEGATIVE_INFINITY === 1 / number);
}


module.exports.isNothing      = isNothing;
module.exports.isObject       = isObject;
module.exports.toArray        = toArray;
module.exports.repeat         = repeat;
module.exports.isNegativeZero = isNegativeZero;
module.exports.extend         = extend;


/***/ }),
/* 7 */
/***/ ((module) => {

// YAML error class. http://stackoverflow.com/questions/8458984
//



function formatError(exception, compact) {
  var where = '', message = exception.reason || '(unknown reason)';

  if (!exception.mark) return message;

  if (exception.mark.name) {
    where += 'in "' + exception.mark.name + '" ';
  }

  where += '(' + (exception.mark.line + 1) + ':' + (exception.mark.column + 1) + ')';

  if (!compact && exception.mark.snippet) {
    where += '\n\n' + exception.mark.snippet;
  }

  return message + ' ' + where;
}


function YAMLException(reason, mark) {
  // Super constructor
  Error.call(this);

  this.name = 'YAMLException';
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);

  // Include stack trace in error object
  if (Error.captureStackTrace) {
    // Chrome and NodeJS
    Error.captureStackTrace(this, this.constructor);
  } else {
    // FF, IE 10+ and Safari 6+. Fallback for others
    this.stack = (new Error()).stack || '';
  }
}


// Inherit from Error
YAMLException.prototype = Object.create(Error.prototype);
YAMLException.prototype.constructor = YAMLException;


YAMLException.prototype.toString = function toString(compact) {
  return this.name + ': ' + formatError(this, compact);
};


module.exports = YAMLException;


/***/ }),
/* 8 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {




var common = __webpack_require__(6);


// get snippet for a single line, respecting maxLength
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = '';
  var tail = '';
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;

  if (position - lineStart > maxHalfLength) {
    head = ' ... ';
    lineStart = position - maxHalfLength + head.length;
  }

  if (lineEnd - position > maxHalfLength) {
    tail = ' ...';
    lineEnd = position + maxHalfLength - tail.length;
  }

  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, '→') + tail,
    pos: position - lineStart + head.length // relative position
  };
}


function padStart(string, max) {
  return common.repeat(' ', max - string.length) + string;
}


function makeSnippet(mark, options) {
  options = Object.create(options || null);

  if (!mark.buffer) return null;

  if (!options.maxLength) options.maxLength = 79;
  if (typeof options.indent      !== 'number') options.indent      = 1;
  if (typeof options.linesBefore !== 'number') options.linesBefore = 3;
  if (typeof options.linesAfter  !== 'number') options.linesAfter  = 2;

  var re = /\r?\n|\r|\0/g;
  var lineStarts = [ 0 ];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;

  while ((match = re.exec(mark.buffer))) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);

    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }

  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;

  var result = '', i, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);

  for (i = 1; i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i],
      lineEnds[foundLineNo - i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
      maxLineLength
    );
    result = common.repeat(' ', options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) +
      ' | ' + line.str + '\n' + result;
  }

  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(' ', options.indent) + padStart((mark.line + 1).toString(), lineNoLength) +
    ' | ' + line.str + '\n';
  result += common.repeat('-', options.indent + lineNoLength + 3 + line.pos) + '^' + '\n';

  for (i = 1; i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i],
      lineEnds[foundLineNo + i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
      maxLineLength
    );
    result += common.repeat(' ', options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) +
      ' | ' + line.str + '\n';
  }

  return result.replace(/\n$/, '');
}


module.exports = makeSnippet;


/***/ }),
/* 9 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// JS-YAML's default schema for `safeLoad` function.
// It is not described in the YAML specification.
//
// This schema is based on standard YAML's Core schema and includes most of
// extra types described at YAML tag repository. (http://yaml.org/type/)





module.exports = (__webpack_require__(10).extend)({
  implicit: [
    __webpack_require__(22),
    __webpack_require__(23)
  ],
  explicit: [
    __webpack_require__(24),
    __webpack_require__(25),
    __webpack_require__(26),
    __webpack_require__(27)
  ]
});


/***/ }),
/* 10 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// Standard YAML's Core schema.
// http://www.yaml.org/spec/1.2/spec.html#id2804923
//
// NOTE: JS-YAML does not support schema-specific tag resolution restrictions.
// So, Core schema has no distinctions from JSON schema is JS-YAML.





module.exports = __webpack_require__(11);


/***/ }),
/* 11 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// Standard YAML's JSON schema.
// http://www.yaml.org/spec/1.2/spec.html#id2803231
//
// NOTE: JS-YAML does not support schema-specific tag resolution restrictions.
// So, this schema is not such strict as defined in the YAML specification.
// It allows numbers in binary notaion, use `Null` and `NULL` as `null`, etc.





module.exports = (__webpack_require__(12).extend)({
  implicit: [
    __webpack_require__(18),
    __webpack_require__(19),
    __webpack_require__(20),
    __webpack_require__(21)
  ]
});


/***/ }),
/* 12 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// Standard YAML's Failsafe schema.
// http://www.yaml.org/spec/1.2/spec.html#id2802346





var Schema = __webpack_require__(13);


module.exports = new Schema({
  explicit: [
    __webpack_require__(15),
    __webpack_require__(16),
    __webpack_require__(17)
  ]
});


/***/ }),
/* 13 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



/*eslint-disable max-len*/

var YAMLException = __webpack_require__(7);
var Type          = __webpack_require__(14);


function compileList(schema, name) {
  var result = [];

  schema[name].forEach(function (currentType) {
    var newIndex = result.length;

    result.forEach(function (previousType, previousIndex) {
      if (previousType.tag === currentType.tag &&
          previousType.kind === currentType.kind &&
          previousType.multi === currentType.multi) {

        newIndex = previousIndex;
      }
    });

    result[newIndex] = currentType;
  });

  return result;
}


function compileMap(/* lists... */) {
  var result = {
        scalar: {},
        sequence: {},
        mapping: {},
        fallback: {},
        multi: {
          scalar: [],
          sequence: [],
          mapping: [],
          fallback: []
        }
      }, index, length;

  function collectType(type) {
    if (type.multi) {
      result.multi[type.kind].push(type);
      result.multi['fallback'].push(type);
    } else {
      result[type.kind][type.tag] = result['fallback'][type.tag] = type;
    }
  }

  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}


function Schema(definition) {
  return this.extend(definition);
}


Schema.prototype.extend = function extend(definition) {
  var implicit = [];
  var explicit = [];

  if (definition instanceof Type) {
    // Schema.extend(type)
    explicit.push(definition);

  } else if (Array.isArray(definition)) {
    // Schema.extend([ type1, type2, ... ])
    explicit = explicit.concat(definition);

  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    // Schema.extend({ explicit: [ type1, type2, ... ], implicit: [ type1, type2, ... ] })
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);

  } else {
    throw new YAMLException('Schema.extend argument should be a Type, [ Type ], ' +
      'or a schema definition ({ implicit: [...], explicit: [...] })');
  }

  implicit.forEach(function (type) {
    if (!(type instanceof Type)) {
      throw new YAMLException('Specified list of YAML types (or a single Type object) contains a non-Type object.');
    }

    if (type.loadKind && type.loadKind !== 'scalar') {
      throw new YAMLException('There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.');
    }

    if (type.multi) {
      throw new YAMLException('There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.');
    }
  });

  explicit.forEach(function (type) {
    if (!(type instanceof Type)) {
      throw new YAMLException('Specified list of YAML types (or a single Type object) contains a non-Type object.');
    }
  });

  var result = Object.create(Schema.prototype);

  result.implicit = (this.implicit || []).concat(implicit);
  result.explicit = (this.explicit || []).concat(explicit);

  result.compiledImplicit = compileList(result, 'implicit');
  result.compiledExplicit = compileList(result, 'explicit');
  result.compiledTypeMap  = compileMap(result.compiledImplicit, result.compiledExplicit);

  return result;
};


module.exports = Schema;


/***/ }),
/* 14 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var YAMLException = __webpack_require__(7);

var TYPE_CONSTRUCTOR_OPTIONS = [
  'kind',
  'multi',
  'resolve',
  'construct',
  'instanceOf',
  'predicate',
  'represent',
  'representName',
  'defaultStyle',
  'styleAliases'
];

var YAML_NODE_KINDS = [
  'scalar',
  'sequence',
  'mapping'
];

function compileStyleAliases(map) {
  var result = {};

  if (map !== null) {
    Object.keys(map).forEach(function (style) {
      map[style].forEach(function (alias) {
        result[String(alias)] = style;
      });
    });
  }

  return result;
}

function Type(tag, options) {
  options = options || {};

  Object.keys(options).forEach(function (name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new YAMLException('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });

  // TODO: Add tag format check.
  this.options       = options; // keep original options in case user wants to extend this type later
  this.tag           = tag;
  this.kind          = options['kind']          || null;
  this.resolve       = options['resolve']       || function () { return true; };
  this.construct     = options['construct']     || function (data) { return data; };
  this.instanceOf    = options['instanceOf']    || null;
  this.predicate     = options['predicate']     || null;
  this.represent     = options['represent']     || null;
  this.representName = options['representName'] || null;
  this.defaultStyle  = options['defaultStyle']  || null;
  this.multi         = options['multi']         || false;
  this.styleAliases  = compileStyleAliases(options['styleAliases'] || null);

  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new YAMLException('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}

module.exports = Type;


/***/ }),
/* 15 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

module.exports = new Type('tag:yaml.org,2002:str', {
  kind: 'scalar',
  construct: function (data) { return data !== null ? data : ''; }
});


/***/ }),
/* 16 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

module.exports = new Type('tag:yaml.org,2002:seq', {
  kind: 'sequence',
  construct: function (data) { return data !== null ? data : []; }
});


/***/ }),
/* 17 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

module.exports = new Type('tag:yaml.org,2002:map', {
  kind: 'mapping',
  construct: function (data) { return data !== null ? data : {}; }
});


/***/ }),
/* 18 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

function resolveYamlNull(data) {
  if (data === null) return true;

  var max = data.length;

  return (max === 1 && data === '~') ||
         (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'));
}

function constructYamlNull() {
  return null;
}

function isNull(object) {
  return object === null;
}

module.exports = new Type('tag:yaml.org,2002:null', {
  kind: 'scalar',
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function () { return '~';    },
    lowercase: function () { return 'null'; },
    uppercase: function () { return 'NULL'; },
    camelcase: function () { return 'Null'; },
    empty:     function () { return '';     }
  },
  defaultStyle: 'lowercase'
});


/***/ }),
/* 19 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

function resolveYamlBoolean(data) {
  if (data === null) return false;

  var max = data.length;

  return (max === 4 && (data === 'true' || data === 'True' || data === 'TRUE')) ||
         (max === 5 && (data === 'false' || data === 'False' || data === 'FALSE'));
}

function constructYamlBoolean(data) {
  return data === 'true' ||
         data === 'True' ||
         data === 'TRUE';
}

function isBoolean(object) {
  return Object.prototype.toString.call(object) === '[object Boolean]';
}

module.exports = new Type('tag:yaml.org,2002:bool', {
  kind: 'scalar',
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function (object) { return object ? 'true' : 'false'; },
    uppercase: function (object) { return object ? 'TRUE' : 'FALSE'; },
    camelcase: function (object) { return object ? 'True' : 'False'; }
  },
  defaultStyle: 'lowercase'
});


/***/ }),
/* 20 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var common = __webpack_require__(6);
var Type   = __webpack_require__(14);

function isHexCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) ||
         ((0x41/* A */ <= c) && (c <= 0x46/* F */)) ||
         ((0x61/* a */ <= c) && (c <= 0x66/* f */));
}

function isOctCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x37/* 7 */));
}

function isDecCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */));
}

function resolveYamlInteger(data) {
  if (data === null) return false;

  var max = data.length,
      index = 0,
      hasDigits = false,
      ch;

  if (!max) return false;

  ch = data[index];

  // sign
  if (ch === '-' || ch === '+') {
    ch = data[++index];
  }

  if (ch === '0') {
    // 0
    if (index + 1 === max) return true;
    ch = data[++index];

    // base 2, base 8, base 16

    if (ch === 'b') {
      // base 2
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (ch !== '0' && ch !== '1') return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }


    if (ch === 'x') {
      // base 16
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }


    if (ch === 'o') {
      // base 8
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }
  }

  // base 10 (except 0)

  // value should not start with `_`;
  if (ch === '_') return false;

  for (; index < max; index++) {
    ch = data[index];
    if (ch === '_') continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }

  // Should have digits and should not end with `_`
  if (!hasDigits || ch === '_') return false;

  return true;
}

function constructYamlInteger(data) {
  var value = data, sign = 1, ch;

  if (value.indexOf('_') !== -1) {
    value = value.replace(/_/g, '');
  }

  ch = value[0];

  if (ch === '-' || ch === '+') {
    if (ch === '-') sign = -1;
    value = value.slice(1);
    ch = value[0];
  }

  if (value === '0') return 0;

  if (ch === '0') {
    if (value[1] === 'b') return sign * parseInt(value.slice(2), 2);
    if (value[1] === 'x') return sign * parseInt(value.slice(2), 16);
    if (value[1] === 'o') return sign * parseInt(value.slice(2), 8);
  }

  return sign * parseInt(value, 10);
}

function isInteger(object) {
  return (Object.prototype.toString.call(object)) === '[object Number]' &&
         (object % 1 === 0 && !common.isNegativeZero(object));
}

module.exports = new Type('tag:yaml.org,2002:int', {
  kind: 'scalar',
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary:      function (obj) { return obj >= 0 ? '0b' + obj.toString(2) : '-0b' + obj.toString(2).slice(1); },
    octal:       function (obj) { return obj >= 0 ? '0o'  + obj.toString(8) : '-0o'  + obj.toString(8).slice(1); },
    decimal:     function (obj) { return obj.toString(10); },
    /* eslint-disable max-len */
    hexadecimal: function (obj) { return obj >= 0 ? '0x' + obj.toString(16).toUpperCase() :  '-0x' + obj.toString(16).toUpperCase().slice(1); }
  },
  defaultStyle: 'decimal',
  styleAliases: {
    binary:      [ 2,  'bin' ],
    octal:       [ 8,  'oct' ],
    decimal:     [ 10, 'dec' ],
    hexadecimal: [ 16, 'hex' ]
  }
});


/***/ }),
/* 21 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var common = __webpack_require__(6);
var Type   = __webpack_require__(14);

var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  '^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?' +
  // .2e4, .2
  // special case, seems not from spec
  '|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?' +
  // .inf
  '|[-+]?\\.(?:inf|Inf|INF)' +
  // .nan
  '|\\.(?:nan|NaN|NAN))$');

function resolveYamlFloat(data) {
  if (data === null) return false;

  if (!YAML_FLOAT_PATTERN.test(data) ||
      // Quick hack to not allow integers end with `_`
      // Probably should update regexp & check speed
      data[data.length - 1] === '_') {
    return false;
  }

  return true;
}

function constructYamlFloat(data) {
  var value, sign;

  value  = data.replace(/_/g, '').toLowerCase();
  sign   = value[0] === '-' ? -1 : 1;

  if ('+-'.indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }

  if (value === '.inf') {
    return (sign === 1) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  } else if (value === '.nan') {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}


var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;

function representYamlFloat(object, style) {
  var res;

  if (isNaN(object)) {
    switch (style) {
      case 'lowercase': return '.nan';
      case 'uppercase': return '.NAN';
      case 'camelcase': return '.NaN';
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '.inf';
      case 'uppercase': return '.INF';
      case 'camelcase': return '.Inf';
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '-.inf';
      case 'uppercase': return '-.INF';
      case 'camelcase': return '-.Inf';
    }
  } else if (common.isNegativeZero(object)) {
    return '-0.0';
  }

  res = object.toString(10);

  // JS stringifier can build scientific format without dots: 5e-100,
  // while YAML requres dot: 5.e-100. Fix it with simple hack

  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace('e', '.e') : res;
}

function isFloat(object) {
  return (Object.prototype.toString.call(object) === '[object Number]') &&
         (object % 1 !== 0 || common.isNegativeZero(object));
}

module.exports = new Type('tag:yaml.org,2002:float', {
  kind: 'scalar',
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: 'lowercase'
});


/***/ }),
/* 22 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

var YAML_DATE_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])'          + // [1] year
  '-([0-9][0-9])'                    + // [2] month
  '-([0-9][0-9])$');                   // [3] day

var YAML_TIMESTAMP_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])'          + // [1] year
  '-([0-9][0-9]?)'                   + // [2] month
  '-([0-9][0-9]?)'                   + // [3] day
  '(?:[Tt]|[ \\t]+)'                 + // ...
  '([0-9][0-9]?)'                    + // [4] hour
  ':([0-9][0-9])'                    + // [5] minute
  ':([0-9][0-9])'                    + // [6] second
  '(?:\\.([0-9]*))?'                 + // [7] fraction
  '(?:[ \\t]*(Z|([-+])([0-9][0-9]?)' + // [8] tz [9] tz_sign [10] tz_hour
  '(?::([0-9][0-9]))?))?$');           // [11] tz_minute

function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}

function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0,
      delta = null, tz_hour, tz_minute, date;

  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);

  if (match === null) throw new Error('Date resolve error');

  // match: [1] year [2] month [3] day

  year = +(match[1]);
  month = +(match[2]) - 1; // JS month starts with 0
  day = +(match[3]);

  if (!match[4]) { // no hour
    return new Date(Date.UTC(year, month, day));
  }

  // match: [4] hour [5] minute [6] second [7] fraction

  hour = +(match[4]);
  minute = +(match[5]);
  second = +(match[6]);

  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) { // milli-seconds
      fraction += '0';
    }
    fraction = +fraction;
  }

  // match: [8] tz [9] tz_sign [10] tz_hour [11] tz_minute

  if (match[9]) {
    tz_hour = +(match[10]);
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 60000; // delta in mili-seconds
    if (match[9] === '-') delta = -delta;
  }

  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));

  if (delta) date.setTime(date.getTime() - delta);

  return date;
}

function representYamlTimestamp(object /*, style*/) {
  return object.toISOString();
}

module.exports = new Type('tag:yaml.org,2002:timestamp', {
  kind: 'scalar',
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});


/***/ }),
/* 23 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

function resolveYamlMerge(data) {
  return data === '<<' || data === null;
}

module.exports = new Type('tag:yaml.org,2002:merge', {
  kind: 'scalar',
  resolve: resolveYamlMerge
});


/***/ }),
/* 24 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



/*eslint-disable no-bitwise*/


var Type = __webpack_require__(14);


// [ 64, 65, 66 ] -> [ padding, CR, LF ]
var BASE64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r';


function resolveYamlBinary(data) {
  if (data === null) return false;

  var code, idx, bitlen = 0, max = data.length, map = BASE64_MAP;

  // Convert one by one.
  for (idx = 0; idx < max; idx++) {
    code = map.indexOf(data.charAt(idx));

    // Skip CR/LF
    if (code > 64) continue;

    // Fail on illegal characters
    if (code < 0) return false;

    bitlen += 6;
  }

  // If there are any bits left, source was corrupted
  return (bitlen % 8) === 0;
}

function constructYamlBinary(data) {
  var idx, tailbits,
      input = data.replace(/[\r\n=]/g, ''), // remove CR/LF & padding to simplify scan
      max = input.length,
      map = BASE64_MAP,
      bits = 0,
      result = [];

  // Collect by 6*4 bits (3 bytes)

  for (idx = 0; idx < max; idx++) {
    if ((idx % 4 === 0) && idx) {
      result.push((bits >> 16) & 0xFF);
      result.push((bits >> 8) & 0xFF);
      result.push(bits & 0xFF);
    }

    bits = (bits << 6) | map.indexOf(input.charAt(idx));
  }

  // Dump tail

  tailbits = (max % 4) * 6;

  if (tailbits === 0) {
    result.push((bits >> 16) & 0xFF);
    result.push((bits >> 8) & 0xFF);
    result.push(bits & 0xFF);
  } else if (tailbits === 18) {
    result.push((bits >> 10) & 0xFF);
    result.push((bits >> 2) & 0xFF);
  } else if (tailbits === 12) {
    result.push((bits >> 4) & 0xFF);
  }

  return new Uint8Array(result);
}

function representYamlBinary(object /*, style*/) {
  var result = '', bits = 0, idx, tail,
      max = object.length,
      map = BASE64_MAP;

  // Convert every three bytes to 4 ASCII characters.

  for (idx = 0; idx < max; idx++) {
    if ((idx % 3 === 0) && idx) {
      result += map[(bits >> 18) & 0x3F];
      result += map[(bits >> 12) & 0x3F];
      result += map[(bits >> 6) & 0x3F];
      result += map[bits & 0x3F];
    }

    bits = (bits << 8) + object[idx];
  }

  // Dump tail

  tail = max % 3;

  if (tail === 0) {
    result += map[(bits >> 18) & 0x3F];
    result += map[(bits >> 12) & 0x3F];
    result += map[(bits >> 6) & 0x3F];
    result += map[bits & 0x3F];
  } else if (tail === 2) {
    result += map[(bits >> 10) & 0x3F];
    result += map[(bits >> 4) & 0x3F];
    result += map[(bits << 2) & 0x3F];
    result += map[64];
  } else if (tail === 1) {
    result += map[(bits >> 2) & 0x3F];
    result += map[(bits << 4) & 0x3F];
    result += map[64];
    result += map[64];
  }

  return result;
}

function isBinary(obj) {
  return Object.prototype.toString.call(obj) ===  '[object Uint8Array]';
}

module.exports = new Type('tag:yaml.org,2002:binary', {
  kind: 'scalar',
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});


/***/ }),
/* 25 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

var _hasOwnProperty = Object.prototype.hasOwnProperty;
var _toString       = Object.prototype.toString;

function resolveYamlOmap(data) {
  if (data === null) return true;

  var objectKeys = [], index, length, pair, pairKey, pairHasKey,
      object = data;

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;

    if (_toString.call(pair) !== '[object Object]') return false;

    for (pairKey in pair) {
      if (_hasOwnProperty.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }

    if (!pairHasKey) return false;

    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }

  return true;
}

function constructYamlOmap(data) {
  return data !== null ? data : [];
}

module.exports = new Type('tag:yaml.org,2002:omap', {
  kind: 'sequence',
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});


/***/ }),
/* 26 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

var _toString = Object.prototype.toString;

function resolveYamlPairs(data) {
  if (data === null) return true;

  var index, length, pair, keys, result,
      object = data;

  result = new Array(object.length);

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];

    if (_toString.call(pair) !== '[object Object]') return false;

    keys = Object.keys(pair);

    if (keys.length !== 1) return false;

    result[index] = [ keys[0], pair[keys[0]] ];
  }

  return true;
}

function constructYamlPairs(data) {
  if (data === null) return [];

  var index, length, pair, keys, result,
      object = data;

  result = new Array(object.length);

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];

    keys = Object.keys(pair);

    result[index] = [ keys[0], pair[keys[0]] ];
  }

  return result;
}

module.exports = new Type('tag:yaml.org,2002:pairs', {
  kind: 'sequence',
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});


/***/ }),
/* 27 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Type = __webpack_require__(14);

var _hasOwnProperty = Object.prototype.hasOwnProperty;

function resolveYamlSet(data) {
  if (data === null) return true;

  var key, object = data;

  for (key in object) {
    if (_hasOwnProperty.call(object, key)) {
      if (object[key] !== null) return false;
    }
  }

  return true;
}

function constructYamlSet(data) {
  return data !== null ? data : {};
}

module.exports = new Type('tag:yaml.org,2002:set', {
  kind: 'mapping',
  resolve: resolveYamlSet,
  construct: constructYamlSet
});


/***/ }),
/* 28 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



/*eslint-disable no-use-before-define*/

var common              = __webpack_require__(6);
var YAMLException       = __webpack_require__(7);
var DEFAULT_SCHEMA      = __webpack_require__(9);

var _toString       = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;

var CHAR_BOM                  = 0xFEFF;
var CHAR_TAB                  = 0x09; /* Tab */
var CHAR_LINE_FEED            = 0x0A; /* LF */
var CHAR_CARRIAGE_RETURN      = 0x0D; /* CR */
var CHAR_SPACE                = 0x20; /* Space */
var CHAR_EXCLAMATION          = 0x21; /* ! */
var CHAR_DOUBLE_QUOTE         = 0x22; /* " */
var CHAR_SHARP                = 0x23; /* # */
var CHAR_PERCENT              = 0x25; /* % */
var CHAR_AMPERSAND            = 0x26; /* & */
var CHAR_SINGLE_QUOTE         = 0x27; /* ' */
var CHAR_ASTERISK             = 0x2A; /* * */
var CHAR_COMMA                = 0x2C; /* , */
var CHAR_MINUS                = 0x2D; /* - */
var CHAR_COLON                = 0x3A; /* : */
var CHAR_EQUALS               = 0x3D; /* = */
var CHAR_GREATER_THAN         = 0x3E; /* > */
var CHAR_QUESTION             = 0x3F; /* ? */
var CHAR_COMMERCIAL_AT        = 0x40; /* @ */
var CHAR_LEFT_SQUARE_BRACKET  = 0x5B; /* [ */
var CHAR_RIGHT_SQUARE_BRACKET = 0x5D; /* ] */
var CHAR_GRAVE_ACCENT         = 0x60; /* ` */
var CHAR_LEFT_CURLY_BRACKET   = 0x7B; /* { */
var CHAR_VERTICAL_LINE        = 0x7C; /* | */
var CHAR_RIGHT_CURLY_BRACKET  = 0x7D; /* } */

var ESCAPE_SEQUENCES = {};

ESCAPE_SEQUENCES[0x00]   = '\\0';
ESCAPE_SEQUENCES[0x07]   = '\\a';
ESCAPE_SEQUENCES[0x08]   = '\\b';
ESCAPE_SEQUENCES[0x09]   = '\\t';
ESCAPE_SEQUENCES[0x0A]   = '\\n';
ESCAPE_SEQUENCES[0x0B]   = '\\v';
ESCAPE_SEQUENCES[0x0C]   = '\\f';
ESCAPE_SEQUENCES[0x0D]   = '\\r';
ESCAPE_SEQUENCES[0x1B]   = '\\e';
ESCAPE_SEQUENCES[0x22]   = '\\"';
ESCAPE_SEQUENCES[0x5C]   = '\\\\';
ESCAPE_SEQUENCES[0x85]   = '\\N';
ESCAPE_SEQUENCES[0xA0]   = '\\_';
ESCAPE_SEQUENCES[0x2028] = '\\L';
ESCAPE_SEQUENCES[0x2029] = '\\P';

var DEPRECATED_BOOLEANS_SYNTAX = [
  'y', 'Y', 'yes', 'Yes', 'YES', 'on', 'On', 'ON',
  'n', 'N', 'no', 'No', 'NO', 'off', 'Off', 'OFF'
];

var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;

function compileStyleMap(schema, map) {
  var result, keys, index, length, tag, style, type;

  if (map === null) return {};

  result = {};
  keys = Object.keys(map);

  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map[tag]);

    if (tag.slice(0, 2) === '!!') {
      tag = 'tag:yaml.org,2002:' + tag.slice(2);
    }
    type = schema.compiledTypeMap['fallback'][tag];

    if (type && _hasOwnProperty.call(type.styleAliases, style)) {
      style = type.styleAliases[style];
    }

    result[tag] = style;
  }

  return result;
}

function encodeHex(character) {
  var string, handle, length;

  string = character.toString(16).toUpperCase();

  if (character <= 0xFF) {
    handle = 'x';
    length = 2;
  } else if (character <= 0xFFFF) {
    handle = 'u';
    length = 4;
  } else if (character <= 0xFFFFFFFF) {
    handle = 'U';
    length = 8;
  } else {
    throw new YAMLException('code point within a string may not be greater than 0xFFFFFFFF');
  }

  return '\\' + handle + common.repeat('0', length - string.length) + string;
}


var QUOTING_TYPE_SINGLE = 1,
    QUOTING_TYPE_DOUBLE = 2;

function State(options) {
  this.schema        = options['schema'] || DEFAULT_SCHEMA;
  this.indent        = Math.max(1, (options['indent'] || 2));
  this.noArrayIndent = options['noArrayIndent'] || false;
  this.skipInvalid   = options['skipInvalid'] || false;
  this.flowLevel     = (common.isNothing(options['flowLevel']) ? -1 : options['flowLevel']);
  this.styleMap      = compileStyleMap(this.schema, options['styles'] || null);
  this.sortKeys      = options['sortKeys'] || false;
  this.lineWidth     = options['lineWidth'] || 80;
  this.noRefs        = options['noRefs'] || false;
  this.noCompatMode  = options['noCompatMode'] || false;
  this.condenseFlow  = options['condenseFlow'] || false;
  this.quotingType   = options['quotingType'] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes   = options['forceQuotes'] || false;
  this.replacer      = typeof options['replacer'] === 'function' ? options['replacer'] : null;

  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;

  this.tag = null;
  this.result = '';

  this.duplicates = [];
  this.usedDuplicates = null;
}

// Indents every line in a string. Empty lines (\n only) are not indented.
function indentString(string, spaces) {
  var ind = common.repeat(' ', spaces),
      position = 0,
      next = -1,
      result = '',
      line,
      length = string.length;

  while (position < length) {
    next = string.indexOf('\n', position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }

    if (line.length && line !== '\n') result += ind;

    result += line;
  }

  return result;
}

function generateNextLine(state, level) {
  return '\n' + common.repeat(' ', state.indent * level);
}

function testImplicitResolving(state, str) {
  var index, length, type;

  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type = state.implicitTypes[index];

    if (type.resolve(str)) {
      return true;
    }
  }

  return false;
}

// [33] s-white ::= s-space | s-tab
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}

// Returns true if the character can be printed without escaping.
// From YAML 1.2: "any allowed characters known to be non-printable
// should also be escaped. [However,] This isn’t mandatory"
// Derived from nb-char - \t - #x85 - #xA0 - #x2028 - #x2029.
function isPrintable(c) {
  return  (0x00020 <= c && c <= 0x00007E)
      || ((0x000A1 <= c && c <= 0x00D7FF) && c !== 0x2028 && c !== 0x2029)
      || ((0x0E000 <= c && c <= 0x00FFFD) && c !== CHAR_BOM)
      ||  (0x10000 <= c && c <= 0x10FFFF);
}

// [34] ns-char ::= nb-char - s-white
// [27] nb-char ::= c-printable - b-char - c-byte-order-mark
// [26] b-char  ::= b-line-feed | b-carriage-return
// Including s-white (for some reason, examples doesn't match specs in this aspect)
// ns-char ::= c-printable - b-line-feed - b-carriage-return - c-byte-order-mark
function isNsCharOrWhitespace(c) {
  return isPrintable(c)
    && c !== CHAR_BOM
    // - b-char
    && c !== CHAR_CARRIAGE_RETURN
    && c !== CHAR_LINE_FEED;
}

// [127]  ns-plain-safe(c) ::= c = flow-out  ⇒ ns-plain-safe-out
//                             c = flow-in   ⇒ ns-plain-safe-in
//                             c = block-key ⇒ ns-plain-safe-out
//                             c = flow-key  ⇒ ns-plain-safe-in
// [128] ns-plain-safe-out ::= ns-char
// [129]  ns-plain-safe-in ::= ns-char - c-flow-indicator
// [130]  ns-plain-char(c) ::=  ( ns-plain-safe(c) - “:” - “#” )
//                            | ( /* An ns-char preceding */ “#” )
//                            | ( “:” /* Followed by an ns-plain-safe(c) */ )
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (
    // ns-plain-safe
    inblock ? // c = flow-in
      cIsNsCharOrWhitespace
      : cIsNsCharOrWhitespace
        // - c-flow-indicator
        && c !== CHAR_COMMA
        && c !== CHAR_LEFT_SQUARE_BRACKET
        && c !== CHAR_RIGHT_SQUARE_BRACKET
        && c !== CHAR_LEFT_CURLY_BRACKET
        && c !== CHAR_RIGHT_CURLY_BRACKET
  )
    // ns-plain-char
    && c !== CHAR_SHARP // false on '#'
    && !(prev === CHAR_COLON && !cIsNsChar) // false on ': '
    || (isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP) // change to true on '[^ ]#'
    || (prev === CHAR_COLON && cIsNsChar); // change to true on ':[^ ]'
}

// Simplified test for values allowed as the first character in plain style.
function isPlainSafeFirst(c) {
  // Uses a subset of ns-char - c-indicator
  // where ns-char = nb-char - s-white.
  // No support of ( ( “?” | “:” | “-” ) /* Followed by an ns-plain-safe(c)) */ ) part
  return isPrintable(c) && c !== CHAR_BOM
    && !isWhitespace(c) // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    && c !== CHAR_MINUS
    && c !== CHAR_QUESTION
    && c !== CHAR_COLON
    && c !== CHAR_COMMA
    && c !== CHAR_LEFT_SQUARE_BRACKET
    && c !== CHAR_RIGHT_SQUARE_BRACKET
    && c !== CHAR_LEFT_CURLY_BRACKET
    && c !== CHAR_RIGHT_CURLY_BRACKET
    // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
    && c !== CHAR_SHARP
    && c !== CHAR_AMPERSAND
    && c !== CHAR_ASTERISK
    && c !== CHAR_EXCLAMATION
    && c !== CHAR_VERTICAL_LINE
    && c !== CHAR_EQUALS
    && c !== CHAR_GREATER_THAN
    && c !== CHAR_SINGLE_QUOTE
    && c !== CHAR_DOUBLE_QUOTE
    // | “%” | “@” | “`”)
    && c !== CHAR_PERCENT
    && c !== CHAR_COMMERCIAL_AT
    && c !== CHAR_GRAVE_ACCENT;
}

// Simplified test for values allowed as the last character in plain style.
function isPlainSafeLast(c) {
  // just not whitespace or colon, it will be checked to be plain character later
  return !isWhitespace(c) && c !== CHAR_COLON;
}

// Same as 'string'.codePointAt(pos), but works in older browsers.
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 0xD800 && first <= 0xDBFF && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 0xDC00 && second <= 0xDFFF) {
      // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
    }
  }
  return first;
}

// Determines whether block indentation indicator is required.
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}

var STYLE_PLAIN   = 1,
    STYLE_SINGLE  = 2,
    STYLE_LITERAL = 3,
    STYLE_FOLDED  = 4,
    STYLE_DOUBLE  = 5;

// Determines which scalar styles are possible and returns the preferred style.
// lineWidth = -1 => no limit.
// Pre-conditions: str.length > 0.
// Post-conditions:
//    STYLE_PLAIN or STYLE_SINGLE => no \n are in the string.
//    STYLE_LITERAL => no lines are suitable for folding (or lineWidth is -1).
//    STYLE_FOLDED => a line > lineWidth and can be folded (and lineWidth != -1).
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth,
  testAmbiguousType, quotingType, forceQuotes, inblock) {

  var i;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false; // only checked if shouldTrackWidth
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1; // count the first line correctly
  var plain = isPlainSafeFirst(codePointAt(string, 0))
          && isPlainSafeLast(codePointAt(string, string.length - 1));

  if (singleLineOnly || forceQuotes) {
    // Case: no block styles.
    // Check for disallowed characters to rule out plain and single.
    for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    // Case: block styles permitted.
    for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        // Check if any line can be folded.
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine ||
            // Foldable line = too long, and not more-indented.
            (i - previousLineBreak - 1 > lineWidth &&
             string[previousLineBreak + 1] !== ' ');
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    // in case the end is missing a \n
    hasFoldableLine = hasFoldableLine || (shouldTrackWidth &&
      (i - previousLineBreak - 1 > lineWidth &&
       string[previousLineBreak + 1] !== ' '));
  }
  // Although every style can represent \n without escaping, prefer block styles
  // for multiline, since they're more readable and they don't add empty lines.
  // Also prefer folding a super-long line.
  if (!hasLineBreak && !hasFoldableLine) {
    // Strings interpretable as another type have to be quoted;
    // e.g. the string 'true' vs. the boolean true.
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  // Edge case: block indentation indicator can only have one digit.
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  // At this point we know block styles are valid.
  // Prefer literal style unless we want to fold.
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}

// Note: line breaking/folding is implemented for only the folded style.
// NB. We drop the last trailing newline (if any) of a returned block scalar
//  since the dumper adds its own newline. This always works:
//    • No ending newline => unaffected; already using strip "-" chomping.
//    • Ending newline    => removed then restored.
//  Importantly, this keeps the "+" chomp indicator from gaining an extra line.
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = (function () {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? ('"' + string + '"') : ("'" + string + "'");
      }
    }

    var indent = state.indent * Math.max(1, level); // no 0-indent scalars
    // As indentation gets deeper, let the width decrease monotonically
    // to the lower bound min(state.lineWidth, 40).
    // Note that this implies
    //  state.lineWidth ≤ 40 + state.indent: width is fixed at the lower bound.
    //  state.lineWidth > 40 + state.indent: width decreases until the lower bound.
    // This behaves better than a constant minimum width which disallows narrower options,
    // or an indent threshold which causes the width to suddenly increase.
    var lineWidth = state.lineWidth === -1
      ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);

    // Without knowing if keys are implicit/explicit, assume implicit for safety.
    var singleLineOnly = iskey
      // No block styles in flow mode.
      || (state.flowLevel > -1 && level >= state.flowLevel);
    function testAmbiguity(string) {
      return testImplicitResolving(state, string);
    }

    switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth,
      testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {

      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return '|' + blockHeader(string, state.indent)
          + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return '>' + blockHeader(string, state.indent)
          + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string, lineWidth) + '"';
      default:
        throw new YAMLException('impossible error: invalid scalar style');
    }
  }());
}

// Pre-conditions: string is valid for a block scalar, 1 <= indentPerLevel <= 9.
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : '';

  // note the special case: the string '\n' counts as a "trailing" empty line.
  var clip =          string[string.length - 1] === '\n';
  var keep = clip && (string[string.length - 2] === '\n' || string === '\n');
  var chomp = keep ? '+' : (clip ? '' : '-');

  return indentIndicator + chomp + '\n';
}

// (See the note for writeScalar.)
function dropEndingNewline(string) {
  return string[string.length - 1] === '\n' ? string.slice(0, -1) : string;
}

// Note: a long line without a suitable break point will exceed the width limit.
// Pre-conditions: every char in str isPrintable, str.length > 0, width > 0.
function foldString(string, width) {
  // In folded style, $k$ consecutive newlines output as $k+1$ newlines—
  // unless they're before or after a more-indented line, or at the very
  // beginning or end, in which case $k$ maps to $k$.
  // Therefore, parse each chunk as newline(s) followed by a content line.
  var lineRe = /(\n+)([^\n]*)/g;

  // first line (possibly an empty line)
  var result = (function () {
    var nextLF = string.indexOf('\n');
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  }());
  // If we haven't reached the first content line yet, don't add an extra \n.
  var prevMoreIndented = string[0] === '\n' || string[0] === ' ';
  var moreIndented;

  // rest of the lines
  var match;
  while ((match = lineRe.exec(string))) {
    var prefix = match[1], line = match[2];
    moreIndented = (line[0] === ' ');
    result += prefix
      + (!prevMoreIndented && !moreIndented && line !== ''
        ? '\n' : '')
      + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }

  return result;
}

// Greedy line breaking.
// Picks the longest line under the limit each time,
// otherwise settles for the shortest line over the limit.
// NB. More-indented lines *cannot* be folded, as that would add an extra \n.
function foldLine(line, width) {
  if (line === '' || line[0] === ' ') return line;

  // Since a more-indented line adds a \n, breaks can't be followed by a space.
  var breakRe = / [^ ]/g; // note: the match index will always be <= length-2.
  var match;
  // start is an inclusive index. end, curr, and next are exclusive.
  var start = 0, end, curr = 0, next = 0;
  var result = '';

  // Invariants: 0 <= start <= length-1.
  //   0 <= curr <= next <= max(0, length-2). curr - start <= width.
  // Inside the loop:
  //   A match implies length >= 2, so curr and next are <= length-2.
  while ((match = breakRe.exec(line))) {
    next = match.index;
    // maintain invariant: curr - start <= width
    if (next - start > width) {
      end = (curr > start) ? curr : next; // derive end <= length-2
      result += '\n' + line.slice(start, end);
      // skip the space that was output as \n
      start = end + 1;                    // derive start <= length-1
    }
    curr = next;
  }

  // By the invariants, start <= length-1, so there is something left over.
  // It is either the whole string or a part starting from non-whitespace.
  result += '\n';
  // Insert a break if the remainder is too long and there is a break available.
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + '\n' + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }

  return result.slice(1); // drop extra \n joiner
}

// Escapes a double-quoted string.
function escapeString(string) {
  var result = '';
  var char = 0;
  var escapeSeq;

  for (var i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
    char = codePointAt(string, i);
    escapeSeq = ESCAPE_SEQUENCES[char];

    if (!escapeSeq && isPrintable(char)) {
      result += string[i];
      if (char >= 0x10000) result += string[i + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }

  return result;
}

function writeFlowSequence(state, level, object) {
  var _result = '',
      _tag    = state.tag,
      index,
      length,
      value;

  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];

    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }

    // Write only valid elements, put null instead of invalid elements.
    if (writeNode(state, level, value, false, false) ||
        (typeof value === 'undefined' &&
         writeNode(state, level, null, false, false))) {

      if (_result !== '') _result += ',' + (!state.condenseFlow ? ' ' : '');
      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = '[' + _result + ']';
}

function writeBlockSequence(state, level, object, compact) {
  var _result = '',
      _tag    = state.tag,
      index,
      length,
      value;

  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];

    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }

    // Write only valid elements, put null instead of invalid elements.
    if (writeNode(state, level + 1, value, true, true, false, true) ||
        (typeof value === 'undefined' &&
         writeNode(state, level + 1, null, true, true, false, true))) {

      if (!compact || _result !== '') {
        _result += generateNextLine(state, level);
      }

      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += '-';
      } else {
        _result += '- ';
      }

      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = _result || '[]'; // Empty sequence if no valid values.
}

function writeFlowMapping(state, level, object) {
  var _result       = '',
      _tag          = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      pairBuffer;

  for (index = 0, length = objectKeyList.length; index < length; index += 1) {

    pairBuffer = '';
    if (_result !== '') pairBuffer += ', ';

    if (state.condenseFlow) pairBuffer += '"';

    objectKey = objectKeyList[index];
    objectValue = object[objectKey];

    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }

    if (!writeNode(state, level, objectKey, false, false)) {
      continue; // Skip this pair because of invalid key;
    }

    if (state.dump.length > 1024) pairBuffer += '? ';

    pairBuffer += state.dump + (state.condenseFlow ? '"' : '') + ':' + (state.condenseFlow ? '' : ' ');

    if (!writeNode(state, level, objectValue, false, false)) {
      continue; // Skip this pair because of invalid value.
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = '{' + _result + '}';
}

function writeBlockMapping(state, level, object, compact) {
  var _result       = '',
      _tag          = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      explicitPair,
      pairBuffer;

  // Allow sorting keys so that the output file is deterministic
  if (state.sortKeys === true) {
    // Default sorting
    objectKeyList.sort();
  } else if (typeof state.sortKeys === 'function') {
    // Custom sort function
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    // Something is wrong
    throw new YAMLException('sortKeys must be a boolean or a function');
  }

  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = '';

    if (!compact || _result !== '') {
      pairBuffer += generateNextLine(state, level);
    }

    objectKey = objectKeyList[index];
    objectValue = object[objectKey];

    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }

    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue; // Skip this pair because of invalid key.
    }

    explicitPair = (state.tag !== null && state.tag !== '?') ||
                   (state.dump && state.dump.length > 1024);

    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += '?';
      } else {
        pairBuffer += '? ';
      }
    }

    pairBuffer += state.dump;

    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }

    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue; // Skip this pair because of invalid value.
    }

    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ':';
    } else {
      pairBuffer += ': ';
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = _result || '{}'; // Empty mapping if no valid pairs.
}

function detectType(state, object, explicit) {
  var _result, typeList, index, length, type, style;

  typeList = explicit ? state.explicitTypes : state.implicitTypes;

  for (index = 0, length = typeList.length; index < length; index += 1) {
    type = typeList[index];

    if ((type.instanceOf  || type.predicate) &&
        (!type.instanceOf || ((typeof object === 'object') && (object instanceof type.instanceOf))) &&
        (!type.predicate  || type.predicate(object))) {

      if (explicit) {
        if (type.multi && type.representName) {
          state.tag = type.representName(object);
        } else {
          state.tag = type.tag;
        }
      } else {
        state.tag = '?';
      }

      if (type.represent) {
        style = state.styleMap[type.tag] || type.defaultStyle;

        if (_toString.call(type.represent) === '[object Function]') {
          _result = type.represent(object, style);
        } else if (_hasOwnProperty.call(type.represent, style)) {
          _result = type.represent[style](object, style);
        } else {
          throw new YAMLException('!<' + type.tag + '> tag resolver accepts not "' + style + '" style');
        }

        state.dump = _result;
      }

      return true;
    }
  }

  return false;
}

// Serializes `object` and writes it to global `result`.
// Returns true on success, or false on invalid object.
//
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;

  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }

  var type = _toString.call(state.dump);
  var inblock = block;
  var tagStr;

  if (block) {
    block = (state.flowLevel < 0 || state.flowLevel > level);
  }

  var objectOrArray = type === '[object Object]' || type === '[object Array]',
      duplicateIndex,
      duplicate;

  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }

  if ((state.tag !== null && state.tag !== '?') || duplicate || (state.indent !== 2 && level > 0)) {
    compact = false;
  }

  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = '*ref_' + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type === '[object Object]') {
      if (block && (Object.keys(state.dump).length !== 0)) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object Array]') {
      if (block && (state.dump.length !== 0)) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object String]') {
      if (state.tag !== '?') {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type === '[object Undefined]') {
      return false;
    } else {
      if (state.skipInvalid) return false;
      throw new YAMLException('unacceptable kind of an object to dump ' + type);
    }

    if (state.tag !== null && state.tag !== '?') {
      // Need to encode all characters except those allowed by the spec:
      //
      // [35] ns-dec-digit    ::=  [#x30-#x39] /* 0-9 */
      // [36] ns-hex-digit    ::=  ns-dec-digit
      //                         | [#x41-#x46] /* A-F */ | [#x61-#x66] /* a-f */
      // [37] ns-ascii-letter ::=  [#x41-#x5A] /* A-Z */ | [#x61-#x7A] /* a-z */
      // [38] ns-word-char    ::=  ns-dec-digit | ns-ascii-letter | “-”
      // [39] ns-uri-char     ::=  “%” ns-hex-digit ns-hex-digit | ns-word-char | “#”
      //                         | “;” | “/” | “?” | “:” | “@” | “&” | “=” | “+” | “$” | “,”
      //                         | “_” | “.” | “!” | “~” | “*” | “'” | “(” | “)” | “[” | “]”
      //
      // Also need to encode '!' because it has special meaning (end of tag prefix).
      //
      tagStr = encodeURI(
        state.tag[0] === '!' ? state.tag.slice(1) : state.tag
      ).replace(/!/g, '%21');

      if (state.tag[0] === '!') {
        tagStr = '!' + tagStr;
      } else if (tagStr.slice(0, 18) === 'tag:yaml.org,2002:') {
        tagStr = '!!' + tagStr.slice(18);
      } else {
        tagStr = '!<' + tagStr + '>';
      }

      state.dump = tagStr + ' ' + state.dump;
    }
  }

  return true;
}

function getDuplicateReferences(object, state) {
  var objects = [],
      duplicatesIndexes = [],
      index,
      length;

  inspectNode(object, objects, duplicatesIndexes);

  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}

function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList,
      index,
      length;

  if (object !== null && typeof object === 'object') {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);

      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);

        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}

function dump(input, options) {
  options = options || {};

  var state = new State(options);

  if (!state.noRefs) getDuplicateReferences(input, state);

  var value = input;

  if (state.replacer) {
    value = state.replacer.call({ '': value }, '', value);
  }

  if (writeNode(state, 0, value, true, true)) return state.dump + '\n';

  return '';
}

module.exports.dump = dump;


/***/ }),
/* 29 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FlowParser = void 0;
const fs = __importStar(__webpack_require__(3));
const path = __importStar(__webpack_require__(2));
// @ts-ignore - js-yaml types may not be available
const yaml = __importStar(__webpack_require__(4));
class FlowParser {
    flowDir;
    constructor(flowDir) {
        this.flowDir = flowDir;
    }
    async parseFlow() {
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
        const nodes = [];
        const edges = [];
        const nodeMap = new Map();
        // Add start node
        const startNode = {
            id: 'start',
            label: 'Start',
            type: 'end',
            details: `Flow: ${config.name}\n${config.description || ''}\n\nStart Step: ${config.start_step || 'N/A'}`
        };
        nodes.push(startNode);
        nodeMap.set('start', startNode);
        // Add exit node (steps that call conv.exit_flow() transition here)
        const exitNode = {
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
            const node = {
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
            const node = {
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
                let targetIds = [];
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
                }
                else if (transition.type === 'flow-function') {
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
                }
                else {
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
                    }
                    else {
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
                }
                else {
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
                    }
                    else if (condition.condition_type === 'step_condition' && condition.child_step) {
                        // Step condition - add edge to target step
                        if (nodeMap.has(condition.child_step)) {
                            edges.push({
                                from: stepName,
                                to: condition.child_step,
                                label: condition.name || condition.child_step,
                                condition: condition.description,
                                type: 'condition'
                            });
                        }
                        else {
                            console.warn(`No Code Step condition target not found: ${condition.child_step} from step ${stepName}`);
                        }
                    }
                }
            }
        }
        return {
            nodes,
            edges,
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
    async parseConfig() {
        const configPath = path.join(this.flowDir, 'flow_config.yaml');
        const content = fs.readFileSync(configPath, 'utf8');
        return yaml.load(content);
    }
    async parseSteps() {
        const stepsDir = path.join(this.flowDir, 'steps');
        const steps = new Map();
        if (!fs.existsSync(stepsDir)) {
            return steps;
        }
        const files = fs.readdirSync(stepsDir);
        for (const file of files) {
            if (file.endsWith('.yaml') || file.endsWith('.yml')) {
                const filePath = path.join(stepsDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const step = yaml.load(content);
                steps.set(step.name, { step, filePath });
            }
        }
        return steps;
    }
    async parseFunctionSteps() {
        const functionStepsDir = path.join(this.flowDir, 'function_steps');
        const result = new Map();
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
    async parseFlowFunctions() {
        const functionsDir = path.join(this.flowDir, 'functions');
        const functions = new Map();
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
    async parseGlobalFunctions() {
        const functions = new Map();
        // Find project root by looking for a functions directory that's not inside a flows directory
        let currentDir = this.flowDir;
        let projectRoot = null;
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
    async parseEntities() {
        // Find project root to locate config/entities.yaml
        // Project root is the parent of the 'flows' directory
        let currentDir = this.flowDir;
        let projectRoot = null;
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
            const parsed = yaml.load(content);
            console.log('Parsed entities YAML:', JSON.stringify(parsed, null, 2).substring(0, 500));
            // Handle different YAML formats:
            // 1. { entities: [...] } - root 'entities' key with array
            // 2. [...] - direct array
            // 3. { entityName: { ... }, ... } - object with entity names as keys
            let entitiesArray = [];
            if (parsed && parsed.entities && Array.isArray(parsed.entities)) {
                // Format: { entities: [...] }
                entitiesArray = parsed.entities;
            }
            else if (Array.isArray(parsed)) {
                // Format: direct array
                entitiesArray = parsed;
            }
            else if (parsed && typeof parsed === 'object') {
                // Format: { entityName: { ... }, ... }
                entitiesArray = Object.entries(parsed).map(([name, data]) => ({
                    name: data.name || name,
                    description: data.description,
                    entity_type: data.entity_type,
                    config: data.config || {}
                }));
            }
            console.log(`Found ${entitiesArray.length} entities`);
            return entitiesArray.map((entity) => ({
                name: entity.name,
                description: entity.description || '',
                entity_type: entity.entity_type,
                config: entity.config || {}
            }));
        }
        catch (error) {
            console.error('Error parsing entities.yaml:', error);
        }
        return [];
    }
    getFlowFunctionPath(funcName) {
        return path.join(this.flowDir, 'functions', `${funcName}.py`);
    }
    getGlobalFunctionPath(funcName) {
        // Find project root (same logic as parseGlobalFunctions)
        let currentDir = this.flowDir;
        let projectRoot = null;
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
    extractFunctionDescription(filePath) {
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
        }
        catch (error) {
            // Ignore errors reading function files
        }
        return '';
    }
    extractGotoSteps(filePath) {
        const gotoSteps = [];
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
        }
        catch (error) {
            // Ignore errors reading function files
        }
        return gotoSteps;
    }
    extractHasExitFlow(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return /conv\.exit_flow\s*\(/.test(content);
        }
        catch (error) {
            return false;
        }
    }
    parseTransitions(prompt) {
        const transitions = [];
        // Match {{fn:function_name}} or {{fn:function_name}}('param') - global functions
        const fnRegex = /\{\{fn:(\w+)\}\}(?:\([^)]*\))?/g;
        let match;
        while ((match = fnRegex.exec(prompt)) !== null) {
            transitions.push({
                type: 'function',
                target: match[1]
            });
        }
        // Match {{ft:function_name}} - flow functions
        const ftRegex = /\{\{ft:(\w+)\}\}/g;
        while ((match = ftRegex.exec(prompt)) !== null) {
            transitions.push({
                type: 'flow-function',
                target: match[1]
            });
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
    formatStepDetails(step, flowFunctions, globalFunctions) {
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
        const configDetails = [];
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
exports.FlowParser = FlowParser;


/***/ }),
/* 30 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getWebviewContent = getWebviewContent;
exports.getErrorWebviewContent = getErrorWebviewContent;
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
/**
 * Generates the webview HTML content with proper CSP
 */
function getWebviewContent(webview, extensionUri) {
    // Load HTML content from the extension directory
    const htmlPath = path.join(extensionUri.fsPath, 'src', 'flowViewer.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    // Add CSP meta tag if not present
    const cspSource = webview.cspSource;
    // Note: VS Code adds its own CSP, so we need to ensure our CSP allows what we need
    // The CSP needs to allow: scripts from unpkg, inline scripts, and connections to unpkg
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource} https://*.vscode-cdn.net https://unpkg.com 'unsafe-inline' 'unsafe-eval'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} https: data:; connect-src ${cspSource} https://*.vscode-cdn.net https://unpkg.com; font-src ${cspSource} https: data:;">`;
    // Replace existing CSP or insert new one
    if (htmlContent.includes('Content-Security-Policy')) {
        // Replace existing CSP
        htmlContent = htmlContent.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i, cspMeta);
    }
    else {
        // Insert CSP meta tag after the viewport meta tag
        htmlContent = htmlContent.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', `<meta name="viewport" content="width=device-width, initial-scale=1.0">\n    ${cspMeta}`);
    }
    return htmlContent;
}
/**
 * Generates an error webview HTML content
 */
function getErrorWebviewContent(errorMessage) {
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


/***/ }),
/* 31 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WebviewMessageHandler = void 0;
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(3));
const path = __importStar(__webpack_require__(2));
const yaml = __importStar(__webpack_require__(4));
const flowParser_1 = __webpack_require__(29);
const functionUtils_1 = __webpack_require__(32);
/**
 * Converts a string to snake_case
 * Handles: camelCase, PascalCase, spaces, hyphens, and mixed formats
 */
function toSnakeCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase -> camel_Case
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') // XMLParser -> XML_Parser
        .replace(/[\s\-]+/g, '_') // spaces and hyphens to underscores
        .replace(/[^a-zA-Z0-9_]/g, '') // remove non-alphanumeric (except underscores)
        .replace(/_+/g, '_') // collapse multiple underscores
        .replace(/^_|_$/g, '') // trim leading/trailing underscores
        .toLowerCase();
}
/**
 * Handles messages from the webview
 */
class WebviewMessageHandler {
    panel;
    flowDir;
    flowGraphData;
    constructor(panel, flowDir) {
        this.panel = panel;
        this.flowDir = flowDir;
    }
    /**
     * Gets the path to the entities.yaml file
     */
    getEntitiesFilePath() {
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
     * Sets the current flow graph data
     */
    setFlowGraphData(data) {
        this.flowGraphData = data;
    }
    /**
     * Handles incoming messages from the webview
     */
    async handleMessage(message) {
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
            case 'createStep':
                await this.handleCreateStep(message.stepName, message.stepType, message.forCondition);
                break;
            case 'deleteStep':
                await this.handleDeleteStep(message.nodeId, message.filePath);
                break;
            case 'showError':
                vscode.window.showErrorMessage(message.message);
                break;
        }
    }
    handleShowMessage(type, text) {
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
    async handleReady() {
        console.log('Webview ready, sending flow graph');
        if (this.flowGraphData) {
            this.panel.webview.postMessage({
                command: 'loadFlow',
                flowGraph: this.flowGraphData
            });
        }
        else {
            console.warn('Webview ready but flow graph not yet parsed');
        }
    }
    async handleOpenFunction(filePath) {
        if (filePath && fs.existsSync(filePath)) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        }
        else {
            vscode.window.showErrorMessage(`Function file not found: ${filePath}`);
        }
    }
    async handleConfirmDiscardAll(count) {
        const result = await vscode.window.showWarningMessage(`Are you sure you want to discard all ${count} modified node(s)? This cannot be undone.`, { modal: true }, 'Discard All', 'Cancel');
        // Send result back to webview
        this.panel.webview.postMessage({
            command: 'discardAllConfirmed',
            confirmed: result === 'Discard All'
        });
    }
    async handleSaveStep(message) {
        const { stepFilePath, prompt, asrBiasing, dtmfConfig, extractedEntities, conditions, nodeId, isDefaultStep } = message;
        try {
            // Read existing YAML file
            const content = fs.readFileSync(stepFilePath, 'utf8');
            const stepData = yaml.load(content);
            // Extract function references from old and new prompts
            const oldPrompt = stepData.prompt || '';
            const oldFunctions = (0, functionUtils_1.extractFunctionReferences)(oldPrompt);
            const newFunctions = (0, functionUtils_1.extractFunctionReferences)(prompt);
            // Check if functions were added or removed
            const functionsChanged = !(0, functionUtils_1.areFunctionSetsEqual)(oldFunctions, newFunctions);
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
            }
            else {
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
                const parser = new flowParser_1.FlowParser(this.flowDir);
                const updatedFlowGraph = await parser.parseFlow();
                this.flowGraphData = updatedFlowGraph;
                // Send updated flow to webview
                this.panel.webview.postMessage({
                    command: 'loadFlow',
                    flowGraph: updatedFlowGraph
                });
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error saving step: ${errorMessage}`);
            console.error('Error saving step:', error);
        }
    }
    async handleSaveEntities(entities) {
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
            vscode.window.showInformationMessage(`Entities saved successfully (${entities.length} entities)`);
            // Reload the flow to update entities in the graph
            const parser = new flowParser_1.FlowParser(this.flowDir);
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
        }
        catch (error) {
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
    async handleCreateStep(stepName, stepType, forCondition) {
        try {
            // Convert step name to snake_case for file naming only
            // The name field in YAML keeps the original user input
            const snakeCaseName = toSnakeCase(stepName);
            // Determine target directory and file content based on step type
            let targetDir;
            let fileContent;
            let fileName;
            if (stepType === 'function_step') {
                // Function steps go in function_steps directory as Python files
                // Function name must be snake_case for valid Python
                targetDir = path.join(this.flowDir, 'function_steps');
                fileName = `${snakeCaseName}.py`;
                fileContent = this.getFunctionStepTemplate(snakeCaseName);
            }
            else {
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
            const parser = new flowParser_1.FlowParser(this.flowDir);
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
            }
            else if (stepType === 'function_step') {
                // For function steps, open the Python file in editor
                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc);
            }
            else {
                // Tell the webview to select and show the new step
                this.panel.webview.postMessage({
                    command: 'selectNode',
                    nodeId: snakeCaseName
                });
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error creating step: ${errorMessage}`);
            console.error('Error creating step:', error);
        }
    }
    getStepTemplate(stepName, stepType) {
        if (stepType === 'default_step') {
            // No Code Step template
            return `name: ${stepName}
step_type: default_step
prompt: |
  Enter your prompt here.
extracted_entities: []
conditions: []
`;
        }
        else {
            // Advanced Step template
            return `name: ${stepName}
step_type: advanced_step
prompt: |
  Enter your prompt here.
`;
        }
    }
    getFunctionStepTemplate(stepName) {
        return `from imports import *  # <AUTO GENERATED>


def ${stepName}(conv: Conversation, flow: Flow):

    condition_1 = False
    if condition_1:
        pass
`;
    }
    async handleDeleteStep(nodeId, filePath) {
        try {
            // Confirm deletion
            const result = await vscode.window.showWarningMessage(`Are you sure you want to delete the step "${nodeId}"? This cannot be undone.`, { modal: true }, 'Delete', 'Cancel');
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
            const parser = new flowParser_1.FlowParser(this.flowDir);
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error deleting step: ${errorMessage}`);
            console.error('Error deleting step:', error);
        }
    }
}
exports.WebviewMessageHandler = WebviewMessageHandler;


/***/ }),
/* 32 */
/***/ ((__unused_webpack_module, exports) => {


/**
 * Utility functions for working with function references in prompts
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.extractFunctionReferences = extractFunctionReferences;
exports.areFunctionSetsEqual = areFunctionSetsEqual;
/**
 * Extracts function references from a prompt string.
 * Returns a Set of function identifiers in the format "type:name" (e.g., "fn:functionName" or "ft:functionName")
 */
function extractFunctionReferences(prompt) {
    const functions = new Set();
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
function areFunctionSetsEqual(set1, set2) {
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


/***/ }),
/* 33 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PythonReferencesProvider = exports.PythonHoverProvider = exports.PythonDefinitionProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
const pythonFunctionResolver_1 = __webpack_require__(34);
const debug_1 = __webpack_require__(35);
/**
 * Helper function to extract function call pattern from a line at a given position
 * Returns { type: 'conv' | 'flow', functionName: string, range: vscode.Range } or null
 */
function extractFunctionCall(document, position) {
    const line = document.lineAt(position);
    const lineText = line.text;
    const offset = position.character;
    // Quick check: if the line doesn't contain "conv.functions" or "flow.functions", return immediately
    if (!lineText.includes('conv.functions') && !lineText.includes('flow.functions')) {
        return null;
    }
    // First, try to get the word at the cursor position
    // This helps when user clicks directly on the function name
    const wordRange = document.getWordRangeAtPosition(position, /\w+/);
    let searchStart = 0;
    let searchEnd = lineText.length;
    if (wordRange) {
        // Expand search to include context around the word
        // Look backwards up to 50 characters to find "conv.functions." or "flow.functions."
        searchStart = Math.max(0, wordRange.start.character - 50);
        searchEnd = Math.min(lineText.length, wordRange.end.character + 50);
    }
    const searchText = lineText.substring(searchStart, searchEnd);
    // Try to match conv.functions.function_name or flow.functions.function_name
    // This regex matches the full pattern including the function name
    const patterns = [
        // Match conv.functions.function_name (with optional parentheses and arguments)
        {
            regex: /conv\.functions\.(\w+)(?:\([^)]*\))?/g,
            type: 'conv'
        },
        // Match flow.functions.function_name (with optional parentheses and arguments)
        {
            regex: /flow\.functions\.(\w+)(?:\([^)]*\))?/g,
            type: 'flow'
        }
    ];
    for (const pattern of patterns) {
        let match;
        pattern.regex.lastIndex = 0; // Reset regex
        while ((match = pattern.regex.exec(searchText)) !== null) {
            const matchStart = match.index;
            const matchEnd = match.index + match[0].length;
            // The match position is relative to searchText, so we need to adjust
            const absoluteMatchStart = searchStart + matchStart;
            const absoluteMatchEnd = searchStart + matchEnd;
            // Check if the cursor position is within this match
            if (offset >= absoluteMatchStart && offset <= absoluteMatchEnd) {
                const functionName = match[1];
                // Find where the function name starts in the match
                const functionNameOffset = match[0].indexOf(functionName);
                const functionNameStart = absoluteMatchStart + functionNameOffset;
                const functionNameEnd = functionNameStart + functionName.length;
                // Only return a result if the cursor is specifically on the function name part
                // Not on "conv", "flow", or "functions"
                if (offset >= functionNameStart && offset <= functionNameEnd) {
                    const startPos = new vscode.Position(position.line, functionNameStart);
                    const endPos = new vscode.Position(position.line, functionNameEnd);
                    return {
                        type: pattern.type,
                        functionName,
                        range: new vscode.Range(startPos, endPos)
                    };
                }
                // If cursor is on "conv", "flow", or "functions", return null
                return null;
            }
        }
    }
    return null;
}
/**
 * Definition provider for conv.functions and flow.functions
 */
class PythonDefinitionProvider {
    provideDefinition(document, position, token) {
        // Ultra-quick check: if line doesn't contain our patterns, return undefined immediately
        // This allows VS Code to skip our provider and use others
        const line = document.lineAt(position);
        if (!line.text.includes('conv.functions') && !line.text.includes('flow.functions')) {
            return undefined; // Return undefined to let other providers handle it
        }
        // Only process if we have our specific patterns
        const functionCall = extractFunctionCall(document, position);
        if (!functionCall) {
            return undefined; // Let other providers handle it
        }
        if (functionCall.type === 'conv') {
            return pythonFunctionResolver_1.PythonFunctionResolver.resolveConvFunction(functionCall.functionName, document);
        }
        else if (functionCall.type === 'flow') {
            return pythonFunctionResolver_1.PythonFunctionResolver.resolveFlowFunction(functionCall.functionName, document);
        }
        return undefined;
    }
}
exports.PythonDefinitionProvider = PythonDefinitionProvider;
/**
 * Hover provider for conv.functions and flow.functions
 */
class PythonHoverProvider {
    provideHover(document, position, token) {
        // Ultra-quick check: if line doesn't contain our patterns, return undefined immediately
        const line = document.lineAt(position);
        if (!line.text.includes('conv.functions') && !line.text.includes('flow.functions')) {
            return undefined; // Return undefined to let other providers handle it
        }
        const functionCall = extractFunctionCall(document, position);
        if (!functionCall) {
            return undefined;
        }
        let functionPath = null;
        let functionType = '';
        if (functionCall.type === 'conv') {
            const location = pythonFunctionResolver_1.PythonFunctionResolver.resolveConvFunction(functionCall.functionName, document);
            if (location) {
                functionPath = location.uri.fsPath;
                functionType = 'Global function';
            }
        }
        else if (functionCall.type === 'flow') {
            const location = pythonFunctionResolver_1.PythonFunctionResolver.resolveFlowFunction(functionCall.functionName, document);
            if (location) {
                functionPath = location.uri.fsPath;
                functionType = 'Flow function';
            }
        }
        if (functionPath) {
            const description = pythonFunctionResolver_1.PythonFunctionResolver.getFunctionDescription(functionPath);
            const parameters = pythonFunctionResolver_1.PythonFunctionResolver.getFunctionParameters(functionPath);
            const hoverText = new vscode.MarkdownString();
            hoverText.appendMarkdown(`**${functionType}**: \`${functionCall.functionName}\``);
            if (description) {
                hoverText.appendMarkdown(`\n\n${description}`);
            }
            if (parameters.length > 0) {
                hoverText.appendMarkdown(`\n\n**Parameters:**`);
                for (const param of parameters) {
                    if (param.description) {
                        hoverText.appendMarkdown(`\n- \`${param.name}\`: ${param.description}`);
                    }
                    else {
                        hoverText.appendMarkdown(`\n- \`${param.name}\``);
                    }
                }
            }
            hoverText.appendMarkdown(`\n\n*${functionPath}*`);
            return new vscode.Hover(hoverText, functionCall.range);
        }
        return undefined;
    }
}
exports.PythonHoverProvider = PythonHoverProvider;
/**
 * Helper function to determine if a file is a function definition file
 * and extract the function name and type
 */
function getFunctionInfoFromFile(filePath) {
    const fileName = path.basename(filePath, '.py');
    const dirName = path.dirname(filePath);
    // Check if this is a global function (in project_root/functions/function_name.py)
    const projectRoot = pythonFunctionResolver_1.PythonFunctionResolver.findProjectRoot(filePath);
    if (projectRoot) {
        const globalFunctionsDir = path.join(projectRoot, 'functions');
        if (dirName === globalFunctionsDir) {
            return { functionName: fileName, type: 'conv' };
        }
        // Check if this is a flow function (in project_root/functions/flow_name/function_name.py)
        const relativePath = path.relative(globalFunctionsDir, dirName);
        const parts = relativePath.split(path.sep);
        if (parts.length === 1 && parts[0] && parts[0] !== '.') {
            // We're in functions/flow_name/, so this is a flow function
            return { functionName: fileName, type: 'flow' };
        }
    }
    return null;
}
/**
 * Searches for all references to a function in Python files
 * Optimized to use direct file reads instead of opening documents
 */
async function findFunctionReferences(functionName, type, excludeFile, token) {
    const locations = [];
    // Escape the function name for regex
    const escapedFunctionName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Build search pattern - match conv.functions.functionName or flow.functions.functionName
    // with optional whitespace and parentheses
    const pattern = type === 'conv'
        ? new RegExp(`conv\\.functions\\.${escapedFunctionName}(?:\\s*\\([^)]*\\))?`, 'g')
        : new RegExp(`flow\\.functions\\.${escapedFunctionName}(?:\\s*\\([^)]*\\))?`, 'g');
    // Quick string check pattern (for fast filtering before regex)
    const quickCheckPattern = type === 'conv'
        ? `conv.functions.${functionName}`
        : `flow.functions.${functionName}`;
    (0, debug_1.debugLog)(`Searching for ${type === 'conv' ? 'conv' : 'flow'}.functions.${functionName}`);
    try {
        // Get all Python files in the workspace (with limit)
        const pythonFiles = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**', 5000 // Limit to 5000 files for performance
        );
        (0, debug_1.debugLog)(`Checking ${pythonFiles.length} Python files`);
        // Process files in batches to avoid blocking
        const batchSize = 50;
        for (let i = 0; i < pythonFiles.length; i += batchSize) {
            // Check cancellation token
            if (token.isCancellationRequested) {
                break;
            }
            const batch = pythonFiles.slice(i, i + batchSize);
            // Process batch
            for (const fileUri of batch) {
                // Skip the function definition file itself
                if (excludeFile && fileUri.fsPath === excludeFile) {
                    continue;
                }
                if (token.isCancellationRequested) {
                    break;
                }
                try {
                    // Read file directly (faster than opening as document)
                    const fileContent = fs.readFileSync(fileUri.fsPath, 'utf8');
                    // Quick check: skip if pattern not found
                    if (!fileContent.includes(quickCheckPattern)) {
                        continue;
                    }
                    // Split into lines and search
                    const lines = fileContent.split('\n');
                    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                        if (token.isCancellationRequested) {
                            break;
                        }
                        const line = lines[lineIndex];
                        let match;
                        pattern.lastIndex = 0; // Reset regex
                        while ((match = pattern.exec(line)) !== null) {
                            // Find the function name within the match
                            const functionNameOffset = match[0].indexOf(functionName);
                            if (functionNameOffset !== -1) {
                                const functionNameStart = match.index + functionNameOffset;
                                const functionNameEnd = functionNameStart + functionName.length;
                                locations.push(new vscode.Location(fileUri, new vscode.Range(new vscode.Position(lineIndex, functionNameStart), new vscode.Position(lineIndex, functionNameEnd))));
                            }
                        }
                    }
                }
                catch (error) {
                    // Skip files that can't be read
                    (0, debug_1.debugLog)(`Error reading file ${fileUri.fsPath}:`, error);
                }
            }
            // Yield control periodically to prevent blocking
            if (i + batchSize < pythonFiles.length) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
    }
    catch (error) {
        // If search fails, fall back to empty results
        (0, debug_1.debugLog)(`Error searching for references:`, error);
    }
    (0, debug_1.debugLog)(`Found ${locations.length} references to ${functionName}`);
    return locations;
}
/**
 * References provider for Python functions
 * Finds all places where a function is called using conv.functions.functionName or flow.functions.functionName
 */
class PythonReferencesProvider {
    provideReferences(document, position, context, token) {
        // Check if we're in a function definition file
        const functionInfo = getFunctionInfoFromFile(document.uri.fsPath);
        if (!functionInfo) {
            // Not a function file, check if we're on a function call
            const functionCall = extractFunctionCall(document, position);
            if (functionCall) {
                // We're on a function call, find all references to this function
                return findFunctionReferences(functionCall.functionName, functionCall.type, undefined, token);
            }
            return undefined;
        }
        // We're in a function definition file, find all references to this function
        return findFunctionReferences(functionInfo.functionName, functionInfo.type, document.uri.fsPath, token);
    }
}
exports.PythonReferencesProvider = PythonReferencesProvider;


/***/ }),
/* 34 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PythonFunctionResolver = void 0;
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
const vscode = __importStar(__webpack_require__(1));
const debug_1 = __webpack_require__(35);
/**
 * Resolves function paths for conv.functions and flow.functions in Python files
 */
class PythonFunctionResolver {
    /**
     * Finds the project root (directory containing a functions folder that's not inside flows)
     */
    static findProjectRoot(filePath) {
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
    static findFlowDirectory(filePath) {
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
    static getFlowName(filePath) {
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
     * Resolves conv.functions.function_name() to the global function file path
     */
    static resolveConvFunction(functionName, document) {
        (0, debug_1.debugLog)('Resolving conv function:', functionName, 'for file:', document.uri.fsPath);
        const projectRoot = this.findProjectRoot(document.uri.fsPath);
        (0, debug_1.debugLog)('Project root found:', projectRoot);
        if (!projectRoot) {
            (0, debug_1.debugLog)('No project root found');
            return null;
        }
        const functionPath = path.join(projectRoot, 'functions', `${functionName}.py`);
        (0, debug_1.debugLog)('Looking for function at:', functionPath, 'exists:', fs.existsSync(functionPath));
        if (fs.existsSync(functionPath)) {
            return new vscode.Location(vscode.Uri.file(functionPath), new vscode.Position(0, 0));
        }
        return null;
    }
    /**
     * Resolves flow.functions.function_name() to the flow function file path
     * Flow functions are located at: project_root/functions/flow_name/function_name.py
     * The flow is determined by finding which flow the current file belongs to
     */
    static resolveFlowFunction(functionName, document) {
        (0, debug_1.debugLog)('Resolving flow function:', functionName, 'for file:', document.uri.fsPath);
        const projectRoot = this.findProjectRoot(document.uri.fsPath);
        (0, debug_1.debugLog)('Project root found:', projectRoot);
        if (!projectRoot) {
            (0, debug_1.debugLog)('No project root found');
            return null;
        }
        const flowName = this.getFlowName(document.uri.fsPath);
        (0, debug_1.debugLog)('Flow name:', flowName);
        if (!flowName) {
            (0, debug_1.debugLog)('No flow name found');
            return null;
        }
        // Flow functions are in project_root/functions/flow_name/function_name.py
        const functionPath = path.join(projectRoot, 'functions', flowName, `${functionName}.py`);
        (0, debug_1.debugLog)('Looking for flow function at:', functionPath, 'exists:', fs.existsSync(functionPath));
        if (fs.existsSync(functionPath)) {
            return new vscode.Location(vscode.Uri.file(functionPath), new vscode.Position(0, 0));
        }
        return null;
    }
    /**
     * Gets all available global function names
     */
    static getGlobalFunctionNames(document) {
        const projectRoot = this.findProjectRoot(document.uri.fsPath);
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
     * Flow functions are located at: project_root/functions/flow_name/
     */
    static getFlowFunctionNames(document) {
        const projectRoot = this.findProjectRoot(document.uri.fsPath);
        if (!projectRoot) {
            return [];
        }
        const flowName = this.getFlowName(document.uri.fsPath);
        if (!flowName) {
            return [];
        }
        // Flow functions are in project_root/functions/flow_name/
        const functionsDir = path.join(projectRoot, 'functions', flowName);
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
    static getFunctionDescription(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            // Only extract @func_description decorator
            const descMatch = content.match(/@func_description\(["']([^"']+)["']\)/);
            if (descMatch) {
                return descMatch[1];
            }
        }
        catch (error) {
            // Ignore errors reading function files
        }
        return '';
    }
    /**
     * Extracts function parameters from @func_parameter decorators
     * Returns an array of { name: string, description?: string }
     */
    static getFunctionParameters(filePath) {
        const parameters = [];
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
                let paramDescription = undefined;
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
                    (0, debug_1.debugLog)('Found parameter:', paramName, 'description:', paramDescription);
                    parameters.push({
                        name: paramName,
                        description: paramDescription
                    });
                }
            }
        }
        catch (error) {
            console.error('[ADK Extension] Error extracting function parameters:', error);
        }
        return parameters;
    }
}
exports.PythonFunctionResolver = PythonFunctionResolver;


/***/ }),
/* 35 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.initializeDebug = initializeDebug;
exports.isDebugMode = isDebugMode;
exports.toggleDebugMode = toggleDebugMode;
exports.debugLog = debugLog;
exports.debugError = debugError;
const vscode = __importStar(__webpack_require__(1));
const DEBUG_MODE_KEY = 'adk-extension.debugMode';
let extensionContext = null;
let debugMode = false;
/**
 * Initializes the debug utility with the extension context
 */
function initializeDebug(context) {
    extensionContext = context;
    debugMode = context.globalState.get(DEBUG_MODE_KEY, false);
}
/**
 * Gets the current debug mode state
 */
function isDebugMode() {
    return debugMode;
}
/**
 * Toggles debug mode on/off
 */
async function toggleDebugMode() {
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
function debugLog(...args) {
    if (debugMode) {
        console.log('[ADK Extension]', ...args);
    }
}
/**
 * Debug error - always logs errors regardless of debug mode
 */
function debugError(...args) {
    console.error('[ADK Extension]', ...args);
}


/***/ }),
/* 36 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createJiraTicket = createJiraTicket;
exports.getJiraProjects = getJiraProjects;
exports.getJiraComponents = getJiraComponents;
exports.getJiraTicketUrl = getJiraTicketUrl;
const https = __importStar(__webpack_require__(37));
/**
 * Gets the current user's account ID from JIRA
 */
async function getCurrentUserAccountId(jiraUrl, jiraEmail, jiraApiToken) {
    return new Promise((resolve, reject) => {
        let hostname;
        let basePath = '';
        try {
            const url = new URL(jiraUrl);
            hostname = url.hostname;
            basePath = url.pathname.replace(/\/$/, '');
        }
        catch (error) {
            reject(new Error(`Invalid JIRA_URL: ${jiraUrl}`));
            return;
        }
        const apiPath = `${basePath}/rest/api/3/myself`;
        const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');
        const options = {
            hostname,
            path: apiPath,
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const user = JSON.parse(data);
                        // JIRA API v3 returns accountId
                        resolve(user.accountId || null);
                    }
                    catch (error) {
                        reject(new Error('Failed to parse JIRA API response'));
                    }
                }
                else {
                    // If we can't get the user info, return null (assignment will be skipped)
                    resolve(null);
                }
            });
        });
        req.on('error', (error) => {
            // On error, return null instead of rejecting (assignment will be skipped)
            resolve(null);
        });
        req.setTimeout(10000, () => {
            req.destroy();
            resolve(null);
        });
        req.end();
    });
}
/**
 * Creates a JIRA ticket with the given details
 */
async function createJiraTicket(summary, description, project, component) {
    return new Promise(async (resolve, reject) => {
        const jiraUrl = process.env.JIRA_URL || 'https://poly-ai.atlassian.net';
        const jiraEmail = process.env.JIRA_USER;
        const jiraApiToken = process.env.JIRA_API_TOKEN;
        if (!jiraEmail || !jiraApiToken) {
            reject(new Error('JIRA_USER and JIRA_API_TOKEN environment variables are required'));
            return;
        }
        // Parse JIRA URL to get hostname and path
        let hostname;
        let basePath = '';
        try {
            const url = new URL(jiraUrl);
            hostname = url.hostname;
            basePath = url.pathname.replace(/\/$/, ''); // Remove trailing slash
        }
        catch (error) {
            reject(new Error(`Invalid JIRA_URL: ${jiraUrl}`));
            return;
        }
        const apiPath = `${basePath}/rest/api/3/issue`;
        const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');
        // Convert description to Atlassian Document Format (ADF)
        // JIRA API v3 requires ADF format for description field
        const descriptionADF = convertTextToADF(description);
        // Get current user's account ID for assignment
        let accountId = null;
        try {
            accountId = await getCurrentUserAccountId(jiraUrl, jiraEmail, jiraApiToken);
        }
        catch (error) {
            console.error('[JIRA] Failed to get current user account ID:', error);
            // Continue without assignment if we can't get account ID
        }
        // Build fields object - start with required fields
        const fields = {
            summary,
            description: descriptionADF,
            project: {
                key: project
            },
            issuetype: {
                name: 'Task'
            }
        };
        // Add assignee (the JIRA user) using accountId
        // JIRA API v3 requires accountId for assignment
        if (accountId) {
            fields.assignee = {
                accountId: accountId
            };
        }
        // Only add components if provided and not empty
        // Note: Component name must match exactly (case-sensitive) with existing component in JIRA
        if (component && component.trim().length > 0) {
            fields.components = [{ name: component.trim() }];
        }
        const requestData = JSON.stringify({
            fields
        });
        const options = {
            hostname,
            path: apiPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`,
                'Content-Length': Buffer.byteLength(requestData)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 201) {
                    try {
                        const issue = JSON.parse(data);
                        resolve(issue);
                    }
                    catch (error) {
                        reject(new Error('Failed to parse JIRA API response'));
                    }
                }
                else {
                    let errorMessage = `JIRA API returned status ${res.statusCode}`;
                    try {
                        const errorData = JSON.parse(data);
                        if (errorData.errorMessages && errorData.errorMessages.length > 0) {
                            errorMessage = errorData.errorMessages.join(', ');
                        }
                        else if (errorData.errors) {
                            // JIRA v3 API uses 'errors' object for field-level errors
                            const errorKeys = Object.keys(errorData.errors);
                            const errorValues = errorKeys.map(key => `${key}: ${errorData.errors[key]}`);
                            errorMessage = errorValues.join(', ');
                        }
                        else if (errorData.message) {
                            errorMessage = errorData.message;
                        }
                        // Log the full error for debugging
                        console.error('[JIRA] Full error response:', JSON.stringify(errorData, null, 2));
                    }
                    catch {
                        // If parsing fails, use the raw data
                        errorMessage = data.substring(0, 500);
                    }
                    // Log the request payload for debugging
                    console.error('[JIRA] Request payload:', requestData);
                    reject(new Error(errorMessage));
                }
            });
        });
        req.on('error', (error) => {
            reject(error);
        });
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.write(requestData);
        req.end();
    });
}
/**
 * Converts plain text to Atlassian Document Format (ADF)
 * JIRA API v3 requires descriptions in ADF format
 * Simplified version to keep content size manageable
 */
function convertTextToADF(text) {
    if (!text || text.trim().length === 0) {
        return {
            type: 'doc',
            version: 1,
            content: []
        };
    }
    const content = [];
    // Split by {code} markers to separate regular text from code blocks
    const parts = text.split(/{code}/);
    let inCodeBlock = text.trim().startsWith('{code}');
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) {
            continue;
        }
        if (inCodeBlock) {
            // This is code content - use codeBlock node
            content.push({
                type: 'codeBlock',
                attrs: {
                    language: 'text'
                },
                content: [
                    {
                        type: 'text',
                        text: part
                    }
                ]
            });
        }
        else {
            // This is regular text - split into paragraphs
            const paragraphs = part.split(/\n\n+/).filter(p => p.trim().length > 0);
            for (const para of paragraphs) {
                const lines = para.split('\n').filter(l => l.trim().length > 0);
                if (lines.length === 0) {
                    continue;
                }
                const paraContent = [];
                lines.forEach((line, idx) => {
                    paraContent.push({
                        type: 'text',
                        text: line
                    });
                    if (idx < lines.length - 1) {
                        paraContent.push({
                            type: 'hardBreak'
                        });
                    }
                });
                content.push({
                    type: 'paragraph',
                    content: paraContent
                });
            }
        }
        // Toggle code block state after each part
        inCodeBlock = !inCodeBlock;
    }
    // If no content was created, add an empty paragraph
    if (content.length === 0) {
        content.push({
            type: 'paragraph',
            content: []
        });
    }
    return {
        type: 'doc',
        version: 1,
        content: content
    };
}
/**
 * Fetches all accessible JIRA projects
 */
async function getJiraProjects() {
    return new Promise((resolve, reject) => {
        const jiraUrl = process.env.JIRA_URL || 'https://poly-ai.atlassian.net';
        const jiraEmail = process.env.JIRA_USER;
        const jiraApiToken = process.env.JIRA_API_TOKEN;
        if (!jiraEmail || !jiraApiToken) {
            reject(new Error('JIRA_USER and JIRA_API_TOKEN environment variables are required'));
            return;
        }
        let hostname;
        let basePath = '';
        try {
            const url = new URL(jiraUrl);
            hostname = url.hostname;
            basePath = url.pathname.replace(/\/$/, '');
        }
        catch (error) {
            reject(new Error(`Invalid JIRA_URL: ${jiraUrl}`));
            return;
        }
        const apiPath = `${basePath}/rest/api/3/project`;
        const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');
        const options = {
            hostname,
            path: apiPath,
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const projects = JSON.parse(data);
                        resolve(projects);
                    }
                    catch (error) {
                        reject(new Error('Failed to parse JIRA API response'));
                    }
                }
                else {
                    reject(new Error(`JIRA API returned status ${res.statusCode}`));
                }
            });
        });
        req.on('error', (error) => {
            reject(error);
        });
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}
/**
 * Fetches components for a specific JIRA project
 */
async function getJiraComponents(projectKey) {
    return new Promise((resolve, reject) => {
        const jiraUrl = process.env.JIRA_URL || 'https://poly-ai.atlassian.net';
        const jiraEmail = process.env.JIRA_USER;
        const jiraApiToken = process.env.JIRA_API_TOKEN;
        if (!jiraEmail || !jiraApiToken) {
            reject(new Error('JIRA_USER and JIRA_API_TOKEN environment variables are required'));
            return;
        }
        let hostname;
        let basePath = '';
        try {
            const url = new URL(jiraUrl);
            hostname = url.hostname;
            basePath = url.pathname.replace(/\/$/, '');
        }
        catch (error) {
            reject(new Error(`Invalid JIRA_URL: ${jiraUrl}`));
            return;
        }
        const apiPath = `${basePath}/rest/api/3/project/${projectKey}`;
        const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');
        const options = {
            hostname,
            path: apiPath,
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const project = JSON.parse(data);
                        const components = (project.components || []);
                        resolve(components);
                    }
                    catch (error) {
                        reject(new Error('Failed to parse JIRA API response'));
                    }
                }
                else {
                    reject(new Error(`JIRA API returned status ${res.statusCode}`));
                }
            });
        });
        req.on('error', (error) => {
            reject(error);
        });
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}
/**
 * Gets the JIRA ticket URL from a ticket key
 */
function getJiraTicketUrl(ticketKey) {
    const jiraUrl = process.env.JIRA_URL || 'https://poly-ai.atlassian.net';
    return `${jiraUrl.replace(/\/$/, '')}/browse/${ticketKey}`;
}


/***/ }),
/* 37 */
/***/ ((module) => {

module.exports = require("https");

/***/ }),
/* 38 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getCurrentBranch = getCurrentBranch;
exports.getBranchDiff = getBranchDiff;
exports.getChangedFiles = getChangedFiles;
exports.getProjectDirectory = getProjectDirectory;
exports.formatDiffForJira = formatDiffForJira;
exports.getProjectName = getProjectName;
exports.createSummaryFromBranch = createSummaryFromBranch;
const child_process_1 = __webpack_require__(39);
const util_1 = __webpack_require__(40);
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
// @ts-ignore - js-yaml types may not be available
const yaml = __importStar(__webpack_require__(4));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Gets the current git branch name
 */
async function getCurrentBranch(workspaceRoot) {
    try {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
            cwd: workspaceRoot
        });
        return stdout.trim();
    }
    catch (error) {
        throw new Error('Failed to get current branch. Make sure you are in a git repository.');
    }
}
/**
 * Gets the diff between the current branch and the base branch (usually main/master)
 */
async function getBranchDiff(workspaceRoot, branch, baseBranch = 'main') {
    try {
        // Try to get diff with main first, fallback to master
        let diff = '';
        try {
            const { stdout } = await execAsync(`git diff ${baseBranch}...${branch}`, {
                cwd: workspaceRoot,
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });
            diff = stdout;
        }
        catch {
            // Try with master if main doesn't exist
            if (baseBranch === 'main') {
                const { stdout } = await execAsync(`git diff master...${branch}`, {
                    cwd: workspaceRoot,
                    maxBuffer: 10 * 1024 * 1024
                });
                diff = stdout;
            }
            else {
                throw new Error('Failed to get diff');
            }
        }
        return diff;
    }
    catch (error) {
        throw new Error('Failed to get branch diff. Make sure the base branch exists.');
    }
}
/**
 * Gets the list of changed files in the current branch
 */
async function getChangedFiles(workspaceRoot, branch, baseBranch = 'main') {
    try {
        let files = [];
        try {
            const { stdout } = await execAsync(`git diff --name-only ${baseBranch}...${branch}`, {
                cwd: workspaceRoot
            });
            files = stdout.trim().split('\n').filter(f => f.length > 0);
        }
        catch {
            // Try with master if main doesn't exist
            if (baseBranch === 'main') {
                const { stdout } = await execAsync(`git diff --name-only master...${branch}`, {
                    cwd: workspaceRoot
                });
                files = stdout.trim().split('\n').filter(f => f.length > 0);
            }
            else {
                throw new Error('Failed to get changed files');
            }
        }
        return files;
    }
    catch (error) {
        throw new Error('Failed to get changed files');
    }
}
/**
 * Finds all project.yaml files in the workspaces
 */
function findAllProjectYamlFiles(workspaceRoot) {
    const projectYamlFiles = [];
    function searchDirectory(dir, depth = 0, maxDepth = 5) {
        if (depth > maxDepth) {
            return;
        }
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    searchDirectory(fullPath, depth + 1, maxDepth);
                }
                else if (entry.isFile() && entry.name === 'project.yaml') {
                    // Found a project.yaml file
                    const relativePath = path.relative(workspaceRoot, fullPath);
                    projectYamlFiles.push(relativePath);
                }
            }
        }
        catch (error) {
            // Skip directories we can't read
        }
    }
    searchDirectory(workspaceRoot);
    return projectYamlFiles;
}
/**
 * Checks if a changed file is in the same directory or a subdirectory of a project.yaml file
 */
function isFileInProjectDirectory(changedFile, projectYamlPath) {
    const changedFileDir = path.dirname(changedFile);
    const projectYamlDir = path.dirname(projectYamlPath);
    // Check if changed file is in the same directory or a subdirectory
    return changedFileDir === projectYamlDir || changedFileDir.startsWith(projectYamlDir + path.sep);
}
/**
 * Determines which account and project directories the changes are in
 * Detection is based on finding project.yaml files and checking if changed files
 * are in the same directory or subdirectories of those project.yaml files
 *
 * Structure: account_dir/project_dir/project.yaml
 *
 * Returns both account and project directory, prioritizing project directory for caching
 */
function getProjectDirectory(changedFiles, workspaceRoot) {
    const accountDirs = new Set();
    const projectDirs = new Set();
    // Find all project.yaml files in the workspace
    const projectYamlFiles = findAllProjectYamlFiles(workspaceRoot);
    if (projectYamlFiles.length === 0) {
        return {
            accountDir: null,
            projectDir: null
        };
    }
    // For each changed file, check if it's in a directory with a project.yaml
    for (const changedFile of changedFiles) {
        for (const projectYamlFile of projectYamlFiles) {
            if (isFileInProjectDirectory(changedFile, projectYamlFile)) {
                // Extract account_dir and project_dir from project.yaml path
                // Structure: account_dir/project_dir/project.yaml
                // account_dir is the parent of project_dir
                const parts = projectYamlFile.split(path.sep);
                if (parts.length >= 2) {
                    const projectDirName = parts[parts.length - 2]; // Directory containing project.yaml
                    const accountDir = parts[parts.length - 3]; // Parent directory of project_dir
                    if (accountDir && projectDirName) {
                        accountDirs.add(accountDir);
                        // Store as "account/project" for unique identification
                        projectDirs.add(`${accountDir}/${projectDirName}`);
                    }
                }
            }
        }
    }
    // Prioritize project directory (more specific)
    // If we found exactly one project directory, return it
    if (projectDirs.size === 1) {
        const projectDir = Array.from(projectDirs)[0];
        const [accountDir] = projectDir.split('/');
        return {
            accountDir: accountDir,
            projectDir: projectDir
        };
    }
    // If we found exactly one account directory, return it
    if (accountDirs.size === 1) {
        return {
            accountDir: Array.from(accountDirs)[0],
            projectDir: null
        };
    }
    // If multiple or none, return null (user will need to specify)
    return {
        accountDir: null,
        projectDir: null
    };
}
/**
 * Formats the diff into a readable description for JIRA
 * Reduced maxLength to avoid CONTENT_LIMIT_EXCEEDED errors
 */
function formatDiffForJira(diff, maxLength = 15000) {
    // Truncate if too long - JIRA has content limits
    let formatted = diff;
    if (formatted.length > maxLength) {
        formatted = formatted.substring(0, maxLength) + '\n\n... (diff truncated due to size limit)';
    }
    // Escape any special characters that might break JIRA formatting
    // JIRA uses {code} blocks for code
    return `{code}\n${formatted}\n{code}`;
}
/**
 * Reads the project name from project.yaml file
 * Returns the project name or null if not found
 */
function getProjectName(workspaceRoot, accountDir, projectDirName) {
    try {
        const projectYamlPath = path.join(workspaceRoot, accountDir, projectDirName, 'project.yaml');
        if (!fs.existsSync(projectYamlPath)) {
            return null;
        }
        const content = fs.readFileSync(projectYamlPath, 'utf8');
        const projectData = yaml.load(content);
        // Try common field names for project name
        return projectData?.name || projectData?.project_name || projectData?.projectName || null;
    }
    catch (error) {
        // If parsing fails, return null
        return null;
    }
}
/**
 * Creates a summary from the branch name and changed files
 */
function createSummaryFromBranch(branch, changedFiles) {
    const fileCount = changedFiles.length;
    const summary = `Changes from branch: ${branch}`;
    return summary;
}


/***/ }),
/* 39 */
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),
/* 40 */
/***/ ((module) => {

module.exports = require("util");

/***/ }),
/* 41 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getGitHubRepo = getGitHubRepo;
exports.findPRForBranch = findPRForBranch;
exports.updatePRDescription = updatePRDescription;
const https = __importStar(__webpack_require__(37));
const child_process_1 = __webpack_require__(39);
const util_1 = __webpack_require__(40);
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Gets the GitHub repository owner and name from the current git repository
 */
async function getGitHubRepo(workspaceRoot) {
    try {
        const { stdout } = await execAsync('git remote get-url origin', {
            cwd: workspaceRoot
        });
        const remoteUrl = stdout.trim();
        // Parse different git remote URL formats
        // https://github.com/owner/repo.git
        // https://github.com/owner/repo
        // git@github.com:owner/repo.git
        const httpsMatch = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (httpsMatch) {
            return {
                owner: httpsMatch[1],
                repo: httpsMatch[2]
            };
        }
        return null;
    }
    catch (error) {
        return null;
    }
}
/**
 * Finds a PR associated with the current branch
 */
async function findPRForBranch(owner, repo, branch) {
    return new Promise((resolve, reject) => {
        const githubToken = process.env.GITHUB_ACCESS_TOKEN;
        if (!githubToken) {
            reject(new Error('GITHUB_ACCESS_TOKEN environment variable is required'));
            return;
        }
        const apiPath = `/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=open`;
        const options = {
            hostname: 'api.github.com',
            path: apiPath,
            method: 'GET',
            headers: {
                'User-Agent': 'adk-extension',
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${githubToken}`
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const prs = JSON.parse(data);
                        if (prs.length > 0) {
                            resolve(prs[0]); // Return the first open PR
                        }
                        else {
                            resolve(null);
                        }
                    }
                    catch (error) {
                        reject(new Error('Failed to parse GitHub API response'));
                    }
                }
                else if (res.statusCode === 404) {
                    resolve(null);
                }
                else {
                    reject(new Error(`GitHub API returned status ${res.statusCode}`));
                }
            });
        });
        req.on('error', (error) => {
            reject(error);
        });
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}
/**
 * Updates a PR description with JIRA ticket information
 */
async function updatePRDescription(owner, repo, prNumber, jiraTicketUrl, jiraTicketKey) {
    return new Promise((resolve, reject) => {
        const githubToken = process.env.GITHUB_ACCESS_TOKEN;
        if (!githubToken) {
            reject(new Error('GITHUB_ACCESS_TOKEN environment variable is required'));
            return;
        }
        // First, get the current PR to preserve existing description
        const getOptions = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/pulls/${prNumber}`,
            method: 'GET',
            headers: {
                'User-Agent': 'adk-extension',
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${githubToken}`
            }
        };
        const getReq = https.request(getOptions, (getRes) => {
            let data = '';
            getRes.on('data', (chunk) => {
                data += chunk;
            });
            getRes.on('end', () => {
                if (getRes.statusCode !== 200) {
                    reject(new Error(`Failed to get PR: ${getRes.statusCode}`));
                    return;
                }
                try {
                    const pr = JSON.parse(data);
                    let updatedBody = pr.body || '';
                    // Check if JIRA ticket link already exists
                    if (updatedBody.includes(jiraTicketKey) || updatedBody.includes(jiraTicketUrl)) {
                        // Already exists, no need to update
                        resolve();
                        return;
                    }
                    // Add JIRA ticket link to description
                    const jiraSection = `\n\n## JIRA Ticket\n${jiraTicketKey}: ${jiraTicketUrl}`;
                    updatedBody = updatedBody + jiraSection;
                    // Update the PR
                    const updateOptions = {
                        hostname: 'api.github.com',
                        path: `/repos/${owner}/${repo}/pulls/${prNumber}`,
                        method: 'PATCH',
                        headers: {
                            'User-Agent': 'adk-extension',
                            'Accept': 'application/vnd.github.v3+json',
                            'Authorization': `Bearer ${githubToken}`,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(JSON.stringify({ body: updatedBody }))
                        }
                    };
                    const updateReq = https.request(updateOptions, (updateRes) => {
                        let updateData = '';
                        updateRes.on('data', (chunk) => {
                            updateData += chunk;
                        });
                        updateRes.on('end', () => {
                            if (updateRes.statusCode === 200) {
                                resolve();
                            }
                            else {
                                reject(new Error(`Failed to update PR: ${updateRes.statusCode}`));
                            }
                        });
                    });
                    updateReq.on('error', (error) => {
                        reject(error);
                    });
                    updateReq.setTimeout(10000, () => {
                        updateReq.destroy();
                        reject(new Error('Request timeout'));
                    });
                    updateReq.write(JSON.stringify({ body: updatedBody }));
                    updateReq.end();
                }
                catch (error) {
                    reject(new Error('Failed to parse PR data'));
                }
            });
        });
        getReq.on('error', (error) => {
            reject(error);
        });
        getReq.setTimeout(10000, () => {
            getReq.destroy();
            reject(new Error('Request timeout'));
        });
        getReq.end();
    });
}


/***/ }),
/* 42 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AgentStudioLinter = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
const pythonFunctionResolver_1 = __webpack_require__(34);
const debug_1 = __webpack_require__(35);
const pythonRules_1 = __webpack_require__(43);
const yamlRules_1 = __webpack_require__(44);
const config_1 = __webpack_require__(45);
/**
 * Agent Studio Linter
 * Provides real-time diagnostics for Agent Studio projects based on cursor rules
 */
class AgentStudioLinter {
    diagnosticCollection;
    disposables = [];
    configCache = new Map();
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('agent-studio');
    }
    /**
     * Activates the linter and sets up file watchers
     */
    activate(context) {
        (0, debug_1.debugLog)('Activating Agent Studio Linter...');
        // Lint on file open
        this.disposables.push(vscode.workspace.onDidOpenTextDocument((document) => {
            this.lintDocument(document);
        }));
        // Lint on file save
        this.disposables.push(vscode.workspace.onDidSaveTextDocument((document) => {
            this.lintDocument(document);
        }));
        // Lint on file change (with debounce)
        let timeout;
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                this.lintDocument(event.document);
            }, 500); // 500ms debounce
        }));
        // Clear diagnostics when file is closed
        this.disposables.push(vscode.workspace.onDidCloseTextDocument((document) => {
            this.diagnosticCollection.delete(document.uri);
        }));
        // Watch for .adkrc and .lasrc (legacy) file changes to re-lint affected documents
        const adkrcWatcher = vscode.workspace.createFileSystemWatcher('**/.adkrc');
        const lasrcWatcher = vscode.workspace.createFileSystemWatcher('**/.lasrc');
        const handleConfigChange = () => {
            this.configCache.clear();
            this.relintAllOpenDocuments();
        };
        this.disposables.push(adkrcWatcher.onDidChange(handleConfigChange), adkrcWatcher.onDidCreate(handleConfigChange), adkrcWatcher.onDidDelete(handleConfigChange), adkrcWatcher, lasrcWatcher.onDidChange(handleConfigChange), lasrcWatcher.onDidCreate(handleConfigChange), lasrcWatcher.onDidDelete(handleConfigChange), lasrcWatcher);
        // Lint all currently open documents
        vscode.workspace.textDocuments.forEach((document) => {
            this.lintDocument(document);
        });
        // Add to subscriptions
        context.subscriptions.push(this.diagnosticCollection);
        this.disposables.forEach(d => context.subscriptions.push(d));
        (0, debug_1.debugLog)('Agent Deployment Kit Linter activated');
    }
    /**
     * Re-lints all currently open documents (used when .adkrc or .lasrc changes)
     */
    relintAllOpenDocuments() {
        vscode.workspace.textDocuments.forEach((document) => {
            this.lintDocument(document);
        });
    }
    /**
     * Lints a document based on its language/file type
     */
    lintDocument(document) {
        // Skip non-file documents
        if (document.uri.scheme !== 'file') {
            return;
        }
        const filePath = document.uri.fsPath;
        // Check if this is an Agent Studio project file
        if (!this.isAgentStudioFile(filePath)) {
            return;
        }
        // Get config to check for disabled rules
        const config = this.getConfig(filePath);
        let diagnostics = [];
        const text = document.getText();
        if (document.languageId === 'python') {
            const pythonDiagnostics = (0, pythonRules_1.checkPythonFile)(text, filePath);
            diagnostics.push(...this.convertPythonDiagnostics(pythonDiagnostics, document));
        }
        else if (document.languageId === 'yaml' || filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
            const yamlDiagnostics = (0, yamlRules_1.checkYamlFile)(text, filePath);
            diagnostics.push(...this.convertYamlDiagnostics(yamlDiagnostics, document));
        }
        // Filter out disabled rules
        if (config.disabledRules.length > 0) {
            diagnostics = diagnostics.filter(d => {
                const code = typeof d.code === 'object' ? String(d.code.value) : String(d.code);
                return !config.disabledRules.includes(code);
            });
        }
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    /**
     * Gets the .adkrc (or .lasrc) config for a file, using cache when possible
     */
    getConfig(filePath) {
        const dir = path.dirname(filePath);
        let currentDir = dir;
        const root = path.parse(currentDir).root;
        // Find the .adkrc or .lasrc (legacy) file path first
        let configPath = null;
        while (currentDir !== root) {
            // Check for .adkrc first (preferred), then .lasrc (legacy)
            const adkCandidate = path.join(currentDir, '.adkrc');
            const lasCandidate = path.join(currentDir, '.lasrc');
            if (fs.existsSync(adkCandidate)) {
                configPath = adkCandidate;
                break;
            }
            if (fs.existsSync(lasCandidate)) {
                configPath = lasCandidate;
                break;
            }
            if (fs.existsSync(path.join(currentDir, 'imports.py')) ||
                fs.existsSync(path.join(currentDir, 'gen_decorators.py'))) {
                break;
            }
            currentDir = path.dirname(currentDir);
        }
        if (!configPath) {
            return { disabledRules: [] };
        }
        // Check cache
        const cached = this.configCache.get(configPath);
        const stats = fs.statSync(configPath);
        if (cached && cached.mtime === stats.mtimeMs) {
            return cached.config;
        }
        // Load and cache config
        const config = (0, config_1.findLasConfig)(filePath);
        this.configCache.set(configPath, { config, mtime: stats.mtimeMs });
        if (config.disabledRules.length > 0) {
            (0, debug_1.debugLog)('Loaded config, disabled rules:', config.disabledRules);
        }
        return config;
    }
    /**
     * Checks if a file is part of an Agent Studio project
     */
    isAgentStudioFile(filePath) {
        // Check if file is in a directory that has Agent Studio markers
        // (functions/, flows/, topics/, or has imports.py/gen_decorators.py nearby)
        const projectRoot = pythonFunctionResolver_1.PythonFunctionResolver.findProjectRoot(filePath);
        if (projectRoot) {
            return true;
        }
        // Also check for common Agent Studio paths
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (normalizedPath.includes('/functions/') ||
            normalizedPath.includes('/flows/') ||
            normalizedPath.includes('/topics/') ||
            normalizedPath.includes('/agent_settings/')) {
            return true;
        }
        return false;
    }
    /**
     * Converts Python diagnostics to VS Code diagnostics
     */
    convertPythonDiagnostics(pythonDiagnostics, document) {
        return pythonDiagnostics.map(pd => {
            const range = new vscode.Range(new vscode.Position(pd.line, pd.startChar), new vscode.Position(pd.line, pd.endChar));
            const diagnostic = new vscode.Diagnostic(range, pd.message, this.getSeverity(pd.severity));
            diagnostic.code = pd.code;
            diagnostic.source = 'Agent Studio';
            return diagnostic;
        });
    }
    /**
     * Converts YAML diagnostics to VS Code diagnostics
     */
    convertYamlDiagnostics(yamlDiagnostics, document) {
        return yamlDiagnostics.map(yd => {
            const range = new vscode.Range(new vscode.Position(yd.line, yd.startChar), new vscode.Position(yd.line, yd.endChar));
            const diagnostic = new vscode.Diagnostic(range, yd.message, this.getSeverity(yd.severity));
            diagnostic.code = yd.code;
            diagnostic.source = 'Agent Studio';
            return diagnostic;
        });
    }
    /**
     * Converts string severity to VS Code DiagnosticSeverity
     */
    getSeverity(severity) {
        switch (severity) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Warning;
        }
    }
    /**
     * Disposes the linter resources
     */
    dispose() {
        this.diagnosticCollection.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
exports.AgentStudioLinter = AgentStudioLinter;


/***/ }),
/* 43 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.checkPythonFile = checkPythonFile;
exports.getFlowStepTargetsFromDisk = getFlowStepTargetsFromDisk;
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
/**
 * Checks a Python file for Agent Studio rule violations
 * @param text - The file content as a string
 * @param filePath - The absolute path to the file
 * @param options - Optional overrides (e.g. step names for testing)
 */
function checkPythonFile(text, filePath, options) {
    const diagnostics = [];
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
function isInFunctionsDirectory(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.includes('/functions/');
}
/**
 * Checks if file is a flow function (in flows/{flow_name}/functions/)
 */
function isFlowFunction(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.includes('/flows/') && normalizedPath.includes('/functions/');
}
/**
 * Checks if file is a flow function step (in flows/{flow_name}/function_steps/)
 */
function isFlowFunctionStep(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.includes('/flows/') && normalizedPath.includes('/function_steps/');
}
/**
 * Rule: missing-imports-star
 * Files must contain `from imports import *  # <AUTO GENERATED>`
 */
function checkMissingImportsStar(lines) {
    const diagnostics = [];
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
function checkManualPolyImports(lines) {
    const diagnostics = [];
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
function checkFunctionNameMatchesFilename(lines, fileName) {
    const diagnostics = [];
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
    }
    else if (!foundMatchingFunction && firstFunctionLine === -1) {
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
function findAllFunctionLines(lines) {
    const functions = [];
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
function getDecoratorBlockStartLine(lines, funcLineIndex) {
    let firstDecoratorLine = -1;
    let parenDepth = 0;
    // Walk backwards from the line before the function
    for (let i = funcLineIndex - 1; i >= 0; i--) {
        const line = lines[i];
        const trimmed = line.trim();
        // Count parens to track if we're inside a multiline decorator
        for (const char of trimmed) {
            if (char === ')')
                parenDepth++;
            else if (char === '(')
                parenDepth--;
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
function checkDecoratedHelperFunctions(lines, fileName) {
    const diagnostics = [];
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
function getDecoratorBlock(lines, funcLineIndex) {
    const decoratorLines = [];
    let parenDepth = 0;
    // Walk backwards from the line before the function
    for (let i = funcLineIndex - 1; i >= 0; i--) {
        const line = lines[i];
        const trimmed = line.trim();
        // Count parens to track if we're inside a multiline decorator
        // We're walking backwards, so closing parens increase depth, opening parens decrease
        for (const char of trimmed) {
            if (char === ')')
                parenDepth++;
            else if (char === '(')
                parenDepth--;
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
function findFunctionLine(lines, funcName) {
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
function checkMissingDecorators(lines, fileName) {
    const diagnostics = [];
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
function checkMissingFuncParameters(lines, fileName) {
    const diagnostics = [];
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
    const decoratedParams = [];
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
function checkSilentErrorSwallowing(lines) {
    const diagnostics = [];
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
            }
            else if (trimmedLine.startsWith('print(') || trimmedLine.startsWith('print ')) {
                // print alone is not proper error handling
            }
            else if (trimmedLine !== '' && !trimmedLine.startsWith('#')) {
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
function checkFlowFunctionRules(lines, fileName) {
    const diagnostics = [];
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
function checkReturnConvSay(lines) {
    const diagnostics = [];
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
function checkExitFlowBeforeTransition(lines) {
    const diagnostics = [];
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
function checkPlogUsage(lines) {
    const diagnostics = [];
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
function getFlowDirFromFile(filePath) {
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
function getFlowStepTargetsFromDisk(flowDir) {
    const targets = [];
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
function getFlowStepNamesFromDisk(filePath) {
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
function getCommentStartIndex(line) {
    const idx = line.indexOf('#');
    return idx >= 0 ? idx : line.length;
}
/**
 * Rule: invalid-goto-step
 * flow.goto_step() must reference a step name that exists in the flow's steps/ directory.
 * Only validates uncommented lines (full-line comments and content after # are ignored).
 */
function checkGotoStepExists(lines, filePath, overrideStepNames) {
    const diagnostics = [];
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
function getProjectRoot(filePath) {
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
function getFlowNamesFromDisk(filePath) {
    const projectRoot = getProjectRoot(filePath);
    if (!projectRoot) {
        return null;
    }
    const flowsDir = path.join(projectRoot, 'flows');
    if (!fs.existsSync(flowsDir)) {
        return null;
    }
    const flowNames = [];
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
        }
        catch {
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
function checkGotoFlowExists(lines, filePath, overrideFlowNames) {
    const diagnostics = [];
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


/***/ }),
/* 44 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.checkYamlFile = checkYamlFile;
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
// @ts-ignore - js-yaml types may not be available
const yaml = __importStar(__webpack_require__(4));
/**
 * Checks a YAML file for Agent Studio rule violations
 * @param text - The file content as a string
 * @param filePath - The absolute path to the file
 * @param options - Optional overrides (e.g. valid child_step targets for testing)
 */
function checkYamlFile(text, filePath, options) {
    const diagnostics = [];
    const fileName = path.basename(filePath);
    const lines = text.split('\n');
    // Determine file type and apply appropriate rules
    if (fileName === 'flow_config.yaml') {
        diagnostics.push(...checkFlowConfig(lines, text, filePath));
    }
    else if (isStepFile(filePath)) {
        diagnostics.push(...checkStepFile(lines, text, filePath, options));
    }
    else if (isTopicFile(filePath)) {
        diagnostics.push(...checkTopicFile(lines, text));
    }
    return diagnostics;
}
/**
 * Checks if file is a step file (in flows/{flow_name}/steps/)
 */
function isStepFile(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.includes('/flows/') && normalizedPath.includes('/steps/');
}
/**
 * Checks if file is a topic file (in topics/)
 */
function isTopicFile(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.includes('/topics/');
}
/**
 * Rule: flow-config-missing-description
 * Flow config must have non-empty description
 */
function checkFlowConfig(lines, text, filePath) {
    const diagnostics = [];
    try {
        const config = yaml.load(text);
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
        }
        else {
            // Validate that start_step references an existing step
            const flowDir = path.dirname(filePath);
            const stepsDir = path.join(flowDir, 'steps');
            if (fs.existsSync(stepsDir)) {
                const stepFiles = fs.readdirSync(stepsDir)
                    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
                // Read step names from files
                const stepNames = [];
                for (const stepFile of stepFiles) {
                    try {
                        const stepContent = fs.readFileSync(path.join(stepsDir, stepFile), 'utf8');
                        const stepConfig = yaml.load(stepContent);
                        if (stepConfig && stepConfig.name) {
                            stepNames.push(stepConfig.name);
                        }
                    }
                    catch {
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
    }
    catch (e) {
        // YAML parsing error - let the YAML language server handle it
    }
    return diagnostics;
}
/**
 * Checks step files for Agent Studio rule violations
 */
function checkStepFile(lines, text, filePath, options) {
    const diagnostics = [];
    try {
        const step = yaml.load(text);
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
    }
    catch (e) {
        // YAML parsing error
    }
    return diagnostics;
}
/**
 * Checks topic files for Agent Studio rule violations
 */
function checkTopicFile(lines, text) {
    const diagnostics = [];
    try {
        const topic = yaml.load(text);
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
    }
    catch (e) {
        // YAML parsing error
    }
    return diagnostics;
}
/**
 * Rule: conv-state-in-prompt
 * Use $variable in prompts, not conv.state.variable
 */
function checkConvStateInPrompt(lines, promptStartLine, promptContent) {
    const diagnostics = [];
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
function checkOutputOrientedPrompts(lines, actionsContent) {
    const diagnostics = [];
    // Patterns that indicate output-oriented prompts
    const outputPatterns = [
        /Say:\s*["']/i, // Say: "..." or Say: '...'
        /Say\s+["']/i, // Say "..." or Say '...'
        /respond with\s*["']/i, // respond with "..."
        /reply\s*["']/i, // reply "..."
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
function getChildStepTargetsFromDisk(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const stepsIdx = normalizedPath.lastIndexOf('/steps/');
    if (stepsIdx === -1) {
        return null;
    }
    const flowDir = normalizedPath.substring(0, stepsIdx);
    // Re-use the shared helper from pythonRules if available, or inline the logic
    const targets = [];
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
            }
            catch {
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
function checkChildStepExists(lines, conditions, filePath, overrideTargets) {
    const diagnostics = [];
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
function findChildStepLine(lines, value) {
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
function findYamlKeyLine(lines, key) {
    const keyPattern = new RegExp(`^${key}\\s*:`);
    for (let i = 0; i < lines.length; i++) {
        if (keyPattern.test(lines[i].trim())) {
            return i;
        }
    }
    return -1;
}


/***/ }),
/* 45 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.findLasConfigPath = exports.findLasConfig = void 0;
exports.findAdkConfig = findAdkConfig;
exports.findAdkConfigPath = findAdkConfigPath;
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
/**
 * Finds and parses .adkrc config file for a given file path
 * Searches from the file's directory up to the project root
 * Also supports legacy .lasrc files for backwards compatibility
 */
function findAdkConfig(filePath) {
    const defaultConfig = { disabledRules: [] };
    let currentDir = path.dirname(filePath);
    const root = path.parse(currentDir).root;
    // Search upward for .adkrc or .lasrc file
    while (currentDir !== root) {
        // Check for .adkrc first (preferred), then .lasrc (legacy)
        const adkConfigPath = path.join(currentDir, '.adkrc');
        const lasConfigPath = path.join(currentDir, '.lasrc');
        const configPath = fs.existsSync(adkConfigPath) ? adkConfigPath :
            fs.existsSync(lasConfigPath) ? lasConfigPath : null;
        if (configPath) {
            try {
                const content = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(content);
                // Parse disabled rules
                if (config.disabled && Array.isArray(config.disabled)) {
                    return { disabledRules: config.disabled };
                }
                // Also support "rules" object with false values
                if (config.rules && typeof config.rules === 'object') {
                    const disabled = [];
                    for (const [rule, enabled] of Object.entries(config.rules)) {
                        if (enabled === false) {
                            disabled.push(rule);
                        }
                    }
                    return { disabledRules: disabled };
                }
                return defaultConfig;
            }
            catch (e) {
                // Invalid JSON, return default
                return defaultConfig;
            }
        }
        // Stop at project root markers
        if (fs.existsSync(path.join(currentDir, 'imports.py')) ||
            fs.existsSync(path.join(currentDir, 'gen_decorators.py'))) {
            break;
        }
        currentDir = path.dirname(currentDir);
    }
    return defaultConfig;
}
// Alias for backwards compatibility
exports.findLasConfig = findAdkConfig;
/**
 * Finds the .adkrc config file path for a given file
 * Returns null if no config file is found
 * Also supports legacy .lasrc files for backwards compatibility
 */
function findAdkConfigPath(filePath) {
    let currentDir = path.dirname(filePath);
    const root = path.parse(currentDir).root;
    while (currentDir !== root) {
        // Check for .adkrc first (preferred), then .lasrc (legacy)
        const adkConfigPath = path.join(currentDir, '.adkrc');
        const lasConfigPath = path.join(currentDir, '.lasrc');
        if (fs.existsSync(adkConfigPath)) {
            return adkConfigPath;
        }
        if (fs.existsSync(lasConfigPath)) {
            return lasConfigPath;
        }
        // Stop at project root markers
        if (fs.existsSync(path.join(currentDir, 'imports.py')) ||
            fs.existsSync(path.join(currentDir, 'gen_decorators.py'))) {
            break;
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}
// Alias for backwards compatibility
exports.findLasConfigPath = findAdkConfigPath;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map