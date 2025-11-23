'use client'

import { useState, useEffect } from 'react'
import { getAudioControl } from './BackgroundMusic'
import styles from './MuteButton.module.css'

export default function MuteButton() {
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    // Check muted state periodically
    const interval = setInterval(() => {
      const control = getAudioControl()
      setIsMuted(control.isMuted)
    }, 100)

    return () => clearInterval(interval)
  }, [])

  const handleToggleMute = () => {
    const control = getAudioControl()
    control.toggleMute()
    setIsMuted(control.isMuted)
  }

  return (
    <button 
      className={styles.muteButton}
      onClick={handleToggleMute}
      title={isMuted ? 'Unmute' : 'Mute'}
      aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
    >
      {isMuted ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      )}
    </button>
  )
}

