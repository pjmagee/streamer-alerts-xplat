# API Setup Guide

## Overview

Your Streamer Alerts app includes **embedded credentials** for Twitch and Kick, making it ready to use immediately! Only YouTube requires optional authentication.

## Quick Start

1. **Launch the app** - Click the tray icon to open settings
2. **Add Twitch/Kick streamers** - No login required! Just add their usernames
3. **YouTube (Optional)**: Click "Login with YouTube" if you want to monitor YouTube streamers
4. **Done!** - The app will start checking for live streams

## Platform-Specific Details

### 🟣 Twitch (No Login Required!)

- ✅ **Works automatically** with embedded client ID
- ✅ **Public stream data** access for monitoring
- ✅ **Official Twitch API** with proper rate limits
- � **Just add streamers** - no authentication needed

### � Kick (No Login Required!)

- ✅ **Uses public Kick API** endpoints
- ✅ **Works automatically** - no authentication needed  
- ✅ **Reliable stream status** checking
- 🚀 **Just add streamers** and monitor instantly

### 🔴 YouTube (Optional Login)

**How it works**: Click "Login with YouTube" if you want to monitor YouTube streamers.

- ✅ **One-click login** - no developer account needed  
- ✅ **Secure OAuth** - your password is never stored
- ✅ **Automatic token refresh** - stays logged in
- 🔄 **Just like any other app** - same login flow as mobile apps

**Steps**:

1. Click "Login with YouTube" in the app
2. Browser window opens to Google login
3. Enter your regular Google/YouTube credentials
4. Click "Allow" to give the app permission
5. Done! The app can now check YouTube streamers

## Rate Limits & Quotas

- **Twitch**: 800 requests per minute per client ID (uses user OAuth access tokens)
- **YouTube**: 10,000 requests per day (default quota with OAuth)
- **Kick**: Proper rate limits with official OAuth API

With OAuth login, rate limits are managed automatically and you don't need to worry about quotas!

## Usage Tips

### Getting Started Easily

1. **Twitch**: Login with Twitch and add streamers
2. **Kick**: Login with Kick and add Kick streamers
3. **YouTube**: Login with YouTube and add YouTube streamers
4. **Configure Notification Settings**: Adjust check interval and enable notifications

### Testing Your Setup

1. Login to your preferred platforms
2. Add a streamer you know is currently live
3. Wait for the next check cycle (2 minutes by default)
4. You should get a notification if they're live

### Usernames vs Channel IDs

**Twitch**: Use the streamer's username (e.g., "asmongold")
**YouTube**: Use the Channel ID (not the @username)

- Find it at: `youtube.com/channel/CHANNEL_ID_HERE`
- Or use online tools to convert @username to Channel ID

**Kick**: Use the streamer's username (e.g., "xqc")

## Troubleshooting

### No notifications?

1. Check your OS notification settings
2. Verify the app has notification permissions
3. Make sure notifications are enabled in app settings

### Streamers not detected?

- **Kick**: Ensure you're logged in with OAuth (check Kick status in settings)
- **Twitch**: Login required - check OAuth status in API Configuration
- **YouTube**: Make sure you're logged in with OAuth
- Verify usernames/channel IDs are correctly formatted
- Ensure internet connection is stable

### Login issues?

1. Make sure you allow the app permission when logging in
2. Check your internet connection
3. Try logging out and back in
4. Close any browser windows and try again

## Security & Privacy

- **OAuth tokens** are stored locally on your computer
- **Your passwords** are never stored by the app
- **Login happens** through official platform login pages
- **You can revoke access** anytime from your platform account settings

## Need Help?

1. Try **Kick streamers first** (no login required)
2. Make sure you're **logged in** to all platforms (check for green status in API Configuration)
3. Verify **usernames/channel IDs** are correct format
4. Check the **console** (F12) for error messages
