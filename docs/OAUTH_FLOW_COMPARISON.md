# OAuth Flow Comparison: Implicit vs Device Code Grant

## Implicit Grant Flow (Deprecated)
```
1. App opens browser to: https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=...
2. User authorizes
3. Browser redirects to: http://localhost:3000/#access_token=VULNERABLE_TOKEN
4. App extracts token from URL fragment
```

### Problems:
- ❌ Token exposed in URL (browser history, logs, referrers)
- ❌ Vulnerable to XSS attacks
- ❌ No refresh tokens
- ❌ Deprecated in OAuth 2.1
- ❌ Anyone with client_id can impersonate app

## Device Code Grant Flow (Current)
```
1. App requests device code from Twitch
2. Twitch returns: device_code + user_code + verification_uri
3. App shows user_code and opens browser to verification_uri
4. User enters code on Twitch's website
5. App polls token endpoint with device_code
6. Receives secure tokens with refresh capability
```

### Benefits:
- ✅ No tokens in URLs
- ✅ No browser vulnerabilities
- ✅ Refresh tokens supported
- ✅ OAuth 2.1 compliant
- ✅ Resistant to impersonation
- ✅ Works on any device

## Why We Use Device Code Grant for Twitch

1. **Security**: No token exposure in URLs or browser history
2. **Refresh Tokens**: Long-term access without re-authentication
3. **OAuth 2.1 Compliance**: Future-proof implementation
4. **Desktop App Optimal**: Designed for public clients
5. **User Experience**: Simple code-based verification

## Platform Comparison

| Platform | Flow | Security | Refresh Tokens |
|----------|------|----------|----------------|
| Twitch   | Device Code Grant | ✅ Excellent | ✅ Yes |
| YouTube  | Auth Code + PKCE | ✅ Excellent | ✅ Yes |
| Kick     | Auth Code + PKCE + Secret* | ⚠️ Compromised | ✅ Yes |

*Kick requires client_secret despite PKCE, which is non-standard
