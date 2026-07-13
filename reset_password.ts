import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tmkhmndwmaxzozluqkme.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function resetPassword() {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Find the user by email
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;
  
  const user = data.users.find(u => u.email === 'cristhianbalvin@gmail.com');
  if (!user) throw new Error('User not found');
  
  // Update their password
  const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { password: 'Password123!' }
  );
  
  if (updateError) throw updateError;
  console.log('Password successfully reset for:', user.email);
}

resetPassword().catch(console.error);
