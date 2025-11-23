import { NextRequest, NextResponse } from 'next/server'
import { rooms } from '@/lib/roomStorage'

export async function GET(request: NextRequest) {
  try {
    const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
      id,
      playerCount: room.players.length,
      players: room.players.map(p => ({ id: p.id, nickname: p.nickname })),
      createdAt: room.createdAt,
      gameStatus: room.gameState.gameStatus
    }))
    
    return NextResponse.json({ 
      rooms: roomList,
      total: rooms.size 
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list rooms' }, { status: 500 })
  }
}

