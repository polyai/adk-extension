#!/usr/bin/env node

/**
 * ADK Linter CLI
 * 
 * A command-line interface for running Agent Development Kit lint rules.
 * Can be used in CI/CD pipelines to enforce coding standards.
 * 
 * Usage:
 *   adk-lint [options] <paths...>
 * 
 * Options:
 *   --format, -f    Output format: 'text' (default) or 'json'
 *   --quiet, -q     Only output errors (suppress warnings and info)
 *   --help, -h      Show this help message
 * 
 * Exit codes:
 *   0 - No errors found
 *   1 - One or more errors found
 *   2 - Invalid arguments or runtime error
 */

import * as fs from 'fs';
import * as path from 'path';
import { checkPythonFile, PythonDiagnostic } from './linter/rules/pythonRules';
import { checkYamlFile, YamlDiagnostic } from './linter/rules/yamlRules';
import { findAdkConfig, AdkConfig } from './linter/config';

type Diagnostic = PythonDiagnostic | YamlDiagnostic;

interface LintResult {
	file: string;
	diagnostics: Diagnostic[];
}

interface CliOptions {
	format: 'text' | 'json';
	quiet: boolean;
	paths: string[];
}

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	gray: '\x1b[90m',
	bold: '\x1b[1m',
};

// Check if output supports colors
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;

function colorize(text: string, color: keyof typeof colors): string {
	if (!supportsColor) return text;
	return `${colors[color]}${text}${colors.reset}`;
}

function parseArgs(args: string[]): CliOptions {
	const options: CliOptions = {
		format: 'text',
		quiet: false,
		paths: [],
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		
		if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		} else if (arg === '--format' || arg === '-f') {
			const format = args[++i];
			if (format !== 'text' && format !== 'json') {
				console.error(`Invalid format: ${format}. Use 'text' or 'json'.`);
				process.exit(2);
			}
			options.format = format;
		} else if (arg === '--quiet' || arg === '-q') {
			options.quiet = true;
		} else if (arg.startsWith('-')) {
			console.error(`Unknown option: ${arg}`);
			printHelp();
			process.exit(2);
		} else {
			options.paths.push(arg);
		}
	}

	if (options.paths.length === 0) {
		options.paths.push('.');
	}

	return options;
}

function printHelp(): void {
	console.log(`
${colorize('ADK Linter', 'bold')} - Agent Development Kit lint rules for CI/CD

${colorize('Usage:', 'bold')}
  adk-lint [options] <paths...>

${colorize('Options:', 'bold')}
  --format, -f <format>   Output format: 'text' (default) or 'json'
  --quiet, -q             Only report errors (suppress warnings and info)
  --help, -h              Show this help message

${colorize('Examples:', 'bold')}
  adk-lint .                           Lint current directory
  adk-lint src/functions/              Lint specific directory
  adk-lint file1.py file2.yaml         Lint specific files
  adk-lint --format json .             Output results as JSON
  adk-lint --quiet .                   Only show errors

${colorize('Exit Codes:', 'bold')}
  0  No errors found
  1  One or more errors found
  2  Invalid arguments or runtime error

${colorize('Configuration:', 'bold')}
  Place a .adkrc file in your project to disable specific rules:
  
  {
    "disabled": ["rule-code-1", "rule-code-2"]
  }
`);
}

/**
 * Recursively finds all lintable files in a directory
 */
function findFiles(dir: string, files: string[] = []): string[] {
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		// Skip hidden files/directories and common non-source directories
		if (entry.name.startsWith('.') || 
		    entry.name === 'node_modules' || 
		    entry.name === '__pycache__' ||
		    entry.name === 'venv' ||
		    entry.name === '.venv') {
			continue;
		}

		if (entry.isDirectory()) {
			findFiles(fullPath, files);
		} else if (entry.isFile()) {
			if (entry.name.endsWith('.py') || 
			    entry.name.endsWith('.yaml') || 
			    entry.name.endsWith('.yml')) {
				files.push(fullPath);
			}
		}
	}

	return files;
}

/**
 * Checks if a file is in a relevant Agent Studio directory
 */
function isAgentStudioFile(filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, '/');
	return (
		normalizedPath.includes('/functions/') ||
		normalizedPath.includes('/flows/') ||
		normalizedPath.includes('/topics/') ||
		normalizedPath.includes('/agent_settings/')
	);
}

/**
 * Lints a single file
 */
