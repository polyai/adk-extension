## 1.0.0 (2026-03-10)

### Features

* Remove poly ai ldn ([#4](https://github.com/polyai/adk-extension/issues/4)) ([d6c17f3](https://github.com/polyai/adk-extension/commit/d6c17f3245450e017bb3696ca00ef9fb2dfeee8e))
* Remove vsix ([#2](https://github.com/polyai/adk-extension/issues/2)) ([d5f7ee5](https://github.com/polyai/adk-extension/commit/d5f7ee59154a6379328f2aa8d2f839476fac06b1))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.21](https://github.com/polyai/adk-extension/compare/v1.0.17...v1.0.21) (2024)

### Features

- Renamed from Local Agent Studio (LAS) to Agent Deployment Kit (ADK)
- Added Apache 2.0 license
- Improved CI/CD with semantic-release
- test

## [1.0.17](https://github.com/polyai/adk-extension/compare/v1.0.10...v1.0.17) (2024)

### Features

- **No Code Steps Support**: Full support for `default_step` type steps with visual editing
  - Parse and display conditions and transitions from No Code Steps
  - Manage extracted entities - add/remove from available project entities
  - Create and edit conditions (Go to Step / Exit Flow) with LLM labels, descriptions, and required entities
  - Condition transitions displayed with distinct yellow/amber styling in the flow graph
- **Entities Management**: View and edit entities defined in `config/entities.yaml`
  - Add new entities with name, type, and description
  - Edit existing entity properties
  - Delete entities with confirmation
- **Step Management**: Create and delete flow steps directly from the UI
  - Add new steps via buttons in the flow viewer (Step, Function Step, Advanced Step)
  - Function steps auto-generate Python templates with proper imports and signatures
  - Delete steps with confirmation dialog
  - Step filenames automatically converted to snake_case while preserving display names
- **Condition-based Transitions**: Visual distinction for condition edges in the flow graph
  - Condition transition labels styled in amber/yellow for easy identification
  - Edges correctly created when conditions reference other steps

## [1.0.10](https://github.com/polyai/adk-extension/compare/v1.0.9...v1.0.10) (2024)

### Bug Fixes

- Fix bug with multiple transitions

## [1.0.9](https://github.com/polyai/adk-extension/compare/v1.0.8...v1.0.9) (2024)

### Features

- Remove 24h check for auto updates

## [1.0.8](https://github.com/polyai/adk-extension/compare/v1.0.6...v1.0.8) (2024)

### Features

- **JIRA Integration**: Create JIRA tickets directly from your git branch changes
  - Automatically detects project and account directories based on `project.yaml` files
  - Dropdown selection for JIRA projects and components
  - Automatic PR description updates with JIRA ticket links
  - Project/component mapping caching per project directory
  - Automatic ticket assignment to the current user

## [1.0.6](https://github.com/polyai/adk-extension/compare/v1.0.1...v1.0.6) (2024)

### Features

- Python language features (Go to Definition, Find All References, and Hover for `conv.functions` and `flow.functions`)
- Find All References: Find all places where functions are called across your workspace
- Precise targeting: Only clicking on the function name (not `conv`, `flow`, or `functions`) triggers navigation
- Optimized performance for reference searching
- Automatic and manual update checking
- Debug mode toggle
- Enhanced function resolution
- Improved error handling and logging

## [1.0.1](https://github.com/polyai/adk-extension/compare/v0.0.1...v1.0.1) (2024)

### Features

- Enhanced flow visualization
- Improved change management
- Better error handling

## [0.0.1](https://github.com/polyai/adk-extension/releases/tag/v0.0.1) (2024)

### Features

- Initial release of Agent Deployment Kit Extension
- Interactive flow graph visualization
- Step editing capabilities
- ASR and DTMF configuration
- Modified nodes tracking
- Save/discard functionality
- Function reference support
