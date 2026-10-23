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
const yamlLanguageFeatures_1 = __webpack_require__(112);
const debug_1 = __webpack_require__(110);
const linter_1 = __webpack_require__(113);
function toSnakeCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/[\s\-]+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();
}
async function openFlowViewer(flowDir, context) {
    const configPath = path.join(flowDir, 'flow_config.yaml');
    if (!fs.existsSync(configPath)) {
        vscode.window.showErrorMessage(`Flow directory must contain a flow_config.yaml file.\nSelected: ${flowDir}`, 'OK');
        return;
    }
    if (!fs.statSync(flowDir).isDirectory()) {
        vscode.window.showErrorMessage(`Selected path is not a directory: ${flowDir}`);
        return;
    }
    let flowName = path.basename(flowDir);
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(configContent);
        if (config && config.name) {
            flowName = config.name;
        }
    }
    catch {
        // Use directory name if config parsing fails
    }
    const panel = vscode.window.createWebviewPanel('flowViewer', `Flow Viewer: ${flowName}`, vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, 'src'))
        ],
        enableCommandUris: true
    });
    const messageHandler = new webviewHandlers_1.WebviewMessageHandler(panel, flowDir);
    panel.webview.onDidReceiveMessage(async (message) => {
        await messageHandler.handleMessage(message);
    }, undefined, context.subscriptions);
    panel.webview.html = (0, webviewContent_1.getWebviewContent)(panel.webview, context.extensionUri);
    try {
        const parser = new flowParser_1.FlowParser(flowDir);
        const flowGraph = await parser.parseFlow();
        messageHandler.setFlowGraphData(flowGraph);
        panel.webview.postMessage({
            command: 'loadFlow',
            flowGraph: flowGraph
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Error parsing flow: ${errorMessage}`, 'OK');
        console.error('Flow parsing error:', error);
        panel.webview.html = (0, webviewContent_1.getErrorWebviewContent)(errorMessage);
    }
}
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
            if (!fs.statSync(flowDir).isDirectory()) {
                flowDir = path.dirname(flowDir);
            }
        }
        else {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                if (fs.existsSync(path.join(workspaceRoot, 'flow_config.yaml'))) {
                    flowDir = workspaceRoot;
                }
                else {
                    const selectedFolders = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Flow Directory',
                        defaultUri: vscode.Uri.file(workspaceRoot)
                    });
                    if (!selectedFolders || selectedFolders.length === 0)
                        return;
                    flowDir = selectedFolders[0].fsPath;
                }
            }
            else {
                const selectedFolders = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select Flow Directory'
                });
                if (!selectedFolders || selectedFolders.length === 0)
                    return;
                flowDir = selectedFolders[0].fsPath;
            }
        }
        await openFlowViewer(flowDir, context);
    });
    const createFlowDisposable = vscode.commands.registerCommand('adk-extension.createFlow', async (uri) => {
        const flowName = await vscode.window.showInputBox({
            prompt: 'Enter a name for the new flow',
            placeHolder: 'e.g. My Flow',
            validateInput: (value) => {
                const trimmed = value.trim();
                if (!trimmed)
                    return 'Name is required';
                if (/[<>:"/\\|?*]/.test(trimmed))
                    return 'Name cannot contain \\ / : * ? " < > |';
                return undefined;
            }
        });
        if (!flowName || !flowName.trim())
            return;
        let parentDir;
        if (uri && uri.fsPath) {
            const stat = fs.statSync(uri.fsPath);
            parentDir = stat.isDirectory() ? uri.fsPath : path.dirname(uri.fsPath);
        }
        else {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const defaultUri = workspaceFolders && workspaceFolders.length > 0
                ? workspaceFolders[0].uri
                : undefined;
            const selectedFolders = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select parent folder for the new flow',
                defaultUri
            });
            if (!selectedFolders || selectedFolders.length === 0)
                return;
            parentDir = selectedFolders[0].fsPath;
        }
        const folderName = toSnakeCase(flowName.trim()) || 'new_flow';
        const flowDir = path.join(parentDir, folderName);
        if (fs.existsSync(flowDir)) {
            vscode.window.showErrorMessage(`A folder "${folderName}" already exists at that location.`);
            return;
        }
        try {
            fs.mkdirSync(flowDir, { recursive: true });
            const stepsDir = path.join(flowDir, 'steps');
            fs.mkdirSync(stepsDir, { recursive: true });
            const flowConfig = {
                name: flowName.trim(),
                description: 'New flow.',
                start_step: 'greeting'
            };
            const flowConfigPath = path.join(flowDir, 'flow_config.yaml');
            fs.writeFileSync(flowConfigPath, yaml.dump(flowConfig, { indent: 2, lineWidth: 100 }), 'utf8');
            const greetingStep = `name: greeting
step_type: default_step
prompt: |
  Enter your prompt here.
extracted_entities: []
conditions: []
`;
            fs.writeFileSync(path.join(stepsDir, 'greeting.yaml'), greetingStep, 'utf8');
            vscode.window.showInformationMessage(`Flow "${flowName.trim()}" created. Opening flow viewer.`);
            await openFlowViewer(flowDir, context);
            const flowUri = vscode.Uri.file(flowDir);
            await vscode.commands.executeCommand('revealInExplorer', flowUri);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error creating flow: ${errorMessage}`);
            console.error('Error creating flow:', error);
        }
    });
    // Toggle debug mode command
    const toggleDebugDisposable = vscode.commands.registerCommand('adk-extension.toggleDebugMode', async () => {
        await (0, debug_1.toggleDebugMode)();
    });
    // Register Python language features for function resolution
    (0, debug_1.debugLog)('Registering Python language features...');
    const pythonDefinitionProvider = vscode.languages.registerDefinitionProvider({ language: 'python', scheme: 'file' }, new pythonLanguageFeatures_1.PythonDefinitionProvider());
    const pythonHoverProvider = vscode.languages.registerHoverProvider({ language: 'python', scheme: 'file' }, new pythonLanguageFeatures_1.PythonHoverProvider());
    const pythonReferencesProvider = vscode.languages.registerReferenceProvider({ language: 'python', scheme: 'file' }, new pythonLanguageFeatures_1.PythonReferencesProvider());
    // Completion provider for conv. and flow. attributes, triggered on "."
    const pythonCompletionProvider = vscode.languages.registerCompletionItemProvider({ language: 'python', scheme: 'file' }, new pythonLanguageFeatures_1.PythonCompletionProvider(), '.');
    // DocumentLink provider for direct flow.X / conv.X calls — takes priority
    // over definition providers on Ctrl+Click, bypassing Pylance's __getattr__
    const pythonFunctionLinkProvider = vscode.languages.registerDocumentLinkProvider({ language: 'python', scheme: 'file' }, new pythonLanguageFeatures_1.PythonFunctionLinkProvider());
    (0, debug_1.debugLog)('Python language features registered');
    // Register YAML language features for {{fn:X}} / {{ft:X}} / {{attr:X}} resolution
    (0, debug_1.debugLog)('Registering YAML language features...');
    const yamlFunctionLinkProvider = vscode.languages.registerDocumentLinkProvider({ language: 'yaml', scheme: 'file' }, new yamlLanguageFeatures_1.YamlFunctionLinkProvider());
    const yamlFunctionHoverProvider = vscode.languages.registerHoverProvider({ language: 'yaml', scheme: 'file' }, new yamlLanguageFeatures_1.YamlFunctionHoverProvider());
    const yamlAttrLinkProvider = vscode.languages.registerDocumentLinkProvider({ language: 'yaml', scheme: 'file' }, new yamlLanguageFeatures_1.YamlAttrLinkProvider());
    const yamlAttrHoverProvider = vscode.languages.registerHoverProvider({ language: 'yaml', scheme: 'file' }, new yamlLanguageFeatures_1.YamlAttrHoverProvider());
    (0, debug_1.debugLog)('YAML language features registered');
    // Initialize and activate the Agent Studio Linter
    (0, debug_1.debugLog)('Activating Agent Studio Linter...');
    const linter = new linter_1.AgentStudioLinter();
    linter.activate(context);
    (0, debug_1.debugLog)('Agent Studio Linter activated');
    context.subscriptions.push(viewFlowDisposable, createFlowDisposable, toggleDebugDisposable, pythonDefinitionProvider, pythonHoverProvider, pythonReferencesProvider, pythonCompletionProvider, pythonFunctionLinkProvider, yamlFunctionLinkProvider, yamlFunctionHoverProvider, yamlAttrLinkProvider, yamlAttrHoverProvider);
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
        const variantAttributeDefinitions = await this.parseVariantAttributeDefinitions();
        const variantAttributes = variantAttributeDefinitions.map((a) => a.name);
        const variables = await this.discoverVariables();
        console.log(`Parsing flow: ${config.name}`);
        console.log(`Found ${steps.size} steps:`, Array.from(steps.keys()));
        console.log(`Found ${functionSteps.size} function steps:`, Array.from(functionSteps.keys()));
        console.log(`Found ${flowFunctions.size} flow functions:`, Array.from(flowFunctions.keys()));
        console.log(`Found ${globalFunctions.size} global functions:`, Array.from(globalFunctions.keys()));
        console.log(`Found ${entities.length} entities:`, entities.map(e => e.name));
        console.log(`Found ${variantAttributes.length} variant attributes:`, variantAttributes);
        console.log(`Variant attribute definitions:`, variantAttributeDefinitions.length);
        console.log(`Found ${variables.length} variables:`, variables);
        const nodes = [];
        const edges = [];
        const nodeMap = new Map();
        // No separate start node; start step is indicated by config.start_step (green circle in viewer)
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
        // Deduplicate edges: same from+to+label should only appear once
        const edgeKey = (e) => `${e.from}|${e.to}|${e.label}`;
        const seen = new Set();
        const uniqueEdges = [];
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
            entities,
            variantAttributes,
            variantAttributeDefinitions,
            variables
        };
    }
    /** Get project root (directory containing config/). */
    getProjectRoot() {
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
                return currentDir;
            }
            currentDir = parentDir;
        }
        return null;
    }
    /**
     * Parse config/variant_attributes.yaml and return full definitions for the attributes panel.
     * Format: attributes: [ { name: attribute_name, values: { variant_name: value, ... } }, ... ]
     */
    async parseVariantAttributeDefinitions() {
        const projectRoot = this.getProjectRoot();
        if (!projectRoot)
            return [];
        const attrPath = path.join(projectRoot, 'config', 'variant_attributes.yaml');
        if (!fs.existsSync(attrPath)) {
            console.warn('variant_attributes.yaml not found at', attrPath);
            return [];
        }
        try {
            const content = fs.readFileSync(attrPath, 'utf8');
            const parsed = yaml.load(content);
            if (!parsed || typeof parsed !== 'object')
                return [];
            const attrs = parsed.attributes;
            if (attrs === undefined || attrs === null || !Array.isArray(attrs))
                return [];
            return attrs
                .filter((v) => v && typeof v === 'object' && typeof v.name === 'string')
                .map((v) => ({
                name: String(v.name).trim(),
                values: v.values && typeof v.values === 'object' ? { ...v.values } : {}
            }))
                .filter((a) => a.name.length > 0);
        }
        catch (error) {
            console.error('Error parsing variant_attributes.yaml:', error);
        }
        return [];
    }
    /** Search codebase for conv.state.<variable_name> and return unique variable names for {{vrbl:name}}. */
    async discoverVariables() {
        const projectRoot = this.getProjectRoot();
        if (!projectRoot)
            return [];
        const convStateRe = /conv\.state\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const seen = new Set();
        const searchDir = (dir) => {
            if (!fs.existsSync(dir))
                return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) {
                    if (e.name !== 'node_modules' && e.name !== '.git' && e.name !== '__pycache__') {
                        searchDir(full);
                    }
                }
                else if (e.isFile() && (e.name.endsWith('.py') || e.name.endsWith('.yaml') || e.name.endsWith('.yml'))) {
                    try {
                        const content = fs.readFileSync(full, 'utf8');
                        let m;
                        while ((m = convStateRe.exec(content)) !== null) {
                            seen.add(m[1]);
                        }
                    }
                    catch {
                        // ignore read errors
                    }
                }
            }
        };
        searchDir(projectRoot);
        return Array.from(seen).sort();
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
        const projectRoot = this.getProjectRoot();
        if (!projectRoot) {
            console.warn('Could not find project root with config directory');
            return [];
        }
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
        const seenTargets = new Set();
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
const vscode = __importStar(__webpack_require__(1));
/**
 * Generates the webview HTML content with proper CSP
 */
function getWebviewContent(webview, extensionUri) {
    // Load HTML content from the extension directory
    const htmlPath = path.join(extensionUri.fsPath, 'src', 'flowViewer.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    // Replace CDN script URLs with local webview URIs for offline support
    const jointUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'joint.min.js')));
    const graphlibUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'graphlib.min.js')));
    const dagreUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'dagre.min.js')));
    const directedGraphUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionUri.fsPath, 'src', 'lib', 'DirectedGraph.min.js')));
    htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@joint/core/dist/joint.min.js', jointUri.toString());
    htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@dagrejs/graphlib/dist/graphlib.min.js', graphlibUri.toString());
    htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@dagrejs/dagre/dist/dagre.min.js', dagreUri.toString());
    htmlContent = htmlContent.replace('https://cdn.jsdelivr.net/npm/@joint/layout-directed-graph/dist/DirectedGraph.min.js', directedGraphUri.toString());
    // Add CSP meta tag if not present
    const cspSource = webview.cspSource;
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource} 'unsafe-inline' 'unsafe-eval'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} https: data:; font-src ${cspSource} https: data:;">`;
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
     * Gets the path to the variant_attributes.yaml file (same config dir as entities).
     */
    getVariantAttributesFilePath() {
        const entitiesPath = this.getEntitiesFilePath();
        if (!entitiesPath)
            return null;
        return path.join(path.dirname(entitiesPath), 'variant_attributes.yaml');
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
            vscode.window.showInformationMessage('Entity saved');
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
    async handleSaveVariantAttributes(attributes) {
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
            const parser = new flowParser_1.FlowParser(this.flowDir);
            const updatedFlowGraph = await parser.parseFlow();
            this.flowGraphData = updatedFlowGraph;
            this.panel.webview.postMessage({ command: 'loadFlow', flowGraph: updatedFlowGraph });
            this.panel.webview.postMessage({ command: 'variantAttributesSaved', success: true });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error saving variant attributes: ${errorMessage}`);
            console.error('Error saving variant attributes:', error);
            this.panel.webview.postMessage({ command: 'variantAttributesSaved', success: false, error: errorMessage });
        }
    }
    async handleSetStartStep(nodeId) {
        try {
            const configPath = path.join(this.flowDir, 'flow_config.yaml');
            if (!fs.existsSync(configPath)) {
                vscode.window.showErrorMessage('flow_config.yaml not found');
                return;
            }
            const content = fs.readFileSync(configPath, 'utf8');
            const config = yaml.load(content);
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
            const parser = new flowParser_1.FlowParser(this.flowDir);
            const updatedFlowGraph = await parser.parseFlow();
            this.flowGraphData = updatedFlowGraph;
            this.panel.webview.postMessage({ command: 'loadFlow', flowGraph: updatedFlowGraph });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error updating start step: ${errorMessage}`);
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
exports.PythonFunctionLinkProvider = exports.PythonReferencesProvider = exports.PythonCompletionProvider = exports.PythonHoverProvider = exports.PythonDefinitionProvider = exports.GOTO_STEP_PATTERN = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
const pythonFunctionResolver_1 = __webpack_require__(34);
const debug_1 = __webpack_require__(110);
const runtimeDescriptions_1 = __webpack_require__(111);
/** Shared regex for matching flow.goto_step("...") calls. Also used in flowParser.ts and pythonRules.ts. */
exports.GOTO_STEP_PATTERN = /flow\.goto_step\(\s*["']([^"']+)["']/g;
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
 * Extract a conv.attribute or flow.attribute reference at the cursor position.
 * Returns null if the cursor is on conv.functions.X (handled by extractFunctionCall).
 */
function extractRuntimeAttribute(document, position) {
    const lineText = document.lineAt(position).text;
    const offset = position.character;
    // Quick check
    if (!lineText.includes('conv.') && !lineText.includes('flow.')) {
        return null;
    }
    // Match conv.xxx or flow.xxx — but skip conv.functions.X / flow.functions.X
    const pattern = /\b(conv|flow)\.(\w+)/g;
    let match;
    while ((match = pattern.exec(lineText)) !== null) {
        const obj = match[1];
        const attr = match[2];
        // Skip the "functions" accessor — that's handled by extractFunctionCall
        if (attr === 'functions')
            continue;
        // Check the attribute is in our known members
        const members = obj === 'conv' ? runtimeDescriptions_1.conversationMembers : runtimeDescriptions_1.flowMembers;
        if (!members[attr])
            continue;
        const attrStart = match.index + obj.length + 1; // after "conv." or "flow."
        const attrEnd = attrStart + attr.length;
        if (offset >= attrStart && offset <= attrEnd) {
            return {
                object: obj,
                attribute: attr,
                range: new vscode.Range(new vscode.Position(position.line, attrStart), new vscode.Position(position.line, attrEnd)),
            };
        }
    }
    return null;
}
/**
 * Extract a flow.goto_step("Step Name") reference, with cursor on the step name string.
 * Returns the step name and range of the string literal.
 */
function extractGotoStep(document, position) {
    const lineText = document.lineAt(position).text;
    const offset = position.character;
    exports.GOTO_STEP_PATTERN.lastIndex = 0;
    let match;
    while ((match = exports.GOTO_STEP_PATTERN.exec(lineText)) !== null) {
        const stepName = match[1];
        // Find the position of the step name string (inside the quotes)
        const nameIdx = match[0].indexOf(stepName);
        const nameStart = match.index + nameIdx;
        const nameEnd = nameStart + stepName.length;
        if (offset >= nameStart && offset <= nameEnd) {
            return {
                stepName,
                range: new vscode.Range(new vscode.Position(position.line, nameStart), new vscode.Position(position.line, nameEnd)),
            };
        }
    }
    return null;
}
/**
 * Resolve a step name to the YAML file that defines it.
 * Walks up from the current file to find the flow directory, then scans steps/*.yaml.
 */
function resolveStepFile(stepName, document) {
    // Find the flow directory (contains flow_config.yaml)
    const flowDir = pythonFunctionResolver_1.PythonFunctionResolver.findFlowDirectory(document.uri.fsPath);
    if (!flowDir) {
        (0, debug_1.debugLog)('resolveStepFile: no flow directory found');
        return null;
    }
    const stepsDir = path.join(flowDir, 'steps');
    if (!fs.existsSync(stepsDir)) {
        (0, debug_1.debugLog)('resolveStepFile: no steps/ directory in', flowDir);
        return null;
    }
    // Also check function_steps/
    const functionStepsDir = path.join(flowDir, 'function_steps');
    // Scan steps/*.yaml for matching name: field
    const yamlFiles = fs.readdirSync(stepsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of yamlFiles) {
        const filePath = path.join(stepsDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/m);
            if (nameMatch && nameMatch[1] === stepName) {
                return new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0));
            }
        }
        catch {
            // skip unreadable files
        }
    }
    // Check function_steps/*.py (step name matches filename without .py)
    if (fs.existsSync(functionStepsDir)) {
        const pyFiles = fs.readdirSync(functionStepsDir).filter(f => f.endsWith('.py'));
        for (const file of pyFiles) {
            if (path.basename(file, '.py') === stepName) {
                const filePath = path.join(functionStepsDir, file);
                return new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0));
            }
        }
    }
    (0, debug_1.debugLog)(`resolveStepFile: step "${stepName}" not found in ${stepsDir}`);
    return null;
}
/**
 * Build a markdown hover tooltip from a RuntimeMember.
 */
function buildRuntimeHover(obj, member) {
    const className = obj === 'conv' ? 'Conversation' : 'Flow';
    const kindLabel = member.kind === 'property' ? 'property' : 'method';
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${className} ${kindLabel}**: \`${member.name}\``);
    if (member.signature) {
        md.appendCodeblock(`${obj}.${member.name}${member.signature}`, 'python');
    }
    else if (member.returnType) {
        md.appendCodeblock(`${obj}.${member.name}: ${member.returnType}`, 'python');
    }
    if (member.description) {
        md.appendMarkdown(`\n\n${member.description}`);
    }
    if (member.parameters && member.parameters.length > 0) {
        md.appendMarkdown(`\n\n**Parameters:**`);
        for (const p of member.parameters) {
            const typeStr = p.type ? `: ${p.type}` : '';
            const descStr = p.description ? ` — ${p.description}` : '';
            md.appendMarkdown(`\n- \`${p.name}${typeStr}\`${descStr}`);
        }
    }
    return md;
}
/**
 * Definition provider for conv.functions, flow.functions, and flow.goto_step
 */
class PythonDefinitionProvider {
    provideDefinition(document, position, _token) {
        const lineText = document.lineAt(position).text;
        // Ultra-quick check: if line doesn't contain our patterns, return undefined immediately
        // This allows VS Code to skip our provider and use others
        if (!lineText.includes('conv.') && !lineText.includes('flow.')) {
            return undefined; // Return undefined to let other providers handle it
        }
        // Only process if we have our specific patterns
        // 1. conv.functions.X / flow.functions.X → navigate to function file
        const functionCall = extractFunctionCall(document, position);
        if (functionCall) {
            if (functionCall.type === 'conv') {
                return pythonFunctionResolver_1.PythonFunctionResolver.resolveConvFunction(functionCall.functionName, document);
            }
            else if (functionCall.type === 'flow') {
                return pythonFunctionResolver_1.PythonFunctionResolver.resolveFlowFunction(functionCall.functionName, document);
            }
        }
        // 2. flow.goto_step("Step Name") → navigate to step YAML file
        // Uses LocationLink with originSelectionRange so the entire step name
        // (including spaces) is treated as one continuous clickable link.
        if (lineText.includes('goto_step')) {
            const gotoStep = extractGotoStep(document, position);
            if (gotoStep) {
                const target = resolveStepFile(gotoStep.stepName, document);
                if (target) {
                    const link = {
                        originSelectionRange: gotoStep.range,
                        targetUri: target.uri,
                        targetRange: target.range,
                        targetSelectionRange: target.range,
                    };
                    return [link];
                }
            }
        }
        return undefined; // Let other providers handle it
    }
}
exports.PythonDefinitionProvider = PythonDefinitionProvider;
/**
 * Hover provider for conv.functions and flow.functions
 */
class PythonHoverProvider {
    provideHover(document, position, _token) {
        const lineText = document.lineAt(position).text;
        // Ultra-quick check: if line doesn't contain our patterns, return undefined immediately
        if (!lineText.includes('conv.') && !lineText.includes('flow.')) {
            return undefined; // Return undefined to let other providers handle it
        }
        // 1. conv.functions.X / flow.functions.X → show function description from file
        const functionCall = extractFunctionCall(document, position);
        if (functionCall) {
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
        }
        // 2. conv.attribute / flow.attribute → show runtime description
        const runtimeAttr = extractRuntimeAttribute(document, position);
        if (runtimeAttr) {
            const members = runtimeAttr.object === 'conv' ? runtimeDescriptions_1.conversationMembers : runtimeDescriptions_1.flowMembers;
            const member = members[runtimeAttr.attribute];
            if (member) {
                return new vscode.Hover(buildRuntimeHover(runtimeAttr.object, member), runtimeAttr.range);
            }
        }
        return undefined;
    }
}
exports.PythonHoverProvider = PythonHoverProvider;
/**
 * Completion provider for conv. and flow. attributes.
 * Triggered when the user types "." after conv or flow, showing all available
 * members with descriptions, types, and snippet placeholders for method parameters.
 */
