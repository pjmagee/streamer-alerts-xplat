import test from 'node:test';
import assert from 'node:assert';
import Store from 'electron-store';

interface ApiCredentials {
  kick: {
    isLoggedIn: boolean;
    accessToken?: string;
    [key: string]: any;
  };
  [platform: string]: any;
}

test('Kick API token introspection', async () => {
  const store = new Store({ 
    name: 'config',
    defaults: {
      streamers: [],
      apiCredentials: {
        twitch: { isLoggedIn: false },
        youtube: { isLoggedIn: false },
        kick: { isLoggedIn: false }
      }
    }
  });
  
  const credentials = store.get('apiCredentials') as ApiCredentials;
  
  if (!credentials.kick.isLoggedIn || !credentials.kick.accessToken) {
    console.log('⚠️ Skipping Kick API test - no token found');
    return;
  }
  
  try {
    const introspectResponse = await fetch('https://api.kick.com/public/v1/token/introspect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.kick.accessToken.trim()}`,
        'Accept': 'application/json'
      }
    });
    
    if (introspectResponse.ok) {
      const data = await introspectResponse.json();
      assert.ok(data, 'Token introspection should return data');
    } else if (introspectResponse.status === 401) {
      console.log('⚠️ Token is invalid or expired');
    } else {
      throw new Error(`Unexpected response: ${introspectResponse.status}`);
    }
  } catch (error: any) {
    // If we get a 401, that's expected for invalid tokens
    if (error.message?.includes('401')) {
      console.log('⚠️ Token is invalid or expired');
    } else {
      throw error;
    }
  }
});

test('Kick API user info', async () => {
  const store = new Store({ 
    name: 'config',
    defaults: {
      streamers: [],
      apiCredentials: {
        twitch: { isLoggedIn: false },
        youtube: { isLoggedIn: false },
        kick: { isLoggedIn: false }
      }
    }
  });
  
  const credentials = store.get('apiCredentials') as ApiCredentials;
  
  if (!credentials.kick.isLoggedIn || !credentials.kick.accessToken) {
    console.log('⚠️ Skipping Kick API test - no token found');
    return;
  }
  
  try {
    const userResponse = await fetch('https://api.kick.com/public/v1/users', {
      headers: {
        'Authorization': `Bearer ${credentials.kick.accessToken.trim()}`,
        'Accept': 'application/json'
      }
    });
    
    if (userResponse.ok) {
      const data = await userResponse.json();
      assert.ok(data, 'User info should return data');
    } else if (userResponse.status === 401) {
      console.log('⚠️ Token is invalid or expired');
    } else {
      throw new Error(`Unexpected response: ${userResponse.status}`);
    }
  } catch (error: any) {
    // If we get a 401, that's expected for invalid tokens
    if (error.message?.includes('401')) {
      console.log('⚠️ Token is invalid or expired');
    } else {
      throw error;
    }
  }
});
