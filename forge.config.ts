import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { PublisherGithub } from '@electron-forge/publisher-github';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to get resources that actually exist
function getExtraResources(): string[] {
  const baseResources = [
    'images/tray-icon.png',      
    'images/tray-icon-16.png',
    'images/tray-icon-32.png',
    'images/tray-icon-64.png',
    'images/tray-icon-alert.png',
    'images/tray-icon-alert-16.png',
    'images/tray-icon-alert-32.png',
    'images/tray-icon-alert-64.png'
  ];

  const configFiles = [
    'config/config.local.json',
    'config/config.prod.json'
  ];

  // Only include config files if they exist
  const existingConfigFiles = configFiles.filter(file => {
    const exists = fs.existsSync(path.resolve(file));
    console.log(`Config file ${file}: ${exists ? 'EXISTS' : 'MISSING'}`);
    return exists;
  });

  return [...baseResources, ...existingConfigFiles];
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: '/images/icon', // no file extension required - Forge will add .ico/.icns/.png automatically
    extraResource: getExtraResources(),
    executableName: 'streamer-alerts-xplat', // Ensure consistent executable name across platforms
    appCopyright: 'Patrick Magee',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      authors: 'Patrick Magee',
      iconUrl: 'https://raw.githubusercontent.com/pjmagee/streamer-alerts-xplat/main/images/icon.ico', // URL to ICO file for Control Panel
      setupIcon: './images/icon.ico' // ICO file for Setup.exe
    }), 
    new MakerZIP({}, ['darwin']), 
    new MakerRpm({}), 
    new MakerDeb({
      options: {
        icon: './images/icon.png' // PNG file for Debian package
      }
    })
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'pjmagee',
        name: 'streamer-alerts-xplat'
      },
      prerelease: false,
      draft: true,
      generateReleaseNotes: true,
      authToken: process.env.GH_TOKEN
    })
  ]
};

export default config;
