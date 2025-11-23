import { NextRequest, NextResponse } from 'next/server'
import { getRoom, updateRoom, updatePlayer, removePlayer, cleanupInactivePlayers } from '@/lib/supabaseStorage'
import { WORDS } from '@/lib/words'

export async function GET(
  request: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const normalizedRoomCode = params.roomCode.toUpperCase().trim()
    console.log(`GET request for room: ${normalizedRoomCode}`)
    
    const room = await getRoom(normalizedRoomCode)

    if (!room) {
      console.log(`Room ${normalizedRoomCode} not found`)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    console.log(`Room found: ${normalizedRoomCode}`)

    // Clean up inactive players (not active for 30 seconds)
    await cleanupInactivePlayers(normalizedRoomCode, 30000)
    
    // Refresh room data after cleanup
    const refreshedRoom = await getRoom(normalizedRoomCode)
    if (!refreshedRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Always return target word for multiplayer (players need it to play)
    // Only hide it in the UI until game ends
    return NextResponse.json({
      gameState: refreshedRoom.gameState,
      players: refreshedRoom.players.map((p: any) => ({
        id: p.id,
        nickname: p.nickname,
        guesses: p.guesses,
        wordsGuessed: p.wordsGuessed || 0,
        status: p.status,
        currentGuess: p.currentGuess || '' // Include current guess for ghost display
      })),
      readyPlayers: Array.isArray(refreshedRoom.readyPlayers) ? refreshedRoom.readyPlayers : [],
      targetWord: refreshedRoom.targetWord // Always return for multiplayer games
    })
  } catch (error) {
    console.error('Error getting room:', error)
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
    
    let room = await getRoom(normalizedRoomCode)
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // If player is leaving, remove them immediately
    if (leaving && playerId) {
      await removePlayer(normalizedRoomCode, playerId)
      
      // Update ready players list
      const readyPlayers = Array.isArray(room.readyPlayers) ? room.readyPlayers : []
      const updatedReadyPlayers = readyPlayers.filter((id: string) => id !== playerId)
      await updateRoom(normalizedRoomCode, { readyPlayers: updatedReadyPlayers })
      
      // Refresh room data
      room = await getRoom(normalizedRoomCode)
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 })
      }
      
      return NextResponse.json({ 
        success: true,
        players: room.players.map((p: any) => ({
          id: p.id,
          nickname: p.nickname,
          guesses: p.guesses,
          wordsGuessed: p.wordsGuessed || 0,
          status: p.status,
          currentGuess: p.currentGuess || ''
        }))
      })
    }

    // Get current player
    const player = room.players.find((p: any) => p.id === playerId)
    if (!player && playerId) {
      console.warn(`Player ${playerId} not found in room ${normalizedRoomCode}`)
    }

    // Update player's last active time and other fields
    if (player) {
      const playerUpdates: any = {}
      
      // Update current guess (for ghost display)
      if (currentGuess !== undefined) {
        playerUpdates.currentGuess = currentGuess
      }
      
      // Update player's guess count and status if game state provided
      if (gameState) {
        const previousStatus = player.status
        playerUpdates.guesses = gameState.guesses.length
        playerUpdates.status = gameState.gameStatus
        
        // Clear current guess when submitting a guess
        if (gameState.guesses.length > 0) {
          playerUpdates.currentGuess = ''
        }
        
        // Increment wordsGuessed when game ends (won or lost) - only once per game
        if ((gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') && previousStatus === 'playing') {
          playerUpdates.wordsGuessed = (player.wordsGuessed || 0) + 1
        }
      }
      
      await updatePlayer(normalizedRoomCode, playerId, playerUpdates)
    }

    // Handle ready for new game
    let readyPlayers = Array.isArray(room.readyPlayers) ? [...room.readyPlayers] : []
    if (readyForNewGame !== undefined) {
      if (readyForNewGame) {
        if (!readyPlayers.includes(playerId)) {
          readyPlayers.push(playerId)
        }
      } else {
        readyPlayers = readyPlayers.filter((id: string) => id !== playerId)
      }
      await updateRoom(normalizedRoomCode, { readyPlayers })
    }

    // Check if all players are ready for new game
    const allPlayersReady = room.players.length > 0 && 
      room.players.every((p: any) => readyPlayers.includes(p.id)) &&
      room.gameState.gameStatus !== 'playing'

    // If all players ready, start new game
    if (allPlayersReady && room.gameState.gameStatus !== 'playing') {
      const newTargetWord = WORDS[Math.floor(Math.random() * WORDS.length)]
      const newGameState = {
        guesses: [],
        gameStatus: 'playing' as const,
        letterStates: {}
      }
      
      await updateRoom(normalizedRoomCode, {
        targetWord: newTargetWord,
        gameState: newGameState,
        readyPlayers: []
      })
      
      // Reset all players (keep wordsGuessed, only reset guesses and status)
      for (const p of room.players) {
        await updatePlayer(normalizedRoomCode, p.id, {
          guesses: 0,
          status: 'playing'
        })
      }
      
      // Refresh room
      room = await getRoom(normalizedRoomCode)
      if (room) {
        room.targetWord = newTargetWord
        room.gameState = newGameState
        readyPlayers = []
      }
    }

    // Update game state
    if (gameState) {
      const roomUpdates: any = { gameState }
      // Clear ready players if game is still playing
      if (gameState.gameStatus === 'playing') {
        roomUpdates.readyPlayers = []
        readyPlayers = []
      }
      await updateRoom(normalizedRoomCode, roomUpdates)
      
      // Refresh room
      room = await getRoom(normalizedRoomCode)
      if (room && gameState.gameStatus === 'playing') {
        readyPlayers = []
      }
    }

    // Refresh room data before returning
    const finalRoom = await getRoom(normalizedRoomCode)
    if (!finalRoom) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      gameState: finalRoom.gameState,
      players: finalRoom.players.map((p: any) => ({
        id: p.id,
        nickname: p.nickname,
        guesses: p.guesses,
        wordsGuessed: p.wordsGuessed || 0,
        status: p.status,
        currentGuess: p.currentGuess || '' // Include current guess for ghost display
      })),
      readyPlayers: Array.isArray(finalRoom.readyPlayers) ? finalRoom.readyPlayers : [],
      allPlayersReady,
      targetWord: allPlayersReady ? finalRoom.targetWord : undefined
    })
  } catch (error) {
    console.error('Error updating room:', error)
    return NextResponse.json({ error: 'Failed to update room' }, { status: 500 })
  }
}

