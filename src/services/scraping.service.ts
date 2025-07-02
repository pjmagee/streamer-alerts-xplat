import logger from '../utils/logger';
import { PuppeteerManagerService } from './puppeteer-manager.service';
import { Browser, Page } from 'puppeteer';

export class ScrapingService {
  private browser: Browser | null = null;
  private puppeteerManager = PuppeteerManagerService.getInstance();

  // Persistent pages for each platform
  private twitchPage: Page | null = null;
  private youtubePage: Page | null = null;
  private kickPage: Page | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      // Get browser from puppeteer manager
      this.browser = await this.puppeteerManager.getPuppeteerBrowser();
    }
    return this.browser;
  }

  private async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
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

    const titleSelector = 'p[data-a-target="stream-title"][class*="CoreText"]';
    const liveIndicatorSelector = 'span[class*="CoreText"]';


    try {
      const page = await this.getTwitchPage();
      await page.goto(`https://www.twitch.tv/${username}`, { waitUntil: 'load', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 10000));
      await page.waitForSelector('body', { visible: true });

      let isLive = false;

      try {
        await page.waitForSelector(liveIndicatorSelector, {visible: true, timeout: 30000 });

        isLive = await page.evaluate(() => {
          const elements = document.querySelectorAll(liveIndicatorSelector);
          for (const element of elements) {
            const text = element.textContent || '';
            if (text === 'LIVE') {
              return true;
            }
          }
          return false;
        });
      } catch (timeoutError) {
        logger.debug(`Timeout waiting for Twitch live indicators for ${username}`);
        // If we timeout, still try to evaluate without waiting
        isLive = false;
      }

      let title = '';
      if (isLive) {
        try {
          // Wait for and extract the stream title using ONLY your proven selector
          await page.waitForSelector(titleSelector, {visible: true });

          const titleElement = await page.$(titleSelector);
          if (titleElement) {
            title = await titleElement.evaluate((el: Element) => el.textContent?.trim() || '');
          }

          if (!title) {
            logger.debug(`Could not find stream title for ${username} with your proven selector`);
          }

        } catch (error) {
          logger.warn(`Could not get stream title for ${username}:`, error);
        }
      }

      logger.debug(`Twitch check for ${username}: isLive=${isLive}, title="${title}"`);
      return { isLive, title };

    } catch (error) {
      logger.error(`Error scraping Twitch stream for ${username}:`, error);
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

      await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Handle consent/cookie popup if present
      try {
        const consentTitle = await page.title();
        if (/before you continue|consent/i.test(consentTitle)) {
          await page.waitForSelector('button', { timeout: 5000 });
          const buttons = await page.$$('button');
          for (const button of buttons) {
            const text = await button.evaluate((el: Element) => el.textContent);
            if (text && /(accept all|i agree|agree|accept)/i.test(text.trim())) {
              await button.click();
              await new Promise(resolve => setTimeout(resolve, 3000));
              break;
            }
          }
        }
      } catch {
        // Ignore consent popup errors
      }

      // Check for LIVE indicator
      let isLive = false;

      try {
        // Wait for page content to be ready
        await page.waitForSelector('#page-header, #channel-header, ytd-channel-renderer');

        // Check for LIVE badge
        isLive = await page.evaluate(() => {
          const liveSelectors = [
            'div[class*="live-badge"]',
            'span[class*="live-badge"]',
            '[class*="live-indicator"]'
          ];

          for (const selector of liveSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              const text = element.textContent || '';
              if (text.toUpperCase().includes('LIVE')) {
                return true;
              }
            }
          }

          // Also check for any text content that indicates live status
          const allText = document.body.textContent || '';
          return /\bLIVE\b/i.test(allText) &&
            !/(offline|ended|scheduled)/i.test(allText);
        });

      } catch (error) {
        logger.debug(`Error checking YouTube live status for ${channel}:`, error);
      }

      let title = '';
      if (isLive) {
        try {
          // Try to get the live stream title
          const titleSelectors = [
            'a#video-title',
            'h1#video-title',
            '[id="video-title"]'
          ];

          for (const selector of titleSelectors) {
            try {
              await page.waitForSelector(selector, { visible: true, timeout: 5000 });
              const titleElement = await page.$(selector);
              if (titleElement) {
                title = await titleElement.evaluate((el: Element) => {
                  return el.getAttribute('title') ||
                    el.textContent?.trim() ||
                    el.getAttribute('aria-label') || '';
                });
                if (title) {
                  break;
                }
              }
            } catch {
              continue;
            }
          }

          if (!title) {
            logger.debug(`Could not find stream title for YouTube channel ${channel}`);
          }

        } catch (error) {
          logger.warn(`Could not get YouTube stream title for ${channel}:`, error);
        }
      }

      logger.debug(`YouTube check for ${channel}: isLive=${isLive}, title="${title}"`);
      return { isLive, title };

    } catch (error) {
      logger.error(`Error scraping YouTube stream for ${channel}:`, error);
      await this.resetYouTubePage();
      return { isLive: false, title: '' };
    }
  }

  public async checkKickStream(username: string): Promise<{ isLive: boolean; title: string }> {

    const titleSelector = 'span[data-testid="livestream-title"]';
    const liveIndicatorSelector = 'span';

    try {
      const page = await this.getKickPage();

      await page.goto(`https://kick.com/${username}`, { waitUntil: 'load' });
      await new Promise(resolve => setTimeout(resolve, 10000));


      // Check for LIVE indicator
      const isLive = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(liveIndicatorSelector)).some(span =>
          span.textContent?.includes('LIVE')
        );
      }).catch(() => false);

      let title = '';
      if (isLive) {
        // Extract title
        try {
          const titleElement = await page.$(titleSelector);
          if (titleElement) {
            title = await titleElement.evaluate((el: Element) => el.textContent?.trim() || '');
          }
        } catch (error) {
          logger.warn('Could not get Kick stream title:', error);
        }
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

      // Close browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      logger.error('Error during ScrapingService cleanup:', error);
    }
  }
}
