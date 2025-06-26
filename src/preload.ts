import { contextBridge, ipcRenderer } from 'electron';
import { StreamerAccount } from './types/Streamer';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object

contextBridge.exposeInMainWorld('electronAPI', {

  // Config methods
  getAccounts: () => ipcRenderer.invoke('config:getAccounts'),
  addAccount: (account: Omit<StreamerAccount, 'id'>) => ipcRenderer.invoke('config:addAccount', account),
  updateAccount: (id: string, updates: Partial<StreamerAccount>) => ipcRenderer.invoke('config:updateAccount', id, updates),
  removeAccount: (id: string) => ipcRenderer.invoke('config:removeAccount', id),

  // Settings methods
  getNotificationsEnabled: () => ipcRenderer.invoke('config:getNotificationsEnabled'),
  setNotificationsEnabled: (enabled: boolean) => ipcRenderer.invoke('config:setNotificationsEnabled', enabled),
  getCheckInterval: () => ipcRenderer.invoke('config:getCheckInterval'),
  setCheckInterval: (interval: number) => ipcRenderer.invoke('config:setCheckInterval', interval),

  // API Credentials methods
  getApiCredentials: () => ipcRenderer.invoke('config:getApiCredentials'),
  setApiCredentials: (credentials: any) => ipcRenderer.invoke('config:setApiCredentials', credentials),  // OAuth methods for all platforms
  authenticateTwitch: () => ipcRenderer.invoke('oauth:authenticateTwitch'),
  logoutTwitch: () => ipcRenderer.invoke('oauth:logoutTwitch'),
  authenticateYouTube: () => ipcRenderer.invoke('oauth:authenticateYouTube'),
  logoutYouTube: () => ipcRenderer.invoke('oauth:logoutYouTube'),
  authenticateKick: () => ipcRenderer.invoke('oauth:authenticateKick'),
  logoutKick: () => ipcRenderer.invoke('oauth:logoutKick'),

  // Stream checking
  checkStreamStatus: (account: StreamerAccount) => ipcRenderer.invoke('stream:checkStatus', account),

  // Window methods
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Event listeners
  onStreamStatusUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('stream:statusUpdate', (event, data) => callback(data));
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
