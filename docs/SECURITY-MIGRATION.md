# Security Migration Guide

## Why This Migration is Necessary

We've updated Streamer Alerts from a **confidential OAuth client** to a **public OAuth client** with PKCE (Proof Key for Code Exchange) for better security.

### The Problem
- **Client secrets in desktop apps are not secure** - they can be extracted by users or attackers
- Storing client secrets in desktop applications violates OAuth 2.1 security best practices
- Previous implementation stored sensitive client secrets in the application code and user data

### The Solution
- **PKCE (Proof Key for Code Exchange)** - Uses dynamically generated codes instead of static secrets
- **Public OAuth clients** - No client secrets stored anywhere
- **Authorization Code Flow with PKCE** - More secure than implicit flow

---

## What Changed

### Before (Insecure):
```json
{
  "apiCredentials": {
    "twitch": {
      "clientId": "abc123",
      "clientSecret": "secret123", // ❌ SECURITY RISK
      "accessToken": "token123",
      "refreshToken": "refresh123"
    }
  }
}
```

### After (Secure):
```json
{
  "apiCredentials": {
    "twitch": {
      "clientId": "abc123",
      // ✅ No client secret stored
      "accessToken": "token123",
      "refreshToken": "refresh123"
    }
  }
}
```

---

## Automatic Migration

The application automatically performs security migration when it starts:

1. **Detects existing client secrets** in user data
2. **Removes all client secrets** from stored credentials
3. **Invalidates all tokens** to force re-authentication with PKCE
4. **Logs migration actions** for transparency

### Migration Log Example:
```
Migration: Removed Twitch client secret for security
Migration: Removed YouTube client secret for security  
Migration: Removed Kick client secret for security
Security migration completed: All client secrets removed from user data
All tokens invalidated - users will need to re-authenticate with secure PKCE flow
```

---

## Manual Data Cleanup

If you want to manually clean your application data:

### Option 1: Using npm script
```bash
# Interactive cleanup (recommended)
npm run cleanup-data

# Automatic cleanup (no prompts)
npm run cleanup-data-force

# Just show data location
node scripts/cleanup-data.js --locate
```

### Option 2: Manual file deletion
Delete the config file at:
- **Windows**: `%APPDATA%\streamer-alerts-xplat\config.json`
- **macOS**: `~/Library/Application Support/streamer-alerts-xplat/config.json`
- **Linux**: `~/.config/streamer-alerts-xplat/config.json`

---

## What Users Need to Do

### After Migration:
1. **Start the application** - Migration happens automatically
2. **Re-authenticate with each platform**:
   - Go to API Configuration
   - Click "Login with Twitch/YouTube/Kick"
   - Complete OAuth flow (now using secure PKCE)
3. **Add your streamer accounts** again if needed

### Benefits After Migration:
- ✅ **More secure** - No client secrets stored anywhere
- ✅ **OAuth 2.1 compliant** - Follows latest security standards
- ✅ **PKCE protection** - Prevents authorization code interception
- ✅ **Future-proof** - Aligned with platform security best practices

---

## Technical Details

### PKCE Flow:
1. App generates random `code_verifier`
2. App creates `code_challenge` from verifier (SHA256 hash)
3. Authorization request includes `code_challenge`
4. Platform returns authorization code
5. Token exchange includes original `code_verifier`
6. Platform verifies the challenge matches the verifier

### Security Benefits:
- **No static secrets** to be compromised
- **Dynamic verification** for each OAuth flow
- **Protection against** authorization code interception attacks
- **Compliance** with OAuth 2.1 security guidelines

---

## Troubleshooting

### If migration fails:
1. Close the application
2. Run manual cleanup: `npm run cleanup-data-force`
3. Restart the application
4. Re-authenticate with all platforms

### If you see authentication errors:
- Check that you're using the latest version
- Clear application data and re-authenticate
- Ensure platforms are properly configured for OAuth

### Emergency reset:
```bash
# Nuclear option - removes all app data
node scripts/cleanup-data.js --locate
# Then manually delete the entire folder shown
```

---

## Verification

To verify the migration worked:
1. Check that no client secrets appear in config files
2. Verify you can successfully authenticate with all platforms  
3. Confirm stream monitoring works after re-authentication

The application logs will show "Security migration completed" on successful migration.
