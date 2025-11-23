import { NextRequest, NextResponse } from 'next/server'
import { WORDS } from '@/lib/words'
import { supabase } from '@/lib/supabase'
import { createRoom } from '@/lib/supabaseStorage'

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
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', roomCode)
        .single()
      
      if (!existing) break
      roomCode = generateRoomCode()
      attempts++
    }

    if (attempts >= 10) {
      return NextResponse.json({ error: 'Failed to generate unique room code' }, { status: 500 })
    }

    // Select random word
    const targetWord = WORDS[Math.floor(Math.random() * WORDS.length)]

    // Create room object
    const room = {
      id: roomCode,
      hostId: playerId,
      players: [{
        id: playerId,
        nickname: nickname.trim(),
        guesses: 0,
        wordsGuessed: 0,
        status: 'playing' as const,
        lastActive: Date.now()
      }],
      targetWord,
      gameState: {
        guesses: [],
        gameStatus: 'playing' as const,
        letterStates: {}
      },
      readyPlayers: [] as string[],
      createdAt: Date.now()
    }

    // Save to Supabase
    const success = await createRoom(room)
    if (!success) {
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
    }

    console.log(`Room created: ${roomCode}`)

    return NextResponse.json({ roomCode, targetWord: room.targetWord })
  } catch (error) {
    console.error('Error creating room:', error)
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
  }
}

