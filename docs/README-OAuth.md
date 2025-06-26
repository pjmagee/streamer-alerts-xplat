# Streamer Alerts - OAuth Setup Guide

This application now requires OAuth authentication for all three supported platforms (Twitch, YouTube, and Kick). No fallback methods or public-only API access is available.

## OAuth Configuration

All OAuth credentials are embedded in the application for immediate functionality. The callback URL `https://localhost:8443/callback` is registered for all OAuth applications.

### Platform Requirements

#### Twitch
- **Client ID**: Embedded in application
- **Client Secret**: Embedded in application  
- **Scopes**: `user:read:email`
- **API Endpoint**: `https://api.twitch.tv/helix/streams?user_login={username}&type=live`

#### YouTube
- **Client ID**: Embedded in application
- **Client Secret**: Embedded in application
- **Scopes**: `https://www.googleapis.com/auth/youtube.readonly`
- **API Endpoint**: YouTube Data API v3 live stream search

#### Kick
- **Client ID**: Embedded in application
- **Client Secret**: Embedded in application
- **Scopes**: `user:read`
- **API Endpoint**: `https://kick.com/api/v2/channels/{username}`

## Authentication Flow

1. **User clicks "Login" button** for any platform in the API Configuration section
2. **Browser opens** with OAuth authorization URL
3. **User grants permissions** on the platform's website
4. **Callback received** at `https://localhost:8443/callback`
5. **Access token obtained** and stored securely
6. **Refresh token stored** for automatic token renewal

## Token Management

- **Access tokens** are automatically refreshed when they expire
- **User must re-authenticate** if refresh fails
- **Secure storage** via electron-store
- **No manual token entry** required

## Security Features

- HTTPS callback server with self-signed certificate
- State parameter validation for CSRF protection
- Automatic token refresh
- Secure token storage

## Usage

1. Launch the application
2. Go to "API Configuration" section
3. Click "Login with [Platform]" for each platform you want to monitor
4. Grant permissions in the browser
5. Add streamer accounts to monitor
6. Enjoy real-time stream notifications!

## Troubleshooting

- **Login window closes immediately**: Check that the callback URL is properly registered
- **Authentication fails**: Verify OAuth app credentials and scopes
- **Stream checks fail**: Ensure you're logged in to the respective platform
- **Tokens expire**: Re-authenticate when prompted

All stream monitoring now requires user login - no public-only access is available.
