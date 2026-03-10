import * as path from 'path';
import * as fs from 'fs';

/**
 * Configuration loaded from .adkrc file
 */
export interface AdkConfig {
	disabledRules: string[];
}

// Alias for backwards compatibility
export type LasConfig = AdkConfig;

/**
 * Finds and parses .adkrc config file for a given file path
 * Searches from the file's directory up to the project root
 * Also supports legacy .lasrc files for backwards compatibility
 */
export function findAdkConfig(filePath: string): AdkConfig {
	const defaultConfig: AdkConfig = { disabledRules: [] };
	
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
					const disabled: string[] = [];
					for (const [rule, enabled] of Object.entries(config.rules)) {
						if (enabled === false) {
							disabled.push(rule);
						}
					}
					return { disabledRules: disabled };
				}
				
				return defaultConfig;
			} catch (e) {
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
export const findLasConfig = findAdkConfig;

/**
 * Finds the .adkrc config file path for a given file
 * Returns null if no config file is found
 * Also supports legacy .lasrc files for backwards compatibility
 */
export function findAdkConfigPath(filePath: string): string | null {
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
export const findLasConfigPath = findAdkConfigPath;

