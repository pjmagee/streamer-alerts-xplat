
export interface StreamerAccount {
  id: string;
  username: string; // for Twitch, this is the user ID, for YouTube, this is the channel ID
  platform: 'twitch' | 'youtube' | 'kick';
  displayName?: string;
  enabled: boolean;
  lastStatus?: 'live' | 'offline';
  lastChecked?: Date;
  platformId?: string; // Used for YouTube channel IDs when username is different
}

export interface StreamerStatus {
  account: StreamerAccount;
  isLive: boolean;
  justWentLive: boolean;
  title?: string;
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
    type: string;
    title: string;
    started_at: string;
    language: string;
  }>;
}

export interface YouTubeChannelResponse {
  items: Array<{
    snippet: {
      title: string;
    };
  }>;
}

export type StreamCheckStrategy = 'api' | 'scrape';

export interface PlatformStrategies {
  twitch: StreamCheckStrategy;
  youtube: StreamCheckStrategy;
  kick: StreamCheckStrategy;
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
  strategies: PlatformStrategies;
}

export interface ApiCredentials {
  twitch: {
    clientId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    isLoggedIn: boolean;
    username?: string;
    displayName?: string;
  };

  youtube: {
    clientId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    isLoggedIn: boolean;
    displayName?: string;
  };

  kick: {
    clientId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    isLoggedIn: boolean;
    username?: string;
    displayName?: string;
  };
}
