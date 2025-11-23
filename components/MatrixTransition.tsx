'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './MatrixTransition.module.css'

interface MatrixTransitionProps {
  onComplete: () => void
}

export default function MatrixTransition({ onComplete }: MatrixTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    // Set canvas size to full viewport
    const resizeCanvas = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      canvas.width = width
      canvas.height = height
      // Set display size to match actual size
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Matrix characters - mix of numbers, letters, and symbols
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
    const charArray = chars.split('')

    // Column properties
    const fontSize = 14
    const columns = Math.floor(canvas.width / fontSize)
    const drops: number[] = Array(columns).fill(1)

    // Fade in
    setOpacity(1)

    // Animation
    let animationFrame: number
    let startTime = Date.now()
    const duration = 3000 // 3 seconds

    const draw = () => {
      const elapsed = Date.now() - startTime
      
      // Fade out at the end
      if (elapsed > duration - 500) {
        setOpacity(1 - (elapsed - (duration - 500)) / 500)
      }

      // Fill with semi-transparent black for trail effect
      ctx.fillStyle = 'rgba(5, 10, 20, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Set font
      ctx.font = `${fontSize}px 'Press Start 2P', monospace`
      ctx.textAlign = 'center'

      // Draw characters
      for (let i = 0; i < drops.length; i++) {
        // Random character
        const text = charArray[Math.floor(Math.random() * charArray.length)]
        
        // Bright green for head, darker for trail
        const brightness = Math.min(1, 1 - (drops[i] * fontSize) / (canvas.height * 0.5))
        const green = Math.floor(68 + brightness * 187) // 68-255 range
        ctx.fillStyle = `rgb(0, ${green}, 0)`
        
        // Draw character
        const y = drops[i] * fontSize
        ctx.fillText(text, i * fontSize + fontSize / 2, y)

        // Reset drop if it reaches bottom or randomly
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        
        // Move drop down
        drops[i]++
      }

      if (elapsed < duration) {
        animationFrame = requestAnimationFrame(draw)
      } else {
        onComplete()
      }
    }

    draw()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [onComplete])

  return (
    <div className={styles.matrixContainer} style={{ opacity }}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}

