import Store from 'electron-store';
import { StreamerAccount, AppConfig, ApiCredentials, PlatformStrategies, StreamCheckStrategy, SmartCheckingConfig } from '../types/streamer';
import { app } from 'electron';
import path from 'node:path';
import { IScrapingConfigService } from './scraping.service';

export class ConfigService implements IScrapingConfigService {
  private store: Store<AppConfig>;

  constructor() {
    // Set the app name to ensure consistent storage location
    // Use the productName from package.json for proper app identification
    if (!app.getName() || app.getName() === 'Electron') {
      app.setName('Streamer Alerts');
    }
    
    this.store = new Store<AppConfig>({
      name: 'config',
      defaults: {
        accounts: [],
        notificationsEnabled: true,
        launchOnStartup: false, // Default to not launching on startup
        smartChecking: {
          onlineCheckInterval: 30, // 30 minutes
          offlineCheckInterval: 2, // 2 minutes
          exponentialBackoffMultiplier: 1.8, // More aggressive backoff than 1.5
          backoffMaxInterval: 45, // 45 minutes
          jitterPercentage: 20, // Better spread of API requests
          disableOnlineChecks: true, // Keep checking online channels by default
          resetStatusOnStartup: true // Reset status on app startup for clean state
        },
        windowSettings: {
          width: 1280,
          height: 720
        },
        strategies: {
          twitch: 'scrape',
          youtube: 'scrape',
          kick: 'scrape'
        },
        apiCredentials: {
          twitch: {
            clientId: '',
            accessToken: '',
            refreshToken: '',
            expiresAt: 0,
            isLoggedIn: false,
            username: '',
            displayName: ''
          },
          youtube: {
            clientId: '',
            accessToken: '',
            refreshToken: '',
            expiresAt: 0,
            isLoggedIn: false,
            displayName: ''
          },
          kick: {
            clientId: '',
            accessToken: '',
            refreshToken: '',
            expiresAt: 0,
            isLoggedIn: false,
            username: '',
            displayName: ''
          }
        }
      }
    });
  }

  public getAccounts(): StreamerAccount[] {
    return this.store.get('accounts', []);
  }

  public addAccount(account: Omit<StreamerAccount, 'id'>): StreamerAccount {
    const accounts = this.getAccounts();
    const newAccount: StreamerAccount = {
      ...account,
      id: this.generateId(),
      enabled: true,
      lastStatus: 'offline',
      isNewlyAdded: true // Mark as newly added for initial background check
    };

    accounts.push(newAccount);
    this.store.set('accounts', accounts);
    return newAccount;
  }

  public updateAccount(id: string, updates: Partial<StreamerAccount>): boolean {
    const accounts = this.getAccounts();
    const index = accounts.findIndex(acc => acc.id === id);

    if (index === -1) return false;

    accounts[index] = { ...accounts[index], ...updates };
    this.store.set('accounts', accounts);
    return true;
  }

  public removeAccount(id: string): boolean {
    const accounts = this.getAccounts();
    const filteredAccounts = accounts.filter(acc => acc.id !== id);

    if (filteredAccounts.length === accounts.length) return false;

    this.store.set('accounts', filteredAccounts);
    return true;
  }

  public isNotificationsEnabled(): boolean {
    return this.store.get('notificationsEnabled', true);
  }

  public setNotificationsEnabled(enabled: boolean): void {
    this.store.set('notificationsEnabled', enabled);
  }

  public isLaunchOnStartupEnabled(): boolean {
    return this.store.get('launchOnStartup', false);
  }

  public setLaunchOnStartupEnabled(enabled: boolean): void {
    this.store.set('launchOnStartup', enabled);
  }

  public getWindowSettings(): { width: number; height: number } {
    return this.store.get('windowSettings', { width: 1280, height: 720 });
  }

  public setWindowSettings(settings: { width: number; height: number }): void {
    this.store.set('windowSettings', settings);
  } 
  
  public getApiCredentials(): ApiCredentials {

    const stored = this.store.get('apiCredentials', {
      twitch: {
        clientId: '',
        accessToken: '',
        refreshToken: '',
        expiresAt: 0,
        isLoggedIn: false,
        username: '',
        displayName: ''
      },
      youtube: {
        clientId: '',
        accessToken: '',
        refreshToken: '',
        expiresAt: 0,
        isLoggedIn: false,
        displayName: ''
      },
      kick: {
        clientId: '',
        accessToken: '',
        refreshToken: '',
        expiresAt: 0,
        isLoggedIn: false,
        username: '',
        displayName: ''
      }
    });

    return stored;
  }

  public setApiCredentials(credentials: ApiCredentials): void {
    this.store.set('apiCredentials', credentials);
  }  

  // OAuth methods for all platforms
  
  public setTwitchOAuthCredentials(accessToken: string, refreshToken?: string, expiresAt?: number, username?: string, displayName?: string, clientId?: string): void {
    const credentials = this.getApiCredentials();
    credentials.twitch = {
      clientId: clientId || credentials.twitch.clientId || '',
      accessToken,
      refreshToken,
      expiresAt,
      isLoggedIn: true,
      username,
      displayName
    };    
    this.setApiCredentials(credentials);
  }

  public setYouTubeOAuthCredentials(accessToken: string, refreshToken?: string, expiresAt?: number, displayName?: string, clientId?: string): void {
    const credentials = this.getApiCredentials();
    credentials.youtube = {
      clientId: clientId || credentials.youtube.clientId || '',
      accessToken,
      refreshToken,
      expiresAt,
      isLoggedIn: true,
      displayName
    };    
    this.setApiCredentials(credentials);
  }

