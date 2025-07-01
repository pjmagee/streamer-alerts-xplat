import { dialog, shell } from 'electron';
import logger from '../utils/logger';

export interface PlaywrightStatus {
  isInstalled: boolean;
  hasBrowsers: boolean;
  isInstalling: boolean;
  version?: string;
  message: string;
}

export class PlaywrightManagerService {
  private static _instance: PlaywrightManagerService;
  private _status: PlaywrightStatus | null = null;

  static getInstance(): PlaywrightManagerService {
    if (!PlaywrightManagerService._instance) {
      PlaywrightManagerService._instance = new PlaywrightManagerService();
    }
    return PlaywrightManagerService._instance;
  }

  async checkPlaywrightStatus(): Promise<PlaywrightStatus> {
    if (this._status) {
      return this._status;
    }

    try {
      // Try to import playwright
      const playwright = await import('playwright');
      
      // Get version from package.json
      let version: string;
      try {
        const packageJson = await import('playwright/package.json');
        version = packageJson.version;
      } catch {
        version = 'unknown';
      }
      
      // Check if chromium browser is installed
      let hasBrowsers = false;
      try {
        const browser = await playwright.chromium.launch({ headless: true });
        await browser.close();
        hasBrowsers = true;
      } catch (error) {
        logger.warn('Playwright installed but browsers not available:', error);
      }

      this._status = {
        isInstalled: true,
        hasBrowsers,
        isInstalling: false,
        version,
        message: hasBrowsers 
          ? 'Playwright is ready for web scraping'
          : 'Playwright installed but browsers need to be downloaded'
      };

    } catch (error) {
      logger.warn('Playwright not available:', error);
      this._status = {
        isInstalled: false,
        hasBrowsers: false,
        isInstalling: false,
        message: 'Playwright not installed - scraping features unavailable'
      };
    }

    return this._status;
  }

  async ensurePlaywrightForScraping(): Promise<boolean> {
    const status = await this.checkPlaywrightStatus();
    
    if (!status.isInstalled) {
      throw new Error('Playwright is not bundled with the application. This is a build error.');
    }

    if (!status.hasBrowsers) {
      // If browsers are missing in a properly packaged app, this is a packaging error
      const result = await dialog.showMessageBox({
        type: 'error',
        title: 'Browser Components Missing',
        message: 'Required browser components are missing from this installation.',
        detail: 'This appears to be a packaging error. The app should include browser components for scraping.\n\n' +
               'Options:\n' +
               '• Use API mode instead (requires OAuth setup)\n' +
               '• Reinstall the application\n' +
               '• Report this issue on GitHub',
        buttons: ['Switch to Settings', 'Report Issue', 'OK'],
        defaultId: 0
      });

      let response: number;
      if (typeof result === 'number') {
        response = result;
      } else {
        response = (result as unknown as { response: number }).response;
      }

      if (response === 1) {
        await shell.openExternal('https://github.com/pjmagee/streamer-alerts-xplat/issues');
      }

      return false;
    }

    return true;
  }

  async getPlaywrightBrowser() {
    const status = await this.checkPlaywrightStatus();
    
    if (!status.isInstalled || !status.hasBrowsers) {
      throw new Error('Playwright not available - ' + status.message);
    }

    const playwright = await import('playwright');
    return playwright.chromium;
  }

  // Reset cached status (useful after user installs Playwright)
  resetStatus(): void {
    this._status = null;
  }
}
