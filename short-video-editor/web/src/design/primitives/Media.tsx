import { Film, Image as ImageIcon, Lock, Music, Upload } from 'lucide-react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { formatDuration } from '../format'
import { Badge } from './Button'

export function ProgressBar({ label, value, indeterminate = false, detail }: { label: string; value?: number; indeterminate?: boolean; detail?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value ?? 0)) * 100)
  return (
    <div className="progress" data-indeterminate={indeterminate}>
      <div className="progress-head">
        <span>{label}</span>
        <span className="mono">{indeterminate ? detail ?? '' : `${pct}%`}</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
        aria-valuetext={indeterminate ? detail : undefined}
      >
        <div className="progress-bar" style={indeterminate ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  )
}

export interface DropzoneProps {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  title?: string
  hint?: string
  error?: string
}

/**
 * Drag-and-drop or click/Enter to browse (S02, S04). A real <input type=file>
 * sits behind it so keyboard and screen-reader users get the native picker.
 */
export function Dropzone({ accept, multiple = true, onFiles, title = 'Drop videos, photos or audio', hint = 'or click to browse', error }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const take = (list: FileList | null) => {
    if (list && list.length) onFiles(Array.from(list))
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    take(e.dataTransfer.files)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <div
      className="dropzone"
      role="button"
      tabIndex={0}
      aria-describedby={error ? 'dropzone-error' : undefined}
      data-state={error ? 'error' : dragOver ? 'drag-over' : 'idle'}
      onClick={() => inputRef.current?.click()}
      onKeyDown={onKeyDown}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <Upload size={28} aria-hidden="true" />
      <div>
        <div className="dropzone-title">{title}</div>
        <div>{hint}</div>
      </div>
      {error && (
        <div id="dropzone-error" className="field-error" role="alert">
          {error}
        </div>
      )}
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => take(e.target.files)} />
    </div>
  )
}

export type AssetKind = 'video' | 'image' | 'audio'

export interface AssetCardProps {
  name: string
  kind: AssetKind
  durationMs?: number
  thumbnail?: string
  selected?: boolean
  loading?: boolean
  /** Template/effect gated by plan. Shown, not hidden: the user decides before adding (no export hostage). */
  locked?: boolean
  onActivate?: () => void
  badge?: ReactNode
}

const kindIcon = { video: Film, image: ImageIcon, audio: Music }

/** Grid card for media, effects, transitions, templates (S04–S11). */
export function AssetCard({ name, kind, durationMs, thumbnail, selected, loading, locked, onActivate, badge }: AssetCardProps) {
  const Icon = kindIcon[kind]
  const status = loading ? ', importing' : locked ? ', requires upgrade' : ''
  return (
    <button
      type="button"
      className="asset-card"
      aria-pressed={selected}
      aria-label={`${name}${durationMs != null ? `, ${formatDuration(durationMs)}` : ''}${status}`}
      data-loading={loading}
      disabled={loading}
      onClick={onActivate}
    >
      <div className="asset-thumb">
        {thumbnail && !loading ? (
          <img src={thumbnail} alt="" draggable={false} />
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--color-text-subtle)' }}>
            {!loading && <Icon size={24} aria-hidden="true" />}
          </div>
        )}
        {locked && (
          <span className="asset-badge">
            <Badge tone="pro">
              <Lock size={10} aria-hidden="true" /> Pro
            </Badge>
          </span>
        )}
        {!locked && badge && <span className="asset-badge">{badge}</span>}
        {durationMs != null && !loading && <span className="asset-duration">{formatDuration(durationMs)}</span>}
      </div>
      <span className="asset-name">{name}</span>
    </button>
  )
}
