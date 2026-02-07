-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Insert admin user into auth.users if not exists
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@admin.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin@admin.com',
      extensions.crypt('password123', extensions.gen_salt('bf')), -- Default password: password123
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"username":"admin","full_name":"Super Admin"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
    
    -- Insert into public.profiles
    INSERT INTO public.profiles (id, username, full_name, role, email, approved)
    VALUES (new_user_id, 'admin', 'Super Admin', 'admin', 'admin@admin.com', true);
  END IF;
END $$;
