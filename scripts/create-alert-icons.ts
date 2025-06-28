import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

async function createAlertIcons(): Promise<void> {
  const svgPath = path.join(__dirname, '..', 'assets', 'tray-icon-alert.svg');
  const svgBuffer = fs.readFileSync(svgPath);
  
  // Create different sizes for the alert icon
  const sizes = [16, 32, 64];
  
  for (const size of sizes) {
    const outputPath = path.join(__dirname, '..', 'assets', `tray-icon-alert-${size}.png`);
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`Created ${outputPath}`);
  }
  
  // Create a default alert icon
  const defaultPath = path.join(__dirname, '..', 'assets', 'tray-icon-alert.png');
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(defaultPath);
  
  console.log(`Created ${defaultPath}`);
  console.log('Alert icons created successfully!');
}

createAlertIcons().catch(console.error);
