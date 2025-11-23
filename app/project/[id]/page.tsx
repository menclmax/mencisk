'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { projects, Project } from '@/components/Launchpad'
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import { WORDS } from '@/lib/words'
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

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [isMultiplayerMode, setIsMultiplayerMode] = useState(false)
  const [isSinglePlayerMode, setIsSinglePlayerMode] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [gameMode, setGameMode] = useState<'daily' | 'infinite'>('daily')
  
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
        setCurrentGuess('')

        // Update letter states for keyboard
        const newLetterStates = { ...letterStates }
        currentGuess.split('').forEach((letter, i) => {
          const existing = newLetterStates[letter]
          if (!existing || states[i] === 'correct' || (states[i] === 'present' && existing !== 'correct')) {
            newLetterStates[letter] = states[i]
          }
        })
        setLetterStates(newLetterStates)

        // Check win/lose
        if (currentGuess === targetWord) {
          setGameStatus('won')
        } else if (newGuesses.length >= 6) {
          setGameStatus('lost')
        }
      }
    } else if (key === 'BACKSPACE' || key === '⌫') {
      setCurrentGuess(prev => prev.slice(0, -1))
      setErrorMessage('')
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key)
      setErrorMessage('')
    }
  }, [currentGuess, targetWord, guesses, gameStatus, isSinglePlayerMode, letterStates])

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
    setIsSinglePlayerMode(true)
  }

  const handleMultiplayerClick = () => {
    setIsAnimating(true)
    setTimeout(() => {
      setIsMultiplayerMode(true)
      setIsAnimating(false)
    }, 300)
  }

  const handleBackClick = () => {
    setIsAnimating(true)
    setTimeout(() => {
      setIsMultiplayerMode(false)
      setIsAnimating(false)
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
              <button onClick={() => router.push('/')} className={styles.backButtonTop}>
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
                        >
                          SINGLE PLAYER
                        </button>
                        <button 
                          className={styles.roomButton}
                          onClick={handleMultiplayerClick}
                        >
                          MULTIPLAYER
                        </button>
                      </>
                    ) : (
                      <>
                        <button className={`${styles.roomButton} ${styles.animateIn}`}>
                          HOST GAME
                        </button>
                        <button className={`${styles.roomButton} ${styles.animateIn}`}>
                          JOIN GAME
                        </button>
                        <button 
                          className={`${styles.backButtonSmall} ${styles.animateIn}`}
                          onClick={handleBackClick}
                        >
                          ← BACK
                        </button>
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
              <div className={styles.gameContainer}>
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
        </div>
      </div>
    </main>
  )
}

