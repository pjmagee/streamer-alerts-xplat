import { getDownloadedBrowsers } from './src/utils/browser-manager.js';

console.log('Testing browser detection with new Puppeteer Browsers API...');

try {
  const browsers = await getDownloadedBrowsers();
  console.log(`Found ${browsers.length} downloaded browser(s):`);
  browsers.forEach((browser, index) => {
    console.log(`${index + 1}. ${browser.name} (${browser.browser}) at: ${browser.path}`);
  });
  
  if (browsers.length === 0) {
    console.log('No downloaded browsers found. Use the app to download browsers via Puppeteer API.');
  }
  
  console.log('✅ Browser detection test completed successfully!');
} catch (error) {
  console.error('❌ Browser detection test failed:', error);
  process.exit(1);
}
