import axios from 'axios';
import { StreamerAccount, StreamerStatus, TwitchStreamResponse } from '../types/Streamer';
import { ConfigService } from './ConfigService';
import { OAuthService } from './OAuthService';
import { EMBEDDED_CREDENTIALS } from '../config';

export class StreamerService {
  private configService: ConfigService;
  private oauthService: OAuthService;

  constructor() {
    this.configService = new ConfigService();
    this.oauthService = new OAuthService(this.configService);
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
    let game = '';
    let viewerCount = 0;

    switch (account.platform) {
      case 'twitch':
        const twitchData = await this.checkTwitchStream(account.username);
        isLive = twitchData.isLive;
        title = twitchData.title;
        game = twitchData.game;
        viewerCount = twitchData.viewerCount;
        break;

      case 'youtube':
        // For YouTube, we need the channel ID. If platformId is set, use it.
        // Otherwise, try to resolve the username/handle to a channel ID.
        const channelId = account.platformId || await this.resolveYouTubeChannelId(account.username);
        if (!channelId) {
          throw new Error(`Could not find YouTube channel ID for ${account.username}. Please set the platformId field.`);
        }
        const youtubeData = await this.checkYouTubeStream(channelId);
        isLive = youtubeData.isLive;
        title = youtubeData.title;
        break;

      case 'kick':
        const kickData = await this.checkKickStream(account.username);
        isLive = kickData.isLive;
        title = kickData.title;
        viewerCount = kickData.viewerCount;
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
      game,
      viewerCount,
      url: this.getStreamUrl(account),
      displayName: account.displayName || account.username,
      platform: account.platform
    };
  }

  private async checkTwitchStream(username: string): Promise<{ isLive: boolean; title: string; game: string; viewerCount: number }> {
    const credentials = this.configService.getApiCredentials();
    
    // Check if user is logged in with Twitch
    if (!credentials.twitch.isLoggedIn || !credentials.twitch.accessToken) {
      console.info(`Skipping Twitch check for ${username}: User not authenticated with Twitch`);
      throw new Error('AUTHENTICATION_REQUIRED');
    }

    // Check if token has expired and refresh if needed
    if (credentials.twitch.expiresAt && Date.now() >= credentials.twitch.expiresAt) {
      if (credentials.twitch.refreshToken) {
        try {
          await this.oauthService.refreshTwitchToken();
          // Get updated credentials after refresh
          const updatedCredentials = this.configService.getApiCredentials();
          credentials.twitch = updatedCredentials.twitch;
        } catch (error) {
          throw new Error('Twitch access token has expired and refresh failed. Please re-authenticate with Twitch.');
        }
      } else {
        throw new Error('Twitch access token has expired. Please re-authenticate with Twitch.');
      }
    }

    try {
      // Use the specific Twitch endpoint: https://api.twitch.tv/helix/streams?user_login={user_name}&type=live
      const response = await axios.get<TwitchStreamResponse>(`https://api.twitch.tv/helix/streams?user_login=${username}&type=live`, {
        headers: {
          'Client-ID': EMBEDDED_CREDENTIALS.twitch.clientId,
          'Authorization': `Bearer ${credentials.twitch.accessToken}`
        }
      });

      const streamData = response.data.data[0];
      if (streamData) {
        return {
          isLive: true,
          title: streamData.title,
          game: streamData.game_name,
          viewerCount: streamData.viewer_count
        };
      }

      return { isLive: false, title: '', game: '', viewerCount: 0 };
    } catch (error) {
      console.error('Error checking Twitch stream:', error);
      
      // If it's an authentication error, mark the user as not logged in
      if (error instanceof Error && (error as any).response?.status === 401) {
        const credentials = this.configService.getApiCredentials();
        credentials.twitch.isLoggedIn = false;
        credentials.twitch.accessToken = '';
        this.configService.setApiCredentials(credentials);
        throw new Error('Twitch authentication failed. Please re-authenticate with Twitch.');
      }
      
      return { isLive: false, title: '', game: '', viewerCount: 0 };
    }
  }

