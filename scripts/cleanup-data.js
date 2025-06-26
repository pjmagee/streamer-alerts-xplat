#!/usr/bin/env node

/**
 * Data Migration and Cleanup Utility for Streamer Alerts
 * 
 * This script helps users clean up their application data after the security
 * migration from confidential to public OAuth clients.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Default electron-store locations for different platforms
const getAppDataPath = () => {
  const appName = 'streamer-alerts-xplat';
  
  switch (process.platform) {
    case 'win32':
      return path.join(os.homedir(), 'AppData', 'Roaming', appName);
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName);
    case 'linux':
      return path.join(os.homedir(), '.config', appName);
    default:
      return path.join(os.homedir(), `.${appName}`);
  }
};

const cleanupUserData = () => {
  const appDataPath = getAppDataPath();
  const configFile = path.join(appDataPath, 'config.json');
  
  console.log('🔍 Streamer Alerts - Security Data Cleanup');
  console.log('=========================================');
  console.log(`App data location: ${appDataPath}`);
  
  if (!fs.existsSync(configFile)) {
    console.log('✅ No existing config file found - nothing to clean up');
    return;
  }
  
  try {
    // Read current config
    const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    let migrationNeeded = false;
    
    console.log('📋 Checking for client secrets...');
    
    // Check for client secrets in API credentials
    if (configData.apiCredentials) {
      const platforms = ['twitch', 'youtube', 'kick'];
      
      platforms.forEach(platform => {
        if (configData.apiCredentials[platform] && 'clientSecret' in configData.apiCredentials[platform]) {
          console.log(`🚨 Found client secret field for ${platform} - removing...`);
          delete configData.apiCredentials[platform].clientSecret;
          migrationNeeded = true;
        }
        
        // Remove YouTube channelId/channelName (these should be in individual streamer records)
        if (platform === 'youtube' && configData.apiCredentials[platform]) {
          if ('channelId' in configData.apiCredentials[platform]) {
            console.log(`🚨 Found channelId field in YouTube credentials - removing...`);
            delete configData.apiCredentials[platform].channelId;
            migrationNeeded = true;
          }
          if ('channelName' in configData.apiCredentials[platform]) {
            console.log(`🚨 Found channelName field in YouTube credentials - removing...`);
            delete configData.apiCredentials[platform].channelName;
            migrationNeeded = true;
          }
        }
      });
    }
    
    if (migrationNeeded) {
      // Backup original file
      const backupFile = configFile + '.backup.' + Date.now();
      fs.copyFileSync(configFile, backupFile);
      console.log(`💾 Backup created: ${path.basename(backupFile)}`);
      
      // Clear all tokens to force re-authentication with PKCE
      if (configData.apiCredentials) {
        ['twitch', 'youtube', 'kick'].forEach(platform => {
          if (configData.apiCredentials[platform]) {
            configData.apiCredentials[platform].accessToken = '';
            configData.apiCredentials[platform].refreshToken = '';
            configData.apiCredentials[platform].expiresAt = 0;
            configData.apiCredentials[platform].isLoggedIn = false;
          }
        });
      }
      
      // Write cleaned config
      fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));
      
      console.log('✅ Security cleanup completed!');
      console.log('🔑 All stored tokens have been invalidated');
      console.log('📱 You will need to re-authenticate with all platforms');
      console.log('🔒 New authentication will use secure PKCE flow (no client secrets)');
    } else {
      console.log('✅ No client secrets found - your data is already secure');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.log('🆘 If you encounter issues, you can manually delete the config file:');
    console.log(`   ${configFile}`);
  }
};

// Command line options
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Streamer Alerts - Security Data Cleanup

Usage: node cleanup-data.js [options]

Options:
  --help, -h     Show this help message
  --force        Force cleanup without prompts
  --locate       Show app data location only

This tool removes client secrets from your stored app data
and invalidates tokens to force secure re-authentication.
`);
  process.exit(0);
}

if (args.includes('--locate')) {
  console.log('App data location:', getAppDataPath());
  process.exit(0);
}

if (args.includes('--force')) {
  cleanupUserData();
} else {
  console.log('This will clean up stored client secrets and invalidate your login tokens.');
  console.log('You will need to re-authenticate with all platforms after this.');
  console.log('');
  console.log('Continue? (y/N)');
  
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (key) => {
    if (key.toString().toLowerCase() === 'y') {
      console.log('');
      cleanupUserData();
    } else {
      console.log('');
      console.log('Cleanup cancelled.');
    }
    process.exit(0);
  });
}
