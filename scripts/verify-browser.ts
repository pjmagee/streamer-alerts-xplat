#!/usr/bin/env ts-node
import { findFirstAvailableBrowser } from '../src/utils/browser-manager';

(async () => {
  const browser = await findFirstAvailableBrowser();
  if (!browser) {
    console.error('[verify-browser] No browser detected. Ensure the CI step installed Chromium.');
    process.exit(1);
  }
  console.log(`[verify-browser] Detected browser: ${browser.name} at ${browser.path}`);
})();
