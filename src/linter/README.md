# Agent Deployment Kit Linter

Real-time diagnostics for Agent Deployment Kit projects based on the cursor rules defined in `agent-deployments/.cursor/rules/`.

## Python Rules

Rules applied to `.py` files in `functions/` directories.

| Rule Code | Severity | Description |
|-----------|----------|-------------|
| `missing-imports-star` | Error | File must contain `from imports import *  # <AUTO GENERATED>` |
| `manual-poly-import` | Error | Don't import from `poly_platform` directly; use `from imports import *` |
| `function-name-mismatch` | Error | Main function name must match the filename (e.g., `foo.py` must have `def foo(...)`) |
| `decorated-helper-function` | Error | Only the main function should have `@func_description`/`@func_parameter` decorators; decorating helpers crashes imports |
| `missing-func-description` | Error | Main function must have `@func_description()` decorator |
| `missing-func-parameter` | Warning | Parameters (except `conv` and `flow`) should have `@func_parameter()` decorator |
| `silent-error-swallowing` | Info | `try/except` with only `pass` or `print` is not proper error handling |
| `plog-usage` | Warning | Use `conv.log` instead of `plog` for logging (e.g., `conv.log.info("message", is_pii=False)`) |
| `flow-function-missing-flow-param` | Error | Flow functions (in `flows/*/functions/`) must have `flow: Flow` parameter |
| `flow-function-missing-conv-param` | Error | Flow functions must have `conv: Conversation` parameter |
| `return-conv-say` | Error | Don't `return conv.say(...)`; call it for side effects then return separately |
| `exit-flow-before-transition` | Warning | Don't combine `conv.exit_flow()` with `transition()` or `goto_flow()`; the transition handles routing |

### Exceptions

The following special lifecycle functions are exempt from decorator requirements:
- `start_function.py`
- `end_function.py`

## YAML Rules

### Flow Config Rules

Rules applied to `flow_config.yaml` files.

| Rule Code | Severity | Description |
|-----------|----------|-------------|
| `empty-flow-config` | Error | flow_config.yaml must not be empty |
| `flow-config-missing-name` | Error | Must have `name` field |
| `flow-config-missing-description` | Error | Must have non-empty `description` field |
| `flow-config-missing-start-step` | Error | Must have `start_step` field |
| `invalid-start-step` | Error | `start_step` must reference an existing step in the `steps/` directory |

### Step Rules

Rules applied to step files in `flows/*/steps/`.

| Rule Code | Severity | Description |
|-----------|----------|-------------|
| `step-missing-name` | Error | Step file must have `name` field |
| `conv-state-in-prompt` | Error | Use `$variable` notation in prompts, not `conv.state.variable` |

### Topic Rules

Rules applied to topic files in `topics/`.

| Rule Code | Severity | Description |
|-----------|----------|-------------|
| `too-many-example-queries` | Info | Topics should have at most 10 `example_queries`; use diverse phrasings |
| `functions-outside-actions` | Warning | Function references (`{{fn:...}}` or `{{ft:...}}`) should only be in `actions` field, not `content` |
| `variables-outside-actions` | Warning | State variables (`$variable`) should only be in `actions` field, not `content` |
| `output-oriented-prompt` | Warning | Avoid `"Say: '...'"` patterns; use instructional prompts for multilingual support |

## Usage

The linter activates automatically for files in Agent Deployment Kit projects. Diagnostics appear in:
- The **Problems** panel (`Cmd+Shift+M`)
- Inline squiggles in the editor
- Hover tooltips on flagged code

## Configuration

The linter can be configured using a `.adkrc` file (or legacy `.lasrc`) placed in your project directory. The config file uses JSON format and is automatically detected when linting files in that directory or any subdirectory.

### Disabling Rules

Create a `.adkrc` file in your project root (or any parent directory) to disable specific rules:

**Option 1: Using `disabled` array**

```json
{
  "disabled": [
    "missing-func-parameter",
    "silent-error-swallowing",
    "plog-usage"
  ]
}
```

**Option 2: Using `rules` object**

```json
{
  "rules": {
    "missing-func-parameter": false,
    "silent-error-swallowing": false,
    "plog-usage": false
  }
}
```

### Configuration Precedence

The linter searches for `.adkrc` (or `.lasrc` for backwards compatibility) starting from the file's directory and walks up to the project root (identified by `imports.py` or `gen_decorators.py`). The first config file found is used.

### Example

Given this project structure:

```
my-agent/
├── .adkrc                 # Disables plog-usage globally
├── imports.py
├── functions/
│   ├── .adkrc             # Could disable additional rules for functions/
│   └── my_function.py
└── flows/
    └── service_flow/
        └── functions/
            └── flow_func.py
```

- `functions/my_function.py` uses `functions/.adkrc`
- `flows/service_flow/functions/flow_func.py` uses root `.adkrc`

### All Available Rule Codes

**Python Rules:**
- `missing-imports-star`
- `manual-poly-import`
- `function-name-mismatch`
- `decorated-helper-function`
- `missing-func-description`
- `missing-func-parameter`
- `silent-error-swallowing`
- `plog-usage`
- `flow-function-missing-flow-param`
- `flow-function-missing-conv-param`
- `return-conv-say`
- `exit-flow-before-transition`

**YAML Rules:**
- `empty-flow-config`
- `flow-config-missing-name`
- `flow-config-missing-description`
- `flow-config-missing-start-step`
- `invalid-start-step`
- `step-missing-name`
- `conv-state-in-prompt`
- `too-many-example-queries`
- `functions-outside-actions`
- `variables-outside-actions`
- `output-oriented-prompt`

## CLI Usage (CI/CD)

The linter can also be run from the command line for use in CI/CD pipelines.

### Installation

```bash
# Install globally
npm install -g adk-extension

# Or run directly with npx
npx adk-extension adk-lint <paths...>
```

### Usage

```bash
adk-lint [options] <paths...>
```

### Options

| Option | Description |
|--------|-------------|
| `--format, -f <format>` | Output format: `text` (default) or `json` |
| `--quiet, -q` | Only report errors (suppress warnings and info) |
| `--help, -h` | Show help message |

### Examples

```bash
# Lint current directory
adk-lint .

# Lint specific directory
adk-lint src/functions/

# Lint specific files
adk-lint file1.py file2.yaml

# Output as JSON (useful for CI/CD parsing)
adk-lint --format json .

# Only show errors (for strict CI/CD checks)
adk-lint --quiet .
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No errors found |
| 1 | One or more errors found |
| 2 | Invalid arguments or runtime error |

### CI/CD Integration

**GitHub Actions:**

```yaml
- name: Lint ADK code
  run: |
    npx adk-extension adk-lint --quiet .
```

**GitLab CI:**

```yaml
lint:
  script:
    - npx adk-extension adk-lint --quiet .
```

**JSON Output for Programmatic Parsing:**

```bash
adk-lint --format json . > lint-results.json
```

The JSON output includes:

```json
{
  "success": false,
  "results": [
    {
      "file": "/path/to/file.py",
      "diagnostics": [
        {
          "line": 10,
          "column": 1,
          "severity": "error",
          "code": "missing-func-description",
          "message": "Main function must have @func_description() decorator"
        }
      ]
    }
  ],
  "summary": {
    "files": 15,
    "errors": 2,
    "warnings": 5,
    "infos": 3
  }
}
```

