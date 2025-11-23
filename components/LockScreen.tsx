'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import styles from './LockScreen.module.css'

const PASSWORD = '1234'

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
                ref={(el) => (inputRefs.current[index] = el)}
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

