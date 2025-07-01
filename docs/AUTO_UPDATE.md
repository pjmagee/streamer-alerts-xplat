# Auto-Update Configuration

## Overview

This app uses the `update-electron-app` package with GitHub releases for automatic updates.

## Configuration

- **Update Interval**: 1 hour (configurable)
- **Update Service**: GitHub releases via update.electronjs.org
- **Release Requirements**: Must be published (not draft), not pre-release, with valid semver tags

## Development Setup

### Environment Variables

GitHub Actions automatically handles authentication using `GITHUB_TOKEN`:

- No manual token setup required for releases
- GitHub Actions uses built-in `GITHUB_TOKEN` with proper permissions
- For local testing only: you can set `GH_TOKEN` environment variable

### Release Process

1. Update version: `npm run version:patch` (or `version:minor`/`version:major`)
   - This automatically creates a git tag and commits the version change
2. Push the tag: `git push origin --tags`
3. GitHub Actions automatically builds and publishes the release for all platforms
4. Ensure the release is published (not draft) for auto-updates to work

### Testing Auto-Updates

- Auto-updates only work in packaged apps (not in development)
- The app checks for updates when it starts and then every hour
- Updates are applied after the user confirms and restarts the app

## Technical Details

### Required Assets

The app builds the following assets for auto-updates:

- **Windows**: `.exe` and `.nupkg` files (via electron-squirrel-startup)
- **macOS**: `.zip` file (code signing required for auto-updates)
- **Linux**: `.deb` and `.rpm` files

### Update Flow

1. App starts → checks for updates
2. If update found → downloads in background
3. User gets notification → can choose to update now or later
4. Update applied on restart

### Troubleshooting

- Ensure releases are published (not draft)
- Verify repository URL in package.json
- Check that GH_TOKEN has proper permissions
- Auto-updates only work in production builds (`app.isPackaged === true`)
