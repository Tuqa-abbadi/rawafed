import ExperienceClient from '@/components/ExperienceClient'

export default function Page() {
  return (
    <>
      <main className="stage">
        <ExperienceClient />
      </main>
      {/* first paint, no JavaScript needed: a warm golden sky and the ONE Rawafed logo. The same
          logo stays exactly in its hero place (no intro animation); a thin gold line shows
          loading progress (Experience: LoadLine). No separate loading screen. */}
      <div className="intro-sky" id="intro-sky" role="status" aria-live="polite">
        <span className="intro-loading">جارٍ التحميل · Loading</span>
      </div>
      <div className="intro-logo" id="intro-logo">
        <span className="brand-logo brand-logo--metal" style={{ ['--logo-w' as string]: '150px' }} role="img" aria-label="روافد — Rawafed" lang="ar" />
      </div>
      <div className="intro-progress" id="intro-progress" aria-hidden="true">
        <i />
      </div>
      {/* invisible scroll track: its scroll progress drives the landing story (StoryScroll) */}
      <div className="story-track" aria-hidden="true" />
    </>
  )
}
