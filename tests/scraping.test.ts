import test from 'node:test';
import assert from 'node:assert';
import { ScrapingService } from '../src/services/scraping.service';

test('Playwright-based scraping returns proper structure', async () => {
  const scrapingService = new ScrapingService();
  try {
    const twitch = await scrapingService.checkTwitchStream('esfandtv');
    console.log('Twitch:', twitch);
    assert.strictEqual(typeof twitch.isLive, 'boolean');
    assert.strictEqual(typeof twitch.title, 'string');

    const youtube = await scrapingService.checkYouTubeStream('@GBNewsOnline');
    console.log('YouTube:', youtube);
    assert.strictEqual(typeof youtube.isLive, 'boolean');
    assert.strictEqual(typeof youtube.title, 'string');

    const kick = await scrapingService.checkKickStream('esfandtv');
    console.log('Kick:', kick);
    assert.strictEqual(typeof kick.isLive, 'boolean');
    assert.strictEqual(typeof kick.title, 'string');
  } finally {
    await scrapingService.cleanup();
  }
});
