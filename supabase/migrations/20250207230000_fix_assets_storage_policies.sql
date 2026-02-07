-- Fix storage policies for 'assets' bucket (Site Logo)

-- 1. Ensure 'assets' bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Restore Public Access for 'assets'
DROP POLICY IF EXISTS "Public Access Assets" ON storage.objects;
CREATE POLICY "Public Access Assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'assets' );

-- 3. Allow Admins to Manage Assets (Insert, Update, Delete)
DROP POLICY IF EXISTS "Admins can manage assets" ON storage.objects;
CREATE POLICY "Admins can manage assets"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'assets' 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
    bucket_id = 'assets' 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
