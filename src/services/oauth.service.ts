import { shell } from 'electron';
import { EMBEDDED_CREDENTIALS, OAUTH_CONFIG } from '../config';
import { ConfigService } from './config.service';
import { createHash, randomBytes } from 'crypto';
import * as http from 'http';
import * as url from 'url';
import logger from '../utils/logger';

export class OAuthService {
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  /**
   * PKCE Helper Methods
   * PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks
   */
  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  private generateState(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Twitch OAuth Login using Device Code Grant Flow
   * This is the recommended flow for desktop applications (public clients)
   * No client secret required, provides refresh tokens
   */
  async loginTwitch(): Promise<boolean> {
    try {
      // Step 1: Start device authorization flow
      const deviceResponse = await fetch('https://id.twitch.tv/oauth2/device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: EMBEDDED_CREDENTIALS.twitch.clientId,
          scopes: OAUTH_CONFIG.scopes.twitch.join(' '),
        }),
      });

      if (!deviceResponse.ok) {
        // Get detailed error response
        let errorDetails = '';
        try {
          const errorData = await deviceResponse.json();
          errorDetails = JSON.stringify(errorData);
        } catch {
          errorDetails = await deviceResponse.text();
        }
        throw new Error(`Device authorization failed: ${deviceResponse.status} ${deviceResponse.statusText} - ${errorDetails}`);
      }

      const deviceData = await deviceResponse.json();
      const { device_code, verification_uri, expires_in, interval } = deviceData;

      // Step 2: Open browser directly - no popup needed since code is prefilled
      logger.info('\n🔥 TWITCH AUTHENTICATION');
      logger.info(`📱 Opening browser for Twitch authorization...`);
      logger.info(`⏰ Expires in: ${Math.floor(expires_in / 60)} minutes`);

      //const { shell } = require('electron');

      // Open browser to verification URI (code should be prefilled)
      shell.openExternal(verification_uri);

