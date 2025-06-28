import test from 'node:test';
import assert from 'node:assert';
import { ScrapingService } from '../src/services/scraping.service';

test('Kick scraping for specific streamers', async () => {
  const scrapingService = new ScrapingService();
  
  try {
    // Test xqc
    const xqcResult = await scrapingService.checkKickStream('xqc');
    assert.strictEqual(typeof xqcResult.isLive, 'boolean');
    assert.strictEqual(typeof xqcResult.title, 'string');
    
    // Test destiny
    const destinyResult = await scrapingService.checkKickStream('destiny');
    assert.strictEqual(typeof destinyResult.isLive, 'boolean');
    assert.strictEqual(typeof destinyResult.title, 'string');
    
  } finally {
    await scrapingService.cleanup();
  }
});
