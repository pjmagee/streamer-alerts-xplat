import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI } from './types/electron-api';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object

const electronAPI: ElectronAPI = {
  getAccounts: () => ipcRenderer.invoke('config:getAccounts'),
  addAccount: (account) => ipcRenderer.invoke('config:addAccount', account),
  updateAccount: (id, updates) => ipcRenderer.invoke('config:updateAccount', id, updates),
  removeAccount: (id) => ipcRenderer.invoke('config:removeAccount', id),
  getNotificationsEnabled: () => ipcRenderer.invoke('config:getNotificationsEnabled'),
  setNotificationsEnabled: (enabled) => ipcRenderer.invoke('config:setNotificationsEnabled', enabled),
  getLaunchOnStartup: () => ipcRenderer.invoke('config:getLaunchOnStartup'),
  setLaunchOnStartup: (enabled) => ipcRenderer.invoke('config:setLaunchOnStartup', enabled),
  isAppPackaged: () => ipcRenderer.invoke('app:isPackaged'),
  getStrategies: () => ipcRenderer.invoke('config:getStrategies'),
  setStrategies: (strategies) => ipcRenderer.invoke('config:setStrategies', strategies),
  setPlatformStrategy: (platform, strategy) => ipcRenderer.invoke('config:setPlatformStrategy', platform, strategy),
  getApiCredentials: () => ipcRenderer.invoke('config:getApiCredentials'),
  setApiCredentials: (credentials) => ipcRenderer.invoke('config:setApiCredentials', credentials),
  getKickClientSecret: () => ipcRenderer.invoke('config:getKickClientSecret'),
  getSmartChecking: () => ipcRenderer.invoke('config:getSmartChecking'),
  setSmartChecking: (config) => ipcRenderer.invoke('config:setSmartChecking', config),
  updateSmartCheckingSetting: (key, value) => ipcRenderer.invoke('config:updateSmartCheckingSetting', key, value),
  authenticateTwitch: () => ipcRenderer.invoke('oauth:authenticateTwitch'),
  logoutTwitch: () => ipcRenderer.invoke('oauth:logoutTwitch'),
  authenticateYouTube: () => ipcRenderer.invoke('oauth:authenticateYouTube'),
  logoutYouTube: () => ipcRenderer.invoke('oauth:logoutYouTube'),
  authenticateKick: () => ipcRenderer.invoke('oauth:authenticateKick'),
  logoutKick: () => ipcRenderer.invoke('oauth:logoutKick'),
  checkStreamStatus: (account) => ipcRenderer.invoke('stream:checkStatus', account),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openConfigDirectory: () => ipcRenderer.invoke('shell:openConfigDirectory'),  
  onStreamStatusUpdate: (callback) => ipcRenderer.on('stream:statusUpdate', (_, data) => callback(data)),
  getUserApiCredentials: () => ipcRenderer.invoke('config:getUserApiCredentials'),
  setUserApiCredentials: (credentials) => ipcRenderer.invoke('config:setUserApiCredentials', credentials),
  updateUserApiCredential: (platform, value) => ipcRenderer.invoke('config:updateUserApiCredential', platform, value),
  hasUserApiCredentials: () => ipcRenderer.invoke('config:hasUserApiCredentials'),
  getPuppeteerStatus: () => ipcRenderer.invoke('puppeteer:getStatus'),
  resetPuppeteerStatus: () => ipcRenderer.invoke('puppeteer:resetStatus'),
  // Browser download APIs
  getSupportedBrowsers: () => ipcRenderer.invoke('browser:getSupportedBrowsers'),
  canDownloadBrowser: (browser, buildId) => ipcRenderer.invoke('browser:canDownload', browser, buildId),
  downloadBrowser: (options) => ipcRenderer.invoke('browser:download', options),
  uninstallBrowser: (browser: string, buildId?: string) => ipcRenderer.invoke('browser:uninstall', browser, buildId || 'latest'),
  cancelBrowserDownload: () => ipcRenderer.invoke('browser:cancelDownload'),
  isBrowserDownloading: () => ipcRenderer.invoke('browser:isDownloading'),
  getLatestBuildId: (browser) => ipcRenderer.invoke('browser:getLatestBuildId', browser),
  onBrowserDownloadStarted: (callback) => ipcRenderer.on('browser:downloadStarted', (_, data) => callback(data)),
  onBrowserDownloadCompleted: (callback) => ipcRenderer.on('browser:downloadCompleted', (_, data) => callback(data)),
  onBrowserDownloadError: (callback) => ipcRenderer.on('browser:downloadError', (_, data) => callback(data)),  onBrowserDownloadCancelled: (callback) => ipcRenderer.on('browser:downloadCancelled', () => callback()),
  
  // Browser selection APIs
  getAvailableBrowsers: () => ipcRenderer.invoke('browser:getAvailable'),
  getSelectedBrowserPath: () => ipcRenderer.invoke('config:getSelectedBrowserPath'),
  setSelectedBrowserPath: (path: string | null) => ipcRenderer.invoke('config:setSelectedBrowserPath', path),

  // App meta
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getAppDependencies: () => ipcRenderer.invoke('app:getDependencies')
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
