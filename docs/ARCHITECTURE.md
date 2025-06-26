# Data Architecture: Authentication vs. Streamer Monitoring

## The Confusion: What Was Wrong

Previously, the app's data structure mixed two different concepts:

1. **User Authentication Data** - Information about the person using the app who needs API access
2. **Streamer Monitoring Data** - Information about streamers the user wants to monitor

### The Problem

The `apiCredentials.youtube` section incorrectly contained:

```json
{
  "youtube": {
    "accessToken": "token_for_api_calls",
    "channelId": "UCxxxxx",      // ❌ WRONG: This was the authenticated user's channel
    "channelName": "My Channel"  // ❌ WRONG: This was the authenticated user's channel name
  }
}
```

But this app is designed to **monitor OTHER streamers**, not the authenticated user's own channel.

## The Correct Architecture

### 1. Authentication Data (`apiCredentials`)
**Purpose**: Store tokens needed to make API calls  
**Contains**: Only authentication information, no content-specific data

```json
{
  "apiCredentials": {
    "twitch": {
      "clientId": "app_client_id",
      "accessToken": "user_access_token",
      "refreshToken": "refresh_token",
      "isLoggedIn": true,
      "username": "authenticated_user"  // ✅ OK: For display purposes only
    },
    "youtube": {
      "accessToken": "user_access_token",  // ✅ Token to call YouTube API
      "refreshToken": "refresh_token",
      "isLoggedIn": true
      // ✅ NO channelId/channelName - those belong to monitored streamers
    },
    "kick": {
      "accessToken": "user_access_token",
      "isLoggedIn": true,
      "username": "authenticated_user"
    }
  }
}
```

### 2. Streamer Monitoring Data (`accounts`)
**Purpose**: List of streamers to monitor for live status  
**Contains**: Platform-specific identifiers for each streamer

```json
{
  "accounts": [
    {
      "id": "1",
      "username": "some_twitch_streamer",
      "platform": "twitch",
      "platformId": "123456789",  // ✅ Twitch User ID
      "enabled": true
    },
    {
      "id": "2", 
      "username": "@some_youtube_creator",
      "platform": "youtube",
      "platformId": "UCxxxxxxxxxx",  // ✅ YouTube Channel ID
      "enabled": true
    },
    {
      "id": "3",
      "username": "some_kick_streamer", 
      "platform": "kick",
      "enabled": true
    }
  ]
}
```

## Platform-Specific Considerations

### Twitch
- **Username**: Used directly in API calls
- **Platform ID**: User ID (optional, can be resolved from username)

### YouTube  
- **Username**: Display name or @handle 
- **Platform ID**: Channel ID (required - YouTube API needs channel IDs, not usernames)

### Kick
- **Username**: Used directly in API calls
- **Platform ID**: Not typically needed

## Why This Separation Matters

1. **Security**: Authentication data stays separate from content data
2. **Scalability**: Can monitor unlimited streamers without affecting auth
3. **Clarity**: Each data structure has a single, clear purpose
4. **API Efficiency**: Use proper platform identifiers for API calls

## Migration Impact

Users who upgraded from the old structure:
- ✅ Old `channelId`/`channelName` fields removed from credentials
- ✅ All tokens invalidated to force secure re-authentication  
- ✅ Will need to set `platformId` for YouTube streamers they monitor
- ✅ New OAuth flow uses PKCE (no client secrets stored)

## For Developers

When adding new streamers:
- **Twitch/Kick**: Username is sufficient
- **YouTube**: Try to get the Channel ID and set it as `platformId`
  - If only username/handle available, the app will attempt to resolve it
  - For reliability, always set the Channel ID when possible
