import * as path from 'path';
import * as fs from 'fs';
import logger from './utils/logger';

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

// Helper function to parse config data
function parseConfig(configData: Record<string, string>): AppCredentials {
  return {
    twitch: {
      clientId: configData.TWITCH_CLIENT_ID
    },
    youtube: {
      clientId: configData.YOUTUBE_CLIENT_ID
    },
    kick: {
      clientId: configData.KICK_CLIENT_ID,
      clientSecret: configData.KICK_CLIENT_SECRET
    }
  };
}

// Default/empty credentials for when config files are missing
function getDefaultCredentials(): AppCredentials {
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

// Load configuration based on environment
function loadConfig(): AppCredentials {
  // Check if we're in development by looking for webpack/vite dev indicators
  const isDev = process.env.NODE_ENV === 'development' || 
                process.env.VITE_DEV_SERVER_URL !== undefined ||
                __dirname.includes('.vite');
                
  const configFile = isDev ? 'config.local.json' : 'config.prod.json';
  
  let configPath: string;
  
  if (isDev) {
    // In development, find the project root and use config/ directory
    // The project root should contain package.json
    let projectRoot = process.cwd();
    
    // If we're in a subdirectory, find the actual project root
    while (!fs.existsSync(path.join(projectRoot, 'package.json')) && projectRoot !== path.dirname(projectRoot)) {
      projectRoot = path.dirname(projectRoot);
    }
    
    configPath = path.join(projectRoot, 'config', configFile);
  } else {
    // In production, use resources path
    configPath = path.join(process.resourcesPath, 'config', configFile);
  }

  try {
    logger.info(`Loading config in ${isDev ? 'development' : 'production'} mode`);
    logger.info(`Config path: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
      // Try alternative paths as fallback
      const alternativePaths = [
        path.join(process.cwd(), 'config', configFile),
        path.join(__dirname, '..', 'config', configFile),
        path.join(__dirname, '..', '..', 'config', configFile)
      ];
      
      let foundPath: string | null = null;
      for (const altPath of alternativePaths) {
        logger.debug(`Trying alternative path: ${altPath}`);
        if (fs.existsSync(altPath)) {
          foundPath = altPath;
          logger.info(`Found config at: ${altPath}`);
          break;
        }
      }
      
      if (!foundPath) {
        logger.warn(`Configuration file not found: ${configPath} (also tried alternative paths). Using default empty credentials.`);
        return getDefaultCredentials();
      }
      
      configPath = foundPath;
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    logger.info('Successfully loaded configuration');
    return parseConfig(configData);
  } catch (error) {
    logger.error('Failed to load configuration:', error);
    logger.warn('Using default empty credentials due to config load failure');
    return getDefaultCredentials();
  }
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

// Load and export credentials
export const EMBEDDED_CREDENTIALS: AppCredentials = loadConfig();
