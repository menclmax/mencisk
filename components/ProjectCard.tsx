'use client'

import { useRouter } from 'next/navigation'
import { Project } from './Launchpad'
import styles from './ProjectCard.module.css'

interface ProjectCardProps {
  project: Project
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()

  const handleClick = () => {
    if (project.status === 'active') {
      router.push(`/project/${project.id}`)
    }
  }

  return (
    <div
      className={`${styles.card} ${
        project.status === 'coming-soon' ? styles.comingSoon : ''
      } ${project.status === 'active' ? styles.active : ''}`}
      onClick={handleClick}
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

