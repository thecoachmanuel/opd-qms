-- Function to register a walk-in patient with a consecutive ticket number
CREATE OR REPLACE FUNCTION register_walkin(
  p_clinic_id UUID,
  p_patient_name TEXT
)
RETURNS SETOF queue
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
  new_ticket_code TEXT;
  new_entry queue%ROWTYPE;
BEGIN
  -- Count existing walk-in tickets for this clinic today
  -- We assume walk-in tickets start with 'W-'
  SELECT COUNT(*) + 1
  INTO next_num
  FROM queue
  WHERE clinic_id = p_clinic_id
    AND ticket_number LIKE 'W-%'
    AND created_at >= CURRENT_DATE;

  -- Format as W-001, W-002, etc.
  new_ticket_code := 'W-' || LPAD(next_num::TEXT, 3, '0');

  INSERT INTO queue (
    clinic_id,
    ticket_number,
    patient_name,
    status,
    arrival_time
  ) VALUES (
    p_clinic_id,
    new_ticket_code,
    p_patient_name,
    'waiting',
    NOW()
  )
  RETURNING * INTO new_entry;

  RETURN NEXT new_entry;
END;
$$;
