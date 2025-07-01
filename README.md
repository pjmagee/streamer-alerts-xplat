# Streamer Alerts XPlat

A desktop application for notifications when channels go live on YouTube, Twitch and Kick

## Technology

- [Electron](https://www.electronjs.org/)
- [Electron Forge](https://www.electronforge.io/)
- [Vite](https://vitejs.dev/)
- [Playwright](https://playwright.dev/)
- [TypeScript](https://www.typescriptlang.org/)

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
