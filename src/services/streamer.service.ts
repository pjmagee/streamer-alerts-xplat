import { StreamerAccount, StreamerStatus } from '../types/streamer';
import { ConfigService } from './config.service';
import { OAuthService } from './oauth.service';
import { ScrapingService } from './scraping.service';
import { ApiService } from './api.service';
import { PuppeteerManagerService } from './puppeteer-manager.service';
import logger from '../utils/logger';

export class StreamerService {
  private configService: ConfigService;
  private oauthService: OAuthService;
  private scrapingService: ScrapingService;
  private apiService: ApiService;
  private puppeteerManager: PuppeteerManagerService;

  constructor() {
    this.configService = new ConfigService();
    this.oauthService = new OAuthService(this.configService);
    this.scrapingService = new ScrapingService(this.configService);
    this.apiService = new ApiService(this.configService, this.oauthService);
    this.puppeteerManager = PuppeteerManagerService.getInstance();
  }

  public async checkMultipleStreamers(accounts: StreamerAccount[]): Promise<StreamerStatus[]> {
    const results: StreamerStatus[] = [];

    for (const account of accounts.filter(acc => acc.enabled)) {
      try {
        const status = await this.checkStreamerStatus(account);
        results.push(status);
      } catch (error) {
        if (error instanceof Error && error.message === 'AUTHENTICATION_REQUIRED') {
          // Authentication errors are expected when user hasn't logged in yet
          logger.debug(`Skipping ${account.username} on ${account.platform}: Authentication required`);
        } else {
          // Log actual errors
          logger.error(`Error checking ${account.username} on ${account.platform}:`, error);
        }
        
        // Return offline status on error
        results.push({
          account,
          isLive: false,
          justWentLive: false,
          url: this.getStreamUrl(account),
          displayName: account.displayName || account.username,
          platform: account.platform
        });
      }
    }

    return results;
  }

  private async checkStreamerStatus(account: StreamerAccount): Promise<StreamerStatus> {
    const wasLive = account.lastStatus === 'live';
    let isLive = false;
    let title = '';
    
    const strategies = this.configService.getStrategies();
    const strategy = strategies[account.platform];

    logger.info(`🔎 Checking ${account.displayName || account.username} on ${account.platform} (${strategy} strategy)`);

    switch (account.platform) {
      case 'twitch':
        if (strategy === 'scrape') {
          // Check if Puppeteer browsers are available
          const canScrape = await this.puppeteerManager.ensurePuppeteerForScraping();
          if (!canScrape) {
            throw new Error('Scraping is not available. Please install browser binaries or switch to API mode.');
          }
          const twitchData = await this.scrapingService.checkTwitchStream(account.username);
          isLive = twitchData.isLive;
          title = twitchData.title;
        } else {
          const twitchData = await this.apiService.checkTwitchStream(account.username);
          isLive = twitchData.isLive;
          title = twitchData.title;
        }
        break;

      case 'youtube':
        if (strategy === 'scrape') {
          // Check if Puppeteer browsers are available
          const canScrape = await this.puppeteerManager.ensurePuppeteerForScraping();
          if (!canScrape) {
            throw new Error('Scraping is not available. Please install browser binaries or switch to API mode.');
          }
          const youtubeData = await this.scrapingService.checkYouTubeStream(account.username);
          isLive = youtubeData.isLive;
          title = youtubeData.title;
        } else {
          const youtubeData = await this.apiService.checkYouTubeStream(account.username);
          isLive = youtubeData.isLive;
          title = youtubeData.title;
        }
        break;

      case 'kick':
        if (strategy === 'scrape') {
          // Check if Puppeteer browsers are available
          const canScrape = await this.puppeteerManager.ensurePuppeteerForScraping();
          if (!canScrape) {
            throw new Error('Scraping is not available. Please install browser binaries or switch to API mode.');
          }
          const kickData = await this.scrapingService.checkKickStream(account.username);
          isLive = kickData.isLive;
          title = kickData.title;
        } else {
          const kickData = await this.apiService.checkKickStream(account.username);
          isLive = kickData.isLive;
          title = kickData.title;
        }
        break;
    }

    const justWentLive = !wasLive && isLive;

    // Update account status
    account.lastStatus = isLive ? 'live' : 'offline';
    account.lastChecked = new Date();

    // Log the individual check result
    const statusIcon = isLive ? '✅' : '❌';
    const statusText = isLive ? 'LIVE' : 'OFFLINE';
    const titleInfo = title ? ` (${title})` : '';
    const transitionInfo = justWentLive ? ' [JUST WENT LIVE!]' : wasLive && !isLive ? ' [WENT OFFLINE]' : '';
    
    logger.info(`    ${statusIcon} ${account.displayName || account.username}: ${statusText}${titleInfo}${transitionInfo}`);

    return {
      account,
      isLive,
      justWentLive,
      title,
      url: this.getStreamUrl(account),
      displayName: account.displayName || account.username,
      platform: account.platform
    };
  }

  public async cleanup(): Promise<void> {
    await this.scrapingService.cleanup();
  }

  private getStreamUrl(account: StreamerAccount): string {
    switch (account.platform) {
      case 'twitch':
        return `https://twitch.tv/${account.username}`;
      case 'youtube':
        // Check if it's a channel ID (starts with UC) or a handle (@username)
        if (account.username.startsWith('UC')) {
          return `https://youtube.com/channel/${account.username}`;
        } else if (account.username.startsWith('@')) {
          return `https://youtube.com/${account.username}`;
        } else {
          // If it's just a username, treat it as a handle
          return `https://youtube.com/@${account.username}`;
        }
      case 'kick':
        return `https://kick.com/${account.username}`;
      default:
        return '';
    }
  }
}
