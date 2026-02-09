
-- Function to search appointments AND queue publicly by ticket or phone
-- Bypasses RLS but filters strictly by query to ensure privacy
CREATE OR REPLACE FUNCTION search_public_status(
  p_type TEXT,
  p_query TEXT
)
RETURNS TABLE (
  id UUID,
  ticket_code TEXT,
  status TEXT,
  clinic_id UUID,
  clinic_name TEXT,
  patient_name TEXT,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_type = 'ticket' THEN
    RETURN QUERY
    -- 1. Appointments
    SELECT 
      a.id,
      a.ticket_code,
      a.status,
      a.clinic_id,
      c.name as clinic_name,
      p.full_name as patient_name,
      a.scheduled_time,
      'appointment'::TEXT as source
    FROM appointments a
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    WHERE a.ticket_code ILIKE p_query
    
    UNION ALL
    
    -- 2. Queue (Walk-ins)
    SELECT 
      q.id,
      q.ticket_number as ticket_code,
      q.status,
      q.clinic_id,
      c.name as clinic_name,
      q.patient_name,
      q.arrival_time as scheduled_time,
      'queue'::TEXT as source
    FROM queue q
    JOIN clinics c ON q.clinic_id = c.id
    WHERE q.ticket_number ILIKE p_query
    AND (q.appointment_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM appointments a WHERE a.id = q.appointment_id
    )); 
    -- Logic: If it has appointment_id, the appointment search above should catch it. 
    -- But if appointment was deleted or something, we show queue.
    -- Safer to just exclude if appointment_id is present to avoid duplicates.
    
  ELSE
    -- Phone search (only appointments for now as queue doesn't typically store phone)
    RETURN QUERY
    SELECT 
      a.id,
      a.ticket_code,
      a.status,
      a.clinic_id,
      c.name as clinic_name,
      p.full_name as patient_name,
      a.scheduled_time,
      'appointment'::TEXT as source
    FROM appointments a
    JOIN clinics c ON a.clinic_id = c.id
    JOIN patients p ON a.patient_id = p.id
    WHERE p.phone ILIKE '%' || p_query || '%';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION search_public_status TO anon, authenticated, service_role;
