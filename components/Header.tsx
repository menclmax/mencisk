'use client'

import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>
          MencLAB
        </h1>
      </div>
      <div className={styles.decorativeLine}></div>
    </header>
  )
}

