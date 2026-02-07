
-- Allow authenticated users to delete from queue (needed for "Cancel" / remove from queue)
-- We check if the policy exists first to avoid errors, but simpler to just create if not exists using DO block or just CREATE (which might fail if exists).
-- Since we are in a dev environment, we can just try to create it.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'queue' 
        AND policyname = 'Authenticated users can delete queue'
    ) THEN
        CREATE POLICY "Authenticated users can delete queue" ON queue FOR DELETE TO authenticated USING (true);
    END IF;
END
$$;
