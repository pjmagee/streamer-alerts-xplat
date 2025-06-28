import { chromium, Browser, Page, BrowserContext } from 'playwright';

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

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    return page;
  }

  private async getTwitchPage(): Promise<Page> {
    if (!this.twitchPage || this.twitchPage.isClosed()) {
      this.twitchPage = await this.createPage();
      console.log('[Twitch] Created new persistent page');
    }
    return this.twitchPage;
  }

  private async getYouTubePage(): Promise<Page> {
    if (!this.youtubePage || this.youtubePage.isClosed()) {
      this.youtubePage = await this.createPage();
      console.log('[YouTube] Created new persistent page');
    }
    return this.youtubePage;
  }

  private async getKickPage(): Promise<Page> {
    if (!this.kickPage || this.kickPage.isClosed()) {
      this.kickPage = await this.createPage();
      console.log('[Kick] Created new persistent page');
    }
    return this.kickPage;
  }

  private async resetTwitchPage(): Promise<void> {
    if (this.twitchPage && !this.twitchPage.isClosed()) {
      await this.twitchPage.close();
    }
    this.twitchPage = null;
    console.log('[Twitch] Reset persistent page');
  }

  private async resetYouTubePage(): Promise<void> {
    if (this.youtubePage && !this.youtubePage.isClosed()) {
      await this.youtubePage.close();
    }
    this.youtubePage = null;
    console.log('[YouTube] Reset persistent page');
  }

  private async resetKickPage(): Promise<void> {
    if (this.kickPage && !this.kickPage.isClosed()) {
      await this.kickPage.close();
    }
    this.kickPage = null;
    console.log('[Kick] Reset persistent page');
  }

  public async checkTwitchStream(username: string): Promise<{ isLive: boolean; title: string }> {
    try {
      const page = await this.getTwitchPage();

      console.log(`[Twitch] Navigating to: https://www.twitch.tv/${username}`);

      await page.goto(`https://www.twitch.tv/${username}`, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for content to load
      await page.waitForTimeout(3000);

      // Debug: Check page title and URL
      const pageTitle = await page.title();
      const currentUrl = page.url();
      console.log(`[Twitch] Page title: ${pageTitle}`);
      console.log(`[Twitch] Current URL: ${currentUrl}`);

      // Try multiple selectors for LIVE status
      const selectors = [
        'span[class*="CoreText"]',
        '[data-a-target="animated-channel-viewers-count"]',
        '[data-a-target="hosting-ui-link"]',
        'span:has-text("LIVE")',
        '[aria-label*="live"]',
        '.live-indicator',
        '[class*="live"]',
        '.tw-tag--live'
      ];

      let isLive = false;

      for (const selector of selectors) {
        try {
          const elements = page.locator(selector);
          const count = await elements.count();
          
          if (count > 0) {
            // Check if any element contains "LIVE" text
            for (let i = 0; i < count; i++) {
              const element = elements.nth(i);
              const text = await element.textContent();
              if (text && (text.toUpperCase().includes('LIVE') || text.toLowerCase().includes('live'))) {
                isLive = true;
                console.log(`[Twitch] Found LIVE indicator with selector: ${selector}`);
                break;
              }
            }
          }
        } catch (e) {
          // Continue with next selector
        }
        
        if (isLive) break;
      }

      // Also check for offline indicators
      const offlineSelectors = [
        'p:has-text("offline")',
        '[data-a-target="offline-recommendations"]',
        'h2:has-text("offline")'
      ];

      for (const selector of offlineSelectors) {
        try {
          const elements = page.locator(selector);
          const count = await elements.count();
          if (count > 0) {
            console.log(`[Twitch] Found offline indicator with selector: ${selector}`);
          }
        } catch (e) {
          // Ignore errors
        }
      }

      // Get page HTML for debugging if needed
      if (!isLive) {
        console.log(`[Twitch] Stream appears offline, checking page structure...`);
        const bodyHTML = await page.locator('body').innerHTML();
        const liveMatches = bodyHTML.match(/live/gi) || [];
        console.log(`[Twitch] Found ${liveMatches.length} instances of "live" in page HTML`);
        
        // Look for specific Twitch live indicators in HTML
        if (bodyHTML.includes('viewers') || bodyHTML.includes('watching')) {
          console.log(`[Twitch] Found viewer indicators, might be live`);
        }
      }

      let title = '';
      if (isLive) {
        console.log(`[Twitch] Stream is live, waiting for title to load...`);
        
        // First, wait for the stream title element to be present and have content
        try {
          // Wait for stream title element to be present and have non-empty text
          await page.waitForFunction(() => {
            const titleElement = document.querySelector('p[data-a-target="stream-title"]') ||
                                document.querySelector('h2[data-a-target="stream-title"]') ||
                                document.querySelector('[data-a-target="stream-title"]');
            return titleElement && titleElement.textContent && titleElement.textContent.trim().length > 0;
          }, { timeout: 10000 });
          
          console.log(`[Twitch] Title element loaded with content`);
        } catch (e) {
          console.log(`[Twitch] Timeout waiting for title element to load: ${String(e)}`);
        }
        
        // Try multiple title selectors
        const titleSelectors = [
          'p[data-a-target="stream-title"]',
          'h2[data-a-target="stream-title"]',
          '[data-a-target="stream-title"]',
          'h1[data-a-target="stream-title"]',
          '.channel-info-content h2',
          '.tw-title',
          'h1',
          'h2'
        ];

        for (const titleSelector of titleSelectors) {
          try {
            const titleLocator = page.locator(titleSelector);
            const count = await titleLocator.count();
            
            if (count > 0) {
              for (let i = 0; i < count; i++) {
                const element = titleLocator.nth(i);
                const titleText = await element.textContent();
                if (titleText && titleText.trim() && 
                    !titleText.includes('Show More') && 
                    !titleText.includes('Welcome to') && 
                    !titleText.includes('Cookies') && 
                    !titleText.includes('Advertising') &&
                    titleText.length > 5) {
                  title = titleText.trim();
                  console.log(`[Twitch] Extracted title: ${title}`);
                  break;
                }
              }
            }
          } catch (e) {
            // Continue to next selector
          }
          
          if (title) break;
        }
        
        // If still no title, try extracting from page title
        if (!title) {
          const pageTitle = await page.title();
          // Extract channel name from page title like "PirateSoftware - Twitch"
          if (pageTitle && pageTitle.includes(' - Twitch')) {
            const channelName = pageTitle.replace(' - Twitch', '');
            console.log(`[Twitch] Using channel name as fallback title: ${channelName}`);
            title = `${channelName} is live`;
          }
        }
      }

      console.log(`[Twitch] Final result - isLive: ${isLive}, title: "${title}"`);
      return { isLive, title };
    } catch (error) {
      console.error('Error scraping Twitch stream:', error);
      
      // If we get a navigation or timeout error, reset the page for next time
      if (error instanceof Error && (
        error.message.includes('Navigation') ||
        error.message.includes('timeout') ||
        error.message.includes('Page closed') ||
        error.message.includes('Target closed')
      )) {
        console.log('[Twitch] Resetting page due to navigation/timeout error');
        await this.resetTwitchPage();
      }
      
      return { isLive: false, title: '' };
    }
  }

  public async checkYouTubeStream(channel: string): Promise<{ isLive: boolean; title: string }> {
    try {
      const page = await this.getYouTubePage();

      // Handle both channel IDs (UC...) and usernames
      let url: string;

      if (channel.startsWith('UC')) {
        url = `https://www.youtube.com/channel/${channel}/live`;
      } else if (channel.startsWith('@')) {
        url = `https://www.youtube.com/${channel}/live`;
      } else {
        // Try both formats
        url = `https://www.youtube.com/@${channel}/live`;
      }

      console.log(`[YouTube] Navigating to: ${url}`);

      await page.goto(url, { waitUntil: 'load', timeout: 30000 });

      // Wait for content to load
      await page.waitForTimeout(3000);
      
      const pageTitle = await page.title();
      const currentUrl = page.url();
      console.log(`[YouTube] Page title: ${pageTitle}`);
      console.log(`[YouTube] Current URL: ${currentUrl}`);

      // Handle consent/cookie popup
      if (pageTitle.includes('Before you continue') || pageTitle.includes('consent')) {
        console.log(`[YouTube] Detected consent page, attempting to handle...`);
        try {
          // Try multiple consent button selectors
          const consentButtons = [
            'button:has-text("Accept all")',
            'button:has-text("I agree")',
            'button:has-text("Accept")',
            '[aria-label*="Accept"]',
            '[data-testid*="accept"]',
            'form[action*="consent"] button[type="submit"]',
            '.eom-buttons button'
          ];

          let handled = false;
          for (const selector of consentButtons) {
            try {
              const button = page.locator(selector);
              if (await button.count() > 0 && await button.first().isVisible({ timeout: 2000 })) {
                console.log(`[YouTube] Clicking consent button: ${selector}`);
                await button.first().click();
                await page.waitForTimeout(3000);
                handled = true;
                break;
              }
            } catch (e) {
              // Try next selector
            }
          }

          if (!handled) {
            console.log(`[YouTube] Could not handle consent page, trying to navigate directly`);
            // Try to navigate again after waiting
            await page.goto(url, { waitUntil: 'load', timeout: 30000 });
            await page.waitForTimeout(3000);
          }
        } catch (e) {
          console.log(`[YouTube] Error handling consent: ${String(e)}`);
        }
      }

      // Try multiple selectors for LIVE status
      const selectors = [
        'div[id="page-header"]',
        '.ytd-channel-name span',
        '.badge-live',
        '.live-badge',
        '.yt-live-chat-renderer',
        '[aria-label*="live"]',
        'span:has-text("LIVE")',
        'div:has-text("LIVE")',
        '.ytp-live-badge'
      ];

      let isLive = false;
      let liveSelector = '';

      for (const selector of selectors) {
        try {
          const elements = page.locator(selector);
          const count = await elements.count();
          
          if (count > 0) {
            // Check if any element contains "LIVE" text
            for (let i = 0; i < count; i++) {
              const element = elements.nth(i);
              const text = await element.textContent();
              if (text && (text.includes('LIVE') || text.includes('live'))) {
                isLive = true;
                console.log(`[YouTube] Found LIVE indicator with selector: ${selector}`);
                break;
              }
            }
          }
        } catch (e) {
          // Continue with next selector
        }
        
        if (isLive) break;
      }

      // Special check: if URL redirects to a different page, the stream might be offline
      if (currentUrl !== url && currentUrl.includes('/videos') || currentUrl.includes('/featured')) {
        console.log(`[YouTube] Redirected to non-live page, stream likely offline`);
        isLive = false;
      }

      // Get page HTML for debugging if needed
      if (!isLive) {
        console.log(`[YouTube] Stream appears offline, checking page structure...`);
        const bodyHTML = await page.locator('body').innerHTML();
        const liveMatches = bodyHTML.match(/live/gi) || [];
        console.log(`[YouTube] Found ${liveMatches.length} instances of "live" in page HTML`);
        
        // Look for YouTube live indicators in HTML
        if (bodyHTML.includes('watching now') || bodyHTML.includes('viewers')) {
          console.log(`[YouTube] Found viewer indicators, might be live`);
        }
      }

      let title = '';
      if (isLive) {
        // Try multiple title selectors
        const titleSelectors = [
          'h1.ytd-video-primary-info-renderer',
          'div#title',
          'h1#title',
          '.title',
          'meta[property="og:title"]'
        ];

        for (const titleSelector of titleSelectors) {
          try {
            let titleLocator;
            if (titleSelector.includes('meta')) {
              // Handle meta tags differently
              const metaTitle = await page.getAttribute('meta[property="og:title"]', 'content');
              if (metaTitle) {
                title = metaTitle.trim();
                console.log(`[YouTube] Extracted title from meta tag: ${title}`);
                break;
              }
            } else {
              titleLocator = page.locator(titleSelector);
              if (await titleLocator.count() > 0) {
                title = await titleLocator.first().textContent() || '';
                title = title.trim();
                if (title) {
                  console.log(`[YouTube] Extracted title with selector "${titleSelector}": ${title}`);
                  break;
                }
              }
            }
          } catch (e) {
            // Continue to next selector
          }
        }
      }

      console.log(`[YouTube] Final result - isLive: ${isLive}, title: "${title}"`);
      return { isLive, title };
    } catch (error) {
      console.error('Error scraping YouTube stream:', error);
      
      // If we get a navigation or timeout error, reset the page for next time
      if (error instanceof Error && (
        error.message.includes('Navigation') ||
        error.message.includes('timeout') ||
        error.message.includes('Page closed') ||
        error.message.includes('Target closed')
      )) {
        console.log('[YouTube] Resetting page due to navigation/timeout error');
        await this.resetYouTubePage();
      }
      
      return { isLive: false, title: '' };
    }
  }

  public async checkKickStream(username: string): Promise<{ isLive: boolean; title: string }> {
    try {
      const page = await this.getKickPage();

      await page.goto(`https://kick.com/${username}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      // Use modern Playwright locator to find LIVE text within the channel content
      const channelContentLocator = page.locator('div[id="channel-content"]');
      const liveLocator = channelContentLocator.locator('span').filter({ hasText: 'LIVE' });
      const isLive = await liveLocator.count() > 0;

      let title = '';
      if (isLive) {
        // Extract title using modern locator API
        const titleLocator = page.locator('span[data-testid="livestream-title"]');
        if (await titleLocator.count() > 0) {
          title = await titleLocator.textContent() || '';
          title = title.trim();
        }

        if (title) {
          console.log(`[Kick] Extracted title: ${title}`);
        }
      }

      return { isLive, title };
    } catch (error) {
      console.error('Error scraping Kick stream:', error);
      
      // If we get a navigation or timeout error, reset the page for next time
      if (error instanceof Error && (
        error.message.includes('Navigation') ||
        error.message.includes('timeout') ||
        error.message.includes('Page closed') ||
        error.message.includes('Target closed')
      )) {
        console.log('[Kick] Resetting page due to navigation/timeout error');
        await this.resetKickPage();
      }
      
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
      console.error('Error during ScrapingService cleanup:', error);
    }
  }
}
