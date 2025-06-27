/**
 * Build Configuration Script
 * This script handles copying production credentials to the build output
 */

const fs = require('fs');
const path = require('path');

console.log('🏗️  Production build detected - preparing credentials...');

// Check if config.prod.json exists in the root
const prodConfigSource = path.join(__dirname, 'config.prod.json');

if (!fs.existsSync(prodConfigSource)) {
  console.error('❌ Missing config.prod.json file!');
  console.error('');
  console.error('Please create config.prod.json in the project root with your production credentials:');
  console.error('{');
  console.error('  "TWITCH_CLIENT_ID": "your_twitch_client_id",');
  console.error('  "YOUTUBE_CLIENT_ID": "your_youtube_client_id",');
  console.error('  "KICK_CLIENT_ID": "your_kick_client_id",');
  console.error('  "KICK_CLIENT_SECRET": "your_kick_client_secret"');
  console.error('}');
  console.error('');
  console.error('This file is gitignored to keep your secrets secure.');
  process.exit(1);
}

// Validate the config file structure
let prodConfig;
try {
  const configContent = fs.readFileSync(prodConfigSource, 'utf8');
  prodConfig = JSON.parse(configContent);
} catch (error) {
  console.error('❌ Error reading config.prod.json:', error.message);
  process.exit(1);
}

// Validate that all required fields are present
const requiredFields = [
  'TWITCH_CLIENT_ID',
  'YOUTUBE_CLIENT_ID', 
  'KICK_CLIENT_ID',
  'KICK_CLIENT_SECRET'
];

const missingFields = requiredFields.filter(field => !prodConfig[field]);

if (missingFields.length > 0) {
  console.error('❌ Missing required fields in config.prod.json:');
  missingFields.forEach(field => console.error(`   - ${field}`));
  console.error('');
  console.error('Please add these fields to your config.prod.json file.');
  process.exit(1);
}

console.log('✅ Production configuration validated');

// Ensure dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy the config to the dist directory where the packaged app will look for it
const prodConfigDest = path.join(__dirname, 'dist', 'config.prod.json');
fs.copyFileSync(prodConfigSource, prodConfigDest);

console.log('✅ Production credentials copied to dist/config.prod.json');
console.log('� Ready for packaging!');
