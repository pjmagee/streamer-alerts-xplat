import logger from "../utils/logger";
import { PuppeteerManagerService } from "./puppeteer-manager.service";
import { ConfigService } from "./config.service";
import { Browser, Page } from "puppeteer-core";

export interface IScrapingConfigService {
  getSelectedBrowserPath(): string | null;
}

export class ScrapingService {
  private browser: Browser | null = null;
  private puppeteerManager = PuppeteerManagerService.getInstance();
  private configService: IScrapingConfigService;
  private twitchPage: Page | null = null;
  private youtubePage: Page | null = null;
  private kickPage: Page | null = null;

  constructor(configService?: IScrapingConfigService) {
    this.configService = configService || new ConfigService();
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const selectedBrowserPath = this.configService.getSelectedBrowserPath();
      this.browser = await this.puppeteerManager.getPuppeteerBrowser(
        selectedBrowserPath
      );
    }
    return this.browser;
  }

  private async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    return page;
  }

  private async getTwitchPage(): Promise<Page> {
    if (!this.twitchPage || this.twitchPage.isClosed())
      this.twitchPage = await this.createPage();
    return this.twitchPage;
  }

  private async getYouTubePage(): Promise<Page> {
    if (!this.youtubePage || this.youtubePage.isClosed())
      this.youtubePage = await this.createPage();
    return this.youtubePage;
  }

  private async getKickPage(): Promise<Page> {
    if (!this.kickPage || this.kickPage.isClosed())
      this.kickPage = await this.createPage();
    return this.kickPage;
  }

  private async resetTwitchPage(): Promise<void> {
    if (this.twitchPage && !this.twitchPage.isClosed())
      await this.twitchPage.close();
    this.twitchPage = null;
  }

  private async resetYouTubePage(): Promise<void> {
    if (this.youtubePage && !this.youtubePage.isClosed())
      await this.youtubePage.close();
    this.youtubePage = null;
  }

  private async resetKickPage(): Promise<void> {
    if (this.kickPage && !this.kickPage.isClosed())
      await this.kickPage.close();
    this.kickPage = null;
  }

  public async checkTwitchStream(
    channel: string
  ): Promise<{ isLive: boolean; title: string }> {
    try {
      const page = await this.getTwitchPage();
      await page.goto(`https://www.twitch.tv/${channel.toLowerCase()}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await new Promise((r) => setTimeout(r, 3000));
      const result = await page.evaluate(() => {
        const hasVideo = !!document.querySelector("video");
        const liveBadge = Array.from(document.querySelectorAll("span, div"))
          .map((n) => (n.textContent || "").trim().toUpperCase())
          .includes("LIVE");
        const titleEl = document.querySelector(
          "h2[data-test-selector='stream-info-card-component__title'], h1"
        );
        const title = (titleEl?.textContent || "").trim();
        return { isLive: hasVideo && liveBadge, title };
      });
      return {
        isLive: result.isLive,
        title: result.isLive ? result.title.slice(0, 140) : "",
      };
    } catch (error) {
      logger.error(`Error scraping Twitch stream for ${channel}:`, error);
      await this.resetTwitchPage();
      return { isLive: false, title: "" };
    }
  }

  // Simplified YouTube heuristic per user request.
  public async checkYouTubeStream(
    channel: string
  ): Promise<{ isLive: boolean; title: string }> {
    try {
      const page = await this.getYouTubePage();
      const handle = channel.startsWith("@") ? channel : `@${channel}`;

      // Navigate directly to handle /live and rely on final URL pattern.
      await page.goto(`https://www.youtube.com/${handle}/live`, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });

      // Attempt to auto-dismiss YouTube consent screen if present.
      try {
        const dismissed = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
          const target = buttons.find(b => /reject all/i.test(b.textContent || ''));
          if (target) {
            target.click();
            return true;
          }
          return false;
        });
        if (dismissed) {
          await new Promise(r => setTimeout(r, 4000));
        }
      } catch (consentErr) {
        logger.debug(`Consent dismiss attempt failed for ${channel}: ${consentErr}`);
      }

      // Capture a diagnostic screenshot (best-effort; ignore failures)
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const safeHandle = handle.replace(/[^@a-zA-Z0-9_-]/g, "_");
        await page.screenshot({
          path: `logs/youtube-${safeHandle}-${ts}.png`,
          fullPage: false,
        });
      } catch (shotErr) {
        logger.debug(`YouTube screenshot failed for ${channel}: ${shotErr}`);
      }

      const result = await page.evaluate(() => {        
        const canonicalLink = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
        const isLive = canonicalLink!.href.includes("https://www.youtube.com/watch?v=");
        return { isLive, title: isLive ? document.title : "" };
      });

      return {
        isLive: result.isLive,
        title: result.isLive ? result.title.slice(0, 140) : "",
      };

    } catch (error) {
      logger.error(`Error scraping YouTube stream for ${channel}:`, error);
      await this.resetYouTubePage();
      return { isLive: false, title: "" };
    }
  }

  public async checkKickStream(
    username: string
  ): Promise<{ isLive: boolean; title: string }> {
    const titleSelector = "span[data-testid='livestream-title']";
    try {
      const page = await this.getKickPage();
      await page.goto(`https://kick.com/${username}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await new Promise((r) => setTimeout(r, 4000));
      const result = await page.evaluate((tSel: string) => {
        const titleEl = document.querySelector(tSel);
        const rawTitle = (titleEl?.textContent || "").trim();
        const hasVideo = !!document.querySelector("video");
        const liveBadgeFound = Array.from(document.querySelectorAll("span"))
          .map((s) => (s.textContent || "").trim().toUpperCase())
          .includes("LIVE");
        return { isLive: hasVideo && (liveBadgeFound || !!rawTitle), rawTitle };
      }, titleSelector);
      return {
        isLive: result.isLive,
        title: result.isLive ? result.rawTitle.slice(0, 140) : "",
      };
    } catch (error) {
      logger.error(`Error scraping Kick stream for ${username}:`, error);
      await this.resetKickPage();
      return { isLive: false, title: "" };
    }
  }

  public async cleanup(): Promise<void> {
    try {
      if (this.twitchPage && !this.twitchPage.isClosed())
        await this.twitchPage.close();
      if (this.youtubePage && !this.youtubePage.isClosed())
        await this.youtubePage.close();
      if (this.kickPage && !this.kickPage.isClosed())
        await this.kickPage.close();
      if (this.browser) await this.browser.close();
    } catch (e) {
      logger.warn("Error during ScrapingService cleanup:", e);
    } finally {
      this.twitchPage = null;
      this.youtubePage = null;
      this.kickPage = null;
      this.browser = null;
    }
  }
}
