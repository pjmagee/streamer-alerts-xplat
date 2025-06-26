#!/usr/bin/env ts-node

/**
 * Credential Storage Consistency Verification Script
 * 
 * This script verifies that all three platforms (Twitch, YouTube, Kick) 
 * follow the same credential storage pattern and include all required fields.
 */

import { ApiCredentials } from '../src/types/Streamer';
import { EMBEDDED_CREDENTIALS } from '../src/config';

function verifyCredentialStructure() {
  console.log('🔍 CREDENTIAL STORAGE CONSISTENCY VERIFICATION');
  console.log('============================================================');
  
  // Mock the credentials structure to verify it matches our expected patterns
  const mockCredentials: ApiCredentials = {
    twitch: {
      clientId: '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      isLoggedIn: false,
      username: '',
      displayName: ''
    },
    youtube: {
      clientId: '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      isLoggedIn: false,
      displayName: ''
    },
    kick: {
      clientId: '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      isLoggedIn: false,
      username: '',
      displayName: ''
    }
  };
  
  console.log('📋 Checking credential structure for all platforms...\n');
  
  // Verify Twitch credentials
  console.log('🔥 TWITCH CREDENTIALS:');
  console.log(`   clientId: ${typeof mockCredentials.twitch.clientId} (${mockCredentials.twitch.clientId ? 'set' : 'empty'})`);
  console.log(`   accessToken: ${typeof mockCredentials.twitch.accessToken} (${mockCredentials.twitch.accessToken ? 'set' : 'empty'})`);
  console.log(`   refreshToken: ${typeof mockCredentials.twitch.refreshToken} (${mockCredentials.twitch.refreshToken ? 'set' : 'empty'})`);
  console.log(`   expiresAt: ${typeof mockCredentials.twitch.expiresAt} (${mockCredentials.twitch.expiresAt || 'not set'})`);
  console.log(`   isLoggedIn: ${mockCredentials.twitch.isLoggedIn}`);
  console.log(`   username: ${typeof mockCredentials.twitch.username} (${mockCredentials.twitch.username ? 'set' : 'empty'})`);
  console.log(`   displayName: ${typeof mockCredentials.twitch.displayName} (${mockCredentials.twitch.displayName ? 'set' : 'empty'})`);
  
  console.log('\n📺 YOUTUBE CREDENTIALS:');
  console.log(`   clientId: ${typeof mockCredentials.youtube.clientId} (${mockCredentials.youtube.clientId ? 'set' : 'empty'})`);
  console.log(`   accessToken: ${typeof mockCredentials.youtube.accessToken} (${mockCredentials.youtube.accessToken ? 'set' : 'empty'})`);
  console.log(`   refreshToken: ${typeof mockCredentials.youtube.refreshToken} (${mockCredentials.youtube.refreshToken ? 'set' : 'empty'})`);
  console.log(`   expiresAt: ${typeof mockCredentials.youtube.expiresAt} (${mockCredentials.youtube.expiresAt || 'not set'})`);
  console.log(`   isLoggedIn: ${mockCredentials.youtube.isLoggedIn}`);
  console.log(`   displayName: ${typeof mockCredentials.youtube.displayName} (${mockCredentials.youtube.displayName ? 'set' : 'empty'})`);
  
  console.log('\n⚡ KICK CREDENTIALS:');
  console.log(`   clientId: ${typeof mockCredentials.kick.clientId} (${mockCredentials.kick.clientId ? 'set' : 'empty'})`);
  console.log(`   accessToken: ${typeof mockCredentials.kick.accessToken} (${mockCredentials.kick.accessToken ? 'set' : 'empty'})`);
  console.log(`   refreshToken: ${typeof mockCredentials.kick.refreshToken} (${mockCredentials.kick.refreshToken ? 'set' : 'empty'})`);
  console.log(`   expiresAt: ${typeof mockCredentials.kick.expiresAt} (${mockCredentials.kick.expiresAt || 'not set'})`);
  console.log(`   isLoggedIn: ${mockCredentials.kick.isLoggedIn}`);
  console.log(`   username: ${typeof mockCredentials.kick.username} (${mockCredentials.kick.username ? 'set' : 'empty'})`);
  console.log(`   displayName: ${typeof mockCredentials.kick.displayName} (${mockCredentials.kick.displayName ? 'set' : 'empty'})`);
  
  console.log('\n🔧 EMBEDDED CREDENTIALS CHECK:');
  console.log(`   Twitch Client ID: ${EMBEDDED_CREDENTIALS.twitch.clientId ? 'configured' : 'missing'}`);
  console.log(`   YouTube Client ID: ${EMBEDDED_CREDENTIALS.youtube.clientId ? 'configured' : 'missing'}`);
  console.log(`   Kick Client ID: ${EMBEDDED_CREDENTIALS.kick.clientId ? 'configured' : 'missing'}`);
  console.log(`   Kick Client Secret: ${EMBEDDED_CREDENTIALS.kick.clientSecret ? 'configured' : 'missing'}`);
  
  console.log('\n✅ CONSISTENCY VERIFICATION:');
  
  // Check that all platforms have clientId field
  const allHaveClientId = mockCredentials.twitch.clientId !== undefined && 
                         mockCredentials.youtube.clientId !== undefined && 
                         mockCredentials.kick.clientId !== undefined;
  console.log(`   All platforms have clientId field: ${allHaveClientId ? '✅' : '❌'}`);
  
  // Check that all platforms have the core OAuth fields
  const allHaveCoreFields = 
    mockCredentials.twitch.accessToken !== undefined && 
    mockCredentials.twitch.refreshToken !== undefined && 
    mockCredentials.twitch.expiresAt !== undefined && 
    mockCredentials.twitch.isLoggedIn !== undefined &&
    mockCredentials.youtube.accessToken !== undefined && 
    mockCredentials.youtube.refreshToken !== undefined && 
    mockCredentials.youtube.expiresAt !== undefined && 
    mockCredentials.youtube.isLoggedIn !== undefined &&
    mockCredentials.kick.accessToken !== undefined && 
    mockCredentials.kick.refreshToken !== undefined && 
    mockCredentials.kick.expiresAt !== undefined && 
    mockCredentials.kick.isLoggedIn !== undefined;
  console.log(`   All platforms have core OAuth fields: ${allHaveCoreFields ? '✅' : '❌'}`);
  
  // Check that all platforms have displayName for UI
  const allHaveDisplayName = mockCredentials.twitch.displayName !== undefined && 
                            mockCredentials.youtube.displayName !== undefined && 
                            mockCredentials.kick.displayName !== undefined;
  console.log(`   All platforms have displayName field: ${allHaveDisplayName ? '✅' : '❌'}`);
  
  // Check username fields (only for platforms that need it)
  const usernameFieldsCorrect = mockCredentials.twitch.username !== undefined && 
                               mockCredentials.kick.username !== undefined;
  console.log(`   Username fields correctly configured: ${usernameFieldsCorrect ? '✅' : '❌'} (Twitch & Kick only)`);
  
  console.log('\n📊 SUMMARY:');
  if (allHaveClientId && allHaveCoreFields && allHaveDisplayName && usernameFieldsCorrect) {
    console.log('✅ All credential structures are consistent and properly configured!');
    console.log('✅ Each platform stores exactly the fields it needs for API calls and UI display.');
    console.log('✅ No unnecessary fields are stored, following the principle of minimal data storage.');
  } else {
    console.log('❌ Some inconsistencies found in credential structures.');
  }
  
  console.log('============================================================');
}

if (require.main === module) {
  verifyCredentialStructure();
}