  public setKickOAuthCredentials(accessToken: string, refreshToken?: string, expiresAt?: number, username?: string, displayName?: string, clientId?: string): void { 
    const credentials = this.getApiCredentials();
    credentials.kick = {
      clientId: clientId || credentials.kick.clientId || '',
      accessToken,
      refreshToken,
      expiresAt,
      isLoggedIn: true,
      username,
      displayName
    };
    this.setApiCredentials(credentials);
  }

  // Logout functions
  public logoutTwitch(): void {
    const credentials = this.getApiCredentials();
    credentials.twitch = {
      clientId: credentials.twitch.clientId || '',      
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      isLoggedIn: false,
      username: '',
      displayName: ''
    };
    this.setApiCredentials(credentials);
  }

  public logoutKick(): void {
    const credentials = this.getApiCredentials();

    credentials.kick = {
      clientId: credentials.kick.clientId || '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      isLoggedIn: false,
      username: '',
      displayName: ''
    };

    this.setApiCredentials(credentials);
  }

  public logoutYouTube(): void {

    const credentials = this.getApiCredentials();

    credentials.youtube = {
      clientId: credentials.youtube.clientId || '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      isLoggedIn: false,
      displayName: ''
    };

    this.setApiCredentials(credentials);
  }

  // Strategy management methods

  public getStrategies(): PlatformStrategies {
    return this.store.get('strategies', {
      twitch: 'api',
      youtube: 'api',
      kick: 'api'
    });
  }

  public setStrategies(strategies: PlatformStrategies): void {
    this.store.set('strategies', strategies);
  }

  public setPlatformStrategy(platform: 'twitch' | 'youtube' | 'kick', strategy: StreamCheckStrategy): void {
    const strategies = this.getStrategies();
    strategies[platform] = strategy;
    this.setStrategies(strategies);
  }

  // Smart checking configuration methods

  public getSmartChecking(): SmartCheckingConfig {
    return this.store.get('smartChecking', {
      onlineCheckInterval: 30,  // 30 minutes
      offlineCheckInterval: 3,  // 3 minutes  
      exponentialBackoffMultiplier: 1.8,
      backoffMaxInterval: 45,   // 45 minutes
      jitterPercentage: 15,
      disableOnlineChecks: false,
      resetStatusOnStartup: true // Renamed from resetStatusOnAppClose
    });
  }

  public setSmartChecking(config: SmartCheckingConfig): void {
    this.store.set('smartChecking', config);
  }

  public updateSmartCheckingSetting<K extends keyof SmartCheckingConfig>(
    key: K, 
    value: SmartCheckingConfig[K]
  ): void {
    const currentConfig = this.getSmartChecking();
    currentConfig[key] = value;
    this.setSmartChecking(currentConfig);
  }

  // User API Credentials Management
  public setUserApiCredentials(userCredentials: { twitch: string; youtube: string; kick: { clientId: string; clientSecret: string } }): void {
    const credentials = this.getApiCredentials();
    
    // Update the client IDs in the main credentials structure
    credentials.twitch.clientId = userCredentials.twitch;
    credentials.youtube.clientId = userCredentials.youtube;
    credentials.kick.clientId = userCredentials.kick.clientId;
    
    this.setApiCredentials(credentials);
    
    // Store Kick client secret separately for security (it's sensitive)
    if (userCredentials.kick.clientSecret) {
      this.store.set('kickClientSecret', userCredentials.kick.clientSecret);
    }
  }

  public getKickClientSecret(): string {
    return this.store.get('kickClientSecret', '') as string;
  }

  public updateUserApiCredential(platform: 'twitch' | 'youtube' | 'kick', value: string | { clientId: string; clientSecret: string }): void {
    const credentials = this.getApiCredentials();
    
    if (platform === 'kick' && typeof value === 'object') {
      credentials.kick.clientId = value.clientId;
      this.setApiCredentials(credentials);
      if (value.clientSecret) {
        this.store.set('kickClientSecret', value.clientSecret);
      }
    } else if (platform === 'twitch' && typeof value === 'string') {
      credentials.twitch.clientId = value;
      this.setApiCredentials(credentials);
    } else if (platform === 'youtube' && typeof value === 'string') {
      credentials.youtube.clientId = value;
      this.setApiCredentials(credentials);
    }
  }

  public hasUserApiCredentials(): boolean {
    const credentials = this.getApiCredentials();
    const kickSecret = this.getKickClientSecret();
    return !!(credentials.twitch.clientId || credentials.youtube.clientId || (credentials.kick.clientId && kickSecret));
  }

  /**
   * Get the path to the configuration file for opening in file explorer
   */
  public getConfigPath(): string {
    return this.store.path;
  }

  /**
   * Get the directory containing the configuration files
   */
  public getConfigDirectory(): string {
    return path.dirname(this.store.path);
  }


  /**
   * Get selected browser preference
   */
  public getSelectedBrowserPath(): string | null {
    return this.store.get('selectedBrowserPath', null) as string | null;
  }

  /**
   * Set selected browser preference
   */
  public setSelectedBrowserPath(path: string | null): void {
    if (path) {
      this.store.set('selectedBrowserPath', path);
    } else {
      this.store.delete('selectedBrowserPath');
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

}
