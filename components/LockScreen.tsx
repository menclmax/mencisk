'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import styles from './LockScreen.module.css'

const PASSWORD = '1234'

// Sound frequencies for each number (0-9) in Hz
const NUMBER_FREQUENCIES: Record<string, number> = {
  '0': 261.63, // C4
  '1': 277.18, // C#4
  '2': 293.66, // D4
  '3': 311.13, // D#4
  '4': 329.63, // E4
  '5': 349.23, // F4
  '6': 369.99, // F#4
  '7': 392.00, // G4
  '8': 415.30, // G#4
  '9': 440.00, // A4
}

// Play sound effect for a number
const playNumberSound = (digit: string) => {
  if (!digit || !NUMBER_FREQUENCIES[digit]) return

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = NUMBER_FREQUENCIES[digit]
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)
  } catch (error) {
    // Silently fail if Web Audio API is not supported
    console.error('Audio playback failed:', error)
  }
}

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [digits, setDigits] = useState<string[]>(['', '', '', ''])
  const [error, setError] = useState(false)
  const [success, setSuccess] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (success) {
      // Wait for success animation to complete (2 seconds), then unlock
      const timer = setTimeout(() => {
        onUnlock()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [success, onUnlock])

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newDigits = [...digits]
    newDigits[index] = value
    setDigits(newDigits)
    setError(false)

    // Play sound effect for the entered number
    if (value) {
      playNumberSound(value)
    }

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    // Check password when all 4 digits are entered
    if (newDigits.every(d => d !== '') && newDigits.join('') === PASSWORD) {
      setSuccess(true)
    } else if (newDigits.every(d => d !== '')) {
      // Wrong password
      setError(true)
      setTimeout(() => {
        setDigits(['', '', '', ''])
        setError(false)
        inputRefs.current[0]?.focus()
      }, 1000)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').slice(0, 4)
    if (/^\d{1,4}$/.test(pasted)) {
      const newDigits = pasted.split('').concat(Array(4 - pasted.length).fill(''))
      setDigits(newDigits.slice(0, 4))
      
      // Play sound effects for each pasted digit
      pasted.split('').forEach((digit, i) => {
        setTimeout(() => playNumberSound(digit), i * 50) // Stagger sounds slightly
      })
      
      if (newDigits.join('') === PASSWORD) {
        setSuccess(true)
      } else if (pasted.length === 4) {
        setError(true)
        setTimeout(() => {
          setDigits(['', '', '', ''])
          setError(false)
          inputRefs.current[0]?.focus()
        }, 1000)
      }
    }
  }

  return (
    <main className={styles.main}>
      <AnimatedGridPattern className={styles.gridPattern} />
      <div className={styles.container}>
        <div className={styles.lockContainer}>
          <h1 className={styles.title}>LOCKED</h1>
          <div className={styles.subtitle}>ENTER ACCESS CODE</div>
          <div className={styles.inputContainer}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className={`${styles.digitInput} ${error ? styles.error : ''} ${success ? styles.success : ''}`}
                autoComplete="off"
                disabled={success}
              />
            ))}
          </div>
          {error && <div className={styles.errorMessage}>ACCESS DENIED</div>}
          {success && <div className={styles.successMessage}>ACCESS GRANTED</div>}
        </div>
      </div>
    </main>
  )
}

