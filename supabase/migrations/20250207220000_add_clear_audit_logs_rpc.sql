-- Function to clear audit logs (Admin only)
CREATE OR REPLACE FUNCTION clear_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Only admins can clear audit logs.';
  END IF;

  -- Delete all logs
  DELETE FROM audit_logs WHERE true;
END;
$$;