class PythonCompletionProvider {
    provideCompletionItems(document, position, _token, _context) {
        const lineText = document.lineAt(position).text;
        const textBeforeCursor = lineText.substring(0, position.character);
        // Check if the user just typed "conv." or "flow."
        const triggerMatch = textBeforeCursor.match(/\b(conv|flow)\.\w*$/);
        if (!triggerMatch) {
            return undefined;
        }
        const obj = triggerMatch[1];
        const members = obj === 'conv' ? runtimeDescriptions_1.conversationMembers : runtimeDescriptions_1.flowMembers;
        return Object.values(members).map(member => {
            const item = new vscode.CompletionItem(member.name, member.kind === 'method'
                ? vscode.CompletionItemKind.Method
                : vscode.CompletionItemKind.Property);
            // Detail line shown next to the suggestion (signature or type)
            if (member.signature) {
                item.detail = `${member.name}${member.signature}`;
            }
            else if (member.returnType) {
                item.detail = `${member.name}: ${member.returnType}`;
            }
            // Documentation shown in the side panel
            const doc = new vscode.MarkdownString();
            if (member.description) {
                doc.appendMarkdown(member.description);
            }
            if (member.parameters && member.parameters.length > 0) {
                doc.appendMarkdown(`\n\n**Parameters:**`);
                for (const p of member.parameters) {
                    const typeStr = p.type ? `: ${p.type}` : '';
                    const descStr = p.description ? ` — ${p.description}` : '';
                    doc.appendMarkdown(`\n- \`${p.name}${typeStr}\`${descStr}`);
                }
            }
            item.documentation = doc;
            // For methods, insert a snippet with parameter placeholders
            if (member.kind === 'method' && member.parameters && member.parameters.length > 0) {
                const placeholders = member.parameters.map((p, i) => `\${${i + 1}:${p.name}}`).join(', ');
                item.insertText = new vscode.SnippetString(`${member.name}(${placeholders})`);
            }
            return item;
        });
    }
}
exports.PythonCompletionProvider = PythonCompletionProvider;
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
    }
    // Check if this is a flow function (in flows/flow_name/functions/function_name.py)
    if (path.basename(dirName) === 'functions') {
        const flowDir = path.dirname(dirName);
        if (fs.existsSync(path.join(flowDir, 'flow_config.yaml'))) {
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
/**
 * Document link provider for conv.functions.X / flow.functions.X calls.
 * DocumentLinks take priority over definition providers on Ctrl+Click,
 * so this bypasses Pylance's __getattr__ result and navigates directly
 * to the function file.
 */
class PythonFunctionLinkProvider {
    provideDocumentLinks(document, _token) {
        const links = [];
        const lineCount = document.lineCount;
        const patterns = [
            { regex: /conv\.functions\.(\w+)/g, type: 'conv' },
            { regex: /flow\.functions\.(\w+)/g, type: 'flow' }
        ];
        for (let i = 0; i < lineCount; i++) {
            const line = document.lineAt(i).text;
            if (!line.includes('.functions.'))
                continue;
            for (const pattern of patterns) {
                let match;
                pattern.regex.lastIndex = 0;
                while ((match = pattern.regex.exec(line)) !== null) {
                    const functionName = match[1];
                    const location = pattern.type === 'conv'
                        ? pythonFunctionResolver_1.PythonFunctionResolver.resolveConvFunction(functionName, document)
                        : pythonFunctionResolver_1.PythonFunctionResolver.resolveFlowFunction(functionName, document);
                    if (location) {
                        const fnStart = match.index + match[0].indexOf(functionName);
                        const range = new vscode.Range(new vscode.Position(i, fnStart), new vscode.Position(i, fnStart + functionName.length));
                        links.push(new vscode.DocumentLink(range, location.uri));
                    }
                }
            }
        }
        return links;
    }
}
exports.PythonFunctionLinkProvider = PythonFunctionLinkProvider;


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
const vscode = __importStar(__webpack_require__(1));
const functionPathResolver_1 = __webpack_require__(35);
/**
 * vscode-dependent convenience wrappers around FunctionPathResolver, for use from
 * providers that operate on an open vscode.TextDocument (go-to-definition, hover, etc).
 * Pure path-resolution logic lives in FunctionPathResolver so it can also be used from
 * the standalone `adk-lint` CLI, which has no `vscode` module at runtime.
 */
class PythonFunctionResolver {
    static findProjectRoot(filePath) {
        return functionPathResolver_1.FunctionPathResolver.findProjectRoot(filePath);
    }
    static findFlowDirectory(filePath) {
        return functionPathResolver_1.FunctionPathResolver.findFlowDirectory(filePath);
    }
    static getFlowName(filePath) {
        return functionPathResolver_1.FunctionPathResolver.getFlowName(filePath);
    }
    static resolveConvFunctionPath(functionName, filePath) {
        return functionPathResolver_1.FunctionPathResolver.resolveConvFunctionPath(functionName, filePath);
    }
    /**
     * Resolves conv.functions.function_name() to the global function file path
     */
    static resolveConvFunction(functionName, document) {
        const functionPath = this.resolveConvFunctionPath(functionName, document.uri.fsPath);
        if (!functionPath) {
            return null;
        }
        return new vscode.Location(vscode.Uri.file(functionPath), new vscode.Position(0, 0));
    }
    static resolveFlowFunctionPath(functionName, filePath) {
        return functionPathResolver_1.FunctionPathResolver.resolveFlowFunctionPath(functionName, filePath);
    }
    /**
     * Resolves flow.functions.function_name() to the flow function file path.
     */
    static resolveFlowFunction(functionName, document) {
        const functionPath = this.resolveFlowFunctionPath(functionName, document.uri.fsPath);
        if (!functionPath) {
            return null;
        }
        return new vscode.Location(vscode.Uri.file(functionPath), new vscode.Position(0, 0));
    }
    /**
     * Gets all available global function names
     */
    static getGlobalFunctionNames(document) {
        return functionPathResolver_1.FunctionPathResolver.getGlobalFunctionNames(document.uri.fsPath);
    }
    /**
     * Gets all available flow function names for the current file's flow
     */
    static getFlowFunctionNames(document) {
        return functionPathResolver_1.FunctionPathResolver.getFlowFunctionNames(document.uri.fsPath);
    }
    static getFunctionDescription(filePath) {
        return functionPathResolver_1.FunctionPathResolver.getFunctionDescription(filePath);
    }
    static getFunctionParameters(filePath) {
        return functionPathResolver_1.FunctionPathResolver.getFunctionParameters(filePath);
    }
    static findVariantAttributesPath(filePath) {
        return functionPathResolver_1.FunctionPathResolver.findVariantAttributesPath(filePath);
    }
    static findVariantAttributeNames(filePath) {
        return functionPathResolver_1.FunctionPathResolver.findVariantAttributeNames(filePath);
    }
    static resolveVariantAttributeLocation(attrName, filePath) {
        return functionPathResolver_1.FunctionPathResolver.resolveVariantAttributeLocation(attrName, filePath);
    }
    static buildVariantAttributeIndex(filePath) {
        return functionPathResolver_1.FunctionPathResolver.buildVariantAttributeIndex(filePath);
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
exports.FunctionPathResolver = void 0;
const path = __importStar(__webpack_require__(2));
const fs = __importStar(__webpack_require__(3));
const yaml_1 = __webpack_require__(36);
/**
 * Pure filesystem-based resolution for Agent Studio projects: locating functions,
 * flows, and variant attributes on disk. No `vscode` dependency, so this module is safe
 * to use from both the extension (via pythonFunctionResolver.ts) and the standalone
 * `adk-lint` CLI (src/cli.ts), which has no `vscode` module available at runtime.
 */
class FunctionPathResolver {
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
     * Resolves conv.functions.function_name() to the global function file path.
     */
    static resolveConvFunctionPath(functionName, filePath) {
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
    static resolveFlowFunctionPath(functionName, filePath) {
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
    static getGlobalFunctionNames(filePath) {
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
    static getFlowFunctionNames(filePath) {
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
    /**
     * Finds the project's config/variant_attributes.yaml, which defines {{attr:X}} targets.
     * Walks up from the file independently of findProjectRoot, since a project can have
     * variant_attributes.yaml without a global functions/ directory (e.g. all-flow-scoped projects).
     */
    static findVariantAttributesPath(filePath) {
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
    static findVariantAttributeNames(filePath) {
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
    static buildVariantAttributeIndex(filePath) {
        const index = new Map();
        const attrPath = this.findVariantAttributesPath(filePath);
        if (!attrPath) {
            return index;
        }
        let content;
        try {
            content = fs.readFileSync(attrPath, 'utf8');
        }
        catch {
            return index;
        }
        const lineCounter = new yaml_1.LineCounter();
        let doc;
        try {
            doc = (0, yaml_1.parseDocument)(content, { lineCounter });
        }
        catch {
            return index;
        }
        const root = doc.contents;
        if (!(0, yaml_1.isMap)(root)) {
            return index;
        }
        const attributesPair = root.items.find(pair => (0, yaml_1.isScalar)(pair.key) && pair.key.value === 'attributes');
        const attributesNode = attributesPair?.value;
        if (!(0, yaml_1.isSeq)(attributesNode)) {
            return index;
        }
        for (const entry of attributesNode.items) {
            if (!(0, yaml_1.isMap)(entry)) {
                continue;
            }
            const namePair = entry.items.find(pair => (0, yaml_1.isScalar)(pair.key) && pair.key.value === 'name');
            const nameValue = namePair?.value;
            if (!(0, yaml_1.isScalar)(nameValue) || typeof nameValue.value !== 'string' || !nameValue.range) {
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
    static resolveVariantAttributeLocation(attrName, filePath) {
        return this.buildVariantAttributeIndex(filePath).get(attrName) ?? null;
    }
}
exports.FunctionPathResolver = FunctionPathResolver;


/***/ }),
/* 36 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var composer = __webpack_require__(37);
var Document = __webpack_require__(42);
var Schema = __webpack_require__(60);
var errors = __webpack_require__(86);
var Alias = __webpack_require__(43);
var identity = __webpack_require__(40);
var Pair = __webpack_require__(51);
var Scalar = __webpack_require__(50);
var YAMLMap = __webpack_require__(62);
var YAMLSeq = __webpack_require__(65);
var cst = __webpack_require__(102);
var lexer = __webpack_require__(106);
var lineCounter = __webpack_require__(107);
var parser = __webpack_require__(108);
var publicApi = __webpack_require__(109);
var visit = __webpack_require__(41);



exports.Composer = composer.Composer;
exports.Document = Document.Document;
exports.Schema = Schema.Schema;
exports.YAMLError = errors.YAMLError;
exports.YAMLParseError = errors.YAMLParseError;
exports.YAMLWarning = errors.YAMLWarning;
exports.Alias = Alias.Alias;
exports.isAlias = identity.isAlias;
exports.isCollection = identity.isCollection;
exports.isDocument = identity.isDocument;
exports.isMap = identity.isMap;
exports.isNode = identity.isNode;
exports.isPair = identity.isPair;
exports.isScalar = identity.isScalar;
exports.isSeq = identity.isSeq;
exports.Pair = Pair.Pair;
exports.Scalar = Scalar.Scalar;
exports.YAMLMap = YAMLMap.YAMLMap;
exports.YAMLSeq = YAMLSeq.YAMLSeq;
exports.CST = cst;
exports.Lexer = lexer.Lexer;
exports.LineCounter = lineCounter.LineCounter;
exports.Parser = parser.Parser;
exports.parse = publicApi.parse;
exports.parseAllDocuments = publicApi.parseAllDocuments;
exports.parseDocument = publicApi.parseDocument;
exports.stringify = publicApi.stringify;
exports.visit = visit.visit;
exports.visitAsync = visit.visitAsync;


/***/ }),
/* 37 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var node_process = __webpack_require__(38);
var directives = __webpack_require__(39);
var Document = __webpack_require__(42);
var errors = __webpack_require__(86);
var identity = __webpack_require__(40);
var composeDoc = __webpack_require__(87);
var resolveEnd = __webpack_require__(97);

function getErrorPos(src) {
    if (typeof src === 'number')
        return [src, src + 1];
    if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === 'string' ? source.length : 1)];
}
function parsePrelude(prelude) {
    let comment = '';
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
            case '#':
                comment +=
                    (comment === '' ? '' : afterEmptyLine ? '\n\n' : '\n') +
                        (source.substring(1) || ' ');
                atComment = true;
                afterEmptyLine = false;
                break;
            case '%':
                if (prelude[i + 1]?.[0] !== '#')
                    i += 1;
                atComment = false;
                break;
            default:
                // This may be wrong after doc-end, but in that case it doesn't matter
                if (!atComment)
                    afterEmptyLine = true;
                atComment = false;
        }
    }
    return { comment, afterEmptyLine };
}
/**
 * Compose a stream of CST nodes into a stream of YAML Documents.
 *
 * ```ts
 * import { Composer, Parser } from 'yaml'
 *
 * const src: string = ...
 * const tokens = new Parser().parse(src)
 * const docs = new Composer().compose(tokens)
 * ```
 */
class Composer {
    constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
            const pos = getErrorPos(source);
            if (warning)
                this.warnings.push(new errors.YAMLWarning(pos, code, message));
            else
                this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        this.directives = new directives.Directives({ version: options.version || '1.2' });
        this.options = options;
    }
    decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        //console.log({ dc: doc.comment, prelude, comment })
        if (comment) {
            const dc = doc.contents;
            if (afterDoc) {
                doc.comment = doc.comment ? `${doc.comment}\n${comment}` : comment;
            }
            else if (afterEmptyLine || doc.directives.docStart || !dc) {
                doc.commentBefore = comment;
            }
            else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
                let it = dc.items[0];
                if (identity.isPair(it))
                    it = it.key;
                const cb = it.commentBefore;
                it.commentBefore = cb ? `${comment}\n${cb}` : comment;
            }
            else {
                const cb = dc.commentBefore;
                dc.commentBefore = cb ? `${comment}\n${cb}` : comment;
            }
        }
        if (afterDoc) {
            for (let i = 0; i < this.errors.length; ++i)
                doc.errors.push(this.errors[i]);
            for (let i = 0; i < this.warnings.length; ++i)
                doc.warnings.push(this.warnings[i]);
        }
        else {
            doc.errors = this.errors;
            doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
    }
    /**
     * Current stream status information.
     *
     * Mostly useful at the end of input for an empty stream.
     */
    streamInfo() {
        return {
            comment: parsePrelude(this.prelude).comment,
            directives: this.directives,
            errors: this.errors,
            warnings: this.warnings
        };
    }
    /**
     * Compose tokens into documents.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
            yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
    }
    /** Advance the composer by one CST token. */
    *next(token) {
        if (node_process.env.LOG_STREAM)
            console.dir(token, { depth: null });
        switch (token.type) {
            case 'directive':
                this.directives.add(token.source, (offset, message, warning) => {
                    const pos = getErrorPos(token);
                    pos[0] += offset;
                    this.onError(pos, 'BAD_DIRECTIVE', message, warning);
                });
                this.prelude.push(token.source);
                this.atDirectives = true;
                break;
            case 'document': {
                const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
                if (this.atDirectives && !doc.directives.docStart)
                    this.onError(token, 'MISSING_CHAR', 'Missing directives-end/doc-start indicator line');
                this.decorate(doc, false);
                if (this.doc)
                    yield this.doc;
                this.doc = doc;
                this.atDirectives = false;
                break;
            }
            case 'byte-order-mark':
            case 'space':
                break;
            case 'comment':
            case 'newline':
                this.prelude.push(token.source);
                break;
            case 'error': {
                const msg = token.source
                    ? `${token.message}: ${JSON.stringify(token.source)}`
                    : token.message;
                const error = new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', msg);
                if (this.atDirectives || !this.doc)
                    this.errors.push(error);
                else
                    this.doc.errors.push(error);
                break;
            }
            case 'doc-end': {
                if (!this.doc) {
                    const msg = 'Unexpected doc-end without preceding document';
                    this.errors.push(new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', msg));
                    break;
                }
                this.doc.directives.docEnd = true;
                const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
                this.decorate(this.doc, true);
                if (end.comment) {
                    const dc = this.doc.comment;
                    this.doc.comment = dc ? `${dc}\n${end.comment}` : end.comment;
                }
                this.doc.range[2] = end.offset;
                break;
            }
            default:
                this.errors.push(new errors.YAMLParseError(getErrorPos(token), 'UNEXPECTED_TOKEN', `Unsupported token ${token.type}`));
        }
    }
    /**
     * Call at end of input to yield any remaining document.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
            this.decorate(this.doc, true);
            yield this.doc;
            this.doc = null;
        }
        else if (forceDoc) {
            const opts = Object.assign({ _directives: this.directives }, this.options);
            const doc = new Document.Document(undefined, opts);
            if (this.atDirectives)
                this.onError(endOffset, 'MISSING_CHAR', 'Missing directives-end indicator line');
            doc.range = [0, endOffset, endOffset];
            this.decorate(doc, false);
            yield doc;
        }
    }
}

exports.Composer = Composer;


/***/ }),
/* 38 */
/***/ ((module) => {

module.exports = require("process");

/***/ }),
/* 39 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var visit = __webpack_require__(41);

const escapeChars = {
    '!': '%21',
    ',': '%2C',
    '[': '%5B',
    ']': '%5D',
    '{': '%7B',
    '}': '%7D'
};
const escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, ch => escapeChars[ch]);
class Directives {
    constructor(yaml, tags) {
        /**
         * The directives-end/doc-start marker `---`. If `null`, a marker may still be
         * included in the document's stringified representation.
         */
        this.docStart = null;
        /** The doc-end marker `...`.  */
        this.docEnd = false;
        this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, Directives.defaultTags, tags);
    }
    clone() {
        const copy = new Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
    }
    /**
     * During parsing, get a Directives instance for the current document and
     * update the stream state according to the current version's spec.
     */
    atDocument() {
        const res = new Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
            case '1.1':
                this.atNextDocument = true;
                break;
            case '1.2':
                this.atNextDocument = false;
                this.yaml = {
                    explicit: Directives.defaultYaml.explicit,
                    version: '1.2'
                };
                this.tags = Object.assign({}, Directives.defaultTags);
                break;
        }
        return res;
    }
    /**
     * @param onError - May be called even if the action was successful
     * @returns `true` on success
     */
    add(line, onError) {
        if (this.atNextDocument) {
            this.yaml = { explicit: Directives.defaultYaml.explicit, version: '1.1' };
            this.tags = Object.assign({}, Directives.defaultTags);
            this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
            case '%TAG': {
                if (parts.length !== 2) {
                    onError(0, '%TAG directive should contain exactly two parts');
                    if (parts.length < 2)
                        return false;
                }
                const [handle, prefix] = parts;
                this.tags[handle] = prefix;
                return true;
            }
            case '%YAML': {
                this.yaml.explicit = true;
                if (parts.length !== 1) {
                    onError(0, '%YAML directive should contain exactly one part');
                    return false;
                }
                const [version] = parts;
                if (version === '1.1' || version === '1.2') {
                    this.yaml.version = version;
                    return true;
                }
                else {
                    const isValid = /^\d+\.\d+$/.test(version);
                    onError(6, `Unsupported YAML version ${version}`, isValid);
                    return false;
                }
            }
            default:
                onError(0, `Unknown directive ${name}`, true);
                return false;
        }
    }
    /**
     * Resolves a tag, matching handles to those defined in %TAG directives.
     *
     * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
     *   `'!local'` tag, or `null` if unresolvable.
     */
    tagName(source, onError) {
        if (source === '!')
            return '!'; // non-specific tag
        if (source[0] !== '!') {
            onError(`Not a valid tag: ${source}`);
            return null;
        }
        if (source[1] === '<') {
            const verbatim = source.slice(2, -1);
            if (verbatim === '!' || verbatim === '!!') {
                onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
                return null;
            }
            if (source[source.length - 1] !== '>')
                onError('Verbatim tags must end with a >');
            return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
            onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
            try {
                return prefix + decodeURIComponent(suffix);
            }
            catch (error) {
                onError(String(error));
                return null;
            }
        }
        if (handle === '!')
            return source; // local tag
        onError(`Could not resolve tag: ${source}`);
        return null;
    }
    /**
     * Given a fully resolved tag, returns its printable string form,
     * taking into account current tag prefixes and defaults.
     */
    tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
            if (tag.startsWith(prefix))
                return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === '!' ? tag : `!<${tag}>`;
    }
    toString(doc) {
        const lines = this.yaml.explicit
            ? [`%YAML ${this.yaml.version || '1.2'}`]
            : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
            const tags = {};
            visit.visit(doc.contents, (_key, node) => {
                if (identity.isNode(node) && node.tag)
                    tags[node.tag] = true;
            });
            tagNames = Object.keys(tags);
        }
        else
            tagNames = [];
        for (const [handle, prefix] of tagEntries) {
            if (handle === '!!' && prefix === 'tag:yaml.org,2002:')
                continue;
            if (!doc || tagNames.some(tn => tn.startsWith(prefix)))
                lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join('\n');
    }
}
Directives.defaultYaml = { explicit: false, version: '1.2' };
Directives.defaultTags = { '!!': 'tag:yaml.org,2002:' };

exports.Directives = Directives;


/***/ }),
/* 40 */
/***/ ((__unused_webpack_module, exports) => {



const ALIAS = Symbol.for('yaml.alias');
const DOC = Symbol.for('yaml.document');
const MAP = Symbol.for('yaml.map');
const PAIR = Symbol.for('yaml.pair');
const SCALAR = Symbol.for('yaml.scalar');
const SEQ = Symbol.for('yaml.seq');
const NODE_TYPE = Symbol.for('yaml.node.type');
const isAlias = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === ALIAS;
const isDocument = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === DOC;
const isMap = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === MAP;
const isPair = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === PAIR;
const isScalar = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === SCALAR;
const isSeq = (node) => !!node && typeof node === 'object' && node[NODE_TYPE] === SEQ;
function isCollection(node) {
    if (node && typeof node === 'object')
        switch (node[NODE_TYPE]) {
            case MAP:
            case SEQ:
                return true;
        }
    return false;
}
function isNode(node) {
    if (node && typeof node === 'object')
        switch (node[NODE_TYPE]) {
            case ALIAS:
            case MAP:
            case SCALAR:
            case SEQ:
                return true;
        }
    return false;
}
const hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

exports.ALIAS = ALIAS;
exports.DOC = DOC;
exports.MAP = MAP;
exports.NODE_TYPE = NODE_TYPE;
exports.PAIR = PAIR;
exports.SCALAR = SCALAR;
exports.SEQ = SEQ;
exports.hasAnchor = hasAnchor;
exports.isAlias = isAlias;
exports.isCollection = isCollection;
exports.isDocument = isDocument;
exports.isMap = isMap;
exports.isNode = isNode;
exports.isPair = isPair;
exports.isScalar = isScalar;
exports.isSeq = isSeq;


/***/ }),
/* 41 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);

const BREAK = Symbol('break visit');
const SKIP = Symbol('skip children');
const REMOVE = Symbol('remove node');
/**
 * Apply a visitor to an AST node or document.
 *
 * Walks through the tree (depth-first) starting from `node`, calling a
 * `visitor` function with three arguments:
 *   - `key`: For sequence values and map `Pair`, the node's index in the
 *     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
 *     `null` for the root node.
 *   - `node`: The current node.
 *   - `path`: The ancestry of the current node.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this node, continue with next
 *     sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current node, then continue with the next one
 *   - `Node`: Replace the current node, then continue by visiting it
 *   - `number`: While iterating the items of a sequence or map, set the index
 *     of the next step. This is useful especially if the index of the current
 *     node has changed.
 *
 * If `visitor` is a single function, it will be called with all values
 * encountered in the tree, including e.g. `null` values. Alternatively,
 * separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
 * `Alias` and `Scalar` node. To define the same visitor function for more than
 * one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
 * and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
 * specific defined one will be used for each node.
 */
function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
            node.contents = null;
    }
    else
        visit_(null, node, visitor_, Object.freeze([]));
}
// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.
/** Terminate visit traversal completely */
visit.BREAK = BREAK;
/** Do not visit the children of the current node */
visit.SKIP = SKIP;
/** Remove the current node */
visit.REMOVE = REMOVE;
function visit_(key, node, visitor, path) {
    const ctrl = callVisitor(key, node, visitor, path);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== 'symbol') {
        if (identity.isCollection(node)) {
            path = Object.freeze(path.concat(node));
            for (let i = 0; i < node.items.length; ++i) {
                const ci = visit_(i, node.items[i], visitor, path);
                if (typeof ci === 'number')
                    i = ci - 1;
                else if (ci === BREAK)
                    return BREAK;
                else if (ci === REMOVE) {
                    node.items.splice(i, 1);
                    i -= 1;
                }
            }
        }
        else if (identity.isPair(node)) {
            path = Object.freeze(path.concat(node));
            const ck = visit_('key', node.key, visitor, path);
            if (ck === BREAK)
                return BREAK;
            else if (ck === REMOVE)
                node.key = null;
            const cv = visit_('value', node.value, visitor, path);
            if (cv === BREAK)
                return BREAK;
            else if (cv === REMOVE)
                node.value = null;
        }
    }
    return ctrl;
}
/**
 * Apply an async visitor to an AST node or document.
 *
 * Walks through the tree (depth-first) starting from `node`, calling a
 * `visitor` function with three arguments:
 *   - `key`: For sequence values and map `Pair`, the node's index in the
 *     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
 *     `null` for the root node.
 *   - `node`: The current node.
 *   - `path`: The ancestry of the current node.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `Promise`: Must resolve to one of the following values
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this node, continue with next
 *     sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current node, then continue with the next one
 *   - `Node`: Replace the current node, then continue by visiting it
 *   - `number`: While iterating the items of a sequence or map, set the index
 *     of the next step. This is useful especially if the index of the current
 *     node has changed.
 *
 * If `visitor` is a single function, it will be called with all values
 * encountered in the tree, including e.g. `null` values. Alternatively,
 * separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
 * `Alias` and `Scalar` node. To define the same visitor function for more than
 * one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
 * and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
 * specific defined one will be used for each node.
 */
async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
            node.contents = null;
    }
    else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
}
// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.
/** Terminate visit traversal completely */
visitAsync.BREAK = BREAK;
/** Do not visit the children of the current node */
visitAsync.SKIP = SKIP;
/** Remove the current node */
visitAsync.REMOVE = REMOVE;
async function visitAsync_(key, node, visitor, path) {
    const ctrl = await callVisitor(key, node, visitor, path);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== 'symbol') {
        if (identity.isCollection(node)) {
            path = Object.freeze(path.concat(node));
            for (let i = 0; i < node.items.length; ++i) {
                const ci = await visitAsync_(i, node.items[i], visitor, path);
                if (typeof ci === 'number')
                    i = ci - 1;
                else if (ci === BREAK)
                    return BREAK;
                else if (ci === REMOVE) {
                    node.items.splice(i, 1);
                    i -= 1;
                }
            }
        }
        else if (identity.isPair(node)) {
            path = Object.freeze(path.concat(node));
            const ck = await visitAsync_('key', node.key, visitor, path);
            if (ck === BREAK)
                return BREAK;
            else if (ck === REMOVE)
                node.key = null;
            const cv = await visitAsync_('value', node.value, visitor, path);
            if (cv === BREAK)
                return BREAK;
            else if (cv === REMOVE)
                node.value = null;
        }
    }
    return ctrl;
}
function initVisitor(visitor) {
    if (typeof visitor === 'object' &&
        (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
            Alias: visitor.Node,
            Map: visitor.Node,
            Scalar: visitor.Node,
            Seq: visitor.Node
        }, visitor.Value && {
            Map: visitor.Value,
            Scalar: visitor.Value,
            Seq: visitor.Value
        }, visitor.Collection && {
            Map: visitor.Collection,
            Seq: visitor.Collection
        }, visitor);
    }
    return visitor;
}
function callVisitor(key, node, visitor, path) {
    if (typeof visitor === 'function')
        return visitor(key, node, path);
    if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
    if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
    if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
    if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
    if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
    return undefined;
}
function replaceNode(key, path, node) {
    const parent = path[path.length - 1];
    if (identity.isCollection(parent)) {
        parent.items[key] = node;
    }
    else if (identity.isPair(parent)) {
        if (key === 'key')
            parent.key = node;
        else
            parent.value = node;
    }
    else if (identity.isDocument(parent)) {
        parent.contents = node;
    }
    else {
        const pt = identity.isAlias(parent) ? 'alias' : 'scalar';
        throw new Error(`Cannot replace node with ${pt} parent`);
    }
}

exports.visit = visit;
exports.visitAsync = visitAsync;


/***/ }),
/* 42 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Alias = __webpack_require__(43);
var Collection = __webpack_require__(48);
var identity = __webpack_require__(40);
var Pair = __webpack_require__(51);
var toJS = __webpack_require__(47);
var Schema = __webpack_require__(60);
var stringifyDocument = __webpack_require__(85);
var anchors = __webpack_require__(44);
var applyReviver = __webpack_require__(46);
var createNode = __webpack_require__(49);
var directives = __webpack_require__(39);

class Document {
    constructor(value, replacer, options) {
        /** A comment before this Document */
        this.commentBefore = null;
        /** A comment immediately after this Document */
        this.comment = null;
        /** Errors encountered during parsing. */
        this.errors = [];
        /** Warnings encountered during parsing. */
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === 'function' || Array.isArray(replacer)) {
            _replacer = replacer;
        }
        else if (options === undefined && replacer) {
            options = replacer;
            replacer = undefined;
        }
        const opt = Object.assign({
            intAsBigInt: false,
            keepSourceTokens: false,
            logLevel: 'warn',
            prettyErrors: true,
            strict: true,
            stringKeys: false,
            uniqueKeys: true,
            version: '1.2'
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
            this.directives = options._directives.atDocument();
            if (this.directives.yaml.explicit)
                version = this.directives.yaml.version;
        }
        else
            this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        // @ts-expect-error We can't really know that this matches Contents.
        this.contents =
            value === undefined ? null : this.createNode(value, _replacer, options);
    }
    /**
     * Create a deep copy of this Document and its contents.
     *
     * Custom Node values that inherit from `Object` still refer to their original instances.
     */
    clone() {
        const copy = Object.create(Document.prototype, {
            [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
            copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        // @ts-expect-error We can't really know that this matches Contents.
        copy.contents = identity.isNode(this.contents)
            ? this.contents.clone(copy.schema)
            : this.contents;
        if (this.range)
            copy.range = this.range.slice();
        return copy;
    }
    /** Adds a value to the document. */
    add(value) {
        if (assertCollection(this.contents))
            this.contents.add(value);
    }
    /** Adds a value to the document. */
    addIn(path, value) {
        if (assertCollection(this.contents))
            this.contents.addIn(path, value);
    }
    /**
     * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
     *
     * If `node` already has an anchor, `name` is ignored.
     * Otherwise, the `node.anchor` value will be set to `name`,
     * or if an anchor with that name is already present in the document,
     * `name` will be used as a prefix for a new unique anchor.
     * If `name` is undefined, the generated anchor will use 'a' as a prefix.
     */
    createAlias(node, name) {
        if (!node.anchor) {
            const prev = anchors.anchorNames(this);
            node.anchor =
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                !name || prev.has(name) ? anchors.findNewAnchor(name || 'a', prev) : name;
        }
        return new Alias.Alias(node.anchor);
    }
    createNode(value, replacer, options) {
        let _replacer = undefined;
        if (typeof replacer === 'function') {
            value = replacer.call({ '': value }, '', value);
            _replacer = replacer;
        }
        else if (Array.isArray(replacer)) {
            const keyToStr = (v) => typeof v === 'number' || v instanceof String || v instanceof Number;
            const asStr = replacer.filter(keyToStr).map(String);
            if (asStr.length > 0)
                replacer = replacer.concat(asStr);
            _replacer = replacer;
        }
        else if (options === undefined && replacer) {
            options = replacer;
            replacer = undefined;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, 
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        anchorPrefix || 'a');
        const ctx = {
            aliasDuplicateObjects: aliasDuplicateObjects ?? true,
            keepUndefined: keepUndefined ?? false,
            onAnchor,
            onTagObj,
            replacer: _replacer,
            schema: this.schema,
            sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
            node.flow = true;
        setAnchors();
        return node;
    }
    /**
     * Convert a key and a value into a `Pair` using the current schema,
     * recursively wrapping all values as `Scalar` or `Collection` nodes.
     */
    createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
            if (this.contents == null)
                return false;
            // @ts-expect-error Presumed impossible if Strict extends false
            this.contents = null;
            return true;
        }
        return assertCollection(this.contents)
            ? this.contents.deleteIn(path)
            : false;
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    get(key, keepScalar) {
        return identity.isCollection(this.contents)
            ? this.contents.get(key, keepScalar)
            : undefined;
    }
    /**
     * Returns item at `path`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
            return !keepScalar && identity.isScalar(this.contents)
                ? this.contents.value
                : this.contents;
        return identity.isCollection(this.contents)
            ? this.contents.getIn(path, keepScalar)
            : undefined;
    }
    /**
     * Checks if the document includes a value with the key `key`.
     */
    has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
    }
    /**
     * Checks if the document includes a value at `path`.
     */
    hasIn(path) {
        if (Collection.isEmptyPath(path))
            return this.contents !== undefined;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    set(key, value) {
        if (this.contents == null) {
            // @ts-expect-error We can't really know that this matches Contents.
            this.contents = Collection.collectionFromPath(this.schema, [key], value);
        }
        else if (assertCollection(this.contents)) {
            this.contents.set(key, value);
        }
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
            // @ts-expect-error We can't really know that this matches Contents.
            this.contents = value;
        }
        else if (this.contents == null) {
            // @ts-expect-error We can't really know that this matches Contents.
            this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        }
        else if (assertCollection(this.contents)) {
            this.contents.setIn(path, value);
        }
    }
    /**
     * Change the YAML version and schema used by the document.
     * A `null` version disables support for directives, explicit tags, anchors, and aliases.
     * It also requires the `schema` option to be given as a `Schema` instance value.
     *
     * Overrides all previously set schema options.
     */
    setSchema(version, options = {}) {
        if (typeof version === 'number')
            version = String(version);
        let opt;
        switch (version) {
            case '1.1':
                if (this.directives)
                    this.directives.yaml.version = '1.1';
                else
                    this.directives = new directives.Directives({ version: '1.1' });
                opt = { resolveKnownTags: false, schema: 'yaml-1.1' };
                break;
            case '1.2':
            case 'next':
                if (this.directives)
                    this.directives.yaml.version = version;
                else
                    this.directives = new directives.Directives({ version });
                opt = { resolveKnownTags: true, schema: 'core' };
                break;
            case null:
                if (this.directives)
                    delete this.directives;
                opt = null;
                break;
            default: {
                const sv = JSON.stringify(version);
                throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
            }
        }
        // Not using `instanceof Schema` to allow for duck typing
        if (options.schema instanceof Object)
            this.schema = options.schema;
        else if (opt)
            this.schema = new Schema.Schema(Object.assign(opt, options));
        else
            throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    // json & jsonArg are only used from toJSON()
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
            anchors: new Map(),
            doc: this,
            keep: !json,
            mapAsMap: mapAsMap === true,
            mapKeyWarned: false,
            maxAliasCount: typeof maxAliasCount === 'number' ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? '', ctx);
        if (typeof onAnchor === 'function')
            for (const { count, res } of ctx.anchors.values())
                onAnchor(res, count);
        return typeof reviver === 'function'
            ? applyReviver.applyReviver(reviver, { '': res }, '', res)
            : res;
    }
    /**
     * A JSON representation of the document `contents`.
     *
     * @param jsonArg Used by `JSON.stringify` to indicate the array index or
     *   property name.
     */
    toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    /** A YAML representation of the document. */
    toString(options = {}) {
        if (this.errors.length > 0)
            throw new Error('Document with errors cannot be stringified');
        if ('indent' in options &&
            (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
            const s = JSON.stringify(options.indent);
            throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
    }
}
function assertCollection(contents) {
    if (identity.isCollection(contents))
        return true;
    throw new Error('Expected a YAML collection as document contents');
}

exports.Document = Document;


/***/ }),
/* 43 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var anchors = __webpack_require__(44);
var visit = __webpack_require__(41);
var identity = __webpack_require__(40);
var Node = __webpack_require__(45);
var toJS = __webpack_require__(47);

class Alias extends Node.NodeBase {
    constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, 'tag', {
            set() {
                throw new Error('Alias nodes cannot have tags');
            }
        });
    }
    /**
     * Resolve the value of this alias within `doc`, finding the last
     * instance of the `source` anchor before this node.
     */
    resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
            throw new ReferenceError('Alias resolution is disabled');
        let nodes;
        if (ctx?.aliasResolveCache) {
            nodes = ctx.aliasResolveCache;
        }
        else {
            nodes = [];
            visit.visit(doc, {
                Node: (_key, node) => {
                    if (identity.isAlias(node) || identity.hasAnchor(node))
                        nodes.push(node);
                }
            });
            if (ctx)
                ctx.aliasResolveCache = nodes;
        }
        let found = undefined;
        for (const node of nodes) {
            if (node === this)
                break;
            if (node.anchor === this.source)
                found = node;
        }
        if (found && ctx) {
            const { anchors, doc, maxAliasCount } = ctx;
            let data = anchors.get(found);
            if (!data) {
                // Resolve anchors for Node.prototype.toJS()
                toJS.toJS(found, null, ctx);
                data = anchors.get(found);
            }
            /* istanbul ignore if */
            if (data?.res === undefined) {
                const msg = 'This should not happen: Alias anchor was not resolved?';
                throw new ReferenceError(msg);
            }
            if (maxAliasCount >= 0) {
                data.count += 1;
                if (data.aliasCount === 0)
                    data.aliasCount = getAliasCount(doc, found, anchors);
                if (data.count * data.aliasCount > maxAliasCount) {
                    const msg = 'Excessive alias count indicates a resource exhaustion attack';
                    throw new ReferenceError(msg);
                }
            }
        }
        return found;
    }
    toJSON(_arg, ctx) {
        if (!ctx)
            return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
    }
    toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
            anchors.anchorIsValid(this.source);
            if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
                const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
                throw new Error(msg);
            }
            if (ctx.implicitKey)
                return `${src} `;
        }
        return src;
    }
}
function getAliasCount(doc, node, anchors) {
    if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors && source && anchors.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
    }
    else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
            const c = getAliasCount(doc, item, anchors);
            if (c > count)
                count = c;
        }
        return count;
    }
    else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors);
        const vc = getAliasCount(doc, node.value, anchors);
        return Math.max(kc, vc);
    }
    return 1;
}

exports.Alias = Alias;


/***/ }),
/* 44 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var visit = __webpack_require__(41);

/**
 * Verify that the input string is a valid anchor.
 *
 * Will throw on errors.
 */
function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
    }
    return true;
}
function anchorNames(root) {
    const anchors = new Set();
    visit.visit(root, {
        Value(_key, node) {
            if (node.anchor)
                anchors.add(node.anchor);
        }
    });
    return anchors;
}
/** Find a new anchor name with the given `prefix` and a one-indexed suffix. */
function findNewAnchor(prefix, exclude) {
    for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
            return name;
    }
}
function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = new Map();
    let prevAnchors = null;
    return {
        onAnchor: (source) => {
            aliasObjects.push(source);
            prevAnchors ?? (prevAnchors = anchorNames(doc));
            const anchor = findNewAnchor(prefix, prevAnchors);
            prevAnchors.add(anchor);
            return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
            for (const source of aliasObjects) {
                const ref = sourceObjects.get(source);
                if (typeof ref === 'object' &&
                    ref.anchor &&
                    (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
                    ref.node.anchor = ref.anchor;
                }
                else {
                    const error = new Error('Failed to resolve repeated object (this should not happen)');
                    error.source = source;
                    throw error;
                }
            }
        },
        sourceObjects
    };
}

exports.anchorIsValid = anchorIsValid;
exports.anchorNames = anchorNames;
exports.createNodeAnchors = createNodeAnchors;
exports.findNewAnchor = findNewAnchor;


/***/ }),
/* 45 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var applyReviver = __webpack_require__(46);
var identity = __webpack_require__(40);
var toJS = __webpack_require__(47);

class NodeBase {
    constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
    }
    /** Create a copy of this node.  */
    clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
            copy.range = this.range.slice();
        return copy;
    }
    /** A plain JavaScript representation of this node. */
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
            throw new TypeError('A document argument is required');
        const ctx = {
            anchors: new Map(),
            doc,
            keep: true,
            mapAsMap: mapAsMap === true,
            mapKeyWarned: false,
            maxAliasCount: typeof maxAliasCount === 'number' ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, '', ctx);
        if (typeof onAnchor === 'function')
            for (const { count, res } of ctx.anchors.values())
                onAnchor(res, count);
        return typeof reviver === 'function'
            ? applyReviver.applyReviver(reviver, { '': res }, '', res)
            : res;
    }
}

exports.NodeBase = NodeBase;


/***/ }),
/* 46 */
/***/ ((__unused_webpack_module, exports) => {



/**
 * Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
 * in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
 * 2021 edition: https://tc39.es/ecma262/#sec-json.parse
 *
 * Includes extensions for handling Map and Set objects.
 */
function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
            for (let i = 0, len = val.length; i < len; ++i) {
                const v0 = val[i];
                const v1 = applyReviver(reviver, val, String(i), v0);
                // eslint-disable-next-line @typescript-eslint/no-array-delete
                if (v1 === undefined)
                    delete val[i];
                else if (v1 !== v0)
                    val[i] = v1;
            }
        }
        else if (val instanceof Map) {
            for (const k of Array.from(val.keys())) {
                const v0 = val.get(k);
                const v1 = applyReviver(reviver, val, k, v0);
                if (v1 === undefined)
                    val.delete(k);
                else if (v1 !== v0)
                    val.set(k, v1);
            }
        }
        else if (val instanceof Set) {
            for (const v0 of Array.from(val)) {
                const v1 = applyReviver(reviver, val, v0, v0);
                if (v1 === undefined)
                    val.delete(v0);
                else if (v1 !== v0) {
                    val.delete(v0);
                    val.add(v1);
                }
            }
        }
        else {
            for (const [k, v0] of Object.entries(val)) {
                const v1 = applyReviver(reviver, val, k, v0);
                if (v1 === undefined)
                    delete val[k];
                else if (v1 !== v0)
                    val[k] = v1;
            }
        }
    }
    return reviver.call(obj, key, val);
}

