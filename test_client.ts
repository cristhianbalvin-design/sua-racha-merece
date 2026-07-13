import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function test() {
  console.log("URL:", SUPABASE_URL);
  console.log("Key length:", SUPABASE_SERVICE_ROLE_KEY.length);
  
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { data, error } = await supabaseAdmin.from('campaigns').insert({ name: 'Test', status: 'ACTIVE' }).select().single();
  console.log("Data:", data);
  console.log("Error:", error);
}

test().catch(console.error);
