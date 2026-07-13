import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import FormData from 'form-data';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tmkhmndwmaxzozluqkme.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in environment");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runE2E() {
  console.log("=== Starting End-to-End Test ===");

  // 1. Create a temporary admin user
  console.log("1. Creating temporary admin user...");
  const email = `test_admin_${Date.now()}@example.com`;
  const password = 'securepassword123';
  
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  if (authError) throw new Error(`Failed to create user: ${authError.message}`);
  const userId = authData.user.id;

  console.log("2. Granting ADMIN role in public.users...");
  await supabaseAdmin.from('users').upsert({ id: userId, email: email, name: 'Test Admin', role: 'ADMIN' });

  // Sign in to get JWT
  console.log("3. Signing in to obtain JWT as Admin...");
  const supabaseAnon = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY);
  const { data: sessionData, error: loginError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password
  });
  if (loginError) throw new Error(`Failed to sign in: ${loginError.message}`);
  const jwt = sessionData.session.access_token;

  console.log("4. Creating a dummy campaign...");
  const { data: campaignData, error: campError } = await supabaseAdmin.from('campaigns').insert({
    name: 'Campanha Teste E2E',
    status: 'Aberto',
    sport: 'Crossfit',
    city: 'Curitiba',
    region: 'Sul',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 86400000).toISOString(),
    winners_count: 1,
    description: 'Test Campaign',
    prize: 'Test Prize'
  }).select().single();
  
  if (campError) throw new Error(`Failed to create campaign: ${campError.message}`);
  const campaignId = campaignData.id;

  // URLs for the deployed edge functions
  const UPLOAD_URL = `${SUPABASE_URL}/functions/v1/upload-event-photo`;
  const MATCH_URL = `${SUPABASE_URL}/functions/v1/match-face`;

  // 5. Upload photo (referencia.jpg)
  console.log("5. Calling upload-event-photo with referencia.jpg...");
  const formUpload = new FormData();
  formUpload.append("file", fs.createReadStream("C:/Users/tideo_design/Downloads/referencia.jpg"));
  formUpload.append("campaign_id", campaignId);

  const resUpload = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      ...formUpload.getHeaders()
    },
    body: formUpload
  });

  const uploadJson = await resUpload.json();
  if (!resUpload.ok) {
    throw new Error(`Upload failed: ${JSON.stringify(uploadJson)}`);
  }
  console.log("   ✅ Upload success. Photo ID:", uploadJson.photo.id);

  // 6. Match face (acción.jpg)
  console.log("6. Calling match-face with acción.jpg...");
  const formMatch = new FormData();
  formMatch.append("file", fs.createReadStream("C:/Users/tideo_design/Downloads/acción.jpg"));

  const resMatch = await fetch(MATCH_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      ...formMatch.getHeaders()
    },
    body: formMatch
  });

  const matchJson = await resMatch.json();
  if (!resMatch.ok) {
    throw new Error(`Match failed: ${JSON.stringify(matchJson)}`);
  }
  console.log("   ✅ Match success! Results:");
  console.log(JSON.stringify(matchJson.matches, null, 2));

  // Verify that our uploaded photo was matched
  const found = matchJson.matches.find((m: any) => m.id === uploadJson.photo.id);
  if (found) {
    console.log(`\n🎉 SUCCESS! Uploaded photo was matched with similarity: ${found.similarity}`);
  } else {
    console.log("\n⚠️ Uploaded photo was NOT in the top matches.");
  }

  console.log("\nCleaning up...");
  await supabaseAdmin.from('event_photos').delete().eq('id', uploadJson.photo.id);
  await supabaseAdmin.from('users').delete().eq('id', userId);
  await supabaseAdmin.auth.admin.deleteUser(userId);
  console.log("Cleanup complete.");
}

runE2E().catch(err => console.error("E2E Test Failed:", err));
