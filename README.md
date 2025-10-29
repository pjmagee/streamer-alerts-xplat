# Streamer Alerts XPlat

A desktop application for notifications when channels go live on YouTube, Twitch and Kick

## Features

- 🔴 **Live Stream Notifications** - Get notified when your favorite streamers go live
- 🌐 **Multi-Platform Support** - Supports Twitch, YouTube, and Kick
- 🤖 **Smart Checking** - Intelligent polling with exponential backoff to reduce unnecessary checks
- 🔐 **OAuth Integration** - Secure authentication with platform APIs
- 🔄 **Auto-Updates** - Automatic updates via GitHub releases
- ⚙️ **Flexible Configuration** - Choose between API or scraping strategies per platform

## Technology

- [Electron](https://www.electronjs.org/)
- [Electron Forge](https://www.electronforge.io/)
- [Vite](https://vitejs.dev/)
- [Puppeteer](https://pptr.dev/)
- [TypeScript](https://www.typescriptlang.org/)

## Auto-Updates

## Documentation Site (Hugo + GitHub Pages)

Documentation is generated with **Hugo** using the `hugo-scroll` theme and deployed from the `docs/` folder to GitHub Pages with a custom domain.

Public site:

```text
https://sax.magaoidh.pro/
```

Source structure:

- Hugo config: `docs/config.toml`
- Landing page: `docs/content/_index.md`
- Auto update guide: `docs/content/auto-update/_index.md`
- Custom domain: `docs/CNAME`

To run docs locally:

```bash
cd docs
hugo server -D
```

Then visit <http://localhost:1313/> while editing content.

This application supports automatic updates using GitHub releases:

- Updates are checked every hour when the app is running in production
- When an update is available, you'll be notified and can choose to install it
- Updates are downloaded in the background and applied after restart
- Only published (non-draft, non-prerelease) releases trigger updates

### For Developers

To publish a new version:

1. Update the version: `npm run version:patch` (or `version:minor`/`version:major`)
   - This automatically creates a git tag and commits the version change
2. Push the tag to GitHub: `git push origin --tags`
3. GitHub Actions will automatically build and publish the release for all platforms
4. Make sure the release is published (not draft) for auto-updates to work


## Kick Authorization

- Getting Started: <https://docs.kick.com/getting-started/kick-apps-setup>
- OAuth2 Flow: <https://docs.kick.com/getting-started/generating-tokens-oauth2-flow>
- Channel Live API: <https://docs.kick.com/apis/channels?slug={user_name}>
- The OAuth server is <https://id.kick.com>

## Twitch Authorization

- Getting Started: <https://dev.twitch.tv/docs/authentication/register-app/>
- OAuth2 Implicit Grant flow: <https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#implicit-grant-flow>
- Channel Live API: <https://api.twitch.tv/helix/streams?user_login={username}&type=live>
- The OAuth server is <https://id.twitch.tv>

## YouTube Authorization

- Getting Started: <https://developers.google.com/youtube/registering_an_application>
- OAuth2 for Desktop Apps: <https://developers.google.com/youtube/registering_an_application>
- Channel Live API: <https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video>
