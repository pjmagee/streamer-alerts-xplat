import { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain, shell } from 'electron';
import * as path from 'path';
import { StreamerService } from './services/StreamerService';
import { ConfigService } from './services/ConfigService';
import { OAuthService } from './services/OAuthService';
import { StreamerAccount, StreamerStatus } from './types/Streamer';

// Set app name immediately when module loads
app.setName('Streamer Alerts');

// On Windows, set the App User Model ID to match the app name for proper notifications
if (process.platform === 'win32') {
  app.setAppUserModelId(app.getName());
}

class StreamerAlertsApp {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private streamerService: StreamerService;
  private configService: ConfigService;
  private oauthService: OAuthService;
  private checkInterval: NodeJS.Timeout | null = null;
  private notificationsEnabled = true;
  private hasLiveStreamers = false; // Track if any streamers are live

  constructor() {
    this.streamerService = new StreamerService();
    this.configService = new ConfigService();
    this.oauthService = new OAuthService(this.configService);
    this.setupApp();
    this.setupIPC();
  }

  private setupApp(): void {
    // App name is already set at module load time
    
    app.whenReady().then(async () => {
      this.createTray();
      await this.validateStoredTokens();
      this.startStreamingChecks();
    });

    app.on('window-all-closed', (event: Electron.Event) => {
      event.preventDefault(); // Prevent app from quitting
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });
  }

