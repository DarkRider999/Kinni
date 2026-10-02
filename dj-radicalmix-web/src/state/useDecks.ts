import { useCallback, useState } from "react";
import { analyzeTrack } from "../engine/analysis";
import { engine } from "../engine/engineBridge";
import { decodeAudioFile, toEngineStereo, type DecodedAudio } from "../lib/decode";
import type { Track } from "../lib/library";
import { computeWaveformPeaks, type WaveformPeaks } from "../lib/waveform";

const WAVEFORM_BINS = 1000;

export interface DeckTrack {
  name: string;
  bpm: number;
  camelot: string;
  peaks: WaveformPeaks;
  // Set only when loaded from the library, so the AI advisor/"now playing"
  // lookups can find the full Track record; absent for a quick-loaded file.
  trackId?: string;
}

export function useDecks(
  markPlayed: (id: string) => void,
  onLoaded?: (deck: 0 | 1, name: string, bpm: number, camelot: string) => void,
) {
  const [deckTracks, setDeckTracks] = useState<(DeckTrack | null)[]>([null, null]);
  const [loading, setLoading] = useState<[boolean, boolean]>([false, false]);
  const [hotCues, setHotCues] = useState<Record<number, number>[]>([{}, {}]);
  const [crossfader, setCrossfaderState] = useState(0.5);

  const setLoadingAt = (deck: 0 | 1, value: boolean) => {
    setLoading((prev) => {
      const next: [boolean, boolean] = [...prev];
      next[deck] = value;
      return next;
    });
  };

  /** Auto 3 cue points: intro end / drop / outro start land on hot cues 1-3,
   * set at an exact position (djn_deck_hot_cue_set_at) regardless of the
   * current playhead -- unlike the manual "Set mode" flow in setHotCueAt. */
  const applyAutoCues = useCallback((deck: 0 | 1, intro: number, drop: number, outro: number) => {
    const positions: Record<number, number> = {};
    [intro, drop, outro].forEach((pos, slot) => {
      if (pos >= 0) {
        engine.call("djn_deck_hot_cue_set_at", deck, slot, pos);
        positions[slot] = pos;
      }
    });
    setHotCues((prev) => {
      const next = [...prev];
      next[deck] = positions;
      return next;
    });
  }, []);

  const applyToEngine = useCallback(
    async (
      deck: 0 | 1,
      decoded: DecodedAudio,
      bpm: number,
      firstBeatSec: number,
      display: DeckTrack,
      cues: { intro: number; drop: number; outro: number },
    ) => {
      const peaks = computeWaveformPeaks(decoded.channels, WAVEFORM_BINS);
      const { left, right } = toEngineStereo(decoded);
      await engine.load(deck, left, right, bpm, firstBeatSec);
      setDeckTracks((prev) => {
        const next = [...prev];
        next[deck] = { ...display, peaks };
        return next;
      });
      applyAutoCues(deck, cues.intro, cues.drop, cues.outro);
    },
    [applyAutoCues],
  );

  const loadToDeck = useCallback(
    async (deck: 0 | 1, track: Track) => {
      setLoadingAt(deck, true);
      try {
        const decoded = await decodeAudioFile(track.file);
        await applyToEngine(
          deck,
          decoded,
          track.bpm,
          track.firstBeatSec,
          {
            name: track.name,
            bpm: track.bpm,
            camelot: track.camelot,
            peaks: { min: new Float32Array(), max: new Float32Array() },
            trackId: track.id,
          },
          { intro: track.introEndSec, drop: track.dropSec, outro: track.outroStartSec },
        );
        markPlayed(track.id);
        onLoaded?.(deck, track.name, track.bpm, track.camelot);
      } finally {
        setLoadingAt(deck, false);
      }
    },
    [applyToEngine, markPlayed, onLoaded],
  );

  /** For a file not (yet) in the library -- "just hear it now". */
  const quickLoadToDeck = useCallback(
    async (deck: 0 | 1, file: File) => {
      setLoadingAt(deck, true);
      try {
        const decoded = await decodeAudioFile(file);
        const analysis = analyzeTrack(decoded.channels, decoded.sampleRate);
        const name = file.name.replace(/\.[^/.]+$/, "");
        await applyToEngine(
          deck,
          decoded,
          analysis.bpm,
          analysis.firstBeatSec,
          {
            name,
            bpm: analysis.bpm,
            camelot: analysis.camelot,
            peaks: { min: new Float32Array(), max: new Float32Array() },
          },
          { intro: analysis.introEndSec, drop: analysis.dropSec, outro: analysis.outroStartSec },
        );
        onLoaded?.(deck, name, analysis.bpm, analysis.camelot);
      } finally {
        setLoadingAt(deck, false);
      }
    },
    [applyToEngine, onLoaded],
  );

  /** Sets hot cue `slot` on `deck` at `positionSec` (the engine snaps it to the
   * beat grid when quantize is on; this records the position the UI *asked*
   * for, which is accurate enough for drawing a marker on the waveform). */
  const setHotCueAt = useCallback((deck: 0 | 1, slot: number, positionSec: number) => {
    engine.call("djn_deck_hot_cue_set", deck, slot);
    setHotCues((prev) => {
      const next = [...prev];
      next[deck] = { ...next[deck], [slot]: positionSec };
      return next;
    });
  }, []);

  const setCrossfader = useCallback((value: number) => {
    setCrossfaderState(value);
    engine.call("djn_mixer_set_crossfader", value);
  }, []);

  return { deckTracks, loading, hotCues, crossfader, loadToDeck, quickLoadToDeck, setHotCueAt, setCrossfader };
}
