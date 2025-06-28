import test from 'node:test';
import assert from 'node:assert';
import { EMBEDDED_CREDENTIALS, OAUTH_CONFIG } from '../src/config';

/**
 * TypeScript test for Twitch Device Code Grant Flow
 * Tests the device authorization step without requiring user interaction
 */

interface TwitchDeviceResponse {
  device_code: string;
  expires_in: number;
  interval: number;
  user_code: string;
  verification_uri: string;
}

test('Twitch Device Authorization', async () => {
  const response = await fetch(OAUTH_CONFIG.endpoints.twitch.device, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: EMBEDDED_CREDENTIALS.twitch.clientId,
      scopes: OAUTH_CONFIG.scopes.twitch.join(' '),
    }),
  });

  assert.ok(response.ok, `Device authorization failed: ${response.status} ${response.statusText}`);
  
  const deviceData: TwitchDeviceResponse = await response.json();
  
  assert.ok(deviceData.user_code, 'Should have user_code');
  assert.ok(deviceData.verification_uri, 'Should have verification_uri');
  assert.ok(deviceData.device_code, 'Should have device_code');
  assert.ok(typeof deviceData.expires_in === 'number', 'Should have expires_in as number');
  assert.ok(typeof deviceData.interval === 'number', 'Should have interval as number');
});

test('Twitch Token Validation Endpoint', async () => {
  // Test with a dummy token to verify endpoint is reachable
  const response = await fetch(OAUTH_CONFIG.endpoints.twitch.validate, {
    headers: {
      'Authorization': 'Bearer dummy_token_for_endpoint_test',
    },
  });

  // We expect 401 Unauthorized for invalid token, which means endpoint is working
  assert.strictEqual(response.status, 401, 'Should return 401 for invalid token');
});
