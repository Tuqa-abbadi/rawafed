'use client'

import dynamic from 'next/dynamic'

// The whole 3D experience is client-only (WebGL) and is never rendered on the server.
const Experience = dynamic(() => import('./Experience'), {
  ssr: false,
  loading: () => null, // the page itself shows the sky + logo + progress line (page.tsx)
})

export default function ExperienceClient() {
  return <Experience />
}