function lintFile(filePath: string, config: AdkConfig): Diagnostic[] {
	const absolutePath = path.resolve(filePath);
	
	// Skip files not in Agent Studio directories
	if (!isAgentStudioFile(absolutePath)) {
		return [];
	}

	let text: string;
	try {
		text = fs.readFileSync(absolutePath, 'utf8');
	} catch (e) {
		console.error(`Error reading file: ${filePath}`);
		return [];
	}

	let diagnostics: Diagnostic[] = [];

	if (filePath.endsWith('.py')) {
		diagnostics = checkPythonFile(text, absolutePath);
	} else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
		diagnostics = checkYamlFile(text, absolutePath);
	}

	// Filter out disabled rules
	if (config.disabledRules.length > 0) {
		diagnostics = diagnostics.filter(d => !config.disabledRules.includes(d.code));
	}

	return diagnostics;
}

/**
 * Formats a diagnostic for text output
 */
function formatDiagnostic(file: string, diagnostic: Diagnostic): string {
	const severity = diagnostic.severity;
	const severityColor = severity === 'error' ? 'red' : severity === 'warning' ? 'yellow' : 'blue';
	const severityLabel = colorize(severity.toUpperCase().padEnd(7), severityColor);
	const location = colorize(`${file}:${diagnostic.line + 1}:${diagnostic.startChar + 1}`, 'gray');
	const code = colorize(`[${diagnostic.code}]`, 'gray');
	
	return `${severityLabel} ${location} ${diagnostic.message} ${code}`;
}

/**
 * Prints summary statistics
 */
function printSummary(results: LintResult[], options: CliOptions): void {
	let errors = 0;
	let warnings = 0;
	let infos = 0;

	for (const result of results) {
		for (const d of result.diagnostics) {
			if (d.severity === 'error') errors++;
			else if (d.severity === 'warning') warnings++;
			else infos++;
		}
	}

	const total = errors + warnings + infos;
	if (total === 0) {
		console.log(colorize('\n✓ No issues found', 'bold'));
		return;
	}

	const parts: string[] = [];
	if (errors > 0) parts.push(colorize(`${errors} error${errors !== 1 ? 's' : ''}`, 'red'));
	if (!options.quiet) {
		if (warnings > 0) parts.push(colorize(`${warnings} warning${warnings !== 1 ? 's' : ''}`, 'yellow'));
		if (infos > 0) parts.push(colorize(`${infos} info`, 'blue'));
	}

	console.log(`\n${colorize('Found:', 'bold')} ${parts.join(', ')}`);
}

/**
 * Main CLI entry point
 */
function main(): void {
	const args = process.argv.slice(2);
	const options = parseArgs(args);

	const results: LintResult[] = [];
	let hasErrors = false;

	// Collect all files to lint
	const filesToLint: string[] = [];

	for (const inputPath of options.paths) {
		const resolvedPath = path.resolve(inputPath);
		
		if (!fs.existsSync(resolvedPath)) {
			console.error(`Path not found: ${inputPath}`);
			process.exit(2);
		}

		const stat = fs.statSync(resolvedPath);
		if (stat.isDirectory()) {
			filesToLint.push(...findFiles(resolvedPath));
		} else if (stat.isFile()) {
			filesToLint.push(resolvedPath);
		}
	}

	// Lint each file
	for (const file of filesToLint) {
		const config = findAdkConfig(file);
		const diagnostics = lintFile(file, config);

		if (diagnostics.length > 0) {
			// Filter based on quiet mode
			const filteredDiagnostics = options.quiet 
				? diagnostics.filter(d => d.severity === 'error')
				: diagnostics;

			if (filteredDiagnostics.length > 0) {
				results.push({ file, diagnostics: filteredDiagnostics });
			}

			// Check if any errors exist (regardless of quiet mode)
			if (diagnostics.some(d => d.severity === 'error')) {
				hasErrors = true;
			}
		}
	}

	// Output results
	if (options.format === 'json') {
		const jsonOutput = {
			success: !hasErrors,
			results: results.map(r => ({
				file: r.file,
				diagnostics: r.diagnostics.map(d => ({
					line: d.line + 1,
					column: d.startChar + 1,
					severity: d.severity,
					code: d.code,
					message: d.message,
				})),
			})),
			summary: {
				files: filesToLint.length,
				errors: results.reduce((sum, r) => sum + r.diagnostics.filter(d => d.severity === 'error').length, 0),
				warnings: results.reduce((sum, r) => sum + r.diagnostics.filter(d => d.severity === 'warning').length, 0),
				infos: results.reduce((sum, r) => sum + r.diagnostics.filter(d => d.severity === 'info').length, 0),
			},
		};
		console.log(JSON.stringify(jsonOutput, null, 2));
	} else {
		// Text format
		for (const result of results) {
			for (const diagnostic of result.diagnostics) {
				console.log(formatDiagnostic(result.file, diagnostic));
			}
		}
		printSummary(results, options);
	}

	// Exit with appropriate code
	process.exit(hasErrors ? 1 : 0);
}

// Run CLI
main();

