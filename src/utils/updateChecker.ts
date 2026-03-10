import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

interface GitHubReleaseAsset {
	id: number;
	name: string;
	browser_download_url: string;
	content_type: string;
	size: number;
}

interface GitHubRelease {
	tag_name: string;
	name: string;
	html_url: string;
	published_at: string;
	body?: string;
	assets?: GitHubReleaseAsset[];
}

interface UpdateInfo {
	hasUpdate: boolean;
	currentVersion: string;
	latestVersion: string;
	releaseUrl?: string;
	releaseNotes?: string;
	vsixAssetId?: number;
	vsixAssetName?: string;
	owner?: string;
	repo?: string;
}

/**
 * Checks for updates from GitHub repository
 * @param owner GitHub repository owner
 * @param repo GitHub repository name
 * @param currentVersion Current extension version
 * @returns Update information or null if check failed
 */
export async function checkForUpdates(
	owner: string,
	repo: string,
	currentVersion: string
): Promise<UpdateInfo | null> {
	console.log(`[Update Checker] Starting update check for ${owner}/${repo}`);
	console.log(`[Update Checker] Current version: ${currentVersion}`);
	
	try {
		console.log(`[Update Checker] Fetching latest release from GitHub API...`);
		const latestRelease = await fetchLatestRelease(owner, repo);
		
		if (!latestRelease) {
			console.log(`[Update Checker] No releases found on GitHub`);
			return null;
		}

		console.log(`[Update Checker] Latest release found: ${latestRelease.tag_name}`);
		console.log(`[Update Checker] Release URL: ${latestRelease.html_url}`);
		console.log(`[Update Checker] Published at: ${latestRelease.published_at}`);

		// Find VSIX file in release assets
		const vsixAsset = latestRelease.assets?.find(asset => 
			asset.name.endsWith('.vsix')
		);
		
		if (vsixAsset) {
			console.log(`[Update Checker] Found VSIX file: ${vsixAsset.name} (Asset ID: ${vsixAsset.id}, ${(vsixAsset.size / 1024 / 1024).toFixed(2)} MB)`);
		} else {
			console.log(`[Update Checker] No VSIX file found in release assets`);
		}

		const latestVersion = normalizeVersion(latestRelease.tag_name);
		const currentVersionNormalized = normalizeVersion(currentVersion);

		console.log(`[Update Checker] Normalized versions - Current: ${currentVersionNormalized}, Latest: ${latestVersion}`);

		const hasUpdate = compareVersions(latestVersion, currentVersionNormalized) > 0;

		console.log(`[Update Checker] Update available: ${hasUpdate}`);

		const result = {
			hasUpdate,
			currentVersion,
			latestVersion: latestRelease.tag_name,
			releaseUrl: latestRelease.html_url,
			releaseNotes: latestRelease.body,
			vsixAssetId: vsixAsset?.id,
			vsixAssetName: vsixAsset?.name,
			owner: owner,
			repo: repo
		};

		console.log(`[Update Checker] Update check completed successfully`);
		return result;
	} catch (error) {
		console.error('[Update Checker] Error checking for updates:', error);
		return null;
	}
}

/**
 * Fetches the latest release from GitHub API
 */
function fetchLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
	return new Promise((resolve, reject) => {
		const apiPath = `/repos/${owner}/${repo}/releases/latest`;
		const apiUrl = `https://api.github.com${apiPath}`;
		
		// Get GitHub access token from environment variable
		const githubToken = process.env.GITHUB_ACCESS_TOKEN;
		
		if (!githubToken) {
			const error = new Error('GITHUB_ACCESS_TOKEN environment variable is required');
			console.error('[Update Checker]', error.message);
			reject(error);
			return;
		}
		
		console.log(`[Update Checker] Making request to GitHub API: ${apiUrl}`);
		console.log(`[Update Checker] Using authentication: Yes (token provided)`);
		
		const headers: { [key: string]: string } = {
			'User-Agent': 'adk-extension',
			'Accept': 'application/vnd.github.v3+json',
			'Authorization': `Bearer ${githubToken}`
		};
		
		const options = {
			hostname: 'api.github.com',
			path: apiPath,
			method: 'GET',
			headers: headers
		};

		const req = https.request(options, (res) => {
			console.log(`[Update Checker] GitHub API response status: ${res.statusCode}`);
			console.log(`[Update Checker] Response headers:`, res.headers);
			
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				console.log(`[Update Checker] Received ${data.length} bytes from GitHub API`);
				
				if (res.statusCode === 200) {
					try {
						const release = JSON.parse(data) as GitHubRelease;
						console.log(`[Update Checker] Successfully parsed release data`);
						resolve(release);
					} catch (error) {
						console.error(`[Update Checker] Failed to parse JSON response:`, error);
						console.error(`[Update Checker] Response data:`, data.substring(0, 500));
						reject(new Error('Failed to parse GitHub API response'));
					}
				} else if (res.statusCode === 404) {
					console.log(`[Update Checker] No releases found (404)`);
					// No releases found
					resolve(null);
				} else {
					console.error(`[Update Checker] GitHub API error: Status ${res.statusCode}`);
					console.error(`[Update Checker] Response body:`, data.substring(0, 500));
					reject(new Error(`GitHub API returned status ${res.statusCode}`));
				}
			});
		});

		req.on('error', (error) => {
			console.error(`[Update Checker] Network error during GitHub API request:`, error);
			reject(error);
		});

		req.setTimeout(10000, () => {
			console.error(`[Update Checker] Request timeout after 10 seconds`);
			req.destroy();
			reject(new Error('Request timeout'));
		});

		console.log(`[Update Checker] Sending HTTP request...`);
		req.end();
	});
}

