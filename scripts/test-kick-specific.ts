#!/usr/bin/env tsx

import { ScrapingService } from '../src/services/ScrapingService';

async function testKickScraping() {
  console.log('Testing Kick scraping for xqc specifically...');
  
  const scrapingService = new ScrapingService();
  
  try {
    console.log('Checking xqc on Kick...');
    const result = await scrapingService.checkKickStream('xqc');
    console.log('Result:', result);
    
    console.log('\nChecking destiny on Kick...');
    const result2 = await scrapingService.checkKickStream('destiny');
    console.log('Result:', result2);
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await scrapingService.cleanup();
    console.log('Cleanup completed.');
  }
}

testKickScraping().catch(console.error);
