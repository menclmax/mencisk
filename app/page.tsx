'use client'

import { useState, useEffect } from 'react'
import Launchpad from '@/components/Launchpad'
import Header from '@/components/Header'
import LockScreen from '@/components/LockScreen'
import BackgroundMusic from '@/components/BackgroundMusic'
import MuteButton from '@/components/MuteButton'
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import styles from './page.module.css'

const AUTH_KEY = 'mencisk_unlocked'

export default function Home() {
  const [unlocked, setUnlocked] = useState(false)

  // Check sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_KEY)
    if (stored === 'true') {
      setUnlocked(true)
    }
  }, [])

  const handleUnlock = () => {
    setUnlocked(true)
    sessionStorage.setItem(AUTH_KEY, 'true')
  }

  useEffect(() => {
    if (!unlocked) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUnlocked(false)
        sessionStorage.removeItem(AUTH_KEY)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [unlocked])

  if (!unlocked) {
    return <LockScreen onUnlock={handleUnlock} />
  }

  return (
    <main className={styles.main}>
      <AnimatedGridPattern className={styles.gridPattern} />
      <div className={styles.container}>
        <Header />
        <Launchpad />
      </div>
      <BackgroundMusic />
      <MuteButton />
    </main>
  )
}

