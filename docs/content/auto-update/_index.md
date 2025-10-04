---
title: "Auto Update Guide"
description: "Configuration and troubleshooting for automatic updates via GitHub Releases."
---

{{< lead >}}This application uses `update-electron-app` and GitHub Releases for automatic updates.{{< /lead >}}

## Overview

The app checks for updates on startup and then hourly. Only published, non-prerelease, semver tags are considered.

## Release Process

1. Bump version: `npm run version:patch` (or minor/major) – creates tag & commit.
2. Push tags: `git push origin --tags`.
3. GitHub Actions builds & publishes release assets.
4. Ensure the release is marked Published (not draft) for clients to pick it up.

## Testing Updates

Auto-update only functions in packaged builds (`app.isPackaged === true`). During development you can still manually verify release metadata via network inspection tools.

## Required Assets

- Windows: `.exe`, `.nupkg`
- macOS: `.zip`
- Linux: `.deb`, `.rpm`

## Troubleshooting

- Confirm release is published
- Validate repository URL in `package.json`
- Ensure `GITHUB_TOKEN` / `GH_TOKEN` has permissions when testing locally

---
Originally migrated from legacy `docs/AUTO_UPDATE.md`.
