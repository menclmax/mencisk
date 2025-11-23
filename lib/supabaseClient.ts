// Client-side Supabase client
// This is safe to use in browser components

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Real-time features will not work.')
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

