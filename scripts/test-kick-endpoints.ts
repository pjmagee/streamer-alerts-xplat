import axios from 'axios';

async function testKickEndpoints(): Promise<void> {
  try {
    console.log('🧪 Testing various Kick API endpoints...');
    
    const testChannel = 'xqc'; // Popular Kick streamer
    
    // Test 1: Try the old public API (no auth)
    console.log('\n1️⃣ Testing old public endpoint (no auth)...');
    try {
      const response1 = await axios.get(`https://kick.com/api/v1/channels/${testChannel}`);
      console.log('✅ Old public API works:', response1.data?.livestream?.is_live);
    } catch (error: any) {
      console.log('❌ Old public API failed:', error.response?.status, error.message);
    }
    
    // Test 2: Try the new public API without auth
    console.log('\n2️⃣ Testing new public API without auth...');
    try {
      const response2 = await axios.get('https://api.kick.com/public/v1/channels', {
        params: { slug: testChannel },
        headers: { 'Accept': 'application/json' }
      });
      console.log('✅ New public API without auth works:', response2.data);
    } catch (error: any) {
      console.log('❌ New public API without auth failed:', error.response?.status, error.message);
      console.log('Response:', error.response?.data);
    }
    
    // Test 3: Try alternative endpoint structure
    console.log('\n3️⃣ Testing alternative endpoint...');
    try {
      const response3 = await axios.get(`https://api.kick.com/public/v1/channels/${testChannel}`);
      console.log('✅ Alternative endpoint works:', response3.data);
    } catch (error: any) {
      console.log('❌ Alternative endpoint failed:', error.response?.status, error.message);
    }
    
    // Test 4: Try the livestreams endpoint
    console.log('\n4️⃣ Testing livestreams endpoint...');
    try {
      const response4 = await axios.get('https://api.kick.com/public/v1/livestreams', {
        headers: { 'Accept': 'application/json' }
      });
      console.log('✅ Livestreams endpoint works:', response4.data);
    } catch (error: any) {
      console.log('❌ Livestreams endpoint failed:', error.response?.status, error.message);
      console.log('Response:', error.response?.data);
    }
    
  } catch (error) {
    console.error('🚨 Error:', (error as Error).message);
  }
}

testKickEndpoints();
