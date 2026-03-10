import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore - js-yaml types may not be available
import * as yaml from 'js-yaml';

const execAsync = promisify(exec);

/**
 * Gets the current git branch name
 */
export async function getCurrentBranch(workspaceRoot: string): Promise<string> {
	try {
		const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
			cwd: workspaceRoot
		});
		return stdout.trim();
	} catch (error) {
		throw new Error('Failed to get current branch. Make sure you are in a git repository.');
	}
}

/**
 * Gets the diff between the current branch and the base branch (usually main/master)
 */
export async function getBranchDiff(
	workspaceRoot: string,
	branch: string,
	baseBranch: string = 'main'
): Promise<string> {
	try {
		// Try to get diff with main first, fallback to master
		let diff = '';
		try {
			const { stdout } = await execAsync(`git diff ${baseBranch}...${branch}`, {
				cwd: workspaceRoot,
				maxBuffer: 10 * 1024 * 1024 // 10MB buffer
			});
			diff = stdout;
		} catch {
			// Try with master if main doesn't exist
			if (baseBranch === 'main') {
				const { stdout } = await execAsync(`git diff master...${branch}`, {
					cwd: workspaceRoot,
					maxBuffer: 10 * 1024 * 1024
				});
				diff = stdout;
			} else {
				throw new Error('Failed to get diff');
			}
		}
		return diff;
	} catch (error) {
		throw new Error('Failed to get branch diff. Make sure the base branch exists.');
	}
}

/**
 * Gets the list of changed files in the current branch
 */
export async function getChangedFiles(
	workspaceRoot: string,
	branch: string,
	baseBranch: string = 'main'
): Promise<string[]> {
	try {
		let files: string[] = [];
		try {
			const { stdout } = await execAsync(`git diff --name-only ${baseBranch}...${branch}`, {
				cwd: workspaceRoot
			});
			files = stdout.trim().split('\n').filter(f => f.length > 0);
		} catch {
			// Try with master if main doesn't exist
			if (baseBranch === 'main') {
				const { stdout } = await execAsync(`git diff --name-only master...${branch}`, {
					cwd: workspaceRoot
				});
				files = stdout.trim().split('\n').filter(f => f.length > 0);
			} else {
				throw new Error('Failed to get changed files');
			}
		}
		return files;
	} catch (error) {
		throw new Error('Failed to get changed files');
	}
}

/**
 * Result of directory detection
 */
export interface DirectoryInfo {
	accountDir: string | null;  // Account directory (e.g., "goodyear-us")
	projectDir: string | null;  // Project directory path: "account/project" (e.g., "goodyear-us/goodyear-service-usp")
}

/**
 * Finds all project.yaml files in the workspaces
 */
function findAllProjectYamlFiles(workspaceRoot: string): string[] {
	const projectYamlFiles: string[] = [];
	
	function searchDirectory(dir: string, depth: number = 0, maxDepth: number = 5) {
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
				} else if (entry.isFile() && entry.name === 'project.yaml') {
					// Found a project.yaml file
					const relativePath = path.relative(workspaceRoot, fullPath);
					projectYamlFiles.push(relativePath);
				}
			}
		} catch (error) {
			// Skip directories we can't read
		}
	}
	
	searchDirectory(workspaceRoot);
	return projectYamlFiles;
}

/**
 * Checks if a changed file is in the same directory or a subdirectory of a project.yaml file
 */
function isFileInProjectDirectory(changedFile: string, projectYamlPath: string): boolean {
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
export function getProjectDirectory(changedFiles: string[], workspaceRoot: string): DirectoryInfo {
	const accountDirs = new Set<string>();
	const projectDirs = new Set<string>();
	
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
export function formatDiffForJira(diff: string, maxLength: number = 15000): string {
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
export function getProjectName(workspaceRoot: string, accountDir: string, projectDirName: string): string | null {
	try {
		const projectYamlPath = path.join(workspaceRoot, accountDir, projectDirName, 'project.yaml');
		if (!fs.existsSync(projectYamlPath)) {
			return null;
		}
		
		const content = fs.readFileSync(projectYamlPath, 'utf8');
		const projectData = yaml.load(content) as any;
		
		// Try common field names for project name
		return projectData?.name || projectData?.project_name || projectData?.projectName || null;
	} catch (error) {
		// If parsing fails, return null
		return null;
	}
}

/**
 * Creates a summary from the branch name and changed files
 */
export function createSummaryFromBranch(branch: string, changedFiles: string[]): string {
	const fileCount = changedFiles.length;
	const summary = `Changes from branch: ${branch}`;
	return summary;
}

