// Camelot wheel helpers. A JS port of dj-nexus-pro/engine/src/core/analysis.cpp's
// camelotOf()/camelotCode(); keep the two in sync if the mapping ever changes.

// Camelot number for the MAJOR key rooted at each pitch class (circle of
// fifths order starting at C=8B, matching the standard Camelot wheel).
const MAJOR_NUMBER = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];

export function wrap12(v: number): number {
  return ((v % 12) + 12) % 12;
}

export interface CamelotPosition {
  number: number;
  letter: "A" | "B";
}

export function camelotOf(pitchClass: number, isMinor: boolean): CamelotPosition | null {
  if (pitchClass < 0 || pitchClass > 11) return null;
  if (!isMinor) return { number: MAJOR_NUMBER[pitchClass], letter: "B" };
  // A minor key's relative major sits 3 semitones up; it shares that major's
  // Camelot number with the "A" (minor) letter.
  return { number: MAJOR_NUMBER[wrap12(pitchClass + 3)], letter: "A" };
}

export function camelotCode(pitchClass: number, isMinor: boolean): string {
  const c = camelotOf(pitchClass, isMinor);
  return c ? `${c.number}${c.letter}` : "";
}

export const PITCH_CLASS_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];
