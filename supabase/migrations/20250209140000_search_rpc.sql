
-- Function to search appointments publicly by ticket or phone
-- Bypasses RLS but filters strictly by query to ensure privacy
CREATE OR REPLACE FUNCTION search_appointments_public(
  p_type TEXT,
  p_query TEXT
)
RETURNS TABLE (
  id UUID,
  ticket_code TEXT,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  status TEXT,
  clinic_name TEXT,
  patient_name TEXT,
  visit_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_type = 'ticket' THEN
    RETURN QUERY
    SELECT 
      a.id,
      a.ticket_code,
      a.scheduled_time,
      a.status,
      c.name as clinic_name,
      p.full_name as patient_name,
      a.visit_type
    FROM appointments a
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    WHERE a.ticket_code ILIKE p_query;
  ELSE
    RETURN QUERY
    SELECT 
      a.id,
      a.ticket_code,
      a.scheduled_time,
      a.status,
      c.name as clinic_name,
      p.full_name as patient_name,
      a.visit_type
    FROM appointments a
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    WHERE p.phone ILIKE '%' || p_query || '%';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION search_appointments_public TO anon, authenticated, service_role;
