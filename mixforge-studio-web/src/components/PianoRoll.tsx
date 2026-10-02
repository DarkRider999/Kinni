import type { MelodyNote } from '../lib/melodyPatterns'
import './PianoRoll.css'

const DEGREE_ROWS = 13 // two scale octaves, rendered high (top) to low (bottom)

interface PianoRollProps {
  notes: MelodyNote[]
  stepsPerBar: number
  activeStep: number | null
  onToggleNote: (step: number, degree: number) => void
}

export function PianoRoll({ notes, stepsPerBar, activeStep, onToggleNote }: PianoRollProps) {
  const noteAt = (step: number, degree: number) => notes.find((n) => n.step === step && n.scaleDegree === degree)

  return (
    <div className="piano-roll">
      {Array.from({ length: DEGREE_ROWS }, (_, rowIndex) => {
        const degree = DEGREE_ROWS - 1 - rowIndex
        return (
          <div className="piano-roll-row" key={degree}>
            <span className="piano-roll-label">{degree}</span>
            <div className="piano-roll-cells">
              {Array.from({ length: stepsPerBar }, (_, step) => {
                const note = noteAt(step, degree)
                return (
                  <button
                    key={step}
                    type="button"
                    className={[
                      'roll-cell',
                      note ? 'on' : '',
                      activeStep === step ? 'playhead' : '',
                      step % 4 === 0 ? 'beat-start' : '',
                    ].join(' ')}
                    style={note ? { width: `calc(${note.durationSteps} * 22px - 4px)` } : undefined}
                    onClick={() => onToggleNote(step, degree)}
                    aria-label={`Degree ${degree} step ${step + 1}`}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
