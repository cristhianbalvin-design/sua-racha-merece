import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tmkhmndwmaxzozluqkme.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMatchFace() {
  console.log('Logging in as a test user or admin...');
  // Since we don't know the exact password, let's use the service role key to generate a token,
  // or just use the service role key as the authorization header? No, match-face uses auth.getUser().
  // Let's create a temporary user, get the token, test the edge function, and delete the user.
  const tempEmail = `test_match_${Date.now()}@example.com`;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: tempEmail,
    password: 'password123',
  });
  
  if (authError || !authData.session) {
    console.error('Failed to sign up temp user:', authError);
    return;
  }
  
  const token = authData.session.access_token;
  console.log('Got token. Calling match-face edge function...');

  const formData = new FormData();
  const fileBuffer = fs.readFileSync('face-recognition-service/test_insightface.py');
  formData.append('file', new Blob([fileBuffer]), 'test.jpg');

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/match-face`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testMatchFace();
