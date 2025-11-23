import { NextRequest, NextResponse } from 'next/server'
import { getRoom, addPlayerToRoom } from '@/lib/supabaseStorage'

export async function POST(request: NextRequest) {
  try {
    const { roomCode, playerId, nickname } = await request.json()

    if (!roomCode || !playerId || !nickname) {
      return NextResponse.json({ error: 'Room code, player ID, and nickname required' }, { status: 400 })
    }

    // Normalize room code to uppercase
    const normalizedRoomCode = roomCode.toUpperCase().trim()
    console.log(`Join attempt for room: ${normalizedRoomCode}`)
    
    const room = await getRoom(normalizedRoomCode)

    if (!room) {
      console.log(`Join attempt: Room ${normalizedRoomCode} not found`)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    console.log(`Room found: ${normalizedRoomCode}, players: ${room.players.length}`)

    // Add player if not already in room
    const existingPlayer = room.players.find((p: any) => p.id === playerId)
    if (!existingPlayer) {
      await addPlayerToRoom(normalizedRoomCode, {
        id: playerId,
        nickname: nickname.trim(),
        guesses: 0,
        wordsGuessed: 0,
        status: 'playing',
        lastActive: Date.now()
      })
      
      // Refresh room data
      const updatedRoom = await getRoom(normalizedRoomCode)
      if (updatedRoom) {
        room.players = updatedRoom.players
      }
    } else {
      // Update last active time
      await addPlayerToRoom(normalizedRoomCode, {
        id: playerId,
        nickname: existingPlayer.nickname,
        guesses: existingPlayer.guesses,
        wordsGuessed: existingPlayer.wordsGuessed,
        status: existingPlayer.status,
        lastActive: Date.now(),
        currentGuess: existingPlayer.currentGuess
      })
    }

    return NextResponse.json({ 
      success: true, 
      gameState: room.gameState,
      targetWord: room.targetWord, // All players need the target word to play (always return it for multiplayer)
      players: room.players.map((p: any) => ({
        id: p.id,
        nickname: p.nickname,
        guesses: p.guesses,
        wordsGuessed: p.wordsGuessed || 0,
        status: p.status
      })),
      readyPlayers: Array.isArray(room.readyPlayers) ? room.readyPlayers : []
    })
  } catch (error) {
    console.error('Error joining room:', error)
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
  }
}

