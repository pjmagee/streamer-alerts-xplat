import { getInstalledBrowsers, Browser, BrowserPlatform, detectBrowserPlatform, computeExecutablePath, install, uninstall, resolveBuildId, InstallOptions, UninstallOptions, canDownload } from '@puppeteer/browsers';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import logger from './logger';

export interface DownloadedBrowser {
  browser: Browser;
  buildId: string;
  path: string;
  platform: BrowserPlatform;
  name: string;
}

export interface BrowserInstallResult {
  success: boolean;
  browser?: DownloadedBrowser;
  error?: string;
}

export interface BrowserUninstallResult {
  success: boolean;
  error?: string;
}

/**
 * Get the default Puppeteer cache directory to ensure consistency
 */
function getDefaultCacheDir(): string {
  const homeDir = os.homedir();
  const platform = os.platform();
  
  switch (platform) {
    case 'win32':
      return path.join(process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'), 'puppeteer');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Caches', 'puppeteer');
    case 'linux':
    default:
      return path.join(process.env.XDG_CACHE_HOME || path.join(homeDir, '.cache'), 'puppeteer');
  }
}

/**
 * Get all browsers downloaded by Puppeteer using the official API
 */
export async function getDownloadedBrowsers(cacheDir?: string): Promise<DownloadedBrowser[]> {
  try {
    const downloadCacheDir = cacheDir || getDefaultCacheDir();
    const installedBrowsers = await getInstalledBrowsers({ cacheDir: downloadCacheDir });
    
    logger.debug(`Found ${installedBrowsers.length} installed browsers in ${downloadCacheDir}`);
    
    return installedBrowsers.map(browser => {
      const executablePath = computeExecutablePath({
        browser: browser.browser,
        buildId: browser.buildId,
        cacheDir: downloadCacheDir
      });
      
      const displayName = getBrowserDisplayName(browser.browser, browser.buildId);
      
      return {
        browser: browser.browser,
        buildId: browser.buildId,
        path: executablePath,
        platform: browser.platform,
        name: displayName
      };
    });
  } catch (error) {
    logger.error('Error getting downloaded browsers:', error);
    return [];
  }
}

/**
 * Install a browser using Puppeteer's install API
 */
