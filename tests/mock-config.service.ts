import { IScrapingConfigService } from '../src/services/scraping.service';

/**
 * Mock ConfigService for tests that doesn't use electron-store
 * Implements only the interface methods needed by ScrapingService
 */
export class MockConfigService implements IScrapingConfigService {
  private cachedBrowserPath: string | null = null;

  public getSelectedBrowserPath(): string | null {
    // For tests, return cached path if available, otherwise null to trigger
    // auto-detection of Puppeteer-installed browsers (not system browsers)
    if (this.cachedBrowserPath !== null) {
      return this.cachedBrowserPath;
    }

    // Returning null triggers PuppeteerManagerService.findFirstAvailableBrowser()
    // which will find and use downloaded Puppeteer browsers (preferring Chrome)
    return null;
  }

  /**
   * For testing purposes, we can manually set a browser path if needed
   */
  public setBrowserPath(path: string): void {
    this.cachedBrowserPath = path;
  }
}
