-- Create consultations table for permanent record
CREATE TABLE IF NOT EXISTS public.consultations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    patient_name TEXT NOT NULL,
    ticket_number TEXT NOT NULL,
    consultation_notes TEXT,
    arrival_time TIMESTAMPTZ,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Policies for consultations
-- Doctors can view their own consultations
CREATE POLICY "Doctors can view own consultations" ON public.consultations
    FOR SELECT
    USING (auth.uid() = doctor_id);

-- Doctors can insert their own consultations
CREATE POLICY "Doctors can insert own consultations" ON public.consultations
    FOR INSERT
    WITH CHECK (auth.uid() = doctor_id);

-- Admins can view all consultations
CREATE POLICY "Admins can view all consultations" ON public.consultations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Function to calculate analytics
CREATE OR REPLACE FUNCTION get_clinic_analytics(
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Default to today if no dates provided
    IF start_date IS NULL THEN
        start_date := date_trunc('day', NOW());
    END IF;
    IF end_date IS NULL THEN
        end_date := NOW();
    END IF;

    SELECT json_build_object(
        'total_patients', COUNT(*),
        'avg_wait_time_minutes', COALESCE(AVG(EXTRACT(EPOCH FROM (start_time - arrival_time))/60), 0),
        'avg_consultation_time_minutes', COALESCE(AVG(EXTRACT(EPOCH FROM (end_time - start_time))/60), 0),
        'patients_by_clinic', (
            SELECT json_agg(row_to_json(c))
            FROM (
                SELECT 
                    cl.name as clinic_name, 
                    COUNT(*) as count,
                    COALESCE(AVG(EXTRACT(EPOCH FROM (co.start_time - co.arrival_time))/60), 0) as avg_wait
                FROM public.consultations co
                JOIN public.clinics cl ON co.clinic_id = cl.id
                WHERE co.created_at >= start_date AND co.created_at <= end_date
                GROUP BY cl.name
            ) c
        )
    ) INTO result
    FROM public.consultations
    WHERE created_at >= start_date AND created_at <= end_date;

    RETURN result;
END;
$$;