exports.applyReviver = applyReviver;


/***/ }),
/* 47 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);

/**
 * Recursively convert any node or its contents to native JavaScript
 *
 * @param value - The input value
 * @param arg - If `value` defines a `toJSON()` method, use this
 *   as its first argument
 * @param ctx - Conversion context, originally set in Document#toJS(). If
 *   `{ keep: true }` is not set, output should be suitable for JSON
 *   stringification.
 */
function toJS(value, arg, ctx) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
    if (value && typeof value.toJSON === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        if (!ctx || !identity.hasAnchor(value))
            return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: undefined };
        ctx.anchors.set(value, data);
        ctx.onCreate = res => {
            data.res = res;
            delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
            ctx.onCreate(res);
        return res;
    }
    if (typeof value === 'bigint' && !ctx?.keep)
        return Number(value);
    return value;
}

exports.toJS = toJS;


/***/ }),
/* 48 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var createNode = __webpack_require__(49);
var identity = __webpack_require__(40);
var Node = __webpack_require__(45);

function collectionFromPath(schema, path, value) {
    let v = value;
    for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === 'number' && Number.isInteger(k) && k >= 0) {
            const a = [];
            a[k] = v;
            v = a;
        }
        else {
            v = new Map([[k, v]]);
        }
    }
    return createNode.createNode(v, undefined, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
            throw new Error('This should not happen, please report a bug.');
        },
        schema,
        sourceObjects: new Map()
    });
}
// Type guard is intentionally a little wrong so as to be more useful,
// as it does not cover untypable empty non-string iterables (e.g. []).
const isEmptyPath = (path) => path == null ||
    (typeof path === 'object' && !!path[Symbol.iterator]().next().done);
class Collection extends Node.NodeBase {
    constructor(type, schema) {
        super(type);
        Object.defineProperty(this, 'schema', {
            value: schema,
            configurable: true,
            enumerable: false,
            writable: true
        });
    }
    /**
     * Create a copy of this collection.
     *
     * @param schema - If defined, overwrites the original's schema
     */
    clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
            copy.schema = schema;
        copy.items = copy.items.map(it => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
            copy.range = this.range.slice();
        return copy;
    }
    /**
     * Adds a value to the collection. For `!!map` and `!!omap` the value must
     * be a Pair instance or a `{ key, value }` object, which may not have a key
     * that already exists in the map.
     */
    addIn(path, value) {
        if (isEmptyPath(path))
            this.add(value);
        else {
            const [key, ...rest] = path;
            const node = this.get(key, true);
            if (identity.isCollection(node))
                node.addIn(rest, value);
            else if (node === undefined && this.schema)
                this.set(key, collectionFromPath(this.schema, rest, value));
            else
                throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
    }
    /**
     * Removes a value from the collection.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
            return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
            return node.deleteIn(rest);
        else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
            return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
            return identity.isCollection(node) ? node.getIn(rest, keepScalar) : undefined;
    }
    hasAllNullValues(allowScalar) {
        return this.items.every(node => {
            if (!identity.isPair(node))
                return false;
            const n = node.value;
            return (n == null ||
                (allowScalar &&
                    identity.isScalar(n) &&
                    n.value == null &&
                    !n.commentBefore &&
                    !n.comment &&
                    !n.tag));
        });
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     */
    hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
            return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
            this.set(key, value);
        }
        else {
            const node = this.get(key, true);
            if (identity.isCollection(node))
                node.setIn(rest, value);
            else if (node === undefined && this.schema)
                this.set(key, collectionFromPath(this.schema, rest, value));
            else
                throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
    }
}

exports.Collection = Collection;
exports.collectionFromPath = collectionFromPath;
exports.isEmptyPath = isEmptyPath;


/***/ }),
/* 49 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Alias = __webpack_require__(43);
var identity = __webpack_require__(40);
var Scalar = __webpack_require__(50);

const defaultTagPrefix = 'tag:yaml.org,2002:';
function findTagObject(value, tagName, tags) {
    if (tagName) {
        const match = tags.filter(t => t.tag === tagName);
        const tagObj = match.find(t => !t.format) ?? match[0];
        if (!tagObj)
            throw new Error(`Tag ${tagName} not found`);
        return tagObj;
    }
    return tags.find(t => t.identify?.(value) && !t.format);
}
function createNode(value, tagName, ctx) {
    if (identity.isDocument(value))
        value = value.contents;
    if (identity.isNode(value))
        return value;
    if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
    }
    if (value instanceof String ||
        value instanceof Number ||
        value instanceof Boolean ||
        (typeof BigInt !== 'undefined' && value instanceof BigInt) // not supported everywhere
    ) {
        // https://tc39.es/ecma262/#sec-serializejsonproperty
        value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
    // Detect duplicate references to the same object & use Alias nodes for all
    // after first. The `ref` wrapper allows for circular references to resolve.
    let ref = undefined;
    if (aliasDuplicateObjects && value && typeof value === 'object') {
        ref = sourceObjects.get(value);
        if (ref) {
            ref.anchor ?? (ref.anchor = onAnchor(value));
            return new Alias.Alias(ref.anchor);
        }
        else {
            ref = { anchor: null, node: null };
            sourceObjects.set(value, ref);
        }
    }
    if (tagName?.startsWith('!!'))
        tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema.tags);
    if (!tagObj) {
        if (value && typeof value.toJSON === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            value = value.toJSON();
        }
        if (!value || typeof value !== 'object') {
            const node = new Scalar.Scalar(value);
            if (ref)
                ref.node = node;
            return node;
        }
        tagObj =
            value instanceof Map
                ? schema[identity.MAP]
                : Symbol.iterator in Object(value)
                    ? schema[identity.SEQ]
                    : schema[identity.MAP];
    }
    if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
    }
    const node = tagObj?.createNode
        ? tagObj.createNode(ctx.schema, value, ctx)
        : typeof tagObj?.nodeClass?.from === 'function'
            ? tagObj.nodeClass.from(ctx.schema, value, ctx)
            : new Scalar.Scalar(value);
    if (tagName)
        node.tag = tagName;
    else if (!tagObj.default)
        node.tag = tagObj.tag;
    if (ref)
        ref.node = node;
    return node;
}

exports.createNode = createNode;


/***/ }),
/* 50 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var Node = __webpack_require__(45);
var toJS = __webpack_require__(47);

const isScalarValue = (value) => !value || (typeof value !== 'function' && typeof value !== 'object');
class Scalar extends Node.NodeBase {
    constructor(value) {
        super(identity.SCALAR);
        this.value = value;
    }
    toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
    }
    toString() {
        return String(this.value);
    }
}
Scalar.BLOCK_FOLDED = 'BLOCK_FOLDED';
Scalar.BLOCK_LITERAL = 'BLOCK_LITERAL';
Scalar.PLAIN = 'PLAIN';
Scalar.QUOTE_DOUBLE = 'QUOTE_DOUBLE';
Scalar.QUOTE_SINGLE = 'QUOTE_SINGLE';

exports.Scalar = Scalar;
exports.isScalarValue = isScalarValue;


/***/ }),
/* 51 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var createNode = __webpack_require__(49);
var stringifyPair = __webpack_require__(52);
var addPairToJSMap = __webpack_require__(57);
var identity = __webpack_require__(40);

function createPair(key, value, ctx) {
    const k = createNode.createNode(key, undefined, ctx);
    const v = createNode.createNode(value, undefined, ctx);
    return new Pair(k, v);
}
class Pair {
    constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
    }
    clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
            key = key.clone(schema);
        if (identity.isNode(value))
            value = value.clone(schema);
        return new Pair(key, value);
    }
    toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
        return ctx?.doc
            ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep)
            : JSON.stringify(this);
    }
}

exports.Pair = Pair;
exports.createPair = createPair;


/***/ }),
/* 52 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var Scalar = __webpack_require__(50);
var stringify = __webpack_require__(53);
var stringifyComment = __webpack_require__(54);

function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = (identity.isNode(key) && key.comment) || null;
    if (simpleKeys) {
        if (keyComment) {
            throw new Error('With simple keys, key nodes cannot have comments');
        }
        if (identity.isCollection(key) || (!identity.isNode(key) && typeof key === 'object')) {
            const msg = 'With simple keys, collection cannot be used as a key value';
            throw new Error(msg);
        }
    }
    let explicitKey = !simpleKeys &&
        (!key ||
            (keyComment && value == null && !ctx.inFlow) ||
            identity.isCollection(key) ||
            (identity.isScalar(key)
                ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL
                : typeof key === 'object'));
    ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify.stringify(key, ctx, () => (keyCommentDone = true), () => (chompKeep = true));
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
            throw new Error('With simple keys, single line scalar must not span more than 1024 characters');
        explicitKey = true;
    }
    if (ctx.inFlow) {
        if (allNullValues || value == null) {
            if (keyCommentDone && onComment)
                onComment();
            return str === '' ? '?' : explicitKey ? `? ${str}` : str;
        }
    }
    else if ((allNullValues && !simpleKeys) || (value == null && explicitKey)) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
            str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        }
        else if (chompKeep && onChompKeep)
            onChompKeep();
        return str;
    }
    if (keyCommentDone)
        keyComment = null;
    if (explicitKey) {
        if (keyComment)
            str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}\n${indent}:`;
    }
    else {
        str = `${str}:`;
        if (keyComment)
            str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
    }
    else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === 'object')
            value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq &&
        indentStep.length >= 2 &&
        !ctx.inFlow &&
        !explicitKey &&
        identity.isSeq(value) &&
        !value.flow &&
        !value.tag &&
        !value.anchor) {
        // If indentSeq === false, consider '- ' as part of indentation where possible
        ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify.stringify(value, ctx, () => (valueCommentDone = true), () => (chompKeep = true));
    let ws = ' ';
    if (keyComment || vsb || vcb) {
        ws = vsb ? '\n' : '';
        if (vcb) {
            const cs = commentString(vcb);
            ws += `\n${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === '' && !ctx.inFlow) {
            if (ws === '\n' && valueComment)
                ws = '\n\n';
        }
        else {
            ws += `\n${ctx.indent}`;
        }
    }
    else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf('\n');
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
            let hasPropsLine = false;
            if (hasNewline && (vs0 === '&' || vs0 === '!')) {
                let sp0 = valueStr.indexOf(' ');
                if (vs0 === '&' &&
                    sp0 !== -1 &&
                    sp0 < nl0 &&
                    valueStr[sp0 + 1] === '!') {
                    sp0 = valueStr.indexOf(' ', sp0 + 1);
                }
                if (sp0 === -1 || nl0 < sp0)
                    hasPropsLine = true;
            }
            if (!hasPropsLine)
                ws = `\n${ctx.indent}`;
        }
    }
    else if (valueStr === '' || valueStr[0] === '\n') {
        ws = '';
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
        if (valueCommentDone && onComment)
            onComment();
    }
    else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
    }
    else if (chompKeep && onChompKeep) {
        onChompKeep();
    }
    return str;
}

exports.stringifyPair = stringifyPair;


/***/ }),
/* 53 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var anchors = __webpack_require__(44);
var identity = __webpack_require__(40);
var stringifyComment = __webpack_require__(54);
var stringifyString = __webpack_require__(55);

function createStringifyContext(doc, options) {
    const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: 'PLAIN',
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: 'false',
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: 'null',
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: 'true',
        verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
        case 'block':
            inFlow = false;
            break;
        case 'flow':
            inFlow = true;
            break;
        default:
            inFlow = null;
    }
    return {
        anchors: new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? ' ' : '',
        indent: '',
        indentStep: typeof opt.indent === 'number' ? ' '.repeat(opt.indent) : '  ',
        inFlow,
        options: opt
    };
}
function getTagObject(tags, item) {
    if (item.tag) {
        const match = tags.filter(t => t.tag === item.tag);
        if (match.length > 0)
            return match.find(t => t.format === item.format) ?? match[0];
    }
    let tagObj = undefined;
    let obj;
    if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter(t => t.identify?.(obj));
        if (match.length > 1) {
            const testMatch = match.filter(t => t.test);
            if (testMatch.length > 0)
                match = testMatch;
        }
        tagObj =
            match.find(t => t.format === item.format) ?? match.find(t => !t.format);
    }
    else {
        obj = item;
        tagObj = tags.find(t => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? 'null' : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
}
// needs to be called before value stringifier to allow for circular anchor refs
function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
    if (!doc.directives)
        return '';
    const props = [];
    const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
    if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
        props.push(doc.directives.tagString(tag));
    return props.join(' ');
}
function stringify(item, ctx, onComment, onChompKeep) {
    if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
    if (identity.isAlias(item)) {
        if (ctx.doc.directives)
            return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
            throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        }
        else {
            if (ctx.resolvedAliases)
                ctx.resolvedAliases.add(item);
            else
                ctx.resolvedAliases = new Set([item]);
            item = item.resolve(ctx.doc);
        }
    }
    let tagObj = undefined;
    const node = identity.isNode(item)
        ? item
        : ctx.doc.createNode(item, { onTagObj: o => (tagObj = o) });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === 'function'
        ? tagObj.stringify(node, ctx, onComment, onChompKeep)
        : identity.isScalar(node)
            ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep)
            : node.toString(ctx, onComment, onChompKeep);
    if (!props)
        return str;
    return identity.isScalar(node) || str[0] === '{' || str[0] === '['
        ? `${props} ${str}`
        : `${props}\n${ctx.indent}${str}`;
}

exports.createStringifyContext = createStringifyContext;
exports.stringify = stringify;


/***/ }),
/* 54 */
/***/ ((__unused_webpack_module, exports) => {



/**
 * Stringifies a comment.
 *
 * Empty comment lines are left empty,
 * lines consisting of a single space are replaced by `#`,
 * and all other lines are prefixed with a `#`.
 */
const stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, '#');
function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
        return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
}
const lineComment = (str, indent, comment) => str.endsWith('\n')
    ? indentComment(comment, indent)
    : comment.includes('\n')
        ? '\n' + indentComment(comment, indent)
        : (str.endsWith(' ') ? '' : ' ') + comment;

exports.indentComment = indentComment;
exports.lineComment = lineComment;
exports.stringifyComment = stringifyComment;


/***/ }),
/* 55 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(50);
var foldFlowLines = __webpack_require__(56);

const getFoldOptions = (ctx, isBlock) => ({
    indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
});
// Also checks for lines starting with %, as parsing the output as YAML 1.1 will
// presume that's starting a new document.
const containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
        return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
        return false;
    for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === '\n') {
            if (i - start > limit)
                return true;
            start = i + 1;
            if (strLen - start <= limit)
                return false;
        }
    }
    return true;
}
function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
        return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
    let str = '';
    let start = 0;
    for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === ' ' && json[i + 1] === '\\' && json[i + 2] === 'n') {
            // space before newline needs to be escaped to not be folded
            str += json.slice(start, i) + '\\ ';
            i += 1;
            start = i;
            ch = '\\';
        }
        if (ch === '\\')
            switch (json[i + 1]) {
                case 'u':
                    {
                        str += json.slice(start, i);
                        const code = json.substr(i + 2, 4);
                        switch (code) {
                            case '0000':
                                str += '\\0';
                                break;
                            case '0007':
                                str += '\\a';
                                break;
                            case '000b':
                                str += '\\v';
                                break;
                            case '001b':
                                str += '\\e';
                                break;
                            case '0085':
                                str += '\\N';
                                break;
                            case '00a0':
                                str += '\\_';
                                break;
                            case '2028':
                                str += '\\L';
                                break;
                            case '2029':
                                str += '\\P';
                                break;
                            default:
                                if (code.substr(0, 2) === '00')
                                    str += '\\x' + code.substr(2);
                                else
                                    str += json.substr(i, 6);
                        }
                        i += 5;
                        start = i + 1;
                    }
                    break;
                case 'n':
                    if (implicitKey ||
                        json[i + 2] === '"' ||
                        json.length < minMultiLineLength) {
                        i += 1;
                    }
                    else {
                        // folding will eat first newline
                        str += json.slice(start, i) + '\n\n';
                        while (json[i + 2] === '\\' &&
                            json[i + 3] === 'n' &&
                            json[i + 4] !== '"') {
                            str += '\n';
                            i += 2;
                        }
                        str += indent;
                        // space after newline needs to be escaped to not be folded
                        if (json[i + 2] === ' ')
                            str += '\\';
                        i += 1;
                        start = i + 1;
                    }
                    break;
                default:
                    i += 1;
            }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey
        ? str
        : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false ||
        (ctx.implicitKey && value.includes('\n')) ||
        /[ \t]\n|\n[ \t]/.test(value) // single quoted string can't have leading or trailing whitespace around newline
    )
        return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? '  ' : '');
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
    return ctx.implicitKey
        ? res
        : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
        qs = doubleQuotedString;
    else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
            qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
            qs = doubleQuotedString;
        else
            qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
}
// The negative lookbehind avoids a polynomial search,
// but isn't supported yet on Safari: https://caniuse.com/js-regexp-lookbehind
let blockEndNewlines;
try {
    blockEndNewlines = new RegExp('(^|(?<!\n))\n+(?!\n|$)', 'g');
}
catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    // 1. Block can't end in whitespace unless the last line is non-empty.
    // 2. Strings consisting of only whitespace are best rendered explicitly.
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
    }
    const indent = ctx.indent ||
        (ctx.forceBlockIndent || containsDocumentMarker(value) ? '  ' : '');
    const literal = blockQuote === 'literal'
        ? true
        : blockQuote === 'folded' || type === Scalar.Scalar.BLOCK_FOLDED
            ? false
            : type === Scalar.Scalar.BLOCK_LITERAL
                ? true
                : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
        return literal ? '|\n' : '>\n';
    // determine chomping from whitespace at value end
    let chomp;
    let endStart;
    for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== '\n' && ch !== '\t' && ch !== ' ')
            break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf('\n');
    if (endNlPos === -1) {
        chomp = '-'; // strip
    }
    else if (value === end || endNlPos !== end.length - 1) {
        chomp = '+'; // keep
        if (onChompKeep)
            onChompKeep();
    }
    else {
        chomp = ''; // clip
    }
    if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === '\n')
            end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    // determine indent indicator from whitespace at value start
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === ' ')
            startWithSpace = true;
        else if (ch === '\n')
            startNlPos = startEnd;
        else
            break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? '2' : '1'; // root is at -1
    // Leading | or > is added later
    let header = (startWithSpace ? indentSize : '') + chomp;
    if (comment) {
        header += ' ' + commentString(comment.replace(/ ?[\r\n]+/g, ' '));
        if (onComment)
            onComment();
    }
    if (!literal) {
        const foldedValue = value
            .replace(/\n+/g, '\n$&')
            .replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, '$1$2') // more-indented lines aren't folded
            //                ^ more-ind. ^ empty     ^ capture next empty lines only at end of indent
            .replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== 'folded' && type !== Scalar.Scalar.BLOCK_FOLDED) {
            foldOptions.onOverflow = () => {
                literalFallback = true;
            };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
            return `>${header}\n${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}\n${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if ((implicitKey && value.includes('\n')) ||
        (inFlow && /[[\]{},]/.test(value))) {
        return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        // not allowed:
        // - '-' or '?'
        // - start with an indicator character (except [?:-]) or /[?-] /
        // - '\n ', ': ' or ' \n' anywhere
        // - '#' not preceded by a non-space char
        // - end with ' ' or ':'
        return implicitKey || inFlow || !value.includes('\n')
            ? quotedString(value, ctx)
            : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey &&
        !inFlow &&
        type !== Scalar.Scalar.PLAIN &&
        value.includes('\n')) {
        // Where allowed & type not set explicitly, prefer block style for multiline strings
        return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
        if (indent === '') {
            ctx.forceBlockIndent = true;
            return blockString(item, ctx, onComment, onChompKeep);
        }
        else if (implicitKey && indent === indentStep) {
            return quotedString(value, ctx);
        }
    }
    const str = value.replace(/\n+/g, `$&\n${indent}`);
    // Verify that output will be parsed as a string, as e.g. plain numbers and
    // booleans get parsed with those types in v1.2 (e.g. '42', 'true' & '0.9e-3'),
    // and others in v1.1.
    if (actualString) {
        const test = (tag) => tag.default && tag.tag !== 'tag:yaml.org,2002:str' && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
            return quotedString(value, ctx);
    }
    return implicitKey
        ? str
        : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === 'string'
        ? item
        : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        // force double quotes on control characters & unpaired surrogates
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
            type = Scalar.Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
        switch (_type) {
            case Scalar.Scalar.BLOCK_FOLDED:
            case Scalar.Scalar.BLOCK_LITERAL:
                return implicitKey || inFlow
                    ? quotedString(ss.value, ctx) // blocks are not valid inside flow containers
                    : blockString(ss, ctx, onComment, onChompKeep);
            case Scalar.Scalar.QUOTE_DOUBLE:
                return doubleQuotedString(ss.value, ctx);
            case Scalar.Scalar.QUOTE_SINGLE:
                return singleQuotedString(ss.value, ctx);
            case Scalar.Scalar.PLAIN:
                return plainString(ss, ctx, onComment, onChompKeep);
            default:
                return null;
        }
    };
    let res = _stringify(type);
    if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = (implicitKey && defaultKeyType) || defaultStringType;
        res = _stringify(t);
        if (res === null)
            throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
}

exports.stringifyString = stringifyString;


/***/ }),
/* 56 */
/***/ ((__unused_webpack_module, exports) => {



const FOLD_FLOW = 'flow';
const FOLD_BLOCK = 'block';
const FOLD_QUOTED = 'quoted';
/**
 * Tries to keep input at up to `lineWidth` characters, splitting only on spaces
 * not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
 * terminated with `\n` and started with `indent`.
 */
function foldFlowLines(text, indent, mode = 'flow', { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
        return text;
    if (lineWidth < minContentWidth)
        minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep)
        return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === 'number') {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
            folds.push(0);
        else
            end = lineWidth - indentAtStart;
    }
    let split = undefined;
    let prev = undefined;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
            end = i + endStep;
    }
    for (let ch; (ch = text[(i += 1)]);) {
        if (mode === FOLD_QUOTED && ch === '\\') {
            escStart = i;
            switch (text[i + 1]) {
                case 'x':
                    i += 3;
                    break;
                case 'u':
                    i += 5;
                    break;
                case 'U':
                    i += 9;
                    break;
                default:
                    i += 1;
            }
            escEnd = i;
        }
        if (ch === '\n') {
            if (mode === FOLD_BLOCK)
                i = consumeMoreIndentedLines(text, i, indent.length);
            end = i + indent.length + endStep;
            split = undefined;
        }
        else {
            if (ch === ' ' &&
                prev &&
                prev !== ' ' &&
                prev !== '\n' &&
                prev !== '\t') {
                // space surrounded by non-space can be replaced with newline + indent
                const next = text[i + 1];
                if (next && next !== ' ' && next !== '\n' && next !== '\t')
                    split = i;
            }
            if (i >= end) {
                if (split) {
                    folds.push(split);
                    end = split + endStep;
                    split = undefined;
                }
                else if (mode === FOLD_QUOTED) {
                    // white-space collected at end may stretch past lineWidth
                    while (prev === ' ' || prev === '\t') {
                        prev = ch;
                        ch = text[(i += 1)];
                        overflow = true;
                    }
                    // Account for newline escape, but don't break preceding escape
                    const j = i > escEnd + 1 ? i - 2 : escStart - 1;
                    // Bail out if lineWidth & minContentWidth are shorter than an escape string
                    if (escapedFolds[j])
                        return text;
                    folds.push(j);
                    escapedFolds[j] = true;
                    end = j + endStep;
                    split = undefined;
                }
                else {
                    overflow = true;
                }
            }
        }
        prev = ch;
    }
    if (overflow && onOverflow)
        onOverflow();
    if (folds.length === 0)
        return text;
    if (onFold)
        onFold();
    let res = text.slice(0, folds[0]);
    for (let i = 0; i < folds.length; ++i) {
        const fold = folds[i];
        const end = folds[i + 1] || text.length;
        if (fold === 0)
            res = `\n${indent}${text.slice(0, end)}`;
        else {
            if (mode === FOLD_QUOTED && escapedFolds[fold])
                res += `${text[fold]}\\`;
            res += `\n${indent}${text.slice(fold + 1, end)}`;
        }
    }
    return res;
}
/**
 * Presumes `i + 1` is at the start of a line
 * @returns index of last newline in more-indented block
 */
function consumeMoreIndentedLines(text, i, indent) {
    let end = i;
    let start = i + 1;
    let ch = text[start];
    while (ch === ' ' || ch === '\t') {
        if (i < start + indent) {
            ch = text[++i];
        }
        else {
            do {
                ch = text[++i];
            } while (ch && ch !== '\n');
            end = i;
            start = i + 1;
            ch = text[start];
        }
    }
    return end;
}

exports.FOLD_BLOCK = FOLD_BLOCK;
exports.FOLD_FLOW = FOLD_FLOW;
exports.FOLD_QUOTED = FOLD_QUOTED;
exports.foldFlowLines = foldFlowLines;


/***/ }),
/* 57 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var log = __webpack_require__(58);
var merge = __webpack_require__(59);
var stringify = __webpack_require__(53);
var identity = __webpack_require__(40);
var toJS = __webpack_require__(47);

function addPairToJSMap(ctx, map, { key, value }) {
    if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
    // TODO: Should drop this special case for bare << handling
    else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
    else {
        const jsKey = toJS.toJS(key, '', ctx);
        if (map instanceof Map) {
            map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        }
        else if (map instanceof Set) {
            map.add(jsKey);
        }
        else {
            const stringKey = stringifyKey(key, jsKey, ctx);
            const jsValue = toJS.toJS(value, stringKey, ctx);
            if (stringKey in map)
                Object.defineProperty(map, stringKey, {
                    value: jsValue,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
            else
                map[stringKey] = jsValue;
        }
    }
    return map;
}
function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
        return '';
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    if (typeof jsKey !== 'object')
        return String(jsKey);
    if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = new Set();
        for (const node of ctx.anchors.keys())
            strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
            let jsonStr = JSON.stringify(strKey);
            if (jsonStr.length > 40)
                jsonStr = jsonStr.substring(0, 36) + '..."';
            log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
            ctx.mapKeyWarned = true;
        }
        return strKey;
    }
    return JSON.stringify(jsKey);
}

exports.addPairToJSMap = addPairToJSMap;


/***/ }),
/* 58 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var node_process = __webpack_require__(38);

function debug(logLevel, ...messages) {
    if (logLevel === 'debug')
        console.log(...messages);
}
function warn(logLevel, warning) {
    if (logLevel === 'debug' || logLevel === 'warn') {
        if (typeof node_process.emitWarning === 'function')
            node_process.emitWarning(warning);
        else
            console.warn(warning);
    }
}

exports.debug = debug;
exports.warn = warn;


/***/ }),
/* 59 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var Scalar = __webpack_require__(50);

// If the value associated with a merge key is a single mapping node, each of
// its key/value pairs is inserted into the current mapping, unless the key
// already exists in it. If the value associated with the merge key is a
// sequence, then this sequence is expected to contain mapping nodes and each
// of these nodes is merged in turn according to its order in the sequence.
// Keys in mapping nodes earlier in the sequence override keys specified in
// later mapping nodes. -- http://yaml.org/type/merge.html
const MERGE_KEY = '<<';
const merge = {
    identify: value => value === MERGE_KEY ||
        (typeof value === 'symbol' && value.description === MERGE_KEY),
    default: 'key',
    tag: 'tag:yaml.org,2002:merge',
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
};
const isMergeKey = (ctx, key) => (merge.identify(key) ||
    (identity.isScalar(key) &&
        (!key.type || key.type === Scalar.Scalar.PLAIN) &&
        merge.identify(key.value))) &&
    ctx?.doc.schema.tags.some(tag => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (identity.isSeq(source))
        for (const it of source.items)
            mergeValue(ctx, map, it);
    else if (Array.isArray(source))
        for (const it of source)
            mergeValue(ctx, map, it);
    else
        mergeValue(ctx, map, source);
}
function mergeValue(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (!identity.isMap(source))
        throw new Error('Merge sources must be maps or map aliases');
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value] of srcMap) {
        if (map instanceof Map) {
            if (!map.has(key))
                map.set(key, value);
        }
        else if (map instanceof Set) {
            map.add(key);
        }
        else if (!Object.prototype.hasOwnProperty.call(map, key)) {
            Object.defineProperty(map, key, {
                value,
                writable: true,
                enumerable: true,
                configurable: true
            });
        }
    }
    return map;
}
function resolveAliasValue(ctx, value) {
    return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
}

exports.addMergeToJSMap = addMergeToJSMap;
exports.isMergeKey = isMergeKey;
exports.merge = merge;


/***/ }),
/* 60 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var map = __webpack_require__(61);
var seq = __webpack_require__(64);
var string = __webpack_require__(66);
var tags = __webpack_require__(67);

const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
class Schema {
    constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat)
            ? tags.getTags(compat, 'compat')
            : compat
                ? tags.getTags(null, compat)
                : null;
        this.name = (typeof schema === 'string' && schema) || 'core';
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        // Used by createMap()
        this.sortMapEntries =
            typeof sortMapEntries === 'function'
                ? sortMapEntries
                : sortMapEntries === true
                    ? sortMapEntriesByKey
                    : null;
    }
    clone() {
        const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
    }
}

exports.Schema = Schema;


/***/ }),
/* 61 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var YAMLMap = __webpack_require__(62);

const map = {
    collection: 'map',
    default: true,
    nodeClass: YAMLMap.YAMLMap,
    tag: 'tag:yaml.org,2002:map',
    resolve(map, onError) {
        if (!identity.isMap(map))
            onError('Expected a mapping for this tag');
        return map;
    },
    createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
};

exports.map = map;


/***/ }),
/* 62 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyCollection = __webpack_require__(63);
var addPairToJSMap = __webpack_require__(57);
var Collection = __webpack_require__(48);
var identity = __webpack_require__(40);
var Pair = __webpack_require__(51);
var Scalar = __webpack_require__(50);

function findPair(items, key) {
    const k = identity.isScalar(key) ? key.value : key;
    for (const it of items) {
        if (identity.isPair(it)) {
            if (it.key === key || it.key === k)
                return it;
            if (identity.isScalar(it.key) && it.key.value === k)
                return it;
        }
    }
    return undefined;
}
class YAMLMap extends Collection.Collection {
    static get tagName() {
        return 'tag:yaml.org,2002:map';
    }
    constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
    }
    /**
     * A generic collection parsing method that can be extended
     * to other node classes that inherit from YAMLMap
     */
    static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
            if (typeof replacer === 'function')
                value = replacer.call(obj, key, value);
            else if (Array.isArray(replacer) && !replacer.includes(key))
                return;
            if (value !== undefined || keepUndefined)
                map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
            for (const [key, value] of obj)
                add(key, value);
        }
        else if (obj && typeof obj === 'object') {
            for (const key of Object.keys(obj))
                add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === 'function') {
            map.items.sort(schema.sortMapEntries);
        }
        return map;
    }
    /**
     * Adds a value to the collection.
     *
     * @param overwrite - If not set `true`, using a key that is already in the
     *   collection will throw. Otherwise, overwrites the previous value.
     */
    add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
            _pair = pair;
        else if (!pair || typeof pair !== 'object' || !('key' in pair)) {
            // In TypeScript, this never happens.
            _pair = new Pair.Pair(pair, pair?.value);
        }
        else
            _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
            if (!overwrite)
                throw new Error(`Key ${_pair.key} already set`);
            // For scalars, keep the old node & its comments and anchors
            if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
                prev.value.value = _pair.value;
            else
                prev.value = _pair.value;
        }
        else if (sortEntries) {
            const i = this.items.findIndex(item => sortEntries(_pair, item) < 0);
            if (i === -1)
                this.items.push(_pair);
            else
                this.items.splice(i, 0, _pair);
        }
        else {
            this.items.push(_pair);
        }
    }
    delete(key) {
        const it = findPair(this.items, key);
        if (!it)
            return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
    }
    get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? undefined;
    }
    has(key) {
        return !!findPair(this.items, key);
    }
    set(key, value) {
        this.add(new Pair.Pair(key, value), true);
    }
    /**
     * @param ctx - Conversion context, originally set in Document#toJS()
     * @param {Class} Type - If set, forces the returned collection type
     * @returns Instance of Type, Map, or Object
     */
    toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? new Map() : {};
        if (ctx?.onCreate)
            ctx.onCreate(map);
        for (const item of this.items)
            addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
    }
    toString(ctx, onComment, onChompKeep) {
        if (!ctx)
            return JSON.stringify(this);
        for (const item of this.items) {
            if (!identity.isPair(item))
                throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
            ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
            blockItemPrefix: '',
            flowChars: { start: '{', end: '}' },
            itemIndent: ctx.indent || '',
            onChompKeep,
            onComment
        });
    }
}

