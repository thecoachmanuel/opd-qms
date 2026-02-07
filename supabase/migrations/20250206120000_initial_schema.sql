
-- Enable UUID extension (if needed, though gen_random_uuid is built-in for pg13+)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- 1. Clinics Table
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  active_hours TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users Table (Supabase Auth integration handles actual auth, this is for app profiles)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'staff', 'doctor')) DEFAULT 'staff',
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  email TEXT UNIQUE,
  phone TEXT,
  profile_image TEXT,
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Patients Table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_no TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Appointments Table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('booked', 'checked_in', 'completed', 'cancelled', 'no_show')) DEFAULT 'booked',
  ticket_code TEXT NOT NULL,
  consultation_notes TEXT,
  visit_type TEXT CHECK (visit_type IN ('scheduled', 'walk-in')) DEFAULT 'scheduled',
  notify_sms BOOLEAN DEFAULT FALSE,
  notify_email BOOLEAN DEFAULT FALSE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Queue Table
CREATE TABLE queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  patient_name TEXT, -- Denormalized for quick display if needed
  ticket_number TEXT NOT NULL,
  status TEXT CHECK (status IN ('waiting', 'serving', 'done', 'no_show')) DEFAULT 'waiting',
  arrival_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  service_start_time TIMESTAMP WITH TIME ZONE,
  service_end_time TIMESTAMP WITH TIME ZONE,
  doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notified_next BOOLEAN DEFAULT FALSE,
  consultation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Settings Table (Single row expected)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_approve_signups BOOLEAN DEFAULT FALSE,
  hospital_latitude FLOAT,
  hospital_longitude FLOAT,
  geofence_radius_km FLOAT DEFAULT 0.5,
  site_config JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB
);

-- Enable Row Level Security (RLS)
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies (simplified for initial setup - restrict as needed for production)
-- Public read access for clinics and settings (needed for login/signup and initial config)
CREATE POLICY "Public clinics are viewable by everyone" ON clinics FOR SELECT USING (true);
CREATE POLICY "Public settings are viewable by everyone" ON settings FOR SELECT USING (true);

-- Profiles: Users can view their own profile. Admins/Staff might need broader access.
-- For now, allow authenticated read.
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Queue: Public read (for display screens), authenticated write (staff/doctors)
CREATE POLICY "Queue is viewable by everyone" ON queue FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert queue" ON queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update queue" ON queue FOR UPDATE TO authenticated USING (true);

-- Appointments: Authenticated read/write
CREATE POLICY "Appointments viewable by authenticated" ON appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Appointments insertable by authenticated" ON appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Appointments updatable by authenticated" ON appointments FOR UPDATE TO authenticated USING (true);

-- Patients: Authenticated read/write
CREATE POLICY "Patients viewable by authenticated" ON patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Patients insertable by authenticated" ON patients FOR INSERT TO authenticated WITH CHECK (true);
