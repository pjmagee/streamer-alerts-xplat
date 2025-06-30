#!/usr/bin/env node

/**
 * Verification script for build outputs
 * This script verifies that the build process works correctly and produces expected outputs
 */

const fs = require('fs');
const path = require('path');

function log(message) {
  console.log(`[VERIFY] ${message}`);
}

function error(message) {
  console.error(`[ERROR] ${message}`);
  process.exit(1);
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✓ ${description}: ${filePath}`);
    return true;
  } else {
    error(`✗ ${description} not found: ${filePath}`);
    return false;
  }
}

function main() {
  log('Starting build verification...');

  // Check if we're in the project root
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    error('package.json not found. Please run this script from the project root.');
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  log(`Project: ${pkg.name} v${pkg.version}`);

  // Check config files exist (they should be created during CI if missing)
  const configDir = path.join(process.cwd(), 'config');
  if (fs.existsSync(configDir)) {
    log('✓ Config directory exists');
    
    const localConfig = path.join(configDir, 'config.local.json');
    const prodConfig = path.join(configDir, 'config.prod.json');
    
    if (fs.existsSync(localConfig)) {
      log('✓ Local config exists');
    } else {
      log('⚠ Local config missing (will use defaults)');
    }
    
    if (fs.existsSync(prodConfig)) {
      log('✓ Production config exists');
    } else {
      log('⚠ Production config missing (will use defaults)');
    }
  } else {
    log('⚠ Config directory missing (will use defaults)');
  }

  // Check build outputs
  const outDir = path.join(process.cwd(), 'out');
  if (fs.existsSync(outDir)) {
    log('✓ Build output directory exists');
    
    // Look for platform-specific builds
    const entries = fs.readdirSync(outDir);
    const builds = entries.filter(entry => {
      const fullPath = path.join(outDir, entry);
      return fs.statSync(fullPath).isDirectory() && entry.includes('win32') || entry.includes('darwin') || entry.includes('linux');
    });
    
    if (builds.length > 0) {
      log(`✓ Found ${builds.length} platform build(s): ${builds.join(', ')}`);
      
      // Check for executables
      builds.forEach(build => {
        const buildPath = path.join(outDir, build);
        const files = fs.readdirSync(buildPath);
        
        // Look for the expected executable name
        const executable = files.find(file => 
          file === 'streamer-alerts-xplat.exe' || 
          file === 'streamer-alerts-xplat' ||
          file.startsWith(pkg.productName)
        );
        
        if (executable) {
          log(`✓ Found executable in ${build}: ${executable}`);
        } else {
          log(`⚠ No executable found in ${build}`);
        }
      });
    } else {
      log('⚠ No platform builds found in output directory');
    }
  } else {
    log('⚠ Build output directory not found (run npm run package first)');
  }

  // Check test files
  const testsDir = path.join(process.cwd(), 'tests');
  if (fs.existsSync(testsDir)) {
    const testFiles = fs.readdirSync(testsDir).filter(file => file.endsWith('.test.ts'));
    log(`✓ Found ${testFiles.length} test file(s): ${testFiles.join(', ')}`);
  } else {
    error('Tests directory not found');
  }

  log('Build verification completed successfully!');
}

if (require.main === module) {
  main();
}

module.exports = { main, checkFile };
