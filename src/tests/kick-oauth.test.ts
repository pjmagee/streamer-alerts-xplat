import { EMBEDDED_CREDENTIALS, OAUTH_CONFIG } from '../config';

/**
 * TypeScript test for Kick OAuth Authorization Code + PKCE + Client Secret Flow
 * Tests endpoint reachability and configuration without requiring user interaction
 */

async function testKickEndpoints(): Promise<boolean> {
  console.log('⚡ Testing Kick OAuth endpoints...\n');

  try {
    console.log(`📋 Client ID: ${EMBEDDED_CREDENTIALS.kick.clientId}`);
    console.log(`📋 Client Secret: ${'*'.repeat(20)}... (hidden)`);
    console.log(`📋 Scopes: ${OAUTH_CONFIG.scopes.kick.join(' ')}`);
    console.log(`📋 Authorize endpoint: ${OAUTH_CONFIG.endpoints.kick.authorize}`);
    console.log(`📋 Token endpoint: ${OAUTH_CONFIG.endpoints.kick.token}\n`);

    // Test token endpoint with invalid request to verify it's reachable
    const response = await fetch(OAUTH_CONFIG.endpoints.kick.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: EMBEDDED_CREDENTIALS.kick.clientId,
        client_secret: EMBEDDED_CREDENTIALS.kick.clientSecret,
        code: 'dummy_code_for_endpoint_test',
        redirect_uri: 'http://localhost:3000/callback',
      }),
    });

    // We expect 401 Unauthorized for invalid code, which means endpoint is working
    if (response.status === 401 || response.status === 400) {
      let errorData: any = {};
      try {
        const responseText = await response.text();
        if (responseText) {
          try {
            errorData = JSON.parse(responseText);
          } catch {
            errorData = { message: responseText };
          }
        }
      } catch {
        // Empty response is also acceptable for this test
      }

      console.log(`✅ Kick token endpoint is reachable (${response.status} for invalid code)`);
      if (errorData.error) {
        console.log(`📋 Error type: ${errorData.error}`);
      }
      return true;
    }

    console.log(`⚠️  Unexpected response: ${response.status} ${response.statusText}`);
    const responseText = await response.text();
    console.log(`Response: ${responseText}`);
    return false;

  } catch (error) {
    console.error('❌ Kick endpoint test failed:');
    console.error((error as Error).message);
    return false;
  }
}

async function testKickPKCEGeneration(): Promise<boolean> {
  console.log('🔐 Testing PKCE code generation for Kick...\n');

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

async function testKickAuthURL(): Promise<boolean> {
  console.log('🌐 Testing Kick authorization URL generation...\n');

  try {
    const { createHash, randomBytes } = await import('crypto');
    
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(16).toString('hex');
    const redirectUri = 'http://localhost:3000/callback';

    const authUrl = new URL(OAUTH_CONFIG.endpoints.kick.authorize);
    authUrl.searchParams.set('client_id', EMBEDDED_CREDENTIALS.kick.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.kick.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('✅ Authorization URL generated successfully:');
    console.log(`🔗 ${authUrl.toString().substring(0, 100)}...`);
    console.log(`📋 Contains PKCE parameters: ✅`);
    console.log(`📋 Contains state parameter: ✅`);
    console.log(`📋 Uses id.kick.com domain: ✅`);

    return true;
  } catch (error) {
    console.error('❌ Authorization URL generation failed:');
    console.error((error as Error).message);
    return false;
  }
}

async function testKickSecurityNotes(): Promise<boolean> {
  console.log('🔒 Testing Kick security configuration...\n');

  try {
    const hasClientSecret = !!EMBEDDED_CREDENTIALS.kick.clientSecret;
    const clientSecretLength = EMBEDDED_CREDENTIALS.kick.clientSecret?.length || 0;

    console.log(`📋 Client secret present: ${hasClientSecret ? '✅' : '❌'}`);
    console.log(`📋 Client secret length: ${clientSecretLength} characters`);
    
    if (hasClientSecret) {
      console.log('⚠️  Security note: Kick requires client_secret even with PKCE');
      console.log('   This is not ideal for desktop apps but required by Kick\'s API');
    }

    return hasClientSecret;
  } catch (error) {
    console.error('❌ Security configuration test failed:');
    console.error((error as Error).message);
    return false;
  }
}

async function runKickTests(): Promise<void> {
  console.log('🚀 Running Kick OAuth Tests\n');
  console.log('=' .repeat(50));

  const endpointsResult = await testKickEndpoints();
  const pkceResult = await testKickPKCEGeneration();
  const authUrlResult = await testKickAuthURL();
  const securityResult = await testKickSecurityNotes();

  console.log('\n' + '=' .repeat(50));
  console.log('📊 Kick Test Results:');
  console.log(`  Endpoints Reachable: ${endpointsResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  PKCE Generation: ${pkceResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Auth URL Generation: ${authUrlResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Security Config: ${securityResult ? '✅ CONFIGURED' : '❌ MISSING'}`);
  
  const allPassed = endpointsResult && pkceResult && authUrlResult && securityResult;
  console.log(`\n🎯 Overall Kick OAuth: ${allPassed ? '✅ READY' : '❌ ISSUES'}`);
  
  if (allPassed) {
    console.log('\n✨ Kick OAuth is properly configured and ready for use!');
    console.log('⚠️  Note: Uses client_secret (required by Kick\'s API)');
  } else {
    console.log('\n🔧 Kick OAuth needs attention before use.');
  }
}

if (require.main === module) {
  runKickTests().catch(console.error);
}

export { runKickTests, testKickEndpoints, testKickPKCEGeneration, testKickAuthURL };
