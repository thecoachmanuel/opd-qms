-- Add reminder_sent column to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- Create index for faster querying of upcoming appointments to remind
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_check 
ON appointments (scheduled_time, notify_email, reminder_sent) 
WHERE status = 'booked';
