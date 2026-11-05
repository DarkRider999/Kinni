import * as RTabs from '@radix-ui/react-tabs'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { formatDuration } from '../format'

export type ClipKind = 'video' | 'image' | 'audio' | 'text' | 'caption'

export interface TimelineClipProps {
  kind: ClipKind
  label: string
  startMs: number
  durationMs: number
  /** Pixels per second at the current zoom. */
  pxPerSec: number
  selected?: boolean
  muted?: boolean
  /** Normalised 0..1 peaks for audio clips; drawn as a light waveform. */
  peaks?: number[]
  onSelect?: () => void
  /** Keyboard nudge: ←/→ moves by one frame, Shift by one second. Handled by the timeline. */
  onNudge?: (deltaMs: number) => void
  frameMs?: number
}

/**
 * Presentational clip block (S03). Positioning and drag/trim gestures live
 * in the timeline; this owns look, states and keyboard semantics.
 */
export function TimelineClip({ kind, label, startMs, durationMs, pxPerSec, selected, muted, peaks, onSelect, onNudge, frameMs = 1000 / 30 }: TimelineClipProps) {
  const style: CSSProperties = {
    position: 'absolute',
    left: (startMs / 1000) * pxPerSec,
    width: Math.max(12, (durationMs / 1000) * pxPerSec),
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (!onNudge) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const dir = e.key === 'ArrowLeft' ? -1 : 1
      onNudge(dir * (e.shiftKey ? 1000 : frameMs))
    }
  }
  return (
    <div
      className="clip"
      role="option"
      tabIndex={selected ? 0 : -1}
      aria-selected={selected}
      aria-label={`${kind} clip ${label}, starts ${formatDuration(startMs, true)}, length ${formatDuration(durationMs, true)}${muted ? ', muted' : ''}`}
      data-kind={kind}
      data-muted={muted}
      style={style}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <span className="clip-handle" data-side="start" aria-hidden="true" />
      {peaks && (
        <svg className="clip-wave" viewBox={`0 0 ${peaks.length} 2`} preserveAspectRatio="none" aria-hidden="true">
          {peaks.map((p, i) => (
            <rect key={i} x={i} y={1 - p} width={0.7} height={p * 2} fill="currentColor" />
          ))}
        </svg>
      )}
      <span className="clip-label">{label}</span>
      <span className="clip-handle" data-side="end" aria-hidden="true" />
    </div>
  )
}

export interface RailItem {
  value: string
  label: string
  icon: LucideIcon
  content: ReactNode
}

/** Editor left rail (S04–S11): vertical tabs, arrow-key navigation from Radix. */
export function SideRail({ items, value, onValueChange }: { items: RailItem[]; value: string; onValueChange: (v: string) => void }) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} orientation="vertical" style={{ display: 'flex', minHeight: 0 }}>
      <RTabs.List className="rail" aria-label="Editor panels">
        {items.map(({ value: v, label, icon: Icon }) => (
          <RTabs.Trigger key={v} value={v} className="rail-item">
            <Icon size={20} aria-hidden="true" />
            {label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((i) => (
        <RTabs.Content key={i.value} value={i.value} style={{ flex: 1, minWidth: 0, padding: 'var(--space-5)' }}>
          {i.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  )
}

/** Horizontal tabs, used in the inspector (Basic / Speed / Animation / Adjust). */
export function Tabs({ label, tabs, value, onValueChange }: { label: string; tabs: { value: string; label: string; content: ReactNode }[]; value: string; onValueChange: (v: string) => void }) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange}>
      <RTabs.List className="tabs-list" aria-label={label}>
        {tabs.map((t) => (
          <RTabs.Trigger key={t.value} value={t.value} className="tabs-trigger">
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="tabs-content">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  )
}
