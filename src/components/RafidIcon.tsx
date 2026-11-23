'use client'

/** Line icons for the four روافد (labels, nav, panels). */
export function RafidIcon({ name }: { name: 'mic' | 'book' | 'cap' | 'people' | 'home' }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {name === 'mic' && (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" {...p} />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...p} />
        </>
      )}
      {name === 'home' && <path d="M4 11.2 12 4.5l8 6.7M6.2 9.6V19.5h4.3v-5.2h3v5.2h4.3V9.6" {...p} />}
      {name === 'book' && <path d="M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5zM12 6.5v13" {...p} />}
      {name === 'cap' && <path d="M2.5 9.5 12 5l9.5 4.5L12 14zM6.5 11.5v4.2c3 2.4 8 2.4 11 0v-4.2M21.5 9.5v5" {...p} />}
      {name === 'people' && (
        <>
          <circle cx="9" cy="8.5" r="3" {...p} />
          <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15.5 5.8a3 3 0 0 1 0 5.4M17 14.3c1.9.6 3.1 2.2 3.5 4.7" {...p} />
        </>
      )}
    </svg>
  )
}
