import { StreamerAccount, ApiCredentials, StreamerStatus, PlatformStrategies } from './types/streamer';
import './index.css';

class StreamerAlertsRenderer {
  private accounts: StreamerAccount[] = [];
  private addAccountModal: HTMLElement | null = null;
  private editAccountModal: HTMLElement | null = null;
  private currentEditingId: string | null = null;

  constructor() {
    this.init();
  }

  async init(): Promise<void> {
    this.setupEventListeners();
    this.setupModals();
    await this.loadSettings();
    await this.loadAccounts();
    await this.loadApiCredentials();
    
    // Listen for stream status updates from main process
    window.electronAPI.onStreamStatusUpdate((statusUpdates: StreamerStatus[]) => {
      this.handleStreamStatusUpdates(statusUpdates);
    });
  }

  setupEventListeners(): void {
    // Add account button
    const addAccountBtn = document.getElementById('addAccountBtn');
    addAccountBtn?.addEventListener('click', () => this.showAddAccountModal());

    // Settings
    const notificationsCheckbox = document.getElementById('notificationsEnabled') as HTMLInputElement;
    notificationsCheckbox?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      window.electronAPI.setNotificationsEnabled(target.checked);
    });

    const checkIntervalInput = document.getElementById('checkInterval') as HTMLInputElement;
    checkIntervalInput?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const minutes = parseInt(target.value, 10);
      if (minutes > 0) {
        window.electronAPI.setCheckInterval(minutes * 60000); // Convert to milliseconds
      }
    });

    // Strategy controls
    const strategyRadios = document.querySelectorAll('input[name$="Strategy"]');
    strategyRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const platform = target.name.replace('Strategy', '') as 'twitch' | 'youtube' | 'kick';
        const strategy = target.value as 'api' | 'scrape';
        console.log(`Strategy changed: ${platform} = ${strategy}`);
        // TODO: Call backend method when available
        // window.electronAPI.setPlatformStrategy(platform, strategy);
      });
    });

    // Platform specific handlers
    this.setupApiHandlers();
  }

  setupModals(): void {
    // Add Account Modal
    this.addAccountModal = document.getElementById('addAccountModal');
    const addAccountForm = document.getElementById('addAccountForm');
    const cancelAddBtn = document.getElementById('cancelBtn');

    addAccountForm?.addEventListener('submit', (e) => this.handleAddAccount(e));
    cancelAddBtn?.addEventListener('click', () => this.hideAddAccountModal());

    // Edit Account Modal
    this.editAccountModal = document.getElementById('editAccountModal');
    const editAccountForm = document.getElementById('editAccountForm');
    const cancelEditBtn = document.getElementById('editCancelBtn');

    editAccountForm?.addEventListener('submit', (e) => this.handleEditAccount(e));
    cancelEditBtn?.addEventListener('click', () => this.hideEditAccountModal());

    // Close buttons (X)
    const addModalCloseBtn = this.addAccountModal?.querySelector('.close');
    const editModalCloseBtn = this.editAccountModal?.querySelector('.close');
    
    addModalCloseBtn?.addEventListener('click', () => this.hideAddAccountModal());
    editModalCloseBtn?.addEventListener('click', () => this.hideEditAccountModal());

    // Click outside to close modals
    this.addAccountModal?.addEventListener('click', (e) => {
      if (e.target === this.addAccountModal) {
        this.hideAddAccountModal();
      }
    });

    this.editAccountModal?.addEventListener('click', (e) => {
      if (e.target === this.editAccountModal) {
        this.hideEditAccountModal();
      }
    });
  }

  setupApiHandlers(): void {
    // Twitch OAuth
    const twitchLoginBtn = document.getElementById('twitchLoginBtn');
    const twitchLogoutBtn = document.getElementById('twitchLogoutBtn');
    
    twitchLoginBtn?.addEventListener('click', async () => {
      const result = await window.electronAPI.authenticateTwitch();
      if (result.success) {
        await this.loadApiCredentials();
      } else {
        this.showError('Twitch authentication failed: ' + (result.error || 'Unknown error'));
      }
    });

    twitchLogoutBtn?.addEventListener('click', async () => {
      await window.electronAPI.logoutTwitch();
      await this.loadApiCredentials();
    });

    // YouTube OAuth
    const youtubeLoginBtn = document.getElementById('youtubeLoginBtn');
    const youtubeLogoutBtn = document.getElementById('youtubeLogoutBtn');
    
    youtubeLoginBtn?.addEventListener('click', async () => {
      const result = await window.electronAPI.authenticateYouTube();
      if (result.success) {
        await this.loadApiCredentials();
      } else {
        this.showError('YouTube authentication failed: ' + (result.error || 'Unknown error'));
      }
    });

    youtubeLogoutBtn?.addEventListener('click', async () => {
      await window.electronAPI.logoutYouTube();
      await this.loadApiCredentials();
    });

    // Kick OAuth
    const kickLoginBtn = document.getElementById('kickLoginBtn');
    const kickLogoutBtn = document.getElementById('kickLogoutBtn');
    
    kickLoginBtn?.addEventListener('click', async () => {
      const result = await window.electronAPI.authenticateKick();
      if (result.success) {
        await this.loadApiCredentials();
      } else {
        this.showError('Kick authentication failed: ' + (result.error || 'Unknown error'));
      }
    });

    kickLogoutBtn?.addEventListener('click', async () => {
      await window.electronAPI.logoutKick();
      await this.loadApiCredentials();
    });
  }

  async loadSettings(): Promise<void> {
    try {
      const notificationsEnabled = await window.electronAPI.getNotificationsEnabled();
      const checkInterval = await window.electronAPI.getCheckInterval();
      const strategies = await window.electronAPI.getStrategies();

      const notificationsCheckbox = document.getElementById('notificationsEnabled') as HTMLInputElement;
      const checkIntervalInput = document.getElementById('checkInterval') as HTMLInputElement;

      if (notificationsCheckbox) {
        notificationsCheckbox.checked = notificationsEnabled;
      }

      if (checkIntervalInput) {
        checkIntervalInput.value = String(checkInterval / 60000); // Convert from milliseconds to minutes
      }

      // Load strategy settings
      this.loadStrategies(strategies);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async loadAccounts(): Promise<void> {
    try {
      this.accounts = await window.electronAPI.getAccounts();
      this.renderAccounts();
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  }

  async loadApiCredentials(): Promise<void> {
    try {
      const credentials = await window.electronAPI.getApiCredentials();
      this.updateApiCredentialsUI(credentials);
    } catch (error) {
      console.error('Failed to load API credentials:', error);
    }
  }

  loadStrategies(strategies: PlatformStrategies): void {
    // Load Twitch strategy
    const twitchScrape = document.getElementById('twitchScrape') as HTMLInputElement;
    const twitchAPI = document.getElementById('twitchAPI') as HTMLInputElement;
    if (strategies.twitch === 'scrape') {
      twitchScrape.checked = true;
    } else {
      twitchAPI.checked = true;
    }

    // Load YouTube strategy
    const youtubeScrape = document.getElementById('youtubeScrape') as HTMLInputElement;
    const youtubeAPI = document.getElementById('youtubeAPI') as HTMLInputElement;
    if (strategies.youtube === 'scrape') {
      youtubeScrape.checked = true;
    } else {
      youtubeAPI.checked = true;
    }

    // Load Kick strategy
    const kickScrape = document.getElementById('kickScrape') as HTMLInputElement;
    const kickAPI = document.getElementById('kickAPI') as HTMLInputElement;
    if (strategies.kick === 'scrape') {
      kickScrape.checked = true;
    } else {
      kickAPI.checked = true;
    }
  }

  updateApiCredentialsUI(credentials: ApiCredentials): void {
    // Update Twitch UI
    const twitchStatus = document.getElementById('twitchStatus');
    const twitchLoginBtn = document.getElementById('twitchLoginBtn');
    const twitchLogoutBtn = document.getElementById('twitchLogoutBtn');

    if (credentials.twitch?.accessToken) {
      if (twitchStatus) {
        twitchStatus.textContent = `Logged in as ${credentials.twitch.displayName || credentials.twitch.username || 'Unknown'}`;
        twitchStatus.className = 'status logged-in';
      }
      if (twitchLoginBtn) twitchLoginBtn.style.display = 'none';
      if (twitchLogoutBtn) twitchLogoutBtn.style.display = 'inline-block';
    } else {
      if (twitchStatus) {
        twitchStatus.textContent = 'Not logged in';
        twitchStatus.className = 'status logged-out';
      }
      if (twitchLoginBtn) twitchLoginBtn.style.display = 'inline-block';
      if (twitchLogoutBtn) twitchLogoutBtn.style.display = 'none';
    }

    // Update YouTube UI
    const youtubeStatus = document.getElementById('youtubeStatus');
    const youtubeLoginBtn = document.getElementById('youtubeLoginBtn');
    const youtubeLogoutBtn = document.getElementById('youtubeLogoutBtn');

    if (credentials.youtube?.accessToken) {
      if (youtubeStatus) {
        youtubeStatus.textContent = `Logged in as ${credentials.youtube.displayName || 'Unknown'}`;
        youtubeStatus.className = 'status logged-in';
      }
      if (youtubeLoginBtn) youtubeLoginBtn.style.display = 'none';
      if (youtubeLogoutBtn) youtubeLogoutBtn.style.display = 'inline-block';
    } else {
      if (youtubeStatus) {
        youtubeStatus.textContent = 'Not logged in';
        youtubeStatus.className = 'status logged-out';
      }
      if (youtubeLoginBtn) youtubeLoginBtn.style.display = 'inline-block';
      if (youtubeLogoutBtn) youtubeLogoutBtn.style.display = 'none';
    }

    // Update Kick UI
    const kickStatus = document.getElementById('kickStatus');
    const kickLoginBtn = document.getElementById('kickLoginBtn');
    const kickLogoutBtn = document.getElementById('kickLogoutBtn');

    if (credentials.kick?.accessToken) {
      if (kickStatus) {
        kickStatus.textContent = `Logged in as ${credentials.kick.displayName || credentials.kick.username || 'Unknown'}`;
        kickStatus.className = 'status logged-in';
      }
      if (kickLoginBtn) kickLoginBtn.style.display = 'none';
      if (kickLogoutBtn) kickLogoutBtn.style.display = 'inline-block';
    } else {
      if (kickStatus) {
        kickStatus.textContent = 'Not logged in';
        kickStatus.className = 'status logged-out';
      }
      if (kickLoginBtn) kickLoginBtn.style.display = 'inline-block';
      if (kickLogoutBtn) kickLogoutBtn.style.display = 'none';
    }

    // Update help text
    this.updateHelpText(credentials);
  }

  updateHelpText(credentials: ApiCredentials): void {
    const twitchHelp = document.getElementById('twitchHelp');
    const youtubeHelp = document.getElementById('youtubeHelp');
    const kickHelp = document.getElementById('kickHelp');

    if (twitchHelp) {
      if (credentials.twitch?.accessToken) {
        twitchHelp.textContent = 'Authenticated and ready for stream monitoring';
      } else {
        twitchHelp.textContent = 'Login required for stream status monitoring';
      }
    }

    if (youtubeHelp) {
      if (credentials.youtube?.accessToken) {
        youtubeHelp.textContent = 'Authenticated and ready for stream monitoring';
      } else {
        youtubeHelp.textContent = 'Login required for stream status monitoring';
      }
    }

    if (kickHelp) {
      if (credentials.kick?.accessToken) {
        kickHelp.textContent = 'Authenticated and ready for stream monitoring';
      } else {
        kickHelp.textContent = 'Login required for stream status monitoring';
      }
    }
  }

  renderAccounts(): void {
    const accountsList = document.getElementById('accountsList');
    if (!accountsList) return;

    if (this.accounts.length === 0) {
      accountsList.innerHTML = '<p class="no-accounts">No streamers added yet. Click "Add Streamer" to get started!</p>';
      return;
    }

    accountsList.innerHTML = this.accounts.map(account => this.createAccountHTML(account)).join('');

    // Add event listeners for account actions
    this.accounts.forEach(account => {
      const editBtn = document.getElementById(`edit-${account.id}`);
      const deleteBtn = document.getElementById(`delete-${account.id}`);
      const toggleBtn = document.getElementById(`toggle-${account.id}`);

      editBtn?.addEventListener('click', () => this.showEditAccountModal(account.id));
      deleteBtn?.addEventListener('click', () => this.deleteAccount(account.id));
      toggleBtn?.addEventListener('click', () => this.toggleAccount(account.id));
    });

    // Add event listeners for streamer links
    const streamerLinks = document.querySelectorAll('.streamer-link');
    streamerLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const url = (e.target as HTMLElement).getAttribute('data-url');
        if (url) {
          // Copy URL to clipboard or show it to user for now
          console.log('Stream URL:', url);
          this.showNotification(`Stream URL: ${url}`, 'info');
        }
      });
    });
  }

  createAccountHTML(account: StreamerAccount): string {
    const statusClass = account.lastStatus === 'live' ? 'live' : 'offline';
    const statusText = account.lastStatus === 'live' ? 'LIVE' : 'Offline';
    const enabledClass = account.enabled ? 'enabled' : 'disabled';
    const toggleText = account.enabled ? 'Disable' : 'Enable';
    
    // Build proper username display without redundant @
    let usernameDisplay = account.username;
    if (account.platform === 'youtube' && !usernameDisplay.startsWith('@')) {
      // YouTube channels might need @ prefix if they don't already have it
      usernameDisplay = `@${usernameDisplay}`;
    } else if (account.platform === 'twitch' && !usernameDisplay.startsWith('@')) {
      // Twitch usernames are displayed with @
      usernameDisplay = `@${usernameDisplay}`;
    }
    // For Kick, just use the username as-is since they don't use @ prefix
    if (account.platform === 'kick') {
      usernameDisplay = account.username;
    }
    
    // Generate the stream URL for clickable name
    const streamUrl = this.getStreamUrl(account);

    return `
      <div class="account-item ${enabledClass}">
        <div class="account-info">
          <div class="status-indicator status-${statusClass}"></div>
          <div class="account-details">
            <h4><a href="#" class="streamer-link" data-url="${streamUrl}">${account.displayName || account.username}</a></h4>
            <p class="platform">${account.platform.charAt(0).toUpperCase() + account.platform.slice(1)}</p>
            <p class="username">${usernameDisplay}</p>
            <span class="status-badge status-${statusClass}">${statusText}</span>
          </div>
        </div>
        <div class="account-actions">
          <button id="edit-${account.id}" class="btn btn-secondary btn-sm">Edit</button>
          <button id="toggle-${account.id}" class="btn btn-secondary btn-sm">${toggleText}</button>
          <button id="delete-${account.id}" class="btn btn-danger btn-sm">Delete</button>
        </div>
      </div>
    `;
  }

  private getStreamUrl(account: StreamerAccount): string {
    switch (account.platform) {
      case 'twitch':
        return `https://twitch.tv/${account.username}`;
      case 'youtube':
        return `https://youtube.com/channel/${account.username}`;
      case 'kick':
        return `https://kick.com/${account.username}`;
      default:
        return '';
    }
  }

  getStatusText(account: StreamerAccount): string {
    if (!account.lastChecked) return 'Not checked yet';
    
    const now = new Date();
    const lastChecked = new Date(account.lastChecked);
    const diffMinutes = Math.floor((now.getTime() - lastChecked.getTime()) / (1000 * 60));
    
    let statusText = account.lastStatus === 'live' ? 'Live' : 'Offline';
    
    if (diffMinutes < 5) {
      statusText += ' (just checked)';
    } else if (diffMinutes < 60) {
      statusText += ` (${diffMinutes}m ago)`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      statusText += ` (${diffHours}h ago)`;
    }
    
    return statusText;
  }

  showAddAccountModal(): void {
    if (this.addAccountModal) {
      this.addAccountModal.style.display = 'flex';
      
      // Reset form
      const form = document.getElementById('addAccountForm') as HTMLFormElement;
      if (form) {
        form.reset();
      }
    }
  }

  hideAddAccountModal(): void {
    if (this.addAccountModal) {
      this.addAccountModal.style.display = 'none';
    }
  }

  showEditAccountModal(id: string): void {
    const account = this.accounts.find(acc => acc.id === id);
    if (!account) return;

    if (this.editAccountModal) {
      this.currentEditingId = id;
      this.editAccountModal.style.display = 'flex';
      
      // Populate form with account data
      const usernameInput = document.getElementById('editUsername') as HTMLInputElement;
      const displayNameInput = document.getElementById('editDisplayName') as HTMLInputElement;
      const platformSelect = document.getElementById('editPlatform') as HTMLSelectElement;

      if (usernameInput) usernameInput.value = account.username;
      if (displayNameInput) displayNameInput.value = account.displayName || '';
      if (platformSelect) platformSelect.value = account.platform;
    }
  }

  hideEditAccountModal(): void {
    if (this.editAccountModal) {
      this.editAccountModal.style.display = 'none';
      this.currentEditingId = null;
    }
  }

  async handleAddAccount(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const account = {
      username: formData.get('username') as string,
      platform: formData.get('platform') as 'twitch' | 'youtube' | 'kick',
      displayName: formData.get('displayName') as string || undefined,
      enabled: true
    };

    try {
      await window.electronAPI.addAccount(account);
      await this.loadAccounts();
      this.hideAddAccountModal();
    } catch (error) {
      console.error('Failed to add account:', error);
      this.showError('Failed to add account');
    }
  }

  async handleEditAccount(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.currentEditingId) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const updates = {
      username: formData.get('username') as string,
      platform: formData.get('platform') as 'twitch' | 'youtube' | 'kick',
      displayName: formData.get('displayName') as string || undefined
    };

    try {
      await window.electronAPI.updateAccount(this.currentEditingId, updates);
      await this.loadAccounts();
      this.hideEditAccountModal();
    } catch (error) {
      console.error('Failed to update account:', error);
      this.showError('Failed to update account');
    }
  }

  async deleteAccount(id: string): Promise<void> {
    if (confirm('Are you sure you want to delete this streamer?')) {
      try {
        await window.electronAPI.removeAccount(id);
        await this.loadAccounts();
        this.showSuccess('Streamer deleted successfully!');
      } catch (error) {
        console.error('Failed to delete account:', error);
        this.showError('Failed to delete streamer. Please try again.');
      }
    }
  }

  async toggleAccount(id: string): Promise<void> {
    const account = this.accounts.find(acc => acc.id === id);
    if (!account) return;

    try {
      await window.electronAPI.updateAccount(id, {
        enabled: !account.enabled
      });

      await this.loadAccounts();
      const statusText = !account.enabled ? 'enabled' : 'disabled';
      this.showSuccess(`Streamer ${statusText} successfully!`);
    } catch (error) {
      console.error('Failed to toggle account:', error);
      this.showError('Failed to update streamer. Please try again.');
    }
  }

  showSuccess(message: string): void {
    this.showNotification(message, 'success');
  }

  showNotification(message: string, type: 'error' | 'success' | 'info' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);

    // Allow manual close by clicking
    notification.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  handleStreamStatusUpdates(statusUpdates: StreamerStatus[]): void {
    // Update the UI with real-time status updates
    statusUpdates.forEach(status => {
      const accountElement = document.querySelector(`[data-id="${status.account.id}"] .account-status`);
      if (accountElement) {
        accountElement.className = `account-status ${status.isLive ? 'live' : 'offline'}`;
        accountElement.textContent = status.isLive ? 'Live' : 'Offline';
      }
    });
  }

  showError(message: string): void {
    this.showNotification(message, 'error');
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new StreamerAlertsRenderer();
});