/**
 * Normalizes version string by removing 'v' prefix and extracting semantic version
 */
function normalizeVersion(version: string): string {
	// Remove 'v' prefix if present
	const cleaned = version.replace(/^v/i, '');
	// Extract semantic version (e.g., "1.2.3" from "1.2.3" or "1.2.3-beta")
	const match = cleaned.match(/^(\d+\.\d+\.\d+)/);
	return match ? match[1] : cleaned;
}

/**
 * Compares two semantic versions
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
	const parts1 = v1.split('.').map(Number);
	const parts2 = v2.split('.').map(Number);

	for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
		const part1 = parts1[i] || 0;
		const part2 = parts2[i] || 0;

		if (part1 > part2) {
			return 1;
		}
		if (part1 < part2) {
			return -1;
		}
	}

	return 0;
}

/**
 * Shows update notification to user
 */
export async function notifyUpdate(updateInfo: UpdateInfo, extensionName: string, context: vscode.ExtensionContext): Promise<void> {
	const message = `A new version of ${extensionName} is available! (${updateInfo.latestVersion})`;
	const actions: string[] = [];
	
	if (updateInfo.vsixAssetId && updateInfo.owner && updateInfo.repo) {
		actions.push('Install Update');
	}
	actions.push('View Release', 'Dismiss');

	const action = await vscode.window.showInformationMessage(message, ...actions);

	if (action === 'Install Update' && updateInfo.vsixAssetId && updateInfo.owner && updateInfo.repo) {
		await installUpdate(updateInfo.vsixAssetId, updateInfo.owner, updateInfo.repo, updateInfo.vsixAssetName || 'extension.vsix', context);
	} else if (action === 'View Release' && updateInfo.releaseUrl) {
		vscode.env.openExternal(vscode.Uri.parse(updateInfo.releaseUrl));
	}
}

/**
 * Downloads and installs the VSIX file from the GitHub release
 */
