'use client'

import { useEffect, useState, useRef } from 'react'
import styles from './CustomCursor.module.css'

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [isClicking, setIsClicking] = useState(false)
  const [velocity, setVelocity] = useState(0)
  const prevPositionRef = useRef({ x: 0, y: 0, time: Date.now() })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      const prev = prevPositionRef.current
      
      // Calculate distance moved
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      // Calculate time delta (in seconds)
      const timeDelta = (now - prev.time) / 1000
      
      // Calculate velocity (pixels per second)
      const currentVelocity = timeDelta > 0 ? distance / timeDelta : 0
      
      // Update velocity with smoothing
      setVelocity(prev => {
        // Exponential smoothing for smoother transitions
        return prev * 0.7 + currentVelocity * 0.3
      })
      
      // Update position
      setPosition({ x: e.clientX, y: e.clientY })
      
      // Update previous position and time
      prevPositionRef.current = { x: e.clientX, y: e.clientY, time: now }
      
      const target = e.target as HTMLElement
      const isInteractive = 
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.tagName === 'INPUT' ||
        target.onclick !== null ||
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('[class*="card"]') ||
        target.closest('[class*="button"]')
      
      setIsHovering(!!isInteractive)
    }

    const handleMouseDown = () => setIsClicking(true)
    const handleMouseUp = () => setIsClicking(false)

    // Decay velocity when mouse stops moving
    const velocityDecay = setInterval(() => {
      setVelocity(prev => prev * 0.9)
    }, 50)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)

    // Hide default cursor
    document.body.style.cursor = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      clearInterval(velocityDecay)
      document.body.style.cursor = 'auto'
    }
  }, [])

  // Calculate scale based on velocity
  // Max velocity around 2000px/s, scale from 1 to 2.5
  const maxVelocity = 2000
  const minScale = 1
  const maxScale = 2.5
  const velocityScale = Math.min(1 + (velocity / maxVelocity) * (maxScale - minScale), maxScale)
  
  // Combine with hover and click states
  let finalScale = velocityScale
  if (isClicking) {
    finalScale = velocityScale * 0.8
  } else if (isHovering) {
    finalScale = Math.max(velocityScale, 1.5)
  }

  return (
    <div
      className={`${styles.cursor} ${isHovering ? styles.hover : ''} ${isClicking ? styles.clicking : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `translate(-50%, -50%) scale(${finalScale})`,
      }}
    >
      <div className={styles.cursorInner}></div>
      <div className={styles.cursorOuter}></div>
      {isHovering && <div className={styles.cursorGlow}></div>}
    </div>
  )
}