exports.YAMLMap = YAMLMap;
exports.findPair = findPair;


/***/ }),
/* 63 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var stringify = __webpack_require__(53);
var stringifyComment = __webpack_require__(54);

function stringifyCollection(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify(collection, ctx, options);
}
function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false; // flag for the preceding node's status
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
            if (!chompKeep && item.spaceBefore)
                lines.push('');
            addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
            if (item.comment)
                comment = item.comment;
        }
        else if (identity.isPair(item)) {
            const ik = identity.isNode(item.key) ? item.key : null;
            if (ik) {
                if (!chompKeep && ik.spaceBefore)
                    lines.push('');
                addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
            }
        }
        chompKeep = false;
        let str = stringify.stringify(item, itemCtx, () => (comment = null), () => (chompKeep = true));
        if (comment)
            str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        if (chompKeep && comment)
            chompKeep = false;
        lines.push(blockItemPrefix + str);
    }
    let str;
    if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
    }
    else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
            const line = lines[i];
            str += line ? `\n${indent}${line}` : '\n';
        }
    }
    if (comment) {
        str += '\n' + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
            onComment();
    }
    else if (chompKeep && onChompKeep)
        onChompKeep();
    return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
            if (item.spaceBefore)
                lines.push('');
            addCommentBefore(ctx, lines, item.commentBefore, false);
            if (item.comment)
                comment = item.comment;
        }
        else if (identity.isPair(item)) {
            const ik = identity.isNode(item.key) ? item.key : null;
            if (ik) {
                if (ik.spaceBefore)
                    lines.push('');
                addCommentBefore(ctx, lines, ik.commentBefore, false);
                if (ik.comment)
                    reqNewline = true;
            }
            const iv = identity.isNode(item.value) ? item.value : null;
            if (iv) {
                if (iv.comment)
                    comment = iv.comment;
                if (iv.commentBefore)
                    reqNewline = true;
            }
            else if (item.value == null && ik?.comment) {
                comment = ik.comment;
            }
        }
        if (comment)
            reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => (comment = null));
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes('\n'));
        if (i < items.length - 1) {
            str += ',';
        }
        else if (ctx.options.trailingComma) {
            if (ctx.options.lineWidth > 0) {
                reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) +
                    (str.length + 2) >
                    ctx.options.lineWidth);
            }
            if (reqNewline) {
                str += ',';
            }
        }
        if (comment)
            str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
        return start + end;
    }
    else {
        if (!reqNewline) {
            const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
            reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
            let str = start;
            for (const line of lines)
                str += line ? `\n${indentStep}${indent}${line}` : '\n';
            return `${str}\n${indent}${end}`;
        }
        else {
            return `${start}${fcPadding}${lines.join(' ')}${fcPadding}${end}`;
        }
    }
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
        comment = comment.replace(/^\n+/, '');
    if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart()); // Avoid double indent on first line
    }
}

exports.stringifyCollection = stringifyCollection;


/***/ }),
/* 64 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var YAMLSeq = __webpack_require__(65);

const seq = {
    collection: 'seq',
    default: true,
    nodeClass: YAMLSeq.YAMLSeq,
    tag: 'tag:yaml.org,2002:seq',
    resolve(seq, onError) {
        if (!identity.isSeq(seq))
            onError('Expected a sequence for this tag');
        return seq;
    },
    createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
};

exports.seq = seq;


/***/ }),
/* 65 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var createNode = __webpack_require__(49);
var stringifyCollection = __webpack_require__(63);
var Collection = __webpack_require__(48);
var identity = __webpack_require__(40);
var Scalar = __webpack_require__(50);
var toJS = __webpack_require__(47);

class YAMLSeq extends Collection.Collection {
    static get tagName() {
        return 'tag:yaml.org,2002:seq';
    }
    constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
    }
    add(value) {
        this.items.push(value);
    }
    /**
     * Removes a value from the collection.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     *
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number')
            return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
    }
    get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number')
            return undefined;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     */
    has(key) {
        const idx = asItemIndex(key);
        return typeof idx === 'number' && idx < this.items.length;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     *
     * If `key` does not contain a representation of an integer, this will throw.
     * It may be wrapped in a `Scalar`.
     */
    set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== 'number')
            throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
            prev.value = value;
        else
            this.items[idx] = value;
    }
    toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
            ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
            seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
    }
    toString(ctx, onComment, onChompKeep) {
        if (!ctx)
            return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
            blockItemPrefix: '- ',
            flowChars: { start: '[', end: ']' },
            itemIndent: (ctx.indent || '') + '  ',
            onChompKeep,
            onComment
        });
    }
    static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
            let i = 0;
            for (let it of obj) {
                if (typeof replacer === 'function') {
                    const key = obj instanceof Set ? it : String(i++);
                    it = replacer.call(obj, key, it);
                }
                seq.items.push(createNode.createNode(it, undefined, ctx));
            }
        }
        return seq;
    }
}
function asItemIndex(key) {
    let idx = identity.isScalar(key) ? key.value : key;
    if (idx && typeof idx === 'string')
        idx = Number(idx);
    return typeof idx === 'number' && Number.isInteger(idx) && idx >= 0
        ? idx
        : null;
}

exports.YAMLSeq = YAMLSeq;


/***/ }),
/* 66 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyString = __webpack_require__(55);

const string = {
    identify: value => typeof value === 'string',
    default: true,
    tag: 'tag:yaml.org,2002:str',
    resolve: str => str,
    stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
    }
};

exports.string = string;


/***/ }),
/* 67 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var map = __webpack_require__(61);
var _null = __webpack_require__(68);
var seq = __webpack_require__(64);
var string = __webpack_require__(66);
var bool = __webpack_require__(69);
var float = __webpack_require__(70);
var int = __webpack_require__(72);
var schema = __webpack_require__(73);
var schema$1 = __webpack_require__(74);
var binary = __webpack_require__(75);
var merge = __webpack_require__(59);
var omap = __webpack_require__(77);
var pairs = __webpack_require__(78);
var schema$2 = __webpack_require__(79);
var set = __webpack_require__(83);
var timestamp = __webpack_require__(84);

const schemas = new Map([
    ['core', schema.schema],
    ['failsafe', [map.map, seq.seq, string.string]],
    ['json', schema$1.schema],
    ['yaml11', schema$2.schema],
    ['yaml-1.1', schema$2.schema]
]);
const tagsByName = {
    binary: binary.binary,
    bool: bool.boolTag,
    float: float.float,
    floatExp: float.floatExp,
    floatNaN: float.floatNaN,
    floatTime: timestamp.floatTime,
    int: int.int,
    intHex: int.intHex,
    intOct: int.intOct,
    intTime: timestamp.intTime,
    map: map.map,
    merge: merge.merge,
    null: _null.nullTag,
    omap: omap.omap,
    pairs: pairs.pairs,
    seq: seq.seq,
    set: set.set,
    timestamp: timestamp.timestamp
};
const coreKnownTags = {
    'tag:yaml.org,2002:binary': binary.binary,
    'tag:yaml.org,2002:merge': merge.merge,
    'tag:yaml.org,2002:omap': omap.omap,
    'tag:yaml.org,2002:pairs': pairs.pairs,
    'tag:yaml.org,2002:set': set.set,
    'tag:yaml.org,2002:timestamp': timestamp.timestamp
};
function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge)
            ? schemaTags.concat(merge.merge)
            : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
        if (Array.isArray(customTags))
            tags = [];
        else {
            const keys = Array.from(schemas.keys())
                .filter(key => key !== 'yaml11')
                .map(key => JSON.stringify(key))
                .join(', ');
            throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
    }
    if (Array.isArray(customTags)) {
        for (const tag of customTags)
            tags = tags.concat(tag);
    }
    else if (typeof customTags === 'function') {
        tags = customTags(tags.slice());
    }
    if (addMergeTag)
        tags = tags.concat(merge.merge);
    return tags.reduce((tags, tag) => {
        const tagObj = typeof tag === 'string' ? tagsByName[tag] : tag;
        if (!tagObj) {
            const tagName = JSON.stringify(tag);
            const keys = Object.keys(tagsByName)
                .map(key => JSON.stringify(key))
                .join(', ');
            throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags.includes(tagObj))
            tags.push(tagObj);
        return tags;
    }, []);
}

exports.coreKnownTags = coreKnownTags;
exports.getTags = getTags;


/***/ }),
/* 68 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(50);

const nullTag = {
    identify: value => value == null,
    createNode: () => new Scalar.Scalar(null),
    default: true,
    tag: 'tag:yaml.org,2002:null',
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar.Scalar(null),
    stringify: ({ source }, ctx) => typeof source === 'string' && nullTag.test.test(source)
        ? source
        : ctx.options.nullStr
};

exports.nullTag = nullTag;


/***/ }),
/* 69 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(50);

const boolTag = {
    identify: value => typeof value === 'boolean',
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: str => new Scalar.Scalar(str[0] === 't' || str[0] === 'T'),
    stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
            const sv = source[0] === 't' || source[0] === 'T';
            if (value === sv)
                return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
};

exports.boolTag = boolTag;


/***/ }),
/* 70 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(50);
var stringifyNumber = __webpack_require__(71);

const floatNaN = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: str => str.slice(-3).toLowerCase() === 'nan'
        ? NaN
        : str[0] === '-'
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
};
const floatExp = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'EXP',
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: str => parseFloat(str),
    stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
};
const float = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf('.');
        if (dot !== -1 && str[str.length - 1] === '0')
            node.minFractionDigits = str.length - dot - 1;
        return node;
    },
    stringify: stringifyNumber.stringifyNumber
};

exports.float = float;
exports.floatExp = floatExp;
exports.floatNaN = floatNaN;


/***/ }),
/* 71 */
/***/ ((__unused_webpack_module, exports) => {



function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === 'bigint')
        return String(value);
    const num = typeof value === 'number' ? value : Number(value);
    if (!isFinite(num))
        return isNaN(num) ? '.nan' : num < 0 ? '-.inf' : '.inf';
    let n = Object.is(value, -0) ? '-0' : JSON.stringify(value);
    if (!format &&
        minFractionDigits &&
        (!tag || tag === 'tag:yaml.org,2002:float') &&
        /^-?\d/.test(n) &&
        !n.includes('e')) {
        let i = n.indexOf('.');
        if (i < 0) {
            i = n.length;
            n += '.';
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
            n += '0';
    }
    return n;
}

exports.stringifyNumber = stringifyNumber;


/***/ }),
/* 72 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyNumber = __webpack_require__(71);

const intIdentify = (value) => typeof value === 'bigint' || Number.isInteger(value);
const intResolve = (str, offset, radix, { intAsBigInt }) => (intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix));
function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
    return stringifyNumber.stringifyNumber(node);
}
const intOct = {
    identify: value => intIdentify(value) && value >= 0,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'OCT',
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: node => intStringify(node, 8, '0o')
};
const int = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
};
const intHex = {
    identify: value => intIdentify(value) && value >= 0,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'HEX',
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: node => intStringify(node, 16, '0x')
};

exports.int = int;
exports.intHex = intHex;
exports.intOct = intOct;


/***/ }),
/* 73 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var map = __webpack_require__(61);
var _null = __webpack_require__(68);
var seq = __webpack_require__(64);
var string = __webpack_require__(66);
var bool = __webpack_require__(69);
var float = __webpack_require__(70);
var int = __webpack_require__(72);

const schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.boolTag,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float
];

exports.schema = schema;


/***/ }),
/* 74 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(50);
var map = __webpack_require__(61);
var seq = __webpack_require__(64);

function intIdentify(value) {
    return typeof value === 'bigint' || Number.isInteger(value);
}
const stringifyJSON = ({ value }) => JSON.stringify(value);
const jsonScalars = [
    {
        identify: value => typeof value === 'string',
        default: true,
        tag: 'tag:yaml.org,2002:str',
        resolve: str => str,
        stringify: stringifyJSON
    },
    {
        identify: value => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: 'tag:yaml.org,2002:null',
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
    },
    {
        identify: value => typeof value === 'boolean',
        default: true,
        tag: 'tag:yaml.org,2002:bool',
        test: /^true$|^false$/,
        resolve: str => str === 'true',
        stringify: stringifyJSON
    },
    {
        identify: intIdentify,
        default: true,
        tag: 'tag:yaml.org,2002:int',
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
    },
    {
        identify: value => typeof value === 'number',
        default: true,
        tag: 'tag:yaml.org,2002:float',
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: str => parseFloat(str),
        stringify: stringifyJSON
    }
];
const jsonError = {
    default: true,
    tag: '',
    test: /^/,
    resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
    }
};
const schema = [map.map, seq.seq].concat(jsonScalars, jsonError);

exports.schema = schema;


/***/ }),
/* 75 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var node_buffer = __webpack_require__(76);
var Scalar = __webpack_require__(50);
var stringifyString = __webpack_require__(55);

const binary = {
    identify: value => value instanceof Uint8Array, // Buffer inherits from Uint8Array
    default: false,
    tag: 'tag:yaml.org,2002:binary',
    /**
     * Returns a Buffer in node and an Uint8Array in browsers
     *
     * To use the resulting buffer as an image, you'll want to do something like:
     *
     *   const blob = new Blob([buffer], { type: 'image/jpeg' })
     *   document.querySelector('#photo').src = URL.createObjectURL(blob)
     */
    resolve(src, onError) {
        if (typeof node_buffer.Buffer === 'function') {
            return node_buffer.Buffer.from(src, 'base64');
        }
        else if (typeof atob === 'function') {
            // On IE 11, atob() can't handle newlines
            const str = atob(src.replace(/[\n\r]/g, ''));
            const buffer = new Uint8Array(str.length);
            for (let i = 0; i < str.length; ++i)
                buffer[i] = str.charCodeAt(i);
            return buffer;
        }
        else {
            onError('This environment does not support reading binary tags; either Buffer or atob is required');
            return src;
        }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
            return '';
        const buf = value; // checked earlier by binary.identify()
        let str;
        if (typeof node_buffer.Buffer === 'function') {
            str =
                buf instanceof node_buffer.Buffer
                    ? buf.toString('base64')
                    : node_buffer.Buffer.from(buf.buffer).toString('base64');
        }
        else if (typeof btoa === 'function') {
            let s = '';
            for (let i = 0; i < buf.length; ++i)
                s += String.fromCharCode(buf[i]);
            str = btoa(s);
        }
        else {
            throw new Error('This environment does not support writing binary tags; either Buffer or btoa is required');
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
            const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
            const n = Math.ceil(str.length / lineWidth);
            const lines = new Array(n);
            for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
                lines[i] = str.substr(o, lineWidth);
            }
            str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? '\n' : ' ');
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
};

exports.binary = binary;


/***/ }),
/* 76 */
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),
/* 77 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var toJS = __webpack_require__(47);
var YAMLMap = __webpack_require__(62);
var YAMLSeq = __webpack_require__(65);
var pairs = __webpack_require__(78);

class YAMLOMap extends YAMLSeq.YAMLSeq {
    constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = YAMLOMap.tag;
    }
    /**
     * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
     * but TypeScript won't allow widening the signature of a child method.
     */
    toJSON(_, ctx) {
        if (!ctx)
            return super.toJSON(_);
        const map = new Map();
        if (ctx?.onCreate)
            ctx.onCreate(map);
        for (const pair of this.items) {
            let key, value;
            if (identity.isPair(pair)) {
                key = toJS.toJS(pair.key, '', ctx);
                value = toJS.toJS(pair.value, key, ctx);
            }
            else {
                key = toJS.toJS(pair, '', ctx);
            }
            if (map.has(key))
                throw new Error('Ordered maps must not include duplicate keys');
            map.set(key, value);
        }
        return map;
    }
    static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap = new this();
        omap.items = pairs$1.items;
        return omap;
    }
}
YAMLOMap.tag = 'tag:yaml.org,2002:omap';
const omap = {
    collection: 'seq',
    identify: value => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: 'tag:yaml.org,2002:omap',
    resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
            if (identity.isScalar(key)) {
                if (seenKeys.includes(key.value)) {
                    onError(`Ordered maps must not include duplicate keys: ${key.value}`);
                }
                else {
                    seenKeys.push(key.value);
                }
            }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
    },
    createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
};

exports.YAMLOMap = YAMLOMap;
exports.omap = omap;


/***/ }),
/* 78 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var Pair = __webpack_require__(51);
var Scalar = __webpack_require__(50);
var YAMLSeq = __webpack_require__(65);

function resolvePairs(seq, onError) {
    if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
            let item = seq.items[i];
            if (identity.isPair(item))
                continue;
            else if (identity.isMap(item)) {
                if (item.items.length > 1)
                    onError('Each pair must have its own sequence indicator');
                const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
                if (item.commentBefore)
                    pair.key.commentBefore = pair.key.commentBefore
                        ? `${item.commentBefore}\n${pair.key.commentBefore}`
                        : item.commentBefore;
                if (item.comment) {
                    const cn = pair.value ?? pair.key;
                    cn.comment = cn.comment
                        ? `${item.comment}\n${cn.comment}`
                        : item.comment;
                }
                item = pair;
            }
            seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
    }
    else
        onError('Expected a sequence for this tag');
    return seq;
}
function createPairs(schema, iterable, ctx) {
    const { replacer } = ctx;
    const pairs = new YAMLSeq.YAMLSeq(schema);
    pairs.tag = 'tag:yaml.org,2002:pairs';
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
            if (typeof replacer === 'function')
                it = replacer.call(iterable, String(i++), it);
            let key, value;
            if (Array.isArray(it)) {
                if (it.length === 2) {
                    key = it[0];
                    value = it[1];
                }
                else
                    throw new TypeError(`Expected [key, value] tuple: ${it}`);
            }
            else if (it && it instanceof Object) {
                const keys = Object.keys(it);
                if (keys.length === 1) {
                    key = keys[0];
                    value = it[key];
                }
                else {
                    throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
                }
            }
            else {
                key = it;
            }
            pairs.items.push(Pair.createPair(key, value, ctx));
        }
    return pairs;
}
const pairs = {
    collection: 'seq',
    default: false,
    tag: 'tag:yaml.org,2002:pairs',
    resolve: resolvePairs,
    createNode: createPairs
};

exports.createPairs = createPairs;
exports.pairs = pairs;
exports.resolvePairs = resolvePairs;


/***/ }),
/* 79 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var map = __webpack_require__(61);
var _null = __webpack_require__(68);
var seq = __webpack_require__(64);
var string = __webpack_require__(66);
var binary = __webpack_require__(75);
var bool = __webpack_require__(80);
var float = __webpack_require__(81);
var int = __webpack_require__(82);
var merge = __webpack_require__(59);
var omap = __webpack_require__(77);
var pairs = __webpack_require__(78);
var set = __webpack_require__(83);
var timestamp = __webpack_require__(84);

const schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.trueTag,
    bool.falseTag,
    int.intBin,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float,
    binary.binary,
    merge.merge,
    omap.omap,
    pairs.pairs,
    set.set,
    timestamp.intTime,
    timestamp.floatTime,
    timestamp.timestamp
];

exports.schema = schema;


/***/ }),
/* 80 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(50);

function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
        return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
}
const trueTag = {
    identify: value => value === true,
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar.Scalar(true),
    stringify: boolStringify
};
const falseTag = {
    identify: value => value === false,
    default: true,
    tag: 'tag:yaml.org,2002:bool',
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar.Scalar(false),
    stringify: boolStringify
};

exports.falseTag = falseTag;
exports.trueTag = trueTag;


/***/ }),
/* 81 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(50);
var stringifyNumber = __webpack_require__(71);

const floatNaN = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === 'nan'
        ? NaN
        : str[0] === '-'
            ? Number.NEGATIVE_INFINITY
            : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
};
const floatExp = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'EXP',
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, '')),
    stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
};
const float = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, '')));
        const dot = str.indexOf('.');
        if (dot !== -1) {
            const f = str.substring(dot + 1).replace(/_/g, '');
            if (f[f.length - 1] === '0')
                node.minFractionDigits = f.length;
        }
        return node;
    },
    stringify: stringifyNumber.stringifyNumber
};

exports.float = float;
exports.floatExp = floatExp;
exports.floatNaN = floatNaN;


/***/ }),
/* 82 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyNumber = __webpack_require__(71);

const intIdentify = (value) => typeof value === 'bigint' || Number.isInteger(value);
function intResolve(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === '-' || sign === '+')
        offset += 1;
    str = str.substring(offset).replace(/_/g, '');
    if (intAsBigInt) {
        switch (radix) {
            case 2:
                str = `0b${str}`;
                break;
            case 8:
                str = `0o${str}`;
                break;
            case 16:
                str = `0x${str}`;
                break;
        }
        const n = BigInt(str);
        return sign === '-' ? BigInt(-1) * n : n;
    }
    const n = parseInt(str, radix);
    return sign === '-' ? -1 * n : n;
}
function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? '-' + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber.stringifyNumber(node);
}
const intBin = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'BIN',
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
    stringify: node => intStringify(node, 2, '0b')
};
const intOct = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'OCT',
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
    stringify: node => intStringify(node, 8, '0')
};
const int = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
};
const intHex = {
    identify: intIdentify,
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'HEX',
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: node => intStringify(node, 16, '0x')
};

exports.int = int;
exports.intBin = intBin;
exports.intHex = intHex;
exports.intOct = intOct;


/***/ }),
/* 83 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var Pair = __webpack_require__(51);
var YAMLMap = __webpack_require__(62);

class YAMLSet extends YAMLMap.YAMLMap {
    constructor(schema) {
        super(schema);
        this.tag = YAMLSet.tag;
    }
    add(key) {
        let pair;
        if (identity.isPair(key))
            pair = key;
        else if (key &&
            typeof key === 'object' &&
            'key' in key &&
            'value' in key &&
            key.value === null)
            pair = new Pair.Pair(key.key, null);
        else
            pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
            this.items.push(pair);
    }
    /**
     * If `keepPair` is `true`, returns the Pair matching `key`.
     * Otherwise, returns the value of that Pair's key.
     */
    get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair)
            ? identity.isScalar(pair.key)
                ? pair.key.value
                : pair.key
            : pair;
    }
    set(key, value) {
        if (typeof value !== 'boolean')
            throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
            this.items.splice(this.items.indexOf(prev), 1);
        }
        else if (!prev && value) {
            this.items.push(new Pair.Pair(key));
        }
    }
    toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
        if (!ctx)
            return JSON.stringify(this);
        if (this.hasAllNullValues(true))
            return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
            throw new Error('Set items must all have null values');
    }
    static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
            for (let value of iterable) {
                if (typeof replacer === 'function')
                    value = replacer.call(iterable, value, value);
                set.items.push(Pair.createPair(value, null, ctx));
            }
        return set;
    }
}
YAMLSet.tag = 'tag:yaml.org,2002:set';
const set = {
    collection: 'map',
    identify: value => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: 'tag:yaml.org,2002:set',
    createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
    resolve(map, onError) {
        if (identity.isMap(map)) {
            if (map.hasAllNullValues(true))
                return Object.assign(new YAMLSet(), map);
            else
                onError('Set items must all have null values');
        }
        else
            onError('Expected a mapping for this tag');
        return map;
    }
};

exports.YAMLSet = YAMLSet;
exports.set = set;


/***/ }),
/* 84 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var stringifyNumber = __webpack_require__(71);

/** Internal types handle bigint as number, because TS can't figure it out. */
function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === '-' || sign === '+' ? str.substring(1) : str;
    const num = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts
        .replace(/_/g, '')
        .split(':')
        .reduce((res, p) => res * num(60) + num(p), num(0));
    return (sign === '-' ? num(-1) * res : res);
}
/**
 * hhhh:mm:ss.sss
 *
 * Internal types handle bigint as number, because TS can't figure it out.
 */
function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n) => n;
    if (typeof value === 'bigint')
        num = n => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
    let sign = '';
    if (value < 0) {
        sign = '-';
        value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60]; // seconds, including ms
    if (value < 60) {
        parts.unshift(0); // at least one : is required
    }
    else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60); // minutes
        if (value >= 60) {
            value = (value - parts[0]) / _60;
            parts.unshift(value); // hours
        }
    }
    return (sign +
        parts
            .map(n => String(n).padStart(2, '0'))
            .join(':')
            .replace(/000000\d*$/, '') // % 60 may introduce error
    );
}
const intTime = {
    identify: value => typeof value === 'bigint' || Number.isInteger(value),
    default: true,
    tag: 'tag:yaml.org,2002:int',
    format: 'TIME',
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
};
const floatTime = {
    identify: value => typeof value === 'number',
    default: true,
    tag: 'tag:yaml.org,2002:float',
    format: 'TIME',
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: str => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
};
const timestamp = {
    identify: value => value instanceof Date,
    default: true,
    tag: 'tag:yaml.org,2002:timestamp',
    // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
    // may be omitted altogether, resulting in a date format. In such a case, the time part is
    // assumed to be 00:00:00Z (start of day, UTC).
    test: RegExp('^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})' + // YYYY-Mm-Dd
        '(?:' + // time is optional
        '(?:t|T|[ \\t]+)' + // t | T | whitespace
        '([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)' + // Hh:Mm:Ss(.ss)?
        '(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?' + // Z | +5 | -03:30
        ')?$'),
    resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
            throw new Error('!!timestamp expects a date, starting with yyyy-mm-dd');
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + '00').substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== 'Z') {
            let d = parseSexagesimal(tz, false);
            if (Math.abs(d) < 30)
                d *= 60;
            date -= 60000 * d;
        }
        return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, '') ?? ''
};

exports.floatTime = floatTime;
exports.intTime = intTime;
exports.timestamp = timestamp;


/***/ }),
/* 85 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var stringify = __webpack_require__(53);
var stringifyComment = __webpack_require__(54);

function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
            lines.push(dir);
            hasDirectives = true;
        }
        else if (doc.directives.docStart)
            hasDirectives = true;
    }
    if (hasDirectives)
        lines.push('---');
    const ctx = stringify.createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
        if (lines.length !== 1)
            lines.unshift('');
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ''));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
        if (identity.isNode(doc.contents)) {
            if (doc.contents.spaceBefore && hasDirectives)
                lines.push('');
            if (doc.contents.commentBefore) {
                const cs = commentString(doc.contents.commentBefore);
                lines.push(stringifyComment.indentComment(cs, ''));
            }
            // top-level block scalars need to be indented if followed by a comment
            ctx.forceBlockIndent = !!doc.comment;
            contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? undefined : () => (chompKeep = true);
        let body = stringify.stringify(doc.contents, ctx, () => (contentComment = null), onChompKeep);
        if (contentComment)
            body += stringifyComment.lineComment(body, '', commentString(contentComment));
        if ((body[0] === '|' || body[0] === '>') &&
            lines[lines.length - 1] === '---') {
            // Top-level block scalars with a preceding doc marker ought to use the
            // same line for their header.
            lines[lines.length - 1] = `--- ${body}`;
        }
        else
            lines.push(body);
    }
    else {
        lines.push(stringify.stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
        if (doc.comment) {
            const cs = commentString(doc.comment);
            if (cs.includes('\n')) {
                lines.push('...');
                lines.push(stringifyComment.indentComment(cs, ''));
            }
            else {
                lines.push(`... ${cs}`);
            }
        }
        else {
            lines.push('...');
        }
    }
    else {
        let dc = doc.comment;
        if (dc && chompKeep)
            dc = dc.replace(/^\n+/, '');
        if (dc) {
            if ((!chompKeep || contentComment) && lines[lines.length - 1] !== '')
                lines.push('');
            lines.push(stringifyComment.indentComment(commentString(dc), ''));
        }
    }
    return lines.join('\n') + '\n';
}

exports.stringifyDocument = stringifyDocument;


/***/ }),
/* 86 */
/***/ ((__unused_webpack_module, exports) => {



class YAMLError extends Error {
    constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
    }
}
class YAMLParseError extends YAMLError {
    constructor(pos, code, message) {
        super('YAMLParseError', pos, code, message);
    }
}
class YAMLWarning extends YAMLError {
    constructor(pos, code, message) {
        super('YAMLWarning', pos, code, message);
    }
}
const prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
        return;
    error.linePos = error.pos.map(pos => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src
        .substring(lc.lineStarts[line - 1], lc.lineStarts[line])
        .replace(/[\n\r]+$/, '');
    // Trim to max 80 chars, keeping col position near the middle
    if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = '…' + lineStr.substring(trimStart);
        ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + '…';
    // Include previous line in context if pointing at line start
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        // Regexp won't match if start is trimmed
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
            prev = prev.substring(0, 79) + '…\n';
        lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
            count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = ' '.repeat(ci) + '^'.repeat(count);
        error.message += `:\n\n${lineStr}\n${pointer}\n`;
    }
};

exports.YAMLError = YAMLError;
exports.YAMLParseError = YAMLParseError;
exports.YAMLWarning = YAMLWarning;
exports.prettifyError = prettifyError;


