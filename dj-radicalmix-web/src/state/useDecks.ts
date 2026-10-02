import { useCallback, useState } from "react";
import { engine } from "../engine/engineBridge";
import { decodeAudioFile, toEngineStereo } from "../lib/decode";
import type { Track } from "../lib/library";

export interface DeckTrack {
  track: Track;
}

export function useDecks(markPlayed: (id: string) => void) {
  const [deckTracks, setDeckTracks] = useState<(DeckTrack | null)[]>([null, null]);
  const [loading, setLoading] = useState<[boolean, boolean]>([false, false]);

  const loadToDeck = useCallback(
    async (deck: 0 | 1, track: Track) => {
      setLoading((prev) => {
        const next: [boolean, boolean] = [...prev];
        next[deck] = true;
        return next;
      });
      try {
        const decoded = await decodeAudioFile(track.file);
        const { left, right } = toEngineStereo(decoded);
        await engine.load(deck, left, right, track.bpm, track.firstBeatSec);
        setDeckTracks((prev) => {
          const next = [...prev];
          next[deck] = { track };
          return next;
        });
        markPlayed(track.id);
      } finally {
        setLoading((prev) => {
          const next: [boolean, boolean] = [...prev];
          next[deck] = false;
          return next;
        });
      }
    },
    [markPlayed],
  );

  return { deckTracks, loading, loadToDeck };
}
