import { ScrapingService } from '../src/services/ScrapingService';

async function testScraping(): Promise<void> {
    const scrapingService = new ScrapingService();
    
    console.log('Testing Playwright-based scraping (production mode)...\n');
    
    try {
        // Test Twitch scraping
        console.log('Testing Twitch scraping...');
        const twitchResult = await scrapingService.checkTwitchStream('cohhcarnage');
        console.log('Twitch result:', twitchResult);
        console.log();
        
        // Test YouTube scraping  
        console.log('Testing YouTube scraping...');
        const youtubeResult = await scrapingService.checkYouTubeStream('@GBNewsOnline');
        console.log('YouTube result:', youtubeResult);
        console.log();
        
        // Test Kick scraping
        console.log('Testing Kick scraping...');
        const kickResult = await scrapingService.checkKickStream('xqc');
        console.log('Kick result:', kickResult);
        console.log();
        
    } catch (error) {
        console.error('Error during testing:', error);
    } finally {
        await scrapingService.cleanup();
        console.log('Cleanup completed.');
    }
}

testScraping();
