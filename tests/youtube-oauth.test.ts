import test from 'node:test';
import assert from 'node:assert';
import { EMBEDDED_CREDENTIALS, OAUTH_CONFIG } from '../src/config';
import { createHash, randomBytes } from 'crypto';

/**
 * YouTube OAuth Authorization Code + PKCE Flow tests
 * Tests endpoint reachability and configuration without requiring user interaction
 */

test('YouTube OAuth Token Endpoint', async () => {
  // Test token endpoint with invalid request to verify it's reachable
  const response = await fetch(OAUTH_CONFIG.endpoints.youtube.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: EMBEDDED_CREDENTIALS.youtube.clientId,
      code: 'dummy_code_for_endpoint_test',
      redirect_uri: OAUTH_CONFIG.redirectUri,
    }),
  });

  // Should return 400 for invalid code, which means endpoint is working
  assert.strictEqual(response.status, 400, 'Should return 400 for invalid authorization code');
});

test('YouTube PKCE code generation', () => {
  // Generate PKCE challenge
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  
  assert.ok(codeVerifier.length >= 43, 'Code verifier should be at least 43 characters');
  assert.ok(codeChallenge.length >= 43, 'Code challenge should be at least 43 characters');
  assert.notStrictEqual(codeVerifier, codeChallenge, 'Code verifier and challenge should be different');
});

test('YouTube authorization URL generation', () => {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const state = randomBytes(16).toString('base64url');
  
  const authUrl = new URL(OAUTH_CONFIG.endpoints.youtube.authorize);
  authUrl.searchParams.set('client_id', EMBEDDED_CREDENTIALS.youtube.clientId);
  authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.youtube.join(' '));
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  
  assert.ok(authUrl.toString().includes('googleapis.com'), 'Should use Google OAuth endpoint');
  assert.ok(authUrl.searchParams.get('code_challenge'), 'Should include PKCE challenge');
  assert.strictEqual(authUrl.searchParams.get('code_challenge_method'), 'S256', 'Should use S256 method');
  assert.ok(authUrl.searchParams.get('client_id'), 'Should include client ID');
});
