// Test notification script to verify app name in notifications
import { app, Notification } from 'electron';
import * as path from 'path';

// Set the app name (same as in main.ts)
app.setName('Streamer Alerts');

// On Windows, set the App User Model ID to match the app name for proper notifications
if (process.platform === 'win32') {
    app.setAppUserModelId(app.getName());
}

app.whenReady().then(() => {
  console.log('App ready, sending test notification...');
  
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon-32.png');
  
  const notification = new Notification({
    title: '🔴 Test Notification',
    body: 'This is a test notification to verify the app name appears correctly.',
    icon: iconPath,
    silent: false
  });

  notification.show();
  
  console.log('Test notification sent! Check the notification popup.');
  
  // Close app after 5 seconds
  setTimeout(() => {
    console.log('Closing test app...');
    app.quit();
  }, 5000);
});

app.on('window-all-closed', () => {
  // Allow the app to quit after test
});
