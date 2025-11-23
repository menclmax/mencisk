'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { projects, Project } from '@/components/Launchpad'
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import { WORDS } from '@/lib/words'
import { supabaseClient } from '@/lib/supabaseClient'
import styles from './page.module.css'

type LetterState = 'correct' | 'present' | 'absent' | ''

interface Guess {
  word: string
  states: LetterState[]
}

const getDailyWord = (): string => {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  return WORDS[dayOfYear % WORDS.length]
}

// Play sound effect
const playSound = (frequency: number, duration: number = 0.1, type: 'sine' | 'square' | 'sawtooth' = 'sine') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = frequency
    oscillator.type = type

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + duration)
  } catch (error) {
    // Silently fail if Web Audio API is not supported
  }
}

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [isMultiplayerMode, setIsMultiplayerMode] = useState(false)
  const [isSinglePlayerMode, setIsSinglePlayerMode] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [gameMode, setGameMode] = useState<'daily' | 'infinite'>('daily')
  
  // Multiplayer state
  const [multiplayerState, setMultiplayerState] = useState<'host-join' | 'hosting' | 'joining' | 'playing'>('host-join')
  const [roomCode, setRoomCode] = useState<string>('')
  const [playerId] = useState<string>(() => `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [isHost, setIsHost] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const subscriptionRef = useRef<any>(null)
  const [nickname, setNickname] = useState<string>('')
  const [players, setPlayers] = useState<Array<{ id: string; nickname: string; guesses: number; wordsGuessed: number; status: string; currentGuess?: string }>>([])
  const [readyPlayers, setReadyPlayers] = useState<string[]>([])
  const [isReadyForNewGame, setIsReadyForNewGame] = useState(false)
  
  // Game state
  const [targetWord, setTargetWord] = useState<string>(getDailyWord())
  const [currentGuess, setCurrentGuess] = useState<string>('')
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing')
  const [letterStates, setLetterStates] = useState<Record<string, LetterState>>({})
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [currentDay, setCurrentDay] = useState<number>(() => {
    const today = new Date()
    return Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  })

  // Check for day change and reset daily challenge at midnight
  useEffect(() => {
    if (!isSinglePlayerMode || gameMode !== 'daily') return

    const checkDayChange = () => {
      const today = new Date()
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
      
      if (dayOfYear !== currentDay) {
        setCurrentDay(dayOfYear)
        const newWord = getDailyWord()
        setTargetWord(newWord)
        setCurrentGuess('')
        setGuesses([])
        setGameStatus('playing')
        setLetterStates({})
        setErrorMessage('')
      }
    }

    // Check immediately
    checkDayChange()

    // Check every minute for day change
    const interval = setInterval(checkDayChange, 60000)

    return () => clearInterval(interval)
  }, [isSinglePlayerMode, gameMode, currentDay])

  // Reset game when mode changes
  useEffect(() => {
    if (isSinglePlayerMode) {
      const newWord = gameMode === 'daily' ? getDailyWord() : WORDS[Math.floor(Math.random() * WORDS.length)]
      setTargetWord(newWord)
      setCurrentGuess('')
      setGuesses([])
      setGameStatus('playing')
      setLetterStates({})
      setErrorMessage('')
      
      // Update current day for daily mode
      if (gameMode === 'daily') {
        const today = new Date()
        const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
        setCurrentDay(dayOfYear)
      }
    }
  }, [gameMode, isSinglePlayerMode])

  const evaluateGuess = (guess: string, target: string): LetterState[] => {
    const states: LetterState[] = ['', '', '', '', '']
    const targetLetters = target.split('')
    const guessLetters = guess.split('')
    const used = new Array(5).fill(false)

    // First pass: mark correct positions
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        states[i] = 'correct'
        used[i] = true
      }
    }

    // Second pass: mark present letters
    for (let i = 0; i < 5; i++) {
      if (states[i] !== 'correct') {
        for (let j = 0; j < 5; j++) {
          if (!used[j] && guessLetters[i] === targetLetters[j]) {
            states[i] = 'present'
            used[j] = true
            break
          }
        }
        if (states[i] === '') {
          states[i] = 'absent'
        }
      }
    }

    return states
  }

  const handleKeyPress = useCallback((key: string) => {
    if (gameStatus !== 'playing' || !isSinglePlayerMode) return
    if (multiplayerState === 'hosting' || multiplayerState === 'joining' || multiplayerState === 'host-join') return

    if (key === 'ENTER') {
      if (currentGuess.length === 5) {
        // Check if word is valid
        if (!WORDS.includes(currentGuess)) {
          setErrorMessage('NOT A VALID WORD')
          setTimeout(() => setErrorMessage(''), 2000)
          return
        }

        setErrorMessage('')
        const states = evaluateGuess(currentGuess, targetWord)
        const newGuess: Guess = { word: currentGuess, states }
        const newGuesses = [...guesses, newGuess]
        setGuesses(newGuesses)
        const guessWord = currentGuess
        setCurrentGuess('')

        // Update letter states for keyboard
        const newLetterStates = { ...letterStates }
        guessWord.split('').forEach((letter, i) => {
          const existing = newLetterStates[letter]
          if (!existing || states[i] === 'correct' || (states[i] === 'present' && existing !== 'correct')) {
            newLetterStates[letter] = states[i]
          }
        })
        setLetterStates(newLetterStates)

        // Check win/lose
        let newGameStatus: 'playing' | 'won' | 'lost' = gameStatus
        if (guessWord === targetWord) {
          newGameStatus = 'won'
        } else if (newGuesses.length >= 6) {
          newGameStatus = 'lost'
        }
        setGameStatus(newGameStatus)

        // If multiplayer, sync with server (clear currentGuess on submit)
        if (roomCode && multiplayerState === 'playing') {
          fetch(`/api/rooms/${roomCode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId,
              guess: guessWord,
              currentGuess: '', // Clear ghost on submit
              gameState: {
                guesses: newGuesses,
                gameStatus: newGameStatus,
                letterStates: newLetterStates
              }
            })
          }).then(res => res.json()).then(data => {
            // Update players list from response
            if (data.players) {
              setPlayers(data.players)
            }
            // Update ready players
            if (data.readyPlayers) {
              setReadyPlayers(data.readyPlayers)
            }
            // If new game started, reset local state
            if (data.allPlayersReady && data.targetWord && data.gameState.gameStatus === 'playing') {
              setTargetWord(data.targetWord)
              setCurrentGuess('')
              setGuesses([])
              setGameStatus('playing')
              setLetterStates({})
              setErrorMessage('')
              setIsReadyForNewGame(false)
            }
          }).catch(err => console.error('Failed to sync game state:', err))
        }
      }
    } else if (key === 'BACKSPACE' || key === '⌫') {
      const newGuess = currentGuess.slice(0, -1)
      setCurrentGuess(newGuess)
      setErrorMessage('')
      // Update ghost in multiplayer
      if (roomCode && multiplayerState === 'playing') {
        fetch(`/api/rooms/${roomCode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, currentGuess: newGuess })
        }).catch(err => console.error('Failed to update current guess:', err))
      }
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      const newGuess = currentGuess + key
      setCurrentGuess(newGuess)
      setErrorMessage('')
      // Update ghost in multiplayer
      if (roomCode && multiplayerState === 'playing') {
        fetch(`/api/rooms/${roomCode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, currentGuess: newGuess })
        }).catch(err => console.error('Failed to update current guess:', err))
      }
    }
  }, [currentGuess, targetWord, guesses, gameStatus, isSinglePlayerMode, letterStates, roomCode, multiplayerState, playerId])

  // Handle physical keyboard
  useEffect(() => {
    if (!isSinglePlayerMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleKeyPress('ENTER')
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACKSPACE')
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyPress, isSinglePlayerMode])

  const project = projects.find((p: Project) => p.id === projectId)

  const handleSinglePlayerClick = () => {
    playSound(440, 0.15, 'square') // Click sound
    setIsSinglePlayerMode(true)
  }

  const handleMultiplayerClick = () => {
    playSound(440, 0.15, 'square') // Click sound
    setIsAnimating(true)
    setTimeout(() => {
      setIsMultiplayerMode(true)
      setIsAnimating(false)
    }, 300)
  }

  const handleBackClick = async () => {
    // If in a multiplayer room, notify server that player is leaving
    if (roomCode && multiplayerState === 'playing') {
      try {
        // Send a request to remove the player (they'll be marked inactive)
        await fetch(`/api/rooms/${roomCode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, leaving: true })
        })
      } catch (err) {
        console.error('Failed to notify server of leave:', err)
      }
    }
    
    setIsAnimating(true)
    setTimeout(() => {
      setIsMultiplayerMode(false)
      setIsAnimating(false)
      setMultiplayerState('host-join')
      setRoomCode('')
      setIsHost(false)
      setPlayers([])
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
    }, 300)
  }

  const handleNewGame = () => {
    if (gameMode === 'infinite') {
      const newWord = WORDS[Math.floor(Math.random() * WORDS.length)]
      setTargetWord(newWord)
      setCurrentGuess('')
      setGuesses([])
      setGameStatus('playing')
      setLetterStates({})
      setErrorMessage('')
    }
  }

  const handleHostGame = () => {
    playSound(440, 0.15, 'square') // Click sound
    setMultiplayerState('hosting')
  }

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      setErrorMessage('ENTER NICKNAME')
      setTimeout(() => setErrorMessage(''), 2000)
      return
    }
    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, nickname: nickname.trim() })
      })
      const data = await response.json()
      if (response.ok && data.roomCode) {
        const normalizedRoomCode = data.roomCode.toUpperCase().trim()
        console.log('Creating room, setting state:', {
          roomCode: normalizedRoomCode,
          targetWord: data.targetWord ? 'present' : 'missing'
        })
        setRoomCode(normalizedRoomCode)
        setTargetWord(data.targetWord)
        setIsHost(true)
        setMultiplayerState('playing')
        setIsSinglePlayerMode(true)
        // Initialize players list with host
        setPlayers([{
          id: playerId,
          nickname: nickname.trim(),
          guesses: 0,
          wordsGuessed: 0,
          status: 'playing'
        }])
        setReadyPlayers([])
        // Start polling for game state updates
        startPolling(normalizedRoomCode)
        console.log(`Room created successfully: ${normalizedRoomCode}`)
        console.log('State after room creation:', {
          isSinglePlayerMode: true,
          multiplayerState: 'playing',
          roomCode: normalizedRoomCode
        })
      } else {
        const errorMsg = data.error || 'FAILED TO CREATE ROOM'
        setErrorMessage(errorMsg.toUpperCase())
        setTimeout(() => setErrorMessage(''), 2000)
      }
    } catch (error) {
      console.error('Failed to create room:', error)
      setErrorMessage('FAILED TO CREATE ROOM')
      setTimeout(() => setErrorMessage(''), 2000)
    }
  }

  const handleJoinGame = () => {
    playSound(440, 0.15, 'square') // Click sound
    setMultiplayerState('joining')
  }

  const handleJoinRoom = async (code: string) => {
    if (!nickname.trim()) {
      setErrorMessage('ENTER NICKNAME')
      setTimeout(() => setErrorMessage(''), 2000)
      return
    }
    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code.toUpperCase(), playerId, nickname: nickname.trim() })
      })
      const data = await response.json()
      console.log('Join response:', data)
      if (response.ok) {
        const normalizedCode = code.toUpperCase().trim()
        console.log('Setting state for join:', {
          roomCode: normalizedCode,
          hasTargetWord: !!data.targetWord,
          playersCount: data.players?.length || 0,
          gameState: data.gameState
        })
        
        setRoomCode(normalizedCode)
        setIsHost(false)
        setMultiplayerState('playing')
        setIsSinglePlayerMode(true)
        
        // Set target word (needed for game logic, but hidden in UI until game ends)
        // In multiplayer, always set the target word so players can play
        if (data.targetWord) {
          setTargetWord(data.targetWord)
          console.log('Target word set for multiplayer:', data.targetWord)
        } else {
          console.warn('No target word received when joining room')
        }
        
        // Sync initial game state
        if (data.gameState) {
          setGuesses(data.gameState.guesses || [])
          setGameStatus(data.gameState.gameStatus || 'playing')
          setLetterStates(data.gameState.letterStates || {})
        } else {
          // Initialize empty game state if not provided
          console.log('No gameState in response, initializing empty state')
          setGuesses([])
          setGameStatus('playing')
          setLetterStates({})
        }
        
        // Ensure currentGuess is cleared
        setCurrentGuess('')
        
        if (data.players && Array.isArray(data.players)) {
          setPlayers(data.players)
          console.log('Players set:', data.players)
        } else {
          console.warn('No players array in join response')
          setPlayers([])
        }
        
        if (data.readyPlayers && Array.isArray(data.readyPlayers)) {
          setReadyPlayers(data.readyPlayers)
        }
        
        console.log('Join successful, starting game. Room:', normalizedCode, 'Players:', data.players?.length || 0)
        console.log('State after join:', {
          roomCode: normalizedCode,
          multiplayerState: 'playing',
          isSinglePlayerMode: true,
          targetWord: data.targetWord ? 'set' : 'missing',
          playersCount: data.players?.length || 0,
          guessesCount: data.gameState?.guesses?.length || 0
        })
        
        // Start polling for game state updates
        startPolling(normalizedCode)
      } else {
        const errorMsg = data.error || 'ROOM NOT FOUND'
        setErrorMessage(errorMsg.toUpperCase())
        setTimeout(() => setErrorMessage(''), 2000)
      }
    } catch (error) {
      console.error('Failed to join room:', error)
      setErrorMessage('FAILED TO JOIN')
      setTimeout(() => setErrorMessage(''), 2000)
    }
  }

  // Keep player active by sending heartbeat (also syncs currentGuess)
  useEffect(() => {
    if (roomCode && multiplayerState === 'playing') {
      const heartbeat = setInterval(async () => {
        try {
          await fetch(`/api/rooms/${roomCode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, currentGuess })
          })
        } catch (err) {
          console.error('Heartbeat failed:', err)
        }
      }, 2000) // Send heartbeat every 2 seconds (faster for ghost updates)
      
      return () => clearInterval(heartbeat)
    }
  }, [roomCode, multiplayerState, playerId, currentGuess])

  const updateGameState = (data: any) => {
    if (data.gameState) {
      setGuesses(data.gameState.guesses || [])
      setGameStatus(data.gameState.gameStatus || 'playing')
      setLetterStates(data.gameState.letterStates || {})
    }
    // Update players list for leaderboard
    if (data.players && Array.isArray(data.players)) {
      setPlayers(data.players)
    }
    // Update ready players
    if (data.readyPlayers && Array.isArray(data.readyPlayers)) {
      setReadyPlayers(data.readyPlayers)
    }
    // Update target word if game is finished or new game started
    if (data.targetWord) {
      setTargetWord(data.targetWord)
      // If new game started, reset local state
      if (data.allPlayersReady && data.gameState?.gameStatus === 'playing') {
        setCurrentGuess('')
        setGuesses([])
        setGameStatus('playing')
        setLetterStates({})
        setErrorMessage('')
        setIsReadyForNewGame(false)
      }
    }
  }

  const startPolling = (code: string) => {
    // Clear any existing polling interval or subscription
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe()
      subscriptionRef.current = null
    }

    // Try to use Supabase real-time if configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      // Set up real-time subscription for room changes
      const roomSubscription = supabaseClient
        .channel(`room:${code}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${code}`
          },
          async () => {
            // Room changed, fetch updated state
            try {
              const response = await fetch(`/api/rooms/${code}`)
              const data = await response.json()
              if (response.ok) {
                updateGameState(data)
              }
            } catch (error) {
              console.error('Failed to fetch room state:', error)
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'players',
            filter: `room_id=eq.${code}`
          },
          async () => {
            // Players changed, fetch updated state
            try {
              const response = await fetch(`/api/rooms/${code}`)
              const data = await response.json()
              if (response.ok) {
                updateGameState(data)
              }
            } catch (error) {
              console.error('Failed to fetch room state:', error)
            }
          }
        )
        .subscribe()

      subscriptionRef.current = roomSubscription

      // Also do an initial fetch
      fetch(`/api/rooms/${code}`)
        .then(res => res.json())
        .then(data => {
          if (data.gameState) {
            updateGameState(data)
          }
        })
        .catch(err => console.error('Initial fetch failed:', err))
    } else {
      // Fallback to polling if Supabase not configured
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/rooms/${code}`)
          const data = await response.json()
          if (response.ok) {
            updateGameState(data)
          }
        } catch (error) {
          console.error('Failed to poll room state:', error)
        }
      }, 1000) // Poll every second
      setPollingInterval(interval)
    }
  }

  const handleNewGameMultiplayer = async () => {
    if (!roomCode) return
    
    const newReadyState = !isReadyForNewGame
    setIsReadyForNewGame(newReadyState)
    
    try {
      await fetch(`/api/rooms/${roomCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          readyForNewGame: newReadyState
        })
      })
    } catch (error) {
      console.error('Failed to update ready state:', error)
      setIsReadyForNewGame(!newReadyState) // Revert on error
    }
  }

  // Debug: Log state changes
  useEffect(() => {
    if (roomCode && multiplayerState === 'playing') {
      console.log('Multiplayer game state:', {
        isSinglePlayerMode,
        multiplayerState,
        roomCode,
        playersCount: players.length,
        targetWord: targetWord ? 'set' : 'missing',
        gameStatus
      })
    }
  }, [isSinglePlayerMode, multiplayerState, roomCode, players.length, targetWord, gameStatus])

  // Cleanup polling/subscription on unmount and notify server if leaving multiplayer room
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
      // Notify server when component unmounts (user navigates away)
      if (roomCode && multiplayerState === 'playing' && playerId) {
        fetch(`/api/rooms/${roomCode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, leaving: true })
        }).catch(err => console.error('Failed to notify leave on unmount:', err))
      }
    }
  }, [pollingInterval, roomCode, multiplayerState, playerId])

  if (!project) {
    return (
      <main className={styles.main}>
        <AnimatedGridPattern className={styles.gridPattern} />
        <div className={styles.container}>
          <div className={styles.notFound}>
            <h1>PROJECT NOT FOUND</h1>
            <button onClick={() => router.push('/')} className={styles.backButton}>
              RETURN TO LAUNCHPAD
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      <AnimatedGridPattern className={styles.gridPattern} />
      <div className={styles.container}>
        <header className={styles.projectHeader}>
          <div className={styles.headerContent}>
            <div className={styles.headerTop}>
              <button 
                onClick={() => {
                  playSound(440, 0.15, 'square')
                  router.push('/')
                }} 
                className={styles.backButtonTop}
                onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
              >
                ← BACK TO LAUNCHPAD
              </button>
              <div className={styles.titleContainer}>
                <h1 className={styles.headerTitle}>{project.name}</h1>
                {project.isNew && (
                  <div className={styles.headerNewTag}>
                    NEW
                  </div>
                )}
              </div>
            </div>
            <div className={styles.decorativeLine}></div>
          </div>
        </header>

        <div className={styles.projectPage}>

          <div className={`${styles.projectContent} ${isSinglePlayerMode ? styles.singlePlayerMode : ''}`}>
            {!isSinglePlayerMode ? (
              <>
                {project.icon && (
                  <div className={styles.iconContainer}>
                    <img 
                      src={project.icon} 
                      alt={project.name}
                      className={styles.icon}
                    />
                  </div>
                )}

                <div className={styles.projectInfo}>

                  <div className={styles.meta}>
                    <span className={styles.category}>{project.category}</span>
                    <span className={styles.separator}>•</span>
                    <span className={styles.status}>{project.status.toUpperCase()}</span>
                    {project.lastUpdate && (
                      <>
                        <span className={styles.separator}>•</span>
                        <span className={styles.lastUpdate}>UPDATED: {project.lastUpdate}</span>
                      </>
                    )}
                  </div>

                  {project.description && (
                    <p className={styles.description}>{project.description}</p>
                  )}

                  <div className={`${styles.roomButtons} ${isAnimating ? styles.animating : ''}`}>
                    {!isMultiplayerMode ? (
                      <>
                        <button 
                          className={styles.roomButton}
                          onClick={handleSinglePlayerClick}
                          onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
                        >
                          SINGLE PLAYER
                        </button>
                        <button 
                          className={styles.roomButton}
                          onClick={handleMultiplayerClick}
                          onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
                        >
                          MULTIPLAYER
                        </button>
                      </>
                    ) : (
                      <>
                        {multiplayerState === 'host-join' ? (
                          <>
                            <button 
                              className={`${styles.roomButton} ${styles.animateIn}`}
                              onClick={handleHostGame}
                              onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
                            >
                              HOST GAME
                            </button>
                            <button 
                              className={`${styles.roomButton} ${styles.animateIn}`}
                              onClick={handleJoinGame}
                              onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
                            >
                              JOIN GAME
                            </button>
                            <button 
                              className={`${styles.backButtonSmall} ${styles.animateIn}`}
                              onClick={handleBackClick}
                              onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
                            >
                              ← BACK
                            </button>
                          </>
                        ) : multiplayerState === 'hosting' ? (
                          <>
                            <div className={styles.nicknameContainer}>
                              <input
                                type="text"
                                className={styles.nicknameInput}
                                placeholder="ENTER YOUR NICKNAME"
                                maxLength={20}
                                onChange={(e) => {
                                  const newValue = e.target.value
                                  // Play sound when typing (only if value increased)
                                  if (newValue.length > nickname.length) {
                                    playSound(440, 0.05, 'sine') // Short typing sound
                                  }
                                  setNickname(newValue)
                                }}
                                value={nickname}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && nickname.trim()) {
                                    handleCreateRoom()
                                  }
                                }}
                              />
                              <button 
                                className={styles.roomButton}
                                onClick={handleCreateRoom}
                                onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
                                disabled={!nickname.trim()}
                              >
                                CREATE ROOM
                              </button>
                              <button 
                                className={styles.backButtonSmall}
                                onClick={() => {
                                  playSound(440, 0.15, 'square')
                                  setMultiplayerState('host-join')
                                  setNickname('')
                                }}
                                onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
                              >
                                ← BACK
                              </button>
                            </div>
                          </>
                        ) : multiplayerState === 'joining' ? (
                          <>
                            <div className={styles.joinRoomContainer}>
                              <input
                                type="text"
                                className={styles.nicknameInput}
                                placeholder="ENTER YOUR NICKNAME"
                                maxLength={20}
                                onChange={(e) => {
                                  const newValue = e.target.value
                                  // Play sound when typing (only if value increased)
                                  if (newValue.length > nickname.length) {
                                    playSound(440, 0.05, 'sine') // Short typing sound
                                  }
                                  setNickname(newValue)
                                }}
                                value={nickname}
                                autoFocus
                              />
                              <input
                                type="text"
                                className={styles.roomCodeInput}
                                placeholder="ENTER ROOM CODE"
                                maxLength={6}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                value={roomCode}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && roomCode.length === 6 && nickname.trim()) {
                                    handleJoinRoom(roomCode)
                                  }
                                }}
                              />
                              <button 
                                className={styles.roomButton}
                                onClick={() => handleJoinRoom(roomCode)}
                                onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
                                disabled={roomCode.length !== 6 || !nickname.trim()}
                              >
                                JOIN
                              </button>
                              <button 
                                className={styles.backButtonSmall}
                                onClick={() => {
                                  playSound(440, 0.15, 'square')
                                  setMultiplayerState('host-join')
                                  setRoomCode('')
                                  setNickname('')
                                }}
                                onMouseEnter={() => playSound(523.25, 0.08, 'sine')}
                              >
                                ← BACK
                              </button>
                            </div>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>

                  {project.status === 'active' && project.url && project.url !== '#' && (
                    <a 
                      href={project.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles.launchButton}
                    >
                      LAUNCH PROJECT →
                    </a>
                  )}

                  {project.status === 'coming-soon' && (
                    <div className={styles.comingSoon}>
                      <p>COMING SOON</p>
                      <p className={styles.comingSoonSubtext}>This project is currently under development</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={`${styles.gameContainer} ${roomCode && multiplayerState === 'playing' ? styles.multiplayerLayout : ''}`}>
                {(() => {
                  console.log('Rendering game container:', {
                    isSinglePlayerMode,
                    roomCode,
                    multiplayerState,
                    hasTargetWord: !!targetWord,
                    playersCount: players.length
                  })
                  return null
                })()}
                {roomCode && multiplayerState === 'playing' ? (
                  <>
                    <div className={styles.leaderboardContainer}>
                      <div 
                        className={styles.roomCodeDisplay}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(roomCode)
                            playSound(523.25, 0.1, 'sine') // Success sound
                            // Show brief feedback
                            const originalText = document.querySelector(`.${styles.roomCodeDisplay}`)?.textContent
                            const display = document.querySelector(`.${styles.roomCodeDisplay}`) as HTMLElement
                            if (display) {
                              display.textContent = 'COPIED!'
                              setTimeout(() => {
                                if (display) {
                                  display.textContent = originalText || `ROOM: ${roomCode} ${isHost ? '(HOST)' : ''}`
                                }
                              }, 1000)
                            }
                          } catch (err) {
                            console.error('Failed to copy:', err)
                            playSound(200, 0.1, 'square') // Error sound
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                        title="Click to copy room code"
                      >
                        ROOM: {roomCode} {isHost ? '(HOST)' : ''}
                      </div>
                      <div className={styles.leaderboard}>
                        <div className={styles.leaderboardTitle}>LEADERBOARD</div>
                        <div className={styles.leaderboardList}>
                          {players
                            .sort((a, b) => {
                              // Sort by: won > lost > playing, then by wordsGuessed (more is better)
                              if (a.status === 'won' && b.status !== 'won') return -1
                              if (b.status === 'won' && a.status !== 'won') return 1
                              if (a.status === 'lost' && b.status !== 'lost') return 1
                              if (b.status === 'lost' && a.status !== 'lost') return -1
                              return (b.wordsGuessed || 0) - (a.wordsGuessed || 0)
                            })
                            .map((player) => (
                              <div 
                                key={player.id} 
                                className={`${styles.leaderboardItem} ${player.id === playerId ? styles.currentPlayer : ''} ${player.status === 'won' ? styles.winner : ''}`}
                              >
                              <span className={styles.playerNickname}>{player.nickname}</span>
                              <span className={styles.playerStats}>
                                {player.status === 'won' ? '✓' : player.status === 'lost' ? '✗' : '...'} {player.wordsGuessed || 0}
                              </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                    <div className={styles.gameContent}>
                      <div className={styles.gameBoard}>
                  {Array.from({ length: 6 }).map((_, rowIndex) => {
                    const guess = guesses[rowIndex]
                    const isCurrentRow = rowIndex === guesses.length
                    const displayWord = guess ? guess.word : (isCurrentRow ? currentGuess : '')
                    const isEvaluated = guess !== undefined
                    
                    // Get other players' ghost guesses for this row (only show on current row)
                    const otherPlayersGhosts = isCurrentRow && !isEvaluated 
                      ? players
                          .filter(p => p.id !== playerId && p.currentGuess && p.currentGuess.length > 0)
                          .map(p => ({ player: p, guess: p.currentGuess || '' }))
                      : []
                    
                    return (
                      <div key={rowIndex} className={styles.gameRowContainer}>
                        <div className={styles.gameRow}>
                          {Array.from({ length: 5 }).map((_, colIndex) => {
                            const letter = displayWord[colIndex] || ''
                            const state = guess ? guess.states[colIndex] : ''
                            const isFilled = letter !== ''
                            
                            // Get ghost letters for this cell from other players
                            const ghostLetters = otherPlayersGhosts
                              .map(({ player, guess }) => ({
                                player: player.nickname,
                                letter: guess[colIndex] || ''
                              }))
                              .filter(g => g.letter)
                            
                            return (
                              <div 
                                key={colIndex} 
                                className={`${styles.gameCell} ${isFilled ? styles.filled : ''} ${state ? styles[state] : ''}`}
                                style={isEvaluated ? { animationDelay: `${colIndex * 0.1}s` } : {}}
                              >
                                {letter}
                                {/* Show ghost overlay if other players are typing in this cell */}
                                {ghostLetters.length > 0 && (
                                  <div className={styles.ghostOverlay}>
                                    {ghostLetters.map((g, idx) => (
                                      <div key={idx} className={styles.ghostLetter} title={g.player}>
                                        {g.letter}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                        })}
                      </div>
                      {errorMessage && (
                        <div className={styles.errorMessage}>
                          {errorMessage}
                        </div>
                      )}
                      {gameStatus === 'won' && (
                        <div className={styles.gameMessage}>
                          YOU WON!
                          <button 
                            className={`${styles.newGameButton} ${isReadyForNewGame ? styles.readyButton : ''}`}
                            onClick={handleNewGameMultiplayer}
                          >
                            {isReadyForNewGame ? 'READY' : 'NEW GAME'}
                          </button>
                          {readyPlayers.length > 0 && (
                            <div className={styles.readyStatus}>
                              {readyPlayers.length}/{players.length} READY
                            </div>
                          )}
                        </div>
                      )}
                      {gameStatus === 'lost' && (
                        <div className={styles.gameMessage}>
                          THE WORD WAS: {targetWord}
                          <button 
                            className={`${styles.newGameButton} ${isReadyForNewGame ? styles.readyButton : ''}`}
                            onClick={handleNewGameMultiplayer}
                          >
                            {isReadyForNewGame ? 'READY' : 'NEW GAME'}
                          </button>
                          {readyPlayers.length > 0 && (
                            <div className={styles.readyStatus}>
                              {readyPlayers.length}/{players.length} READY
                            </div>
                          )}
                        </div>
                      )}
                      <div className={styles.gameKeyboard}>
                        <div className={styles.keyboardRow}>
                          {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key) => (
                            <button 
                              key={key} 
                              className={`${styles.keyButton} ${letterStates[key] ? styles[letterStates[key]] : ''}`}
                              onClick={() => handleKeyPress(key)}
                            >
                              {key}
                            </button>
                          ))}
                        </div>
                        <div className={styles.keyboardRow}>
                          {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key) => (
                            <button 
                              key={key} 
                              className={`${styles.keyButton} ${letterStates[key] ? styles[letterStates[key]] : ''}`}
                              onClick={() => handleKeyPress(key)}
                            >
                              {key}
                            </button>
                          ))}
                        </div>
                        <div className={styles.keyboardRow}>
                          <button 
                            className={`${styles.keyButton} ${styles.specialKey}`}
                            onClick={() => handleKeyPress('ENTER')}
                          >
                            ENTER
                          </button>
                          {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key) => (
                            <button 
                              key={key} 
                              className={`${styles.keyButton} ${letterStates[key] ? styles[letterStates[key]] : ''}`}
                              onClick={() => handleKeyPress(key)}
                            >
                              {key}
                            </button>
                          ))}
                          <button 
                            className={`${styles.keyButton} ${styles.specialKey}`}
                            onClick={() => handleKeyPress('BACKSPACE')}
                          >
                            ⌫
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className={styles.emptySection}></div>
                  </>
                ) : (
                  <div className={styles.gameContent}>
                    <div className={styles.modeSwitchContainer}>
                      <button 
                        className={`${styles.modeSwitch} ${gameMode === 'daily' ? styles.active : ''}`}
                        onClick={() => setGameMode('daily')}
                      >
                        DAILY CHALLENGE
                      </button>
                      <button 
                        className={`${styles.modeSwitch} ${gameMode === 'infinite' ? styles.active : ''}`}
                        onClick={() => setGameMode('infinite')}
                      >
                        INFINITE
                      </button>
                    </div>
                    <div className={styles.gameBoard}>
                      {Array.from({ length: 6 }).map((_, rowIndex) => {
                        const guess = guesses[rowIndex]
                        const isCurrentRow = rowIndex === guesses.length && currentGuess.length > 0
                        const displayWord = guess ? guess.word : (isCurrentRow ? currentGuess : '')
                        const isEvaluated = guess !== undefined
                        
                        return (
                          <div key={rowIndex} className={styles.gameRow}>
                            {Array.from({ length: 5 }).map((_, colIndex) => {
                              const letter = displayWord[colIndex] || ''
                              const state = guess ? guess.states[colIndex] : ''
                              const isFilled = letter !== ''
                              
                              return (
                                <div 
                                  key={colIndex} 
                                  className={`${styles.gameCell} ${isFilled ? styles.filled : ''} ${state ? styles[state] : ''}`}
                                  style={isEvaluated ? { animationDelay: `${colIndex * 0.1}s` } : {}}
                                >
                                  {letter}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                    {errorMessage && (
                      <div className={styles.errorMessage}>
                        {errorMessage}
                      </div>
                    )}
                    {gameStatus === 'won' && (
                      <div className={styles.gameMessage}>
                        YOU WON!
                        {gameMode === 'infinite' && (
                          <button className={styles.newGameButton} onClick={handleNewGame}>
                            NEW GAME
                          </button>
                        )}
                      </div>
                    )}
                    {gameStatus === 'lost' && (
                      <div className={styles.gameMessage}>
                        THE WORD WAS: {targetWord}
                        {gameMode === 'infinite' && (
                          <button className={styles.newGameButton} onClick={handleNewGame}>
                            NEW GAME
                          </button>
                        )}
                      </div>
                    )}
                    <div className={styles.gameKeyboard}>
                      <div className={styles.keyboardRow}>
                        {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key) => (
                          <button 
                            key={key} 
                            className={`${styles.keyButton} ${letterStates[key] ? styles[letterStates[key]] : ''}`}
                            onClick={() => handleKeyPress(key)}
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                      <div className={styles.keyboardRow}>
                        {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key) => (
                          <button 
                            key={key} 
                            className={`${styles.keyButton} ${letterStates[key] ? styles[letterStates[key]] : ''}`}
                            onClick={() => handleKeyPress(key)}
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                      <div className={styles.keyboardRow}>
                        <button 
                          className={`${styles.keyButton} ${styles.specialKey}`}
                          onClick={() => handleKeyPress('ENTER')}
                        >
                          ENTER
                        </button>
                        {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key) => (
                          <button 
                            key={key} 
                            className={`${styles.keyButton} ${letterStates[key] ? styles[letterStates[key]] : ''}`}
                            onClick={() => handleKeyPress(key)}
                          >
                            {key}
                          </button>
                        ))}
                        <button 
                          className={`${styles.keyButton} ${styles.specialKey}`}
                          onClick={() => handleKeyPress('BACKSPACE')}
                        >
                          ⌫
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

