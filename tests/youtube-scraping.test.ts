import test from 'node:test';
import assert from 'node:assert';
import { ScrapingService } from '../src/services/scraping.service';
import { MockConfigService } from './mock-config.service';

test('YouTube scraping returns proper structure', async () => {
  const mockConfig = new MockConfigService();
  const scrapingService = new ScrapingService(mockConfig);
  try {
    const result = await scrapingService.checkYouTubeStream('@GBNewsOnline');
    
    // Verify the structure
    assert.strictEqual(typeof result.isLive, 'boolean');
    assert.strictEqual(typeof result.title, 'string');
    
    // The result should have these properties
    assert.ok('isLive' in result);
    assert.ok('title' in result);
    
    // If live, title should not be empty
    if (result.isLive) {
      assert.ok(result.title.length > 0);
    }
  } finally {
    await scrapingService.cleanup();
  }
});
