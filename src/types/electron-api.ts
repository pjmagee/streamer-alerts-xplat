// Type definitions for Electron API exposed through preload script
import { StreamerAccount, StreamerStatus, ApiCredentials, PlatformStrategies, SmartCheckingConfig } from './streamer';

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email?: string;
    avatar?: string;
  };
  error?: string;
}

export interface NotificationStrategies {
  sound: boolean;
  desktop: boolean;
  tray: boolean;
}

export interface ElectronAPI {
  getNotificationsEnabled: () => Promise<boolean>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  getLaunchOnStartup: () => Promise<boolean>;
  setLaunchOnStartup: (enabled: boolean) => Promise<void>;
  getStrategies: () => Promise<PlatformStrategies>;
  setStrategies: (strategies: PlatformStrategies) => Promise<void>;
  setPlatformStrategy: (platform: keyof PlatformStrategies, strategy: PlatformStrategies[keyof PlatformStrategies]) => Promise<void>;
  
  // Smart checking configuration
  getSmartChecking: () => Promise<SmartCheckingConfig>;
  setSmartChecking: (config: SmartCheckingConfig) => Promise<void>;
  updateSmartCheckingSetting: <K extends keyof SmartCheckingConfig>(key: K, value: SmartCheckingConfig[K]) => Promise<void>;
  
  getApiCredentials: () => Promise<ApiCredentials>;
  setApiCredentials: (credentials: ApiCredentials) => Promise<void>;
  getKickClientSecret: () => Promise<string>;
  authenticateTwitch: () => Promise<AuthResult>;
  logoutTwitch: () => Promise<void>;
  authenticateYouTube: () => Promise<AuthResult>;
  logoutYouTube: () => Promise<void>;
  authenticateKick: () => Promise<AuthResult>;
  logoutKick: () => Promise<void>;
  getAccounts: () => Promise<StreamerAccount[]>;
  addAccount: (account: Omit<StreamerAccount, 'id' | 'lastChecked' | 'lastStatus'>) => Promise<void>;
  updateAccount: (id: string, updates: Partial<StreamerAccount>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  checkStreamStatus: (account: StreamerAccount) => Promise<StreamerStatus[]>;
  closeWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  openConfigDirectory: () => Promise<void>;
  onStreamStatusUpdate: (callback: (data: StreamerStatus[]) => void) => void;

  // User API Credentials
  getUserApiCredentials: () => Promise<{ twitch: string; youtube: string; kick: { clientId: string; clientSecret: string } }>;
  setUserApiCredentials: (credentials: { twitch: string; youtube: string; kick: { clientId: string; clientSecret: string } }) => Promise<void>;
  updateUserApiCredential: (platform: 'twitch' | 'youtube' | 'kick', value: string | { clientId: string; clientSecret: string }) => Promise<void>;
  hasUserApiCredentials: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
