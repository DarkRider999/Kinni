import { AudioLines, Captions, Download, Film, Scissors, Sparkles, Type, Volume2, VolumeX, Wand2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  AssetCard,
  Badge,
  Button,
  Dialog,
  Dropzone,
  IconButton,
  NumberField,
  ProgressBar,
  Select,
  SideRail,
  SliderField,
  Switch,
  Tabs,
  TimelineClip,
  useToast,
  type KeyframeState,
} from '../design/primitives'
import { tokens } from '../design/tokens'
import './gallery.css'

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} style={{ display: 'grid', gap: 'var(--space-5)', padding: 'var(--space-8) 0', borderTop: '1px solid var(--color-border)' }}>
      <header style={{ display: 'grid', gap: 'var(--space-1)' }}>
        <h2 id={id} style={{ fontSize: 'var(--text-xl-size)', lineHeight: 'var(--text-xl-line)', fontWeight: 600 }}>
          {title}
        </h2>
        {note && <p className="text-muted" style={{ fontSize: 'var(--text-sm-size)' }}>{note}</p>}
      </header>
      {children}
    </section>
  )
}

const row = { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center' } as const
const card = { padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' } as const

// Deterministic fake waveform, so screenshots are stable.
const peaks = Array.from({ length: 120 }, (_, i) => 0.25 + 0.7 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)))

