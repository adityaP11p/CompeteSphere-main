import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: localStorage
  }
})
supabase.auth.onAuthStateChange((_event, session) => {
  console.log("DEBUG auth change:", _event, session);
});

supabase.auth.getSession().then(({ data, error }) => {
  console.log("DEBUG getSession():", data, error);
});
