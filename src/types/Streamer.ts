
export interface StreamerAccount {
  id: string;
  username: string;
  platform: 'twitch' | 'youtube' | 'kick';
  displayName?: string;
  enabled: boolean;
  lastStatus?: 'live' | 'offline';
  lastChecked?: Date;
  platformId?: string;
}

export interface StreamerStatus {
  account: StreamerAccount;
  isLive: boolean;
  justWentLive: boolean;
  title?: string;
  game?: string;
  viewerCount?: number;
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
