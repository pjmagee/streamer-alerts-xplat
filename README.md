# Streamer Alerts - Cross Platform

A cross-platform application for Windows, Linux, and macOS that provides live notifications when your favorite streamers go live on Twitch, YouTube, and Kick.

## Features

- 🔴 **Live Notifications**: Get desktop notifications when streamers go live
- 🖥️ **System Tray**: Runs quietly in the system tray
- ⚙️ **Easy Configuration**: Simple UI to manage your streamer accounts
- 🎮 **Multi-Platform Support**: Twitch, YouTube, and Kick
- 🌍 **Cross-Platform**: Works on Windows, macOS, and Linux
- 📱 **Clickable Notifications**: Click to open stream in browser

## Screenshots

The app features a modern, clean interface with:

- Settings panel for notification preferences
- Streamer account management
- Real-time status indicators
- Toggle switches to enable/disable individual streamers

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

### Setup

1. **Clone or download** this project
2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Ready to Go**:
   - **🟣 Twitch**: OAuth login
   - **🟢 Kick**: OAuth login
   - **🔴 YouTube**: OAuth login

4. **Build the application**:

   ```bash
   npm run build
   ```

5. **Run the application**:

   ```bash
   npm start
   ```

## Development

To run in development mode with hot reload:

```bash
npm run dev
```

## Building for Distribution

To create distributable packages:

```bash
# Build for current platform
npm run dist

# Build for all platforms (requires additional setup)
npm run pack
```

This will create installation packages in the `release/` directory.

## Usage

### Adding Streamers

1. Click the tray icon to open the configuration window
2. Click "Add Account"
3. Select the platform (Twitch, YouTube, or Kick)
4. Enter the username/channel ID
5. Optionally set a custom display name
6. Click "Add Account"

### Managing Notifications

- **Enable/Disable All**: Use the checkbox in the settings section
- **Individual Control**: Use the toggle switches next to each streamer
- **Check Interval**: Adjust how often the app checks for live streams (1-60 minutes)

### System Tray

- **Left Click**: Open configuration window
- **Right Click**: Show context menu with options to disable notifications or exit

## Configuration

The app stores its configuration in your system's user data directory:

- **Windows**: `%APPDATA%/streamer-alerts-xplat/`
- **macOS**: `~/Library/Application Support/streamer-alerts-xplat/`
- **Linux**: `~/.config/streamer-alerts-xplat/`

## Troubleshooting

### Debug Mode

Run with debug logging:

```bash
npm start -- --dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built with [Electron](https://electronjs.org/)
- Icons from system default sets
- Streaming platform APIs: Twitch, YouTube, Kick

## Roadmap

- [ ] Webhook integration
- [ ] Stream offline notifications
