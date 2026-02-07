-- Enable the pg_cron extension
create extension if not exists pg_cron;

-- Schedule the reminder function to run every hour
-- Note: You need to replace 'your-project-ref' and 'your-anon-key' with actual values, 
-- OR use the internal network host if supported (supabase_functions.http_request is hypothetical helper)
-- A more standard way in Supabase is using pg_net or just calling the function via HTTP.

-- Assuming pg_net is available for making HTTP requests
create extension if not exists pg_net;

-- Create a cron job to call the function every hour
select cron.schedule(
  'send-reminders-hourly', -- name of the cron job
  '0 * * * *', -- every hour
  $$
  select
    net.http_post(
        url:='https://rwwasffpsqmtmsvsqcaj.supabase.co/functions/v1/send-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3d2FzZmZwc3FtdG1zdnNxY2FqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQxMDA3NCwiZXhwIjoyMDg1OTg2MDc0fQ.F-DcMONd84UxxhmKad6DTjbIWq3pzhNLDlCe7gWkCxY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
