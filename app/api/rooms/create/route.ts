import { NextRequest, NextResponse } from 'next/server'
import { WORDS } from '@/lib/words'
import { rooms, Room, persistRooms } from '@/lib/roomStorage'

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST(request: NextRequest) {
  try {
    const { playerId, nickname } = await request.json()

    if (!playerId || !nickname) {
      return NextResponse.json({ error: 'Player ID and nickname required' }, { status: 400 })
    }

    // Generate unique room code
    let roomCode = generateRoomCode()
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode()
    }

    // Select random word
    const targetWord = WORDS[Math.floor(Math.random() * WORDS.length)]

    // Create room
    const room: Room = {
      id: roomCode,
      hostId: playerId,
      players: [{
        id: playerId,
        nickname: nickname.trim(),
        guesses: 0,
        wordsGuessed: 0,
        status: 'playing',
        lastActive: Date.now()
      }],
      targetWord,
      gameState: {
        guesses: [],
        gameStatus: 'playing' as const,
        letterStates: {}
      },
      readyPlayers: new Set<string>(),
      createdAt: Date.now()
    }

    rooms.set(roomCode, room)
    persistRooms() // Save to file
    console.log(`Room created: ${roomCode}. Total rooms: ${rooms.size}`)
    console.log(`Room details:`, {
      id: room.id,
      players: room.players.length,
      createdAt: new Date(room.createdAt).toISOString()
    })
    
    // Verify room was actually stored
    const verifyRoom = rooms.get(roomCode)
    if (!verifyRoom) {
      console.error(`ERROR: Room ${roomCode} was not stored!`)
    } else {
      console.log(`Verified: Room ${roomCode} exists in storage`)
    }

    return NextResponse.json({ roomCode, targetWord: room.targetWord })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
  }
}