export function DesignGallery() {
  const toast = useToast()
  const [scale, setScale] = useState(100)
  const [opacity, setOpacity] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [kf, setKf] = useState<KeyframeState>('has-keyframes')
  const [snap, setSnap] = useState(true)
  const [resolution, setResolution] = useState('1080')
  const [fps, setFps] = useState('30')
  const [exportOpen, setExportOpen] = useState(false)
  const [rail, setRail] = useState('media')
  const [inspectorTab, setInspectorTab] = useState('basic')
  const [selectedClip, setSelectedClip] = useState('c2')
  const [selectedAsset, setSelectedAsset] = useState('a1')
  const [muted, setMuted] = useState(false)
  const [clips, setClips] = useState([
    { id: 'c1', kind: 'video' as const, label: 'Rooftop intro', start: 0, dur: 4200 },
    { id: 'c2', kind: 'video' as const, label: 'Crowd wide', start: 4200, dur: 3600 },
    { id: 'c3', kind: 'video' as const, label: 'Drop close-up', start: 7800, dur: 5200 },
  ])
  const nudge = (id: string, delta: number) =>
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, start: Math.max(0, c.start + delta) } : c)))

  const assets = [
    { id: 'a1', name: 'rooftop_intro.mp4', kind: 'video' as const, durationMs: 14_200 },
    { id: 'a2', name: 'crowd_wide.mov', kind: 'video' as const, durationMs: 62_500 },
    { id: 'a3', name: 'set_closing.wav', kind: 'audio' as const, durationMs: 241_000 },
    { id: 'a4', name: 'poster.png', kind: 'image' as const },
  ]

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-8) var(--space-6) var(--space-10)' }}>
      <header style={{ display: 'grid', gap: 'var(--space-3)', paddingBottom: 'var(--space-6)' }}>
        <div style={row}>
          <h1 style={{ fontSize: 'var(--text-2xl-size)', lineHeight: 'var(--text-2xl-line)', fontWeight: 700 }}>Design system</h1>
          <Badge>Placeholder brand</Badge>
        </div>
        <p className="text-muted">
          Primitives for the editor, built once in isolation before any screen. Every value comes from{' '}
          <code className="mono">replica/design/tokens.json</code>. The accent is a neutral placeholder until /replica-brand.
        </p>
      </header>

      <Section id="color" title="Colour roles" note="Roles, not brand colours. Contrast is checked by contrast.py: 35 pairs, 0 AA failures.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-4)' }}>
          {Object.entries(tokens.color).map(([name, hex]) => (
            <div key={name} style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <div style={{ height: 48, borderRadius: 'var(--radius-md)', background: hex, border: '1px solid var(--color-border)' }} />
              <div style={{ fontSize: 'var(--text-xs-size)' }}>{name}</div>
              <div className="mono text-muted" style={{ fontSize: 'var(--text-2xs-size)' }}>{hex}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type" title="Type scale" note="Inter Variable (OFL), tabular figures for every timecode.">
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {Object.entries(tokens.type).map(([name, t]) => (
            <div key={name} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'baseline', gap: 'var(--space-5)' }}>
              <span className="mono text-muted" style={{ fontSize: 'var(--text-xs-size)' }}>
                {name} {t.size}/{t.line}
              </span>
              <span style={{ fontSize: t.size, lineHeight: `${t.line}px`, fontWeight: t.weight }}>Cut it on the beat</span>
            </div>
          ))}
          <div className="mono" style={{ fontSize: 'var(--text-lg-size)' }}>00:01:23.15</div>
        </div>
      </Section>

      <Section id="buttons" title="Buttons" note="Real <button>s. Loading keeps the label and sets aria-busy.">
        <div style={row}>
          <Button variant="primary" icon={<Download size={16} aria-hidden="true" />}>Export</Button>
          <Button variant="secondary">New project</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete clip</Button>
          <Button variant="primary" loading>Exporting</Button>
          <Button variant="secondary" disabled>Disabled</Button>
        </div>
        <div style={row}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg" variant="primary">Large</Button>
        </div>
        <div style={row}>
          <IconButton label="Split at playhead" shortcut="⌘B"><Scissors size={18} aria-hidden="true" /></IconButton>
          <IconButton label={muted ? 'Unmute track' : 'Mute track'} pressed={muted} onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
          </IconButton>
          <IconButton label="Magic cut" disabled><Wand2 size={18} aria-hidden="true" /></IconButton>
          <Badge tone="pro">Pro</Badge>
          <Badge tone="success">Saved</Badge>
          <Badge tone="danger">Offline</Badge>
        </div>
      </Section>

      <Section id="fields" title="Inspector controls" note="Arrow keys step, Shift ×10, Enter commits, Esc reverts. Diamond toggles a keyframe at the playhead.">
        <div style={{ ...card, display: 'grid', gap: 'var(--space-5)', maxWidth: 360 }}>
          <SliderField label="Scale" value={scale} onChange={setScale} min={10} max={400} unit="%" keyframe={{ state: kf, onToggle: () => setKf((s) => (s === 'on-playhead' ? 'has-keyframes' : 'on-playhead')) }} />
          <SliderField label="Opacity" value={opacity} onChange={setOpacity} min={0} max={100} unit="%" keyframe={{ state: 'none', onToggle: () => {} }} />
          <NumberField label="Rotation" value={rotation} onChange={setRotation} min={-360} max={360} step={1} unit="°" />
          <Switch label="Snap to beats" checked={snap} onChange={setSnap} />
          <Select
            label="Resolution"
            value={resolution}
            onChange={setResolution}
            options={[
              { value: '720', label: '720p' },
              { value: '1080', label: '1080p' },
              { value: '2160', label: '4K', hint: <Badge tone="pro">Pro</Badge> },
            ]}
          />
        </div>
      </Section>

      <Section id="media" title="Media" note="Drop zone has a real file input behind it. Locked items are shown, never hidden.">
        <Dropzone accept="video/*,image/*,audio/*" onFiles={(files) => toast({ tone: 'info', title: `${files.length} file(s) selected` })} />
        <Dropzone accept="video/*" onFiles={() => {}} error="This file uses a codec your browser can't decode (HEVC 10-bit). Convert it or try Chrome." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-5)' }}>
          {assets.map((a) => (
            <AssetCard key={a.id} {...a} selected={selectedAsset === a.id} onActivate={() => setSelectedAsset(a.id)} />
          ))}
          <AssetCard name="importing…" kind="video" loading />
          <AssetCard name="Neon glitch" kind="image" locked />
        </div>
        <div style={{ ...card, display: 'grid', gap: 'var(--space-5)' }}>
          <ProgressBar label="Importing crowd_wide.mov" value={0.62} />
          <ProgressBar label="Transcribing speech" indeterminate detail="Loading speech model (75 MB, once)" />
        </div>
      </Section>

      <Section id="editor" title="Editor slice" note="Side rail (vertical tabs), timeline clips per track type, inspector tabs. Focus a clip and use ←/→ to nudge one frame, Shift for a second.">
        <div className="g-editor" style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <SideRail
            value={rail}
            onValueChange={setRail}
            items={[
              { value: 'media', label: 'Media', icon: Film, content: <p className="text-muted">Imported media appears here.</p> },
              { value: 'audio', label: 'Audio', icon: AudioLines, content: <p className="text-muted">Music, sounds and voiceover.</p> },
              { value: 'text', label: 'Text', icon: Type, content: <p className="text-muted">Titles and text styles.</p> },
              { value: 'captions', label: 'Captions', icon: Captions, content: <p className="text-muted">Generate captions from speech.</p> },
              { value: 'effects', label: 'Effects', icon: Sparkles, content: <p className="text-muted">Filters, effects and transitions.</p> },
            ]}
          />
          <aside aria-label="Inspector" style={{ padding: 'var(--space-5)' }}>
            <Tabs
              label="Clip settings"
              value={inspectorTab}
              onValueChange={setInspectorTab}
              tabs={[
                { value: 'basic', label: 'Basic', content: <NumberField label="Volume" value={100} onChange={() => {}} min={0} max={200} unit="%" /> },
                { value: 'speed', label: 'Speed', content: <NumberField label="Speed" value={1} onChange={() => {}} min={0.1} max={100} step={0.1} unit="×" /> },
                { value: 'anim', label: 'Animation', content: <p className="text-muted">In / out animations.</p> },
              ]}
            />
          </aside>
        </div>

        <div className="g-timeline" style={{ ...card, padding: 'var(--space-4)', background: 'var(--color-surface-sunken)' }}>
        <div role="listbox" aria-label="Timeline tracks" className="g-timeline-inner">
          {[
            { kind: 'video' as const, items: clips.map((c) => ({ ...c })) },
            { kind: 'text' as const, items: [{ id: 't1', kind: 'text' as const, label: 'LIVE TONIGHT', start: 600, dur: 3000 }] },
            { kind: 'caption' as const, items: [{ id: 'k1', kind: 'caption' as const, label: '“turn it up”', start: 4400, dur: 1800 }, { id: 'k2', kind: 'caption' as const, label: '“one more”', start: 6400, dur: 1400 }] },
            { kind: 'image' as const, items: [{ id: 'o1', kind: 'image' as const, label: 'Logo sticker', start: 8200, dur: 3000 }] },
          ].map((track) => (
            <div key={track.kind} style={{ position: 'relative', height: 'var(--layout-track-height)' }}>
              {track.items.map((c) => (
                <TimelineClip
                  key={c.id}
                  kind={c.kind}
                  label={c.label}
                  startMs={c.start}
                  durationMs={c.dur}
                  pxPerSec={70}
                  selected={selectedClip === c.id}
                  onSelect={() => setSelectedClip(c.id)}
                  onNudge={(d) => nudge(c.id, d)}
                />
              ))}
            </div>
          ))}
          <div style={{ position: 'relative', height: 'var(--layout-track-height)' }}>
            <TimelineClip kind="audio" label="set_closing.wav" startMs={0} durationMs={13000} pxPerSec={70} peaks={peaks} muted={muted} />
          </div>
        </div>
        </div>
      </Section>

      <Section id="overlays" title="Overlays" note="Dialog traps focus and restores it; Esc closes. Errors stay until dismissed.">
        <div style={row}>
          <Button variant="primary" onClick={() => setExportOpen(true)}>Open export dialog</Button>
          <Button onClick={() => toast({ tone: 'success', title: 'Export finished', description: 'rooftop-set.mp4 · 1080p · 42 MB' })}>Success toast</Button>
          <Button onClick={() => toast({ tone: 'error', title: 'Export failed', description: 'The tab ran out of memory. Your progress is saved; try again.' })}>Error toast</Button>
        </div>
        <Dialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          title="Export video"
          description="Exports stay on this device. No watermark."
          footer={
            <>
              <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
              <Button variant="primary" icon={<Download size={16} aria-hidden="true" />} onClick={() => setExportOpen(false)}>Export</Button>
            </>
          }
        >
          <Select
            label="Resolution"
            value={resolution}
            onChange={setResolution}
            options={[
              { value: '720', label: '720p' },
              { value: '1080', label: '1080p' },
              { value: '2160', label: '4K', hint: <Badge tone="pro">Pro</Badge>, disabled: true },
            ]}
          />
          <Select label="Frame rate" value={fps} onChange={setFps} options={[{ value: '24', label: '24 fps' }, { value: '30', label: '30 fps' }, { value: '60', label: '60 fps' }]} />
          <Switch label="Burn in captions" checked onChange={() => {}} />
        </Dialog>
      </Section>
    </main>
  )
}
