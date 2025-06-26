class StreamerAlertsRenderer {
  constructor() {
    this.accounts = [];
    this.addAccountModal = null;
    this.editAccountModal = null;
    this.currentEditingId = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupModals();
    await this.loadSettings();
    await this.loadAccounts();
    await this.loadApiCredentials();
  }

  setupEventListeners() {
    // Add account button
    const addAccountBtn = document.getElementById('addAccountBtn');
    addAccountBtn?.addEventListener('click', () => this.showAddAccountModal());

    // Settings
    const notificationsCheckbox = document.getElementById('notificationsEnabled');
    notificationsCheckbox?.addEventListener('change', (e) => {
      window.electronAPI.setNotificationsEnabled(e.target.checked);
    });

    const checkIntervalInput = document.getElementById('checkInterval');
    checkIntervalInput?.addEventListener('change', (e) => {
      const minutes = parseInt(e.target.value, 10);
      if (minutes > 0) {
        window.electronAPI.setCheckInterval(minutes * 60000); // Convert to milliseconds
      }
    });

    // Platform specific handlers
    this.setupApiHandlers();
  }

  setupModals() {
    // Add Account Modal
    this.addAccountModal = document.getElementById('addAccountModal');
    const addAccountForm = document.getElementById('addAccountForm');
    const cancelAddBtn = document.getElementById('cancelAddBtn');

    addAccountForm?.addEventListener('submit', (e) => this.handleAddAccount(e));
    cancelAddBtn?.addEventListener('click', () => this.hideAddAccountModal());

    // Edit Account Modal
    this.editAccountModal = document.getElementById('editAccountModal');
    const editAccountForm = document.getElementById('editAccountForm');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    editAccountForm?.addEventListener('submit', (e) => this.handleEditAccount(e));
    cancelEditBtn?.addEventListener('click', () => this.hideEditAccountModal());

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target === this.addAccountModal) {
        this.hideAddAccountModal();
      }
      if (e.target === this.editAccountModal) {
        this.hideEditAccountModal();
      }
    });
  }

  async loadSettings() {
    try {
      const settings = await window.electronAPI.getSettings();
      
      // Update UI
      const notificationsCheckbox = document.getElementById('notificationsEnabled');
      const checkIntervalInput = document.getElementById('checkInterval');
      
      if (notificationsCheckbox) {
        notificationsCheckbox.checked = settings.notificationsEnabled;
      }
      
      if (checkIntervalInput) {
        checkIntervalInput.value = Math.floor(settings.checkInterval / 60000); // Convert to minutes
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async loadAccounts() {
    try {
      console.log('Loading accounts from main process...');
      this.accounts = await window.electronAPI.getAccounts();
      console.log('Accounts loaded:', this.accounts);
      this.renderAccounts();
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }

  renderAccounts() {
    const accountsList = document.getElementById('accountsList');
    if (!accountsList) {
      console.error('accountsList element not found');
      return;
    }

    console.log('Rendering accounts:', this.accounts.length);

    if (this.accounts.length === 0) {
      accountsList.innerHTML = `
        <div class="empty-state">
          <h3>No streamers added yet</h3>
          <p>Click "Add Account" to start monitoring your favorite streamers!</p>
        </div>
      `;
      return;
    }

    accountsList.innerHTML = this.accounts.map(account => `
      <div class="account-item" data-id="${account.id}">
        <div class="account-info">
          <div class="account-header">
            <span class="account-username">${account.username}</span>
            <span class="account-platform ${account.platform}">${account.platform.toUpperCase()}</span>
          </div>
          <div class="account-status">
            <span class="status-indicator ${account.lastStatus}">${account.lastStatus}</span>
            <span class="account-enabled">${account.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
        <div class="account-actions">
          <button class="btn-edit" onclick="renderer.showEditAccountModal(${JSON.stringify(account).replace(/"/g, '&quot;')})">Edit</button>
          <button class="btn-delete" onclick="renderer.deleteAccount('${account.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  showAddAccountModal() {
    this.addAccountModal?.classList.add('active');
  }

  hideAddAccountModal() {
    this.addAccountModal?.classList.remove('active');
    document.getElementById('addAccountForm')?.reset();
  }

  showEditAccountModal(account) {
    this.currentEditingId = account.id;
    
    // Populate form
    document.getElementById('editUsername').value = account.username;
    document.getElementById('editPlatform').value = account.platform;
    document.getElementById('editEnabled').checked = account.enabled;
    
    this.editAccountModal?.classList.add('active');
  }

  hideEditAccountModal() {
    this.editAccountModal?.classList.remove('active');
    this.currentEditingId = null;
    document.getElementById('editAccountForm')?.reset();
  }

  async handleAddAccount(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const account = {
      username: formData.get('username'),
      platform: formData.get('platform'),
      enabled: formData.get('enabled') === 'on'
    };

    try {
      const success = await window.electronAPI.addAccount(account);
      if (success) {
        this.hideAddAccountModal();
        await this.loadAccounts(); // Reload accounts
      } else {
        alert('Failed to add account. Please check if the username is valid.');
      }
    } catch (error) {
      console.error('Error adding account:', error);
      alert('Error adding account: ' + error.message);
    }
  }

  async handleEditAccount(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const updates = {
      username: formData.get('username'),
      platform: formData.get('platform'),
      enabled: formData.get('enabled') === 'on'
    };

    try {
      const success = await window.electronAPI.updateAccount(this.currentEditingId, updates);
      if (success) {
        this.hideEditAccountModal();
        await this.loadAccounts(); // Reload accounts
      } else {
        alert('Failed to update account.');
      }
    } catch (error) {
      console.error('Error updating account:', error);
      alert('Error updating account: ' + error.message);
    }
  }

  async deleteAccount(id) {
    if (confirm('Are you sure you want to delete this account?')) {
      try {
        const success = await window.electronAPI.removeAccount(id);
        if (success) {
          await this.loadAccounts(); // Reload accounts
        } else {
          alert('Failed to delete account.');
        }
      } catch (error) {
        console.error('Error deleting account:', error);
        alert('Error deleting account: ' + error.message);
      }
    }
  }

  setupApiHandlers() {
    // Twitch OAuth handlers
    const twitchLoginBtn = document.getElementById('twitchLoginBtn');
    const twitchLogoutBtn = document.getElementById('twitchLogoutBtn');

    twitchLoginBtn?.addEventListener('click', async () => {
      const success = await window.electronAPI.loginTwitch();
      if (success) {
        await this.loadApiCredentials();
      }
    });

    twitchLogoutBtn?.addEventListener('click', async () => {
      await window.electronAPI.logoutTwitch();
      await this.loadApiCredentials();
    });

    // YouTube OAuth handlers
    const youtubeLoginBtn = document.getElementById('youtubeLoginBtn');
    const youtubeLogoutBtn = document.getElementById('youtubeLogoutBtn');

    youtubeLoginBtn?.addEventListener('click', async () => {
      const success = await window.electronAPI.loginYouTube();
      if (success) {
        await this.loadApiCredentials();
      }
    });

    youtubeLogoutBtn?.addEventListener('click', async () => {
      await window.electronAPI.logoutYouTube();
      await this.loadApiCredentials();
    });

    // Kick OAuth handlers
    const kickLoginBtn = document.getElementById('kickLoginBtn');
    const kickLogoutBtn = document.getElementById('kickLogoutBtn');

    kickLoginBtn?.addEventListener('click', async () => {
      const success = await window.electronAPI.loginKick();
      if (success) {
        await this.loadApiCredentials();
      }
    });

    kickLogoutBtn?.addEventListener('click', async () => {
      await window.electronAPI.logoutKick();
      await this.loadApiCredentials();
    });
  }

  async loadApiCredentials() {
    try {
      const credentials = await window.electronAPI.getApiCredentials();
      
      // Update Twitch UI
      const twitchStatus = document.getElementById('twitchStatus');
      const twitchLoginBtn = document.getElementById('twitchLoginBtn');
      const twitchLogoutBtn = document.getElementById('twitchLogoutBtn');
      const twitchHelp = document.getElementById('twitchHelp');
      
      if (credentials.twitch.isLoggedIn) {
        const displayName = credentials.twitch.displayName || credentials.twitch.username || 'Twitch User';
        twitchStatus.querySelector('.oauth-status-text').textContent = `✅ Logged in as ${displayName}`;
        twitchLoginBtn?.classList.add('hidden');
        twitchLogoutBtn?.classList.remove('hidden');
        twitchLogoutBtn.textContent = `🚪 Logout (${displayName})`;
        twitchHelp?.classList.add('hidden'); // Hide help text when logged in
      } else {
        twitchStatus.querySelector('.oauth-status-text').textContent = 'Not logged in';
        twitchLoginBtn?.classList.remove('hidden');
        twitchLogoutBtn?.classList.add('hidden');
        twitchHelp?.classList.remove('hidden'); // Show help text when not logged in
      }

      // Update YouTube UI
      const youtubeStatus = document.getElementById('youtubeStatus');
      const youtubeLoginBtn = document.getElementById('youtubeLoginBtn');
      const youtubeLogoutBtn = document.getElementById('youtubeLogoutBtn');
      const youtubeHelp = document.getElementById('youtubeHelp');
      
      if (credentials.youtube.isLoggedIn) {
        const displayName = credentials.youtube.displayName || 'YouTube User';
        youtubeStatus.querySelector('.oauth-status-text').textContent = `✅ Logged in as ${displayName}`;
        youtubeLoginBtn?.classList.add('hidden');
        youtubeLogoutBtn?.classList.remove('hidden');
        youtubeLogoutBtn.textContent = `🚪 Logout (${displayName})`;
        youtubeHelp?.classList.add('hidden'); // Hide help text when logged in
      } else {
        youtubeStatus.querySelector('.oauth-status-text').textContent = 'Not logged in';
        youtubeLoginBtn?.classList.remove('hidden');
        youtubeLogoutBtn?.classList.add('hidden');
        youtubeHelp?.classList.remove('hidden'); // Show help text when not logged in
      }

      // Update Kick UI
      const kickStatus = document.getElementById('kickStatus');
      const kickLoginBtn = document.getElementById('kickLoginBtn');
      const kickLogoutBtn = document.getElementById('kickLogoutBtn');
      const kickHelp = document.getElementById('kickHelp');
      
      if (credentials.kick.isLoggedIn) {
        const displayName = credentials.kick.displayName || credentials.kick.username || 'Kick User';
        kickStatus.querySelector('.oauth-status-text').textContent = `✅ Logged in as ${displayName}`;
        kickLoginBtn?.classList.add('hidden');
        kickLogoutBtn?.classList.remove('hidden');
        kickLogoutBtn.textContent = `🚪 Logout (${displayName})`;
        kickHelp?.classList.add('hidden'); // Hide help text when logged in
      } else {
        kickStatus.querySelector('.oauth-status-text').textContent = 'Not logged in';
        kickLoginBtn?.classList.remove('hidden');
        kickLogoutBtn?.classList.add('hidden');
        kickHelp?.classList.remove('hidden'); // Show help text when not logged in
      }

    } catch (error) {
      console.error('Error loading API credentials:', error);
    }
  }
}

// Initialize when DOM is loaded
let renderer;
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing renderer...');
  renderer = new StreamerAlertsRenderer();
});
