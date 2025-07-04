import { StreamerAccount, ApiCredentials, StreamerStatus, PlatformStrategies, SmartCheckingConfig } from './types/streamer';
import './index.css';
import logger from './utils/renderer-logger';

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
    await this.loadUserApiCredentials();
    
    // Load browsers before checking status
    await this.loadDownloadedBrowsersList();
    await this.refreshChromeStatus();
    
    // Start timing updates for account information
    this.startTimingUpdates();
    
    // Listen for stream status updates from main process
    window.electronAPI.onStreamStatusUpdate((statusUpdates: StreamerStatus[]) => {
      this.handleStreamStatusUpdates(statusUpdates);
    });
  }

  setupEventListeners(): void {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const tabName = target.dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });

    // Add account button
    const addAccountBtn = document.getElementById('addAccountBtn');
    addAccountBtn?.addEventListener('click', () => this.showAddAccountModal());

    // Settings
    const notificationsCheckbox = document.getElementById('notificationsEnabled') as HTMLInputElement;
    notificationsCheckbox?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      window.electronAPI.setNotificationsEnabled(target.checked);
    });

    const launchOnStartupCheckbox = document.getElementById('launchOnStartup') as HTMLInputElement;
    launchOnStartupCheckbox?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      window.electronAPI.setLaunchOnStartup(target.checked);
    });

    // Strategy controls
    const strategyRadios = document.querySelectorAll('input[name$="Strategy"]');
    strategyRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const platform = target.name.replace('Strategy', '') as 'twitch' | 'youtube' | 'kick';
        const strategy = target.value as 'api' | 'scrape';
        logger.info(`Strategy changed: ${platform} = ${strategy}`);
        // TODO: Call backend method when available
        // window.electronAPI.setPlatformStrategy(platform, strategy);
      });
    });

    // Smart checking settings
    this.setupSmartCheckingEventListeners();
    
    // Setup enhanced tooltips
    this.setupEnhancedTooltips();

    // Platform specific handlers
    this.setupApiHandlers();

    // User API Credentials event listeners
    const saveCredentialsBtn = document.getElementById('saveCredentialsBtn');
    const clearCredentialsBtn = document.getElementById('clearCredentialsBtn');
    const openConfigBtn = document.getElementById('openConfigBtn');
    
    saveCredentialsBtn?.addEventListener('click', () => this.saveUserApiCredentials());
    clearCredentialsBtn?.addEventListener('click', () => this.clearUserApiCredentials());
    openConfigBtn?.addEventListener('click', () => this.openConfigDirectory());

    // Browser configuration event listeners
    const refreshChromeStatusBtn = document.getElementById('refreshChromeStatus');

    refreshChromeStatusBtn?.addEventListener('click', () => this.refreshChromeStatus());
    
    // Browser download event listeners
    const downloadBrowserBtn = document.getElementById('downloadBrowserBtn');
    const cancelDownloadBtn = document.getElementById('cancelDownloadBtn');
    
    downloadBrowserBtn?.addEventListener('click', () => this.downloadBrowser());
    cancelDownloadBtn?.addEventListener('click', () => this.cancelBrowserDownload());
    
    // Load supported browsers for download dropdown
    this.loadSupportedBrowsers();
    
    // Listen for browser download events
    this.setupBrowserDownloadListeners();
    
    // Make testCredential function available globally for onclick handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).testCredential = (platform: string) => this.testCredential(platform as 'twitch' | 'youtube' | 'kick');
    
    // Make openDeveloperPortal function available globally for onclick handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).openDeveloperPortal = (url: string) => this.openDeveloperPortal(url);
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

  setupSmartCheckingEventListeners(): void {
    // Online check interval
    const onlineCheckIntervalInput = document.getElementById('onlineCheckInterval') as HTMLInputElement;
    onlineCheckIntervalInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      let minutes = parseInt(target.value, 10);
      
      // Validate and clamp the value
      if (isNaN(minutes) || minutes < 5) {
        minutes = 5;
        target.value = '5';
      } else if (minutes > 120) {
        minutes = 120;
        target.value = '120';
      }
      
      await window.electronAPI.updateSmartCheckingSetting('onlineCheckInterval', minutes);
    });

    // Offline check interval
    const offlineCheckIntervalInput = document.getElementById('offlineCheckInterval') as HTMLInputElement;
    offlineCheckIntervalInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      let minutes = parseInt(target.value, 10);
      
      // Validate and clamp the value
      if (isNaN(minutes) || minutes < 1) {
        minutes = 1;
        target.value = '1';
      } else if (minutes > 30) {
        minutes = 30;
        target.value = '30';
      }
      
      await window.electronAPI.updateSmartCheckingSetting('offlineCheckInterval', minutes);
    });

    // Exponential backoff multiplier
    const backoffMultiplierInput = document.getElementById('exponentialBackoffMultiplier') as HTMLInputElement;
    backoffMultiplierInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      let multiplier = parseFloat(target.value);
      
      // Validate and clamp the value
      if (isNaN(multiplier) || multiplier < 1.0) {
        multiplier = 1.0;
        target.value = '1.0';
      } else if (multiplier > 5.0) {
        multiplier = 5.0;
        target.value = '5.0';
      }
      
      await window.electronAPI.updateSmartCheckingSetting('exponentialBackoffMultiplier', multiplier);
    });

    // Backoff max interval
    const backoffMaxIntervalInput = document.getElementById('backoffMaxInterval') as HTMLInputElement;
    backoffMaxIntervalInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      let minutes = parseInt(target.value, 10);
      
      // Validate and clamp the value
      if (isNaN(minutes) || minutes < 10) {
        minutes = 10;
        target.value = '10';
      } else if (minutes > 240) {
        minutes = 240;
        target.value = '240';
      }
      
      await window.electronAPI.updateSmartCheckingSetting('backoffMaxInterval', minutes);
    });

    // Jitter percentage
    const jitterPercentageInput = document.getElementById('jitterPercentage') as HTMLInputElement;
    const jitterValueSpan = document.querySelector('.jitter-value');
    jitterPercentageInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const percentage = parseInt(target.value, 10);
      if (jitterValueSpan) {
        jitterValueSpan.textContent = `${percentage}%`;
      }
    });
    jitterPercentageInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      const percentage = parseInt(target.value, 10);
      await window.electronAPI.updateSmartCheckingSetting('jitterPercentage', percentage);
    });

    // Disable online checks
    const disableOnlineChecksInput = document.getElementById('disableOnlineChecks') as HTMLInputElement;
    disableOnlineChecksInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      await window.electronAPI.updateSmartCheckingSetting('disableOnlineChecks', target.checked);
    });

    // Reset status on close
    const resetStatusOnCloseInput = document.getElementById('resetStatusOnClose') as HTMLInputElement;
    resetStatusOnCloseInput?.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      await window.electronAPI.updateSmartCheckingSetting('resetStatusOnAppClose', target.checked);
    });
  }

  async loadSettings(): Promise<void> {
    try {
      const notificationsEnabled = await window.electronAPI.getNotificationsEnabled();
      const launchOnStartup = await window.electronAPI.getLaunchOnStartup();
      const strategies = await window.electronAPI.getStrategies();
      const smartCheckingConfig = await window.electronAPI.getSmartChecking();

      const notificationsCheckbox = document.getElementById('notificationsEnabled') as HTMLInputElement;
      const launchOnStartupCheckbox = document.getElementById('launchOnStartup') as HTMLInputElement;

      if (notificationsCheckbox) {
        notificationsCheckbox.checked = notificationsEnabled;
      }

      if (launchOnStartupCheckbox) {
        launchOnStartupCheckbox.checked = launchOnStartup;
      }

      // Load strategy settings
      this.loadStrategies(strategies);
      
      // Load smart checking settings
      this.loadSmartCheckingSettings(smartCheckingConfig);
    } catch (error) {
      logger.error('Failed to load settings:', error);
    }
  }

  async loadAccounts(): Promise<void> {
    try {
      this.accounts = await window.electronAPI.getAccounts();
      this.renderAccounts();
    } catch (error) {
      logger.error('Failed to load accounts:', error);
    }
  }

  async loadApiCredentials(): Promise<void> {
    try {
      const credentials = await window.electronAPI.getApiCredentials();
      this.updateApiCredentialsUI(credentials);
    } catch (error) {
      logger.error('Failed to load API credentials:', error);
    }
  }

  async loadUserApiCredentials(): Promise<void> {
    try {
      const credentials = await window.electronAPI.getApiCredentials();
      const kickSecret = await window.electronAPI.getKickClientSecret();
      
      const twitchInput = document.getElementById('twitchClientId') as HTMLInputElement;
      const youtubeInput = document.getElementById('youtubeClientId') as HTMLInputElement;
      const kickClientIdInput = document.getElementById('kickClientId') as HTMLInputElement;
      const kickClientSecretInput = document.getElementById('kickClientSecret') as HTMLInputElement;
      
      if (twitchInput) twitchInput.value = credentials.twitch.clientId || '';
      if (youtubeInput) youtubeInput.value = credentials.youtube.clientId || '';
      if (kickClientIdInput) kickClientIdInput.value = credentials.kick.clientId || '';
      if (kickClientSecretInput) kickClientSecretInput.value = kickSecret || '';
      
    } catch (error) {
      logger.error('Failed to load user API credentials:', error);
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
          // Open stream URL in default browser
          window.electronAPI.openExternal(url);
        }
      });
    });
  }

  createAccountHTML(account: StreamerAccount): string {
    const statusClass = account.lastStatus === 'live' ? 'live' : (account.lastStatus === undefined ? 'unknown' : 'offline');
    const statusText = account.lastStatus === 'live' ? 'LIVE' : (account.lastStatus === undefined ? 'Unknown' : 'Offline');
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

    // Format timing information
    const lastCheckedText = this.formatLastChecked(account.lastChecked);
    const nextCheckText = this.formatNextCheck(account.nextCheckTime);
    const intervalText = this.formatInterval(account.currentCheckInterval);
    const offlineChecksText = account.consecutiveOfflineChecks || 0;

    return `
      <div class="account-item ${enabledClass}" data-account-id="${account.id}">
        <div class="account-main">
          <div class="account-header">
            <div class="account-identity">
              <div class="status-indicator status-${statusClass}"></div>
              <div class="account-name-section">
                <h4><a href="#" class="streamer-link" data-url="${streamUrl}">${account.displayName || account.username}</a></h4>
                <div class="account-meta">
                  <span class="platform-badge platform-${account.platform}">${account.platform.charAt(0).toUpperCase() + account.platform.slice(1)}</span>
                  <span class="username-text">${usernameDisplay}</span>
                  <span class="status-badge status-${statusClass}">${statusText}</span>
                </div>
              </div>
            </div>
            <div class="account-actions">
              <button id="edit-${account.id}" class="btn btn-secondary btn-sm">Edit</button>
              <button id="toggle-${account.id}" class="btn btn-secondary btn-sm">${toggleText}</button>
              <button id="delete-${account.id}" class="btn btn-danger btn-sm">Delete</button>
            </div>
          </div>
          
          <div class="timing-section">
            <div class="timing-grid">
              <div class="timing-card">
                <div class="timing-icon">🕒</div>
                <div class="timing-content">
                  <div class="timing-label">Last Checked</div>
                  <div class="timing-value">${lastCheckedText}</div>
                </div>
              </div>
              <div class="timing-card">
                <div class="timing-icon">⏰</div>
                <div class="timing-content">
                  <div class="timing-label">Next Check</div>
                  <div class="timing-value">${nextCheckText}</div>
                </div>
              </div>
              <div class="timing-card">
                <div class="timing-icon">⏳</div>
                <div class="timing-content">
                  <div class="timing-label">Interval</div>
                  <div class="timing-value">${intervalText}</div>
                </div>
              </div>
              <div class="timing-card">
                <div class="timing-icon">📊</div>
                <div class="timing-content">
                  <div class="timing-label">Offline Checks</div>
                  <div class="timing-value">${offlineChecksText}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getStreamUrl(account: StreamerAccount): string {
    switch (account.platform) {
      case 'twitch':
        return `https://twitch.tv/${account.username}`;
      case 'youtube':
        // Check if it's a channel ID (starts with UC) or a handle (@username)
        if (account.username.startsWith('UC')) {
          return `https://youtube.com/channel/${account.username}`;
        } else {
          // Handle format - add @ if not already present
          const handle = account.username.startsWith('@') ? account.username : `@${account.username}`;
          return `https://youtube.com/${handle}`;
        }
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
    
    let statusText = account.lastStatus === 'live' ? 'Live' : (account.lastStatus === undefined ? 'Unknown' : 'Offline');
    
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
      logger.error('Failed to add account:', error);
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
      displayName: formData.get('displayName') as string | undefined
    };

    try {
      await window.electronAPI.updateAccount(this.currentEditingId, updates);
      await this.loadAccounts();
      this.hideEditAccountModal();
    } catch (error) {
      logger.error('Failed to update account:', error);
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
        logger.error('Failed to delete account:', error);
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
      logger.error('Failed to toggle account:', error);
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
    logger.info('📺 Updating UI with real-time stream status updates...');
    
    statusUpdates.forEach(status => {
      const accountElement = document.querySelector(`[data-account-id="${status.account.id}"]`);
      if (!accountElement) {
        logger.warn(`Could not find UI element for account: ${status.account.id}`);
        return;
      }

      logger.info(`  Updating ${status.displayName}: ${status.isLive ? 'LIVE' : 'OFFLINE'}`);

      // Update status indicator (the colored dot)
      const statusIndicator = accountElement.querySelector('.status-indicator');
      if (statusIndicator) {
        statusIndicator.className = `status-indicator status-${status.isLive ? 'live' : 'offline'}`;
      }

      // Update status badge (the text)
      const statusBadge = accountElement.querySelector('.status-badge');
      if (statusBadge) {
        statusBadge.className = `status-badge status-${status.isLive ? 'live' : 'offline'}`;
        statusBadge.textContent = status.isLive ? 'LIVE' : 'Offline';
      }

      // Update timing information in real-time
      this.updateAccountTimingInfo(accountElement, status.account);

      // Add visual feedback for newly live streamers
      if (status.isLive && status.justWentLive) {
        logger.info(`  🎉 ${status.displayName} just went live! Adding animation...`);
        accountElement.classList.add('just-went-live');
        // Remove the animation class after a few seconds
        setTimeout(() => {
          accountElement.classList.remove('just-went-live');
        }, 5000);
      }

      // Update the local accounts array to keep it in sync
      const localAccount = this.accounts.find(a => a.id === status.account.id);
      if (localAccount) {
        localAccount.lastStatus = status.account.lastStatus;
        localAccount.lastChecked = status.account.lastChecked;
        localAccount.nextCheckTime = status.account.nextCheckTime;
        localAccount.currentCheckInterval = status.account.currentCheckInterval;
        localAccount.consecutiveOfflineChecks = status.account.consecutiveOfflineChecks;
      }
    });
  }

  private updateAccountTimingInfo(accountElement: Element, account: StreamerAccount): void {
    // Update last checked time
    const lastCheckedElement = accountElement.querySelector('.timing-card:nth-child(1) .timing-value');
    if (lastCheckedElement) {
      lastCheckedElement.textContent = this.formatLastChecked(account.lastChecked);
    }

    // Update next check time
    const nextCheckElement = accountElement.querySelector('.timing-card:nth-child(2) .timing-value');
    if (nextCheckElement) {
      nextCheckElement.textContent = this.formatNextCheck(account.nextCheckTime);
    }

    // Update current interval
    const intervalElement = accountElement.querySelector('.timing-card:nth-child(3) .timing-value');
    if (intervalElement) {
      intervalElement.textContent = this.formatInterval(account.currentCheckInterval);
    }

    // Update consecutive offline checks
    const offlineChecksElement = accountElement.querySelector('.timing-card:nth-child(4) .timing-value');
    if (offlineChecksElement) {
      offlineChecksElement.textContent = String(account.consecutiveOfflineChecks || 0);
    }
  }

  showError(message: string): void {
    this.showNotification(message, 'error');
  }

  loadSmartCheckingSettings(config: SmartCheckingConfig): void {
    // Online check interval
    const onlineCheckIntervalInput = document.getElementById('onlineCheckInterval') as HTMLInputElement;
    if (onlineCheckIntervalInput && config.onlineCheckInterval) {
      onlineCheckIntervalInput.value = String(config.onlineCheckInterval); // Already in minutes
    }

    // Offline check interval
    const offlineCheckIntervalInput = document.getElementById('offlineCheckInterval') as HTMLInputElement;
    if (offlineCheckIntervalInput && config.offlineCheckInterval) {
      offlineCheckIntervalInput.value = String(config.offlineCheckInterval); // Already in minutes
    }

    // Exponential backoff multiplier
    const backoffMultiplierInput = document.getElementById('exponentialBackoffMultiplier') as HTMLInputElement;
    if (backoffMultiplierInput && config.exponentialBackoffMultiplier) {
      // Round to 1 decimal place for better UX
      const multiplier = Math.round(config.exponentialBackoffMultiplier * 10) / 10;
      backoffMultiplierInput.value = String(multiplier);
    }

    // Backoff max interval
    const backoffMaxIntervalInput = document.getElementById('backoffMaxInterval') as HTMLInputElement;
    if (backoffMaxIntervalInput && config.backoffMaxInterval) {
      backoffMaxIntervalInput.value = String(config.backoffMaxInterval); // Already in minutes
    }

    // Jitter percentage
    const jitterPercentageInput = document.getElementById('jitterPercentage') as HTMLInputElement;
    const jitterValueSpan = document.querySelector('.jitter-value');
    if (jitterPercentageInput && config.jitterPercentage !== undefined) {
      jitterPercentageInput.value = String(config.jitterPercentage);
      if (jitterValueSpan) {
        jitterValueSpan.textContent = `${config.jitterPercentage}%`;
      }
    }

    // Disable online checks
    const disableOnlineChecksInput = document.getElementById('disableOnlineChecks') as HTMLInputElement;
    if (disableOnlineChecksInput && config.disableOnlineChecks !== undefined) {
      disableOnlineChecksInput.checked = config.disableOnlineChecks;
    }

    // Reset status on close
    const resetStatusOnCloseInput = document.getElementById('resetStatusOnClose') as HTMLInputElement;
    if (resetStatusOnCloseInput && config.resetStatusOnAppClose !== undefined) {
      resetStatusOnCloseInput.checked = config.resetStatusOnAppClose;
    }
  }

  setupEnhancedTooltips(): void {
    // Enhanced tooltip data with examples and formatting
    const tooltipData = {
      'onlineCheckInterval': {
        title: 'Online Check Interval',
        content: `
          <strong>How often to verify live streamers are still streaming</strong>
          <br><br>
          <em>Examples:</em>
          <ul>
            <li><strong>30 min:</strong> Quick to detect when streamers go offline</li>
            <li><strong>60 min:</strong> Balanced (recommended)</li>
            <li><strong>120 min:</strong> Very efficient, slower offline detection</li>
          </ul>
          <br>
          <em>💡 Tip:</em> Higher values save API calls but may delay offline notifications.
        `
      },
      'offlineCheckInterval': {
        title: 'Offline Check Interval',
        content: `
          <strong>Base interval for checking if offline streamers have gone live</strong>
          <br><br>
          <em>How it works:</em>
          <ul>
            <li>This is the <strong>starting</strong> interval for recently offline streamers</li>
            <li>Interval increases exponentially for long-term offline streamers</li>
            <li>Resets to this base when a streamer comes back online</li>
          </ul>
          <br>
          <em>💡 Tip:</em> Lower values (2-5 min) catch streams faster but use more API calls.
        `
      },
      'exponentialBackoffMultiplier': {
        title: 'Exponential Backoff Multiplier',
        content: `
          <strong>How aggressively to reduce checking for offline streamers</strong>
          <br><br>
          <em>Example with 1.8x multiplier:</em>
          <ul>
            <li>Check 1: 3 minutes</li>
            <li>Check 2: 5.4 minutes (3 × 1.8)</li>
            <li>Check 3: 9.7 minutes (5.4 × 1.8)</li>
            <li>Check 4: 17.5 minutes</li>
            <li>...until max interval reached</li>
          </ul>
          <br>
          <em>💡 Tip:</em> 1.0 = no backoff, 2.0 = aggressive, 1.5 = balanced
        `
      },
      'backoffMaxInterval': {
        title: 'Maximum Backoff Interval',
        content: `
          <strong>Cap on how long to wait between checks</strong>
          <br><br>
          <em>Purpose:</em>
          <ul>
            <li>Prevents waiting too long for inactive streamers</li>
            <li>Even long-term offline streamers get checked regularly</li>
            <li>Balances efficiency with responsiveness</li>
          </ul>
          <br>
          <em>💡 Tip:</em> 30-60 min is usually optimal - not too frequent, not too rare.
        `
      },
      'jitterPercentage': {
        title: 'Jitter Percentage',
        content: `
          <strong>Randomizes check timing to spread out API requests</strong>
          <br><br>
          <em>Example with 15% jitter on 10-minute interval:</em>
          <ul>
            <li>Actual check time: 8.5-11.5 minutes (±15%)</li>
            <li>Prevents all streamers being checked at once</li>
            <li>Reduces API rate limiting risks</li>
          </ul>
          <br>
          <em>💡 Tip:</em> 10-20% provides good distribution without unpredictability
        `
      },
      'disableOnlineChecks': {
        title: 'Disable Online Checks',
        content: `
          <strong>Stop checking streamers once they go live</strong>
          <br><br>
          <em>Benefits:</em>
          <ul>
            <li>Saves API calls for active streams</li>
            <li>Reduces server load</li>
            <li>Good for rate-limited scenarios</li>
          </ul>
          <br>
          <em>Trade-offs:</em>
          <ul>
            <li>Won't detect when streams end automatically</li>
            <li>Requires app restart or manual refresh</li>
          </ul>
        `
      },
      'resetStatusOnClose': {
        title: 'Reset Stream Status on App Close',
        content: `
          <strong>Clear all stream statuses when app closes</strong>
          <br><br>
          <em>When enabled:</em>
          <ul>
            <li>All streamers reset to "unknown" status on startup</li>
            <li>Polling intervals reset to base values</li>
            <li>Fresh start every time you open the app</li>
          </ul>
          <br>
          <em>💡 Tip:</em> Useful for testing or if you want clean state each session.
        `
      }
    };

    // Create tooltip elements and event handlers
    Object.entries(tooltipData).forEach(([id, data]) => {
      const element = document.getElementById(id);
      const infoIcon = element?.parentElement?.querySelector('.info-icon');
      
      if (element && infoIcon) {
        // Enhanced click handler for detailed tooltips
        infoIcon.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showDetailedTooltip(data.title, data.content, e.target as HTMLElement);
        });
      }
    });

    // Add example value updates for real-time feedback
    this.setupExampleUpdates();
  }

  setupExampleUpdates(): void {
    // Real-time examples for backoff multiplier
    const multiplierInput = document.getElementById('exponentialBackoffMultiplier') as HTMLInputElement;
    const multiplierLabel = multiplierInput?.parentElement?.querySelector('label');
    
    if (multiplierInput && multiplierLabel) {
      const updateExample = () => {
        const multiplier = parseFloat(multiplierInput.value) || 1.5;
        const baseInterval = 5; // 5 minutes base
        const example1 = baseInterval * Math.pow(multiplier, 1);
        const example2 = baseInterval * Math.pow(multiplier, 2);
        const example3 = baseInterval * Math.pow(multiplier, 3);
        
        // Update help text with live example
        const helpSpan = multiplierInput.parentElement?.querySelector('.setting-help');
        if (helpSpan) {
          helpSpan.textContent = `Example: 5min → ${example1.toFixed(1)}min → ${example2.toFixed(1)}min → ${example3.toFixed(1)}min...`;
        }
      };
      
      multiplierInput.addEventListener('input', updateExample);
      updateExample(); // Initial update
    }
  }

  showDetailedTooltip(title: string, content: string, target: HTMLElement): void {
    // Remove any existing tooltip
    const existingTooltip = document.querySelector('.detailed-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }

    // Create detailed tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'detailed-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <h4>${title}</h4>
        <button class="tooltip-close">&times;</button>
      </div>
      <div class="tooltip-content">
        ${content}
      </div>
    `;

    // Position tooltip
    const rect = target.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.top = `${rect.bottom + 10}px`;
    tooltip.style.left = `${Math.max(10, rect.left - 150)}px`;
    tooltip.style.zIndex = '10000';

    document.body.appendChild(tooltip);

    // Close handlers
    const closeBtn = tooltip.querySelector('.tooltip-close');
    const closeTooltip = () => tooltip.remove();
    
    closeBtn?.addEventListener('click', closeTooltip);
    document.addEventListener('click', (e) => {
      if (!tooltip.contains(e.target as Node) && !target.contains(e.target as Node)) {
        closeTooltip();
      }
    }, { once: true });

    // Auto-close after 10 seconds
    setTimeout(closeTooltip, 10000);
  }

  switchTab(tabName: string): void {
    // Hide all tab content
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabContents.forEach(content => {
      content.classList.remove('active');
    });

    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.classList.remove('active');
    });

    // Show the selected tab content
    const activeTabContent = document.getElementById(`${tabName}-tab`);
    
    if (activeTabContent) {
      activeTabContent.classList.add('active');
    }

    // Set the active class on the clicked tab button
    const activeTabButton = Array.from(tabButtons).find(button => (button as HTMLElement).dataset.tab === tabName);
    if (activeTabButton) {
      activeTabButton.classList.add('active');
    }
  }

  // Helper methods for formatting timing information
  private formatLastChecked(lastChecked?: Date): string {
    if (!lastChecked) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - new Date(lastChecked).getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  private formatNextCheck(nextCheckTime?: number): string {
    if (!nextCheckTime) return 'Not scheduled';
    
    const now = Date.now();
    const diffMs = nextCheckTime - now;
    
    if (diffMs <= 0) return 'Due now';
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 60) return `In ${diffMinutes}m`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `In ${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `In ${diffDays}d`;
  }

  private formatInterval(intervalMs?: number): string {
    if (!intervalMs) return 'Not set';
    
    const minutes = Math.floor(intervalMs / (1000 * 60));
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  // Start periodic updates for timing information
  startTimingUpdates(): void {
    // Update timing information every 30 seconds
    setInterval(() => {
      this.updateTimingDisplay();
    }, 30000);
  }

  // Update only the timing information without full re-render
  private updateTimingDisplay(): void {
    this.accounts.forEach(account => {
      const accountElement = document.querySelector(`[data-account-id="${account.id}"]`);
      if (!accountElement) return;

      const timingCards = accountElement.querySelectorAll('.timing-card');
      if (timingCards.length >= 4) {
        // Update last checked (first card)
        const lastCheckedValue = timingCards[0].querySelector('.timing-value');
        if (lastCheckedValue) {
          const newValue = this.formatLastChecked(account.lastChecked);
          if (lastCheckedValue.textContent !== newValue) {
            lastCheckedValue.textContent = newValue;
            this.animateTimingCard(timingCards[0] as HTMLElement);
          }
        }

        // Update next check (second card)
        const nextCheckValue = timingCards[1].querySelector('.timing-value');
        if (nextCheckValue) {
          const newValue = this.formatNextCheck(account.nextCheckTime);
          if (nextCheckValue.textContent !== newValue) {
            nextCheckValue.textContent = newValue;
            this.animateTimingCard(timingCards[1] as HTMLElement);
          }
        }

        // Update interval (third card)
        const intervalValue = timingCards[2].querySelector('.timing-value');
        if (intervalValue) {
          const newValue = this.formatInterval(account.currentCheckInterval);
          if (intervalValue.textContent !== newValue) {
            intervalValue.textContent = newValue;
            this.animateTimingCard(timingCards[2] as HTMLElement);
          }
        }

        // Update offline checks (fourth card)
        const offlineChecksValue = timingCards[3].querySelector('.timing-value');
        if (offlineChecksValue) {
          const newValue = String(account.consecutiveOfflineChecks || 0);
          if (offlineChecksValue.textContent !== newValue) {
            offlineChecksValue.textContent = newValue;
            this.animateTimingCard(timingCards[3] as HTMLElement);
          }
        }
      }
    });
  }

  // Animate timing card when updated
  private animateTimingCard(card: HTMLElement): void {
    card.classList.remove('updated');        
    card.classList.add('updated');
    
    // Remove animation class after animation completes
    setTimeout(() => {
      card.classList.remove('updated');
    }, 500);
  }

  // User API Credentials Management
  async saveUserApiCredentials(): Promise<void> {
    try {
      const twitchInput = document.getElementById('twitchClientId') as HTMLInputElement;
      const youtubeInput = document.getElementById('youtubeClientId') as HTMLInputElement;
      const kickClientIdInput = document.getElementById('kickClientId') as HTMLInputElement;
      const kickClientSecretInput = document.getElementById('kickClientSecret') as HTMLInputElement;
      
      const credentials = {
        twitch: twitchInput?.value?.trim() || '',
        youtube: youtubeInput?.value?.trim() || '',
        kick: {
          clientId: kickClientIdInput?.value?.trim() || '',
          clientSecret: kickClientSecretInput?.value?.trim() || ''
        }
      };
      
      await window.electronAPI.setUserApiCredentials(credentials);
      
      // Show success message
      this.showNotification('API credentials saved successfully!', 'success');
      
    } catch (error) {
      logger.error('Failed to save user API credentials:', error);
      this.showNotification('Failed to save API credentials', 'error');
    }
  }

  async clearUserApiCredentials(): Promise<void> {
    try {
      const credentials = {
        twitch: '',
        youtube: '',
        kick: { clientId: '', clientSecret: '' }
      };
      
      await window.electronAPI.setUserApiCredentials(credentials);
      await this.loadUserApiCredentials(); // Reload to clear UI
      
      this.showNotification('API credentials cleared', 'info');
      
    } catch (error) {
      logger.error('Failed to clear user API credentials:', error);
      this.showNotification('Failed to clear API credentials', 'error');
    }
  }

  testCredential(platform: 'twitch' | 'youtube' | 'kick'): void {
    // Simple validation for now - in a real app you'd test the API connection
    let input: HTMLInputElement | null = null;
    
    switch (platform) {
      case 'twitch':
        input = document.getElementById('twitchClientId') as HTMLInputElement;
        break;
      case 'youtube':
        input = document.getElementById('youtubeClientId') as HTMLInputElement;
        break;
      case 'kick':
        input = document.getElementById('kickClientId') as HTMLInputElement;
        break;
    }
    
    if (input && input.value.trim()) {
      this.showNotification(`${platform} credentials look valid!`, 'success');
    } else {
      this.showNotification(`Please enter ${platform} credentials first`, 'info');
    }
  }

  openDeveloperPortal(url: string): void {
    // Use the IPC system to open the URL in the user's default browser
    window.electronAPI.openExternal(url);
  }

  async openConfigDirectory(): Promise<void> {
    try {
      await window.electronAPI.openConfigDirectory();
      this.showNotification('Config folder opened in file explorer', 'success');
    } catch (error) {
      logger.error('Failed to open config directory:', error);
      this.showNotification('Failed to open config folder', 'error');
    }
  }

  async refreshChromeStatus(): Promise<void> {
    try {
      const statusElement = document.getElementById('chromeStatus');
      if (!statusElement) {
        logger.error('Browser status element not found');
        return;
      }

      logger.debug('Starting browser status refresh...');

      // Show loading state
      const statusTextElement = statusElement.querySelector('.status-text');
      if (statusTextElement) {
        statusTextElement.textContent = 'Checking browser readiness...';
        statusTextElement.className = 'status-text';
      }
      
      // Reset status cache to ensure fresh check
      await window.electronAPI.resetPuppeteerStatus();
      
      // Get the current browser status
      const status = await window.electronAPI.getPuppeteerStatus();
      logger.debug('Browser status received:', status);
      
      if (!status) {
        logger.error('No status received from getPuppeteerStatus');
      const errorStatusText = statusElement.querySelector('.status-text');
      if (errorStatusText) {
        errorStatusText.textContent = '❌ Failed to check browser status';
        errorStatusText.className = 'status-text status-error';
      }
        return;
      }
      
      const statusClass = status.isAvailable ? 'status-available' : 'status-unavailable';
      const statusIcon = status.isAvailable ? '✅' : '⚠️';
      
      // Create detailed status messages with actionable information
      let displayMessage = '';
      let helpText = '';
      
      if (status.isAvailable) {
        if (status.message.includes('downloaded browser')) {
          displayMessage = 'Ready';
          helpText = 'Puppeteer browser is configured and ready for web scraping.';
        } else if (status.message.includes('detected browser')) {
          displayMessage = 'Ready';
          helpText = 'Using detected system browser for web scraping.';
        } else {
          displayMessage = 'Ready';
          helpText = 'Web scraping functionality is operational.';
        }
      } else {
        displayMessage = 'Not Available';
        helpText = 'Download a browser below to enable web scraping features.';
      }
      
      // Update the status display with enhanced information
      // Update the status display
      statusElement.innerHTML = `
        <span class="status-text ${statusClass}">${statusIcon} ${displayMessage}</span>
        <button type="button" class="btn btn-link" id="refreshChromeStatus" title="Refresh browser status">🔄</button>
      `;
      
      // Update help text
      const helpElement = statusElement.parentElement?.querySelector('.setting-help');
      if (helpElement) {
        helpElement.textContent = helpText;
      }
      
      // Re-attach event listener
      const newRefreshBtn = document.getElementById('refreshChromeStatus');
      if (newRefreshBtn) {
        newRefreshBtn.addEventListener('click', () => this.refreshChromeStatus());
      }
      
      logger.debug(`Browser status updated: ${displayMessage}`);
      
    } catch (error) {
      logger.error('Failed to refresh browser status:', error);
      const statusElement = document.getElementById('chromeStatus');
      if (statusElement) {
        statusElement.innerHTML = `
          <span class="status-text status-error">❌ Error</span>
          <button type="button" class="btn btn-link" id="refreshChromeStatus" title="Refresh browser status">🔄</button>
        `;
        
        // Update help text
        const errorHelpElement = statusElement.parentElement?.querySelector('.setting-help');
        if (errorHelpElement) {
          errorHelpElement.textContent = 'Unable to determine browser availability. Try refreshing or downloading a browser.';
        }
        
        // Re-attach event listener
        const errorRefreshBtn = document.getElementById('refreshChromeStatus');
        if (errorRefreshBtn) {
          errorRefreshBtn.addEventListener('click', () => this.refreshChromeStatus());
        }
      }
    }
  }

  // Browser Download Methods
  async loadSupportedBrowsers(): Promise<void> {
    try {
      const browsers = await window.electronAPI.getSupportedBrowsers();
      const browserSelect = document.getElementById('browserTypeSelect') as HTMLSelectElement;
      
      if (browserSelect) {
        // Clear existing options
        browserSelect.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a browser to download';
        browserSelect.appendChild(defaultOption);
        
        // Add browser options
        browsers.forEach(browser => {
          const option = document.createElement('option');
          option.value = browser.id;
          option.textContent = `${browser.name} - ${browser.description}`;
          browserSelect.appendChild(option);
        });
      }
    } catch (error) {
      logger.error('Failed to load supported browsers:', error);
      const browserSelect = document.getElementById('browserTypeSelect') as HTMLSelectElement;
      if (browserSelect) {
        browserSelect.innerHTML = '<option value="">Failed to load browsers</option>';
      }
    }
  }

  // Browser Selection Methods
  setupBrowserDownloadListeners(): void {
    // Listen for download events from main process
    window.electronAPI.onBrowserDownloadStarted((data) => {
      this.onBrowserDownloadStarted(data);
    });

    window.electronAPI.onBrowserDownloadCompleted((data) => {
      this.onBrowserDownloadCompleted(data);
    });

    window.electronAPI.onBrowserDownloadError((data) => {
      this.onBrowserDownloadError(data);
    });

    window.electronAPI.onBrowserDownloadCancelled(() => {
      this.onBrowserDownloadCancelled();
    });
  }

  async downloadBrowser(): Promise<void> {
    const browserSelect = document.getElementById('browserTypeSelect') as HTMLSelectElement;
    const downloadBtn = document.getElementById('downloadBrowserBtn') as HTMLButtonElement;
    
    if (!browserSelect || !browserSelect.value) {
      this.showDownloadResult('Please select a browser to download.', 'error');
      return;
    }

    try {
      downloadBtn.disabled = true;
      
      const options = {
        browser: browserSelect.value,
        buildId: 'latest'
      };

      await window.electronAPI.downloadBrowser(options);
      
    } catch (error) {
      logger.error('Failed to start browser download:', error);
      this.showDownloadResult('Failed to start download. Please try again.', 'error');
      downloadBtn.disabled = false;
    }
  }

  async cancelBrowserDownload(): Promise<void> {
    try {
      await window.electronAPI.cancelBrowserDownload();
    } catch (error) {
      logger.error('Failed to cancel browser download:', error);
    }
  }

  onBrowserDownloadStarted(data: { browser: string; buildId: string }): void {
    logger.info('Browser download started:', data);
    
    const downloadBtn = document.getElementById('downloadBrowserBtn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancelDownloadBtn') as HTMLButtonElement;
    const progressDiv = document.getElementById('downloadProgress') as HTMLDivElement;
    
    if (downloadBtn) downloadBtn.classList.add('hidden');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    if (progressDiv) progressDiv.classList.remove('hidden');
    
    this.showDownloadResult(`Downloading ${data.browser}...`, 'info');
  }

  onBrowserDownloadCompleted(data: { browser: string; buildId: string; executablePath: string }): void {
    logger.info('Browser download completed:', data);
    
    const downloadBtn = document.getElementById('downloadBrowserBtn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancelDownloadBtn') as HTMLButtonElement;
    const progressDiv = document.getElementById('downloadProgress') as HTMLDivElement;
    
    if (downloadBtn) {
      downloadBtn.classList.remove('hidden');
      downloadBtn.disabled = false;
    }
    if (cancelBtn) cancelBtn.classList.add('hidden');
    if (progressDiv) progressDiv.classList.add('hidden');
    
    this.showDownloadResult(`✅ Successfully downloaded ${data.browser}!`, 'success');
    
    // Refresh the available browsers list, downloaded browsers list, and Puppeteer status
    this.loadDownloadedBrowsersList();
    this.loadDownloadedBrowsersList();
    this.refreshChromeStatus();
  }

  onBrowserDownloadError(data: { browser: string; buildId: string; error: string }): void {
    logger.error('Browser download error:', data);
    
    const downloadBtn = document.getElementById('downloadBrowserBtn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancelDownloadBtn') as HTMLButtonElement;
    const progressDiv = document.getElementById('downloadProgress') as HTMLDivElement;
    
    if (downloadBtn) {
      downloadBtn.classList.remove('hidden');
      downloadBtn.disabled = false;
    }
    if (cancelBtn) cancelBtn.classList.add('hidden');
    if (progressDiv) progressDiv.classList.add('hidden');
    
    this.showDownloadResult(`❌ Download failed: ${data.error}`, 'error');
  }

  onBrowserDownloadCancelled(): void {
    logger.info('Browser download cancelled');
    
    const downloadBtn = document.getElementById('downloadBrowserBtn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancelDownloadBtn') as HTMLButtonElement;
    const progressDiv = document.getElementById('downloadProgress') as HTMLDivElement;
    
    if (downloadBtn) {
      downloadBtn.classList.remove('hidden');
      downloadBtn.disabled = false;
    }
    if (cancelBtn) cancelBtn.classList.add('hidden');
    if (progressDiv) progressDiv.classList.add('hidden');
    
    this.showDownloadResult('Download cancelled.', 'info');
  }

  showDownloadResult(message: string, type: 'success' | 'error' | 'info'): void {
    const resultDiv = document.getElementById('downloadResult');
    if (resultDiv) {
      resultDiv.className = `download-result ${type}`;
      resultDiv.textContent = message;
      resultDiv.classList.remove('hidden');
      
      // Auto-hide success/info messages after 5 seconds
      if (type !== 'error') {
        setTimeout(() => {
          resultDiv.classList.add('hidden');
        }, 5000);
      }
    }
  }

  // Browser Management Methods
  async loadDownloadedBrowsersList(): Promise<void> {
    try {
      const browsers = await window.electronAPI.getAvailableBrowsers();
      const selectedBrowserPath = await window.electronAPI.getSelectedBrowserPath();
      const listContainer = document.getElementById('downloadedBrowsersList');
      
      if (!listContainer) {
        logger.error('Downloaded browsers list container not found');
        return;
      }
      
      // Clear existing content
      listContainer.innerHTML = '';
      
      if (browsers.length === 0) {
        listContainer.innerHTML = `
          <div class="no-browsers-message">
            <div class="no-browsers-icon">📦</div>
            <div class="no-browsers-text">
              <h4>No browsers downloaded yet</h4>
              <p>Download a browser below to enable web scraping features for platforms that require it.</p>
            </div>
          </div>
        `;
        return;
      }
      
      // Create header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'browsers-list-header';
      headerDiv.innerHTML = `
        <div class="browsers-count">📱 ${browsers.length} browser${browsers.length > 1 ? 's' : ''} available</div>
      `;
      listContainer.appendChild(headerDiv);
      
      // Create browser items
      browsers.forEach(browser => {
        const browserItem = document.createElement('div');
        browserItem.className = 'browser-item';
        
        // Check if this browser is currently selected
        const isSelected = selectedBrowserPath === browser.path;
        
        // Get browser display name and icon
        const browserIcons: Record<string, string> = {
          'chrome': '🟢',
          'chromium': '🔵', 
          'firefox': '🟠',
          'edge': '🔷'
        };
        
        const browserIcon = browserIcons[browser.browser.toLowerCase()] || '🌐';
        
        browserItem.innerHTML = `
          <div class="browser-info">
            <div class="browser-header">
              <span class="browser-icon">${browserIcon}</span>
              <div class="browser-details">
                <div class="browser-name">${browser.name}${isSelected ? ' (Active)' : ''}</div>
                <div class="browser-type">${browser.browser.charAt(0).toUpperCase() + browser.browser.slice(1)}</div>
              </div>
            </div>
            <div class="browser-path" title="${browser.path}">
              📁 ${browser.path.length > 60 ? '...' + browser.path.slice(-60) : browser.path}
            </div>
          </div>
          <div class="browser-actions">
            ${isSelected ? 
              '<button type="button" class="btn btn-success btn-sm" disabled>✅ Selected</button>' :
              `<button type="button" class="btn btn-primary btn-sm btn-select" data-path="${browser.path}" title="Select this browser">🎯 Select</button>`
            }
            <button type="button" class="btn btn-danger btn-sm btn-uninstall" data-browser="${browser.browser}" data-path="${browser.path}" title="Remove this browser">
              🗑️ Remove
            </button>
          </div>
        `;
        
        // Add event listener for select button
        const selectBtn = browserItem.querySelector('.btn-select') as HTMLButtonElement;
        if (selectBtn) {
          selectBtn.addEventListener('click', () => this.selectBrowser(browser.path));
        }
        
        // Add event listener for uninstall button
        const uninstallBtn = browserItem.querySelector('.btn-uninstall') as HTMLButtonElement;
        if (uninstallBtn) {
          uninstallBtn.addEventListener('click', () => this.uninstallBrowser(browser.browser, browser.name));
        }
        
        listContainer.appendChild(browserItem);
      });
      
    } catch (error) {
      logger.error('Failed to load downloaded browsers list:', error);
      const listContainer = document.getElementById('downloadedBrowsersList');
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="no-browsers-message error">
            <div class="no-browsers-icon">❌</div>
            <div class="no-browsers-text">
              <h4>Error loading browsers</h4>
              <p>Unable to load the list of downloaded browsers. Try refreshing the page.</p>
            </div>
          </div>
        `;
      }
    }
  }

  async uninstallBrowser(browserId: string, browserName: string): Promise<void> {
    // Enhanced confirmation dialog
    const confirmed = confirm(
      `🗑️ Remove Browser\n\n` +
      `Are you sure you want to remove ${browserName}?\n\n` +
      `This will:\n` +
      `• Delete all browser files\n` +
      `• Remove it from the selection list\n` +
      `• Cannot be undone\n\n` +
      `You can always re-download it later if needed.`
    );
    
    if (!confirmed) return;

    try {
      // Find and disable the uninstall button
      const uninstallBtn = document.querySelector(`[data-browser="${browserId}"]`) as HTMLButtonElement;
      if (uninstallBtn) {
        uninstallBtn.disabled = true;
        uninstallBtn.innerHTML = '⏳ Removing...';
      }

      // Show immediate feedback
      this.showDownloadResult(`🗑️ Removing ${browserName}...`, 'info');

      // Perform the uninstall
      const result = await window.electronAPI.uninstallBrowser(browserId, 'latest');
      
      if (result && result.success) {
        // Show success message
        this.showDownloadResult(`✅ Successfully removed ${browserName}!`, 'success');
        
        // Refresh all browser-related UI components
        await Promise.all([
          this.loadDownloadedBrowsersList(),
          this.loadDownloadedBrowsersList(),
          this.refreshChromeStatus()
        ]);
        
        logger.info(`Browser ${browserName} uninstalled successfully`);
      } else {
        throw new Error(result?.error || 'Uninstall failed');
      }
      
    } catch (error) {
      logger.error('Failed to uninstall browser:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.showDownloadResult(`❌ Failed to remove ${browserName}: ${errorMessage}`, 'error');
      
      // Re-enable the uninstall button on error
      const uninstallBtn = document.querySelector(`[data-browser="${browserId}"]`) as HTMLButtonElement;
      if (uninstallBtn) {
        uninstallBtn.disabled = false;
        uninstallBtn.innerHTML = '🗑️ Remove';
      }
    }
  }

  async selectBrowser(browserPath: string): Promise<void> {
    try {
      // Save the selection
      await window.electronAPI.setSelectedBrowserPath(browserPath);
      
      // Refresh the browsers list to update the UI
      await this.loadDownloadedBrowsersList();
      
      // Reset Puppeteer status cache so it re-evaluates with the new browser
      await window.electronAPI.resetPuppeteerStatus();
      
      // Refresh Puppeteer status to reflect the new selection
      await this.refreshChromeStatus();
      
      logger.info(`Browser selected: ${browserPath}`);
    } catch (error) {
      logger.error('Failed to select browser:', error);
    }
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new StreamerAlertsRenderer();
});
