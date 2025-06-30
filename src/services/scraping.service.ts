import { chromium, Browser, Page, BrowserContext } from 'playwright';
import logger from '../utils/logger';

export class ScrapingService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  
  // Persistent pages for each platform
  private twitchPage: Page | null = null;
  private youtubePage: Page | null = null;
  private kickPage: Page | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      // Create a persistent context for better performance
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
    }
    return this.browser;
  }

  private async createPage(): Promise<Page> {
    await this.getBrowser();
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();

    return page;
  }

  private async getTwitchPage(): Promise<Page> {
    if (!this.twitchPage || this.twitchPage.isClosed()) {
      this.twitchPage = await this.createPage();
    }
    return this.twitchPage;
  }

  private async getYouTubePage(): Promise<Page> {
    if (!this.youtubePage || this.youtubePage.isClosed()) {
      this.youtubePage = await this.createPage();
    }
    return this.youtubePage;
  }

  private async getKickPage(): Promise<Page> {
    if (!this.kickPage || this.kickPage.isClosed()) {
      this.kickPage = await this.createPage();
    }
    return this.kickPage;
  }

  private async resetTwitchPage(): Promise<void> {
    if (this.twitchPage && !this.twitchPage.isClosed()) {
      await this.twitchPage.close();
    }
    this.twitchPage = null;
  }

  private async resetYouTubePage(): Promise<void> {
    if (this.youtubePage && !this.youtubePage.isClosed()) {
      await this.youtubePage.close();
    }
    this.youtubePage = null;
  }

  private async resetKickPage(): Promise<void> {
    if (this.kickPage && !this.kickPage.isClosed()) {
      await this.kickPage.close();
    }
    this.kickPage = null;
  }

  public async checkTwitchStream(username: string): Promise<{ isLive: boolean; title: string }> {
    try {
      const page = await this.getTwitchPage();
      await page.goto(`https://www.twitch.tv/${username}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const isLive = await page.locator('span[class*="CoreText"]', { hasText: 'LIVE' })
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      let title = '';
      if (isLive) {
        const titleLocator = page.locator('p[data-a-target="stream-title"][class*="CoreText"]');
        title = await titleLocator.innerText({ timeout: 5000});
      }

      return { isLive, title };
    } catch (error) {
      logger.error('Error scraping Twitch stream:', error);
      await this.resetTwitchPage();
      return { isLive: false, title: '' };
    }
  }

  public async checkYouTubeStream(channel: string): Promise<{ isLive: boolean; title: string }> {
    try {
      const page = await this.getYouTubePage();

      // Navigate to channel homepage
      const baseUrl = channel.startsWith('UC')
        ? `https://www.youtube.com/channel/${channel}`
        : channel.startsWith('@')
          ? `https://www.youtube.com/${channel}`
          : `https://www.youtube.com/@${channel}`;
      await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
      // Wait for full client-side load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Handle consent/cookie popup if present
      try {
        const consentTitle = await page.title();
        if (/before you continue|consent/i.test(consentTitle)) {
          const btns = page.locator('button');
          for (let i = 0, len = await btns.count(); i < len; i++) {
            const btn = btns.nth(i);
            const text = await btn.textContent();
            if (text && /(accept all|i agree|agree|accept)/i.test(text.trim())) {
              await btn.click();
              await page.waitForLoadState('networkidle');
              break;
            }
          }
          await page.waitForTimeout(1000);
        }
      } catch {
        // ignore consent errors
      }

      // Check for LIVE badge in header
      const liveBadge = page.locator('div#page-header div[class*="live-badge"] div:has-text("LIVE")');
      const isLive = await liveBadge.first().isVisible().catch(() => false);
      let title = '';
      if (isLive) {
        // Extract live stream title
        // Use any anchor with id=video-title for title
        const videoLink = page.locator('a#video-title');
        title = await videoLink.first().getAttribute('title')
          .then(t => t || '')
          .catch(async () => {
            return videoLink.first().textContent().then(text => text?.trim() || '');
          });
      }
      return { isLive, title };
    } catch (error) {
      logger.error('Error scraping YouTube stream:', error);
      await this.resetYouTubePage();
      return { isLive: false, title: '' };
    }
  }

  public async checkKickStream(username: string): Promise<{ isLive: boolean; title: string }> {
    try {
      const page = await this.getKickPage();

      await page.goto(`https://kick.com/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Check for LIVE indicator using more efficient approach
      const isLive = await page.locator('span:has-text("LIVE")')
        .first().isVisible().catch(() => false);

      let title = '';
      if (isLive) {
        // Extract title, with fallback to page title
        title = await page.locator('span[data-testid="livestream-title"]')
          .first().textContent()
          .then(t => t || '')
          .catch(() => '');
      }

      return { isLive, title };
    } catch (error) {
      logger.error('Error scraping Kick stream:', error);
      await this.resetKickPage();
      return { isLive: false, title: '' };
    }
  }

  public async cleanup(): Promise<void> {
    try {
      // Close persistent pages
      if (this.twitchPage && !this.twitchPage.isClosed()) {
        await this.twitchPage.close();
        this.twitchPage = null;
      }
      if (this.youtubePage && !this.youtubePage.isClosed()) {
        await this.youtubePage.close();
        this.youtubePage = null;
      }
      if (this.kickPage && !this.kickPage.isClosed()) {
        await this.kickPage.close();
        this.kickPage = null;
      }
      
      // Close context and browser
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      logger.error('Error during ScrapingService cleanup:', error);
    }
  }
}
