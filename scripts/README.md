# Scripts Folder - Clean and Organized

This folder contains utility scripts for the Streamer Alerts project.

## Current Scripts:

### **Development & Build**
- `cleanup-data.js` - Cleans user data and config (for development)
- `create-icons.js` - Generates tray icons from SVG assets
- `create-alert-icons.js` - Generates alert/notification icons from SVG assets

### **Testing & Validation**
- `test-notification.js` - Tests system notifications in Electron
- `validate-security.js` - Validates OAuth security configurations

## Available npm scripts:
```bash
npm run cleanup-data        # Clean user data (safe)
npm run cleanup-data-force  # Force clean user data (destructive)
npm run test-notification   # Test system notifications
```

## Removed Scripts (2024-06-26):
- `debug-store.js` - Basic electron-store debugging (replaced by better tooling)
- `debug-electron-store.js` - Advanced store debugging (no longer needed)
- `test-config-location.js` - Config location testing (issues resolved)
- `test-*-login.js` - Individual OAuth test scripts (replaced by comprehensive test suite)

## Notes:
- All OAuth testing is now handled by the comprehensive test suite in `src/tests/`
- Icon generation scripts require `sharp` dependency
- Cleanup scripts preserve important user data by default
