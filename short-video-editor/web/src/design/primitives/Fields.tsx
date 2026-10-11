import * as RSelect from '@radix-ui/react-select'
import * as RSlider from '@radix-ui/react-slider'
import * as RSwitch from '@radix-ui/react-switch'
import { Check, ChevronDown, Diamond } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useId, useState } from 'react'
import { clamp, snapToStep } from '../format'

export function Field({ label, htmlFor, error, aside, children }: { label: string; htmlFor: string; error?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">
        <label htmlFor={htmlFor}>{label}</label>
        {aside}
      </div>
      {children}
      {error && (
        <span className="field-error" id={`${htmlFor}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export interface NumberFieldProps {
  id?: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  /** Hide the visible label (still announced) when a parent row already labels it. */
  hideLabel?: boolean
}

/**
 * Numeric input used across the inspector (S12–S15). Arrow keys step,
 * Shift+Arrow steps ×10, Enter/blur commits, Escape reverts. Free typing is
 * allowed; the value is parsed, clamped and snapped on commit.
 */
export function NumberField({ id, label, value, onChange, min = -Infinity, max = Infinity, step = 1, unit, disabled, hideLabel }: NumberFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  // null = not editing, show the live value; a string = the user's in-progress text.
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string | null) => {
    setDraft(null)
    if (raw == null) return
    const parsed = Number(raw.trim().replace(',', '.'))
    if (raw.trim() === '' || !Number.isFinite(parsed)) return
    const next = snapToStep(clamp(parsed, min, max), step)
    if (next !== value) onChange(next)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
      const next = snapToStep(clamp(value + delta, min, max), step)
      if (next !== value) onChange(next)
    } else if (e.key === 'Enter') {
      commit(draft)
    } else if (e.key === 'Escape') {
      setDraft(null)
    }
  }

  const input = (
    <div className="number-field">
      <input
        id={inputId}
        className="input"
        inputMode="decimal"
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-label={hideLabel ? label : undefined}
        value={draft ?? String(value)}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={onKeyDown}
      />
      {unit && <span className="unit" aria-hidden="true">{unit}</span>}
    </div>
  )

  if (hideLabel) return input
  return (
    <Field label={label} htmlFor={inputId}>
      {input}
    </Field>
  )
}

export type KeyframeState = 'none' | 'has-keyframes' | 'on-playhead'

/** Diamond toggle next to an animatable property (S12, S13). */
export function KeyframeToggle({ state, property, onToggle }: { state: KeyframeState; property: string; onToggle: () => void }) {
  const label =
    state === 'on-playhead' ? `Remove ${property} keyframe at playhead` : `Add ${property} keyframe at playhead`
  return (
    <button type="button" className="kf-toggle" data-state={state} aria-label={label} aria-pressed={state === 'on-playhead'} onClick={onToggle}>
      <Diamond fill={state === 'none' ? 'none' : 'currentColor'} aria-hidden="true" />
    </button>
  )
}

export interface SliderFieldProps extends Omit<NumberFieldProps, 'hideLabel'> {
  keyframe?: { state: KeyframeState; onToggle: () => void }
}

/** Slider paired with an exact numeric input; both stay in sync. */
export function SliderField({ label, value, onChange, min = 0, max = 100, step = 1, unit, disabled, keyframe }: SliderFieldProps) {
  const id = useId()
  return (
    <div className="field">
      <div className="field-label">
        <span id={`${id}-label`}>{label}</span>
        {keyframe && <KeyframeToggle property={label} state={keyframe.state} onToggle={keyframe.onToggle} />}
      </div>
      <div className="slider-row">
        <RSlider.Root
          className="slider"
          value={[value]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-labelledby={`${id}-label`}
          onValueChange={([v]) => onChange(v)}
        >
          <RSlider.Track className="slider-track">
            <RSlider.Range className="slider-range" />
          </RSlider.Track>
          <RSlider.Thumb className="slider-thumb" aria-labelledby={`${id}-label`} />
        </RSlider.Root>
        <NumberField label={label} hideLabel value={value} onChange={onChange} min={min} max={max} step={step} unit={unit} disabled={disabled} />
      </div>
    </div>
  )
}

export function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="switch-row">
      <label htmlFor={id}>{label}</label>
      <RSwitch.Root id={id} className="switch" checked={checked} onCheckedChange={onChange} disabled={disabled}>
        <RSwitch.Thumb className="switch-thumb" />
      </RSwitch.Root>
    </div>
  )
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  /** Right-aligned hint, e.g. "Pro" or a file-size estimate. */
  hint?: ReactNode
}

export function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: SelectOption[]; disabled?: boolean }) {
  const id = useId()
  return (
    <Field label={label} htmlFor={id}>
      <RSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
        <RSelect.Trigger id={id} className="select-trigger" aria-label={label}>
          <RSelect.Value />
          <RSelect.Icon>
            <ChevronDown size={14} aria-hidden="true" />
          </RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content className="select-content" position="popper" sideOffset={4}>
            <RSelect.Viewport className="select-viewport">
              {options.map((o) => (
                <RSelect.Item key={o.value} value={o.value} disabled={o.disabled} className="select-item">
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                  <span style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {o.hint}
                    <RSelect.ItemIndicator>
                      <Check size={14} aria-hidden="true" />
                    </RSelect.ItemIndicator>
                  </span>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
    </Field>
  )
}
