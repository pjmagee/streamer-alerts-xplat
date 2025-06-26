const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createTrayIcon() {
  const svgBuffer = fs.readFileSync(path.join(__dirname, 'assets', 'tray-icon.svg'));
  
  // Create different sizes for different OS requirements
  const sizes = [16, 32, 64];
  
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, 'assets', `tray-icon-${size}.png`));
    
    console.log(`Created tray-icon-${size}.png`);
  }
  
  // Main tray icon (16x16 for Windows, 32x32 for others)
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile(path.join(__dirname, 'assets', 'tray-icon.png'));
    
  console.log('Created main tray-icon.png');
}

createTrayIcon().catch(console.error);
