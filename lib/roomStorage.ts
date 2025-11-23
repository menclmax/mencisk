// Shared in-memory room storage with file-based persistence for development
// In production, replace with Redis or a database

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface Player {
  id: string
  nickname: string
  guesses: number
  wordsGuessed: number // Total words guessed in this session
  status: 'playing' | 'won' | 'lost'
  lastActive: number
  currentGuess?: string // Current word being typed (for ghost display)
}

export interface Room {
  id: string
  hostId: string
  players: Player[]
  targetWord: string
  gameState: {
    guesses: Array<{ word: string; states: string[] }>
    gameStatus: 'playing' | 'won' | 'lost'
    letterStates: Record<string, string>
  }
  readyPlayers?: Set<string> | string[] // Can be Set or array (array for JSON)
  createdAt: number
}

const STORAGE_FILE = join(process.cwd(), '.rooms-cache.json')

// Load rooms from file if it exists
function loadRooms(): Map<string, Room> {
  const rooms = new Map<string, Room>()
  
  if (typeof window === 'undefined' && existsSync(STORAGE_FILE)) {
    try {
      const data = readFileSync(STORAGE_FILE, 'utf-8')
      const parsed = JSON.parse(data)
      
      for (const [id, room] of Object.entries(parsed)) {
        const roomData = room as any
        // Convert readyPlayers array back to Set if it's an array
        const readyPlayers = Array.isArray(roomData.readyPlayers) 
          ? new Set(roomData.readyPlayers)
          : (roomData.readyPlayers || new Set<string>())
        rooms.set(id, {
          ...roomData,
          readyPlayers
        } as Room)
      }
      
      console.log(`Loaded ${rooms.size} rooms from cache`)
    } catch (error) {
      console.error('Failed to load rooms from cache:', error)
    }
  }
  
  return rooms
}

// Save rooms to file
function saveRooms(rooms: Map<string, Room>) {
  if (typeof window === 'undefined') {
    try {
      const data: Record<string, any> = {}
      rooms.forEach((room, id) => {
        data[id] = {
          ...room,
          readyPlayers: Array.from(room.readyPlayers || [])
        }
      })
      writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Failed to save rooms to cache:', error)
    }
  }
}

export const rooms = loadRooms()

// Save rooms periodically and on changes
let saveTimeout: NodeJS.Timeout | null = null
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveRooms(rooms)
  }, 1000) // Debounce saves
}

// Clean up old rooms (older than 24 hours) and inactive players
// Note: In Next.js, this runs per-process, so rooms are shared within the same process
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    const roomsToDelete: string[] = []
    rooms.forEach((room, roomId) => {
      // Remove inactive players (not active for 60 seconds - more lenient)
      const beforeCount = room.players.length
      room.players = room.players.filter(p => now - p.lastActive < 60000)
      const afterCount = room.players.length
      
      if (beforeCount !== afterCount) {
        console.log(`Room ${roomId}: Removed ${beforeCount - afterCount} inactive players`)
        scheduleSave()
      }
      
      // Remove empty rooms or rooms older than 24 hours
      if (room.players.length === 0) {
        roomsToDelete.push(roomId)
        console.log(`Room ${roomId} is empty, marking for deletion`)
      } else if (now - room.createdAt > 24 * 60 * 60 * 1000) {
        roomsToDelete.push(roomId)
        console.log(`Room ${roomId} is older than 24 hours, marking for deletion`)
      }
    })
    
    // Delete rooms outside the loop to avoid mutation during iteration
    roomsToDelete.forEach(roomId => {
      rooms.delete(roomId)
      console.log(`Deleted room: ${roomId}`)
    })
    
    if (roomsToDelete.length > 0) {
      console.log(`Cleanup complete. Remaining rooms: ${rooms.size}`)
      scheduleSave()
    }
  }, 30 * 1000) // Check every 30 seconds (less aggressive)
}

// Helper to ensure readyPlayers is a Set
export function ensureReadyPlayersSet(room: Room): Set<string> {
  if (!room.readyPlayers) {
    room.readyPlayers = new Set<string>()
  } else if (Array.isArray(room.readyPlayers)) {
    room.readyPlayers = new Set(room.readyPlayers)
  }
  return room.readyPlayers as Set<string>
}

// Export a function to save rooms (call after mutations)
export function persistRooms() {
  scheduleSave()
}
