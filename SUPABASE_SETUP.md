# Supabase Setup Guide

This project uses Supabase for multiplayer game state management with real-time updates.

## Prerequisites

1. Create a free Supabase account at https://supabase.com
2. Create a new project

## Setup Steps

### 1. Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following:
   - **Project URL** (this is your `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

### 2. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 3. Set Up the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Open the file `lib/supabase-schema.sql` from this project
3. Copy and paste the entire SQL script into the SQL Editor
4. Click **Run** to execute the script

This will create:
- `rooms` table for storing game rooms
- `players` table for storing player data
- Indexes for better performance
- Row Level Security (RLS) policies
- A cleanup function for old data

### 4. Enable Realtime (Important!)

1. In your Supabase dashboard, go to **Database** → **Replication**
2. Enable replication for both `rooms` and `players` tables
3. This allows real-time updates to work

### 5. Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the Wordle project and try creating/joining a multiplayer room
3. Check the browser console for any errors
4. Check the Supabase dashboard → **Table Editor** to see if data is being created

## Features

- **Real-time Updates**: Uses Supabase real-time subscriptions instead of polling (when configured)
- **Persistent Storage**: Game rooms persist across server restarts
- **Automatic Cleanup**: Old rooms and inactive players are automatically removed
- **Scalable**: Can handle many concurrent games

## Troubleshooting

### Real-time not working?

- Make sure you've enabled replication for `rooms` and `players` tables
- Check that your environment variables are set correctly
- Check the browser console for errors

### Rooms not persisting?

- Verify the database schema was created correctly
- Check that RLS policies allow all operations (or adjust based on your auth needs)
- Check the Supabase logs in the dashboard

### API errors?

- Verify your Supabase URL and anon key are correct
- Check that the tables exist in your database
- Review the API route logs in your Next.js terminal

## Production Considerations

1. **Authentication**: Consider implementing proper authentication instead of allowing all operations
2. **Rate Limiting**: Add rate limiting to prevent abuse
3. **Monitoring**: Set up monitoring for your Supabase project
4. **Backup**: Configure automatic backups in Supabase
5. **RLS Policies**: Tighten RLS policies for production use

