'use client'

import { useState } from 'react'
import ProjectCard from './ProjectCard'
import styles from './Launchpad.module.css'

export interface Project {
  id: string
  name: string
  description: string
  url: string
  category: string
  status: 'active' | 'coming-soon' | 'archived'
  icon?: string // Image URL
  lastUpdate?: string
  isNew?: boolean
}

export const projects: Project[] = [
  {
    id: '1',
    name: 'WORDLE',
    description: '',
    url: '#',
    category: 'Web App',
    status: 'active',
    icon: '/Wordle_Logo.svg',
    lastUpdate: '2025-11-23',
    isNew: true
  },
  {
    id: '2',
    name: 'PROJECT TWO',
    description: 'An innovative digital experience',
    url: '#',
    category: 'Project',
    status: 'active',
    icon: 'https://via.placeholder.com/120x120/5b9bd5/0a1628?text=PROJECT+TWO',
    lastUpdate: '2024-01-10'
  },
  {
    id: '3',
    name: 'APP THREE',
    description: 'Coming soon to MencLAB',
    url: '#',
    category: 'Web App',
    status: 'coming-soon',
    icon: 'https://via.placeholder.com/120x120/5b9bd5/0a1628?text=APP+THREE',
    lastUpdate: '2024-01-05'
  },
  {
    id: '4',
    name: 'PROJECT FOUR',
    description: 'Another amazing creation',
    url: '#',
    category: 'Project',
    status: 'active',
    icon: 'https://via.placeholder.com/120x120/5b9bd5/0a1628?text=PROJECT+FOUR',
    lastUpdate: '2024-01-12'
  },
  {
    id: '5',
    name: 'APP FIVE',
    description: 'Work in progress',
    url: '#',
    category: 'Web App',
    status: 'coming-soon',
    icon: 'https://via.placeholder.com/120x120/5b9bd5/0a1628?text=APP+FIVE',
    lastUpdate: '2024-01-08'
  },
  {
    id: '6',
    name: 'PROJECT SIX',
    description: 'Experimental project',
    url: '#',
    category: 'Project',
    status: 'active',
    icon: 'https://via.placeholder.com/120x120/5b9bd5/0a1628?text=PROJECT+SIX',
    lastUpdate: '2024-01-20'
  }
]

export default function Launchpad() {
  const [searchQuery, setSearchQuery] = useState<string>('')

  const filteredProjects = projects.filter(project => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase()
    return (
      project.name.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query) ||
      project.category.toLowerCase().includes(query)
    )
  })

  return (
    <div className={styles.launchpad}>
      <div className={styles.searchContainer}>
        <input
          type="text"
          className={styles.searchBar}
          placeholder="SEARCH PROJECTS..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className={styles.grid}>
        {filteredProjects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className={styles.empty}>
          <p>NO PROJECTS FOUND</p>
        </div>
      )}
    </div>
  )
}

