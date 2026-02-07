-- Enable pgcrypto extension explicitly (required for password hashing)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Update create_user_with_role to use the correct instance_id
CREATE OR REPLACE FUNCTION create_user_with_role(
  email TEXT,
  password TEXT,
  username TEXT,
  full_name TEXT,
  role TEXT,
  clinic_id UUID DEFAULT NULL,
  phone TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_uid UUID;
  caller_role TEXT;
  v_instance_id UUID;
BEGIN
  -- Check if caller is admin
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only admins can create users.';
  END IF;

  -- Get the correct instance_id from the current session/user
  SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
  
  -- Fallback if null (e.g. if run from SQL editor without auth context, though unlikely for this RPC)
  IF v_instance_id IS NULL THEN
      v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  new_uid := gen_random_uuid();

  -- Insert into auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    new_uid,
    v_instance_id,
    'authenticated',
    'authenticated',
    email,
    extensions.crypt(password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', username, 'full_name', full_name, 'role', role, 'clinic_id', clinic_id),
    now(),
    now()
  );

  -- Insert into public.profiles
  INSERT INTO public.profiles (
    id, username, full_name, role, clinic_id, email, phone, approved
  ) VALUES (
    new_uid, username, full_name, role, clinic_id, email, phone, true
  );

  RETURN jsonb_build_object('id', new_uid, 'email', email);
END;
$$;

-- Fix existing users with wrong instance_id (optional, but helpful)
-- This updates users created with the default 0000... ID to match the admin's ID
DO $$
DECLARE
    v_correct_id UUID;
BEGIN
    -- Try to find a "real" instance_id (not the zero one)
    SELECT instance_id INTO v_correct_id 
    FROM auth.users 
    WHERE instance_id <> '00000000-0000-0000-0000-000000000000' 
    LIMIT 1;

    -- If we found one, update the zero ones
    IF v_correct_id IS NOT NULL THEN
        UPDATE auth.users 
        SET instance_id = v_correct_id 
        WHERE instance_id = '00000000-0000-0000-0000-000000000000';
    END IF;
END $$;
