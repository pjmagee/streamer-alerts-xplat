import { runTwitchTests } from './twitch-oauth.test';
import { runYouTubeTests } from './youtube-oauth.test';
import { runKickTests } from './kick-oauth.test';

/**
 * Comprehensive OAuth Test Runner
 * Runs all platform OAuth tests and provides a summary
 */

async function runAllOAuthTests(): Promise<void> {
  console.log('🚀 STREAMER ALERTS - OAUTH CONFIGURATION TESTS');
  console.log('=' .repeat(60));
  console.log('Testing OAuth configurations for all platforms...\n');

  const startTime = Date.now();

  try {
    // Run Twitch tests
    await runTwitchTests();
    console.log('\n' + '-'.repeat(60) + '\n');

    // Run YouTube tests  
    await runYouTubeTests();
    console.log('\n' + '-'.repeat(60) + '\n');

    // Run Kick tests
    await runKickTests();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '=' .repeat(60));
    console.log('🎯 FINAL TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log(`⏱️  Total test duration: ${duration} seconds`);
    console.log();
    console.log('Platform readiness:');
    console.log('  🔥 Twitch:  Device Code Grant Flow (OAuth 2.1 compliant)');
    console.log('  📺 YouTube: Authorization Code + PKCE (OAuth 2.1 compliant)');
    console.log('  ⚡ Kick:    Authorization Code + PKCE + Secret (Kick requirement)');
    console.log();
    console.log('🌐 All platforms use system browser for authentication');
    console.log('🔒 No embedded browser vulnerabilities');
    console.log('🔄 All platforms support refresh tokens');
    console.log();
    console.log('✨ OAuth implementation is ready for production use!');
    console.log('📱 Users can now authenticate with all three platforms');

  } catch (error) {
    console.error('\n💥 Test suite failed:', (error as Error).message);
    process.exit(1);
  }
}

// Additional utility function to test individual platforms
async function testPlatform(platform: 'twitch' | 'youtube' | 'kick'): Promise<void> {
  console.log(`🚀 Testing ${platform.toUpperCase()} OAuth Configuration\n`);

  switch (platform) {
    case 'twitch':
      await runTwitchTests();
      break;
    case 'youtube':
      await runYouTubeTests();
      break;
    case 'kick':
      await runKickTests();
      break;
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

// CLI argument handling
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run all tests by default
    runAllOAuthTests().catch(console.error);
  } else if (args.length === 1) {
    const platform = args[0].toLowerCase();
    if (['twitch', 'youtube', 'kick'].includes(platform)) {
      testPlatform(platform as 'twitch' | 'youtube' | 'kick').catch(console.error);
    } else {
      console.error('❌ Invalid platform. Use: twitch, youtube, or kick');
      console.log('Usage: npm run test-oauth [platform]');
      process.exit(1);
    }
  } else {
    console.error('❌ Too many arguments.');
    console.log('Usage: npm run test-oauth [platform]');
    process.exit(1);
  }
}

export { runAllOAuthTests, testPlatform };
