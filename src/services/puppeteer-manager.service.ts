import { dialog } from 'electron';
import puppeteer, { Browser as PuppeteerBrowser, LaunchOptions } from 'puppeteer-core';
import { Browser } from '@puppeteer/browsers';
import logger from '../utils/logger';
import { validateBrowserPath, findFirstAvailableBrowser } from '../utils/browser-manager';

export interface PuppeteerStatus {
  isAvailable: boolean;
  version?: string;
  message: string;
}

export class PuppeteerManagerService {
  private static _instance: PuppeteerManagerService;
  private _status: PuppeteerStatus | null = null;

  static getInstance(): PuppeteerManagerService {
    if (!PuppeteerManagerService._instance) {
      PuppeteerManagerService._instance = new PuppeteerManagerService();
    }
    return PuppeteerManagerService._instance;
  }

  /**
   * Reset the status cache to force a recheck
   */
  resetStatus(): void {
    this._status = null;
  }

  /**
   * Get browser-specific launch arguments
   */
  private getBrowserArgs(browserType?: Browser): string[] {
    if (browserType === Browser.FIREFOX) {
      // Firefox-specific arguments
      return [
        // No --no-sandbox equivalent for Firefox
        // Use minimal args for Firefox compatibility
      ];
    } else {
      // Chrome/Chromium arguments
      return [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas', 
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled'
      ];
    }
  }

  /**
   * Resolve the browser executable path using the browser selection system
   */
  private async resolveBrowserPath(selectedBrowserPath: string | null = null): Promise<{ path: string | null; name: string; browserType?: Browser }> {
    // Priority order: 
    // 1. Provided selected browser path
    // 2. Auto-detected browser using findFirstAvailableBrowser
    
    let browserPath: string | null = null;
    let browserName = 'Unknown Browser';
    let browserType: Browser | undefined = undefined;
    
    // Try selected browser path first
    if (selectedBrowserPath && await validateBrowserPath(selectedBrowserPath)) {
      browserPath = selectedBrowserPath;
      browserName = 'Selected Browser';
      logger.info(`Using selected browser: ${browserPath}`);
    }
    // Auto-detect browser from downloaded browsers
    else {
      const detected = await findFirstAvailableBrowser();
      if (detected) {
        browserPath = detected.path;
        browserName = detected.browser;
        browserType = detected.browser;
        logger.info(`Using auto-detected browser: ${browserName} at ${browserPath}`);
      } else {
        logger.warn('No compatible browser found');
      }
    }
    
    return { path: browserPath, name: browserName, browserType };
  }

  async checkPuppeteerStatus(selectedBrowserPath: string | null = null): Promise<PuppeteerStatus> {
    // Don't cache status when specific browser path is provided, as it might change
    if (this._status && !selectedBrowserPath) {
      return this._status;
    }

    try {
      // Get Puppeteer version  
      let version: string;
      try {
        // Try to get version from a safer method
        version = 'installed'; // We'll use a simpler approach since version detection is tricky
      } catch(error) {
        logger.warn('Failed to get Puppeteer version:', error);
        version = 'unknown';
      }

      // Resolve browser path using new system
      const { path: browserPath, name: browserName } = await this.resolveBrowserPath(selectedBrowserPath);
      
      // If we found a browser executable, validate it exists without launching
      if (browserPath) {
        const isValid = await validateBrowserPath(browserPath);
        if (isValid) {
          logger.info(`Browser validated: ${browserName} at ${browserPath}`);
          this._status = {
            isAvailable: true,
            version,
            message: selectedBrowserPath ? 'Ready using selected browser' : 'Ready using detected browser'
          };
        } else {
          logger.warn(`Browser path invalid: ${browserPath}`);
          this._status = {
            isAvailable: false,
            message: 'Selected browser path is invalid'
          };
        }
      } else {
        // No browser found - cannot use puppeteer-core without a browser
        logger.warn('No browser executable found and puppeteer-core requires an executable path');
        this._status = {
          isAvailable: false,
          message: 'No compatible browser found - please download a browser using the Browser tab'
        };
        return this._status;
      }

      logger.info(`Puppeteer ${version} is available and working`);

    } catch (error) {
      logger.warn('Puppeteer not available:', error);
      this._status = {
        isAvailable: false,
        message: 'Puppeteer browser validation failed - scraping features unavailable'
      };
    }

    return this._status;
  }

  async ensurePuppeteerForScraping(): Promise<boolean> {
    const status = await this.checkPuppeteerStatus();
    
    if (!status.isAvailable) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Browser Required for Scraping',
        message: 'No browser available for web scraping.',
        detail: `Web scraping requires a downloaded browser.\n\n` +
               `Solutions:\n` +
               `• Go to Browser tab → Download section to get a browser\n` +
               `• Use API mode instead (no browser required, but needs OAuth setup)\n\n` +
               `Chrome and Chromium are recommended for best compatibility.`,
        buttons: ['OK'],
        defaultId: 0
      });

      return false;
    }

    return true;
  }

  async getPuppeteerBrowser(selectedBrowserPath: string | null = null): Promise<PuppeteerBrowser> {
    const status = await this.checkPuppeteerStatus(selectedBrowserPath);
    
    if (!status.isAvailable) {
      throw new Error('Puppeteer not available - ' + status.message);
    }

    // Resolve browser path using new system
    const { path: browserPath, name: browserName, browserType } = await this.resolveBrowserPath(selectedBrowserPath);
    
    const launchOptions: LaunchOptions = {
      headless: true,
      args: this.getBrowserArgs(browserType),
      ignoreDefaultArgs: ['--disable-extensions']
    };

    // If we found a browser executable, use it
    if (browserPath) {
      launchOptions.executablePath = browserPath;
      logger.info(`Launching Puppeteer with ${browserName}: ${browserPath}`);
    } else {
      throw new Error('No compatible browser found - please download a browser using the Browser tab');
    }

    // Launch with more stealthy options to avoid bot detection
    return await puppeteer.launch(launchOptions);
  }

  /**
   * Test launch a browser to verify it actually works (more thorough than just path validation)
   */
  async testBrowserLaunch(selectedBrowserPath: string | null = null): Promise<{ success: boolean; message: string }> {
    try {
      // Resolve browser path using new system
      const { path: browserPath, name: browserName, browserType } = await this.resolveBrowserPath(selectedBrowserPath);
      
      if (!browserPath) {
        return { success: false, message: 'No browser path available for testing' };
      }

      const launchOptions: LaunchOptions = { 
        headless: true,
        args: this.getBrowserArgs(browserType),
        executablePath: browserPath
      };

      logger.info(`Testing browser launch: ${browserName} at ${browserPath}`);
      const browser = await puppeteer.launch(launchOptions);
      await browser.close();
      
      return { success: true, message: `${browserName} launched successfully` };
    } catch (error) {
      logger.error('Browser test launch failed:', error);
      return { success: false, message: `Browser launch failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
}
