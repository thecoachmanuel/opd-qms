-- V2: Safe User Creation Function
-- This version (v2) replaces the old function to ensure you are using the correct code.

-- 1. Enable pgcrypto (required for passwords)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create the V2 function
CREATE OR REPLACE FUNCTION create_user_v2(
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
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_uid UUID;
  caller_role TEXT;
  v_instance_id UUID;
BEGIN
  -- 1. Security Check
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only admins can create users.';
  END IF;

  -- 2. Instance ID Resolution (Critical Fix)
  SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
  
  -- Fallback logic
  IF v_instance_id IS NULL THEN
      SELECT instance_id INTO v_instance_id FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1;
  END IF;
  IF v_instance_id IS NULL THEN
      v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  new_uid := gen_random_uuid();

  -- 3. Create User (Auto-confirmed)
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
    now(), -- Auto-confirm immediately
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', username, 'full_name', full_name, 'role', role, 'clinic_id', clinic_id),
    now(),
    now()
  );

  -- 4. Create Profile
  INSERT INTO public.profiles (
    id, username, full_name, role, clinic_id, email, phone, approved
  ) VALUES (
    new_uid, username, full_name, role, clinic_id, email, phone, true
  );

  RETURN jsonb_build_object('id', new_uid, 'email', email);
END;
$$;

-- 3. Fix 'manuel@manuel.com' specifically (if it exists)
DO $$
DECLARE
    v_user_id UUID;
    v_correct_id UUID;
BEGIN
    -- Get ID of manuel@manuel.com
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'manuel@manuel.com';
    
    -- Get a valid instance_id
    SELECT instance_id INTO v_correct_id FROM auth.users WHERE instance_id <> '00000000-0000-0000-0000-000000000000' LIMIT 1;
    
    -- Update if found
    IF v_user_id IS NOT NULL AND v_correct_id IS NOT NULL THEN
        UPDATE auth.users SET instance_id = v_correct_id WHERE id = v_user_id;
        RAISE NOTICE 'Fixed manuel@manuel.com';
    END IF;
END $$;
