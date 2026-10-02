import type { OneShotId } from '../engine/synthKit'
import type { BeatPattern, DrumLane } from '../lib/beatPatterns'
import { DRUM_LANES } from '../lib/beatPatterns'
import './StepGrid.css'

const LANE_LABELS: Record<DrumLane, string> = {
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  hihatClosed: 'Hat (cl)',
  hihatOpen: 'Hat (op)',
  bassHit: 'Bass',
  rimshot: 'Rim',
}

interface StepGridProps {
  pattern: BeatPattern
  activeStep: number | null
  onToggle: (lane: DrumLane, step: number) => void
  laneSounds?: Record<DrumLane, OneShotId>
  onDropSample?: (lane: DrumLane, sampleId: OneShotId) => void
}

export function StepGrid({ pattern, activeStep, onToggle, laneSounds, onDropSample }: StepGridProps) {
  return (
    <div className="step-grid">
      {DRUM_LANES.map((lane) => (
        <div
          className="step-grid-row"
          key={lane}
          onDragOver={onDropSample ? (e) => e.preventDefault() : undefined}
          onDrop={
            onDropSample
              ? (e) => {
                  e.preventDefault()
                  const sampleId = e.dataTransfer.getData('text/mixforge-sample') as OneShotId
                  if (sampleId) onDropSample(lane, sampleId)
                }
              : undefined
          }
        >
          <span className="step-grid-label" title={laneSounds ? `Sound: ${laneSounds[lane]}` : undefined}>
            {LANE_LABELS[lane]}
            {laneSounds && laneSounds[lane] !== lane && <span className="lane-remap"> → {laneSounds[lane]}</span>}
          </span>
          <div className="step-grid-cells">
            {pattern[lane].map((on, step) => (
              <button
                key={step}
                type="button"
                className={[
                  'step-cell',
                  on ? 'on' : '',
                  activeStep === step ? 'playhead' : '',
                  step % 4 === 0 ? 'beat-start' : '',
                ].join(' ')}
                aria-pressed={on}
                aria-label={`${LANE_LABELS[lane]} step ${step + 1}`}
                onClick={() => onToggle(lane, step)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
