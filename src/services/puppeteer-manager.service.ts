import { dialog, shell } from 'electron';
import puppeteer, { Browser } from 'puppeteer';
import logger from '../utils/logger';

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

  async checkPuppeteerStatus(): Promise<PuppeteerStatus> {
    if (this._status) {
      return this._status;
    }

    try {
      // Get Puppeteer version
      let version: string;
      try {
        const packageJson = await import('puppeteer/package.json');
        version = packageJson.version;
      } catch {
        version = 'unknown';
      }

      const browser = await puppeteer.launch({ headless: true  });
      await browser.close();

      this._status = {
        isAvailable: true,
        version,
        message: 'Puppeteer is ready for web scraping'
      };

      logger.info(`Puppeteer ${version} is available and working`);

    } catch (error) {
      logger.warn('Puppeteer not available:', error);
      this._status = {
        isAvailable: false,
        message: 'Puppeteer browser launch failed - scraping features unavailable'
      };
    }

    return this._status;
  }

  async ensurePuppeteerForScraping(): Promise<boolean> {
    const status = await this.checkPuppeteerStatus();
    
    if (!status.isAvailable) {
      const result = await dialog.showMessageBox({
        type: 'error',
        title: 'Browser Components Missing',
        message: 'Puppeteer cannot launch a browser for scraping.',
        detail: `This could be due to:\n` +
               `• Missing browser binaries in the packaged app\n` +
               `• System compatibility issues\n\n` +
               `Options:\n` +
               `• Try installing Google Chrome on your system\n` +
               `• Use API mode instead (requires OAuth setup)\n` +
               `• Report this issue on GitHub`,
        buttons: ['Switch to Settings', 'Install Chrome', 'Report Issue', 'OK'],
        defaultId: 0
      });

      const response = typeof result === 'number' ? result : result.response;

      switch (response) {
        case 1: // Install Chrome
          await shell.openExternal('https://www.google.com/chrome/');
          break;
        case 2: // Report Issue
          await shell.openExternal('https://github.com/pjmagee/streamer-alerts-xplat/issues');
          break;
      }

      return false;
    }

    return true;
  }

  async getPuppeteerBrowser(): Promise<Browser> {
    const status = await this.checkPuppeteerStatus();
    
    if (!status.isAvailable) {
      throw new Error('Puppeteer not available - ' + status.message);
    }

    // Let Puppeteer handle browser detection and launching
    return await puppeteer.launch({ headless: true });
  }

  // Reset cached status (useful after user installs Chrome)
  resetStatus(): void {
    this._status = null;
  }
}
