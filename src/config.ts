/**
 * Application Configuration
 * Desktop applications are "public clients" and should NOT store client secrets
 *
 * Security Implementation by Platform:
 * - Twitch: Device Code Grant Flow (no client secret, OAuth 2.1 compliant)
 * - YouTube: Authorization Code + PKCE (no client secret for Desktop App type, OAuth 2.1 compliant)
 * - Kick: Authorization Code + PKCE + client secret (required by Kick's API)
 *
 * Note: Only Kick requires client_secret. YouTube works with PKCE when configured as Desktop App.
 */

import * as fs from 'fs';
import * as path from 'path';

// Determine if we're in a packaged app or development
// Use Electron's app.isPackaged when available, fallback to process-based detection
let isPackaged = false;
try {
  const { app } = require('electron');
  isPackaged = app.isPackaged;
} catch (error) {
  // Fallback for when Electron is not available (e.g., during build)
  isPackaged = process.defaultApp === undefined;
}

// Load the appropriate configuration
let CONFIG: any;

if (isPackaged) {
  // Production/Packaged app: try to load config.prod.json from the app bundle
  // In packaged apps, __dirname points to the app.asar/dist directory
  const prodConfigPath = path.join(__dirname, 'config.prod.json');

  if (fs.existsSync(prodConfigPath)) {
    try {
      const configData = fs.readFileSync(prodConfigPath, 'utf8');
      CONFIG = JSON.parse(configData);
    } catch (error) {
      throw new Error(`
        ❌ Failed to parse config.prod.json in packaged app!

        Error: ${error instanceof Error ? error.message : 'Unknown error'}
        Path: ${prodConfigPath}
      `);
    }
  } else {
    throw new Error(`
      ❌ Missing config.prod.json in packaged app!

      Expected location: ${prodConfigPath}

      The app was not built properly. This file should be included during the build process.
      Make sure to run: npm run build:prod before packaging.
    `);
  }
} else {
  // Development: load from config.local.json in the project root
  const localConfigPath = path.join(__dirname, '..', 'config.local.json');
  
  if (fs.existsSync(localConfigPath)) {
    try {
      const configData = fs.readFileSync(localConfigPath, 'utf8');
      CONFIG = JSON.parse(configData);
    } catch (error) {
      throw new Error(`
        ❌ Failed to parse config.local.json!

        Error: ${error instanceof Error ? error.message : 'Unknown error'}
        Path: ${localConfigPath}
        
        Make sure the JSON file is valid.
      `);
    }
  } else {
    throw new Error(`
      ❌ Missing config.local.json file!

      Expected location: ${localConfigPath}
      
      Please create config.local.json in the project root with your development credentials.
      You can copy config.local.example.json as a starting point.
    `);
  }
}

export const EMBEDDED_CREDENTIALS = {
  twitch: {
    clientId: CONFIG.TWITCH_CLIENT_ID
  },
  youtube: {
    clientId: CONFIG.YOUTUBE_CLIENT_ID,
  },
  kick: {
    clientId: CONFIG.KICK_CLIENT_ID,
    // Note: Kick unfortunately requires client_secret even with PKCE
    // This is not ideal for desktop apps but required by their API
    clientSecret: CONFIG.KICK_CLIENT_SECRET
  }
};

export const OAUTH_CONFIG = {
  redirectUri: 'https://localhost:8443/callback', // Used by YouTube and Kick only
  scopes: {
    twitch: ['user:read:email'], // Required for user identification
    youtube: ['https://www.googleapis.com/auth/youtube'], // Full scope required for eventType=live searches (readonly scope doesn't support it)
    kick: ['user:read'] // Required for user identification
  },

  // OAuth 2.1 endpoints
  // Note: Twitch uses Device Code Grant Flow (no redirect URI needed)
  // YouTube and Kick use Authorization Code Flow with PKCE
  endpoints: {
    twitch: {
      authorize: 'https://id.twitch.tv/oauth2/authorize', // Not used with device code flow
      token: 'https://id.twitch.tv/oauth2/token',
      validate: 'https://id.twitch.tv/oauth2/validate',
      device: 'https://id.twitch.tv/oauth2/device' // Device code flow endpoint
    },
    youtube: {
      authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: 'https://oauth2.googleapis.com/token',
      revoke: 'https://oauth2.googleapis.com/revoke'
    },
    kick: {
      authorize: 'https://id.kick.com/oauth/authorize',
      token: 'https://id.kick.com/oauth/token'
    }
  }
};
