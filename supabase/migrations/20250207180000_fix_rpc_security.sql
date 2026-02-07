-- Improved fix for auth RPC with correct search_path and instance_id handling

-- 1. Enable pgcrypto if not exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop the old function to ensure clean slate (optional but good practice)
DROP FUNCTION IF EXISTS create_user_with_role(text, text, text, text, text, uuid, text);

-- 3. Create the robust function
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
SET search_path = public, auth, extensions
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
  -- We prioritize the admin's instance_id
  SELECT instance_id INTO v_instance_id FROM auth.users WHERE id = auth.uid();
  
  -- Fallback: If for some reason auth.uid() is null (shouldn't be), try to find ANY valid instance_id
  IF v_instance_id IS NULL THEN
      SELECT instance_id INTO v_instance_id FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1;
  END IF;

  -- Final Fallback: Use the zero UUID (only for local/self-hosted if no other option)
  IF v_instance_id IS NULL THEN
      v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  new_uid := gen_random_uuid();

  -- Insert into auth.users
  -- Explicitly setting email_confirmed_at to now() to skip confirmation
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
    now(), -- Auto-confirm email
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

-- 4. Fix existing corrupted users (specifically manuel@manuel.com if it exists)
DO $$
DECLARE
    v_correct_id UUID;
    v_bad_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Find a valid instance_id from the admin or any other valid user
    SELECT instance_id INTO v_correct_id 
    FROM auth.users 
    WHERE instance_id <> v_bad_id 
    LIMIT 1;

    -- Update users with the bad instance_id
    IF v_correct_id IS NOT NULL THEN
        UPDATE auth.users 
        SET instance_id = v_correct_id 
        WHERE instance_id = v_bad_id;
        
        RAISE NOTICE 'Fixed users with bad instance_id';
    END IF;
END $$;
