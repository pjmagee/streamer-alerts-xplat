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

export const EMBEDDED_CREDENTIALS = {
  twitch: {
    clientId: 'ofxxg2au9xh0xjyfinfziyf3cl7l80'
  },
  youtube: {
    clientId: '207071834611-bqklv52vv4f1ofsh3t9e0k9geg513iqo.apps.googleusercontent.com',
  },
  kick: {
    clientId: '01JYHN2N63P09AZPE3WCHRYQXH',
    // Note: Kick unfortunately requires client_secret even with PKCE
    // This is not ideal for desktop apps but required by their API
    clientSecret: 'f1d4243f48dce074e5d4256075626898dade0abccc077f98bdb591ee171d12ae'
  }
};

export const OAUTH_CONFIG = {
  redirectUri: 'https://localhost:8443/callback', // Used by YouTube and Kick only
  scopes: {
    twitch: ['user:read:email'], // Required for user identification
    youtube: ['https://www.googleapis.com/auth/youtube.readonly'],
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
