![PolyAI](logo.png)

# Agent Development Kit Extension

[![VS Code Version](https://img.shields.io/badge/VS%20Code-%3E%3D1.105.0-blue)](https://code.visualstudio.com/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)

A Visual Studio Code extension for [Agent Development Kit](https://github.com/polyai/adk-extension) projects. Visualize ADK flow directories as interactive graphs, edit flow steps, functions, and transitions with an intuitive visual interface.

## Prerequisites

You must have access to a workspace in PolyAI Agent Studio before using this extension. Access is provided by your PolyAI contact. To request access to the PolyAI platform, reach out to [platform-support@poly-ai.com](mailto:platform-support@poly-ai.com).

## Installation

### From Marketplace (Recommended)

1. Open VS Code or Cursor
2. Go to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Agent Development Kit"
4. Click **Install**

Or install from the command line:

```bash
# VS Code
code --install-extension PolyAI.adk-extension

# Cursor
cursor --install-extension PolyAI.adk-extension
```

### Manual Installation (VSIX)

Download the latest `adk-extension-*.vsix` file from the [GitHub Releases](https://github.com/polyai/adk-extension/releases) page.

**VS Code:**

1. Go to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Click the `...` menu and select "Install from VSIX..."
3. Select the downloaded `.vsix` file
4. Reload the editor when prompted

**Cursor:**

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Install from VSIX" and select **Extensions: Install from VSIX...**
3. Select the downloaded `.vsix` file
4. Reload the editor when prompted

**Command line:**

```bash
# VS Code
code --install-extension adk-extension-*.vsix

# Cursor
cursor --install-extension adk-extension-*.vsix
```

## Features

### Interactive Flow Visualization

- **Graph-based visualization** - View your flow as an interactive graph with nodes representing steps, functions, and endpoints
- **Visual navigation** - Click nodes to view details, drag to reposition, and zoom/pan to explore large flows
- **Connection mapping** - See how steps connect through functions and transitions

### In-Place Editing

- **Edit prompts** - Double-click any step's prompt to edit it directly in the viewer
- **ASR Biasing configuration** - Configure Automatic Speech Recognition biasing settings
- **DTMF configuration** - Set up Dual-Tone Multi-Frequency settings including timeouts, max digits, and end keys
- **Function integration** - Add function references (`{{fn:functionName}}` or `{{ft:functionName}}`) using the function picker

### Change Management

- **Modified nodes sidebar** - Track all nodes with unsaved changes in a collapsible sidebar
- **Save All / Discard All** - Bulk operations to save or discard all changes at once
- **Visual indicators** - Modified nodes are highlighted and tracked in the sidebar

### Python Language Features

- **Go to Definition** - Click on `conv.functions.functionName` or `flow.functions.functionName` to jump to the function definition
- **Go to Step** - Cmd+Click on step names in `flow.goto_step("Step Name")` to navigate directly to the step YAML file
- **Find All References** - Find all places where a function is called across your workspace
- **Hover Information** - See function descriptions, parameters, and file paths in tooltips
- **Runtime Descriptions** - Hover over `conv.*` and `flow.*` attributes (e.g. `conv.say`, `conv.state`, `flow.goto_step`) to see descriptions, signatures, and parameter info from the runtime
- **Autocomplete** - Type `conv.` or `flow.` to get autocomplete suggestions for all available attributes and methods with descriptions and parameter snippets

### ADK Linter

- **Real-time diagnostics** - Get instant feedback on coding standards as you type
- **Python rules** - Validates function structure, decorators, imports, and common anti-patterns
- **YAML rules** - Checks flow configs, steps, and topics for required fields and best practices
- **Configurable** - Disable specific rules per-project using a `.adkrc` config file
- **CI/CD CLI** - Run `adk-lint` from the command line to enforce standards in your build pipeline

See [Linter Documentation](src/linter/README.md) for full rule reference and CLI usage.

## Usage

### Opening a Flow

```
ADK: View Flow    # From command palette (Ctrl+Shift+P / Cmd+Shift+P)
```

Or right-click on a flow directory in the Explorer and select "View Flow".

### Creating a Flow

```
ADK: Create New Flow    # From command palette (Ctrl+Shift+P / Cmd+Shift+P)
```

Or right-click on a folder in the Explorer (e.g. your `flows` directory) and select "ADK: Create New Flow". Enter a name for the flow; the extension creates a new flow directory with `flow_config.yaml` and an initial step, then opens the flow viewer.

### Commands

| Command | Description |
|---------|-------------|
| `ADK: View Flow` | Open the flow viewer for a selected flow directory |
| `ADK: Create New Flow` | Create a new flow directory with config and initial step, then open the flow viewer |
| `ADK: Toggle Debug Mode` | Enable or disable debug logging |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Close the details panel |
| `Double-click node` | Focus and zoom to a node |
| `Drag nodes` | Reposition nodes in the graph |
| `F12` | Go to function definition |
| `Shift+F12` | Find all references |

## Project Structure

The extension expects the following directory structure for ADK projects:

```
flow-directory/
├── flow_config.yaml      # Flow configuration
├── steps/                # Step definitions
│   ├── step1.yaml
│   ├── step2.yaml
│   └── ...
└── functions/            # Flow-specific functions (optional)
    ├── function1.py
    └── ...
```

## Development Setup

### Prerequisites

- Node.js 16 or higher
- Yarn package manager
- VS Code or Cursor

### Getting Started

```bash
git clone https://github.com/polyai/adk-extension.git
cd adk-extension
yarn install
yarn compile
```

Press `F5` in VS Code to launch the Extension Development Host for testing.

### Project Structure

```
src/
├── extension.ts              # Main extension entry point
├── cli.ts                    # CLI entry point for adk-lint
├── flowParser.ts             # Flow parsing logic
├── flowViewer.html           # Webview UI
├── pythonFunctionResolver.ts # Python function resolution
├── pythonLanguageFeatures.ts # Language feature providers
├── linter/                   # Linter implementation
│   ├── index.ts
│   ├── config.ts
│   └── rules/
├── utils/                    # Utility functions
└── webview/                  # Webview handlers
```

## Bugs & Feature Requests

Please report bugs or request features via the [GitHub Issues](https://github.com/polyai/adk-extension/issues) page.

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork and clone** the repository
2. **Install dependencies**: `yarn install`
3. **Create a branch** for your feature or fix
4. **Test thoroughly** in the Extension Development Host (`F5`)

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning with [semantic-release](https://github.com/semantic-release/semantic-release).

**PR Title Format:** `<type>(<optional scope>): <description>`

| Type | Release | Description |
|------|---------|-------------|
| `feat` | Minor | New feature |
| `fix` | Patch | Bug fix |
| `perf` | Patch | Performance improvement |
| `feat!` or `fix!` | Major | Breaking change (add `!` after type) |
| `docs` | None | Documentation only |
| `style` | None | Code style changes |
| `refactor` | None | Code refactoring |
| `test` | None | Adding/updating tests |
| `chore` | None | Maintenance tasks |

**Examples:**
- `feat: add entity management` → Minor release (1.0.0 → 1.1.0)
- `fix: resolve flow parsing error` → Patch release (1.0.0 → 1.0.1)
- `feat!: redesign step editor API` → Major release (1.0.0 → 2.0.0)

### Release Process

When commits are pushed to `main`, [semantic-release](https://github.com/semantic-release/semantic-release) automatically:

1. Analyzes commit messages to determine the release type
2. Updates the version in `package.json`
3. Generates/updates `CHANGELOG.md`
4. Creates a GitHub release with the VSIX file
5. Publishes the extension to the VS Code Marketplace

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
