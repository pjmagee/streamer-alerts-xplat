// Test script to verify config loading works with missing files
const fs = require('fs');
const path = require('path');

// Temporarily move config files
const configDir = path.join(__dirname, 'config');
const localConfig = path.join(configDir, 'config.local.json');
const prodConfig = path.join(configDir, 'config.prod.json');
const localBackup = localConfig + '.test-backup';
const prodBackup = prodConfig + '.test-backup';

console.log('Testing config loading with missing files...');

try {
  // Backup existing files
  if (fs.existsSync(localConfig)) {
    fs.renameSync(localConfig, localBackup);
    console.log('Backed up local config');
  }
  if (fs.existsSync(prodConfig)) {
    fs.renameSync(prodConfig, prodBackup);
    console.log('Backed up prod config');
  }

  // Test loading config without files
  console.log('Attempting to load config without files...');
  delete require.cache[path.join(__dirname, 'src', 'config.ts')]; // Clear cache
  
  // This should work without throwing an error
  const config = require('./dist/config.js');
  console.log('✓ Config loaded successfully');
  console.log('Config credentials:', JSON.stringify(config.EMBEDDED_CREDENTIALS, null, 2));

} catch (error) {
  console.error('✗ Config loading failed:', error.message);
} finally {
  // Restore files
  if (fs.existsSync(localBackup)) {
    fs.renameSync(localBackup, localConfig);
    console.log('Restored local config');
  }
  if (fs.existsSync(prodBackup)) {
    fs.renameSync(prodBackup, prodConfig);
    console.log('Restored prod config');
  }
}

console.log('Test completed');
