'use client'

import { useEffect, useRef, useState, createContext } from 'react'

// Create context for audio controls
export const AudioControlContext = createContext<{
  toggleMute: () => void
  isMuted: boolean
} | null>(null)

// Global audio ref to share between components
let globalAudioRef: HTMLAudioElement | null = null
let globalSetIsMuted: ((muted: boolean) => void) | null = null

export const getAudioControl = () => {
  return {
    toggleMute: () => {
      if (globalAudioRef) {
        globalAudioRef.muted = !globalAudioRef.muted
        if (globalSetIsMuted) {
          globalSetIsMuted(globalAudioRef.muted)
        }
      }
    },
    isMuted: globalAudioRef?.muted || false
  }
}

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isMuted, setIsMuted] = useState(false)

  const toggleMute = () => {
    const audio = audioRef.current
    if (audio) {
      audio.muted = !audio.muted
      setIsMuted(audio.muted)
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Set global references
    globalAudioRef = audio
    globalSetIsMuted = setIsMuted

    // Start with muted to bypass autoplay restrictions, then unmute
    audio.muted = true
    audio.volume = 0.3
    setIsMuted(true)

    // Try to play immediately (muted autoplay is usually allowed)
    const playAudio = () => {
      audio.play().then(() => {
        // Once playing, unmute it
        audio.muted = false
        setIsMuted(false)
      }).catch((err) => {
        // If still blocked, try unmuted on first interaction
        const handleUserInteraction = () => {
          if (audio && audioRef.current) {
            audio.muted = false
            setIsMuted(false)
            audio.play().catch(() => {
              // Silently fail if still blocked
            })
          }
          // Remove listeners safely
          try {
            document.removeEventListener('click', handleUserInteraction)
            document.removeEventListener('keydown', handleUserInteraction)
            document.removeEventListener('touchstart', handleUserInteraction)
          } catch (e) {
            // Silently fail if already removed
          }
        }
        
        // Add listeners with { once: true } so they auto-remove
        document.addEventListener('click', handleUserInteraction, { once: true })
        document.addEventListener('keydown', handleUserInteraction, { once: true })
        document.addEventListener('touchstart', handleUserInteraction, { once: true })
      })
    }

    // Try to play immediately
    playAudio()

    // Also try when audio is ready
    const handleCanPlay = () => {
      playAudio()
    }
    audio.addEventListener('canplaythrough', handleCanPlay, { once: true })

    return () => {
      // Cleanup: remove event listeners and clear global references
      if (audio && audio.removeEventListener) {
        try {
          audio.removeEventListener('canplaythrough', handleCanPlay)
        } catch (e) {
          // Silently fail if audio is already removed
        }
      }
      // Clear global references on unmount
      if (globalAudioRef === audio) {
        globalAudioRef = null
        globalSetIsMuted = null
      }
    }
  }, [])

  // Update isMuted when audio muted state changes externally
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const checkMuted = () => {
      if (audio && audioRef.current) {
        setIsMuted(audio.muted)
      }
    }

    // Check muted state periodically
    const interval = setInterval(checkMuted, 100)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <audio
      ref={audioRef}
      loop
      autoPlay
      preload="auto"
    >
      <source src="/King Dedede - Kirby's Dream Land 3 OST.mp3" type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  )
}

