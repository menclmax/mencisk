import { NextRequest, NextResponse } from 'next/server'
import { rooms, persistRooms, ensureReadyPlayersSet } from '@/lib/roomStorage'

export async function GET(
  request: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const normalizedRoomCode = params.roomCode.toUpperCase().trim()
    console.log(`GET request for room: ${normalizedRoomCode}`)
    console.log(`Current rooms:`, Array.from(rooms.keys()))
    console.log(`Total rooms: ${rooms.size}`)
    
    const room = rooms.get(normalizedRoomCode)

    if (!room) {
      console.log(`Room ${normalizedRoomCode} not found. Available rooms:`, Array.from(rooms.keys()))
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    console.log(`Room found: ${normalizedRoomCode}`)

    // Remove inactive players (not active for 30 seconds) before returning
    const now = Date.now()
    const beforeCount = room.players.length
    room.players = room.players.filter(p => now - p.lastActive < 30000)
    const afterCount = room.players.length
    
    if (beforeCount !== afterCount) {
      console.log(`Removed ${beforeCount - afterCount} inactive players from room ${normalizedRoomCode}`)
      persistRooms()
    }

    // Always return target word for multiplayer (players need it to play)
    // Only hide it in the UI until game ends
    return NextResponse.json({
      gameState: room.gameState,
      players: room.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        guesses: p.guesses,
        wordsGuessed: p.wordsGuessed || 0,
        status: p.status,
        currentGuess: p.currentGuess || '' // Include current guess for ghost display
      })),
      readyPlayers: Array.from(ensureReadyPlayersSet(room)),
      targetWord: room.targetWord // Always return for multiplayer games
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get room state' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const { playerId, guess, gameState, readyForNewGame, leaving, currentGuess } = await request.json()
    const normalizedRoomCode = params.roomCode.toUpperCase().trim()
    const room = rooms.get(normalizedRoomCode)

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // If player is leaving, remove them immediately
    if (leaving && playerId) {
      const beforeCount = room.players.length
      room.players = room.players.filter(p => p.id !== playerId)
      const readyPlayersSet = ensureReadyPlayersSet(room)
      readyPlayersSet.delete(playerId)
      room.readyPlayers = readyPlayersSet
      
      if (room.players.length !== beforeCount) {
        console.log(`Player ${playerId} left room ${normalizedRoomCode}`)
        persistRooms()
      }
      
      return NextResponse.json({ 
        success: true,
        players: room.players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          guesses: p.guesses,
          wordsGuessed: p.wordsGuessed || 0,
          status: p.status,
          currentGuess: p.currentGuess || ''
        }))
      })
    }

    // Initialize readyPlayers if it doesn't exist
    const readyPlayersSet = ensureReadyPlayersSet(room)

    // Update player's last active time (heartbeat or game update)
    const player = room.players.find(p => p.id === playerId)
    if (player) {
      player.lastActive = Date.now()
      // Update current guess (for ghost display)
      if (currentGuess !== undefined) {
        player.currentGuess = currentGuess
      }
      // Update player's guess count and status if game state provided
      if (gameState) {
        const previousStatus = player.status
        player.guesses = gameState.guesses.length
        player.status = gameState.gameStatus
        // Clear current guess when submitting a guess
        if (gameState.guesses.length > 0) {
          player.currentGuess = ''
        }
        // Increment wordsGuessed when game ends (won or lost) - only once per game
        if ((gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') && previousStatus === 'playing') {
          player.wordsGuessed = (player.wordsGuessed || 0) + 1
        }
      }
    } else if (playerId) {
      // Player not found but trying to update - might be a reconnection
      // This shouldn't happen, but handle gracefully
      console.warn(`Player ${playerId} not found in room ${params.roomCode}`)
    }

    // Handle ready for new game
    if (readyForNewGame !== undefined) {
      if (readyForNewGame) {
        readyPlayersSet.add(playerId)
      } else {
        readyPlayersSet.delete(playerId)
      }
      room.readyPlayers = readyPlayersSet
      persistRooms()
    }

    // Check if all players are ready for new game
    const allPlayersReady = room.players.length > 0 && 
      room.players.every(p => readyPlayersSet.has(p.id)) &&
      room.gameState.gameStatus !== 'playing'

    // If all players ready, start new game
    if (allPlayersReady && room.gameState.gameStatus !== 'playing') {
      const { WORDS } = await import('@/lib/words')
      room.targetWord = WORDS[Math.floor(Math.random() * WORDS.length)]
      room.gameState = {
        guesses: [],
        gameStatus: 'playing' as const,
        letterStates: {}
      }
      room.readyPlayers.clear()
      // Reset all players (keep wordsGuessed, only reset guesses and status)
      room.players.forEach(p => {
        p.guesses = 0
        p.status = 'playing'
        p.lastActive = Date.now()
        // wordsGuessed persists across games
      })
    }

    // Update game state
    if (gameState) {
      room.gameState = gameState
      // Clear ready players if game is still playing
      if (gameState.gameStatus === 'playing') {
        const readySet = ensureReadyPlayersSet(room)
        readySet.clear()
        room.readyPlayers = readySet
      }
      persistRooms()
    }

    return NextResponse.json({ 
      success: true, 
      gameState: room.gameState,
      players: room.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        guesses: p.guesses,
        wordsGuessed: p.wordsGuessed || 0,
        status: p.status,
        currentGuess: p.currentGuess || '' // Include current guess for ghost display
      })),
      readyPlayers: Array.from(room.readyPlayers),
      allPlayersReady,
      targetWord: allPlayersReady ? room.targetWord : undefined
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update room' }, { status: 500 })
  }
}

