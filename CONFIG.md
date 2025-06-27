# Configuration Setup

This project uses JSON-based configuration files instead of environment variables.

## Development Setup

1. Copy the example config file:

   ```bash
   copy config.local.example.json config.local.json
   ```

2. Edit `config.local.json` with your actual API credentials:

   ```json
   {
     "TWITCH_CLIENT_ID": "your_actual_twitch_client_id",
     "YOUTUBE_CLIENT_ID": "your_actual_youtube_client_id", 
     "KICK_CLIENT_ID": "your_actual_kick_client_id",
     "KICK_CLIENT_SECRET": "your_actual_kick_client_secret"
   }
   ```

3. Build and run:

   ```bash
   npm run build
   npm start
   ```

## Production Build

For production builds, the `build-config.js` script will prompt you for credentials and create a `src/config.prod.json` file that gets compiled into the app.

```bash
npm run build:prod  # Will prompt for credentials
npm run pack        # Package the app
```

## Security Notes

- `config.local.json` is git-ignored and contains your dev credentials
- `src/config.prod.json` is git-ignored and generated at build time
- No secrets are stored in source code
- Production builds have credentials compiled in (standard for desktop apps)
