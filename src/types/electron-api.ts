// Type definitions for Electron API exposed through preload script
import { StreamerAccount, StreamerStatus, ApiCredentials, PlatformStrategies } from './streamer';

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
  // Configuration methods
  getNotificationsEnabled: () => Promise<boolean>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  getCheckInterval: () => Promise<number>;
  setCheckInterval: (interval: number) => Promise<void>;
  getStrategies: () => Promise<PlatformStrategies>;
  setStrategies: (strategies: PlatformStrategies) => Promise<void>;
  getApiCredentials: () => Promise<ApiCredentials>;
  setApiCredentials: (credentials: ApiCredentials) => Promise<void>;

  // OAuth methods
  authenticateTwitch: () => Promise<AuthResult>;
  logoutTwitch: () => Promise<void>;
  authenticateYouTube: () => Promise<AuthResult>;
  logoutYouTube: () => Promise<void>;
  authenticateKick: () => Promise<AuthResult>;
  logoutKick: () => Promise<void>;

  // Account management
  getAccounts: () => Promise<StreamerAccount[]>;
  addAccount: (account: Omit<StreamerAccount, 'id' | 'lastChecked' | 'isLive'>) => Promise<void>;
  updateAccount: (id: string, updates: Partial<StreamerAccount>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;

  // Stream status updates
  onStreamStatusUpdate: (callback: (data: StreamerStatus[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
