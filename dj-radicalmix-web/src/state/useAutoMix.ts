import { useEffect, useRef, useState } from "react";
import { engine } from "../engine/engineBridge";
import type { Track } from "../lib/library";
import { smartReverbPreset } from "../lib/smartFx";
import { suggestNextTracks } from "../lib/suggestions";
import type { useDecks } from "./useDecks";
import type { EngineState } from "../engine/types";

// Smart Outro FX borrows FX unit 2 for the duration of the crossfade -- the
// engine only has two FX units, so this is a deliberate trade-off rather
// than a dedicated bus. Avoid relying on FX 2 for anything else while an
// Auto-Mix transition is in progress (watch `phase`).
const SMART_OUTRO_FX_UNIT = 1;

// How long before a track ends that Auto-Mix picks and starts the next one
// (docs/dj-radicalmix Sec 2 Issue 24 -- "Limited Automation").
const TRIGGER_WINDOW_SEC = 20;
// How long the crossfade to the new deck takes once it's playing.
const CROSSFADE_MS = 8000;
// How long to let the new deck play (and sync-lock) before fading into it.
const SETTLE_MS = 1500;

type Phase = "idle" | "loading" | "settling" | "fading";

export function useAutoMix(
  enabled: boolean,
  smartOutroFx: boolean,
  state: EngineState | null,
  decks: ReturnType<typeof useDecks>,
  tracks: Track[],
) {
  const [phase, setPhase] = useState<Phase>("idle");
  const handledTrackIdRef = useRef<string | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  const clearFadeTimer = () => {
    if (fadeTimerRef.current !== null) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  useEffect(() => clearFadeTimer, []);

  useEffect(() => {
    if (!enabled || !state || phase !== "idle") return;
    const masterIdx = state.masterDeck;
    if (masterIdx !== 0 && masterIdx !== 1) return;
    const idleIdx: 0 | 1 = masterIdx === 0 ? 1 : 0;

    const masterDeckState = state.decks[masterIdx];
    const idleDeckState = state.decks[idleIdx];
    if (!masterDeckState.loaded || masterDeckState.duration <= 0) return;
    if (idleDeckState.loaded) return; // DJ is already double-decking manually; don't interfere

    const remaining = masterDeckState.duration - masterDeckState.position;
    if (remaining > TRIGGER_WINDOW_SEC) {
      handledTrackIdRef.current = null; // a new track could trigger again once it nears its own end
      return;
    }

    const masterTrackId = decks.deckTracks[masterIdx]?.trackId;
    const masterTrack = tracks.find((t) => t.id === masterTrackId);
    if (!masterTrack || handledTrackIdRef.current === masterTrack.id) return;

    const next = suggestNextTracks(masterTrack, tracks, -1, 1)[0];
    if (!next) return;

    handledTrackIdRef.current = masterTrack.id; // mark now so we don't re-enter while loading is in flight
    setPhase("loading");

    (async () => {
      await decks.loadToDeck(idleIdx, next.track);
      engine.call("djn_deck_set_sync", idleIdx, 1);
      engine.call("djn_deck_toggle_play", idleIdx);
      setPhase("settling");

      window.setTimeout(() => {
        setPhase("fading");
        if (smartOutroFx) {
          const preset = smartReverbPreset();
          engine.call("djn_fx_set_target", SMART_OUTRO_FX_UNIT, masterIdx);
          engine.call("djn_fx_set_type", SMART_OUTRO_FX_UNIT, preset.type);
          engine.call("djn_fx_set_beats", SMART_OUTRO_FX_UNIT, preset.beats);
          engine.call("djn_fx_set_depth", SMART_OUTRO_FX_UNIT, preset.depth);
          engine.call("djn_fx_set_wet", SMART_OUTRO_FX_UNIT, preset.wet);
          engine.call("djn_fx_set_on", SMART_OUTRO_FX_UNIT, 1);
        }

        const from = decks.crossfader;
        const to = idleIdx === 1 ? 1 : 0;
        const steps = 40;
        let step = 0;
        clearFadeTimer();
        fadeTimerRef.current = window.setInterval(() => {
          step++;
          const t = step / steps;
          decks.setCrossfader(from + (to - from) * t);
          if (step >= steps) {
            clearFadeTimer();
            if (smartOutroFx) engine.call("djn_fx_set_on", SMART_OUTRO_FX_UNIT, 0);
            setPhase("idle");
          }
        }, CROSSFADE_MS / steps);
      }, SETTLE_MS);
    })();
  }, [enabled, smartOutroFx, state, phase, decks, tracks]);

  return { phase };
}
