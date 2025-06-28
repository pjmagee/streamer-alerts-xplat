import { StreamerAccount, StreamerStatus } from '../types/Streamer';
import { ConfigService } from './ConfigService';
import { OAuthService } from './OAuthService';
import { ScrapingService } from './ScrapingService';
import { ApiService } from './ApiService';

export class StreamerService {
  private configService: ConfigService;
  private oauthService: OAuthService;
  private scrapingService: ScrapingService;
  private apiService: ApiService;

  constructor() {
    this.configService = new ConfigService();
    this.oauthService = new OAuthService(this.configService);
    this.scrapingService = new ScrapingService();
    this.apiService = new ApiService(this.configService, this.oauthService);
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
          console.debug(`Skipping ${account.username} on ${account.platform}: Authentication required`);
        } else {
          // Log actual errors
          console.error(`Error checking ${account.username} on ${account.platform}:`, error);
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

    switch (account.platform) {
      case 'twitch':
        if (strategy === 'scrape') {
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
        return `https://youtube.com/channel/${account.username}`;
      case 'kick':
        return `https://kick.com/${account.username}`;
      default:
        return '';
    }
  }
}
