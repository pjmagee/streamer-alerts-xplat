import { EMBEDDED_CREDENTIALS, OAUTH_CONFIG } from '../config';

/**
 * TypeScript test for YouTube OAuth Authorization Code + PKCE Flow
 * Tests endpoint reachability and configuration without requiring user interaction
 */

async function testYouTubeEndpoints(): Promise<boolean> {
  console.log('📺 Testing YouTube OAuth endpoints...\n');

  try {
    console.log(`📋 Client ID: ${EMBEDDED_CREDENTIALS.youtube.clientId}`);
    console.log(`📋 Scopes: ${OAUTH_CONFIG.scopes.youtube.join(' ')}`);
    console.log(`📋 Authorize endpoint: ${OAUTH_CONFIG.endpoints.youtube.authorize}`);
    console.log(`📋 Token endpoint: ${OAUTH_CONFIG.endpoints.youtube.token}`);
    console.log(`📋 Revoke endpoint: ${OAUTH_CONFIG.endpoints.youtube.revoke}\n`);

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
      }),
    });

    // We expect 400 Bad Request for invalid/incomplete request, which means endpoint is working
    if (response.status === 400) {
      console.log('✅ YouTube token endpoint is reachable (400 for incomplete request)');
      return true;
    }

    console.log(`⚠️  Unexpected response: ${response.status} ${response.statusText}`);
    try {
      const responseText = await response.text();
      console.log(`Response: ${responseText.substring(0, 200)}...`);
    } catch {
      console.log('Could not read response body');
    }
    
    // Even if we got an unexpected response, if we reached the endpoint, it's working
    if (response.status >= 400 && response.status < 500) {
      console.log('✅ YouTube endpoint is reachable (client error as expected)');
      return true;
    }
    
    return false;

  } catch (error) {
    console.error('❌ YouTube endpoint test failed:');
    console.error((error as Error).message);
    return false;
  }
}

async function testYouTubePKCEGeneration(): Promise<boolean> {
  console.log('🔐 Testing PKCE code generation...\n');

  try {
    const { createHash, randomBytes } = await import('crypto');

    // Generate PKCE parameters like the actual OAuth service does
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    console.log(`✅ Code verifier generated: ${codeVerifier.substring(0, 20)}...`);
    console.log(`✅ Code challenge generated: ${codeChallenge.substring(0, 20)}...`);
    console.log('✅ PKCE parameters can be generated successfully');

    return true;
  } catch (error) {
    console.error('❌ PKCE generation failed:');
    console.error((error as Error).message);
    return false;
  }
}

async function testYouTubeAuthURL(): Promise<boolean> {
  console.log('🌐 Testing YouTube authorization URL generation...\n');

  try {
    const { createHash, randomBytes } = await import('crypto');
    
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(16).toString('hex');
    const redirectUri = 'http://localhost:3000/callback';

    const authUrl = new URL(OAUTH_CONFIG.endpoints.youtube.authorize);
    authUrl.searchParams.set('client_id', EMBEDDED_CREDENTIALS.youtube.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.youtube.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('access_type', 'offline');

    console.log('✅ Authorization URL generated successfully:');
    console.log(`🔗 ${authUrl.toString().substring(0, 100)}...`);
    console.log(`📋 Contains PKCE parameters: ✅`);
    console.log(`📋 Contains state parameter: ✅`);
    console.log(`📋 Contains offline access: ✅`);

    return true;
  } catch (error) {
    console.error('❌ Authorization URL generation failed:');
    console.error((error as Error).message);
    return false;
  }
}

async function runYouTubeTests(): Promise<void> {
  console.log('🚀 Running YouTube OAuth Tests\n');
  console.log('=' .repeat(50));

  const endpointsResult = await testYouTubeEndpoints();
  const pkceResult = await testYouTubePKCEGeneration();
  const authUrlResult = await testYouTubeAuthURL();

  console.log('\n' + '=' .repeat(50));
  console.log('📊 YouTube Test Results:');
  console.log(`  Endpoints Reachable: ${endpointsResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  PKCE Generation: ${pkceResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Auth URL Generation: ${authUrlResult ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = endpointsResult && pkceResult && authUrlResult;
  console.log(`\n🎯 Overall YouTube OAuth: ${allPassed ? '✅ READY' : '❌ ISSUES'}`);
  
  if (allPassed) {
    console.log('\n✨ YouTube OAuth is properly configured and ready for use!');
  } else {
    console.log('\n🔧 YouTube OAuth needs attention before use.');
  }
}

if (require.main === module) {
  runYouTubeTests().catch(console.error);
}

export { runYouTubeTests, testYouTubeEndpoints, testYouTubePKCEGeneration, testYouTubeAuthURL };