  private async checkYouTubeStream(channelId: string): Promise<{ isLive: boolean; title: string }> {
    const credentials = this.configService.getApiCredentials();
    
    if (!credentials.youtube.isLoggedIn || !credentials.youtube.accessToken) {
      console.info(`Skipping YouTube check for channel ${channelId}: User not authenticated with YouTube`);
      throw new Error('AUTHENTICATION_REQUIRED');
    }

    // Check if token has expired and refresh if needed
    if (credentials.youtube.expiresAt && Date.now() >= credentials.youtube.expiresAt) {
      if (credentials.youtube.refreshToken) {
        try {
          await this.oauthService.refreshYouTubeToken();
          // Get updated credentials after refresh
          const updatedCredentials = this.configService.getApiCredentials();
          credentials.youtube = updatedCredentials.youtube;
        } catch (error) {
          throw new Error('YouTube access token has expired and refresh failed. Please re-authenticate with YouTube.');
        }
      } else {
        throw new Error('YouTube access token has expired. Please re-authenticate with YouTube.');
      }
    }

    try {
      // Check for live streams
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.youtube.accessToken}`
          }
        }
      );

      const liveStreams = response.data.items;
      if (liveStreams && liveStreams.length > 0) {
        return {
          isLive: true,
          title: liveStreams[0].snippet.title
        };
      }

      return { isLive: false, title: '' };
    } catch (error) {
      console.error('Error checking YouTube stream:', error);
      
      // If it's an authentication error, mark the user as not logged in
      if (error instanceof Error && (error as any).response?.status === 401) {
        const credentials = this.configService.getApiCredentials();
        credentials.youtube.isLoggedIn = false;
        credentials.youtube.accessToken = '';
        this.configService.setApiCredentials(credentials);
        throw new Error('YouTube authentication failed. Please re-authenticate with YouTube.');
      }
      
      return { isLive: false, title: '' };
    }
  }

  private async checkKickStream(username: string): Promise<{ isLive: boolean; title: string; viewerCount: number }> {
    const credentials = this.configService.getApiCredentials();
    
    if (!credentials.kick.isLoggedIn || !credentials.kick.accessToken) {
      console.info(`Skipping Kick check for ${username}: User not authenticated with Kick`);
      throw new Error('AUTHENTICATION_REQUIRED');
    }

    // Check if token has expired and refresh if needed
    if (credentials.kick.expiresAt && Date.now() >= credentials.kick.expiresAt) {
      if (credentials.kick.refreshToken) {
        try {
          await this.oauthService.refreshKickToken();
          // Get updated credentials after refresh
          const updatedCredentials = this.configService.getApiCredentials();
          credentials.kick = updatedCredentials.kick;
        } catch (error) {
          throw new Error('Kick access token has expired and refresh failed. Please re-authenticate with Kick.');
        }
      } else {
        throw new Error('Kick access token has expired. Please re-authenticate with Kick.');
      }
    }

    try {
      // Use the correct Kick public API endpoint with slug parameter
      // Authentication is REQUIRED according to Kick API docs
      const cleanAccessToken = credentials.kick.accessToken?.trim();
      const response = await axios.get(`https://api.kick.com/public/v1/channels`, {
        params: {
          slug: username  // Use slug parameter as per API docs
        },
        headers: {
          'Authorization': `Bearer ${cleanAccessToken}`,
          'Accept': 'application/json'
        }
      });

      const responseData = response.data;
      if (responseData && responseData.data && responseData.data.length > 0) {
        const channelData = responseData.data[0]; // Get first channel from data array
        if (channelData.stream && channelData.stream.is_live) {
          return {
            isLive: true,
            title: channelData.stream_title || '',
            viewerCount: channelData.stream.viewer_count || 0
          };
        }
      }

      return { isLive: false, title: '', viewerCount: 0 };
    } catch (error) {
      console.error('Error checking Kick stream:', error);
      
      // If it's an authentication error, mark the user as not logged in
      if (error instanceof Error && (error as any).response?.status === 401) {
        const credentials = this.configService.getApiCredentials();
        credentials.kick.isLoggedIn = false;
        credentials.kick.accessToken = '';
        this.configService.setApiCredentials(credentials);
        throw new Error('Kick authentication failed. Please re-authenticate with Kick.');
      }
      
      return { isLive: false, title: '', viewerCount: 0 };
    }
  }

  private async resolveYouTubeChannelId(usernameOrHandle: string): Promise<string | null> {
    const credentials = this.configService.getApiCredentials();
    
    if (!credentials.youtube.isLoggedIn || !credentials.youtube.accessToken) {
      return null;
    }

    try {
      // Try to search for the channel by username or handle
      let searchQuery = usernameOrHandle;
      if (usernameOrHandle.startsWith('@')) {
        searchQuery = usernameOrHandle.substring(1); // Remove @ prefix
      }

      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.youtube.accessToken}`
          }
        }
      );

      const channels = response.data.items;
      if (channels && channels.length > 0) {
        // Return the first matching channel ID
        return channels[0].snippet.channelId;
      }

      return null;
    } catch (error) {
      console.error('Error resolving YouTube channel ID:', error);
      return null;
    }
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
