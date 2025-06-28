import Store from 'electron-store';
import axios from 'axios';

interface ApiCredentials {
  kick: {
    isLoggedIn: boolean;
    accessToken?: string;
    [key: string]: any;
  };
  [platform: string]: any;
}

async function testKickAPI(): Promise<void> {
  try {
    console.log('🧪 Testing Kick API...');
    
    // Load config
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
    console.log('📋 Kick login status:', credentials.kick.isLoggedIn);
    
    if (!credentials.kick.isLoggedIn || !credentials.kick.accessToken) {
      console.log('❌ No Kick token found. Please authenticate first.');
      return;
    }
    
    console.log('🔑 Testing with token:', credentials.kick.accessToken.substring(0, 10) + '...');
    
    // Test 1: Token introspection
    console.log('\n1️⃣ Testing token introspection...');
    try {
      const introspectResponse = await axios.post('https://api.kick.com/public/v1/token/introspect', {}, {
        headers: {
          'Authorization': `Bearer ${credentials.kick.accessToken.trim()}`,
          'Accept': 'application/json'
        }
      });
      console.log('✅ Token introspection successful:', introspectResponse.data);
    } catch (error: any) {
      console.log('❌ Token introspection failed:', error.response?.status, error.response?.statusText);
      console.log('Response data:', error.response?.data);
    }
    
    // Test 2: Get user info
    console.log('\n2️⃣ Testing user info...');
    try {
      const userResponse = await axios.get('https://api.kick.com/public/v1/users', {
        headers: {
          'Authorization': `Bearer ${credentials.kick.accessToken.trim()}`,
          'Accept': 'application/json'
        }
      });
      console.log('✅ User info successful:', userResponse.data);
    } catch (error: any) {
      console.log('❌ User info failed:', error.response?.status, error.response?.statusText);
      console.log('Response data:', error.response?.data);
    }
    
    // Test 3: Get channels (without slug - should return current user's info)
    console.log('\n3️⃣ Testing channels endpoint (current user)...');
    try {
      const channelsResponse = await axios.get('https://api.kick.com/public/v1/channels', {
        headers: {
          'Authorization': `Bearer ${credentials.kick.accessToken.trim()}`,
          'Accept': 'application/json'
        }
      });
      console.log('✅ Channels successful:', channelsResponse.data);
    } catch (error: any) {
      console.log('❌ Channels failed:', error.response?.status, error.response?.statusText);
      console.log('Response data:', error.response?.data);
    }
    
  } catch (error) {
    console.error('🚨 Error:', (error as Error).message);
  }
}

testKickAPI();