/***/ }),
/* 87 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Document = __webpack_require__(42);
var composeNode = __webpack_require__(88);
var resolveEnd = __webpack_require__(97);
var resolveProps = __webpack_require__(91);

function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document.Document(undefined, opts);
    const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
    };
    const props = resolveProps.resolveProps(start, {
        indicator: 'doc-start',
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
    });
    if (props.found) {
        doc.directives.docStart = true;
        if (value &&
            (value.type === 'block-map' || value.type === 'block-seq') &&
            !props.hasNewline)
            onError(props.end, 'MISSING_CHAR', 'Block collection cannot start on same line with directives-end marker');
    }
    // @ts-expect-error If Contents is set, let's trust the user
    doc.contents = value
        ? composeNode.composeNode(ctx, value, props, onError)
        : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
        doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
}

exports.composeDoc = composeDoc;


/***/ }),
/* 88 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Alias = __webpack_require__(43);
var identity = __webpack_require__(40);
var composeCollection = __webpack_require__(89);
var composeScalar = __webpack_require__(98);
var resolveEnd = __webpack_require__(97);
var utilEmptyScalarPosition = __webpack_require__(101);

const CN = { composeNode, composeEmptyNode };
function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
        case 'alias':
            node = composeAlias(ctx, token, onError);
            if (anchor || tag)
                onError(token, 'ALIAS_PROPS', 'An alias node must not specify any properties');
            break;
        case 'scalar':
        case 'single-quoted-scalar':
        case 'double-quoted-scalar':
        case 'block-scalar':
            node = composeScalar.composeScalar(ctx, token, tag, onError);
            if (anchor)
                node.anchor = anchor.source.substring(1);
            break;
        case 'block-map':
        case 'block-seq':
        case 'flow-collection':
            try {
                node = composeCollection.composeCollection(CN, ctx, token, props, onError);
                if (anchor)
                    node.anchor = anchor.source.substring(1);
            }
            catch (error) {
                // Almost certainly here due to a stack overflow
                const message = error instanceof Error ? error.message : String(error);
                onError(token, 'RESOURCE_EXHAUSTION', message);
            }
            break;
        default: {
            const message = token.type === 'error'
                ? token.message
                : `Unsupported token (type: ${token.type})`;
            onError(token, 'UNEXPECTED_TOKEN', message);
            isSrcToken = false;
        }
    }
    node ?? (node = composeEmptyNode(ctx, token.offset, undefined, null, props, onError));
    if (anchor && node.anchor === '')
        onError(anchor, 'BAD_ALIAS', 'Anchor cannot be an empty string');
    if (atKey &&
        ctx.options.stringKeys &&
        (!identity.isScalar(node) ||
            typeof node.value !== 'string' ||
            (node.tag && node.tag !== 'tag:yaml.org,2002:str'))) {
        const msg = 'With stringKeys, all keys must be strings';
        onError(tag ?? token, 'NON_STRING_KEY', msg);
    }
    if (spaceBefore)
        node.spaceBefore = true;
    if (comment) {
        if (token.type === 'scalar' && token.source === '')
            node.comment = comment;
        else
            node.commentBefore = comment;
    }
    // @ts-expect-error Type checking misses meaning of isSrcToken
    if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
    return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
        type: 'scalar',
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ''
    };
    const node = composeScalar.composeScalar(ctx, token, tag, onError);
    if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === '')
            onError(anchor, 'BAD_ALIAS', 'Anchor cannot be an empty string');
    }
    if (spaceBefore)
        node.spaceBefore = true;
    if (comment) {
        node.comment = comment;
        node.range[2] = end;
    }
    return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias.Alias(source.substring(1));
    if (alias.source === '')
        onError(offset, 'BAD_ALIAS', 'Alias cannot be an empty string');
    if (alias.source.endsWith(':'))
        onError(offset + source.length - 1, 'BAD_ALIAS', 'Alias ending in : is ambiguous', true);
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
        alias.comment = re.comment;
    return alias;
}

exports.composeEmptyNode = composeEmptyNode;
exports.composeNode = composeNode;


/***/ }),
/* 89 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var Scalar = __webpack_require__(50);
var YAMLMap = __webpack_require__(62);
var YAMLSeq = __webpack_require__(65);
var resolveBlockMap = __webpack_require__(90);
var resolveBlockSeq = __webpack_require__(95);
var resolveFlowCollection = __webpack_require__(96);

function resolveCollection(CN, ctx, token, onError, tagName, tag) {
    const coll = token.type === 'block-map'
        ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag)
        : token.type === 'block-seq'
            ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag)
            : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
    const Coll = coll.constructor;
    // If we got a tagName matching the class, or the tag name is '!',
    // then use the tagName from the node class used to create it.
    if (tagName === '!' || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
    }
    if (tagName)
        coll.tag = tagName;
    return coll;
}
function composeCollection(CN, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken
        ? null
        : ctx.directives.tagName(tagToken.source, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg));
    if (token.type === 'block-seq') {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken
            ? anchor.offset > tagToken.offset
                ? anchor
                : tagToken
            : (anchor ?? tagToken);
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
            const message = 'Missing newline after block sequence props';
            onError(lastProp, 'MISSING_CHAR', message);
        }
    }
    const expType = token.type === 'block-map'
        ? 'map'
        : token.type === 'block-seq'
            ? 'seq'
            : token.start.source === '{'
                ? 'map'
                : 'seq';
    // shortcut: check if it's a generic YAMLMap or YAMLSeq
    // before jumping into the custom tag logic.
    if (!tagToken ||
        !tagName ||
        tagName === '!' ||
        (tagName === YAMLMap.YAMLMap.tagName && expType === 'map') ||
        (tagName === YAMLSeq.YAMLSeq.tagName && expType === 'seq')) {
        return resolveCollection(CN, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find(t => t.tag === tagName && t.collection === expType);
    if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
            ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
            tag = kt;
        }
        else {
            if (kt) {
                onError(tagToken, 'BAD_COLLECTION_TYPE', `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? 'scalar'}`, true);
            }
            else {
                onError(tagToken, 'TAG_RESOLVE_FAILED', `Unresolved tag: ${tagName}`, true);
            }
            return resolveCollection(CN, ctx, token, onError, tagName);
        }
    }
    const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg), ctx.options) ?? coll;
    const node = identity.isNode(res)
        ? res
        : new Scalar.Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
        node.format = tag.format;
    return node;
}

exports.composeCollection = composeCollection;


/***/ }),
/* 90 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Pair = __webpack_require__(51);
var YAMLMap = __webpack_require__(62);
var resolveProps = __webpack_require__(91);
var utilContainsNewline = __webpack_require__(92);
var utilFlowIndentCheck = __webpack_require__(93);
var utilMapIncludes = __webpack_require__(94);

const startColMsg = 'All mapping items must start at the same column';
function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
    const map = new NodeClass(ctx.schema);
    if (ctx.atRoot)
        ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        // key properties
        const keyProps = resolveProps.resolveProps(start, {
            indicator: 'explicit-key-ind',
            next: key ?? sep?.[0],
            offset,
            onError,
            parentIndent: bm.indent,
            startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
            if (key) {
                if (key.type === 'block-seq')
                    onError(offset, 'BLOCK_AS_IMPLICIT_KEY', 'A block sequence may not be used as an implicit map key');
                else if ('indent' in key && key.indent !== bm.indent)
                    onError(offset, 'BAD_INDENT', startColMsg);
            }
            if (!keyProps.anchor && !keyProps.tag && !sep) {
                commentEnd = keyProps.end;
                if (keyProps.comment) {
                    if (map.comment)
                        map.comment += '\n' + keyProps.comment;
                    else
                        map.comment = keyProps.comment;
                }
                continue;
            }
            if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
                onError(key ?? start[start.length - 1], 'MULTILINE_IMPLICIT_KEY', 'Implicit keys need to be on a single line');
            }
        }
        else if (keyProps.found?.indent !== bm.indent) {
            onError(offset, 'BAD_INDENT', startColMsg);
        }
        // key value
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key
            ? composeNode(ctx, key, keyProps, onError)
            : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
            onError(keyStart, 'DUPLICATE_KEY', 'Map keys must be unique');
        // value properties
        const valueProps = resolveProps.resolveProps(sep ?? [], {
            indicator: 'map-value-ind',
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: bm.indent,
            startOnNewline: !key || key.type === 'block-scalar'
        });
        offset = valueProps.end;
        if (valueProps.found) {
            if (implicitKey) {
                if (value?.type === 'block-map' && !valueProps.hasNewline)
                    onError(offset, 'BLOCK_AS_IMPLICIT_KEY', 'Nested mappings are not allowed in compact mappings');
                if (ctx.options.strict &&
                    keyProps.start < valueProps.found.offset - 1024)
                    onError(keyNode.range, 'KEY_OVER_1024_CHARS', 'The : indicator must be at most 1024 chars after the start of an implicit block mapping key');
            }
            // value value
            const valueNode = value
                ? composeNode(ctx, value, valueProps, onError)
                : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
            if (ctx.schema.compat)
                utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
            offset = valueNode.range[2];
            const pair = new Pair.Pair(keyNode, valueNode);
            if (ctx.options.keepSourceTokens)
                pair.srcToken = collItem;
            map.items.push(pair);
        }
        else {
            // key with no value
            if (implicitKey)
                onError(keyNode.range, 'MISSING_CHAR', 'Implicit map keys need to be followed by map values');
            if (valueProps.comment) {
                if (keyNode.comment)
                    keyNode.comment += '\n' + valueProps.comment;
                else
                    keyNode.comment = valueProps.comment;
            }
            const pair = new Pair.Pair(keyNode);
            if (ctx.options.keepSourceTokens)
                pair.srcToken = collItem;
            map.items.push(pair);
        }
    }
    if (commentEnd && commentEnd < offset)
        onError(commentEnd, 'IMPOSSIBLE', 'Map comment with trailing content');
    map.range = [bm.offset, offset, commentEnd ?? offset];
    return map;
}

exports.resolveBlockMap = resolveBlockMap;


/***/ }),
/* 91 */
/***/ ((__unused_webpack_module, exports) => {



function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = '';
    let commentSep = '';
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
        if (reqSpace) {
            if (token.type !== 'space' &&
                token.type !== 'newline' &&
                token.type !== 'comma')
                onError(token.offset, 'MISSING_CHAR', 'Tags and anchors must be separated from the next token by white space');
            reqSpace = false;
        }
        if (tab) {
            if (atNewline && token.type !== 'comment' && token.type !== 'newline') {
                onError(tab, 'TAB_AS_INDENT', 'Tabs are not allowed as indentation');
            }
            tab = null;
        }
        switch (token.type) {
            case 'space':
                // At the doc level, tabs at line start may be parsed
                // as leading white space rather than indentation.
                // In a flow collection, only the parser handles indent.
                if (!flow &&
                    (indicator !== 'doc-start' || next?.type !== 'flow-collection') &&
                    token.source.includes('\t')) {
                    tab = token;
                }
                hasSpace = true;
                break;
            case 'comment': {
                if (!hasSpace)
                    onError(token, 'MISSING_CHAR', 'Comments must be separated from other tokens by white space characters');
                const cb = token.source.substring(1) || ' ';
                if (!comment)
                    comment = cb;
                else
                    comment += commentSep + cb;
                commentSep = '';
                atNewline = false;
                break;
            }
            case 'newline':
                if (atNewline) {
                    if (comment)
                        comment += token.source;
                    else if (!found || indicator !== 'seq-item-ind')
                        spaceBefore = true;
                }
                else
                    commentSep += token.source;
                atNewline = true;
                hasNewline = true;
                if (anchor || tag)
                    newlineAfterProp = token;
                hasSpace = true;
                break;
            case 'anchor':
                if (anchor)
                    onError(token, 'MULTIPLE_ANCHORS', 'A node can have at most one anchor');
                if (token.source.endsWith(':'))
                    onError(token.offset + token.source.length - 1, 'BAD_ALIAS', 'Anchor ending in : is ambiguous', true);
                anchor = token;
                start ?? (start = token.offset);
                atNewline = false;
                hasSpace = false;
                reqSpace = true;
                break;
            case 'tag': {
                if (tag)
                    onError(token, 'MULTIPLE_TAGS', 'A node can have at most one tag');
                tag = token;
                start ?? (start = token.offset);
                atNewline = false;
                hasSpace = false;
                reqSpace = true;
                break;
            }
            case indicator:
                // Could here handle preceding comments differently
                if (anchor || tag)
                    onError(token, 'BAD_PROP_ORDER', `Anchors and tags must be after the ${token.source} indicator`);
                if (found)
                    onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${token.source} in ${flow ?? 'collection'}`);
                found = token;
                atNewline =
                    indicator === 'seq-item-ind' || indicator === 'explicit-key-ind';
                hasSpace = false;
                break;
            case 'comma':
                if (flow) {
                    if (comma)
                        onError(token, 'UNEXPECTED_TOKEN', `Unexpected , in ${flow}`);
                    comma = token;
                    atNewline = false;
                    hasSpace = false;
                    break;
                }
            // else fallthrough
            default:
                onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${token.type} token`);
                atNewline = false;
                hasSpace = false;
        }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace &&
        next &&
        next.type !== 'space' &&
        next.type !== 'newline' &&
        next.type !== 'comma' &&
        (next.type !== 'scalar' || next.source !== '')) {
        onError(next.offset, 'MISSING_CHAR', 'Tags and anchors must be separated from the next token by white space');
    }
    if (tab &&
        ((atNewline && tab.indent <= parentIndent) ||
            next?.type === 'block-map' ||
            next?.type === 'block-seq'))
        onError(tab, 'TAB_AS_INDENT', 'Tabs are not allowed as indentation');
    return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
    };
}

exports.resolveProps = resolveProps;


/***/ }),
/* 92 */
/***/ ((__unused_webpack_module, exports) => {



function containsNewline(key) {
    if (!key)
        return null;
    switch (key.type) {
        case 'alias':
        case 'scalar':
        case 'double-quoted-scalar':
        case 'single-quoted-scalar':
            if (key.source.includes('\n'))
                return true;
            if (key.end)
                for (const st of key.end)
                    if (st.type === 'newline')
                        return true;
            return false;
        case 'flow-collection':
            for (const it of key.items) {
                for (const st of it.start)
                    if (st.type === 'newline')
                        return true;
                if (it.sep)
                    for (const st of it.sep)
                        if (st.type === 'newline')
                            return true;
                if (containsNewline(it.key) || containsNewline(it.value))
                    return true;
            }
            return false;
        default:
            return true;
    }
}

exports.containsNewline = containsNewline;


/***/ }),
/* 93 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var utilContainsNewline = __webpack_require__(92);

function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === 'flow-collection') {
        const end = fc.end[0];
        if (end.indent === indent &&
            (end.source === ']' || end.source === '}') &&
            utilContainsNewline.containsNewline(fc)) {
            const msg = 'Flow end indicator should be more indented than parent';
            onError(end, 'BAD_INDENT', msg, true);
        }
    }
}

exports.flowIndentCheck = flowIndentCheck;


/***/ }),
/* 94 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);

function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
        return false;
    const isEqual = typeof uniqueKeys === 'function'
        ? uniqueKeys
        : (a, b) => a === b || (identity.isScalar(a) && identity.isScalar(b) && a.value === b.value);
    return items.some(pair => isEqual(pair.key, search));
}

exports.mapIncludes = mapIncludes;


/***/ }),
/* 95 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var YAMLSeq = __webpack_require__(65);
var resolveProps = __webpack_require__(91);
var utilFlowIndentCheck = __webpack_require__(93);

function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
    const seq = new NodeClass(ctx.schema);
    if (ctx.atRoot)
        ctx.atRoot = false;
    if (ctx.atKey)
        ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
            indicator: 'seq-item-ind',
            next: value,
            offset,
            onError,
            parentIndent: bs.indent,
            startOnNewline: true
        });
        if (!props.found) {
            if (props.anchor || props.tag || value) {
                if (value?.type === 'block-seq')
                    onError(props.end, 'BAD_INDENT', 'All sequence items must start at the same column');
                else
                    onError(offset, 'MISSING_CHAR', 'Sequence item without - indicator');
            }
            else {
                commentEnd = props.end;
                if (props.comment)
                    seq.comment = props.comment;
                continue;
            }
        }
        const node = value
            ? composeNode(ctx, value, props, onError)
            : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
    }
    seq.range = [bs.offset, offset, commentEnd ?? offset];
    return seq;
}

exports.resolveBlockSeq = resolveBlockSeq;


/***/ }),
/* 96 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var Pair = __webpack_require__(51);
var YAMLMap = __webpack_require__(62);
var YAMLSeq = __webpack_require__(65);
var resolveEnd = __webpack_require__(97);
var resolveProps = __webpack_require__(91);
var utilContainsNewline = __webpack_require__(92);
var utilMapIncludes = __webpack_require__(94);

const blockMsg = 'Block collections are not allowed within flow collections';
const isBlock = (token) => token && (token.type === 'block-map' || token.type === 'block-seq');
function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
    const isMap = fc.start.source === '{';
    const fcName = isMap ? 'flow map' : 'flow sequence';
    const NodeClass = (tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq));
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
        ctx.atRoot = false;
    if (ctx.atKey)
        ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
            flow: fcName,
            indicator: 'explicit-key-ind',
            next: key ?? sep?.[0],
            offset,
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
        });
        if (!props.found) {
            if (!props.anchor && !props.tag && !sep && !value) {
                if (i === 0 && props.comma)
                    onError(props.comma, 'UNEXPECTED_TOKEN', `Unexpected , in ${fcName}`);
                else if (i < fc.items.length - 1)
                    onError(props.start, 'UNEXPECTED_TOKEN', `Unexpected empty item in ${fcName}`);
                if (props.comment) {
                    if (coll.comment)
                        coll.comment += '\n' + props.comment;
                    else
                        coll.comment = props.comment;
                }
                offset = props.end;
                continue;
            }
            if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
                onError(key, // checked by containsNewline()
                'MULTILINE_IMPLICIT_KEY', 'Implicit keys of flow sequence pairs need to be on a single line');
        }
        if (i === 0) {
            if (props.comma)
                onError(props.comma, 'UNEXPECTED_TOKEN', `Unexpected , in ${fcName}`);
        }
        else {
            if (!props.comma)
                onError(props.start, 'MISSING_CHAR', `Missing , between ${fcName} items`);
            if (props.comment) {
                let prevItemComment = '';
                loop: for (const st of start) {
                    switch (st.type) {
                        case 'comma':
                        case 'space':
                            break;
                        case 'comment':
                            prevItemComment = st.source.substring(1);
                            break loop;
                        default:
                            break loop;
                    }
                }
                if (prevItemComment) {
                    let prev = coll.items[coll.items.length - 1];
                    if (identity.isPair(prev))
                        prev = prev.value ?? prev.key;
                    if (prev.comment)
                        prev.comment += '\n' + prevItemComment;
                    else
                        prev.comment = prevItemComment;
                    props.comment = props.comment.substring(prevItemComment.length + 1);
                }
            }
        }
        if (!isMap && !sep && !props.found) {
            // item is a value in a seq
            // → key & sep are empty, start does not include ? or :
            const valueNode = value
                ? composeNode(ctx, value, props, onError)
                : composeEmptyNode(ctx, props.end, sep, null, props, onError);
            coll.items.push(valueNode);
            offset = valueNode.range[2];
            if (isBlock(value))
                onError(valueNode.range, 'BLOCK_IN_FLOW', blockMsg);
        }
        else {
            // item is a key+value pair
            // key value
            ctx.atKey = true;
            const keyStart = props.end;
            const keyNode = key
                ? composeNode(ctx, key, props, onError)
                : composeEmptyNode(ctx, keyStart, start, null, props, onError);
            if (isBlock(key))
                onError(keyNode.range, 'BLOCK_IN_FLOW', blockMsg);
            ctx.atKey = false;
            // value properties
            const valueProps = resolveProps.resolveProps(sep ?? [], {
                flow: fcName,
                indicator: 'map-value-ind',
                next: value,
                offset: keyNode.range[2],
                onError,
                parentIndent: fc.indent,
                startOnNewline: false
            });
            if (valueProps.found) {
                if (!isMap && !props.found && ctx.options.strict) {
                    if (sep)
                        for (const st of sep) {
                            if (st === valueProps.found)
                                break;
                            if (st.type === 'newline') {
                                onError(st, 'MULTILINE_IMPLICIT_KEY', 'Implicit keys of flow sequence pairs need to be on a single line');
                                break;
                            }
                        }
                    if (props.start < valueProps.found.offset - 1024)
                        onError(valueProps.found, 'KEY_OVER_1024_CHARS', 'The : indicator must be at most 1024 chars after the start of an implicit flow sequence key');
                }
            }
            else if (value) {
                if ('source' in value && value.source?.[0] === ':')
                    onError(value, 'MISSING_CHAR', `Missing space after : in ${fcName}`);
                else
                    onError(valueProps.start, 'MISSING_CHAR', `Missing , or : between ${fcName} items`);
            }
            // value value
            const valueNode = value
                ? composeNode(ctx, value, valueProps, onError)
                : valueProps.found
                    ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError)
                    : null;
            if (valueNode) {
                if (isBlock(value))
                    onError(valueNode.range, 'BLOCK_IN_FLOW', blockMsg);
            }
            else if (valueProps.comment) {
                if (keyNode.comment)
                    keyNode.comment += '\n' + valueProps.comment;
                else
                    keyNode.comment = valueProps.comment;
            }
            const pair = new Pair.Pair(keyNode, valueNode);
            if (ctx.options.keepSourceTokens)
                pair.srcToken = collItem;
            if (isMap) {
                const map = coll;
                if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
                    onError(keyStart, 'DUPLICATE_KEY', 'Map keys must be unique');
                map.items.push(pair);
            }
            else {
                const map = new YAMLMap.YAMLMap(ctx.schema);
                map.flow = true;
                map.items.push(pair);
                const endRange = (valueNode ?? keyNode).range;
                map.range = [keyNode.range[0], endRange[1], endRange[2]];
                coll.items.push(map);
            }
            offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
    }
    const expectedEnd = isMap ? '}' : ']';
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
    else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot
            ? `${name} must end with a ${expectedEnd}`
            : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? 'MISSING_CHAR' : 'BAD_INDENT', msg);
        if (ce && ce.source.length !== 1)
            ee.unshift(ce);
    }
    if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
            if (coll.comment)
                coll.comment += '\n' + end.comment;
            else
                coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
    }
    else {
        coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
}

exports.resolveFlowCollection = resolveFlowCollection;


/***/ }),
/* 97 */
/***/ ((__unused_webpack_module, exports) => {



function resolveEnd(end, offset, reqSpace, onError) {
    let comment = '';
    if (end) {
        let hasSpace = false;
        let sep = '';
        for (const token of end) {
            const { source, type } = token;
            switch (type) {
                case 'space':
                    hasSpace = true;
                    break;
                case 'comment': {
                    if (reqSpace && !hasSpace)
                        onError(token, 'MISSING_CHAR', 'Comments must be separated from other tokens by white space characters');
                    const cb = source.substring(1) || ' ';
                    if (!comment)
                        comment = cb;
                    else
                        comment += sep + cb;
                    sep = '';
                    break;
                }
                case 'newline':
                    if (comment)
                        sep += source;
                    hasSpace = true;
                    break;
                default:
                    onError(token, 'UNEXPECTED_TOKEN', `Unexpected ${type} at node end`);
            }
            offset += source.length;
        }
    }
    return { comment, offset };
}

exports.resolveEnd = resolveEnd;


/***/ }),
/* 98 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var identity = __webpack_require__(40);
var Scalar = __webpack_require__(50);
var resolveBlockScalar = __webpack_require__(99);
var resolveFlowScalar = __webpack_require__(100);

function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === 'block-scalar'
        ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError)
        : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken
        ? ctx.directives.tagName(tagToken.source, msg => onError(tagToken, 'TAG_RESOLVE_FAILED', msg))
        : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
    }
    else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === 'scalar')
        tag = findScalarTagByTest(ctx, value, token, onError);
    else
        tag = ctx.schema[identity.SCALAR];
    let scalar;
    try {
        const res = tag.resolve(value, msg => onError(tagToken ?? token, 'TAG_RESOLVE_FAILED', msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, 'TAG_RESOLVE_FAILED', msg);
        scalar = new Scalar.Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
        scalar.type = type;
    if (tagName)
        scalar.tag = tagName;
    if (tag.format)
        scalar.format = tag.format;
    if (comment)
        scalar.comment = comment;
    return scalar;
}
function findScalarTagByName(schema, value, tagName, tagToken, onError) {
    if (tagName === '!')
        return schema[identity.SCALAR]; // non-specific tag
    const matchWithTest = [];
    for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
            if (tag.default && tag.test)
                matchWithTest.push(tag);
            else
                return tag;
        }
    }
    for (const tag of matchWithTest)
        if (tag.test?.test(value))
            return tag;
    const kt = schema.knownTags[tagName];
    if (kt && !kt.collection) {
        // Ensure that the known tag is available for stringifying,
        // but does not get used by default.
        schema.tags.push(Object.assign({}, kt, { default: false, test: undefined }));
        return kt;
    }
    onError(tagToken, 'TAG_RESOLVE_FAILED', `Unresolved tag: ${tagName}`, tagName !== 'tag:yaml.org,2002:str');
    return schema[identity.SCALAR];
}
function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
    const tag = schema.tags.find(tag => (tag.default === true || (atKey && tag.default === 'key')) &&
        tag.test?.test(value)) || schema[identity.SCALAR];
    if (schema.compat) {
        const compat = schema.compat.find(tag => tag.default && tag.test?.test(value)) ??
            schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
            const ts = directives.tagString(tag.tag);
            const cs = directives.tagString(compat.tag);
            const msg = `Value may be parsed as either ${ts} or ${cs}`;
            onError(token, 'TAG_RESOLVE_FAILED', msg, true);
        }
    }
    return tag;
}

exports.composeScalar = composeScalar;


/***/ }),
/* 99 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(50);

function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
        return { value: '', type: null, comment: '', range: [start, start, start] };
    const type = header.mode === '>' ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    // determine the end of content & start of chomping
    let chompStart = lines.length;
    for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === '' || content === '\r')
            chompStart = i;
        else
            break;
    }
    // shortcut for empty contents
    if (chompStart === 0) {
        const value = header.chomp === '+' && lines.length > 0
            ? '\n'.repeat(Math.max(1, lines.length - 1))
            : '';
        let end = start + header.length;
        if (scalar.source)
            end += scalar.source.length;
        return { value, type, comment: header.comment, range: [start, end, end] };
    }
    // find the indentation level to trim from start
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === '' || content === '\r') {
            if (header.indent === 0 && indent.length > trimIndent)
                trimIndent = indent.length;
        }
        else {
            if (indent.length < trimIndent) {
                const message = 'Block scalars with more-indented leading empty lines must use an explicit indentation indicator';
                onError(offset + indent.length, 'MISSING_CHAR', message);
            }
            if (header.indent === 0)
                trimIndent = indent.length;
            contentStart = i;
            if (trimIndent === 0 && !ctx.atRoot) {
                const message = 'Block scalar values in collections must be indented';
                onError(offset, 'BAD_INDENT', message);
            }
            break;
        }
        offset += indent.length + content.length + 1;
    }
    // include trailing more-indented empty lines in content
    for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
            chompStart = i + 1;
    }
    let value = '';
    let sep = '';
    let prevMoreIndented = false;
    // leading whitespace is kept intact
    for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + '\n';
    for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === '\r';
        if (crlf)
            content = content.slice(0, -1);
        /* istanbul ignore if already caught in lexer */
        if (content && indent.length < trimIndent) {
            const src = header.indent
                ? 'explicit indentation indicator'
                : 'first line';
            const message = `Block scalar lines must not be less indented than their ${src}`;
            onError(offset - content.length - (crlf ? 2 : 1), 'BAD_INDENT', message);
            indent = '';
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
            value += sep + indent.slice(trimIndent) + content;
            sep = '\n';
        }
        else if (indent.length > trimIndent || content[0] === '\t') {
            // more-indented content within a folded block
            if (sep === ' ')
                sep = '\n';
            else if (!prevMoreIndented && sep === '\n')
                sep = '\n\n';
            value += sep + indent.slice(trimIndent) + content;
            sep = '\n';
            prevMoreIndented = true;
        }
        else if (content === '') {
            // empty line
            if (sep === '\n')
                value += '\n';
            else
                sep = '\n';
        }
        else {
            value += sep + content;
            sep = ' ';
            prevMoreIndented = false;
        }
    }
    switch (header.chomp) {
        case '-':
            break;
        case '+':
            for (let i = chompStart; i < lines.length; ++i)
                value += '\n' + lines[i][0].slice(trimIndent);
            if (value[value.length - 1] !== '\n')
                value += '\n';
            break;
        default:
            value += '\n';
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
    /* istanbul ignore if should not happen */
    if (props[0].type !== 'block-scalar-header') {
        onError(props[0], 'IMPOSSIBLE', 'Block scalar header not found');
        return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = '';
    let error = -1;
    for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === '-' || ch === '+'))
            chomp = ch;
        else {
            const n = Number(ch);
            if (!indent && n)
                indent = n;
            else if (error === -1)
                error = offset + i;
        }
    }
    if (error !== -1)
        onError(error, 'UNEXPECTED_TOKEN', `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = '';
    let length = source.length;
    for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
            case 'space':
                hasSpace = true;
            // fallthrough
            case 'newline':
                length += token.source.length;
                break;
            case 'comment':
                if (strict && !hasSpace) {
                    const message = 'Comments must be separated from other tokens by white space characters';
                    onError(token, 'MISSING_CHAR', message);
                }
                length += token.source.length;
                comment = token.source.substring(1);
                break;
            case 'error':
                onError(token, 'UNEXPECTED_TOKEN', token.message);
                length += token.source.length;
                break;
            /* istanbul ignore next should not happen */
            default: {
                const message = `Unexpected token in block scalar header: ${token.type}`;
                onError(token, 'UNEXPECTED_TOKEN', message);
                const ts = token.source;
                if (ts && typeof ts === 'string')
                    length += ts.length;
            }
        }
    }
    return { mode, indent, chomp, comment, length };
}
/** @returns Array of lines split up as `[indent, content]` */
function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m = first.match(/^( *)/);
    const line0 = m?.[1]
        ? [m[1], first.slice(m[1].length)]
        : ['', first];
    const lines = [line0];
    for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
    return lines;
}

exports.resolveBlockScalar = resolveBlockScalar;


/***/ }),
/* 100 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var Scalar = __webpack_require__(50);
var resolveEnd = __webpack_require__(97);

function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
        case 'scalar':
            _type = Scalar.Scalar.PLAIN;
            value = plainValue(source, _onError);
            break;
        case 'single-quoted-scalar':
            _type = Scalar.Scalar.QUOTE_SINGLE;
            value = singleQuotedValue(source, _onError);
            break;
        case 'double-quoted-scalar':
            _type = Scalar.Scalar.QUOTE_DOUBLE;
            value = doubleQuotedValue(source, _onError);
            break;
        /* istanbul ignore next should not happen */
        default:
            onError(scalar, 'UNEXPECTED_TOKEN', `Expected a flow scalar value, but found: ${type}`);
            return {
                value: '',
                type: null,
                comment: '',
                range: [offset, offset + source.length, offset + source.length]
            };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
    return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
    };
}
function plainValue(source, onError) {
    let badChar = '';
    switch (source[0]) {
        /* istanbul ignore next should not happen */
        case '\t':
            badChar = 'a tab character';
            break;
        case ',':
            badChar = 'flow indicator character ,';
            break;
        case '%':
            badChar = 'directive indicator character %';
            break;
        case '|':
        case '>': {
            badChar = `block scalar indicator ${source[0]}`;
            break;
        }
        case '@':
        case '`': {
            badChar = `reserved character ${source[0]}`;
            break;
        }
    }
    if (badChar)
        onError(0, 'BAD_SCALAR_START', `Plain value cannot start with ${badChar}`);
    return unfoldLines(source);
}
function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, 'MISSING_CHAR', "Missing closing 'quote");
    return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function unfoldLines(source) {
    const line = /(.*?)\r?\n/sy;
    let match = line.exec(source);
    if (!match)
        return source;
    /**
     * The negative lookbehinds in these RegExps are to
     * prevent causing a polynomial search time in certain cases.
     *
     * The try-catch is for Safari < 16.4 and other old browsers:
     * https://caniuse.com/js-regexp-lookbehind
     */
    let trimEnd, trimBoth;
    try {
        trimEnd = new RegExp('(?<![ \t])[ \t]+$');
        trimBoth = new RegExp('^[ \t]+|(?<![ \t])[ \t]+$', 'g');
    }
    catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
    }
    let res = match[1].replace(trimEnd, '');
    let sep = ' ';
    let pos = line.lastIndex;
    while ((match = line.exec(source))) {
        const lm = match[1].replace(trimBoth, '');
        if (lm === '') {
            if (sep === '\n')
                res += sep;
            else
                sep = '\n';
        }
        else {
            res += sep + lm;
            sep = ' ';
        }
        pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? '');
}
function doubleQuotedValue(source, onError) {
    let res = '';
    for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === '\r' && source[i + 1] === '\n')
            continue;
        if (ch === '\n') {
            const { fold, offset } = foldNewline(source, i);
            res += fold;
            i = offset;
        }
        else if (ch === '\\') {
            let next = source[++i];
            const cc = escapeCodes[next];
            if (cc)
                res += cc;
            else if (next === '\n') {
                // skip escaped newlines, but still trim the following line
                next = source[i + 1];
                while (next === ' ' || next === '\t')
                    next = source[++i + 1];
            }
            else if (next === '\r' && source[i + 1] === '\n') {
                // skip escaped CRLF newlines, but still trim the following line
                next = source[++i + 1];
                while (next === ' ' || next === '\t')
                    next = source[++i + 1];
            }
            else if (next === 'x' || next === 'u' || next === 'U') {
                const length = next === 'x' ? 2 : next === 'u' ? 4 : 8;
                res += parseCharCode(source, i + 1, length, onError);
                i += length;
            }
            else {
                const raw = source.substr(i - 1, 2);
                onError(i - 1, 'BAD_DQ_ESCAPE', `Invalid escape sequence ${raw}`);
                res += raw;
            }
        }
        else if (ch === ' ' || ch === '\t') {
            // trim trailing whitespace
            const wsStart = i;
            let next = source[i + 1];
            while (next === ' ' || next === '\t')
                next = source[++i + 1];
            if (next !== '\n' && !(next === '\r' && source[i + 2] === '\n'))
                res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        }
        else {
            res += ch;
        }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, 'MISSING_CHAR', 'Missing closing "quote');
    return res;
}
/**
 * Fold a single newline into a space, multiple newlines to N - 1 newlines.
 * Presumes `source[offset] === '\n'`
 */
function foldNewline(source, offset) {
    let fold = '';
    let ch = source[offset + 1];
    while (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        if (ch === '\r' && source[offset + 2] !== '\n')
            break;
        if (ch === '\n')
            fold += '\n';
        offset += 1;
        ch = source[offset + 1];
    }
    if (!fold)
        fold = ' ';
    return { fold, offset };
}
const escapeCodes = {
    '0': '\0', // null character
    a: '\x07', // bell character
    b: '\b', // backspace
    e: '\x1b', // escape character
    f: '\f', // form feed
    n: '\n', // line feed
    r: '\r', // carriage return
    t: '\t', // horizontal tab
    v: '\v', // vertical tab
    N: '\u0085', // Unicode next line
    _: '\u00a0', // Unicode non-breaking space
    L: '\u2028', // Unicode line separator
    P: '\u2029', // Unicode paragraph separator
    ' ': ' ',
    '"': '"',
    '/': '/',
    '\\': '\\',
    '\t': '\t'
};
function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    try {
        return String.fromCodePoint(code);
    }
    catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, 'BAD_DQ_ESCAPE', `Invalid escape sequence ${raw}`);
        return raw;
    }
}

exports.resolveFlowScalar = resolveFlowScalar;


/***/ }),
/* 101 */
/***/ ((__unused_webpack_module, exports) => {



function emptyScalarPosition(offset, before, pos) {
    if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
            let st = before[i];
            switch (st.type) {
                case 'space':
                case 'comment':
                case 'newline':
                    offset -= st.source.length;
                    continue;
            }
            // Technically, an empty scalar is immediately after the last non-empty
            // node, but it's more useful to place it after any whitespace.
            st = before[++i];
            while (st?.type === 'space') {
                offset += st.source.length;
                st = before[++i];
            }
            break;
        }
    }
    return offset;
}

exports.emptyScalarPosition = emptyScalarPosition;


