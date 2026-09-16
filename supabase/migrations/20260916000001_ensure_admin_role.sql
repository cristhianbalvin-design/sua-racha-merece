-- Ensure admin account has role ADMIN in public.users to satisfy RLS policies
UPDATE public.users SET role = 'ADMIN' WHERE email = 'admin@3buk.com';
