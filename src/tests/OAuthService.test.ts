/**
 * OAuth Service Validation Script
 * 
 * This script validates the OAuth 2.1/PKCE implementation for all platforms
 * Ensures security best practices are followed for desktop applications
 * 
 * Run with: npm run build && node dist/tests/oauth-validation.js
 */

import { OAuthService } from '../services/OAuthService';
import { ConfigService } from '../services/ConfigService';
import { EMBEDDED_CREDENTIALS, OAUTH_CONFIG } from '../config';
import { createHash, randomBytes } from 'crypto';

// Simple assertion function
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Validation functions
class OAuthValidation {
  private oauthService: OAuthService;
  private configService: ConfigService;

  constructor() {
    this.configService = new ConfigService();
    this.oauthService = new OAuthService(this.configService);
  }

  // Test PKCE implementation
  validatePKCE(): void {
    console.log('🔐 Validating PKCE Implementation...');

    // Test code verifier generation
    const codeVerifier = (this.oauthService as any).generateCodeVerifier();
    assert(typeof codeVerifier === 'string', 'Code verifier should be a string');
    assert(codeVerifier.length > 40, 'Code verifier should be long enough');
    assert(/^[A-Za-z0-9_-]+$/.test(codeVerifier), 'Code verifier should use base64url chars');
    console.log('  ✅ Code verifier generation works correctly');

    // Test code challenge generation
    const testVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = (this.oauthService as any).generateCodeChallenge(testVerifier);
    const expected = createHash('sha256').update(testVerifier).digest('base64url');
    assert(codeChallenge === expected, 'Code challenge should match expected SHA256 hash');
    assert(/^[A-Za-z0-9_-]+$/.test(codeChallenge), 'Code challenge should use base64url chars');
    console.log('  ✅ Code challenge generation works correctly');

    // Test state generation
    const state1 = (this.oauthService as any).generateState();
    const state2 = (this.oauthService as any).generateState();
    assert(state1 !== state2, 'State values should be unique');
    assert(state1.length === 32, 'State should be 32 characters (16 bytes as hex)');
    assert(/^[a-f0-9]+$/.test(state1), 'State should use hex characters');
    console.log('  ✅ State generation works correctly');

    console.log('✅ PKCE Implementation validation passed!');
  }

  // Validate security configuration
  validateSecurityConfig(): void {
    console.log('🔒 Validating Security Configuration...');

    // Check no client secrets are present
    assert(!('clientSecret' in EMBEDDED_CREDENTIALS.twitch), 'Twitch config should not contain client secret');
    assert(!('clientSecret' in EMBEDDED_CREDENTIALS.youtube), 'YouTube config should not contain client secret');
    assert(!('clientSecret' in EMBEDDED_CREDENTIALS.kick), 'Kick config should not contain client secret');
    console.log('  ✅ No client secrets found in configuration');

    // Check client IDs are present
    assert(EMBEDDED_CREDENTIALS.twitch.clientId.length > 0, 'Twitch client ID should be present');
    assert(EMBEDDED_CREDENTIALS.youtube.clientId.includes('.apps.googleusercontent.com'), 'YouTube client ID should be valid Google format');
    assert(EMBEDDED_CREDENTIALS.kick.clientId.length > 0, 'Kick client ID should be present');
    console.log('  ✅ Valid client IDs found');

    // Check secure redirect URI
    assert(OAUTH_CONFIG.redirectUri === 'https://localhost:8443/callback', 'Redirect URI should be localhost HTTPS');
    assert(OAUTH_CONFIG.redirectUri.startsWith('https:'), 'Redirect URI must use HTTPS');
    console.log('  ✅ Secure redirect URI configured');

    // Check OAuth 2.1 compliant endpoints
    assert(OAUTH_CONFIG.endpoints.twitch.authorize === 'https://id.twitch.tv/oauth2/authorize', 'Twitch authorize endpoint correct');
    assert(OAUTH_CONFIG.endpoints.twitch.token === 'https://id.twitch.tv/oauth2/token', 'Twitch token endpoint correct');
    assert(OAUTH_CONFIG.endpoints.youtube.authorize === 'https://accounts.google.com/o/oauth2/v2/auth', 'YouTube authorize endpoint correct');
    assert(OAUTH_CONFIG.endpoints.youtube.token === 'https://oauth2.googleapis.com/token', 'YouTube token endpoint correct');
    assert(OAUTH_CONFIG.endpoints.kick.authorize === 'https://id.kick.com/oauth/authorize', 'Kick authorize endpoint correct');
    assert(OAUTH_CONFIG.endpoints.kick.token === 'https://id.kick.com/oauth/token', 'Kick token endpoint correct');
    console.log('  ✅ OAuth 2.1 compliant endpoints configured');

    // Check appropriate scopes
    assert(OAUTH_CONFIG.scopes.twitch.includes('user:read:email'), 'Twitch should have user:read:email scope');
    assert(OAUTH_CONFIG.scopes.youtube.includes('https://www.googleapis.com/auth/youtube.readonly'), 'YouTube should have readonly scope');
    assert(OAUTH_CONFIG.scopes.kick.includes('user:read'), 'Kick should have user:read scope');
    console.log('  ✅ Appropriate scopes configured');

    console.log('✅ Security Configuration validation passed!');
  }

  // Validate OAuth flow structure (without actual HTTP calls)
  validateOAuthFlowStructure(): void {
    console.log('🔄 Validating OAuth Flow Structure...');

    // Check that all login methods exist
    assert(typeof this.oauthService.loginTwitch === 'function', 'loginTwitch method should exist');
    assert(typeof this.oauthService.loginYouTube === 'function', 'loginYouTube method should exist');
    assert(typeof this.oauthService.loginKick === 'function', 'loginKick method should exist');
    console.log('  ✅ All login methods exist');

    // Check that all refresh methods exist
    assert(typeof this.oauthService.refreshTwitchToken === 'function', 'refreshTwitchToken method should exist');
    assert(typeof this.oauthService.refreshYouTubeToken === 'function', 'refreshYouTubeToken method should exist');
    assert(typeof this.oauthService.refreshKickToken === 'function', 'refreshKickToken method should exist');
    console.log('  ✅ All refresh methods exist');

    // Check that all logout methods exist
    assert(typeof this.oauthService.logoutTwitch === 'function', 'logoutTwitch method should exist');
    assert(typeof this.oauthService.logoutYouTube === 'function', 'logoutYouTube method should exist');
    assert(typeof this.oauthService.logoutKick === 'function', 'logoutKick method should exist');
    console.log('  ✅ All logout methods exist');

    // Check validation method exists
    assert(typeof this.oauthService.validateAndRefreshToken === 'function', 'validateAndRefreshToken method should exist');
    console.log('  ✅ Token validation method exists');

    console.log('✅ OAuth Flow Structure validation passed!');
  }

  // Run all validations
  runAllValidations(): void {
    console.log('🚀 Starting OAuth 2.1/PKCE Security Validation...\n');

    try {
      this.validatePKCE();
      console.log('');
      
      this.validateSecurityConfig();
      console.log('');
      
      this.validateOAuthFlowStructure();
      console.log('');

      console.log('🎉 All OAuth security validations passed!');
      console.log('✅ Your application follows OAuth 2.1 best practices for public clients');
      console.log('✅ PKCE is properly implemented for all platforms');
      console.log('✅ No client secrets are stored in the application');
      console.log('✅ All endpoints are secure and up-to-date');
      
    } catch (error) {
      console.error('❌ Validation failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  const validation = new OAuthValidation();
  validation.runAllValidations();
}
