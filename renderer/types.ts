// Type definitions for the renderer process

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

export interface ApiCredentials {
  twitch?: {
    username?: string;
    displayName?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  };
  youtube?: {
    username?: string;
    displayName?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  };
  kick?: {
    username?: string;
    displayName?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  };
}

export interface AppSettings {
  notificationsEnabled: boolean;
  checkInterval: number;
}

// Electron API types exposed through preload
export interface ElectronAPI {
  // Config methods
  getAccounts: () => Promise<StreamerAccount[]>;
  addAccount: (account: Omit<StreamerAccount, 'id'>) => Promise<void>;
  updateAccount: (id: string, updates: Partial<StreamerAccount>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  
  // Settings methods
  getNotificationsEnabled: () => Promise<boolean>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  getCheckInterval: () => Promise<number>;
  setCheckInterval: (interval: number) => Promise<void>;
  
  // API Credentials methods
  getApiCredentials: () => Promise<ApiCredentials>;
  setApiCredentials: (credentials: ApiCredentials) => Promise<void>;
  
  // OAuth methods
  authenticateTwitch: () => Promise<{ success: boolean; error?: string }>;
  logoutTwitch: () => Promise<void>;
  authenticateYouTube: () => Promise<{ success: boolean; error?: string }>;
  logoutYouTube: () => Promise<void>;
  authenticateKick: () => Promise<{ success: boolean; error?: string }>;
  logoutKick: () => Promise<void>;
  
  // Legacy methods (deprecated)
  setTwitchCredentials: (clientId: string, accessToken: string) => Promise<void>;
  setYouTubeCredentials: (apiKey: string) => Promise<void>;
  setKickCredentials: (clientId?: string, accessToken?: string) => Promise<void>;
  
  // Stream checking
  checkStreamStatus: (account: StreamerAccount) => Promise<any>;
  
  // Window methods
  closeWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  
  // Event listeners
  onStreamStatusUpdate: (callback: (data: any) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// Global type augmentation for window.electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
