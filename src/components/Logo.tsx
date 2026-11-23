/**
 * Official Rawafed logo (public/logo.svg, white artwork on transparent).
 * Rendered as a CSS mask so it can be tinted: gold on light/ivory backgrounds,
 * white or gold over the dark 3D scene. The mask is cropped to the artwork
 * (the SVG has wide padding) — see .brand-logo in globals.css.
 */
export type LogoTone = 'gold' | 'white' | 'metal'

export default function Logo({ tone = 'gold', width = 140 }: { tone?: LogoTone; width?: number }) {
  return (
    <span
      className={`brand-logo brand-logo--${tone}`}
      style={{ ['--logo-w' as string]: `${width}px` }}
      role="img"
      aria-label="روافد — Rawafed" lang="ar"
    />
  )
}
