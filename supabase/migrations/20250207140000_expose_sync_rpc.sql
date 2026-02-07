-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  meta jsonb;
  v_username text;
  v_full_name text;
  v_role text;
  v_clinic_id uuid;
BEGIN
  -- Get metadata from the new user
  meta := NEW.raw_user_meta_data;

  -- Extract values or set defaults
  v_username := COALESCE(meta->>'username', SPLIT_PART(NEW.email, '@', 1));
  v_full_name := COALESCE(meta->>'full_name', v_username);
  v_role := COALESCE(meta->>'role', 'staff'); -- Default to staff if not specified
  
  -- Handle Clinic ID (safe cast)
  BEGIN
    v_clinic_id := (meta->>'clinic_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_clinic_id := NULL;
  END;

  -- Insert into public.profiles
  -- ON CONFLICT: Do nothing (or update) to avoid race conditions with manual inserts
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    role,
    clinic_id,
    email,
    approved
  ) VALUES (
    NEW.id,
    v_username,
    v_full_name,
    v_role,
    v_clinic_id,
    NEW.email,
    true -- Auto-approve users created directly in Auth
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    role = COALESCE(public.profiles.role, EXCLUDED.role);

  RETURN NEW;
END;
$$;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Update create_user_with_role to be conflict-safe
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
BEGIN
  -- Check if caller is admin
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only admins can create users.';
  END IF;

  new_uid := gen_random_uuid();

  -- Insert into auth.users (Trigger will fire here!)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    new_uid,
    '00000000-0000-0000-0000-000000000000',
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

  -- Explicitly upsert into profiles to ensure specific fields (like phone) are set
  INSERT INTO public.profiles (
    id, username, full_name, role, clinic_id, email, phone, approved
  ) VALUES (
    new_uid, username, full_name, role, clinic_id, email, phone, true
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    clinic_id = EXCLUDED.clinic_id,
    phone = EXCLUDED.phone,
    approved = true;

  RETURN jsonb_build_object('id', new_uid, 'email', email);
END;
$$;

-- 4. Function to manually trigger user sync from frontend (Admin only)
CREATE OR REPLACE FUNCTION admin_sync_users_rpc()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count integer := 0;
  user_record record;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
  ) THEN
      RAISE EXCEPTION 'Access Denied: Only admins can sync users.';
  END IF;

  FOR user_record IN 
    SELECT * FROM auth.users 
    WHERE id NOT IN (SELECT id FROM public.profiles)
  LOOP
    INSERT INTO public.profiles (
      id,
      username,
      full_name,
      role,
      clinic_id,
      email,
      approved
    ) VALUES (
      user_record.id,
      COALESCE(user_record.raw_user_meta_data->>'username', SPLIT_PART(user_record.email, '@', 1)),
      COALESCE(user_record.raw_user_meta_data->>'full_name', 'User'),
      COALESCE(user_record.raw_user_meta_data->>'role', 'staff'),
      CASE 
        WHEN (user_record.raw_user_meta_data->>'clinic_id') IS NOT NULL AND (user_record.raw_user_meta_data->>'clinic_id') != '' 
        THEN (user_record.raw_user_meta_data->>'clinic_id')::uuid 
        ELSE NULL 
      END,
      user_record.email,
      true
    );
    count := count + 1;
  END LOOP;

  RETURN jsonb_build_object('status', 'success', 'synced_count', count);
END;
$$;
