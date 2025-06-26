# Kick OAuth Security Compromise

## Issue

Kick's OAuth implementation requires both PKCE (`code_verifier`) **AND** `client_secret` for token exchange, which violates OAuth 2.1 best practices for public clients (desktop applications).

## Security Implications

- **Twitch**: ✅ Fully secure - Device Code Grant Flow (no client secret)
- **YouTube**: ✅ Fully secure - Authorization Code + PKCE (no client secret)  
- **Kick**: ⚠️ Security compromise - Authorization Code + PKCE + client secret (required by API)

## Why This Is Problematic

According to OAuth 2.1 specification:

- Desktop applications are "public clients"
- Public clients cannot securely store client secrets
- PKCE was designed specifically to eliminate the need for client secrets

## Current Implementation

We have included the Kick `client_secret` in our code because:

1. Kick's API documentation requires it for token exchange
2. Their OAuth endpoint returns "Bad Request" without it
3. Users need Kick functionality

## Recommendations

1. **For Kick**: Update OAuth implementation to support pure PKCE flows without client secrets
2. **For Users**: Be aware that the Kick client secret is embedded in the application
3. **For Developers**: Monitor Kick's OAuth documentation for updates to proper PKCE support

## References

- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [Kick OAuth Documentation](https://github.com/KickEngineering/KickDevDocs/blob/main/getting-started/generating-tokens-oauth2-flow.md)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)

## Tracking

This security compromise should be resolved when Kick updates their OAuth implementation to properly support public clients.
