export interface StreamerAccount {
  id: string;
  username: string; // for Twitch, this is the user ID, for YouTube, this is the channel ID
  platform: 'twitch' | 'youtube' | 'kick';
  displayName?: string;
  enabled: boolean;
  lastStatus?: 'live' | 'offline';
  lastChecked?: Date;
  platformId?: string; // Used for YouTube channel IDs when username is different
  consecutiveOfflineChecks?: number; // Number of consecutive offline checks
  nextCheckTime?: number; // When to check this channel next (timestamp)
  currentCheckInterval?: number; // Current interval for this specific channel (in ms)
  isNewlyAdded?: boolean; // Flag to track if this account was just added and needs initial check
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
    title: string;
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

export interface SmartCheckingConfig {
  // Check interval for channels that are online (in minutes)
  onlineCheckInterval: number;
  
  // Check interval for channels that are offline (in minutes)
  offlineCheckInterval: number;
  
  // Exponential backoff multiplier for consecutive offline checks
  exponentialBackoffMultiplier: number;
  
  // Maximum time between checks (in minutes)
  backoffMaxInterval: number;
  
  // Random jitter percentage (0-100) to add variation to check times
  jitterPercentage: number;
  
  // Stop checking channels when they're online
  disableOnlineChecks: boolean;
  
  // Reset all channel statuses when app starts up
  resetStatusOnStartup: boolean;
}

export interface AppConfig {
  accounts: StreamerAccount[];
  notificationsEnabled: boolean;
  launchOnStartup: boolean;
  smartChecking: SmartCheckingConfig;
  windowSettings: {
    width: number;
    height: number;
  };
  apiCredentials: ApiCredentials;
  strategies: PlatformStrategies;
}

export interface Credentials{
  clientId: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
  isLoggedIn: boolean;
  username?: string;
  displayName?: string;
}

export interface ApiCredentials {  
  twitch: Credentials;
  youtube: Credentials;
  kick: Credentials;
}
