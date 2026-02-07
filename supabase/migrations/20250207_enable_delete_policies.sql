-- Enable DELETE policies for authenticated users
-- This is required for the "Delete Record" functionality in Admin Dashboard to work.

-- Allow deleting appointments
CREATE POLICY "Appointments deletable by authenticated" ON appointments FOR DELETE TO authenticated USING (true);

-- Allow deleting queue items
CREATE POLICY "Queue deletable by authenticated" ON queue FOR DELETE TO authenticated USING (true);

-- Allow deleting patients (optional, but good for cleanup if needed later)
CREATE POLICY "Patients deletable by authenticated" ON patients FOR DELETE TO authenticated USING (true);
