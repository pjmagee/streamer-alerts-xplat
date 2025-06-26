import { EMBEDDED_CREDENTIALS, OAUTH_CONFIG } from '../config';

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

async function testTwitchDeviceAuth(): Promise<boolean> {
  console.log('🔥 Testing Twitch Device Authorization...\n');

  try {
    console.log(`📋 Using client ID: ${EMBEDDED_CREDENTIALS.twitch.clientId}`);
    console.log(`📋 Requesting scopes: ${OAUTH_CONFIG.scopes.twitch.join(' ')}`);
    console.log(`📋 Endpoint: ${OAUTH_CONFIG.endpoints.twitch.device}\n`);

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

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorData = await response.json();
        errorDetails = JSON.stringify(errorData, null, 2);
      } catch {
        errorDetails = await response.text();
      }
      throw new Error(`Device authorization failed: ${response.status} ${response.statusText}\n${errorDetails}`);
    }

    const deviceData: TwitchDeviceResponse = await response.json();

    console.log('✅ Device authorization successful!');
    console.log(`📱 User code: ${deviceData.user_code}`);
    console.log(`🌐 Verification URI: ${deviceData.verification_uri}`);
    console.log(`⏰ Expires in: ${deviceData.expires_in} seconds`);
    console.log(`🔄 Poll interval: ${deviceData.interval} seconds`);
    console.log(`🔑 Device code: ${deviceData.device_code.substring(0, 10)}...`);

    return true;
  } catch (error) {
    console.error('❌ Twitch device authorization failed:');
    console.error((error as Error).message);
    return false;
  }
}

async function testTwitchTokenValidation(): Promise<boolean> {
  console.log('\n🔍 Testing Twitch token validation endpoint...\n');

  try {
    // Test with a dummy token to verify endpoint is reachable
    const response = await fetch(OAUTH_CONFIG.endpoints.twitch.validate, {
      headers: {
        'Authorization': 'Bearer dummy_token_for_endpoint_test',
      },
    });

    // We expect 401 Unauthorized for invalid token, which means endpoint is working
    if (response.status === 401) {
      console.log('✅ Token validation endpoint is reachable (401 for invalid token)');
      return true;
    } else {
      console.log(`⚠️  Unexpected response: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Token validation endpoint test failed:');
    console.error((error as Error).message);
    return false;
  }
}

async function runTwitchTests(): Promise<void> {
  console.log('🚀 Running Twitch OAuth Tests\n');
  console.log('=' .repeat(50));

  const deviceAuthResult = await testTwitchDeviceAuth();
  const tokenValidationResult = await testTwitchTokenValidation();

  console.log('\n' + '=' .repeat(50));
  console.log('📊 Twitch Test Results:');
  console.log(`  Device Authorization: ${deviceAuthResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Token Validation Endpoint: ${tokenValidationResult ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = deviceAuthResult && tokenValidationResult;
  console.log(`\n🎯 Overall Twitch OAuth: ${allPassed ? '✅ READY' : '❌ ISSUES'}`);
  
  if (allPassed) {
    console.log('\n✨ Twitch OAuth is properly configured and ready for use!');
  } else {
    console.log('\n🔧 Twitch OAuth needs attention before use.');
  }
}

if (require.main === module) {
  runTwitchTests().catch(console.error);
}

export { runTwitchTests, testTwitchDeviceAuth, testTwitchTokenValidation };
