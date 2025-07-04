import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { PublisherGithub } from '@electron-forge/publisher-github';


const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './images/icon',
    executableName: 'streamer-alerts-xplat',
    appCopyright: 'Patrick Magee'
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      authors: 'Patrick Magee',
      iconUrl: 'https://raw.githubusercontent.com/pjmagee/streamer-alerts-xplat/main/images/icon.ico',
      setupIcon: './images/icon.ico'
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({
      options: {
        icon: './images/icon.png'
      }
    }),
    new MakerDeb({
      options: {
        icon: './images/icon.png'
      }
    })
  ],
  plugins: [
    new AutoUnpackNativesPlugin({
      // Ensure Puppeteer browsers are properly unpacked
      patterns: [
        'puppeteer/**/*',
      ]
    }),
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
      draft: false, // Must be false for auto-updates to work
      generateReleaseNotes: true,
      authToken: process.env.GH_TOKEN
    })
  ]
};

export default config;
