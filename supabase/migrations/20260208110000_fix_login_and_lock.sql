-- Function to safely resolve email from username (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION get_email_by_username(username_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_email TEXT;
BEGIN
    SELECT email INTO found_email
    FROM profiles
    WHERE username = username_input
    LIMIT 1;
    
    RETURN found_email;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon, authenticated;