/***/ }),
/* 102 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var cstScalar = __webpack_require__(103);
var cstStringify = __webpack_require__(104);
var cstVisit = __webpack_require__(105);

/** The byte order mark */
const BOM = '\u{FEFF}';
/** Start of doc-mode */
const DOCUMENT = '\x02'; // C0: Start of Text
/** Unexpected end of flow-mode */
const FLOW_END = '\x18'; // C0: Cancel
/** Next token is a scalar value */
const SCALAR = '\x1f'; // C0: Unit Separator
/** @returns `true` if `token` is a flow or block collection */
const isCollection = (token) => !!token && 'items' in token;
/** @returns `true` if `token` is a flow or block scalar; not an alias */
const isScalar = (token) => !!token &&
    (token.type === 'scalar' ||
        token.type === 'single-quoted-scalar' ||
        token.type === 'double-quoted-scalar' ||
        token.type === 'block-scalar');
/* istanbul ignore next */
/** Get a printable representation of a lexer token */
function prettyToken(token) {
    switch (token) {
        case BOM:
            return '<BOM>';
        case DOCUMENT:
            return '<DOC>';
        case FLOW_END:
            return '<FLOW_END>';
        case SCALAR:
            return '<SCALAR>';
        default:
            return JSON.stringify(token);
    }
}
/** Identify the type of a lexer token. May return `null` for unknown tokens. */
function tokenType(source) {
    switch (source) {
        case BOM:
            return 'byte-order-mark';
        case DOCUMENT:
            return 'doc-mode';
        case FLOW_END:
            return 'flow-error-end';
        case SCALAR:
            return 'scalar';
        case '---':
            return 'doc-start';
        case '...':
            return 'doc-end';
        case '':
        case '\n':
        case '\r\n':
            return 'newline';
        case '-':
            return 'seq-item-ind';
        case '?':
            return 'explicit-key-ind';
        case ':':
            return 'map-value-ind';
        case '{':
            return 'flow-map-start';
        case '}':
            return 'flow-map-end';
        case '[':
            return 'flow-seq-start';
        case ']':
            return 'flow-seq-end';
        case ',':
            return 'comma';
    }
    switch (source[0]) {
        case ' ':
        case '\t':
            return 'space';
        case '#':
            return 'comment';
        case '%':
            return 'directive-line';
        case '*':
            return 'alias';
        case '&':
            return 'anchor';
        case '!':
            return 'tag';
        case "'":
            return 'single-quoted-scalar';
        case '"':
            return 'double-quoted-scalar';
        case '|':
        case '>':
            return 'block-scalar-header';
    }
    return null;
}

exports.createScalarToken = cstScalar.createScalarToken;
exports.resolveAsScalar = cstScalar.resolveAsScalar;
exports.setScalarValue = cstScalar.setScalarValue;
exports.stringify = cstStringify.stringify;
exports.visit = cstVisit.visit;
exports.BOM = BOM;
exports.DOCUMENT = DOCUMENT;
exports.FLOW_END = FLOW_END;
exports.SCALAR = SCALAR;
exports.isCollection = isCollection;
exports.isScalar = isScalar;
exports.prettyToken = prettyToken;
exports.tokenType = tokenType;


/***/ }),
/* 103 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var resolveBlockScalar = __webpack_require__(99);
var resolveFlowScalar = __webpack_require__(100);
var errors = __webpack_require__(86);
var stringifyString = __webpack_require__(55);

function resolveAsScalar(token, strict = true, onError) {
    if (token) {
        const _onError = (pos, code, message) => {
            const offset = typeof pos === 'number' ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
            if (onError)
                onError(offset, code, message);
            else
                throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar':
                return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
            case 'block-scalar':
                return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
    }
    return null;
}
/**
 * Create a new scalar token with `value`
 *
 * Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
 * as this function does not support any schema operations and won't check for such conflicts.
 *
 * @param value The string representation of the value, which will have its content properly indented.
 * @param context.end Comments and whitespace after the end of the value, or after the block scalar header. If undefined, a newline will be added.
 * @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
 * @param context.indent The indent level of the token.
 * @param context.inFlow Is this scalar within a flow collection? This may affect the resolved type of the token's value.
 * @param context.offset The offset position of the token.
 * @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
 */
function createScalarToken(value, context) {
    const { implicitKey = false, indent, inFlow = false, offset = -1, type = 'PLAIN' } = context;
    const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? ' '.repeat(indent) : '',
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
    });
    const end = context.end ?? [
        { type: 'newline', offset: -1, indent, source: '\n' }
    ];
    switch (source[0]) {
        case '|':
        case '>': {
            const he = source.indexOf('\n');
            const head = source.substring(0, he);
            const body = source.substring(he + 1) + '\n';
            const props = [
                { type: 'block-scalar-header', offset, indent, source: head }
            ];
            if (!addEndtoBlockProps(props, end))
                props.push({ type: 'newline', offset: -1, indent, source: '\n' });
            return { type: 'block-scalar', offset, indent, props, source: body };
        }
        case '"':
            return { type: 'double-quoted-scalar', offset, indent, source, end };
        case "'":
            return { type: 'single-quoted-scalar', offset, indent, source, end };
        default:
            return { type: 'scalar', offset, indent, source, end };
    }
}
/**
 * Set the value of `token` to the given string `value`, overwriting any previous contents and type that it may have.
 *
 * Best efforts are made to retain any comments previously associated with the `token`,
 * though all contents within a collection's `items` will be overwritten.
 *
 * Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
 * as this function does not support any schema operations and won't check for such conflicts.
 *
 * @param token Any token. If it does not include an `indent` value, the value will be stringified as if it were an implicit key.
 * @param value The string representation of the value, which will have its content properly indented.
 * @param context.afterKey In most cases, values after a key should have an additional level of indentation.
 * @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
 * @param context.inFlow Being within a flow collection may affect the resolved type of the token's value.
 * @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
 */
function setScalarValue(token, value, context = {}) {
    let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
    let indent = 'indent' in token ? token.indent : null;
    if (afterKey && typeof indent === 'number')
        indent += 2;
    if (!type)
        switch (token.type) {
            case 'single-quoted-scalar':
                type = 'QUOTE_SINGLE';
                break;
            case 'double-quoted-scalar':
                type = 'QUOTE_DOUBLE';
                break;
            case 'block-scalar': {
                const header = token.props[0];
                if (header.type !== 'block-scalar-header')
                    throw new Error('Invalid block scalar header');
                type = header.source[0] === '>' ? 'BLOCK_FOLDED' : 'BLOCK_LITERAL';
                break;
            }
            default:
                type = 'PLAIN';
        }
    const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? ' '.repeat(indent) : '',
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
    });
    switch (source[0]) {
        case '|':
        case '>':
            setBlockScalarValue(token, source);
            break;
        case '"':
            setFlowScalarValue(token, source, 'double-quoted-scalar');
            break;
        case "'":
            setFlowScalarValue(token, source, 'single-quoted-scalar');
            break;
        default:
            setFlowScalarValue(token, source, 'scalar');
    }
}
function setBlockScalarValue(token, source) {
    const he = source.indexOf('\n');
    const head = source.substring(0, he);
    const body = source.substring(he + 1) + '\n';
    if (token.type === 'block-scalar') {
        const header = token.props[0];
        if (header.type !== 'block-scalar-header')
            throw new Error('Invalid block scalar header');
        header.source = head;
        token.source = body;
    }
    else {
        const { offset } = token;
        const indent = 'indent' in token ? token.indent : -1;
        const props = [
            { type: 'block-scalar-header', offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, 'end' in token ? token.end : undefined))
            props.push({ type: 'newline', offset: -1, indent, source: '\n' });
        for (const key of Object.keys(token))
            if (key !== 'type' && key !== 'offset')
                delete token[key];
        Object.assign(token, { type: 'block-scalar', indent, props, source: body });
    }
}
/** @returns `true` if last token is a newline */
function addEndtoBlockProps(props, end) {
    if (end)
        for (const st of end)
            switch (st.type) {
                case 'space':
                case 'comment':
                    props.push(st);
                    break;
                case 'newline':
                    props.push(st);
                    return true;
            }
    return false;
}
function setFlowScalarValue(token, source, type) {
    switch (token.type) {
        case 'scalar':
        case 'double-quoted-scalar':
        case 'single-quoted-scalar':
            token.type = type;
            token.source = source;
            break;
        case 'block-scalar': {
            const end = token.props.slice(1);
            let oa = source.length;
            if (token.props[0].type === 'block-scalar-header')
                oa -= token.props[0].source.length;
            for (const tok of end)
                tok.offset += oa;
            delete token.props;
            Object.assign(token, { type, source, end });
            break;
        }
        case 'block-map':
        case 'block-seq': {
            const offset = token.offset + source.length;
            const nl = { type: 'newline', offset, indent: token.indent, source: '\n' };
            delete token.items;
            Object.assign(token, { type, source, end: [nl] });
            break;
        }
        default: {
            const indent = 'indent' in token ? token.indent : -1;
            const end = 'end' in token && Array.isArray(token.end)
                ? token.end.filter(st => st.type === 'space' ||
                    st.type === 'comment' ||
                    st.type === 'newline')
                : [];
            for (const key of Object.keys(token))
                if (key !== 'type' && key !== 'offset')
                    delete token[key];
            Object.assign(token, { type, indent, source, end });
        }
    }
}

exports.createScalarToken = createScalarToken;
exports.resolveAsScalar = resolveAsScalar;
exports.setScalarValue = setScalarValue;


/***/ }),
/* 104 */
/***/ ((__unused_webpack_module, exports) => {



/**
 * Stringify a CST document, token, or collection item
 *
 * Fair warning: This applies no validation whatsoever, and
 * simply concatenates the sources in their logical order.
 */
const stringify = (cst) => 'type' in cst ? stringifyToken(cst) : stringifyItem(cst);
function stringifyToken(token) {
    switch (token.type) {
        case 'block-scalar': {
            let res = '';
            for (const tok of token.props)
                res += stringifyToken(tok);
            return res + token.source;
        }
        case 'block-map':
        case 'block-seq': {
            let res = '';
            for (const item of token.items)
                res += stringifyItem(item);
            return res;
        }
        case 'flow-collection': {
            let res = token.start.source;
            for (const item of token.items)
                res += stringifyItem(item);
            for (const st of token.end)
                res += st.source;
            return res;
        }
        case 'document': {
            let res = stringifyItem(token);
            if (token.end)
                for (const st of token.end)
                    res += st.source;
            return res;
        }
        default: {
            let res = token.source;
            if ('end' in token && token.end)
                for (const st of token.end)
                    res += st.source;
            return res;
        }
    }
}
function stringifyItem({ start, key, sep, value }) {
    let res = '';
    for (const st of start)
        res += st.source;
    if (key)
        res += stringifyToken(key);
    if (sep)
        for (const st of sep)
            res += st.source;
    if (value)
        res += stringifyToken(value);
    return res;
}

exports.stringify = stringify;


/***/ }),
/* 105 */
/***/ ((__unused_webpack_module, exports) => {



const BREAK = Symbol('break visit');
const SKIP = Symbol('skip children');
const REMOVE = Symbol('remove item');
/**
 * Apply a visitor to a CST document or item.
 *
 * Walks through the tree (depth-first) starting from the root, calling a
 * `visitor` function with two arguments when entering each item:
 *   - `item`: The current item, which included the following members:
 *     - `start: SourceToken[]` – Source tokens before the key or value,
 *       possibly including its anchor or tag.
 *     - `key?: Token | null` – Set for pair values. May then be `null`, if
 *       the key before the `:` separator is empty.
 *     - `sep?: SourceToken[]` – Source tokens between the key and the value,
 *       which should include the `:` map value indicator if `value` is set.
 *     - `value?: Token` – The value of a sequence item, or of a map pair.
 *   - `path`: The steps from the root to the current node, as an array of
 *     `['key' | 'value', number]` tuples.
 *
 * The return value of the visitor may be used to control the traversal:
 *   - `undefined` (default): Do nothing and continue
 *   - `visit.SKIP`: Do not visit the children of this token, continue with
 *      next sibling
 *   - `visit.BREAK`: Terminate traversal completely
 *   - `visit.REMOVE`: Remove the current item, then continue with the next one
 *   - `number`: Set the index of the next step. This is useful especially if
 *     the index of the current token has changed.
 *   - `function`: Define the next visitor for this item. After the original
 *     visitor is called on item entry, next visitors are called after handling
 *     a non-empty `key` and when exiting the item.
 */
function visit(cst, visitor) {
    if ('type' in cst && cst.type === 'document')
        cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
}
// Without the `as symbol` casts, TS declares these in the `visit`
// namespace using `var`, but then complains about that because
// `unique symbol` must be `const`.
/** Terminate visit traversal completely */
visit.BREAK = BREAK;
/** Do not visit the children of the current item */
visit.SKIP = SKIP;
/** Remove the current item */
visit.REMOVE = REMOVE;
/** Find the item at `path` from `cst` as the root */
visit.itemAtPath = (cst, path) => {
    let item = cst;
    for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && 'items' in tok) {
            item = tok.items[index];
        }
        else
            return undefined;
    }
    return item;
};
/**
 * Get the immediate parent collection of the item at `path` from `cst` as the root.
 *
 * Throws an error if the collection is not found, which should never happen if the item itself exists.
 */
visit.parentCollection = (cst, path) => {
    const parent = visit.itemAtPath(cst, path.slice(0, -1));
    const field = path[path.length - 1][0];
    const coll = parent?.[field];
    if (coll && 'items' in coll)
        return coll;
    throw new Error('Parent collection not found');
};
function _visit(path, item, visitor) {
    let ctrl = visitor(item, path);
    if (typeof ctrl === 'symbol')
        return ctrl;
    for (const field of ['key', 'value']) {
        const token = item[field];
        if (token && 'items' in token) {
            for (let i = 0; i < token.items.length; ++i) {
                const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
                if (typeof ci === 'number')
                    i = ci - 1;
                else if (ci === BREAK)
                    return BREAK;
                else if (ci === REMOVE) {
                    token.items.splice(i, 1);
                    i -= 1;
                }
            }
            if (typeof ctrl === 'function' && field === 'key')
                ctrl = ctrl(item, path);
        }
    }
    return typeof ctrl === 'function' ? ctrl(item, path) : ctrl;
}

exports.visit = visit;


/***/ }),
/* 106 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var cst = __webpack_require__(102);

/*
START -> stream

stream
  directive -> line-end -> stream
  indent + line-end -> stream
  [else] -> line-start

line-end
  comment -> line-end
  newline -> .
  input-end -> END

line-start
  doc-start -> doc
  doc-end -> stream
  [else] -> indent -> block-start

block-start
  seq-item-start -> block-start
  explicit-key-start -> block-start
  map-value-start -> block-start
  [else] -> doc

doc
  line-end -> line-start
  spaces -> doc
  anchor -> doc
  tag -> doc
  flow-start -> flow -> doc
  flow-end -> error -> doc
  seq-item-start -> error -> doc
  explicit-key-start -> error -> doc
  map-value-start -> doc
  alias -> doc
  quote-start -> quoted-scalar -> doc
  block-scalar-header -> line-end -> block-scalar(min) -> line-start
  [else] -> plain-scalar(false, min) -> doc

flow
  line-end -> flow
  spaces -> flow
  anchor -> flow
  tag -> flow
  flow-start -> flow -> flow
  flow-end -> .
  seq-item-start -> error -> flow
  explicit-key-start -> flow
  map-value-start -> flow
  alias -> flow
  quote-start -> quoted-scalar -> flow
  comma -> flow
  [else] -> plain-scalar(true, 0) -> flow

quoted-scalar
  quote-end -> .
  [else] -> quoted-scalar

block-scalar(min)
  newline + peek(indent < min) -> .
  [else] -> block-scalar(min)

plain-scalar(is-flow, min)
  scalar-end(is-flow) -> .
  peek(newline + (indent < min)) -> .
  [else] -> plain-scalar(min)
*/
function isEmpty(ch) {
    switch (ch) {
        case undefined:
        case ' ':
        case '\n':
        case '\r':
        case '\t':
            return true;
        default:
            return false;
    }
}
const hexDigits = new Set('0123456789ABCDEFabcdef');
const tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
const flowIndicatorChars = new Set(',[]{}');
const invalidAnchorChars = new Set(' ,[]{}\n\r\t');
const isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
/**
 * Splits an input string into lexical tokens, i.e. smaller strings that are
 * easily identifiable by `tokens.tokenType()`.
 *
 * Lexing starts always in a "stream" context. Incomplete input may be buffered
 * until a complete token can be emitted.
 *
 * In addition to slices of the original input, the following control characters
 * may also be emitted:
 *
 * - `\x02` (Start of Text): A document starts with the next token
 * - `\x18` (Cancel): Unexpected end of flow-mode (indicates an error)
 * - `\x1f` (Unit Separator): Next token is a scalar value
 * - `\u{FEFF}` (Byte order mark): Emitted separately outside documents
 */
class Lexer {
    constructor() {
        /**
         * Flag indicating whether the end of the current buffer marks the end of
         * all input
         */
        this.atEnd = false;
        /**
         * Explicit indent set in block scalar header, as an offset from the current
         * minimum indent, so e.g. set to 1 from a header `|2+`. Set to -1 if not
         * explicitly set.
         */
        this.blockScalarIndent = -1;
        /**
         * Block scalars that include a + (keep) chomping indicator in their header
         * include trailing empty lines, which are otherwise excluded from the
         * scalar's contents.
         */
        this.blockScalarKeep = false;
        /** Current input */
        this.buffer = '';
        /**
         * Flag noting whether the map value indicator : can immediately follow this
         * node within a flow context.
         */
        this.flowKey = false;
        /** Count of surrounding flow collection levels. */
        this.flowLevel = 0;
        /**
         * Minimum level of indentation required for next lines to be parsed as a
         * part of the current scalar value.
         */
        this.indentNext = 0;
        /** Indentation level of the current line. */
        this.indentValue = 0;
        /** Position of the next \n character. */
        this.lineEndPos = null;
        /** Stores the state of the lexer if reaching the end of incpomplete input */
        this.next = null;
        /** A pointer to `buffer`; the current position of the lexer. */
        this.pos = 0;
    }
    /**
     * Generate YAML tokens from the `source` string. If `incomplete`,
     * a part of the last line may be left as a buffer for the next call.
     *
     * @returns A generator of lexical tokens
     */
    *lex(source, incomplete = false) {
        if (source) {
            if (typeof source !== 'string')
                throw TypeError('source is not a string');
            this.buffer = this.buffer ? this.buffer + source : source;
            this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? 'stream';
        while (next && (incomplete || this.hasChars(1)))
            next = yield* this.parseNext(next);
    }
    atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === ' ' || ch === '\t')
            ch = this.buffer[++i];
        if (!ch || ch === '#' || ch === '\n')
            return true;
        if (ch === '\r')
            return this.buffer[i + 1] === '\n';
        return false;
    }
    charAt(n) {
        return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
            let indent = 0;
            while (ch === ' ')
                ch = this.buffer[++indent + offset];
            if (ch === '\r') {
                const next = this.buffer[indent + offset + 1];
                if (next === '\n' || (!next && !this.atEnd))
                    return offset + indent + 1;
            }
            return ch === '\n' || indent >= this.indentNext || (!ch && !this.atEnd)
                ? offset + indent
                : -1;
        }
        if (ch === '-' || ch === '.') {
            const dt = this.buffer.substr(offset, 3);
            if ((dt === '---' || dt === '...') && isEmpty(this.buffer[offset + 3]))
                return -1;
        }
        return offset;
    }
    getLine() {
        let end = this.lineEndPos;
        if (typeof end !== 'number' || (end !== -1 && end < this.pos)) {
            end = this.buffer.indexOf('\n', this.pos);
            this.lineEndPos = end;
        }
        if (end === -1)
            return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === '\r')
            end -= 1;
        return this.buffer.substring(this.pos, end);
    }
    hasChars(n) {
        return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
    }
    peek(n) {
        return this.buffer.substr(this.pos, n);
    }
    *parseNext(next) {
        switch (next) {
            case 'stream':
                return yield* this.parseStream();
            case 'line-start':
                return yield* this.parseLineStart();
            case 'block-start':
                return yield* this.parseBlockStart();
            case 'doc':
                return yield* this.parseDocument();
            case 'flow':
                return yield* this.parseFlowCollection();
            case 'quoted-scalar':
                return yield* this.parseQuotedScalar();
            case 'block-scalar':
                return yield* this.parseBlockScalar();
            case 'plain-scalar':
                return yield* this.parsePlainScalar();
        }
    }
    *parseStream() {
        let line = this.getLine();
        if (line === null)
            return this.setNext('stream');
        if (line[0] === cst.BOM) {
            yield* this.pushCount(1);
            line = line.substring(1);
        }
        if (line[0] === '%') {
            let dirEnd = line.length;
            let cs = line.indexOf('#');
            while (cs !== -1) {
                const ch = line[cs - 1];
                if (ch === ' ' || ch === '\t') {
                    dirEnd = cs - 1;
                    break;
                }
                else {
                    cs = line.indexOf('#', cs + 1);
                }
            }
            while (true) {
                const ch = line[dirEnd - 1];
                if (ch === ' ' || ch === '\t')
                    dirEnd -= 1;
                else
                    break;
            }
            const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
            yield* this.pushCount(line.length - n); // possible comment
            this.pushNewline();
            return 'stream';
        }
        if (this.atLineEnd()) {
            const sp = yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - sp);
            yield* this.pushNewline();
            return 'stream';
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
    }
    *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
            return this.setNext('line-start');
        if (ch === '-' || ch === '.') {
            if (!this.atEnd && !this.hasChars(4))
                return this.setNext('line-start');
            const s = this.peek(3);
            if ((s === '---' || s === '...') && isEmpty(this.charAt(3))) {
                yield* this.pushCount(3);
                this.indentValue = 0;
                this.indentNext = 0;
                return s === '---' ? 'doc' : 'stream';
            }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
            this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
            return this.setNext('block-start');
        if ((ch0 === '-' || ch0 === '?' || ch0 === ':') && isEmpty(ch1)) {
            const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
            this.indentNext = this.indentValue + 1;
            this.indentValue += n;
            return 'block-start';
        }
        return 'doc';
    }
    *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
            return this.setNext('doc');
        let n = yield* this.pushIndicators();
        switch (line[n]) {
            case '#':
                yield* this.pushCount(line.length - n);
            // fallthrough
            case undefined:
                yield* this.pushNewline();
                return yield* this.parseLineStart();
            case '{':
            case '[':
                yield* this.pushCount(1);
                this.flowKey = false;
                this.flowLevel = 1;
                return 'flow';
            case '}':
            case ']':
                // this is an error
                yield* this.pushCount(1);
                return 'doc';
            case '*':
                yield* this.pushUntil(isNotAnchorChar);
                return 'doc';
            case '"':
            case "'":
                return yield* this.parseQuotedScalar();
            case '|':
            case '>':
                n += yield* this.parseBlockScalarHeader();
                n += yield* this.pushSpaces(true);
                yield* this.pushCount(line.length - n);
                yield* this.pushNewline();
                return yield* this.parseBlockScalar();
            default:
                return yield* this.parsePlainScalar();
        }
    }
    *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
            nl = yield* this.pushNewline();
            if (nl > 0) {
                sp = yield* this.pushSpaces(false);
                this.indentValue = indent = sp;
            }
            else {
                sp = 0;
            }
            sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
            return this.setNext('flow');
        if ((indent !== -1 && indent < this.indentNext && line[0] !== '#') ||
            (indent === 0 &&
                (line.startsWith('---') || line.startsWith('...')) &&
                isEmpty(line[3]))) {
            // Allowing for the terminal ] or } at the same (rather than greater)
            // indent level as the initial [ or { is technically invalid, but
            // failing here would be surprising to users.
            const atFlowEndMarker = indent === this.indentNext - 1 &&
                this.flowLevel === 1 &&
                (line[0] === ']' || line[0] === '}');
            if (!atFlowEndMarker) {
                // this is an error
                this.flowLevel = 0;
                yield cst.FLOW_END;
                return yield* this.parseLineStart();
            }
        }
        let n = 0;
        while (line[n] === ',') {
            n += yield* this.pushCount(1);
            n += yield* this.pushSpaces(true);
            this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
            case undefined:
                return 'flow';
            case '#':
                yield* this.pushCount(line.length - n);
                return 'flow';
            case '{':
            case '[':
                yield* this.pushCount(1);
                this.flowKey = false;
                this.flowLevel += 1;
                return 'flow';
            case '}':
            case ']':
                yield* this.pushCount(1);
                this.flowKey = true;
                this.flowLevel -= 1;
                return this.flowLevel ? 'flow' : 'doc';
            case '*':
                yield* this.pushUntil(isNotAnchorChar);
                return 'flow';
            case '"':
            case "'":
                this.flowKey = true;
                return yield* this.parseQuotedScalar();
            case ':': {
                const next = this.charAt(1);
                if (this.flowKey || isEmpty(next) || next === ',') {
                    this.flowKey = false;
                    yield* this.pushCount(1);
                    yield* this.pushSpaces(true);
                    return 'flow';
                }
            }
            // fallthrough
            default:
                this.flowKey = false;
                return yield* this.parsePlainScalar();
        }
    }
    *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
            while (end !== -1 && this.buffer[end + 1] === "'")
                end = this.buffer.indexOf("'", end + 2);
        }
        else {
            // double-quote
            while (end !== -1) {
                let n = 0;
                while (this.buffer[end - 1 - n] === '\\')
                    n += 1;
                if (n % 2 === 0)
                    break;
                end = this.buffer.indexOf('"', end + 1);
            }
        }
        // Only looking for newlines within the quotes
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf('\n', this.pos);
        if (nl !== -1) {
            while (nl !== -1) {
                const cs = this.continueScalar(nl + 1);
                if (cs === -1)
                    break;
                nl = qb.indexOf('\n', cs);
            }
            if (nl !== -1) {
                // this is an error caused by an unexpected unindent
                end = nl - (qb[nl - 1] === '\r' ? 2 : 1);
            }
        }
        if (end === -1) {
            if (!this.atEnd)
                return this.setNext('quoted-scalar');
            end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? 'flow' : 'doc';
    }
    *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
            const ch = this.buffer[++i];
            if (ch === '+')
                this.blockScalarKeep = true;
            else if (ch > '0' && ch <= '9')
                this.blockScalarIndent = Number(ch) - 1;
            else if (ch !== '-')
                break;
        }
        return yield* this.pushUntil(ch => isEmpty(ch) || ch === '#');
    }
    *parseBlockScalar() {
        let nl = this.pos - 1; // may be -1 if this.pos === 0
        let indent = 0;
        let ch;
        loop: for (let i = this.pos; (ch = this.buffer[i]); ++i) {
            switch (ch) {
                case ' ':
                    indent += 1;
                    break;
                case '\n':
                    nl = i;
                    indent = 0;
                    break;
                case '\r': {
                    const next = this.buffer[i + 1];
                    if (!next && !this.atEnd)
                        return this.setNext('block-scalar');
                    if (next === '\n')
                        break;
                } // fallthrough
                default:
                    break loop;
            }
        }
        if (!ch && !this.atEnd)
            return this.setNext('block-scalar');
        if (indent >= this.indentNext) {
            if (this.blockScalarIndent === -1)
                this.indentNext = indent;
            else {
                this.indentNext =
                    this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
            }
            do {
                const cs = this.continueScalar(nl + 1);
                if (cs === -1)
                    break;
                nl = this.buffer.indexOf('\n', cs);
            } while (nl !== -1);
            if (nl === -1) {
                if (!this.atEnd)
                    return this.setNext('block-scalar');
                nl = this.buffer.length;
            }
        }
        // Trailing insufficiently indented tabs are invalid.
        // To catch that during parsing, we include them in the block scalar value.
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === ' ')
            ch = this.buffer[++i];
        if (ch === '\t') {
            while (ch === '\t' || ch === ' ' || ch === '\r' || ch === '\n')
                ch = this.buffer[++i];
            nl = i - 1;
        }
        else if (!this.blockScalarKeep) {
            do {
                let i = nl - 1;
                let ch = this.buffer[i];
                if (ch === '\r')
                    ch = this.buffer[--i];
                const lastChar = i; // Drop the line if last char not more indented
                while (ch === ' ')
                    ch = this.buffer[--i];
                if (ch === '\n' && i >= this.pos && i + 1 + indent > lastChar)
                    nl = i;
                else
                    break;
            } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while ((ch = this.buffer[++i])) {
            if (ch === ':') {
                const next = this.buffer[i + 1];
                if (isEmpty(next) || (inFlow && flowIndicatorChars.has(next)))
                    break;
                end = i;
            }
            else if (isEmpty(ch)) {
                let next = this.buffer[i + 1];
                if (ch === '\r') {
                    if (next === '\n') {
                        i += 1;
                        ch = '\n';
                        next = this.buffer[i + 1];
                    }
                    else
                        end = i;
                }
                if (next === '#' || (inFlow && flowIndicatorChars.has(next)))
                    break;
                if (ch === '\n') {
                    const cs = this.continueScalar(i + 1);
                    if (cs === -1)
                        break;
                    i = Math.max(i, cs - 2); // to advance, but still account for ' #'
                }
            }
            else {
                if (inFlow && flowIndicatorChars.has(ch))
                    break;
                end = i;
            }
        }
        if (!ch && !this.atEnd)
            return this.setNext('plain-scalar');
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? 'flow' : 'doc';
    }
    *pushCount(n) {
        if (n > 0) {
            yield this.buffer.substr(this.pos, n);
            this.pos += n;
            return n;
        }
        return 0;
    }
    *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
            yield s;
            this.pos += s.length;
            return s.length;
        }
        else if (allowEmpty)
            yield '';
        return 0;
    }
    *pushIndicators() {
        let n = 0;
        loop: while (true) {
            switch (this.charAt(0)) {
                case '!':
                    n += yield* this.pushTag();
                    n += yield* this.pushSpaces(true);
                    continue loop;
                case '&':
                    n += yield* this.pushUntil(isNotAnchorChar);
                    n += yield* this.pushSpaces(true);
                    continue loop;
                case '-': // this is an error
                case '?': // this is an error outside flow collections
                case ':': {
                    const inFlow = this.flowLevel > 0;
                    const ch1 = this.charAt(1);
                    if (isEmpty(ch1) || (inFlow && flowIndicatorChars.has(ch1))) {
                        if (!inFlow)
                            this.indentNext = this.indentValue + 1;
                        else if (this.flowKey)
                            this.flowKey = false;
                        n += yield* this.pushCount(1);
                        n += yield* this.pushSpaces(true);
                        continue loop;
                    }
                }
            }
            break loop;
        }
        return n;
    }
    *pushTag() {
        if (this.charAt(1) === '<') {
            let i = this.pos + 2;
            let ch = this.buffer[i];
            while (!isEmpty(ch) && ch !== '>')
                ch = this.buffer[++i];
            return yield* this.pushToIndex(ch === '>' ? i + 1 : i, false);
        }
        else {
            let i = this.pos + 1;
            let ch = this.buffer[i];
            while (ch) {
                if (tagChars.has(ch))
                    ch = this.buffer[++i];
                else if (ch === '%' &&
                    hexDigits.has(this.buffer[i + 1]) &&
                    hexDigits.has(this.buffer[i + 2])) {
                    ch = this.buffer[(i += 3)];
                }
                else
                    break;
            }
            return yield* this.pushToIndex(i, false);
        }
    }
    *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === '\n')
            return yield* this.pushCount(1);
        else if (ch === '\r' && this.charAt(1) === '\n')
            return yield* this.pushCount(2);
        else
            return 0;
    }
    *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
            ch = this.buffer[++i];
        } while (ch === ' ' || (allowTabs && ch === '\t'));
        const n = i - this.pos;
        if (n > 0) {
            yield this.buffer.substr(this.pos, n);
            this.pos = i;
        }
        return n;
    }
    *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
            ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
    }
}

exports.Lexer = Lexer;


