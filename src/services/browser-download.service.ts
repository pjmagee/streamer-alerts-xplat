import { Browser, detectBrowserPlatform, install, canDownload, InstallOptions, BrowserPlatform, resolveBuildId } from '@puppeteer/browsers';
import { EventEmitter } from 'events';
import * as os from 'node:os';
import * as path from 'node:path';
import logger from '../utils/logger';

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
}

export interface BrowserDownloadOptions {
  browser: Browser;
  buildId?: string;
  platform?: BrowserPlatform;
  cacheDir?: string;
}

/**
 * Get the default Puppeteer cache directory to ensure consistency with browser detection
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

export class BrowserDownloadService extends EventEmitter {
  private isDownloading = false;
  private currentDownload: AbortController | null = null;

  /**
   * Get available browsers for download
   * Only Chrome is supported as it's the most reliable with Puppeteer
   */
  getSupportedBrowsers(): Array<{ id: Browser; name: string; description: string }> {
    return [
      {
        id: Browser.CHROME,
        name: 'Google Chrome',
        description: 'Latest stable Chrome for automated testing (Recommended)'
      }
    ];
  }

  /**
   * Check if a browser can be downloaded for the current platform
   */
  async canDownloadBrowser(browser: Browser, buildId?: string): Promise<boolean> {
    try {
      const platform = detectBrowserPlatform();
      if (!platform) {
        return false;
      }

      // Resolve build ID if it's "latest" or not provided
      const resolvedBuildId = buildId === 'latest' || !buildId ? 
        await resolveBuildId(browser, platform, 'latest') : 
        buildId;

      return await canDownload({
        browser,
        platform,
        buildId: resolvedBuildId,
        cacheDir: getDefaultCacheDir()
      });
    } catch (error) {
      logger.error(`Error checking if ${browser} can be downloaded:`, error);
      return false;
    }
  }

  /**
   * Download a browser
   */
  async downloadBrowser(options: BrowserDownloadOptions): Promise<string> {
    if (this.isDownloading) {
      throw new Error('A browser download is already in progress');
    }

    const { browser, buildId = 'latest', platform, cacheDir } = options;

    try {
      this.isDownloading = true;
      this.currentDownload = new AbortController();

      const detectedPlatform = platform || detectBrowserPlatform();
      if (!detectedPlatform) {
        throw new Error(`Unsupported platform for browser download`);
      }

      // Resolve the build ID first 
      let resolvedBuildId: string;
      try {
        resolvedBuildId = await resolveBuildId(browser, detectedPlatform, buildId);
        logger.info(`Resolved ${browser} build ID ${buildId} to ${resolvedBuildId}`);
      } catch (error) {
        logger.error(`Failed to resolve build ID for ${browser}:`, error);
        throw new Error(`Failed to resolve build ID for ${browser}: ${error instanceof Error ? error.message : String(error)}`);
      }

      logger.info(`Starting download of ${browser} (${resolvedBuildId})`);
      this.emit('downloadStarted', { browser, buildId: resolvedBuildId });

      // Check if browser can be downloaded
      const canDownloadBrowser = await this.canDownloadBrowser(browser, resolvedBuildId);
      if (!canDownloadBrowser) {
        throw new Error(`Cannot download ${browser} ${resolvedBuildId} for platform ${detectedPlatform}`);
      }

      const installOptions: InstallOptions & { unpack: true } = {
        browser,
        buildId: resolvedBuildId,
        platform: detectedPlatform,
        unpack: true,
        cacheDir: cacheDir || getDefaultCacheDir()
      };

      // Install with progress tracking
      const installedBrowser = await install(installOptions);

      logger.info(`Successfully downloaded ${browser} to: ${installedBrowser.executablePath}`);
      this.emit('downloadCompleted', { 
        browser, 
        buildId: resolvedBuildId, 
        executablePath: installedBrowser.executablePath 
      });

      return installedBrowser.executablePath;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error downloading ${browser}:`, error);
      this.emit('downloadError', { browser, error: errorMessage });
      throw error;
    } finally {
      this.isDownloading = false;
      this.currentDownload = null;
    }
  }

  /**
   * Cancel current download
   */
  cancelDownload(): void {
    if (this.currentDownload) {
      this.currentDownload.abort();
      this.currentDownload = null;
    }
    this.isDownloading = false;
    this.emit('downloadCancelled');
    logger.info('Browser download cancelled');
  }

  /**
   * Check if a download is in progress
   */
  isDownloadInProgress(): boolean {
    return this.isDownloading;
  }

  /**
   * Get the latest available build ID for a browser
   */
  async getLatestBuildId(browser: Browser): Promise<string | null> {
    try {
      const platform = detectBrowserPlatform();
      if (!platform) {
        return null;
      }
      
      return await resolveBuildId(browser, platform, 'latest');
    } catch (error) {
      logger.error(`Error getting latest build ID for ${browser}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const browserDownloadService = new BrowserDownloadService();
