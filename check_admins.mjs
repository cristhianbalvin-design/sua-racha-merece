import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tmkhmndwmaxzozluqkme.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkUsers() {
  const { data, error } = await supabaseAdmin.from('users').select('email, role, name, user_status');
  
  if (error) {
    console.error('Error al consultar usuarios:', error.message);
    return;
  }

  const admins = data.filter(u => u.role === 'ADMIN');
  console.log('\n=== ADMINISTRADORES ===');
  console.table(admins);

  const regularUsers = data.filter(u => u.role !== 'ADMIN');
  console.log('\n=== USUARIOS REGULARES (Max 5) ===');
  if(regularUsers.length > 0) {
      console.table(regularUsers.slice(0, 5));
      if (regularUsers.length > 5) {
          console.log(`... y ${regularUsers.length - 5} usuarios más.`);
      }
  }
}

checkUsers().catch(console.error);
