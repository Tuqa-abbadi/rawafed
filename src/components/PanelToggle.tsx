'use client'

import { t } from '@/lib/i18n'

/** Hide / show a panel's details (the 3D scene behind it stays visible). */
export default function PanelToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="panel-toggle" aria-expanded={!collapsed} onClick={onToggle}>
      <span>{collapsed ? t('panel.show') : t('panel.hide')}</span>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}>
        <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/** Phones start with panels collapsed so the scene (reciter, building) is not covered. */
export const startCollapsed = () => typeof window !== 'undefined' && window.innerWidth < 700