/***/ }),
/* 107 */
/***/ ((__unused_webpack_module, exports) => {



/**
 * Tracks newlines during parsing in order to provide an efficient API for
 * determining the one-indexed `{ line, col }` position for any offset
 * within the input.
 */
class LineCounter {
    constructor() {
        this.lineStarts = [];
        /**
         * Should be called in ascending order. Otherwise, call
         * `lineCounter.lineStarts.sort()` before calling `linePos()`.
         */
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        /**
         * Performs a binary search and returns the 1-indexed { line, col }
         * position of `offset`. If `line === 0`, `addNewLine` has never been
         * called or `offset` is before the first known newline.
         */
        this.linePos = (offset) => {
            let low = 0;
            let high = this.lineStarts.length;
            while (low < high) {
                const mid = (low + high) >> 1; // Math.floor((low + high) / 2)
                if (this.lineStarts[mid] < offset)
                    low = mid + 1;
                else
                    high = mid;
            }
            if (this.lineStarts[low] === offset)
                return { line: low + 1, col: 1 };
            if (low === 0)
                return { line: 0, col: offset };
            const start = this.lineStarts[low - 1];
            return { line: low, col: offset - start + 1 };
        };
    }
}

exports.LineCounter = LineCounter;


/***/ }),
/* 108 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var node_process = __webpack_require__(38);
var cst = __webpack_require__(102);
var lexer = __webpack_require__(106);

function includesToken(list, type) {
    for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
            return true;
    return false;
}
function findNonEmptyIndex(list) {
    for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
            case 'space':
            case 'comment':
            case 'newline':
                break;
            default:
                return i;
        }
    }
    return -1;
}
function isFlowToken(token) {
    switch (token?.type) {
        case 'alias':
        case 'scalar':
        case 'single-quoted-scalar':
        case 'double-quoted-scalar':
        case 'flow-collection':
            return true;
        default:
            return false;
    }
}
function getPrevProps(parent) {
    switch (parent.type) {
        case 'document':
            return parent.start;
        case 'block-map': {
            const it = parent.items[parent.items.length - 1];
            return it.sep ?? it.start;
        }
        case 'block-seq':
            return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
            return [];
    }
}
/** Note: May modify input array */
function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
        return [];
    let i = prev.length;
    loop: while (--i >= 0) {
        switch (prev[i].type) {
            case 'doc-start':
            case 'explicit-key-ind':
            case 'map-value-ind':
            case 'seq-item-ind':
            case 'newline':
                break loop;
        }
    }
    while (prev[++i]?.type === 'space') {
        /* loop */
    }
    return prev.splice(i, prev.length);
}
function arrayPushArray(target, source) {
    // May exhaust call stack with large `source` array
    if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
    else
        for (let i = 0; i < source.length; ++i)
            target.push(source[i]);
}
function fixFlowSeqItems(fc) {
    if (fc.start.type === 'flow-seq-start') {
        for (const it of fc.items) {
            if (it.sep &&
                !it.value &&
                !includesToken(it.start, 'explicit-key-ind') &&
                !includesToken(it.sep, 'map-value-ind')) {
                if (it.key)
                    it.value = it.key;
                delete it.key;
                if (isFlowToken(it.value)) {
                    if (it.value.end)
                        arrayPushArray(it.value.end, it.sep);
                    else
                        it.value.end = it.sep;
                }
                else
                    arrayPushArray(it.start, it.sep);
                delete it.sep;
            }
        }
    }
}
/**
 * A YAML concrete syntax tree (CST) parser
 *
 * ```ts
 * const src: string = ...
 * for (const token of new Parser().parse(src)) {
 *   // token: Token
 * }
 * ```
 *
 * To use the parser with a user-provided lexer:
 *
 * ```ts
 * function* parse(source: string, lexer: Lexer) {
 *   const parser = new Parser()
 *   for (const lexeme of lexer.lex(source))
 *     yield* parser.next(lexeme)
 *   yield* parser.end()
 * }
 *
 * const src: string = ...
 * const lexer = new Lexer()
 * for (const token of parse(src, lexer)) {
 *   // token: Token
 * }
 * ```
 */
class Parser {
    /**
     * @param onNewLine - If defined, called separately with the start position of
     *   each new line (in `parse()`, including the start of input).
     */
    constructor(onNewLine) {
        /** If true, space and sequence indicators count as indentation */
        this.atNewLine = true;
        /** If true, next token is a scalar value */
        this.atScalar = false;
        /** Current indentation level */
        this.indent = 0;
        /** Current offset since the start of parsing */
        this.offset = 0;
        /** On the same line with a block map key */
        this.onKeyLine = false;
        /** Top indicates the node that's currently being built */
        this.stack = [];
        /** The source of the current token, set in parse() */
        this.source = '';
        /** The type of the current token, set in parse() */
        this.type = '';
        // Must be defined after `next()`
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
    }
    /**
     * Parse `source` as a YAML stream.
     * If `incomplete`, a part of the last line may be left as a buffer for the next call.
     *
     * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
     *
     * @returns A generator of tokens representing each directive, document, and other structure.
     */
    *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
            this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
            yield* this.next(lexeme);
        if (!incomplete)
            yield* this.end();
    }
    /**
     * Advance the parser by the `source` of one lexical token.
     */
    *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
            console.log('|', cst.prettyToken(source));
        if (this.atScalar) {
            this.atScalar = false;
            yield* this.step();
            this.offset += source.length;
            return;
        }
        const type = cst.tokenType(source);
        if (!type) {
            const message = `Not a YAML token: ${source}`;
            yield* this.pop({ type: 'error', offset: this.offset, message, source });
            this.offset += source.length;
        }
        else if (type === 'scalar') {
            this.atNewLine = false;
            this.atScalar = true;
            this.type = 'scalar';
        }
        else {
            this.type = type;
            yield* this.step();
            switch (type) {
                case 'newline':
                    this.atNewLine = true;
                    this.indent = 0;
                    if (this.onNewLine)
                        this.onNewLine(this.offset + source.length);
                    break;
                case 'space':
                    if (this.atNewLine && source[0] === ' ')
                        this.indent += source.length;
                    break;
                case 'explicit-key-ind':
                case 'map-value-ind':
                case 'seq-item-ind':
                    if (this.atNewLine)
                        this.indent += source.length;
                    break;
                case 'doc-mode':
                case 'flow-error-end':
                    return;
                default:
                    this.atNewLine = false;
            }
            this.offset += source.length;
        }
    }
    /** Call at end of input to push out any remaining constructions */
    *end() {
        while (this.stack.length > 0)
            yield* this.pop();
    }
    get sourceToken() {
        const st = {
            type: this.type,
            offset: this.offset,
            indent: this.indent,
            source: this.source
        };
        return st;
    }
    *step() {
        const top = this.peek(1);
        if (this.type === 'doc-end' && top?.type !== 'doc-end') {
            while (this.stack.length > 0)
                yield* this.pop();
            this.stack.push({
                type: 'doc-end',
                offset: this.offset,
                source: this.source
            });
            return;
        }
        if (!top)
            return yield* this.stream();
        switch (top.type) {
            case 'document':
                return yield* this.document(top);
            case 'alias':
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar':
                return yield* this.scalar(top);
            case 'block-scalar':
                return yield* this.blockScalar(top);
            case 'block-map':
                return yield* this.blockMap(top);
            case 'block-seq':
                return yield* this.blockSequence(top);
            case 'flow-collection':
                return yield* this.flowCollection(top);
            case 'doc-end':
                return yield* this.documentEnd(top);
        }
        /* istanbul ignore next should not happen */
        yield* this.pop();
    }
    peek(n) {
        return this.stack[this.stack.length - n];
    }
    *pop(error) {
        const token = error ?? this.stack.pop();
        /* istanbul ignore if should not happen */
        if (!token) {
            const message = 'Tried to pop an empty stack';
            yield { type: 'error', offset: this.offset, source: '', message };
        }
        else if (this.stack.length === 0) {
            yield token;
        }
        else {
            const top = this.peek(1);
            if (token.type === 'block-scalar') {
                // Block scalars use their parent rather than header indent
                token.indent = 'indent' in top ? top.indent : 0;
            }
            else if (token.type === 'flow-collection' && top.type === 'document') {
                // Ignore all indent for top-level flow collections
                token.indent = 0;
            }
            if (token.type === 'flow-collection')
                fixFlowSeqItems(token);
            switch (top.type) {
                case 'document':
                    top.value = token;
                    break;
                case 'block-scalar':
                    top.props.push(token); // error
                    break;
                case 'block-map': {
                    const it = top.items[top.items.length - 1];
                    if (it.value) {
                        top.items.push({ start: [], key: token, sep: [] });
                        this.onKeyLine = true;
                        return;
                    }
                    else if (it.sep) {
                        it.value = token;
                    }
                    else {
                        Object.assign(it, { key: token, sep: [] });
                        this.onKeyLine = !it.explicitKey;
                        return;
                    }
                    break;
                }
                case 'block-seq': {
                    const it = top.items[top.items.length - 1];
                    if (it.value)
                        top.items.push({ start: [], value: token });
                    else
                        it.value = token;
                    break;
                }
                case 'flow-collection': {
                    const it = top.items[top.items.length - 1];
                    if (!it || it.value)
                        top.items.push({ start: [], key: token, sep: [] });
                    else if (it.sep)
                        it.value = token;
                    else
                        Object.assign(it, { key: token, sep: [] });
                    return;
                }
                /* istanbul ignore next should not happen */
                default:
                    yield* this.pop();
                    yield* this.pop(token);
            }
            if ((top.type === 'document' ||
                top.type === 'block-map' ||
                top.type === 'block-seq') &&
                (token.type === 'block-map' || token.type === 'block-seq')) {
                const last = token.items[token.items.length - 1];
                if (last &&
                    !last.sep &&
                    !last.value &&
                    last.start.length > 0 &&
                    findNonEmptyIndex(last.start) === -1 &&
                    (token.indent === 0 ||
                        last.start.every(st => st.type !== 'comment' || st.indent < token.indent))) {
                    if (top.type === 'document')
                        top.end = last.start;
                    else
                        top.items.push({ start: last.start });
                    token.items.splice(-1, 1);
                }
            }
        }
    }
    *stream() {
        switch (this.type) {
            case 'directive-line':
                yield { type: 'directive', offset: this.offset, source: this.source };
                return;
            case 'byte-order-mark':
            case 'space':
            case 'comment':
            case 'newline':
                yield this.sourceToken;
                return;
            case 'doc-mode':
            case 'doc-start': {
                const doc = {
                    type: 'document',
                    offset: this.offset,
                    start: []
                };
                if (this.type === 'doc-start')
                    doc.start.push(this.sourceToken);
                this.stack.push(doc);
                return;
            }
        }
        yield {
            type: 'error',
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML stream`,
            source: this.source
        };
    }
    *document(doc) {
        if (doc.value)
            return yield* this.lineEnd(doc);
        switch (this.type) {
            case 'doc-start': {
                if (findNonEmptyIndex(doc.start) !== -1) {
                    yield* this.pop();
                    yield* this.step();
                }
                else
                    doc.start.push(this.sourceToken);
                return;
            }
            case 'anchor':
            case 'tag':
            case 'space':
            case 'comment':
            case 'newline':
                doc.start.push(this.sourceToken);
                return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
            this.stack.push(bv);
        else {
            yield {
                type: 'error',
                offset: this.offset,
                message: `Unexpected ${this.type} token in YAML document`,
                source: this.source
            };
        }
    }
    *scalar(scalar) {
        if (this.type === 'map-value-ind') {
            const prev = getPrevProps(this.peek(2));
            const start = getFirstKeyStartProps(prev);
            let sep;
            if (scalar.end) {
                sep = scalar.end;
                sep.push(this.sourceToken);
                delete scalar.end;
            }
            else
                sep = [this.sourceToken];
            const map = {
                type: 'block-map',
                offset: scalar.offset,
                indent: scalar.indent,
                items: [{ start, key: scalar, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
        }
        else
            yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
        switch (this.type) {
            case 'space':
            case 'comment':
            case 'newline':
                scalar.props.push(this.sourceToken);
                return;
            case 'scalar':
                scalar.source = this.source;
                // block-scalar source includes trailing newline
                this.atNewLine = true;
                this.indent = 0;
                if (this.onNewLine) {
                    let nl = this.source.indexOf('\n') + 1;
                    while (nl !== 0) {
                        this.onNewLine(this.offset + nl);
                        nl = this.source.indexOf('\n', nl) + 1;
                    }
                }
                yield* this.pop();
                break;
            /* istanbul ignore next should not happen */
            default:
                yield* this.pop();
                yield* this.step();
        }
    }
    *blockMap(map) {
        const it = map.items[map.items.length - 1];
        // it.sep is true-ish if pair already has key or : separator
        switch (this.type) {
            case 'newline':
                this.onKeyLine = false;
                if (it.value) {
                    const end = 'end' in it.value ? it.value.end : undefined;
                    const last = Array.isArray(end) ? end[end.length - 1] : undefined;
                    if (last?.type === 'comment')
                        end?.push(this.sourceToken);
                    else
                        map.items.push({ start: [this.sourceToken] });
                }
                else if (it.sep) {
                    it.sep.push(this.sourceToken);
                }
                else {
                    it.start.push(this.sourceToken);
                }
                return;
            case 'space':
            case 'comment':
                if (it.value) {
                    map.items.push({ start: [this.sourceToken] });
                }
                else if (it.sep) {
                    it.sep.push(this.sourceToken);
                }
                else {
                    if (this.atIndentedComment(it.start, map.indent)) {
                        const prev = map.items[map.items.length - 2];
                        const end = prev?.value?.end;
                        if (Array.isArray(end)) {
                            arrayPushArray(end, it.start);
                            end.push(this.sourceToken);
                            map.items.pop();
                            return;
                        }
                    }
                    it.start.push(this.sourceToken);
                }
                return;
        }
        if (this.indent >= map.indent) {
            const atMapIndent = !this.onKeyLine && this.indent === map.indent;
            const atNextItem = atMapIndent &&
                (it.sep || it.explicitKey) &&
                this.type !== 'seq-item-ind';
            // For empty nodes, assign newline-separated not indented empty tokens to following node
            let start = [];
            if (atNextItem && it.sep && !it.value) {
                const nl = [];
                for (let i = 0; i < it.sep.length; ++i) {
                    const st = it.sep[i];
                    switch (st.type) {
                        case 'newline':
                            nl.push(i);
                            break;
                        case 'space':
                            break;
                        case 'comment':
                            if (st.indent > map.indent)
                                nl.length = 0;
                            break;
                        default:
                            nl.length = 0;
                    }
                }
                if (nl.length >= 2)
                    start = it.sep.splice(nl[1]);
            }
            switch (this.type) {
                case 'anchor':
                case 'tag':
                    if (atNextItem || it.value) {
                        start.push(this.sourceToken);
                        map.items.push({ start });
                        this.onKeyLine = true;
                    }
                    else if (it.sep) {
                        it.sep.push(this.sourceToken);
                    }
                    else {
                        it.start.push(this.sourceToken);
                    }
                    return;
                case 'explicit-key-ind':
                    if (!it.sep && !it.explicitKey) {
                        it.start.push(this.sourceToken);
                        it.explicitKey = true;
                    }
                    else if (atNextItem || it.value) {
                        start.push(this.sourceToken);
                        map.items.push({ start, explicitKey: true });
                    }
                    else {
                        this.stack.push({
                            type: 'block-map',
                            offset: this.offset,
                            indent: this.indent,
                            items: [{ start: [this.sourceToken], explicitKey: true }]
                        });
                    }
                    this.onKeyLine = true;
                    return;
                case 'map-value-ind':
                    if (it.explicitKey) {
                        if (!it.sep) {
                            if (includesToken(it.start, 'newline')) {
                                Object.assign(it, { key: null, sep: [this.sourceToken] });
                            }
                            else {
                                const start = getFirstKeyStartProps(it.start);
                                this.stack.push({
                                    type: 'block-map',
                                    offset: this.offset,
                                    indent: this.indent,
                                    items: [{ start, key: null, sep: [this.sourceToken] }]
                                });
                            }
                        }
                        else if (it.value) {
                            map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                        }
                        else if (includesToken(it.sep, 'map-value-ind')) {
                            this.stack.push({
                                type: 'block-map',
                                offset: this.offset,
                                indent: this.indent,
                                items: [{ start, key: null, sep: [this.sourceToken] }]
                            });
                        }
                        else if (isFlowToken(it.key) &&
                            !includesToken(it.sep, 'newline')) {
                            const start = getFirstKeyStartProps(it.start);
                            const key = it.key;
                            const sep = it.sep;
                            sep.push(this.sourceToken);
                            // @ts-expect-error type guard is wrong here
                            delete it.key;
                            // @ts-expect-error type guard is wrong here
                            delete it.sep;
                            this.stack.push({
                                type: 'block-map',
                                offset: this.offset,
                                indent: this.indent,
                                items: [{ start, key, sep }]
                            });
                        }
                        else if (start.length > 0) {
                            // Not actually at next item
                            it.sep = it.sep.concat(start, this.sourceToken);
                        }
                        else {
                            it.sep.push(this.sourceToken);
                        }
                    }
                    else {
                        if (!it.sep) {
                            Object.assign(it, { key: null, sep: [this.sourceToken] });
                        }
                        else if (it.value || atNextItem) {
                            map.items.push({ start, key: null, sep: [this.sourceToken] });
                        }
                        else if (includesToken(it.sep, 'map-value-ind')) {
                            this.stack.push({
                                type: 'block-map',
                                offset: this.offset,
                                indent: this.indent,
                                items: [{ start: [], key: null, sep: [this.sourceToken] }]
                            });
                        }
                        else {
                            it.sep.push(this.sourceToken);
                        }
                    }
                    this.onKeyLine = true;
                    return;
                case 'alias':
                case 'scalar':
                case 'single-quoted-scalar':
                case 'double-quoted-scalar': {
                    const fs = this.flowScalar(this.type);
                    if (atNextItem || it.value) {
                        map.items.push({ start, key: fs, sep: [] });
                        this.onKeyLine = true;
                    }
                    else if (it.sep) {
                        this.stack.push(fs);
                    }
                    else {
                        Object.assign(it, { key: fs, sep: [] });
                        this.onKeyLine = true;
                    }
                    return;
                }
                default: {
                    const bv = this.startBlockValue(map);
                    if (bv) {
                        if (bv.type === 'block-seq') {
                            if (!it.explicitKey &&
                                it.sep &&
                                !includesToken(it.sep, 'newline')) {
                                yield* this.pop({
                                    type: 'error',
                                    offset: this.offset,
                                    message: 'Unexpected block-seq-ind on same line with key',
                                    source: this.source
                                });
                                return;
                            }
                        }
                        else if (atMapIndent) {
                            map.items.push({ start });
                        }
                        this.stack.push(bv);
                        return;
                    }
                }
            }
        }
        yield* this.pop();
        yield* this.step();
    }
    *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
            case 'newline':
                if (it.value) {
                    const end = 'end' in it.value ? it.value.end : undefined;
                    const last = Array.isArray(end) ? end[end.length - 1] : undefined;
                    if (last?.type === 'comment')
                        end?.push(this.sourceToken);
                    else
                        seq.items.push({ start: [this.sourceToken] });
                }
                else
                    it.start.push(this.sourceToken);
                return;
            case 'space':
            case 'comment':
                if (it.value)
                    seq.items.push({ start: [this.sourceToken] });
                else {
                    if (this.atIndentedComment(it.start, seq.indent)) {
                        const prev = seq.items[seq.items.length - 2];
                        const end = prev?.value?.end;
                        if (Array.isArray(end)) {
                            arrayPushArray(end, it.start);
                            end.push(this.sourceToken);
                            seq.items.pop();
                            return;
                        }
                    }
                    it.start.push(this.sourceToken);
                }
                return;
            case 'anchor':
            case 'tag':
                if (it.value || this.indent <= seq.indent)
                    break;
                it.start.push(this.sourceToken);
                return;
            case 'seq-item-ind':
                if (this.indent !== seq.indent)
                    break;
                if (it.value || includesToken(it.start, 'seq-item-ind'))
                    seq.items.push({ start: [this.sourceToken] });
                else
                    it.start.push(this.sourceToken);
                return;
        }
        if (this.indent > seq.indent) {
            const bv = this.startBlockValue(seq);
            if (bv) {
                this.stack.push(bv);
                return;
            }
        }
        yield* this.pop();
        yield* this.step();
    }
    *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === 'flow-error-end') {
            let top;
            do {
                yield* this.pop();
                top = this.peek(1);
            } while (top?.type === 'flow-collection');
        }
        else if (fc.end.length === 0) {
            switch (this.type) {
                case 'comma':
                case 'explicit-key-ind':
                    if (!it || it.sep)
                        fc.items.push({ start: [this.sourceToken] });
                    else
                        it.start.push(this.sourceToken);
                    return;
                case 'map-value-ind':
                    if (!it || it.value)
                        fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
                    else if (it.sep)
                        it.sep.push(this.sourceToken);
                    else
                        Object.assign(it, { key: null, sep: [this.sourceToken] });
                    return;
                case 'space':
                case 'comment':
                case 'newline':
                case 'anchor':
                case 'tag':
                    if (!it || it.value)
                        fc.items.push({ start: [this.sourceToken] });
                    else if (it.sep)
                        it.sep.push(this.sourceToken);
                    else
                        it.start.push(this.sourceToken);
                    return;
                case 'alias':
                case 'scalar':
                case 'single-quoted-scalar':
                case 'double-quoted-scalar': {
                    const fs = this.flowScalar(this.type);
                    if (!it || it.value)
                        fc.items.push({ start: [], key: fs, sep: [] });
                    else if (it.sep)
                        this.stack.push(fs);
                    else
                        Object.assign(it, { key: fs, sep: [] });
                    return;
                }
                case 'flow-map-end':
                case 'flow-seq-end':
                    fc.end.push(this.sourceToken);
                    return;
            }
            const bv = this.startBlockValue(fc);
            /* istanbul ignore else should not happen */
            if (bv)
                this.stack.push(bv);
            else {
                yield* this.pop();
                yield* this.step();
            }
        }
        else {
            const parent = this.peek(2);
            if (parent.type === 'block-map' &&
                ((this.type === 'map-value-ind' && parent.indent === fc.indent) ||
                    (this.type === 'newline' &&
                        !parent.items[parent.items.length - 1].sep))) {
                yield* this.pop();
                yield* this.step();
            }
            else if (this.type === 'map-value-ind' &&
                parent.type !== 'flow-collection') {
                const prev = getPrevProps(parent);
                const start = getFirstKeyStartProps(prev);
                fixFlowSeqItems(fc);
                const sep = fc.end.splice(1, fc.end.length);
                sep.push(this.sourceToken);
                const map = {
                    type: 'block-map',
                    offset: fc.offset,
                    indent: fc.indent,
                    items: [{ start, key: fc, sep }]
                };
                this.onKeyLine = true;
                this.stack[this.stack.length - 1] = map;
            }
            else {
                yield* this.lineEnd(fc);
            }
        }
    }
    flowScalar(type) {
        if (this.onNewLine) {
            let nl = this.source.indexOf('\n') + 1;
            while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf('\n', nl) + 1;
            }
        }
        return {
            type,
            offset: this.offset,
            indent: this.indent,
            source: this.source
        };
    }
    startBlockValue(parent) {
        switch (this.type) {
            case 'alias':
            case 'scalar':
            case 'single-quoted-scalar':
            case 'double-quoted-scalar':
                return this.flowScalar(this.type);
            case 'block-scalar-header':
                return {
                    type: 'block-scalar',
                    offset: this.offset,
                    indent: this.indent,
                    props: [this.sourceToken],
                    source: ''
                };
            case 'flow-map-start':
            case 'flow-seq-start':
                return {
                    type: 'flow-collection',
                    offset: this.offset,
                    indent: this.indent,
                    start: this.sourceToken,
                    items: [],
                    end: []
                };
            case 'seq-item-ind':
                return {
                    type: 'block-seq',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [this.sourceToken] }]
                };
            case 'explicit-key-ind': {
                this.onKeyLine = true;
                const prev = getPrevProps(parent);
                const start = getFirstKeyStartProps(prev);
                start.push(this.sourceToken);
                return {
                    type: 'block-map',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, explicitKey: true }]
                };
            }
            case 'map-value-ind': {
                this.onKeyLine = true;
                const prev = getPrevProps(parent);
                const start = getFirstKeyStartProps(prev);
                return {
                    type: 'block-map',
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                };
            }
        }
        return null;
    }
    atIndentedComment(start, indent) {
        if (this.type !== 'comment')
            return false;
        if (this.indent <= indent)
            return false;
        return start.every(st => st.type === 'newline' || st.type === 'space');
    }
    *documentEnd(docEnd) {
        if (this.type !== 'doc-mode') {
            if (docEnd.end)
                docEnd.end.push(this.sourceToken);
            else
                docEnd.end = [this.sourceToken];
            if (this.type === 'newline')
                yield* this.pop();
        }
    }
    *lineEnd(token) {
        switch (this.type) {
            case 'comma':
            case 'doc-start':
            case 'doc-end':
            case 'flow-seq-end':
            case 'flow-map-end':
            case 'map-value-ind':
                yield* this.pop();
                yield* this.step();
                break;
            case 'newline':
                this.onKeyLine = false;
            // fallthrough
            case 'space':
            case 'comment':
            default:
                // all other values are errors
                if (token.end)
                    token.end.push(this.sourceToken);
                else
                    token.end = [this.sourceToken];
                if (this.type === 'newline')
                    yield* this.pop();
        }
    }
}

exports.Parser = Parser;


/***/ }),
/* 109 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



var composer = __webpack_require__(37);
var Document = __webpack_require__(42);
var errors = __webpack_require__(86);
var log = __webpack_require__(58);
var identity = __webpack_require__(40);
var lineCounter = __webpack_require__(107);
var parser = __webpack_require__(108);

function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter$1 = options.lineCounter || (prettyErrors && new lineCounter.LineCounter()) || null;
    return { lineCounter: lineCounter$1, prettyErrors };
}
/**
 * Parse the input as a stream of YAML documents.
 *
 * Documents should be separated from each other by `...` or `---` marker lines.
 *
 * @returns If an empty `docs` array is returned, it will be of type
 *   EmptyStream and contain additional stream information. In
 *   TypeScript, you should use `'empty' in docs` as a type guard for it.
 */
function parseAllDocuments(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter?.addNewLine);
    const composer$1 = new composer.Composer(options);
    const docs = Array.from(composer$1.compose(parser$1.parse(source)));
    if (prettyErrors && lineCounter)
        for (const doc of docs) {
            doc.errors.forEach(errors.prettifyError(source, lineCounter));
            doc.warnings.forEach(errors.prettifyError(source, lineCounter));
        }
    if (docs.length > 0)
        return docs;
    return Object.assign([], { empty: true }, composer$1.streamInfo());
}
/** Parse an input string into a single YAML.Document */
function parseDocument(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter?.addNewLine);
    const composer$1 = new composer.Composer(options);
    // `doc` is always set by compose.end(true) at the very latest
    let doc = null;
    for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
            doc = _doc;
        else if (doc.options.logLevel !== 'silent') {
            doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), 'MULTIPLE_DOCS', 'Source contains multiple documents; please use YAML.parseAllDocuments()'));
            break;
        }
    }
    if (prettyErrors && lineCounter) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter));
    }
    return doc;
}
function parse(src, reviver, options) {
    let _reviver = undefined;
    if (typeof reviver === 'function') {
        _reviver = reviver;
    }
    else if (options === undefined && reviver && typeof reviver === 'object') {
        options = reviver;
    }
    const doc = parseDocument(src, options);
    if (!doc)
        return null;
    doc.warnings.forEach(warning => log.warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
        if (doc.options.logLevel !== 'silent')
            throw doc.errors[0];
        else
            doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
}
function stringify(value, replacer, options) {
    let _replacer = null;
    if (typeof replacer === 'function' || Array.isArray(replacer)) {
        _replacer = replacer;
    }
    else if (options === undefined && replacer) {
        options = replacer;
    }
    if (typeof options === 'string')
        options = options.length;
    if (typeof options === 'number') {
        const indent = Math.round(options);
        options = indent < 1 ? undefined : indent > 8 ? { indent: 8 } : { indent };
    }
    if (value === undefined) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
            return undefined;
    }
    if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
    return new Document.Document(value, _replacer, options).toString(options);
}

exports.parse = parse;
exports.parseAllDocuments = parseAllDocuments;
exports.parseDocument = parseDocument;
exports.stringify = stringify;


/***/ }),
/* 110 */
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
/* 111 */
/***/ ((__unused_webpack_module, exports) => {


// AUTO-GENERATED by scripts/generate-runtime-descriptions.js
// Source: github: PolyAI-LDN/genai_lambda_runtime
// Do not edit manually — re-run the script to regenerate.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.flowMembers = exports.flowClassDescription = exports.conversationMembers = exports.conversationClassDescription = void 0;
exports.conversationClassDescription = `Object exposing useful information from the conversation runtime`;
exports.conversationMembers = {
    "utils": {
        name: "utils",
        kind: "property",
        description: `intialise utils class`,
    },
    "memory": {
        name: "memory",
        kind: "property",
        description: `Expose memory interface to builders.`,
    },
    "log": {
        name: "log",
        kind: "property",
        description: `Initialize logging utility`,
    },
    "agentic_dial": {
        name: "agentic_dial",
        kind: "property",
        description: `Agentic dial`,
    },
    "id": {
        name: "id",
        kind: "property",
        description: `The ID of the conversation`,
        returnType: `str`,
    },
    "account_id": {
        name: "account_id",
        kind: "property",
        description: `The account ID`,
        returnType: `str`,
    },
    "project_id": {
        name: "project_id",
        kind: "property",
        description: `The project ID`,
        returnType: `str`,
    },
    "env": {
        name: "env",
        kind: "property",
        description: `The client environment this is executing in`,
        returnType: `str`,
    },
    "sip_headers": {
        name: "sip_headers",
        kind: "property",
        description: `Dict mapping header names to values`,
        returnType: `dict[str, str]`,
    },
    "integration_attributes": {
        name: "integration_attributes",
        kind: "property",
        description: `Attributes provided by an external integration.`,
        fullDescription: `Attributes provided by an external integration.

These attributes are defined per project and per integration
and are typically agreed upon during the project setup phase.

Supported integrations include:
- [DNIs Pooling](https://docs.poly.ai/integrations/voice/dnis-pool)

Example: A \`shared_id\` might be provided by the client, allowing them to
correlate conversation outcomes using the same id via the Handoff API.
This \`shared_id\` should be saved into the state to achieve that:
\`\`\`python
if not (shared_id := conv.integration_attributes.get("shared_id")):
# configure default handoff info
conv.state.shared_id = shared_id
\`\`\`

It's recommended to validate and extract any required attributes at the start
of the conversation within the \`start_function\` to handle missing data appropriately.`,
        returnType: `dict[str, Any] | None`,
    },
    "caller_number": {
        name: "caller_number",
        kind: "property",
        description: `The caller's phone number`,
        returnType: `str | None`,
    },
    "callee_number": {
        name: "callee_number",
        kind: "property",
        description: `The callee's phone number`,
        returnType: `str | None`,
    },
    "state": {
        name: "state",
        kind: "property",
        description: `Dictionary of saved variables that persist through the conversation`,
        fullDescription: `Dictionary of saved variables that persist through the conversation

Supports dict-style indexing e.g. \`conv.state["key"] = "value"\``,
        returnType: `State`,
    },
    "entities": {
        name: "entities",
        kind: "property",
        description: `The entities collected from the conversation`,
        returnType: `Entities`,
    },
    "current_flow": {
        name: "current_flow",
        kind: "property",
        description: `Name of the flow we are currently in`,
        returnType: `str | None`,
    },
    "current_step": {
        name: "current_step",
        kind: "property",
        description: `Name of the step we are currently in`,
        returnType: `str | None`,
    },
    "sms_queue": {
        name: "sms_queue",
        kind: "property",
        description: `Queue of SMS messages to send`,
        returnType: `list[OutgoingSMS | OutgoingSMSTemplate]`,
    },
    "metrics_queue": {
        name: "metrics_queue",
        kind: "property",
        description: `Queue of metrics to write`,
        returnType: `list[dict]`,
    },
    "variant_name": {
        name: "variant_name",
        kind: "property",
        description: `The name of the variant of the conversation`,
        returnType: `str | None`,
    },
    "variants": {
        name: "variants",
        kind: "property",
        description: `The variants of the conversation with their attributes`,
        returnType: `dict[str, Variant]`,
    },
    "variant": {
        name: "variant",
        kind: "property",
        description: `The variant of the conversation`,
        returnType: `Variant | None`,
    },
    "sms_templates": {
        name: "sms_templates",
        kind: "property",
        description: `The SMS templates available to the conversation`,
        returnType: `dict[str, SMSTemplate]`,
    },
    "voice_change": {
        name: "voice_change",
        kind: "property",
        description: `The request to change voice for the conversation`,
        returnType: `TTSVoice | None`,
    },
    "language": {
        name: "language",
        kind: "property",
        description: `The ISO 639 language code of the language set for the conversation`,
        returnType: `str | None`,
    },
    "history": {
        name: "history",
        kind: "property",
        description: `The history of the conversation so far`,
        returnType: `list[UserInput | AgentResponse]`,
    },
    "handoffs": {
        name: "handoffs",
        kind: "property",
        description: `The handoffs available to the conversation`,
        returnType: `dict[str, HandoffConfig]`,
    },
    "transcript_alternatives": {
        name: "transcript_alternatives",
        kind: "property",
        description: `List of transcription alternatives for the last user input, including the primary transcription.`,
        fullDescription: `List of transcription alternatives for the last user input,
including the primary transcription.`,
        returnType: `list[str]`,
    },
    "real_time_config": {
        name: "real_time_config",
        kind: "property",
        description: `The real time config for the conversation`,
        fullDescription: `The real time config for the conversation

Warning: Every key that you may use might be None, so please check for None before using.`,
        returnType: `dict[str, Any | None]`,
    },
    "functions": {
        name: "functions",
        kind: "property",
        description: `The functions available to the conversation`,
        returnType: `FunctionExecutor`,
    },
    "api": {
        name: "api",
        kind: "property",
        description: `Access to API integrations via conv.api.{api_name}.{operation}()`,
        fullDescription: `Access to API integrations via conv.api.{api_name}.{operation}()

Example usage:
response = conv.api.salesforce.get_contact(user_id="123")
if response.status_code == 200:
contact_data = response.json()
conv.say(f"Found contact: {contact_data['name']}")

response = conv.api.stripe.create_payment(amount=100)
if response.ok:
payment_data = response.json()
conv.say(f"Payment created: {payment_data['id']}")`,
        returnType: `ApiExecutor`,
    },
    "generic_external_events": {
        name: "generic_external_events",
        kind: "property",
        description: `The generic external events available to the conversation initiated by the function generate_external_event. This is a queue, so the latest item is the newest event. Each item is an object containing the following parameters:`,
        fullDescription: `The generic external events available to the conversation initiated by the
function generate_external_event. This is a queue, so the latest item is the
newest event. Each item is an object containing the following parameters:

- ext_event_id: <str> the event id;
- send_to_llm: <bool> whether the payload of the webhook will eventually be
also fed to the LLM as system prompt;
- created_at: <str / datetime isoformat> when the event id was registered in
the system (it is None if the event has not been registered yet);
- data: <str> the raw string form of the webhook payload (it is None if the
webhook has not been called yet passing the related event id);
- content_type: <str> the content type of the webhook payload (it is None if
the webhook has not been called yet passing the related event id).`,
        returnType: `list[dict]`,
    },
    "channel_type": {
        name: "channel_type",
        kind: "property",
        description: `The channel of the conversation e.g. 'sms', 'sip.polyai'`,
        returnType: `str`,
    },
    "attachments": {
        name: "attachments",
        kind: "property",
        description: `List of attachments to be included with the next agent message.`,
        fullDescription: `List of attachments to be included with the next agent message.

Each attachment provides additional context or information for the user.
Attachments are only supported on WEBCHAT channels.`,
        returnType: `list[Attachment]`,
    },
    "response_suggestions": {
        name: "response_suggestions",
        kind: "property",
        description: `List of response suggestions (text strings) for the next agent message.`,
        fullDescription: `List of response suggestions (text strings) for the next agent message.

These are quick replies or suggested messages for the user. In supported channels (such as webchat), they appear as clickable options. If the user clicks a suggestion, that text will be sent as their response.

Only supported on WEBCHAT channels.`,
        returnType: `list[str]`,
    },
    "webchat": {
        name: "webchat",
        kind: "property",
        description: `Webchat-specific interface.`,
        fullDescription: `Webchat-specific interface.

Use this to access functionality only supported on WEBCHAT channels,
e.g. \`\`conv.webchat.set_chat_call_actions(...)\`\`.`,
        returnType: `WebchatInterface`,
    },
    "translations": {
        name: "translations",
        kind: "property",
        description: `Return the localized translation of the accessed field name.`,
        fullDescription: `Return the localized translation of the accessed field name.

When an attribute is accessed on this object, its name is used as a key
to look up the corresponding translation in the internal \`translations\`
dictionary for the current language. If no translation is found, the
original attribute name is returned unchanged.`,
        returnType: `TranslationReplacementProxy`,
    },
    "provider_voice_id": {
        name: "provider_voice_id",
        kind: "property",
        description: `The TTS provider voice ID set for the conversation`,
        returnType: `str`,
    },
    "integrations": {
        name: "integrations",
        kind: "property",
        description: `Access to external integrations via conv.integrations.{integration_name}()`,
        fullDescription: `Access to external integrations via conv.integrations.{integration_name}()

Example usage:
response = conv.integrations.salesforce.get_contact(user_id="123")
if response.status_code == 200:
contact_data = response.json()
conv.say(f"Found contact: {contact_data['name']}")

response = conv.integrations.stripe.create_payment(amount=100)
if response.ok:
payment_data = response.json()
conv.say(f"Payment created: {payment_data['id']}")`,
        returnType: `Integrations`,
    },
    "send_email": {
        name: "send_email",
        kind: "method",
        signature: `(to: str, body: str, subject: str = "") -> None`,
        description: `Send an email`,
        fullDescription: `Send an email

Args:
to (str): To email address
body (str): Raw body of the email
subject (str, optional): Subject of the email. Defaults to "".`,
        returnType: `None`,
        parameters: [
            { name: "to", type: `str`, description: `To email address` },
            { name: "body", type: `str`, description: `Raw body of the email` },
            { name: "subject", type: `str`, description: `Subject of the email. Defaults to "".`, default: "\"\"" },
        ],
    },
    "set_voice": {
        name: "set_voice",
        kind: "method",
        signature: `(voice: VoiceType)`,
        description: `Change the voice for the current conversation moving forward.`,
        fullDescription: `Change the voice for the current conversation moving forward.

Args:
voice: The voice to be used.`,
        parameters: [
            { name: "voice", type: `VoiceType`, description: `The voice to be used.` },
        ],
    },
    "set_language": {
        name: "set_language",
        kind: "method",
        signature: `(language: SupportedLanguageCodes)`,
        description: `Change the language for the current conversation moving forward.`,
        fullDescription: `Change the language for the current conversation moving forward.

Args:
language: The ISO 639 language code of the language to switch to.`,
        parameters: [
            { name: "language", type: `SupportedLanguageCodes`, description: `The ISO 639 language code of the language to switch to.` },
        ],
    },
    "set_asr_biasing": {
        name: "set_asr_biasing",
        kind: "method",
        signature: `(keywords: list[str] | None = None, custom_biases: dict[str, float] | None = None) -> None`,
        description: `Set ASR biasing for the conversation.`,
        fullDescription: `Set ASR biasing for the conversation.

This method allows functions to dynamically configure ASR keywords and
custom biases. The biasing persists across turns until explicitly cleared
using \`clear_asr_biasing()\` or updated with a new call to this method.

Args:
keywords: List of keywords to bias ASR recognition toward.
Keywords are equally biased.
Example: ["hotel", "restaurant", "booking"]
custom_biases: Dictionary mapping phrases to bias weights.
Custom biases allow you to specify unequal biases for different phrases.
Example: {"booking": 3.0, "cancellation": 2.5}

Raises:
ValueError: If keywords contains non-string values or custom_biases
has invalid types.`,
        returnType: `None`,
        parameters: [
            { name: "keywords", type: `list[str] | None`, description: `List of keywords to bias ASR recognition toward. Keywords are equally biased.`, default: "None" },
            { name: "custom_biases", type: `dict[str, float] | None`, default: "None" },
        ],
    },
    "clear_asr_biasing": {
        name: "clear_asr_biasing",
        kind: "method",
        signature: `() -> None`,
        description: `Clear ASR biasing for future turns.`,
        fullDescription: `Clear ASR biasing for future turns.

This method clears any previously set ASR biasing by calling
set_asr_biasing() with empty values.`,
        returnType: `None`,
    },
    "say": {
        name: "say",
        kind: "method",
        signature: `(utterance: str)`,
        description: `Set the next utterance to be said following the execution of the function`,
        parameters: [
            { name: "utterance", type: `str` },
        ],
    },
    "randomize_voice": {
        name: "randomize_voice",
        kind: "method",
        signature: `(voice_weights: list[VoiceWeighting])`,
        description: `Randomly selects a voice from a weighted list of voices.`,
        fullDescription: `Randomly selects a voice from a weighted list of voices.

Args:
voices: A list of VoiceWeighting objects containing voices and their
weights.

Raises:
ValueError: If no voices are provided or if weight assignments are invalid.`,
        parameters: [
            { name: "voice_weights", type: `list[VoiceWeighting]` },
        ],
    },
    "goto_flow": {
        name: "goto_flow",
        kind: "method",
        signature: `(flow_name: str)`,
        description: `Trigger a transition to a flow`,
        fullDescription: `Trigger a transition to a flow

Args:
flow_name: the name of the flow to enter`,
        parameters: [
            { name: "flow_name", type: `str`, description: `the name of the flow to enter` },
        ],
    },
    "exit_flow": {
        name: "exit_flow",
        kind: "method",
        signature: `()`,
        description: `Trigger exiting the current flow`,
    },
    "goto_csat_flow": {
        name: "goto_csat_flow",
        kind: "method",
        signature: `()`,
        description: `Trigger a transition to the CSAT survey flow for voice.`,
        fullDescription: `Trigger a transition to the CSAT survey flow for voice.

Additional channels (e.g. SMS) may be supported in the future.`,
    },
    "set_variant": {
        name: "set_variant",
        kind: "method",
        signature: `(variant: str)`,
        description: `Set the variant of the conversation`,
        fullDescription: `Set the variant of the conversation

Args:
variant: the variant to set`,
        parameters: [
            { name: "variant", type: `str`, description: `the variant to set` },
        ],
    },
    "log_api_response": {
        name: "log_api_response",
        kind: "method",
        signature: `(response: requests.models.Response, override_url: str = None)`,
        description: `Log api response for analytics`,
        fullDescription: `Log api response for analytics

Args:
response: api response
override_url: allow user to define the url schema they want to group by`,
        parameters: [
            { name: "response", type: `requests.models.Response`, description: `api response` },
            { name: "override_url", type: `str`, description: `allow user to define the url schema they want to group by`, default: "None" },
        ],
    },
    "send_sms": {
        name: "send_sms",
        kind: "method",
        signature: `(to_number: str, from_number: str, content: str, retry_count: int | None = None) -> dict | None`,
        description: `Sends an SMS`,
        fullDescription: `Sends an SMS

Args:
to_number: recipient number
from_number: sender number
content: text content of SMS`,
        returnType: `dict | None`,
        parameters: [
            { name: "to_number", type: `str`, description: `recipient number` },
            { name: "from_number", type: `str`, description: `sender number` },
            { name: "content", type: `str`, description: `text content of SMS` },
            { name: "retry_count", type: `int | None`, default: "None" },
        ],
    },
    "send_whatsapp": {
        name: "send_whatsapp",
        kind: "method",
        signature: `(to_number: str, from_number: str, content_id: str, content: str | None = "", retry_count: int | None = None) -> dict | None`,
        description: `Sends a WhatsApp message`,
        fullDescription: `Sends a WhatsApp message

To send a WhatsApp message, the Twilio subaccount must
use a phone number enabled for WhatsApp. This requires approval
from Meta, for both the phone number itself and the message template content.
Once approved, Twillio will provide a \`contentId\`, which must be referenced
when sending the message.

Args:
to_number: recipient number
from_number: sender number
content: text content of SMS (optional)
content_id: alphanumeric ID of the message
retry_count: Number of retries to attempt`,
        returnType: `dict | None`,
        parameters: [
            { name: "to_number", type: `str`, description: `recipient number` },
            { name: "from_number", type: `str`, description: `sender number` },
            { name: "content_id", type: `str`, description: `alphanumeric ID of the message` },
            { name: "content", type: `str | None`, description: `text content of SMS (optional)`, default: "\"\"" },
            { name: "retry_count", type: `int | None`, description: `Number of retries to attempt`, default: "None" },
        ],
    },
    "send_content_template": {
        name: "send_content_template",
        kind: "method",
        signature: `(messaging_service_id: str, to_number: str, content_id: str, content: str | None = "", whatsapp: bool | None = False, content_variables: dict | None = None, retry_count: int | None = None) -> dict | None`,
        description: `Sends a WhatsApp message`,
        fullDescription: `Sends a WhatsApp message

To send a WhatsApp message, the Twilio subaccount must
use a phone number enabled for WhatsApp. This requires approval
from Meta, for both the phone number itself and the message template content.
Once approved, Twillio will provide a \`contentId\`, which must be referenced
when sending the message.

Args:
messaging_service_id: messaging service id
to_number: recipient number
content: text content of SMS (optional)
content_id: alphanumeric ID of the message
whatsapp: set to True, if SMS should be sent over WhatsApp
content_variables: variables to pass to the message template
retry_count: Number of retries to attempt`,
        returnType: `dict | None`,
        parameters: [
            { name: "messaging_service_id", type: `str`, description: `messaging service id` },
            { name: "to_number", type: `str`, description: `recipient number` },
            { name: "content_id", type: `str`, description: `alphanumeric ID of the message` },
            { name: "content", type: `str | None`, description: `text content of SMS (optional)`, default: "\"\"" },
            { name: "whatsapp", type: `bool | None`, description: `set to True, if SMS should be sent over WhatsApp`, default: "False" },
            { name: "content_variables", type: `dict | None`, description: `variables to pass to the message template`, default: "None" },
            { name: "retry_count", type: `int | None`, description: `Number of retries to attempt`, default: "None" },
        ],
    },
    "send_sms_template": {
        name: "send_sms_template",
        kind: "method",
        signature: `(to_number: str, template: str, retry_count: int | None = None) -> dict | None`,
        description: `Sends an SMS template`,
        fullDescription: `Sends an SMS template

Args:
to_number: recipient number
template: SMS template name
retry_count: Number of retries to attempt`,
        returnType: `dict | None`,
        parameters: [
            { name: "to_number", type: `str`, description: `recipient number` },
            { name: "template", type: `str`, description: `SMS template name` },
            { name: "retry_count", type: `int | None`, description: `Number of retries to attempt`, default: "None" },
        ],
    },
    "set_csat_eligibility": {
        name: "set_csat_eligibility",
        kind: "method",
        signature: `(eligible: bool, reason: str | None = None)`,
        description: `Set whether this conversation is eligible for CSAT surveys.`,
        fullDescription: `Set whether this conversation is eligible for CSAT surveys.

If set to False, the conversation will be excluded from CSAT regardless of normal
logic (call type, percentage, weekly caps). If set to True or not called, normal
CSAT logic applies.

Args:
eligible: Whether conversation is eligible for CSAT (True/False)
reason: Optional reason for the decision (for logging/debugging)`,
        parameters: [
            { name: "eligible", type: `bool`, description: `Whether conversation is eligible for CSAT (True/False)` },
            { name: "reason", type: `str | None`, description: `Optional reason for the decision (for logging/debugging)`, default: "None" },
        ],
    },
    "set_csat_phone_number": {
        name: "set_csat_phone_number",
        kind: "method",
        signature: `(phone_number: str)`,
        description: `Set the phone number to use for CSAT SMS surveys.`,
        fullDescription: `Set the phone number to use for CSAT SMS surveys.

Use this to override the caller's number for CSAT SMS.
This is useful when the actual caller phone number is passed via a SIP header
rather than being the caller ID in cases like IVR.

Args:
phone_number: The phone number to send CSAT SMS to`,
        parameters: [
            { name: "phone_number", type: `str`, description: `The phone number to send CSAT SMS to` },
        ],
    },
    "set_csat_score": {
        name: "set_csat_score",
        kind: "method",
        signature: `(score: int)`,
        description: `Set the CSAT score for this conversation.`,
        fullDescription: `Set the CSAT score for this conversation.

This method is used by the platform's CSAT voice survey flow to record
the customer satisfaction score. The score must be an integer between 1 and 5.

Args:
score: The CSAT score (1-5)

Raises:
ValueError: If score is not an integer between 1 and 5`,
        parameters: [
            { name: "score", type: `int`, description: `The CSAT score (1-5)` },
        ],
    },
    "set_csat_survey_entered": {
        name: "set_csat_survey_entered",
        kind: "method",
        signature: `()`,
        description: `Mark that the CSAT survey was entered for this conversation.`,
        fullDescription: `Mark that the CSAT survey was entered for this conversation.

This method is used by the platform's CSAT voice survey flow to record
that the customer entered the survey flow.`,
    },
    "add_attachments": {
        name: "add_attachments",
        kind: "method",
        signature: `(attachments: list[Attachment]) -> None`,
        description: `Adds the given attachments to the agent message.`,
        fullDescription: `Adds the given attachments to the agent message.

Attachments provide additional context or information and are currently only supported for WEBCHAT channels.

Args:
attachments: A list of \`Attachment\` objects to show in the next message.

Each \`Attachment\` can be of type "image" or "weblink":

- "weblink": Displays the title, preview image, and call-to-action text.
Clicking the attachment navigates the user to the specified webpage (\`content_url\`).
- "image": Displays the title (if present), but no call-to-action.
\`preview_image_url\` should be a lower resolution image, and \`content_url\` should be the full resolution image.
Clicking the attachment shows a higher resolution version of the image.`,
        returnType: `None`,
        parameters: [
            { name: "attachments", type: `list[Attachment]`, description: `A list of \`Attachment\` objects to show in the next message.` },
        ],
    },
    "set_response_suggestions": {
        name: "set_response_suggestions",
        kind: "method",
        signature: `(suggestions: list[str]) -> None`,
        description: `Sets response suggestions for the agent message.`,
        fullDescription: `Sets response suggestions for the agent message.

Response suggestions are quick replies or suggested messages for the user. Each suggestion should be a text string. In supported channels (such as webchat), these appear as clickable options. If the user clicks a suggestion, that text will be sent as their response.

Note:
Response suggestions are only supported on WEBCHAT channels.

Args:
suggestions: List of response suggestions (text strings) to show as quick replies.`,
        returnType: `None`,
        parameters: [
            { name: "suggestions", type: `list[str]`, description: `List of response suggestions (text strings) to show as quick replies.` },
        ],
    },
    "generate_external_event": {
        name: "generate_external_event",
        kind: "method",
        signature: `(send_to_llm: bool = False) -> str`,
        description: `Generate an external event ID which can be sent to some external provider.`,
        fullDescription: `Generate an external event ID which can be sent to some external provider.

The external provider can send some data back to the Agent by using the
/v1/external-events/webhook endpoint. The payload of the webhook will then be
available in the property conv.generic_external_events which is a list of
events being generated during the duration of the call.

The generated event id is unique per event (invocation of this function) and
is linked to a specific call. The event id will expire after 1 hour.

Args: send_to_llm: <bool> - Whether, when the webhook is called, the payload
of the request has to be also directly sent to the LLM (a "system" prompt
will be used). If "false", the payload will only live in the list
conv.generic_external_events.

Returns:
<str> - External event ID`,
        returnType: `str`,
        parameters: [
            { name: "send_to_llm", type: `bool`, default: "False" },
        ],
    },
    "metric_events": {
        name: "metric_events",
        kind: "property",
        description: `List of metric events already written in the conversation.`,
        returnType: `list[MetricEvent]`,
    },
    "write_metric": {
        name: "write_metric",
        kind: "method",
        signature: `(name: str, value: float | int | str | None = None, write_once: bool = False)`,
        description: `Write a custom metric for call analytics.`,
        fullDescription: `Write a custom metric for call analytics.

Args:
name: the name of the metric
value: the value to write
write_once: whether the metric should only be written once`,
        parameters: [
            { name: "name", type: `str`, description: `the name of the metric` },
            { name: "value", type: `float | int | str | None`, description: `the value to write`, default: "None" },
            { name: "write_once", type: `bool`, description: `whether the metric should only be written once`, default: "False" },
        ],
    },
    "call_handoff": {
        name: "call_handoff",
        kind: "method",
        signature: `(destination: str, reason: str = None, utterance: str = None, sip_headers: dict[str, str] | None = None, route: str | None = None)`,
        description: `Trigger a transfer of the conversation to a live agent`,
        fullDescription: `Trigger a transfer of the conversation to a live agent

Args:
destination: handoff destination
reason: reason for the handoff
utterance: utterance for the agent to say
sip_headers: Optional dict of SIP headers to pass through. These headers
will be merged with any headers configured in the handoff config,
with passed headers taking precedence.
route: Optional phone number or route to override the configured route.
This will overwrite the phone_number in the sip_config, similar to
how sip_headers can override configured headers.`,
        parameters: [
            { name: "destination", type: `str`, description: `handoff destination` },
            { name: "reason", type: `str`, description: `reason for the handoff`, default: "None" },
            { name: "utterance", type: `str`, description: `utterance for the agent to say`, default: "None" },
            { name: "sip_headers", type: `dict[str, str] | None`, description: `Optional dict of SIP headers to pass through. These headers will be merged with any headers configured in the handoff config, with passed headers taking precedence.`, default: "None" },
            { name: "route", type: `str | None`, description: `Optional phone number or route to override the configured route. This will overwrite the phone_number in the sip_config, similar to how sip_headers can override configured headers.`, default: "None" },
        ],
    },
    "discard_recording": {
        name: "discard_recording",
        kind: "method",
        signature: `()`,
        description: `Stop any recordings of the current conversation and prevent them from being persisted. Once called, the recording can not be subsequently resumed or retrieved.`,
        fullDescription: `Stop any recordings of the current conversation and prevent them from being
persisted. Once called, the recording can not be subsequently resumed or retrieved.`,
    },
};
exports.flowClassDescription = `Object for working within flows`;
exports.flowMembers = {
    "function_dir": {
        name: "function_dir",
        kind: "property",
        description: ``,
    },
    "current_step": {
        name: "current_step",
        kind: "property",
        description: `The name of the step we're currently in`,
        returnType: `str`,
    },
    "functions": {
        name: "functions",
        kind: "property",
        description: `The functions available to the flow`,
        returnType: `FlowFunctionExecutor`,
    },
    "goto_step": {
        name: "goto_step",
        kind: "method",
        signature: `(step_name: str, label: str | None = None)`,
        description: `Trigger a transition to a different step`,
        fullDescription: `Trigger a transition to a different step

Args:
step_name: name of the step to transition to
label: used for rendering the condition where relevant but no runtime effect`,
        parameters: [
            { name: "step_name", type: `str`, description: `name of the step to transition to` },
            { name: "label", type: `str | None`, description: `used for rendering the condition where relevant but no runtime effect`, default: "None" },
        ],
    },
};


/***/ }),
/* 112 */
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
exports.YamlAttrHoverProvider = exports.YamlAttrLinkProvider = exports.YamlFunctionHoverProvider = exports.YamlFunctionLinkProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const pythonFunctionResolver_1 = __webpack_require__(34);
/** Matches {{fn:function_name}} (global function) and {{ft:function_name}} (flow function) references. */
const FUNCTION_TAG_PATTERN = /\{\{(fn|ft):(\w+)\}\}/g;
/** Matches {{attr:attribute_name}} references, which resolve to config/variant_attributes.yaml. */
const ATTR_TAG_PATTERN = /\{\{attr:(\w+)\}\}/g;
/**
 * Finds all {{fn:X}} / {{ft:X}} references on a single line.
 */
