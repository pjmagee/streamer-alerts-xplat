import { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { 
  StreamerService, 
  ConfigService,
  OAuthService
} from './services';
import { StreamerStatus, StreamerAccount } from './types/streamer';
import logger from './utils/logger';

// Custom property to track if app is quitting
let isAppQuitting = false;

// Helper function to get correct icon path for dev vs packaged
function getIconPath(iconName: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'images', iconName)
    : path.join(__dirname, '../images', iconName);
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Vite environment variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

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
      this.initializeAutoLaunch();
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

    app.on('before-quit', async () => {
      // Clean up resources before quitting
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
      
      // Reset stream status if configured
      const smartConfig = this.configService.getSmartChecking();
      if (smartConfig.resetStatusOnAppClose) {
        const accounts = this.configService.getAccounts();
        for (const account of accounts) {
          this.configService.updateAccount(account.id, {
            lastStatus: undefined,
            nextCheckTime: undefined,
            currentCheckInterval: undefined,
            consecutiveOfflineChecks: 0
          });
        }
        logger.info('Stream statuses reset on app close');
      }
      
      await this.streamerService.cleanup();
    });
  }

  private setupIPC(): void {

    // Config IPC handlers
    ipcMain.handle('config:getAccounts', () => this.configService.getAccounts());
    ipcMain.handle('config:addAccount', (_, account) => this.configService.addAccount(account));
    ipcMain.handle('config:updateAccount', (_, id, updates) => this.configService.updateAccount(id, updates));
    ipcMain.handle('config:removeAccount', (_, id) => this.configService.removeAccount(id));
    ipcMain.handle('config:getNotificationsEnabled', () => this.configService.isNotificationsEnabled());

    ipcMain.handle('config:setNotificationsEnabled', (_, enabled) => {
      this.configService.setNotificationsEnabled(enabled);
      this.notificationsEnabled = enabled;

      // Start or stop streaming checks based on notifications setting
      if (enabled) {
        this.startStreamingChecks();
      } else {
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      }
    });

    // Launch on startup IPC handlers
    ipcMain.handle('config:getLaunchOnStartup', () => this.configService.isLaunchOnStartupEnabled());
    ipcMain.handle('config:setLaunchOnStartup', (_, enabled) => {
      this.configService.setLaunchOnStartupEnabled(enabled);
      this.setAutoLaunch(enabled);
    });

    // API Credentials IPC handlers
    ipcMain.handle('config:getApiCredentials', () => this.configService.getApiCredentials());
    ipcMain.handle('config:setApiCredentials', (_, credentials) => this.configService.setApiCredentials(credentials));
    ipcMain.handle('config:getKickClientSecret', () => this.configService.getKickClientSecret());

    // User API Credentials IPC handlers
    ipcMain.handle('config:setUserApiCredentials', (_, credentials) => this.configService.setUserApiCredentials(credentials));
    ipcMain.handle('config:updateUserApiCredential', (_, platform, value) => this.configService.updateUserApiCredential(platform, value));
    ipcMain.handle('config:hasUserApiCredentials', () => this.configService.hasUserApiCredentials());

    // OAuth IPC handlers for all platforms
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
        logger.error('Twitch OAuth error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('oauth:logoutTwitch', async () => {
      try {
        await this.oauthService.logoutTwitch();
        return { success: true };
      } catch (error) {
        logger.error('Twitch logout error:', error);
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
        logger.error('YouTube OAuth error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('oauth:logoutYouTube', async () => {
      try {
        await this.oauthService.logoutYouTube();
        return { success: true };
      } catch (error) {
        logger.error('YouTube logout error:', error);
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
        logger.error('Kick OAuth error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    ipcMain.handle('oauth:logoutKick', async () => {
      try {
        await this.oauthService.logoutKick();
        return { success: true };
      } catch (error) {
        logger.error('Kick logout error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Stream checking
    ipcMain.handle('stream:checkStatus', async (_, account) => {
      return await this.streamerService.checkMultipleStreamers([account]);
    });

    // Window management - hide instead of close to keep window available
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

    // Shell methods
    ipcMain.handle('shell:openExternal', (_, url: string) => {
      shell.openExternal(url);
    });

    // Open config directory
    ipcMain.handle('shell:openConfigDirectory', async () => {
      try {
        const configDir = this.configService.getConfigDirectory();
        logger.info('Opening config directory:', configDir);
        
        await shell.openPath(configDir);
        logger.info('Successfully opened config directory');
      } catch (error) {
        logger.error('Failed to open config directory:', error);
        throw error;
      }
    });

    // Strategy IPC handlers
    ipcMain.handle('config:getStrategies', () => this.configService.getStrategies());
    ipcMain.handle('config:setStrategies', (_, strategies) => this.configService.setStrategies(strategies));
    ipcMain.handle('config:setPlatformStrategy', (_, platform, strategy) => this.configService.setPlatformStrategy(platform, strategy));

    // Smart checking IPC handlers
    ipcMain.handle('config:getSmartChecking', () => this.configService.getSmartChecking());
    ipcMain.handle('config:setSmartChecking', (_, config) => this.configService.setSmartChecking(config));
    ipcMain.handle('config:updateSmartCheckingSetting', (_, key, value) => this.configService.updateSmartCheckingSetting(key, value));
  }

  private createTray(): void {

    let iconName: string;
    if (process.platform === 'win32') {
      iconName = 'icon.ico'; // Use main ICO for Windows tray
    } else if (process.platform === 'darwin') {
      iconName = 'tray-icon-32.png'; // Use 32px icon for macOS
    } else {
      iconName = 'tray-icon-32.png'; // Use 32px icon for Linux
    }

    const iconPath = getIconPath(iconName);

    let trayIcon: Electron.NativeImage;
    try {
      trayIcon = nativeImage.createFromPath(iconPath);

      // Platform-specific adjustments
      if (process.platform === 'darwin') {
        // macOS handles sizing automatically, but we can set template
        trayIcon.setTemplateImage(true);
      }

      if (trayIcon.isEmpty()) {
        throw new Error('Icon is empty');
      }
    } catch (error) {
      logger.warn('Could not load tray icon, trying PNG fallback:', error);
      // Try PNG fallback for Windows
      try {
        const fallbackPath = getIconPath(process.platform === 'win32' ? 'tray-icon-16.png' : 'tray-icon.png');
        logger.debug('Trying fallback icon:', fallbackPath);
        trayIcon = nativeImage.createFromPath(fallbackPath);
        logger.debug('Fallback icon loaded, isEmpty:', trayIcon.isEmpty(), 'size:', trayIcon.getSize());
        
        if (trayIcon.isEmpty()) {
          throw new Error('Fallback icon is also empty');
        }
      } catch (fallbackError) {
        logger.error('Could not load fallback tray icon, trying main icon.ico:', fallbackError);
        // Last resort - try main icon.ico
        try {
          const mainIconPath = getIconPath('icon.ico');
          logger.debug('Trying main icon.ico:', mainIconPath);
          trayIcon = nativeImage.createFromPath(mainIconPath);
          logger.debug('Main icon loaded, isEmpty:', trayIcon.isEmpty(), 'size:', trayIcon.getSize());
          
          if (trayIcon.isEmpty()) {
            throw new Error('Main icon is also empty');
          }
        } catch (mainIconError) {
          logger.error('Could not load any tray icon:', mainIconError);
          // Use an empty image as last resort
          trayIcon = nativeImage.createEmpty();
        }
      }
    }

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('Streamer Alerts - Monitor your favorite streamers');

    // Left click opens configuration window
    this.tray.on('click', () => {
      this.createMainWindow();
    });

    // Right click shows context menu
    this.tray.on('right-click', () => {
      this.showTrayContextMenu();
    });
  }

  private updateTrayIcon(hasLiveStreamers: boolean): void {
    if (!this.tray) return;

    // Use appropriately sized icons for each platform
    let iconName: string;
    if (process.platform === 'win32') {
      // On Windows, use main ICO for both states (we'll change color programmatically if needed)
      iconName = 'icon.ico';
    } else if (process.platform === 'darwin') {
      iconName = hasLiveStreamers ? 'tray-icon-alert-32.png' : 'tray-icon-32.png';
    } else {
      iconName = hasLiveStreamers ? 'tray-icon-alert-32.png' : 'tray-icon-32.png';
    }

    const iconPath = getIconPath(iconName);
    logger.debug('Updating tray icon to:', iconPath, 'hasLiveStreamers:', hasLiveStreamers);

    let trayIcon: Electron.NativeImage;
    try {
      trayIcon = nativeImage.createFromPath(iconPath);      

      // Platform-specific adjustments
      if (process.platform === 'darwin') {
        // macOS handles sizing automatically, but we can set template
        trayIcon.setTemplateImage(true);
      }

      if (!trayIcon.isEmpty()) {
        this.tray.setImage(trayIcon);

        // Update tooltip to reflect status
        const tooltip = hasLiveStreamers
          ? 'Streamer Alerts - Streamers are live!'
          : 'Streamer Alerts - Monitor your favorite streamers';
        this.tray.setToolTip(tooltip);
        logger.debug('Tray icon updated successfully');
      } else {
        logger.warn('Tray icon is empty after loading');
      }
    } catch (error) {
      logger.warn('Could not update tray icon:', error);
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
        label: 'Exit',
        click: async () => {
          isAppQuitting = true;
          if (this.checkInterval) {
            clearInterval(this.checkInterval);
          }
          await this.streamerService.cleanup();
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
      icon: getIconPath('icon.png'), // Linux app icon
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      show: false,
      autoHideMenuBar: true
    });

    // Handle renderer loading
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      this.mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Only set to null when the window is actually destroyed (app is quitting)
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Hide to tray instead of closing
    this.mainWindow.on('close', (event) => {
      if (!isAppQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private toggleNotifications(): void {
    this.notificationsEnabled = !this.notificationsEnabled;
    this.configService.setNotificationsEnabled(this.notificationsEnabled);
  }

  private setAutoLaunch(enabled: boolean): void {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        name: 'Streamer Alerts',
        path: process.execPath
      });
      logger.info(`Auto-launch ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to set auto-launch:', error);
    }
  }

  private initializeAutoLaunch(): void {
    const enabled = this.configService.isLaunchOnStartupEnabled();
    this.setAutoLaunch(enabled);
  }

  private async startStreamingChecks(): Promise<void> {
    // Cancel any existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    await this.checkStreamStatus();
    this.scheduleNextCheck();
  }

  private scheduleNextCheck(): void {
    if (this.checkInterval) {
      clearTimeout(this.checkInterval);
    }

    const accounts = this.configService.getAccounts();
    const smartConfig = this.configService.getSmartChecking();
    const now = Date.now();

    // Find the account that needs to be checked next
    let nextCheckTime = Infinity;
    let hasAccountsWithoutSchedule = false;
    
    for (const account of accounts) {
      if (account.nextCheckTime && account.nextCheckTime < nextCheckTime) {
        nextCheckTime = account.nextCheckTime;
      } else if (!account.nextCheckTime) {
        // Account has no schedule (likely reset or new)
        hasAccountsWithoutSchedule = true;
      }
    }

    // If we have accounts without schedule, check them immediately
    if (hasAccountsWithoutSchedule) {
      nextCheckTime = now + 5000; // 5 seconds delay to allow UI to load
      logger.info(`⏳ Found accounts without schedule - checking in 5 seconds`);
    } else if (nextCheckTime === Infinity) {
      // If no specific time set and no unscheduled accounts, use default interval
      nextCheckTime = now + (smartConfig.offlineCheckInterval * 60 * 1000); // Convert minutes to ms
      logger.info(`⏳ No scheduled checks found - using default interval`);
    }

    const delay = Math.max(0, nextCheckTime - now);
    
    this.checkInterval = setTimeout(async () => {
      await this.checkStreamStatus();
      this.scheduleNextCheck();
    }, delay);

    const nextCheckMinutes = Math.round(delay / 1000 / 60);
    const nextCheckSeconds = Math.round(delay / 1000);
    
    if (nextCheckMinutes > 0) {
      logger.info(`⏳ Next check cycle scheduled in ${nextCheckMinutes} minutes`);
    } else {
      logger.info(`⏳ Next check cycle scheduled in ${nextCheckSeconds} seconds`);
    }
  }

  private async checkStreamStatus(): Promise<void> {
    if (!this.notificationsEnabled) return;

    logger.info('\n═══════════════════════════════════════════════════════════');
    logger.info('🚀 Starting stream status check cycle...');

    try {
      const accounts = this.configService.getAccounts();
      const smartConfig = this.configService.getSmartChecking();
      const now = Date.now();
      
      // Filter accounts that need checking
      const accountsToCheck = accounts.filter(account => {
        // If no nextCheckTime set, check it
        if (!account.nextCheckTime) return true;
        
        // Check if it's time to check this account
        return account.nextCheckTime <= now;
      });

      if (accountsToCheck.length === 0) {
        logger.info('No accounts need checking at this time');
        return;
      }

      logger.info(`🔍 Checking ${accountsToCheck.length} accounts for stream status...`);
      
      // Log which accounts are being checked
      for (const account of accountsToCheck) {
        const timeSinceLastCheck = account.lastChecked 
          ? Math.round((now - new Date(account.lastChecked).getTime()) / 1000 / 60)
          : 'never';
        logger.info(`  📺 ${account.displayName || account.username} (${account.platform}) - Last checked: ${timeSinceLastCheck === 'never' ? 'never' : `${timeSinceLastCheck}min ago`}`);
      }
      
      const statusUpdates = await this.streamerService.checkMultipleStreamers(accountsToCheck);

      // Log results for each checked account
      logger.info('📊 Check results:');
      for (const update of statusUpdates) {
        const statusIcon = update.isLive ? '🟢 LIVE' : '🔴 OFFLINE';
        const justWentLiveText = update.justWentLive ? ' 🎉 JUST WENT LIVE!' : '';
        const titleText = update.title ? ` - "${update.title}"` : '';
        
        logger.info(`  ${statusIcon} ${update.displayName} (${update.platform})${titleText}${justWentLiveText}`);
      }

      // Update account statuses and calculate next check times
      for (const update of statusUpdates) {
        const account = accounts.find(a => a.id === update.account.id);
        if (!account) continue;

        const isOnline = update.isLive;

        // Update basic account info
        const accountUpdate: Partial<StreamerAccount> = {
          lastStatus: update.account.lastStatus,
          lastChecked: update.account.lastChecked
        };

        // Calculate next check time and update polling state
        if (isOnline) {
          // Stream is online
          if (smartConfig.disableOnlineChecks) {
            // Don't schedule next check if online checks are disabled
            accountUpdate.nextCheckTime = undefined;
            accountUpdate.currentCheckInterval = undefined;
            accountUpdate.consecutiveOfflineChecks = 0;
            logger.info(`  ⏸️  ${update.displayName}: Online checks disabled - no next check scheduled`);
          } else {
            // Use online check interval
            const nextCheck = this.calculateNextCheckTime(
              smartConfig.onlineCheckInterval * 60 * 1000, // Convert minutes to ms
              smartConfig.jitterPercentage
            );
            accountUpdate.nextCheckTime = nextCheck;
            accountUpdate.currentCheckInterval = smartConfig.onlineCheckInterval * 60 * 1000; // Store as ms for consistency
            accountUpdate.consecutiveOfflineChecks = 0;
            
            const nextCheckMinutes = Math.round((nextCheck - now) / 1000 / 60);
            logger.info(`  ⏰ ${update.displayName}: Next online check in ~${nextCheckMinutes} minutes`);
          }
        } else {
          // Stream is offline
          const consecutiveOffline = (account.consecutiveOfflineChecks || 0) + 1;
          
          // Calculate interval with exponential backoff
          let interval = smartConfig.offlineCheckInterval * 60 * 1000; // Convert minutes to ms
          if (consecutiveOffline > 1) {
            const exponentialInterval = (smartConfig.offlineCheckInterval * 60 * 1000) * Math.pow(smartConfig.exponentialBackoffMultiplier, consecutiveOffline - 1);
            logger.debug(`  🔢 ${update.displayName}: Exponential calculation: ${smartConfig.offlineCheckInterval}min * ${smartConfig.exponentialBackoffMultiplier}^${consecutiveOffline - 1} = ${exponentialInterval}ms`);
            
            interval = Math.min(exponentialInterval, smartConfig.backoffMaxInterval * 60 * 1000); // Convert max to ms
            logger.debug(`  📏 ${update.displayName}: Capped interval: Math.min(${exponentialInterval}, ${smartConfig.backoffMaxInterval * 60 * 1000}) = ${interval}ms`);
          }

          const nextCheck = this.calculateNextCheckTime(interval, smartConfig.jitterPercentage);
          accountUpdate.nextCheckTime = nextCheck;
          accountUpdate.currentCheckInterval = interval;
          accountUpdate.consecutiveOfflineChecks = consecutiveOffline;
          
          const nextCheckMinutes = Math.round((nextCheck - now) / 1000 / 60);
          const intervalMinutes = Math.round(interval / 1000 / 60);
          logger.info(`  ⏰ ${update.displayName}: Next offline check in ~${nextCheckMinutes} minutes (interval: ${intervalMinutes}min, attempt #${consecutiveOffline})`);
          logger.debug(`  🔍 ${update.displayName}: Raw values - interval: ${interval}ms, nextCheck: ${nextCheck}, now: ${now}`);
        }

        // Update the config service
        this.configService.updateAccount(account.id, accountUpdate);
        
        // Update the account object in the status update so renderer gets the latest timing info
        update.account.nextCheckTime = accountUpdate.nextCheckTime;
        update.account.currentCheckInterval = accountUpdate.currentCheckInterval;
        update.account.consecutiveOfflineChecks = accountUpdate.consecutiveOfflineChecks;
      }

      // Check if any streamers are live
      const hasLiveStreamers = statusUpdates.some((update: StreamerStatus) => update.isLive);

      // Update tray icon if live status changed
      if (this.hasLiveStreamers !== hasLiveStreamers) {
        this.hasLiveStreamers = hasLiveStreamers;
        this.updateTrayIcon(hasLiveStreamers);
      }

      // Show notifications for newly live streamers
      for (const update of statusUpdates) {
        if (update.isLive && update.justWentLive) {
          this.showLiveNotification(update);
        }
      }

      // Send updates to renderer if window is open
      if (this.mainWindow) {
        this.mainWindow.webContents.send('stream:statusUpdate', statusUpdates);
      }
      
      // Log summary
      const liveCount = statusUpdates.filter(u => u.isLive).length;
      const offlineCount = statusUpdates.filter(u => !u.isLive).length;
      const newlyLiveCount = statusUpdates.filter(u => u.justWentLive).length;
      
      logger.info(`📈 Summary: ${liveCount} live, ${offlineCount} offline${newlyLiveCount > 0 ? `, ${newlyLiveCount} just went live` : ''}`);
      logger.info('═══════════════════════════════════════════════════════════\n');
      
    } catch (error) {
      logger.error('❌ Error checking stream status:', error);
      logger.info('═══════════════════════════════════════════════════════════\n');
    }
  }

  private calculateNextCheckTime(intervalMs: number, jitterPercentage: number): number {
    const jitter = (Math.random() - 0.5) * 2 * (jitterPercentage / 100);
    const jitteredInterval = intervalMs * (1 + jitter);
    return Date.now() + Math.max(1000, jitteredInterval); // Minimum 1 second
  }

  private showLiveNotification(streamer: StreamerStatus): void {
    if (!this.notificationsEnabled || !Notification.isSupported()) return;

    const iconPath = getIconPath('tray-icon-32.png');

    const notification = new Notification({
      title: '🔴 Streamer is Live!',
      body: `${streamer.displayName} is now live on ${streamer.platform}!\n${streamer.title || 'No title'}`,
      icon: iconPath,
      silent: false,
      urgency: 'normal'
    });

    notification.on('click', () => {
      // Open stream URL in default browser
      shell.openExternal(streamer.url);
    });

    notification.show();
  }

  private async validateStoredTokens(): Promise<void> {
    logger.info('Validating stored OAuth tokens on app startup...');

    try {
      const credentials = this.configService.getApiCredentials();
      const strategies = this.configService.getStrategies();

      // Validate each platform's tokens only if strategy is 'api'
      if (credentials.twitch.isLoggedIn && strategies.twitch === 'api') {
        const twitchValid = await this.oauthService.validateAndRefreshToken('twitch');
        if (!twitchValid) {
          logger.warn('Twitch token validation failed - user will need to re-authenticate');
        } else {
          logger.info('Twitch token validated successfully');
        }
      } else if (strategies.twitch === 'scrape') {
        logger.info('Twitch strategy is set to scrape - skipping token validation');
      }

      if (credentials.youtube.isLoggedIn && strategies.youtube === 'api') {
        const youtubeValid = await this.oauthService.validateAndRefreshToken('youtube');
        if (!youtubeValid) {
          logger.warn('YouTube token validation failed - user will need to re-authenticate');
        } else {
          logger.info('YouTube token validated successfully');
        }
      } else if (strategies.youtube === 'scrape') {
        logger.info('YouTube strategy is set to scrape - skipping token validation');
      }

      if (credentials.kick.isLoggedIn && strategies.kick === 'api') {
        const kickValid = await this.oauthService.validateAndRefreshToken('kick');
        if (!kickValid) {
          logger.warn('Kick token validation failed - user will need to re-authenticate');
        } else {
          logger.info('Kick token validated successfully');
        }
      } else if (strategies.kick === 'scrape') {
        logger.info('Kick strategy is set to scrape - skipping token validation');
      }
    } catch (error) {
      logger.error('Error validating stored tokens:', error);
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
