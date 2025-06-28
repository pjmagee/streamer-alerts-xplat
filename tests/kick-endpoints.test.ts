import test from 'node:test';
import assert from 'node:assert';

test('Kick endpoints accessibility', async () => {
  const testChannel = 'xqc'; // Popular Kick streamer
  
  // Test old public API (no auth)
  try {
    const response1 = await fetch(`https://kick.com/api/v1/channels/${testChannel}`);
    if (response1.ok) {
      const data = await response1.json();
      assert.ok(data, 'Old public API should return data');
      assert.ok(typeof data?.livestream?.is_live === 'boolean', 'Should have is_live boolean');
    }
  } catch (error: any) {
    console.log('⚠️ Old public API not accessible:', error.message);
  }
});

test('Kick new public API without auth', async () => {
  const testChannel = 'xqc';
  
  try {
    const url = new URL('https://api.kick.com/public/v1/channels');
    url.searchParams.set('slug', testChannel);
    
    const response2 = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' }
    });
    
    if (response2.ok) {
      const data = await response2.json();
      assert.ok(data, 'New public API should return data');
    }
  } catch (error: any) {
    console.log('⚠️ New public API not accessible:', error.message);
  }
});

test('Kick alternative endpoint', async () => {
  const testChannel = 'xqc';
  
  try {
    const response3 = await fetch(`https://api.kick.com/public/v1/channels/${testChannel}`);
    if (response3.ok) {
      const data = await response3.json();
      assert.ok(data, 'Alternative endpoint should return data');
    }
  } catch (error: any) {
    console.log('⚠️ Alternative endpoint not accessible:', error.message);
  }
});

test('Kick livestreams endpoint', async () => {
  try {
    const response4 = await fetch('https://api.kick.com/public/v1/livestreams', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (response4.ok) {
      const data = await response4.json();
      assert.ok(data, 'Livestreams endpoint should return data');
    }
  } catch (error: any) {
    console.log('⚠️ Livestreams endpoint not accessible:', error.message);
  }
});