export async function installBrowser(browser: Browser, buildId: string = 'latest', cacheDir?: string): Promise<BrowserInstallResult> {
  try {
    const downloadCacheDir = cacheDir || getDefaultCacheDir();
    const platform = detectBrowserPlatform();
    
    if (!platform) {
      return { success: false, error: 'Unsupported platform' };
    }

    // Resolve build ID if it's "latest"
    const resolvedBuildId = buildId === 'latest' ? 
      await resolveBuildId(browser, platform, 'latest') : 
      buildId;

    logger.info(`Installing ${browser} ${resolvedBuildId}...`);

    const installOptions: InstallOptions & { unpack: true } = {
      browser,
      buildId: resolvedBuildId,
      cacheDir: downloadCacheDir,
      platform,
      unpack: true
    };

    const installedBrowser = await install(installOptions);
    
    const executablePath = computeExecutablePath({
      browser: installedBrowser.browser,
      buildId: installedBrowser.buildId,
      cacheDir: downloadCacheDir
    });

    const result: DownloadedBrowser = {
      browser: installedBrowser.browser,
      buildId: installedBrowser.buildId,
      path: executablePath,
      platform: installedBrowser.platform,
      name: getBrowserDisplayName(installedBrowser.browser, installedBrowser.buildId)
    };

    logger.info(`Successfully installed ${browser} ${resolvedBuildId} at ${executablePath}`);
    return { success: true, browser: result };

  } catch (error) {
    logger.error(`Failed to install ${browser} ${buildId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Uninstall a browser using Puppeteer's uninstall API
 */
export async function uninstallBrowser(browser: Browser, buildId: string, cacheDir?: string): Promise<BrowserUninstallResult> {
  try {
    const downloadCacheDir = cacheDir || getDefaultCacheDir();
    const platform = detectBrowserPlatform();
    
    if (!platform) {
      return { success: false, error: 'Unsupported platform' };
    }

    logger.info(`Uninstalling ${browser} ${buildId}...`);

    const uninstallOptions: UninstallOptions = {
      browser,
      buildId,
      cacheDir: downloadCacheDir,
      platform
    };

    await uninstall(uninstallOptions);
    
    logger.info(`Successfully uninstalled ${browser} ${buildId}`);
    return { success: true };

  } catch (error) {
    logger.error(`Failed to uninstall ${browser} ${buildId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get a user-friendly display name for a browser
 */
function getBrowserDisplayName(browser: Browser, _buildId: string): string {
  switch (browser) {
    case Browser.CHROME:
      return `Google Chrome (Downloaded)`;
    case Browser.CHROMIUM:
      return `Chromium (Downloaded)`;
    default:
      return `${browser} (Downloaded)`;
  }
}

/**
 * Find the first available downloaded browser
 */
export async function findFirstAvailableBrowser(cacheDir?: string): Promise<DownloadedBrowser | null> {
  const browsers = await getDownloadedBrowsers(cacheDir);
  
  // Prefer Chrome first, then others
  const chrome = browsers.find(b => b.browser === Browser.CHROME);
  if (chrome) return chrome;
  
  return browsers.length > 0 ? browsers[0] : null;
}

/**
 * Check if a specific browser path exists and is valid
 */
export function validateBrowserPath(browserPath: string): boolean {
  try {
    return fs.existsSync(browserPath) && fs.statSync(browserPath).isFile();
  } catch (error) {
    logger.warn(`Failed to validate browser path ${browserPath}:`, error);
    return false;
  }
}

/**
 * Find a browser executable by path among downloaded browsers
 */
export async function findBrowserExecutable(browserPath: string, cacheDir?: string): Promise<DownloadedBrowser | null> {
  const browsers = await getDownloadedBrowsers(cacheDir);
  return browsers.find(b => b.path === browserPath) || null;
}

/**
 * Get current platform for browser downloads
 */
export function getCurrentPlatform(): BrowserPlatform | null {
  return detectBrowserPlatform() || null;
}

/**
 * Get supported browsers for download using Puppeteer API
 * Dynamically checks which browsers can be downloaded on the current platform
 */
export async function getSupportedBrowsers(): Promise<Array<{ id: Browser; name: string; description: string }>> {
  const platform = detectBrowserPlatform();
  
  if (!platform) {
    logger.warn('Could not detect browser platform');
    return [];
  }

  const supportedBrowsers: Array<{ id: Browser; name: string; description: string }> = [];
  
  // Check each browser type to see if it can be downloaded on this platform
  const browsersToCheck = [
    { 
      browser: Browser.CHROME, 
      name: 'Google Chrome', 
      description: 'Latest stable Chrome for automated testing (Recommended)' 
    },
    { 
      browser: Browser.CHROMIUM, 
      name: 'Chromium', 
      description: 'Open-source version of Chrome' 
    }
  ];

  for (const browserInfo of browsersToCheck) {
    try {
      // Try to resolve the latest build ID to check if the browser is supported
      const latestBuildId = await resolveBuildId(browserInfo.browser, platform, 'latest');
      
      // Check if this browser can be downloaded
      const canDownloadBrowser = await canDownload({
        browser: browserInfo.browser,
        buildId: latestBuildId,
        cacheDir: getDefaultCacheDir(),
        platform
      });

      if (canDownloadBrowser) {
        supportedBrowsers.push({
          id: browserInfo.browser,
          name: browserInfo.name,
          description: browserInfo.description
        });
        logger.debug(`${browserInfo.name} is supported on platform ${platform}`);
      } else {
        logger.debug(`${browserInfo.name} is not supported on platform ${platform}`);
      }
    } catch (error) {
      logger.debug(`${browserInfo.name} is not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  logger.info(`Found ${supportedBrowsers.length} supported browsers for platform ${platform}`);
  return supportedBrowsers;
}

/**
 * Check if a specific browser can be downloaded using Puppeteer API
 */
export async function canDownloadBrowser(browser: Browser, buildId: string = 'latest', cacheDir?: string): Promise<boolean> {
  try {
    const downloadCacheDir = cacheDir || getDefaultCacheDir();
    const platform = detectBrowserPlatform();
    
    if (!platform) {
      logger.warn('Could not detect browser platform for canDownload check');
      return false;
    }

    // Resolve build ID if it's "latest"
    const resolvedBuildId = buildId === 'latest' ? 
      await resolveBuildId(browser, platform, 'latest') : 
      buildId;

    const canDownloadResult = await canDownload({
      browser,
      buildId: resolvedBuildId,
      cacheDir: downloadCacheDir,
      platform
    });

    logger.debug(`Can download ${browser} ${resolvedBuildId}: ${canDownloadResult}`);
    return canDownloadResult;

  } catch (error) {
    logger.warn(`Error checking if ${browser} ${buildId} can be downloaded:`, error);
    return false;
  }
}
