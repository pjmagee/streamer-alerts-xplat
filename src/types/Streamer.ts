export interface StreamerAccount {
  id: string;
  username: string;              // Twitch/Kick username or YouTube channel handle (@username)
  platform: 'twitch' | 'youtube' | 'kick';
  displayName?: string;
  enabled: boolean;
  lastStatus?: 'live' | 'offline';
  lastChecked?: Date;
  // Platform-specific identifiers
  platformId?: string;           // YouTube channel ID, Twitch user ID, etc.
}

export interface StreamerStatus {
  account: StreamerAccount;
  isLive: boolean;
  justWentLive: boolean;
  title?: string;
  game?: string;
  viewerCount?: number;
  thumbnailUrl?: string;
  url: string;
  displayName: string;
  platform: string;
}

export interface TwitchStreamResponse {
  data: Array<{
    id: string;
    user_id: string;
    user_login: string;
    user_name: string;
    game_id: string;
    game_name: string;
    type: string;
    title: string;
    viewer_count: number;
    started_at: string;
    language: string;
    thumbnail_url: string;
  }>;
}

export interface YouTubeChannelResponse {
  items: Array<{
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        default: { url: string };
        medium: { url: string };
        high: { url: string };
      };
    };
    statistics: {
      viewCount: string;
      subscriberCount: string;
      videoCount: string;
    };
  }>;
}

export interface AppConfig {
  accounts: StreamerAccount[];
  notificationsEnabled: boolean;
  checkInterval: number;
  windowSettings: {
    width: number;
    height: number;
  };
  apiCredentials: ApiCredentials;
}

export interface ApiCredentials {
  twitch: {
    clientId: string;
    // Note: clientSecret removed for security (desktop apps are public clients)
    accessToken: string;           // User access token (required for all operations)
    refreshToken?: string;         // Refresh token for token renewal
    expiresAt?: number;            // Token expiration time
    isLoggedIn: boolean;
    username?: string;             // Authenticated user's Twitch username (for UI display only)
    displayName?: string;          // Authenticated user's display name (for UI display only)
  };
  youtube: {
    clientId?: string;             // Client ID for OAuth
    // Note: clientSecret removed for security (desktop apps are public clients)
    accessToken: string;           // User access token for API calls
    refreshToken?: string;         // Refresh token for token renewal
    expiresAt?: number;            // Token expiration time
    isLoggedIn: boolean;
    displayName?: string;          // Authenticated user's channel name (for UI display only)
    // Note: channelId/channelName removed - these belong to individual StreamerAccount records
    // The authenticated user's channel info is not needed for monitoring other streamers
  };
  kick: {
    clientId?: string;
    // Note: clientSecret removed for security (desktop apps are public clients, using PKCE)
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    isLoggedIn: boolean;
    username?: string;             // Authenticated user's Kick username (for UI display only)
    displayName?: string;          // Authenticated user's display name (for UI display only)
  };
}
