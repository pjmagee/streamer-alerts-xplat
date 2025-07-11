import { app, BrowserWindow, Tray, Menu, nativeImage, Notification, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import { 
  StreamerService, 
  ConfigService,
  OAuthService
} from './services';
import { PuppeteerManagerService } from './services/puppeteer-manager.service';
import { 
  getDownloadedBrowsers, 
  getSupportedBrowsers, 
  installBrowser, 
  uninstallBrowser,
  canDownloadBrowser 
} from './utils/browser-manager';
import { StreamerStatus, StreamerAccount } from './types/streamer';
import logger from './utils/logger';

// Custom property to track if app is quitting
let isAppQuitting = false;

// Helper function to get correct icon path for dev vs packaged
function getIconPath(iconName: string): string {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'images', iconName)
    : path.join(__dirname, '../images', iconName);
  
  logger.debug(`getIconPath: ${iconName} -> ${iconPath} (packaged: ${app.isPackaged})`);
  return iconPath;
}

function loadTrayIcon(iconName: string): Electron.NativeImage | null {
  try {
    const iconPath = getIconPath(iconName);
    logger.debug(`Attempting to load tray icon: ${iconPath}`);
    
    // Check if file exists
    if (!fs.existsSync(iconPath)) {
      logger.warn(`Tray icon file does not exist: ${iconPath}`);
      return null;
    }
    
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      logger.warn(`Tray icon is empty: ${iconPath}`);
      return null;
    }
    
    logger.debug(`Successfully loaded tray icon: ${iconPath}, size:`, icon.getSize());
    return icon;
  } catch (error) {
    logger.error(`Error loading tray icon ${iconName}:`, error);
    return null;
  }
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
  private newAccountCheckInterval: NodeJS.Timeout | null = null; // Separate interval for newly added accounts
  private notificationsEnabled = true;
  private hasLiveStreamers = false; // Track if any streamers are live
  private recentNotifications = new Map<string, number>(); // accountId -> timestamp to prevent duplicate notifications

  constructor() {
    logger.debug('StreamerAlertsApp constructor called');
    
    try {
      this.streamerService = new StreamerService();
      this.configService = new ConfigService();
      this.oauthService = new OAuthService(this.configService);
      
      // Initialize auto-update for production builds
      if (app.isPackaged) {
        updateElectronApp({
          updateInterval: '1 hour',
          logger: console, // Use console for update-electron-app logging
          notifyUser: true,
          updateSource: {
            type: UpdateSourceType.ElectronPublicUpdateService,
            repo: 'pjmagee/streamer-alerts-updates',
          }
        });
      }
      
      this.setupApp();
      this.setupIPC();
      
      logger.debug('StreamerAlertsApp constructor completed successfully');
    } catch (error) {
      logger.error('Error in StreamerAlertsApp constructor:', error);
      throw error;
    }
  }

  public cleanup(): void {
    logger.debug('Cleaning up StreamerAlertsApp resources');
    
    // Clean up check intervals
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.newAccountCheckInterval) {
      clearInterval(this.newAccountCheckInterval);
      this.newAccountCheckInterval = null;
    }

    // Clean up tray - be more aggressive about cleanup
    if (this.tray) {
      logger.debug('Destroying tray during cleanup');
      try {
        // Remove all event listeners first
        this.tray.removeAllListeners();
        
        // Check if tray is still valid before destroying
        if (!this.tray.isDestroyed()) {
          this.tray.destroy();
        }
        
        // Force null assignment
        this.tray = null;
        
        logger.debug('Tray destroyed successfully');
      } catch (error) {
        logger.debug('Error destroying tray:', error);
        // Force null assignment even if destroy failed
        this.tray = null;
      }
    }

    // Clean up main window
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
      this.mainWindow = null;
    }

    // Clean up services
    this.streamerService.cleanup().catch(error => {
      logger.error('Error cleaning up streamer service:', error);
    });
    
    logger.debug('StreamerAlertsApp cleanup completed');
  }

  private setupApp(): void {
    app.whenReady().then(async () => {
      this.createTray();
      await this.validateStoredTokens();
      this.resetStatusOnStartup(); // Add this line
      this.initializeAutoLaunch();
      this.startStreamingChecks();
    });

    app.on('window-all-closed', () => {
        // don't quit the app when all windows are closed      
    });
    

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    app.on('before-quit', async () => {
      isAppQuitting = true;
      
      // Clean up resources before quitting
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
      }
      
      if (this.newAccountCheckInterval) {
        clearInterval(this.newAccountCheckInterval);
      }
      
      await this.streamerService.cleanup();
      
      // No hot-reload: nothing to clear
    });
  }

  private setupIPC(): void {
    // Config IPC handlers
    ipcMain.handle('config:getAccounts', () => this.configService.getAccounts());
    ipcMain.handle('config:addAccount', async (_, account) => {
      const newAccount = this.configService.addAccount(account);
      // Start the new account background check loop if not already running
      this.startNewAccountCheckLoop();
      return newAccount;
    });
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
        if (this.newAccountCheckInterval) {
          clearInterval(this.newAccountCheckInterval);
          this.newAccountCheckInterval = null;
        }
      }
    });

    // Launch on startup IPC handlers
    ipcMain.handle('config:getLaunchOnStartup', () => this.configService.isLaunchOnStartupEnabled());
    ipcMain.handle('config:setLaunchOnStartup', (_, enabled) => {
      this.configService.setLaunchOnStartupEnabled(enabled);
      this.setAutoLaunch(enabled);
    });
    ipcMain.handle('app:isPackaged', () => app.isPackaged);

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

    // Puppeteer IPC handlers
    ipcMain.handle('puppeteer:getStatus', async () => {
      const puppeteerService = PuppeteerManagerService.getInstance();
      const selectedBrowserPath = this.configService.getSelectedBrowserPath();
      return await puppeteerService.checkPuppeteerStatus(selectedBrowserPath);
    });
    ipcMain.handle('puppeteer:resetStatus', () => {
      const puppeteerService = PuppeteerManagerService.getInstance();
      puppeteerService.resetStatus();
    });

    // Browser download IPC handlers
    ipcMain.handle('browser:getSupportedBrowsers', async () => {
      return await getSupportedBrowsers();
    });
    ipcMain.handle('browser:canDownload', async (_, browser, buildId) => {
      // Use Puppeteer API to check if the browser can be downloaded
      return await canDownloadBrowser(browser, buildId);
    });
    ipcMain.handle('browser:download', async (_, options) => {
      try {
        const result = await installBrowser(options.browser, options.buildId);
        if (result.success && this.mainWindow && !this.mainWindow.isDestroyed()) {
          // Send download completed event to renderer
          this.mainWindow.webContents.send('browser:downloadCompleted', {
            browser: options.browser,
            buildId: options.buildId || 'latest',
            executablePath: result.browser?.path || ''
          });
        }
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Browser download error:', error);
        throw new Error(errorMessage);
      }
    });
    ipcMain.handle('browser:uninstall', async (_, browser, buildId) => {
      try {
        const result = await uninstallBrowser(browser, buildId);
        if (result.success && this.mainWindow && !this.mainWindow.isDestroyed()) {
          // Send uninstall completed event to renderer
          this.mainWindow.webContents.send('browser:uninstallCompleted', { browser, buildId });
        }
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Browser uninstall error:', error);
        throw new Error(errorMessage);
      }
    });
    ipcMain.handle('browser:cancelDownload', () => {
      // Note: Puppeteer Browsers API doesn't support cancellation
      // We'll need to implement this separately if needed
      logger.warn('Browser download cancellation not supported with Puppeteer Browsers API');
    });
    ipcMain.handle('browser:isDownloading', () => {
      // For now, return false as we don't track download state
      return false;
    });
    ipcMain.handle('browser:getLatestBuildId', async (_, _browser) => {
      // Return 'latest' as that's what Puppeteer Browsers API uses
      return 'latest';
    });

    // Browser selection IPC handlers
    ipcMain.handle('browser:getAvailable', () => {
      return getDownloadedBrowsers();
    });
    ipcMain.handle('config:getSelectedBrowserPath', () => {
      return this.configService.getSelectedBrowserPath();
    });
    ipcMain.handle('config:setSelectedBrowserPath', (_, path) => {
      this.configService.setSelectedBrowserPath(path);
      // Reset Puppeteer status so it uses the new browser selection
      const puppeteerService = PuppeteerManagerService.getInstance();
      puppeteerService.resetStatus();
    });

    // Smart checking IPC handlers
    ipcMain.handle('config:getSmartChecking', () => this.configService.getSmartChecking());
    ipcMain.handle('config:setSmartChecking', (_, config) => this.configService.setSmartChecking(config));
    ipcMain.handle('config:updateSmartCheckingSetting', (_, key, value) => this.configService.updateSmartCheckingSetting(key, value));
  }

  private createTray(): void {
    logger.debug('createTray() called');
    
    // Clean up any existing tray first (prevents multiple trays during hot reload)
    if (this.tray) {
      logger.debug('Destroying existing tray before creating new one');
      try {
        // Remove all event listeners first
        this.tray.removeAllListeners();
        
        // Check if tray is still valid before destroying
        if (!this.tray.isDestroyed()) {
          this.tray.destroy();
        }
        
        this.tray = null;
        logger.debug('Existing tray destroyed successfully');
      } catch (error) {
        logger.debug('Error destroying existing tray:', error);
        // Force null assignment even if destroy failed
        this.tray = null;
      }
    }

    let iconName: string;
    if (process.platform === 'win32') {
      iconName = 'icon.ico'; // Use main ICO for Windows tray
    } else if (process.platform === 'darwin') {
      iconName = 'icon.png'; // Use main PNG for macOS
    } else {
      iconName = 'icon.png'; // Use main PNG for Linux
    }

    logger.debug(`Creating tray with platform: ${process.platform}, iconName: ${iconName}`);

    // Try to load the icon with fallbacks
    let trayIcon: Electron.NativeImage | null = null;
    
    // First, try the primary icon
    trayIcon = loadTrayIcon(iconName);
    
    // If primary fails, try PNG fallback on Windows
    if (!trayIcon && process.platform === 'win32') {
      logger.warn('Primary ICO icon failed, trying PNG fallback');
      trayIcon = loadTrayIcon('icon.png');
    }
    
    // If everything fails, create an empty icon (tray will still work)
    if (!trayIcon) {
      logger.error('All tray icon loading attempts failed, using empty icon');
      trayIcon = nativeImage.createEmpty();
    }
    
    // Platform-specific adjustments
    if (process.platform === 'darwin' && !trayIcon.isEmpty()) {
      // macOS handles sizing automatically, but we can set template
      trayIcon.setTemplateImage(true);
    }

    // Create the new tray
    try {
      this.tray = new Tray(trayIcon);
      this.tray.setToolTip('Streamer Alerts - Monitor your favorite streamers');
      
      logger.debug('Tray created successfully');

      // Left click opens configuration window
      this.tray.on('click', () => {
        this.createMainWindow();
      });

      // Right click shows context menu
      this.tray.on('right-click', () => {
        this.showTrayContextMenu();
      });
    } catch (error) {
      logger.error('Failed to create tray:', error);
      this.tray = null;
    }
  }

  private updateTrayIcon(hasLiveStreamers: boolean): void {
    if (!this.tray) return;

    // Use appropriately sized icons for each platform
    let iconName: string;
    if (process.platform === 'win32') {
      // On Windows, use main ICO for both states (we'll change color programmatically if needed)
      iconName = 'icon.ico';
    } else if (process.platform === 'darwin') {
      // For macOS/Linux, fallback to main icons since tray-specific icons are missing
      iconName = 'icon.png';
    } else {
      // For Linux, fallback to main icons since tray-specific icons are missing
      iconName = 'icon.png';
    }

    const iconPath = getIconPath(iconName);
    logger.debug('Updating tray icon to:', iconPath, 'hasLiveStreamers:', hasLiveStreamers);

    const trayIcon = loadTrayIcon(iconName);
    if (trayIcon && !trayIcon.isEmpty()) {
      // Platform-specific adjustments
      if (process.platform === 'darwin') {
        // macOS handles sizing automatically, but we can set template
        trayIcon.setTemplateImage(true);
      }

      this.tray.setImage(trayIcon);

      // Update tooltip to reflect status
      const tooltip = hasLiveStreamers
        ? 'Streamer Alerts - Streamers are live!'
        : 'Streamer Alerts - Monitor your favorite streamers';
      this.tray.setToolTip(tooltip);
      logger.debug('Tray icon updated successfully');
    } else {
      logger.warn('Could not load tray icon for update');
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
          
      // No hot-reload: nothing to clear
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
      icon: getIconPath(process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
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
      // Only enable auto-launch for packaged apps (not in development)
      if (!app.isPackaged && enabled) {
        logger.warn('Auto-launch is not supported in development mode');
        return;
      }

      // For Windows with Squirrel, use the stub launcher instead of the actual executable
      let launchPath = process.execPath;
      let args: string[] = [];

      if (process.platform === 'win32' && app.isPackaged) {
        // Follow Electron's official documentation for Squirrel compatibility
        // Use the executable name one directory up, which is the Squirrel stub
        const appFolder = path.dirname(process.execPath);
        const executableName = path.basename(process.execPath);
        const stubLauncher = path.resolve(appFolder, '..', executableName);
        
        // Check if the stub launcher exists (indicates Squirrel installation)
        try {
          if (fs.existsSync(stubLauncher)) {
            launchPath = stubLauncher;
            // No special args needed for the stub launcher
            logger.info('Using Squirrel stub launcher for auto-launch:', stubLauncher);
          } else {
            logger.info('Squirrel stub launcher not found, using direct executable path');
          }
        } catch (error) {
          logger.warn('Could not check for Squirrel stub launcher, using default path:', error);
        }
      }

      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: launchPath,
        args: args
      });

      logger.info(`Auto-launch ${enabled ? 'enabled' : 'disabled'} (packaged: ${app.isPackaged}, path: ${launchPath})`);
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

    // Perform immediate check on startup - this is the first interval
    logger.info('🚀 Application starting - performing initial stream status check...');
    await this.checkStreamStatus();
    this.scheduleNextCheck();
  }

  private scheduleNextCheck(): void {
    if (this.checkInterval) {
      clearTimeout(this.checkInterval);
    }

    const accounts = this.configService.getAccounts();

    if (!this.notificationsEnabled || accounts.length === 0) {
      logger.info('⏳ Notifications disabled or no accounts - no checks scheduled');
      return;
    }

    // Use a dynamic scanning interval based on the shortest configured check interval
    // This ensures we don't miss accounts that should be checked more frequently
    const smartConfig = this.configService.getSmartChecking();
    
    // Find the shortest interval from smart config (convert minutes to ms)
    const shortestConfiguredInterval = Math.min(
      smartConfig.onlineCheckInterval * 60 * 1000,
      smartConfig.offlineCheckInterval * 60 * 1000
    );
    
    // Use the shorter of: configured interval or 5 minutes (as a reasonable maximum)
    const MAX_SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes maximum
    const SCAN_INTERVAL_MS = Math.min(shortestConfiguredInterval, MAX_SCAN_INTERVAL_MS);
    
    this.checkInterval = setTimeout(async () => {
      await this.checkStreamStatus();
      this.scheduleNextCheck();
    }, SCAN_INTERVAL_MS);

    const scanMinutes = Math.round(SCAN_INTERVAL_MS / 1000 / 60);
    const scanSeconds = Math.round(SCAN_INTERVAL_MS / 1000);
    
    if (scanMinutes > 0) {
      logger.info(`⏳ Next scan scheduled in ${scanMinutes} minutes`);
    } else {
      logger.info(`⏳ Next scan scheduled in ${scanSeconds} seconds`);
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
      
      // Filter accounts that need checking (excluding newly added accounts)
      const accountsToCheck = accounts.filter(account => {
        // Skip newly added accounts - they're handled by the separate background loop
        if (account.isNewlyAdded) return false;
        
        // If no nextCheckTime set, check if we should schedule it
        if (!account.nextCheckTime) {
          // If online checks are disabled and account was last seen live, 
          // set a far-future nextCheckTime to prevent infinite checking
          if (smartConfig.disableOnlineChecks && account.lastStatus === 'live') {
            logger.debug(`Setting far-future nextCheckTime for ${account.displayName || account.username} (online checks disabled, was live)`);
            this.configService.updateAccount(account.id, {
              nextCheckTime: now + (365 * 24 * 60 * 60 * 1000) // 1 year in the future
            });
            return false;
          }
          return true;
        }
        
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
            // Set a far future check time to prevent infinite scheduling loop
            // This account will only be re-checked if it goes offline or when user manually checks
            accountUpdate.nextCheckTime = now + (365 * 24 * 60 * 60 * 1000); // 1 year in the future
            accountUpdate.currentCheckInterval = undefined;
            accountUpdate.consecutiveOfflineChecks = 0;
            logger.info(`  ⏸️  ${update.displayName}: Online checks disabled - next check scheduled far in future to prevent re-checking`);
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

    // Check for duplicate notifications within the last 30 seconds
    const now = Date.now();
    const lastNotificationTime = this.recentNotifications.get(streamer.account.id);
    const notificationCooldownMs = 30 * 1000; // 30 seconds

    if (lastNotificationTime && (now - lastNotificationTime) < notificationCooldownMs) {
      const secondsSinceLastNotification = Math.round((now - lastNotificationTime) / 1000);
      logger.info(`⏭️  Skipping duplicate notification for ${streamer.displayName} (last notification ${secondsSinceLastNotification}s ago, within ${notificationCooldownMs/1000}s cooldown)`);
      return;
    }

    // Record this notification
    this.recentNotifications.set(streamer.account.id, now);

    // Clean up old entries (older than 5 minutes) to prevent memory leaks
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    for (const [accountId, timestamp] of this.recentNotifications.entries()) {
      if (timestamp < fiveMinutesAgo) {
        this.recentNotifications.delete(accountId);
      }
    }

    logger.info(`Creating notification for ${streamer.displayName} (${streamer.platform}) with URL: ${streamer.url}`);

    this.showNotification(streamer);
  }

  private showNotification(streamer: StreamerStatus): void {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    const iconPath = getIconPath(iconName);

    const notification = new Notification({
      title: `🔴 ${streamer.displayName} is Live!`,
      subtitle: `${streamer.platform}`,
      body: `${streamer.title || 'No title'}`,
      icon: iconPath,
      silent: false,
      urgency: 'normal'
    });

    notification.on('click', async () => {
      logger.info(`Notification clicked for ${streamer.displayName}`);
      await shell.openExternal(streamer.url);
    });

    notification.on('show', () => {
      logger.info(`Notification shown for ${streamer.displayName}`);
    });

    notification.on('close', () => {      
      logger.info(`Notification closed for ${streamer.displayName}`);
    });

    notification.on('failed', (error) => {
      logger.error(`Notification failed for ${streamer.displayName}:`, error);
    });

    try {
      notification.show();
      logger.info('Notification displayed');
    } catch (error) {
      logger.error('Failed to show notification:', error);
    }
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

  private startNewAccountCheckLoop(): void {
    // If already running, don't start another
    if (this.newAccountCheckInterval) {
      return;
    }

    logger.info('🆕 Starting background check loop for newly added accounts');
    
    // Check every 5 seconds for newly added accounts
    this.newAccountCheckInterval = setInterval(async () => {
      await this.processNewlyAddedAccounts();
    }, 5000);
  }

  private async processNewlyAddedAccounts(): Promise<void> {
    if (!this.notificationsEnabled) return;

    const accounts = this.configService.getAccounts();
    const newlyAddedAccounts = accounts.filter(account => account.isNewlyAdded);

    if (newlyAddedAccounts.length === 0) {
      // No newly added accounts, stop the background loop
      if (this.newAccountCheckInterval) {
        clearInterval(this.newAccountCheckInterval);
        this.newAccountCheckInterval = null;
        logger.info('🆕 No more newly added accounts - stopping background check loop');
      }
      return;
    }

    logger.info(`🆕 Processing ${newlyAddedAccounts.length} newly added accounts...`);

    try {
      const statusUpdates = await this.streamerService.checkMultipleStreamers(newlyAddedAccounts);
      const smartConfig = this.configService.getSmartChecking();
      const now = Date.now();

      for (const update of statusUpdates) {
        const account = newlyAddedAccounts.find(a => a.id === update.account.id);
        if (!account) continue;

        // Update basic account info and mark as no longer newly added
        const accountUpdate: Partial<StreamerAccount> = {
          lastStatus: update.account.lastStatus,
          lastChecked: update.account.lastChecked,
          isNewlyAdded: false // Clear the newly added flag
        };

        // Calculate next check time based on current status
        if (update.isLive) {
          // Stream is online
          if (smartConfig.disableOnlineChecks) {
            // Set a far future check time to prevent infinite scheduling loop
            // This account will only be re-checked if it goes offline or when user manually checks
            accountUpdate.nextCheckTime = now + (365 * 24 * 60 * 60 * 1000); // 1 year in the future
            accountUpdate.currentCheckInterval = undefined;
            accountUpdate.consecutiveOfflineChecks = 0;
            logger.info(`  ⏸️  ${update.displayName}: Online checks disabled - next check scheduled far in future to prevent re-checking`);
          } else {
            const nextCheck = this.calculateNextCheckTime(
              smartConfig.onlineCheckInterval * 60 * 1000,
              smartConfig.jitterPercentage
            );
            accountUpdate.nextCheckTime = nextCheck;
            accountUpdate.currentCheckInterval = smartConfig.onlineCheckInterval * 60 * 1000;
            accountUpdate.consecutiveOfflineChecks = 0;
            
            const nextCheckMinutes = Math.round((nextCheck - now) / 1000 / 60);
            logger.info(`  ⏰ ${update.displayName}: Next online check in ~${nextCheckMinutes} minutes`);
          }
        } else {
          // Stream is offline - use offline check interval (first check, so no exponential backoff)
          const interval = smartConfig.offlineCheckInterval * 60 * 1000;
          const nextCheck = this.calculateNextCheckTime(interval, smartConfig.jitterPercentage);
          accountUpdate.nextCheckTime = nextCheck;
          accountUpdate.currentCheckInterval = interval;
          accountUpdate.consecutiveOfflineChecks = 1;
          
          const nextCheckMinutes = Math.round((nextCheck - now) / 1000 / 60);
          logger.info(`  ⏰ ${update.displayName}: Next offline check in ~${nextCheckMinutes} minutes`);
        }

        // Update the config service
        this.configService.updateAccount(account.id, accountUpdate);
        
        // Update the account object for consistency
        update.account.nextCheckTime = accountUpdate.nextCheckTime;
        update.account.currentCheckInterval = accountUpdate.currentCheckInterval;
        update.account.consecutiveOfflineChecks = accountUpdate.consecutiveOfflineChecks;
        update.account.isNewlyAdded = false;

        // Update tray icon if needed
        const hasLiveStreamers = update.isLive || this.hasLiveStreamers;
        if (this.hasLiveStreamers !== hasLiveStreamers) {
          this.hasLiveStreamers = hasLiveStreamers;
          this.updateTrayIcon(hasLiveStreamers);
        }

        // Show notification for newly added accounts that are live (gives user feedback)
        // This helps users see what notifications look like and confirms the account was added successfully
        if (update.isLive) {
          logger.info(`  🔔 ${update.displayName}: Newly added account is live - showing notification for user feedback`);
          this.showLiveNotification(update);
        } else {
          const statusIcon = update.isLive ? '🟢 LIVE' : '🔴 OFFLINE';
          logger.info(`  ${statusIcon} ${update.displayName}: Initial check complete (offline, no notification)`);
        }

        // Send update to renderer if window is open (for UI updates only)
        if (this.mainWindow) {
          this.mainWindow.webContents.send('stream:statusUpdate', [update]);
        }
      }

      // Reschedule regular checks to account for the new accounts
      this.scheduleNextCheck();

    } catch (error) {
      logger.error(`❌ Error processing newly added accounts:`, error);
    }
  }

  private resetStatusOnStartup(): void {
    const smartConfig = this.configService.getSmartChecking();
    
    if (smartConfig.resetStatusOnStartup) {
      logger.info('🔄 Resetting streamer statuses on app startup (resetStatusOnStartup is enabled)');
      
      const accounts = this.configService.getAccounts();
      let updatedCount = 0;
      
      accounts.forEach(account => {
        if (account.lastStatus !== 'offline' || account.nextCheckTime) {
          this.configService.updateAccount(account.id, {
            lastStatus: 'offline',
            nextCheckTime: undefined, // Clear any scheduled check times
            currentCheckInterval: undefined, // Clear current check interval
            consecutiveOfflineChecks: 0 // Reset offline check count
          });
          updatedCount++;
        }
      });
      
      if (updatedCount > 0) {
        logger.info(`✅ Reset status for ${updatedCount} accounts to offline`);
      } else {
        logger.info('✅ No accounts needed status reset');
      }
    } else {
      logger.info('ℹ️ Status reset on startup is disabled');
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
