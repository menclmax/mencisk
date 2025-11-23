import { NextRequest, NextResponse } from 'next/server'
import { rooms, Player, persistRooms } from '@/lib/roomStorage'

export async function POST(request: NextRequest) {
  try {
    const { roomCode, playerId, nickname } = await request.json()

    if (!roomCode || !playerId || !nickname) {
      return NextResponse.json({ error: 'Room code, player ID, and nickname required' }, { status: 400 })
    }

    // Normalize room code to uppercase
    const normalizedRoomCode = roomCode.toUpperCase().trim()
    console.log(`Join attempt for room: ${normalizedRoomCode}`)
    console.log(`Current rooms in storage:`, Array.from(rooms.keys()))
    console.log(`Total rooms: ${rooms.size}`)
    
    const room = rooms.get(normalizedRoomCode)

    if (!room) {
      console.log(`Join attempt: Room ${normalizedRoomCode} not found. Available rooms:`, Array.from(rooms.keys()))
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    
    console.log(`Room found: ${normalizedRoomCode}, players: ${room.players.length}`)

    // Add player if not already in room
    const existingPlayer = room.players.find(p => p.id === playerId)
    if (!existingPlayer) {
      room.players.push({
        id: playerId,
        nickname: nickname.trim(),
        guesses: 0,
        wordsGuessed: 0,
        status: 'playing',
        lastActive: Date.now()
      })
    } else {
      // Update last active time
      existingPlayer.lastActive = Date.now()
    }
    
    persistRooms() // Save to file

    return NextResponse.json({ 
      success: true, 
      gameState: room.gameState,
      targetWord: room.targetWord, // All players need the target word to play (always return it for multiplayer)
      players: room.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        guesses: p.guesses,
        wordsGuessed: p.wordsGuessed || 0,
        status: p.status
      })),
      readyPlayers: Array.from((room.readyPlayers instanceof Set ? room.readyPlayers : new Set(room.readyPlayers || [])))
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 })
  }
}

