
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rwwasffpsqmtmsvsqcaj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3d2FzZmZwc3FtdG1zdnNxY2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MTAwNzQsImV4cCI6MjA4NTk4NjA3NH0.WZE95tC0ljYrJ0ho-Zo_YJGNc02Z2EybvK9MDwUs-7w';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSearch() {
  console.log('--- Testing Anonymous Sign In ---');
  
  const { data, error } = await supabase.auth.signInAnonymously();
  
  if (error) {
      console.log('Anonymous Sign In failed:', error.message);
  } else {
      console.log('Anonymous Sign In successful!', data.user.id);
      
      // Now try search
      console.log('--- Testing Search as Anonymous User ---');
      // We need a valid ticket. I'll use a random one or try to fetch one (which should now work if RLS allows authenticated)
      
      const { data: appts, error: fetchError } = await supabase
        .from('appointments')
        .select('ticket_code')
        .limit(1);

      if (fetchError) {
          console.log('Read failed:', fetchError.message);
      } else if (appts.length > 0) {
          console.log('Read succeeded! Found ticket:', appts[0].ticket_code);
      } else {
          console.log('Read succeeded but returned 0 rows.');
      }
  }
}

testSearch();
