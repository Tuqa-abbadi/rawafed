'use client'

import { Children, Suspense, useEffect, useState, type ReactNode } from 'react'

/**
 * Mounts its children one after another (`gap` ms apart, each in its own Suspense) instead of all
 * at once, so their GPU uploads and shader compiles are spread over time: many small pauses the eye
 * does not notice instead of one long freeze. `onDone` fires when the last one is mounted.
 */
export default function Stagger({ children, gap = 450, onDone }: { children: ReactNode; gap?: number; onDone?: () => void }) {
  const list = Children.toArray(children)
  const [n, setN] = useState(1)
  useEffect(() => {
    if (n >= list.length) {
      onDone?.()
      return
    }
    const t = setTimeout(() => setN((k) => k + 1), gap)
    return () => clearTimeout(t)
  }, [n, list.length, gap, onDone])
  return (
    <>
      {list.slice(0, n).map((c, i) => (
        <Suspense key={i} fallback={null}>
          {c}
        </Suspense>
      ))}
    </>
  )
}
