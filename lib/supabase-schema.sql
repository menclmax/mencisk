-- Supabase Database Schema for Wordle Multiplayer
-- Run this in your Supabase SQL Editor

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  target_word TEXT NOT NULL,
  game_state JSONB NOT NULL DEFAULT '{"guesses": [], "game_status": "playing", "letter_states": {}}',
  ready_players TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  guesses INTEGER DEFAULT 0,
  words_guessed INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'won', 'lost')),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  current_guess TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_last_active ON players(last_active);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your auth needs)
CREATE POLICY "Allow all operations on rooms" ON rooms
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on players" ON players
  FOR ALL USING (true) WITH CHECK (true);

-- Function to clean up old rooms and inactive players
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete rooms older than 24 hours
  DELETE FROM rooms WHERE created_at < NOW() - INTERVAL '24 hours';
  
  -- Delete players inactive for more than 60 seconds
  DELETE FROM players WHERE last_active < NOW() - INTERVAL '60 seconds';
  
  -- Delete players in rooms that no longer exist
  DELETE FROM players WHERE room_id NOT IN (SELECT id FROM rooms);
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job (requires pg_cron extension)
-- You can also call this function manually or via a cron job
-- SELECT cron.schedule('cleanup-old-data', '*/5 * * * *', 'SELECT cleanup_old_data()');

