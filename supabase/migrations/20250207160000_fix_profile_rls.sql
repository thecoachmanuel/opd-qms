-- Fix RLS policies to allow profile creation/upsert by authenticated users
-- This is necessary for the auto-healing mechanism when a profile is missing

-- Drop existing policies that might conflict (or we can just add new ones if we are sure)
-- To be safe, we'll just add the insert policy which is missing in the initial schema

-- Allow authenticated users to INSERT their own profile
CREATE POLICY "Users can insert own profile" 
ON profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to UPDATE their own profile (already exists but ensuring coverage for upsert)
-- The existing one is: CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
-- That should be sufficient for the 'update' part of an upsert.

-- Note: The 'upsert' operation in Supabase client requires both INSERT and UPDATE permissions.
