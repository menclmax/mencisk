import { createClient } from '@supabase/supabase-js'

// These should be set as environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Player {
  id: string
  nickname: string
  guesses: number
  words_guessed: number
  status: 'playing' | 'won' | 'lost'
  last_active: string // ISO timestamp
  current_guess?: string
}

export interface Room {
  id: string
  host_id: string
  target_word: string
  game_state: {
    guesses: Array<{ word: string; states: string[] }>
    game_status: 'playing' | 'won' | 'lost'
    letter_states: Record<string, string>
  }
  ready_players: string[] // Array of player IDs
  created_at: string // ISO timestamp
}

