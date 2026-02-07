-- Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to avatars and assets
-- Note: We use DO blocks to avoid errors if policies already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'assets'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated Upload'
    ) THEN
        CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
END
$$;

-- RPC: Create User (Admin Only)
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

  -- Insert into auth.users
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

  -- Insert into public.profiles
  INSERT INTO public.profiles (
    id, username, full_name, role, clinic_id, email, phone, approved
  ) VALUES (
    new_uid, username, full_name, role, clinic_id, email, phone, true
  );

  RETURN jsonb_build_object('id', new_uid, 'email', email);
END;
$$;

-- RPC: Delete User (Admin Only)
CREATE OR REPLACE FUNCTION delete_user_by_id(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Check if caller is admin
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only admins can delete users.';
  END IF;

  -- Delete from auth.users (Cascades to profiles)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- RPC: Update User (Admin Only - including password)
CREATE OR REPLACE FUNCTION admin_update_user(
  target_user_id UUID,
  updates JSONB,
  new_password TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Check if caller is admin
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only admins can update users.';
  END IF;

  -- Update Profile
  UPDATE public.profiles
  SET
    username = COALESCE((updates->>'username'), username),
    full_name = COALESCE((updates->>'full_name'), full_name),
    role = COALESCE((updates->>'role'), role),
    clinic_id = CASE WHEN (updates->>'clinic_id') IS NULL THEN clinic_id ELSE (updates->>'clinic_id')::UUID END,
    email = COALESCE((updates->>'email'), email),
    phone = COALESCE((updates->>'phone'), phone)
  WHERE id = target_user_id;

  -- Update Password if provided
  IF new_password IS NOT NULL AND new_password <> '' THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf'))
    WHERE id = target_user_id;
  END IF;

  RETURN (SELECT row_to_json(p) FROM public.profiles p WHERE id = target_user_id);
END;
$$;
