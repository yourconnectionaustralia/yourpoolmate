// File: src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // IMPORTANT: Use window.location.origin so auth redirects work correctly
    // on both yourpoolmate.com.au/app and app.yourpoolmate.com.au
    // This was a known resolved bug — do not hardcode a domain here.
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})