async function installUpdate(assetId: number, owner: string, repo: string, assetName: string, context: vscode.ExtensionContext): Promise<void> {
	try {
		console.log(`[Update Checker] Starting installation of update - Asset ID: ${assetId}, Owner: ${owner}, Repo: ${repo}`);
		
		// Show progress
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Installing Extension Update',
				cancellable: false
			},
			async (progress) => {
				progress.report({ increment: 0, message: 'Downloading VSIX file...' });
				
				// Download VSIX file to temp directory
				const tempDir = context.globalStorageUri.fsPath;
				// Ensure temp directory exists
				if (!fs.existsSync(tempDir)) {
					fs.mkdirSync(tempDir, { recursive: true });
				}
				
				const vsixFileName = assetName || `adk-extension-update-${Date.now()}.vsix`;
				const vsixPath = path.join(tempDir, vsixFileName);
				
				console.log(`[Update Checker] Downloading asset ${assetId} to: ${vsixPath}`);
				
				await downloadAsset(assetId, owner, repo, vsixPath);
				
				progress.report({ increment: 50, message: 'Installing extension...' });
				
				console.log(`[Update Checker] Installing VSIX from: ${vsixPath}`);
				
				// Install the extension using VS Code's command
				// The command accepts a file URI
				await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(vsixPath));
				
				progress.report({ increment: 100, message: 'Installation complete!' });
				
				console.log(`[Update Checker] Installation completed successfully`);
				
				// Clean up the downloaded file after a short delay
				setTimeout(() => {
					try {
						if (fs.existsSync(vsixPath)) {
							fs.unlinkSync(vsixPath);
							console.log(`[Update Checker] Cleaned up temporary VSIX file`);
						}
					} catch (error) {
						console.error(`[Update Checker] Failed to clean up temporary file:`, error);
					}
				}, 5000);
				
				vscode.window.showInformationMessage(
					'Extension update installed successfully! Please reload VS Code to use the new version.',
					'Reload Now'
				).then(action => {
					if (action === 'Reload Now') {
						vscode.commands.executeCommand('workbench.action.reloadWindow');
					}
				});
			}
		);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[Update Checker] Failed to install update:`, error);
		vscode.window.showErrorMessage(`Failed to install update: ${errorMessage}`);
	}
}

/**
 * Downloads a release asset from GitHub using the asset ID
 */
function downloadAsset(assetId: number, owner: string, repo: string, filePath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		console.log(`[Update Checker] Downloading asset ${assetId} from ${owner}/${repo}`);
		
		const githubToken = process.env.GITHUB_ACCESS_TOKEN;
		if (!githubToken) {
			reject(new Error('GITHUB_ACCESS_TOKEN is required for downloading files'));
			return;
		}
		
		const apiPath = `/repos/${owner}/${repo}/releases/assets/${assetId}`;
		const apiUrl = `https://api.github.com${apiPath}`;
		
		console.log(`[Update Checker] Making request to GitHub API: ${apiUrl}`);
		
		const options = {
			hostname: 'api.github.com',
			path: apiPath,
			method: 'GET',
			headers: {
				'User-Agent': 'adk-extension',
				'Authorization': `Bearer ${githubToken}`,
				'Accept': 'application/octet-stream'
			}
		};
		
		const fileStream = fs.createWriteStream(filePath);
		
		const makeDownloadRequest = (downloadUrl: string) => {
			console.log(`[Update Checker] Making request to: ${downloadUrl}`);
			
			const urlObj = new URL(downloadUrl);
			const requestOptions = {
				hostname: urlObj.hostname,
				path: urlObj.pathname + urlObj.search,
				method: 'GET',
				headers: {
					'User-Agent': 'adk-extension',
					'Authorization': `Bearer ${githubToken}`,
					'Accept': 'application/octet-stream'
				}
			};
			
			const req = https.request(requestOptions, (res) => {
				console.log(`[Update Checker] Download response status: ${res.statusCode}`);
				console.log(`[Update Checker] Response headers:`, res.headers);
				
				// Handle redirect (302 Found, 301 Moved Permanently, 307 Temporary Redirect, 308 Permanent Redirect)
				if (res.statusCode === 302 || res.statusCode === 301 || res.statusCode === 307 || res.statusCode === 308) {
					const location = res.headers.location;
					if (location) {
						console.log(`[Update Checker] Redirect to: ${location}`);
						// Consume the response to free up the connection
						res.resume();
						// Follow the redirect (handle both absolute and relative URLs)
						const redirectUrl = location.startsWith('http') ? location : `${urlObj.protocol}//${urlObj.host}${location}`;
						makeDownloadRequest(redirectUrl);
						return;
					} else {
						fileStream.close();
						if (fs.existsSync(filePath)) {
							fs.unlinkSync(filePath);
						}
						reject(new Error(`Redirect response missing Location header`));
						return;
					}
				}
				
				if (res.statusCode !== 200) {
					fileStream.close();
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
					let errorData = '';
					res.on('data', (chunk) => {
						errorData += chunk.toString();
					});
					res.on('end', () => {
						console.error(`[Update Checker] Error response body:`, errorData.substring(0, 500));
						reject(new Error(`Download failed with status ${res.statusCode}: ${errorData.substring(0, 200)}`));
					});
					return;
				}
				
				const totalSize = parseInt(res.headers['content-length'] || '0', 10);
				let downloadedSize = 0;
				
				res.on('data', (chunk) => {
					downloadedSize += chunk.length;
					fileStream.write(chunk);
					
					if (totalSize > 0) {
						const percent = (downloadedSize / totalSize) * 100;
						console.log(`[Update Checker] Download progress: ${percent.toFixed(1)}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB / ${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
					}
				});
				
				res.on('end', () => {
					fileStream.end();
					console.log(`[Update Checker] Download completed: ${downloadedSize} bytes`);
					resolve();
				});
			});
			
			req.on('error', (error) => {
				fileStream.close();
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
				console.error(`[Update Checker] Download error:`, error);
				reject(error);
			});
			
			req.setTimeout(60000, () => {
				console.error(`[Update Checker] Download timeout after 60 seconds`);
				req.destroy();
				fileStream.close();
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
				reject(new Error('Download timeout'));
			});
			
			console.log(`[Update Checker] Sending download request...`);
			req.end();
		};
		
		// Start with the initial API request
		makeDownloadRequest(apiUrl);
	});
}

/**
 * Gets the last update check time from global state
 */
export function getLastUpdateCheck(context: vscode.ExtensionContext): number | undefined {
	return context.globalState.get<number>('lastUpdateCheck');
}

/**
 * Sets the last update check time in global state
 */
export async function setLastUpdateCheck(
	context: vscode.ExtensionContext,
	timestamp: number
): Promise<void> {
	await context.globalState.update('lastUpdateCheck', timestamp);
}

/**
 * Checks if enough time has passed since last check (default: 24 hours)
 */
export function shouldCheckForUpdates(
	context: vscode.ExtensionContext,
	hoursSinceLastCheck: number = 24
): boolean {
	const lastCheck = getLastUpdateCheck(context);
	if (!lastCheck) {
		console.log(`[Update Checker] No previous check found, should check: true`);
		return true;
	}

	const hoursSince = (Date.now() - lastCheck) / (1000 * 60 * 60);
	const shouldCheck = hoursSince >= hoursSinceLastCheck;
	console.log(`[Update Checker] Last check: ${new Date(lastCheck).toISOString()}, Hours since: ${hoursSince.toFixed(2)}, Should check: ${shouldCheck}`);
	return shouldCheck;
}

