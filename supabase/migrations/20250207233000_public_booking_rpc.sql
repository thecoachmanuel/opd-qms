-- Function to handle public appointment booking securely
CREATE OR REPLACE FUNCTION public_book_appointment(
  p_clinic_id UUID,
  p_scheduled_time TIMESTAMP WITH TIME ZONE,
  p_patient_full_name TEXT,
  p_patient_phone TEXT,
  p_patient_email TEXT DEFAULT NULL,
  p_patient_file_no TEXT DEFAULT NULL,
  p_notify_sms BOOLEAN DEFAULT FALSE,
  p_notify_email BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as database owner to bypass RLS for public users
AS $$
DECLARE
  v_patient_id UUID;
  v_file_no TEXT;
  v_appointment_id UUID;
  v_ticket_code TEXT;
  v_existing_patient RECORD;
BEGIN
  -- 1. Handle Patient Logic
  -- Try to find existing patient by File Number (if provided) OR Phone
  IF p_patient_file_no IS NOT NULL AND p_patient_file_no != '' THEN
    SELECT * INTO v_existing_patient FROM patients WHERE file_no = p_patient_file_no;
  END IF;

  IF v_existing_patient IS NULL THEN
    SELECT * INTO v_existing_patient FROM patients WHERE phone = p_patient_phone;
  END IF;

  -- Also check by Email to avoid unique constraint violations
  IF v_existing_patient IS NULL AND p_patient_email IS NOT NULL AND p_patient_email != '' THEN
    SELECT * INTO v_existing_patient FROM patients WHERE email = p_patient_email;
  END IF;

  IF v_existing_patient IS NOT NULL THEN
    v_patient_id := v_existing_patient.id;
    v_file_no := v_existing_patient.file_no;
  ELSE
    -- Create new patient
    -- Generate file number if not provided
    IF p_patient_file_no IS NOT NULL AND p_patient_file_no != '' THEN
      v_file_no := p_patient_file_no;
    ELSE
      -- Generate a temporary file number: TMP-YYYYMMDD-XXXX
      v_file_no := 'TMP-' || to_char(NOW(), 'YYYYMMDD') || '-' || floor(random() * 9000 + 1000)::text;
    END IF;

    INSERT INTO patients (full_name, phone, email, file_no)
    VALUES (p_patient_full_name, p_patient_phone, p_patient_email, v_file_no)
    RETURNING id INTO v_patient_id;
  END IF;

  -- 2. Generate Ticket Code
  -- Format: TKT-XXXX (random 4 digits)
  v_ticket_code := 'TKT-' || floor(random() * 9000 + 1000)::text;

  -- 3. Create Appointment
  INSERT INTO appointments (
    clinic_id,
    patient_id,
    scheduled_time,
    ticket_code,
    visit_type,
    status,
    notify_sms,
    notify_email
  )
  VALUES (
    p_clinic_id,
    v_patient_id,
    p_scheduled_time,
    v_ticket_code,
    'scheduled',
    'booked',
    p_notify_sms,
    p_notify_email
  )
  RETURNING id INTO v_appointment_id;

  -- 4. Return Result
  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'ticket_code', v_ticket_code,
    'patient_id', v_patient_id,
    'scheduled_time', p_scheduled_time,
    'file_no', v_file_no
  );
END;
$$;

-- Grant execute permission to everyone (anon and authenticated)
GRANT EXECUTE ON FUNCTION public_book_appointment TO anon, authenticated, service_role;
