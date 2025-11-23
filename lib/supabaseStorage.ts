// Supabase-based room storage
// Replaces the in-memory storage with Supabase database

import { supabase, Room, Player } from './supabase'

// Helper to convert database Room to app Room format
function dbRoomToAppRoom(dbRoom: any, dbPlayers: any[]): any {
  return {
    id: dbRoom.id,
    hostId: dbRoom.host_id,
    players: dbPlayers.map(p => ({
      id: p.id,
      nickname: p.nickname,
      guesses: p.guesses,
      wordsGuessed: p.words_guessed,
      status: p.status,
      lastActive: new Date(p.last_active).getTime(),
      currentGuess: p.current_guess || ''
    })),
    targetWord: dbRoom.target_word,
    gameState: dbRoom.game_state,
    readyPlayers: dbRoom.ready_players || [],
    createdAt: new Date(dbRoom.created_at).getTime()
  }
}

// Helper to convert app Room to database format
function appRoomToDbRoom(room: any): any {
  return {
    id: room.id,
    host_id: room.hostId,
    target_word: room.targetWord,
    game_state: room.gameState,
    ready_players: Array.isArray(room.readyPlayers) 
      ? room.readyPlayers 
      : Array.from(room.readyPlayers || [])
  }
}

export async function getRoom(roomCode: string): Promise<any | null> {
  try {
    const normalizedCode = roomCode.toUpperCase().trim()
    
    // Get room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', normalizedCode)
      .single()

    if (roomError || !room) {
      return null
    }

    // Get players for this room
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', normalizedCode)

    if (playersError) {
      console.error('Error fetching players:', playersError)
      return null
    }

    return dbRoomToAppRoom(room, players || [])
  } catch (error) {
    console.error('Error getting room:', error)
    return null
  }
}

export async function createRoom(room: any): Promise<boolean> {
  try {
    const dbRoom = appRoomToDbRoom(room)
    
    // Insert room
    const { error: roomError } = await supabase
      .from('rooms')
      .insert(dbRoom)

    if (roomError) {
      console.error('Error creating room:', roomError)
      return false
    }

    // Insert host player
    if (room.players && room.players.length > 0) {
      const hostPlayer = room.players[0]
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          id: hostPlayer.id,
          room_id: room.id,
          nickname: hostPlayer.nickname,
          guesses: hostPlayer.guesses || 0,
          words_guessed: hostPlayer.wordsGuessed || 0,
          status: hostPlayer.status || 'playing',
          last_active: new Date().toISOString(),
          current_guess: hostPlayer.currentGuess || null
        })

      if (playerError) {
        console.error('Error creating host player:', playerError)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('Error creating room:', error)
    return false
  }
}

export async function addPlayerToRoom(roomCode: string, player: any): Promise<boolean> {
  try {
    const normalizedCode = roomCode.toUpperCase().trim()
    
    // Check if player already exists
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('room_id', normalizedCode)
      .eq('id', player.id)
      .single()

    if (existing) {
      // Update last_active
      await supabase
        .from('players')
        .update({ last_active: new Date().toISOString() })
        .eq('id', player.id)
        .eq('room_id', normalizedCode)
      return true
    }

    // Insert new player
    const { error } = await supabase
      .from('players')
      .insert({
        id: player.id,
        room_id: normalizedCode,
        nickname: player.nickname,
        guesses: player.guesses || 0,
        words_guessed: player.wordsGuessed || 0,
        status: player.status || 'playing',
        last_active: new Date().toISOString(),
        current_guess: player.currentGuess || null
      })

    if (error) {
      console.error('Error adding player:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error adding player:', error)
    return false
  }
}

export async function updateRoom(roomCode: string, updates: any): Promise<boolean> {
  try {
    const normalizedCode = roomCode.toUpperCase().trim()
    
    const updateData: any = {}
    if (updates.targetWord !== undefined) updateData.target_word = updates.targetWord
    if (updates.gameState !== undefined) updateData.game_state = updates.gameState
    if (updates.readyPlayers !== undefined) {
      updateData.ready_players = Array.isArray(updates.readyPlayers)
        ? updates.readyPlayers
        : Array.from(updates.readyPlayers || [])
    }

    const { error } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', normalizedCode)

    if (error) {
      console.error('Error updating room:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating room:', error)
    return false
  }
}

export async function updatePlayer(roomCode: string, playerId: string, updates: any): Promise<boolean> {
  try {
    const normalizedCode = roomCode.toUpperCase().trim()
    
    const updateData: any = {
      last_active: new Date().toISOString()
    }
    
    if (updates.guesses !== undefined) updateData.guesses = updates.guesses
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.wordsGuessed !== undefined) updateData.words_guessed = updates.wordsGuessed
    if (updates.currentGuess !== undefined) updateData.current_guess = updates.currentGuess || null

    const { error } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId)
      .eq('room_id', normalizedCode)

    if (error) {
      console.error('Error updating player:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating player:', error)
    return false
  }
}

export async function removePlayer(roomCode: string, playerId: string): Promise<boolean> {
  try {
    const normalizedCode = roomCode.toUpperCase().trim()
    
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)
      .eq('room_id', normalizedCode)

    if (error) {
      console.error('Error removing player:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error removing player:', error)
    return false
  }
}

export async function cleanupInactivePlayers(roomCode: string, maxInactiveMs: number = 30000): Promise<number> {
  try {
    const normalizedCode = roomCode.toUpperCase().trim()
    const cutoffTime = new Date(Date.now() - maxInactiveMs).toISOString()
    
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('room_id', normalizedCode)
      .lt('last_active', cutoffTime)

    if (error) {
      console.error('Error cleaning up players:', error)
      return 0
    }

    return 1 // Return count of removed players (Supabase doesn't return count easily)
  } catch (error) {
    console.error('Error cleaning up players:', error)
    return 0
  }
}

