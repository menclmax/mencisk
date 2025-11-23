'use client'

import { useRouter } from 'next/navigation'
import { Project } from './Launchpad'
import styles from './ProjectCard.module.css'

interface ProjectCardProps {
  project: Project
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

export default function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()

  const handleClick = () => {
    // Play click sound
    playSound(440, 0.15, 'square')
    
    if (project.status === 'active') {
      router.push(`/project/${project.id}`)
    }
  }

  const handleMouseEnter = () => {
    // Play hover sound (higher pitch, shorter)
    playSound(523.25, 0.08, 'sine') // C5 note
  }

  return (
    <div
      className={`${styles.card} ${
        project.status === 'coming-soon' ? styles.comingSoon : ''
      } ${project.status === 'active' ? styles.active : ''}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {project.isNew && (
        <div className={styles.newTag}>
          NEW
        </div>
      )}
      
      {project.icon && (
        <div className={styles.iconContainer}>
          <img 
            src={project.icon} 
            alt={project.name}
            className={styles.icon}
          />
        </div>
      )}
      
      <h3 className={styles.name}>
        {project.name}
      </h3>
      
      {project.lastUpdate && (
        <div className={styles.lastUpdate}>
          UPDATED: {project.lastUpdate}
        </div>
      )}

      {project.status === 'coming-soon' && (
        <div className={styles.overlay}>
          <span>LOCKED</span>
        </div>
      )}
    </div>
  )
}

