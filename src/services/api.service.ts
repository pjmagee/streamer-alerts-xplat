import { TwitchStreamResponse } from '../types/streamer';
import { ConfigService } from './config.service';
import { OAuthService } from './oauth.service';
import logger from '../utils/logger';

export class ApiService {
  private configService: ConfigService;
  private oauthService: OAuthService;

  constructor(configService: ConfigService, oauthService: OAuthService) {
    this.configService = configService;
    this.oauthService = oauthService;
  }

  public async checkTwitchStream(username: string): Promise<{ isLive: boolean; title: string }> {
    const credentials = this.configService.getApiCredentials();
    
    // Check if user is logged in with Twitch
    if (!credentials.twitch.isLoggedIn || !credentials.twitch.accessToken) {
      logger.debug(`Skipping Twitch check for ${username}: User not authenticated with Twitch`);
      throw new Error('AUTHENTICATION_REQUIRED');
    }

    // Check if user has configured Twitch credentials
    if (!credentials.twitch.clientId) {
      logger.debug(`Skipping Twitch check for ${username}: User has not configured Twitch client ID`);
      throw new Error('CREDENTIALS_NOT_CONFIGURED');
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
      const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${username}&type=live`, {
        headers: {
          'Client-ID': credentials.twitch.clientId,
          'Authorization': `Bearer ${credentials.twitch.accessToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          const credentials = this.configService.getApiCredentials();
          credentials.twitch.isLoggedIn = false;
          credentials.twitch.accessToken = '';
          this.configService.setApiCredentials(credentials);
          throw new Error('Twitch authentication failed. Please re-authenticate with Twitch.');
        }
        throw new Error(`Twitch API error: ${response.status} ${response.statusText}`);
      }

      const data: TwitchStreamResponse = await response.json();
      const streamData = data.data[0];
      if (streamData) {
        return {
          isLive: true,
          title: streamData.title
        };
      }

      return { isLive: false, title: '' };
    } catch (error) {
      logger.error('Error checking Twitch stream:', error);
      
      // If it's an authentication error, mark the user as not logged in
      if (error instanceof Error && error.message.includes('authentication')) {
        throw error;
      }
      
      return { isLive: false, title: '' };
    }
  }

  public async checkYouTubeStream(channelId: string): Promise<{ isLive: boolean; title: string }> {
    const credentials = this.configService.getApiCredentials();
    
    if (!credentials.youtube.isLoggedIn || !credentials.youtube.accessToken) {
      logger.debug(`Skipping YouTube check for ${channelId}: User not authenticated with YouTube`);
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
      // Step 2: Check if the channel is live using the search API with eventType=live
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video`,
        {
          headers: {
            'Authorization': `Bearer ${credentials.youtube.accessToken}`
          }
        }
      );

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          // Token expired or invalid
          const credentials = this.configService.getApiCredentials();
          credentials.youtube.isLoggedIn = false;
          credentials.youtube.accessToken = '';
          this.configService.setApiCredentials(credentials);
          throw new Error('YouTube authentication failed. Please re-authenticate with YouTube.');
        } else if (response.status === 403) {
          // Forbidden - could be quota exceeded, insufficient permissions, or API key issues
          logger.error('YouTube API 403 error details:', responseData);
          
          if (responseData?.error?.message?.includes('quota')) {
            throw new Error('YouTube API quota exceeded. Please try again later.');
          } else if (responseData?.error?.message?.includes('permission') || responseData?.error?.message?.includes('scope')) {
            throw new Error('Insufficient permissions for YouTube API. Please re-authenticate with YouTube to grant live stream access.');
          } else {
            throw new Error(`YouTube API access denied: ${responseData?.error?.message || 'Unknown error'}`);
          }
        } else if (response.status === 404) {
          logger.warn(`YouTube channel ${channelId} not found`);
          return { isLive: false, title: '' };
        }
        
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const liveStreams = data.items;
      if (liveStreams && liveStreams.length > 0) {
        return {
          isLive: true,
          title: liveStreams[0].snippet.title
        };
      }

      return { isLive: false, title: '' };
    } catch (error) {
      logger.error('Error checking YouTube stream:', error);
      
      // Handle different types of API errors
      if (error instanceof Error && error.message.includes('authentication')) {
        throw error;
      } else if (error instanceof Error && error.message.includes('API')) {
        throw error;
      }
      
      // For other errors, return offline status but don't throw
      logger.warn(`Failed to check YouTube stream status for ${channelId}:`, error);
      return { isLive: false, title: '' };
    }
  }

  public async checkKickStream(username: string): Promise<{ isLive: boolean; title: string }> {
    const credentials = this.configService.getApiCredentials();
    
    if (!credentials.kick.isLoggedIn || !credentials.kick.accessToken) {
      logger.debug(`Skipping Kick check for ${username}: User not authenticated with Kick`);
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
      const url = new URL('https://api.kick.com/public/v1/channels');
      url.searchParams.set('slug', username);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${cleanAccessToken}`,
          'Accept': '*/*'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          const credentials = this.configService.getApiCredentials();
          credentials.kick.isLoggedIn = false;
          credentials.kick.accessToken = '';
          this.configService.setApiCredentials(credentials);
          throw new Error('Kick authentication failed. Please re-authenticate with Kick.');
        }
        throw new Error(`Kick API error: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      if (responseData && responseData.data && responseData.data.length > 0) {
        const channelData = responseData.data[0]; // Get first channel from data array
        if (channelData.stream && channelData.stream.is_live) {
          return {
            isLive: true,
            title: channelData.stream_title || ''
          };
        }
      }

      return { isLive: false, title: '' };
    } catch (error) {      
      logger.error('Error checking Kick stream:', error);
      
      // If it's an authentication error, mark the user as not logged in
      if (error instanceof Error && error.message.includes('authentication')) {
        throw error;
      }
      
      return { isLive: false, title: '' };
    }
  }
}