  private setupIPC(): void {    
    // Config IPC handlers
    ipcMain.handle('config:getAccounts', () => this.configService.getAccounts());
    ipcMain.handle('config:addAccount', (_, account) => this.configService.addAccount(account));
    ipcMain.handle('config:updateAccount', (_, id, updates) => this.configService.updateAccount(id, updates));
    ipcMain.handle('config:removeAccount', (_, id) => this.configService.removeAccount(id));
    ipcMain.handle('config:getNotificationsEnabled', () => this.configService.isNotificationsEnabled());
    ipcMain.handle('config:setNotificationsEnabled', (_, enabled) => this.configService.setNotificationsEnabled(enabled));
    ipcMain.handle('config:getCheckInterval', () => this.configService.getCheckInterval());
    ipcMain.handle('config:setCheckInterval', (_, interval) => this.configService.setCheckInterval(interval));    // API Credentials IPC handlers
    ipcMain.handle('config:getApiCredentials', () => this.configService.getApiCredentials());
    ipcMain.handle('config:setApiCredentials', (_, credentials) => this.configService.setApiCredentials(credentials));    // OAuth IPC handlers for all platforms
    ipcMain.handle('oauth:authenticateTwitch', async () => {
      try {
        const success = await this.oauthService.loginTwitch();
        if (success) {
          const credentials = this.configService.getApiCredentials();
          return { success: true, displayName: credentials.twitch.displayName || credentials.twitch.username };
        } else {
          return { success: false, error: 'Authentication failed' };
        }
      } catch (error) {
        console.error('Twitch OAuth error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('oauth:logoutTwitch', async () => {
      try {
        await this.oauthService.logoutTwitch();
        return { success: true };
      } catch (error) {
        console.error('Twitch logout error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('oauth:authenticateYouTube', async () => {
      try {
        const success = await this.oauthService.loginYouTube();
        if (success) {
          const credentials = this.configService.getApiCredentials();
          return { success: true, displayName: credentials.youtube.displayName };
        } else {
          return { success: false, error: 'Authentication failed' };
        }
      } catch (error) {
        console.error('YouTube OAuth error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('oauth:logoutYouTube', async () => {
      try {
        await this.oauthService.logoutYouTube();
        return { success: true };
      } catch (error) {
        console.error('YouTube logout error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('oauth:authenticateKick', async () => {
      try {
        const success = await this.oauthService.loginKick();
        if (success) {
          const credentials = this.configService.getApiCredentials();
          return { success: true, displayName: credentials.kick.displayName || credentials.kick.username };
        } else {
          return { success: false, error: 'Authentication failed' };
        }
      } catch (error) {
        console.error('Kick OAuth error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('oauth:logoutKick', async () => {
      try {
        await this.oauthService.logoutKick();
        return { success: true };
      } catch (error) {
        console.error('Kick logout error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Legacy API credential handlers (deprecated)
    ipcMain.handle('config:setTwitchCredentials', (_, clientId, accessToken) => this.configService.setTwitchCredentials(clientId, accessToken));
    ipcMain.handle('config:setYouTubeCredentials', (_, apiKey) => this.configService.setYouTubeCredentials(apiKey));    
    ipcMain.handle('config:setKickCredentials', (_, clientId, accessToken) => 
      this.configService.setKickCredentials(clientId, accessToken));

    // Stream checking
    ipcMain.handle('stream:checkStatus', async (_, account) => {
      return await this.streamerService.checkMultipleStreamers([account]);
    });    // Window management - hide instead of close to keep window available
    ipcMain.handle('window:close', () => {
      if (this.mainWindow) {
        this.mainWindow.hide();
      }
    });
    ipcMain.handle('window:minimize', () => {
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
    });
  }
  private createTray(): void {
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    
    let trayIcon: Electron.NativeImage;
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
      
      // Resize appropriately for different operating systems
      if (process.platform === 'win32') {
        trayIcon = trayIcon.resize({ width: 16, height: 16 });
      } else if (process.platform === 'darwin') {
        // macOS handles sizing automatically, but we can set template
        trayIcon.setTemplateImage(true);
      } else {
        // Linux
        trayIcon = trayIcon.resize({ width: 22, height: 22 });
      }
      
      if (trayIcon.isEmpty()) {
        throw new Error('Icon is empty');
      }
    } catch (error) {
      console.warn('Could not load tray icon, using fallback:', error);
      // Use an empty image as fallback
      trayIcon = nativeImage.createEmpty();
    }
    
    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('Streamer Alerts - Monitor your favorite streamers');

    // Left click opens configuration window
    this.tray.on('click', () => {
      this.createMainWindow();
    });    // Right click shows context menu
    this.tray.on('right-click', () => {
      this.showTrayContextMenu();
    });
  }

  private updateTrayIcon(hasLiveStreamers: boolean): void {
    if (!this.tray) return;
    
    const iconName = hasLiveStreamers ? 'tray-icon-alert.png' : 'tray-icon.png';
    const iconPath = path.join(__dirname, '../assets', iconName);
    
    let trayIcon: Electron.NativeImage;
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
      
      // Resize appropriately for different operating systems
      if (process.platform === 'win32') {
        trayIcon = trayIcon.resize({ width: 16, height: 16 });
      } else if (process.platform === 'darwin') {
        // macOS handles sizing automatically, but we can set template
        trayIcon.setTemplateImage(true);
      } else {
        // Linux
        trayIcon = trayIcon.resize({ width: 22, height: 22 });
      }
      
      if (!trayIcon.isEmpty()) {
        this.tray.setImage(trayIcon);
        
        // Update tooltip to reflect status
        const tooltip = hasLiveStreamers 
          ? 'Streamer Alerts - Streamers are live!' 
          : 'Streamer Alerts - Monitor your favorite streamers';
        this.tray.setToolTip(tooltip);
      }
    } catch (error) {
      console.warn('Could not update tray icon:', error);
    }
  }

  private showTrayContextMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Configuration',
        click: () => this.createMainWindow()
      },
      {
        label: this.notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications',
        click: () => this.toggleNotifications()
      },
      {
        type: 'separator'
      },
      {
        label: 'Exit',        click: () => {
          (app as any).isQuiting = true;
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
          }
          app.quit();
        }
      }
    ]);

    this.tray?.popUpContextMenu(contextMenu);
  }
  private createMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.show();
      this.mainWindow.focus();
      return;
    }

    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      show: false,
      autoHideMenuBar: true
    });

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Open DevTools for debugging
    this.mainWindow.webContents.openDevTools();

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Only set to null when the window is actually destroyed (app is quitting)
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Hide to tray instead of closing
    this.mainWindow.on('close', (event) => {
      if (!(app as any).isQuiting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private toggleNotifications(): void {
    this.notificationsEnabled = !this.notificationsEnabled;
    this.configService.setNotificationsEnabled(this.notificationsEnabled);
  }

  private async startStreamingChecks(): Promise<void> {
    // Initial check
    await this.checkStreamStatus();

    // Set up interval for regular checks (every 2 minutes)
    this.checkInterval = setInterval(async () => {
      await this.checkStreamStatus();
    }, 120000);
  }
  private async checkStreamStatus(): Promise<void> {
    if (!this.notificationsEnabled) return;

    try {
      const accounts = this.configService.getAccounts();
      const statusUpdates = await this.streamerService.checkMultipleStreamers(accounts);

      // Update account statuses in config
      for (const update of statusUpdates) {
        this.configService.updateAccount(update.account.id, {
          lastStatus: update.account.lastStatus,
          lastChecked: update.account.lastChecked
        });
      }

      // Check if any streamers are live
      const hasLiveStreamers = statusUpdates.some((update: StreamerStatus) => update.isLive);
      
      // Update tray icon if live status changed
      if (this.hasLiveStreamers !== hasLiveStreamers) {
        this.hasLiveStreamers = hasLiveStreamers;
        this.updateTrayIcon(hasLiveStreamers);
      }

      for (const update of statusUpdates) {
        if (update.isLive && update.justWentLive) {
          this.showLiveNotification(update);
        }
      }

      // Send updates to renderer if window is open
      if (this.mainWindow) {
        this.mainWindow.webContents.send('stream:statusUpdate', statusUpdates);
      }
    } catch (error) {
      console.error('Error checking stream status:', error);
    }
  }
  private showLiveNotification(streamer: StreamerStatus): void {
    if (!this.notificationsEnabled || !Notification.isSupported()) return;

    const iconPath = path.join(__dirname, '../assets/tray-icon-32.png');

    const notification = new Notification({
      title: '🔴 Streamer is Live!',
      body: `${streamer.displayName} is now live on ${streamer.platform}!\n${streamer.title || 'No title'}`,
      icon: iconPath,
      silent: false
    });

    notification.on('click', () => {
      // Open stream URL in default browser
      shell.openExternal(streamer.url);
    });

    notification.show();
  }

  private async validateStoredTokens(): Promise<void> {
    console.log('Validating stored OAuth tokens on app startup...');
    
    try {
      const credentials = this.configService.getApiCredentials();
      
      // Validate each platform's tokens
      if (credentials.twitch.isLoggedIn) {
        const twitchValid = await this.oauthService.validateAndRefreshToken('twitch');
        if (!twitchValid) {
          console.log('Twitch token validation failed - user will need to re-authenticate');
        } else {
          console.log('Twitch token validated successfully');
        }
      }
      
      if (credentials.youtube.isLoggedIn) {
        const youtubeValid = await this.oauthService.validateAndRefreshToken('youtube');
        if (!youtubeValid) {
          console.log('YouTube token validation failed - user will need to re-authenticate');
        } else {
          console.log('YouTube token validated successfully');
        }
      }
      
      if (credentials.kick.isLoggedIn) {
        const kickValid = await this.oauthService.validateAndRefreshToken('kick');
        if (!kickValid) {
          console.log('Kick token validation failed - user will need to re-authenticate');
        } else {
          console.log('Kick token validated successfully');
        }
      }
    } catch (error) {
      console.error('Error validating stored tokens:', error);
    }
  }
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].focus();
    }
  });

  new StreamerAlertsApp();
}
