// Type definitions for configuration
export interface AppCredentials {
  twitch: {
    clientId: string;
  };
  youtube: {
    clientId: string;
  };
  kick: {
    clientId: string;
    clientSecret: string;
  };
}

export interface OAuthEndpoints {
  twitch: {
    authorize: string;
    token: string;
    revoke: string;
  };
  youtube: {
    authorize: string;
    token: string;
    revoke: string;
  };
  kick: {
    authorize: string;
    token: string;
    revoke: string;
  };
}

export interface OAuthScopes {
  twitch: string[];
  youtube: string[];
  kick: string[];
}

export interface OAuthConfig {
  endpoints: OAuthEndpoints;
  scopes: OAuthScopes;
}

// Default/empty credentials - now used as fallback when no user credentials are set
export function getDefaultCredentials(): AppCredentials {
  return {
    twitch: {
      clientId: ''
    },
    youtube: {
      clientId: ''
    },
    kick: {
      clientId: '',
      clientSecret: ''
    }
  };
}

// OAuth configuration (static)
export const OAUTH_CONFIG: OAuthConfig = {
  endpoints: {
    twitch: {
      authorize: 'https://id.twitch.tv/oauth2/authorize',
      token: 'https://id.twitch.tv/oauth2/token',
      revoke: 'https://id.twitch.tv/oauth2/revoke'
    },
    youtube: {
      authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: 'https://oauth2.googleapis.com/token',
      revoke: 'https://oauth2.googleapis.com/revoke'
    },
    kick: {
      authorize: 'https://kick.com/oauth2/authorize',
      token: 'https://kick.com/oauth2/token',
      revoke: 'https://kick.com/oauth2/revoke'
    }
  },
  scopes: {
    twitch: ['user:read:email'],
    youtube: ['https://www.googleapis.com/auth/youtube.readonly'],
    kick: ['user:read']
  }
};
