import test from 'node:test';
import assert from 'node:assert';
import { ScrapingService } from '../src/services/scraping.service';
import { MockConfigService } from './mock-config.service';

test('Kick scraping returns proper structure', async () => {
  const mockConfig = new MockConfigService();
  const scrapingService = new ScrapingService(mockConfig);
  try {
    const result = await scrapingService.checkKickStream('mike-stutesman');
    
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


// 24/7 kick channel (music) coliadicto

test('Kick scraping returns online for 24/7 channel', async () => {
  const mockConfig = new MockConfigService();
  const scrapingService = new ScrapingService(mockConfig);
  try {
    const result = await scrapingService.checkKickStream('coliadicto');
    
    // Verify the structure
    assert.strictEqual(typeof result.isLive, 'boolean');
    assert.strictEqual(typeof result.title, 'string');
    
    // The result should have these properties
    assert.ok('isLive' in result);
    assert.ok('title' in result);
    
    // If live, title should not be empty
    assert.strictEqual(result.isLive, true);


  } finally {
    await scrapingService.cleanup();
  }
});

test('Kick scraping returns offline for offline channel', async () => {
  const mockConfig = new MockConfigService();
  const scrapingService = new ScrapingService(mockConfig);
  try {
    const result = await scrapingService.checkKickStream('magaoidh');
    
    // Verify the structure
    assert.strictEqual(typeof result.isLive, 'boolean');
    assert.strictEqual(typeof result.title, 'string');
    
    // The result should have these properties
    assert.ok('isLive' in result);
    assert.ok('title' in result);
    
    // If live, title should not be empty
    assert.strictEqual(result.isLive, false);


  } finally {
    await scrapingService.cleanup();
  }
});