/**
 * Supabase configuration for NoteFlow
 * Loads after https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
 * Exposes a global client at window.supabaseClient
 */
(function () {
  const SUPABASE_URL = 'https://qvtgwqhsrlqczijojcko.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dGd3cWhzcmxxY3ppam9qY2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzQ5MDEsImV4cCI6MjA3MDc1MDkwMX0.3I1_pfvZy5MnbmovbeSKiqUZagomxQuMBlYZLvemD1k';

  if (!window.supabase) {
    console.error('Supabase SDK not loaded. Ensure @supabase/supabase-js@2 is included before this file.');
    return;
  }

  try {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.log('Supabase client initialized');
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
  }
})();
