# Release Process

## Creating a New Release

This project uses GitHub Actions to automatically build and publish releases when a new version tag is pushed.

### Steps to Release:

1. **Update Version**
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```

2. **Push the Tag**
   ```bash
   git push origin main --tags
   ```

3. **GitHub Actions will automatically:**
   - Build the application for Windows, macOS, and Linux
   - Create a GitHub release (as draft initially)
   - Upload all platform binaries to the release

4. **Review and Publish**
   - Go to the [Releases page](https://github.com/pjmagee/streamer-alerts-xplat/releases)
   - Review the draft release
   - Edit the release notes if needed
   - Click "Publish release" to make it public

## Release Configuration

The release process is configured in:
- `.github/workflows/build.yml` - Main release workflow
- `forge.config.ts` - Electron Forge configuration with GitHub publisher

### Artifacts Created:

- **Windows**: `.exe` installer (Squirrel)
- **macOS**: `.zip` archive
- **Linux**: `.deb` and `.rpm` packages

## Manual Testing

To test builds locally before releasing:

```bash
# Test build for current platform
npm run make

# Test packaging
npm run package
```

## Troubleshooting

If the GitHub Action fails:
1. Check the build logs in the Actions tab
2. Common issues:
   - Missing `GITHUB_TOKEN` (should be automatic)
   - Platform-specific build dependencies
   - Code signing issues (optional for open source)

## Code Signing (Optional)

For production releases, you may want to add code signing:
- Windows: Add `WINDOWS_CERTIFICATE` and `WINDOWS_CERTIFICATE_PASSWORD` secrets
- macOS: Add `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` secrets