      // Step 3: Start polling immediately (no dialog needed)
      const tokenResult = await this.pollForTwitchToken(device_code, expires_in, interval);
      return tokenResult;

    } catch (error) {
      logger.error('Twitch OAuth error:', error);
      return false;
    }
  }

  /**
   * Poll for Twitch token using device code
   */
  private async pollForTwitchToken(deviceCode: string, expiresIn: number, interval: number): Promise<boolean> {
    const endTime = Date.now() + (expiresIn * 1000);

    while (Date.now() < endTime) {
      try {
        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: EMBEDDED_CREDENTIALS.twitch.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();

          // Get user info to complete the login
          const userResponse = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Client-Id': EMBEDDED_CREDENTIALS.twitch.clientId,
            },
          });

          if (!userResponse.ok) {
            throw new Error('Failed to fetch user info');
          }

          const userData = await userResponse.json();
          const user = userData.data[0];

          // Store the tokens
          this.configService.setTwitchOAuthCredentials(
            tokenData.access_token,
            tokenData.refresh_token,
            Date.now() + (tokenData.expires_in * 1000),
            user.login,        // username for API calls
            user.display_name, // display name for UI
            EMBEDDED_CREDENTIALS.twitch.clientId // clientId
          );

          return true;
        } else if (tokenResponse.status === 400) {
          const errorData = await tokenResponse.json();
          if (errorData.message === 'authorization_pending') {
            // User hasn't completed authorization yet, continue polling
            await new Promise(resolve => setTimeout(resolve, interval * 1000));
            continue;
          } else {
            throw new Error(`Token request failed: ${errorData.message}`);
          }
        } else {
          throw new Error(`Token request failed: ${tokenResponse.statusText}`);
        }
      } catch (error) {
        logger.error('Error polling for token:', error);
        return false;
      }
    }

    throw new Error('Device authorization expired');
  }


  /**
   * YouTube OAuth Login using Authorization Code Flow with PKCE
   * Google supports PKCE for public clients (no client secret required)
   */
  async loginYouTube(): Promise<boolean> {
    try {
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      const state = this.generateState();

      const { server, redirectUri, codePromise } = await this.createCallbackServer(state);
      const authUrl = new URL(OAUTH_CONFIG.endpoints.youtube.authorize);
      authUrl.searchParams.set('client_id', EMBEDDED_CREDENTIALS.youtube.clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.youtube.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('access_type', 'offline'); // Request refresh token
      authUrl.searchParams.set('prompt', 'consent'); // Force consent screen to get refresh token

      shell.openExternal(authUrl.toString());

      try {
        // Wait for the authorization code
        const code = await codePromise;

        // Exchange the code for tokens
        const success = await this.exchangeYouTubeCode(code, codeVerifier, redirectUri);
        return success;
      } catch (error) {
        logger.error('YouTube OAuth error:', error);
        return false;
      } finally {
        server.close();
      }
    } catch (error) {
      logger.error('YouTube OAuth error:', error);
      return false;
    }
  }

  private async exchangeYouTubeCode(code: string, codeVerifier: string, redirectUri: string): Promise<boolean> {
    try {
      const requestBody = new URLSearchParams({
        client_id: EMBEDDED_CREDENTIALS.youtube.clientId,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier, // PKCE verification
      });

      logger.debug('YouTube token exchange request:');
      logger.debug('Endpoint:', OAUTH_CONFIG.endpoints.youtube.token);
      logger.debug('Client ID:', EMBEDDED_CREDENTIALS.youtube.clientId);
      logger.debug('Redirect URI:', redirectUri);
      logger.debug('Code length:', code.length);
      logger.debug('Code verifier length:', codeVerifier.length);

      const tokenResponse = await fetch(OAUTH_CONFIG.endpoints.youtube.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody,
      });

      if (!tokenResponse.ok) {
        // Get detailed error response
        let errorDetails = '';
        try {
          const errorData = await tokenResponse.json();
          errorDetails = JSON.stringify(errorData);
        } catch {
          errorDetails = await tokenResponse.text();
        }
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorDetails}`);
      }

      const tokenData = await tokenResponse.json();

      // Get channel info to complete the login
      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      if (!channelResponse.ok) {
        throw new Error('Failed to fetch channel info');
      }

      const channelData = await channelResponse.json();
      const channel = channelData.items[0];

      // Store the tokens (display name for UI, no need for channel info - it's for monitoring others)
      this.configService.setYouTubeOAuthCredentials(
        tokenData.access_token,
        tokenData.refresh_token,
        Date.now() + (tokenData.expires_in * 1000),
        channel.snippet.title,  // display name for UI
        EMBEDDED_CREDENTIALS.youtube.clientId
      );

      return true;
    } catch (error) {
      logger.error('Error exchanging YouTube code:', error);
      return false;
    }
  }

  /**
   * Kick OAuth Login using Authorization Code Flow with PKCE
   * Kick should support PKCE for public clients (no client secret required)
   */
  /**
   * Kick OAuth Login using Authorization Code Flow with PKCE
   * Kick supports PKCE for public clients (no client secret required)
   */
  async loginKick(): Promise<boolean> {
    try {
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      const state = this.generateState();

      // Create temporary callback server
      const { server, redirectUri, codePromise } = await this.createCallbackServer(state);

      const authUrl = new URL(OAUTH_CONFIG.endpoints.kick.authorize);
      authUrl.searchParams.set('client_id', EMBEDDED_CREDENTIALS.kick.clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.kick.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      // Open browser to auth URL
      shell.openExternal(authUrl.toString());

      try {
        // Wait for the authorization code
        const code = await codePromise;

        // Exchange the code for tokens
        const success = await this.exchangeKickCode(code, codeVerifier, redirectUri);
        return success;
      } catch (error) {
        logger.error('Kick OAuth error:', error);
        return false;
      } finally {
        // Ensure server is closed
        server.close();
      }
    } catch (error) {
      logger.error('Kick OAuth error:', error);
      return false;
    }
  }

  private async exchangeKickCode(code: string, codeVerifier: string, redirectUri: string): Promise<boolean> {
    try {
      const tokenResponse = await fetch(OAUTH_CONFIG.endpoints.kick.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: EMBEDDED_CREDENTIALS.kick.clientId,
          client_secret: EMBEDDED_CREDENTIALS.kick.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          code_verifier: codeVerifier, // PKCE verification
        }),
      });

      if (!tokenResponse.ok) {
        // Get detailed error response
        let errorDetails = '';
        try {
          const errorData = await tokenResponse.json();
          errorDetails = JSON.stringify(errorData);
        } catch {
          errorDetails = await tokenResponse.text();
        }
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorDetails}`);
      }

      const tokenData = await tokenResponse.json();

      // Get user info to complete the login
      // Ensure the access token is clean (no whitespace/line endings)
      const cleanAccessToken = tokenData.access_token?.trim();

      // Debug: Log token info (without exposing the full token)
      logger.debug(`Kick token received: ${cleanAccessToken?.length} chars, clean: ${cleanAccessToken === tokenData.access_token}`);
      logger.debug('Kick token response keys:', Object.keys(tokenData));

      // Try to get user info from multiple possible endpoints
      let userData = null;
      let userEndpoint = '';

      // Debug: Check token format and add extra headers
      logger.debug('Kick API Debug - About to call user endpoint');
      logger.debug('Token length:', cleanAccessToken?.length);

      // First, try the public API user endpoint (correct Kick API)
      try {
        userEndpoint = 'https://api.kick.com/public/v1/users';
        logger.debug('Making request to:', userEndpoint);
        
        const userResponse = await fetch(userEndpoint, {
          headers: {
            'Authorization': `Bearer ${cleanAccessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'StreamerAlerts/1.0.0',
          },
        });

        logger.debug('User API response status:', userResponse.status);

        if (userResponse.ok) {
          const responseData = await userResponse.json();
          logger.debug('Kick API response:', responseData);
          
          // The Kick API returns data in format: { data: [{ user_id, name, email, profile_picture }] }
          if (responseData.data && responseData.data.length > 0) {
            const user = responseData.data[0]; // First user (current authenticated user)
            userData = {
              username: user.name,
              display_name: user.name,
              user_id: user.user_id,
              email: user.email,
              profile_picture: user.profile_picture
            };
          } else {
            logger.error('Kick API returned empty data array');
          }
        } else {
          let errorDetails;
          try {
            const errorData = await userResponse.json();
            errorDetails = JSON.stringify(errorData);
          } catch {
            errorDetails = await userResponse.text();
          }
          logger.error(`Kick user API error (${userEndpoint}): ${userResponse.status} ${userResponse.statusText} - ${errorDetails}`);
        }
      } catch (error) {
        logger.error(`Error calling ${userEndpoint}:`, error);
      }

      // If that failed, check if token response includes user info
      if (!userData && tokenData.user) {
        logger.debug('Using user data from token response');
        userData = tokenData.user;
      }

      // If still no user data, try without authentication (some APIs provide this)
      if (!userData) {
        logger.debug('No user data available - creating minimal credentials');
        // For now, we'll store the token without user details
        // The user can still use the API, we just won't have display name
        userData = {
          username: 'kick_user', // placeholder
          display_name: 'Kick User' // placeholder
        };
      }

      if (!userData) {
        throw new Error(`Failed to fetch user info from any endpoint. Last tried: ${userEndpoint}`);
      }

      // Store the tokens (with cleaned access token)
      this.configService.setKickOAuthCredentials(
        cleanAccessToken,
        tokenData.refresh_token?.trim(),
        Date.now() + (tokenData.expires_in * 1000),
        userData.username,              // username for API calls
        userData.display_name || userData.username,  // display name for UI (fallback to username)
        EMBEDDED_CREDENTIALS.kick.clientId
      );

      return true;
    } catch (error) {
      logger.error('Error exchanging Kick code:', error);
      return false;
    }
  }

  /**
   * Token Refresh Methods
   * These methods handle refreshing expired access tokens using refresh tokens
   */
  async refreshTwitchToken(): Promise<boolean> {
    try {
      const credentials = this.configService.getApiCredentials();
      if (!credentials.twitch.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(OAUTH_CONFIG.endpoints.twitch.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: EMBEDDED_CREDENTIALS.twitch.clientId,
          grant_type: 'refresh_token',
          refresh_token: credentials.twitch.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();

      this.configService.setTwitchOAuthCredentials(
        tokenData.access_token,
        tokenData.refresh_token || credentials.twitch.refreshToken,
        Date.now() + (tokenData.expires_in * 1000),
        credentials.twitch.username,
        credentials.twitch.displayName,
        credentials.twitch.clientId
      );

      return true;
    } catch (error) {
      logger.error('Error refreshing Twitch token:', error);
      return false;
    }
  }

  async refreshYouTubeToken(): Promise<boolean> {
    try {
      const credentials = this.configService.getApiCredentials();
      if (!credentials.youtube.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(OAUTH_CONFIG.endpoints.youtube.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: EMBEDDED_CREDENTIALS.youtube.clientId,
          grant_type: 'refresh_token',
          refresh_token: credentials.youtube.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();

      this.configService.setYouTubeOAuthCredentials(
        tokenData.access_token,
        tokenData.refresh_token || credentials.youtube.refreshToken,
        Date.now() + (tokenData.expires_in * 1000),
        credentials.youtube.displayName,
        credentials.youtube.clientId
      );

      return true;
    } catch (error) {
      logger.error('Error refreshing YouTube token:', error);
      return false;
    }
  }

  async refreshKickToken(): Promise<boolean> {
    try {
      const credentials = this.configService.getApiCredentials();
      if (!credentials.kick.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(OAUTH_CONFIG.endpoints.kick.token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: EMBEDDED_CREDENTIALS.kick.clientId,
          client_secret: EMBEDDED_CREDENTIALS.kick.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: credentials.kick.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();

      // Clean tokens to remove any whitespace/line endings
      const cleanAccessToken = tokenData.access_token?.trim();
      const cleanRefreshToken = (tokenData.refresh_token || credentials.kick.refreshToken)?.trim();

      this.configService.setKickOAuthCredentials(
        cleanAccessToken,
        cleanRefreshToken,
        Date.now() + (tokenData.expires_in * 1000),
        credentials.kick.username,
        credentials.kick.displayName,
        EMBEDDED_CREDENTIALS.kick.clientId
      );

      return true;
    } catch (error) {
      logger.error('Error refreshing Kick token:', error);
      return false;
    }
  }

  /**
   * Token Validation
   * Checks if tokens are valid and refreshes them if needed
   */
  async validateAndRefreshToken(platform: 'twitch' | 'youtube' | 'kick'): Promise<boolean> {
    const credentials = this.configService.getApiCredentials();
    const platformCreds = credentials[platform];

    if (!platformCreds.isLoggedIn || !platformCreds.accessToken) {
      return false;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const expiryTime = platformCreds.expiresAt || 0;
    const buffer = 5 * 60 * 1000; // 5 minutes

    if (now >= (expiryTime - buffer)) {
      logger.info(`${platform} token is expired, attempting refresh...`);

      switch (platform) {
        case 'twitch':
          return await this.refreshTwitchToken();
        case 'youtube':
          return await this.refreshYouTubeToken();
        case 'kick':
          return await this.refreshKickToken();
        default:
          return false;
      }
    }

    return true;
  }

  /**
   * Logout Methods
   * These methods clear stored tokens and revoke them where possible
   */
  async logoutTwitch(): Promise<void> {
    const credentials = this.configService.getApiCredentials();

    // Revoke token if available
    if (credentials.twitch.accessToken) {
      try {
        await fetch(`https://id.twitch.tv/oauth2/revoke?client_id=${EMBEDDED_CREDENTIALS.twitch.clientId}&token=${credentials.twitch.accessToken}`, {
          method: 'POST',
        });
      } catch (error) {
        logger.warn('Failed to revoke Twitch token:', error);
      }
    }

    this.configService.logoutTwitch();
  }

  async logoutYouTube(): Promise<void> {
    const credentials = this.configService.getApiCredentials();

    // Revoke token if available
    if (credentials.youtube.accessToken) {
      try {
        await fetch(OAUTH_CONFIG.endpoints.youtube.revoke, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: credentials.youtube.accessToken,
          }),
        });
      } catch (error) {
        logger.warn('Failed to revoke YouTube token:', error);
      }
    }

    this.configService.logoutYouTube();
  }

  async logoutKick(): Promise<void> {
    // Kick doesn't have a standardized revoke endpoint yet
    // Just clear the stored tokens
    this.configService.logoutKick();
  }

  /**
   * Create a temporary local server to handle OAuth redirects
   */
  private createCallbackServer(expectedState: string): Promise<{ server: http.Server, redirectUri: string, codePromise: Promise<string> }> {
    return new Promise((resolve, reject) => {
      const server = http.createServer();

      server.listen(0, 'localhost', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Failed to get server address'));
          return;
        }

        const port = address.port;
        const redirectUri = `http://localhost:${port}/callback`;

        const codePromise = new Promise<string>((resolveCode, rejectCode) => {
          server.on('request', (req, res) => {
            const parsedUrl = url.parse(req.url || '', true);

            if (parsedUrl.pathname === '/callback') {
              const code = parsedUrl.query.code as string;
              const state = parsedUrl.query.state as string;
              const error = parsedUrl.query.error as string;

              // Send response to browser
              res.writeHead(200, { 'Content-Type': 'text/html' });
              if (error) {
                res.end(`
                  <html>
                    <body>
                      <h2>Authentication Failed</h2>
                      <p>Error: ${error}</p>
                      <p>You can close this window.</p>
                    </body>
                  </html>
                `);
                rejectCode(new Error(`OAuth error: ${error}`));
              } else if (!code) {
                res.end(`
                  <html>
                    <body>
                      <h2>Authentication Failed</h2>
                      <p>No authorization code received</p>
                      <p>You can close this window.</p>
                    </body>
                  </html>
                `);
                rejectCode(new Error('No authorization code received'));
              } else if (state !== expectedState) {
                res.end(`
                  <html>
                    <body>
                      <h2>Authentication Failed</h2>
                      <p>Security error: State mismatch</p>
                      <p>You can close this window.</p>
                    </body>
                  </html>
                `);
                rejectCode(new Error('State mismatch - possible CSRF attack'));
              } else {
                res.end(`
                  <html>
                    <body>
                      <h2>Authentication Successful!</h2>
                      <p>You can close this window and return to the application.</p>
                      <script>window.close();</script>
                    </body>
                  </html>
                `);
                resolveCode(code);
              }

              // Close server after handling the request
              setTimeout(() => server.close(), 1000);
            }
          });
        });

        resolve({ server, redirectUri, codePromise });
      });

      server.on('error', reject);
    });
  }
}
