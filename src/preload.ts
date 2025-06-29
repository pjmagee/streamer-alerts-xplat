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
  getStrategies: () => ipcRenderer.invoke('config:getStrategies'),
  setStrategies: (strategies) => ipcRenderer.invoke('config:setStrategies', strategies),
  setPlatformStrategy: (platform, strategy) => ipcRenderer.invoke('config:setPlatformStrategy', platform, strategy),
  getApiCredentials: () => ipcRenderer.invoke('config:getApiCredentials'),
  setApiCredentials: (credentials) => ipcRenderer.invoke('config:setApiCredentials', credentials),
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
  onStreamStatusUpdate: (callback) => ipcRenderer.on('stream:statusUpdate', (_, data) => callback(data))
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
