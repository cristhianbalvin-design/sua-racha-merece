import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tmkhmndwmaxozluqkme.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function create() {
  const email = `test_admin_${Date.now()}@example.com`;
  const password = 'securepassword123';
  
  await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  const { data } = await supabaseAdmin.from('users').upsert({ id: 'dummy', email }, { onConflict: 'email' }).select().single();
  const userId = data?.id;
  if(userId) {
     await supabaseAdmin.from('users').update({ role: 'ADMIN' }).eq('id', userId);
  }

  // Create campaign
  await supabaseAdmin.from('campaigns').insert({
    title: 'Campanha Teste E2E',
    status: 'ACTIVE'
  });

  console.log(`\n✅ Test Admin Created:\nEmail: ${email}\nPassword: ${password}\n`);
}

create().catch(console.error);