function findFunctionTagsOnLine(lineText, lineNumber) {
    const matches = [];
    FUNCTION_TAG_PATTERN.lastIndex = 0;
    let match;
    while ((match = FUNCTION_TAG_PATTERN.exec(lineText)) !== null) {
        const kind = match[1];
        const functionName = match[2];
        // "{{" + kind ("fn"/"ft") + ":" always precedes the name — compute the offset
        // analytically rather than searching for the name text, which can falsely match
        // inside the prefix itself (e.g. name "n" inside "{{fn:n}}").
        const nameStart = match.index + 2 + kind.length + 1;
        matches.push({
            kind,
            functionName,
            range: new vscode.Range(new vscode.Position(lineNumber, nameStart), new vscode.Position(lineNumber, nameStart + functionName.length)),
        });
    }
    return matches;
}
/**
 * Resolves a {{fn:X}} / {{ft:X}} reference to its function file path.
 */
function resolveFunctionTag(kind, functionName, filePath) {
    return kind === 'fn'
        ? pythonFunctionResolver_1.PythonFunctionResolver.resolveConvFunctionPath(functionName, filePath)
        : pythonFunctionResolver_1.PythonFunctionResolver.resolveFlowFunctionPath(functionName, filePath);
}
/** Finds all {{attr:X}} references on a single line. */
function findAttrTagsOnLine(lineText, lineNumber) {
    const matches = [];
    ATTR_TAG_PATTERN.lastIndex = 0;
    let match;
    while ((match = ATTR_TAG_PATTERN.exec(lineText)) !== null) {
        const attrName = match[1];
        // "{{attr:" is always 7 chars — compute the offset analytically rather than searching
        // for the name text, which can falsely match inside the prefix (e.g. name "attr" inside "{{attr:attr}}").
        const nameStart = match.index + '{{attr:'.length;
        matches.push({
            attrName,
            range: new vscode.Range(new vscode.Position(lineNumber, nameStart), new vscode.Position(lineNumber, nameStart + attrName.length)),
        });
    }
    return matches;
}
/**
 * Document link provider for {{fn:X}} / {{ft:X}} references in YAML files.
 * Mirrors PythonFunctionLinkProvider so Cmd/Ctrl-click navigates straight to the function file.
 */
class YamlFunctionLinkProvider {
    provideDocumentLinks(document, _token) {
        const links = [];
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
exports.YamlFunctionLinkProvider = YamlFunctionLinkProvider;
/**
 * Hover provider for {{fn:X}} / {{ft:X}} references in YAML files.
 * Shows the resolved function's description and parameters, reusing the same
 * @func_description / @func_parameter extraction used for Python conv/flow.functions hovers.
 */
class YamlFunctionHoverProvider {
    provideHover(document, position, _token) {
        const lineText = document.lineAt(position).text;
        if (!lineText.includes('{{fn:') && !lineText.includes('{{ft:')) {
            return undefined;
        }
        const tag = findFunctionTagsOnLine(lineText, position.line).find(t => position.character >= t.range.start.character && position.character <= t.range.end.character);
        if (!tag) {
            return undefined;
        }
        const functionPath = resolveFunctionTag(tag.kind, tag.functionName, document.uri.fsPath);
        if (!functionPath) {
            return undefined;
        }
        const description = pythonFunctionResolver_1.PythonFunctionResolver.getFunctionDescription(functionPath);
        const parameters = pythonFunctionResolver_1.PythonFunctionResolver.getFunctionParameters(functionPath);
        const functionType = tag.kind === 'fn' ? 'Global function' : 'Flow function';
        const hoverText = new vscode.MarkdownString();
        hoverText.appendMarkdown(`**${functionType}**: \`${tag.functionName}\``);
        if (description) {
            hoverText.appendMarkdown(`\n\n${description}`);
        }
        if (parameters.length > 0) {
            hoverText.appendMarkdown(`\n\n**Parameters:**`);
            for (const param of parameters) {
                hoverText.appendMarkdown(param.description ? `\n- \`${param.name}\`: ${param.description}` : `\n- \`${param.name}\``);
            }
        }
        hoverText.appendMarkdown(`\n\n*${functionPath}*`);
        return new vscode.Hover(hoverText, tag.range);
    }
}
exports.YamlFunctionHoverProvider = YamlFunctionHoverProvider;
/**
 * Document link provider for {{attr:X}} references in YAML files.
 * {{attr:X}} resolves to the `- name: X` entry under `attributes:` in config/variant_attributes.yaml.
 */
class YamlAttrLinkProvider {
    provideDocumentLinks(document, _token) {
        const links = [];
        // Build the name -> location index once for the whole document, rather than re-reading
        // and re-scanning config/variant_attributes.yaml for every {{attr:X}} occurrence.
        let attributeIndex = null;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (!lineText.includes('{{attr:')) {
                continue;
            }
            attributeIndex ??= pythonFunctionResolver_1.PythonFunctionResolver.buildVariantAttributeIndex(document.uri.fsPath);
            for (const tag of findAttrTagsOnLine(lineText, i)) {
                const location = attributeIndex.get(tag.attrName);
                if (location) {
                    const target = vscode.Uri.file(location.filePath).with({ fragment: `${location.line + 1}` });
                    links.push(new vscode.DocumentLink(tag.range, target));
                }
            }
        }
        return links;
    }
}
exports.YamlAttrLinkProvider = YamlAttrLinkProvider;
/**
 * Hover provider for {{attr:X}} references in YAML files.
 * Shows where the attribute is defined in config/variant_attributes.yaml.
 */
class YamlAttrHoverProvider {
    provideHover(document, position, _token) {
        const lineText = document.lineAt(position).text;
        if (!lineText.includes('{{attr:')) {
            return undefined;
        }
        const tag = findAttrTagsOnLine(lineText, position.line).find(t => position.character >= t.range.start.character && position.character <= t.range.end.character);
        if (!tag) {
            return undefined;
        }
        const location = pythonFunctionResolver_1.PythonFunctionResolver.resolveVariantAttributeLocation(tag.attrName, document.uri.fsPath);
        if (!location) {
            return undefined;
        }
        const hoverText = new vscode.MarkdownString();
        hoverText.appendMarkdown(`**Variant attribute**: \`${tag.attrName}\``);
        hoverText.appendMarkdown(`\n\n*${location.filePath}:${location.line + 1}*`);
        return new vscode.Hover(hoverText, tag.range);
    }
}
exports.YamlAttrHoverProvider = YamlAttrHoverProvider;


/***/ }),
/* 113 */
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
const debug_1 = __webpack_require__(110);
const pythonRules_1 = __webpack_require__(114);
const yamlRules_1 = __webpack_require__(115);
const config_1 = __webpack_require__(116);
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
        (0, debug_1.debugLog)('Agent Development Kit Linter activated');
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
/* 114 */
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
/* 115 */
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
const functionPathResolver_1 = __webpack_require__(35);
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
    // {{fn:X}} / {{ft:X}} / {{attr:X}} references are valid in any YAML file (steps, topics, etc.)
    diagnostics.push(...checkFunctionTagReferences(lines, filePath, options));
    diagnostics.push(...checkAttrTagReferences(lines, filePath, options));
    return diagnostics;
}
/** Matches {{fn:function_name}} (global function) and {{ft:function_name}} (flow function) references. */
const FUNCTION_TAG_PATTERN = /\{\{(fn|ft):(\w+)\}\}/g;
/** Matches {{attr:attribute_name}} references, which resolve to config/variant_attributes.yaml. */
const ATTR_TAG_PATTERN = /\{\{attr:(\w+)\}\}/g;
/**
 * True if the line is entirely a YAML comment (ignoring leading whitespace).
 * Used to skip commented-out {{fn:}}/{{ft:}}/{{attr:}} references, which aren't live config.
 */
function isFullLineComment(line) {
    return line.trim().startsWith('#');
}
/**
 * Rule: invalid-function-tag
 * {{fn:X}} must resolve to a global function file (functions/X.py), and
 * {{ft:X}} must resolve to a flow-local function file (flows/<flow>/functions/X.py).
 */
function checkFunctionTagReferences(lines, filePath, options) {
    const diagnostics = [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line.includes('{{fn:') && !line.includes('{{ft:')) {
            continue;
        }
        if (isFullLineComment(line)) {
            continue;
        }
        FUNCTION_TAG_PATTERN.lastIndex = 0;
        let match;
        while ((match = FUNCTION_TAG_PATTERN.exec(line)) !== null) {
            const kind = match[1];
            const functionName = match[2];
            const resolved = kind === 'fn'
                ? (options?.knownGlobalFunctions
                    ? options.knownGlobalFunctions.includes(functionName)
                    : functionPathResolver_1.FunctionPathResolver.resolveConvFunctionPath(functionName, filePath) !== null)
                : (options?.knownFlowFunctions
                    ? options.knownFlowFunctions.includes(functionName)
                    : functionPathResolver_1.FunctionPathResolver.resolveFlowFunctionPath(functionName, filePath) !== null);
            if (!resolved) {
                const expectedLocation = kind === 'fn'
                    ? 'functions/'
                    : 'flows/<flow_name>/functions/';
                diagnostics.push({
                    line: lineIndex,
                    startChar: match.index,
                    endChar: match.index + match[0].length,
                    message: `{{${kind}:${functionName}}} does not resolve to a function. Expected a file at ${expectedLocation}${functionName}.py.`,
                    severity: 'error',
                    code: 'invalid-function-tag'
                });
            }
        }
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
 * Rule: invalid-attr-tag
 * {{attr:X}} must resolve to a `- name: X` entry under `attributes:` in config/variant_attributes.yaml.
 */
function checkAttrTagReferences(lines, filePath, options) {
    const diagnostics = [];
    const hasAttrTag = lines.some(line => line.includes('{{attr:'));
    if (!hasAttrTag) {
        return diagnostics;
    }
    const attributeNames = options?.knownAttributeNames
        ? new Set(options.knownAttributeNames)
        : functionPathResolver_1.FunctionPathResolver.findVariantAttributeNames(filePath);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line.includes('{{attr:')) {
            continue;
        }
        if (isFullLineComment(line)) {
            continue;
        }
        ATTR_TAG_PATTERN.lastIndex = 0;
        let match;
        while ((match = ATTR_TAG_PATTERN.exec(line)) !== null) {
            const attrName = match[1];
            if (!attributeNames.has(attrName)) {
                diagnostics.push({
                    line: lineIndex,
                    startChar: match.index,
                    endChar: match.index + match[0].length,
                    message: `{{attr:${attrName}}} does not resolve to an attribute in config/variant_attributes.yaml.`,
                    severity: 'error',
                    code: 'invalid-attr-tag'
                });
            }
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
/* 116 */
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