import { useEffect, useRef, useState } from "react";
import { Waveform } from "../components/Waveform";
import { engine } from "../engine/engineBridge";
import type { Track } from "../lib/library";
import { suggestNextTracks } from "../lib/suggestions";
import { useAutoMix } from "../state/useAutoMix";
import type { useDecks } from "../state/useDecks";
import type { useEngine } from "../state/useEngine";

const HOT_CUES = [0, 1, 2, 3];
// Slots 0-2 are auto-set on load (useDecks.applyAutoCues) to the track's
// detected intro end / drop / outro start.
const HOT_CUE_LABELS = ["Intro", "Drop", "Outro", "Hot cue 4"];

function DeckPanel({
  deck,
  eng,
  decks,
}: {
  deck: 0 | 1;
  eng: ReturnType<typeof useEngine>;
  decks: ReturnType<typeof useDecks>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [settingHotCue, setSettingHotCue] = useState(false);
  const s = eng.state?.decks[deck];
  const deckTrack = decks.deckTracks[deck];
  const loading = decks.loading[deck];
  const label = deck === 0 ? "A" : "B";

  return (
    <div className={`panel deck`}>
      <h3>
        <span>
          Deck {label} {s?.master ? <span className="chip">MASTER</span> : null}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && decks.quickLoadToDeck(deck, e.target.files[0])}
        />
        <button className="btn small" onClick={() => fileRef.current?.click()}>
          Quick load file
        </button>
      </h3>

      <div className="trackname">{deckTrack ? deckTrack.name : loading ? "Loading..." : "No track loaded"}</div>
      <div className="meta-row">
        <span className="chip">{s?.effectiveBpm ? s.effectiveBpm.toFixed(1) : "--"} BPM</span>
        <span className="chip">{deckTrack?.camelot || "--"}</span>
        <span className="chip">
          {s ? `${s.position.toFixed(0)}s / ${s.duration.toFixed(0)}s` : "--"}
        </span>
      </div>

      <Waveform
        peaks={deckTrack?.peaks ?? null}
        position={s?.position ?? 0}
        duration={s?.duration ?? 0}
        color={deck === 0 ? "#ff1744" : "#00e5ff"}
        hotCues={decks.hotCues[deck]}
      />

      <div className="row">
        <label>Level</label>
        <div className="meter">
          <div style={{ width: `${Math.min(100, (s?.peakL ?? 0) * 140)}%` }} />
        </div>
      </div>

      <div className="transport">
        <button className="btn primary" onClick={() => engine.call("djn_deck_toggle_play", deck)} disabled={!s?.loaded}>
          {s?.playing ? "Pause" : "Play"}
        </button>
        <button className="btn" onClick={() => engine.call("djn_deck_cue", deck)} disabled={!s?.loaded}>
          Cue
        </button>
        <button
          className={`btn togglebtn${s?.sync ? " on" : ""}`}
          onClick={() => engine.call("djn_deck_set_sync", deck, s?.sync ? 0 : 1)}
          disabled={!s?.loaded}
        >
          Sync
        </button>
        <button
          className={`btn togglebtn${s?.keyLock ? " on" : ""}`}
          onClick={() => engine.call("djn_deck_set_key_lock", deck, s?.keyLock ? 0 : 1)}
          disabled={!s?.loaded}
        >
          Key Lock
        </button>
        <button
          className={`btn togglebtn${s?.reverse ? " on" : ""}`}
          onClick={() => engine.call("djn_deck_set_reverse", deck, s?.reverse ? 0 : 1)}
          disabled={!s?.loaded}
        >
          Reverse
        </button>
      </div>

      <div className="hotcues">
        {HOT_CUES.map((slot) => (
          <button
            key={slot}
            className="hotcue"
            title={HOT_CUE_LABELS[slot]}
            onClick={() =>
              settingHotCue ? decks.setHotCueAt(deck, slot, s?.position ?? 0) : engine.call("djn_deck_hot_cue_trigger", deck, slot)
            }
            disabled={!s?.loaded}
          >
            {slot + 1}
          </button>
        ))}
        <button className={`btn small${settingHotCue ? " togglebtn on" : ""}`} onClick={() => setSettingHotCue((v) => !v)}>
          {settingHotCue ? "Tap to set" : "Set mode"}
        </button>
      </div>

      <div className="row">
        <label>Loop</label>
        <button className="btn small" onClick={() => engine.call("djn_deck_loop_beats", deck, 4)} disabled={!s?.loaded}>
          4 beats
        </button>
        <button className="btn small" onClick={() => engine.call("djn_deck_loop_halve", deck)} disabled={!s?.looping}>
          &frac12;
        </button>
        <button className="btn small" onClick={() => engine.call("djn_deck_loop_double", deck)} disabled={!s?.looping}>
          &times;2
        </button>
        <button className="btn small" onClick={() => engine.call("djn_deck_loop_exit", deck)} disabled={!s?.looping}>
          Exit
        </button>
      </div>

      <div className="row">
        <label>Pitch</label>
        <input
          type="range"
          min={-0.5}
          max={0.5}
          step={0.001}
          defaultValue={0}
          onChange={(e) => engine.call("djn_deck_set_pitch", deck, parseFloat(e.target.value))}
        />
      </div>

      {(["low", "mid", "high"] as const).map((band, i) => (
        <div className="row" key={band}>
          <label>EQ {band}</label>
          <input
            type="range"
            min={-26}
            max={6}
            step={0.5}
            defaultValue={0}
            onChange={(e) => engine.call("djn_mixer_set_eq_db", deck, i, parseFloat(e.target.value))}
          />
        </div>
      ))}

      <div className="row">
        <label>Filter</label>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          onChange={(e) => engine.call("djn_mixer_set_filter", deck, parseFloat(e.target.value))}
        />
      </div>

      <div className="row">
        <label>Channel fader</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.8}
          onChange={(e) => engine.call("djn_mixer_set_fader", deck, parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}

function Mixer({
  decks,
  autoMix,
  onToggleAutoMix,
  autoMixPhase,
  smartOutroFx,
  onToggleSmartOutroFx,
}: {
  decks: ReturnType<typeof useDecks>;
  autoMix: boolean;
  onToggleAutoMix: () => void;
  autoMixPhase: string;
  smartOutroFx: boolean;
  onToggleSmartOutroFx: () => void;
}) {
  return (
    <div className="panel mixer">
      <div className="section-title">Crossfader</div>
      <input
        className="xfader"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={decks.crossfader}
        onChange={(e) => decks.setCrossfader(parseFloat(e.target.value))}
      />
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 11, color: "var(--ink-dim)" }}>
        <span>A</span>
        <span>B</span>
      </div>
      <div className="row" style={{ width: "100%" }}>
        <label>Master</label>
        <input
          type="range"
          min={-24}
          max={6}
          step={0.5}
          defaultValue={0}
          onChange={(e) => engine.call("djn_mixer_set_master_db", parseFloat(e.target.value))}
        />
      </div>
      <div className="row" style={{ width: "100%" }}>
        <label>Auto-Mix</label>
        <button className={`btn small togglebtn${autoMix ? " on" : ""}`} onClick={onToggleAutoMix}>
          {autoMix ? "On" : "Off"}
        </button>
        {autoMix && (
          <span style={{ fontSize: 11, color: "var(--ink-dim)", fontFamily: "var(--mono)" }}>
            {autoMixPhase === "idle"
              ? "watching for the track to end..."
              : autoMixPhase === "loading"
                ? "loading the next track..."
                : autoMixPhase === "settling"
                  ? "starting the next track..."
                  : "crossfading..."}
          </span>
        )}
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, justifyContent: "center" }}>
        <input type="checkbox" checked={smartOutroFx} onChange={onToggleSmartOutroFx} /> Smart Outro FX (reverb wash
        on FX 2 during the crossfade)
      </label>
      <p style={{ fontSize: 11, color: "var(--ink-dim)", textAlign: "center", margin: "4px 0 0" }}>
        Auto-Mix loads and crossfades into RadicalAI's top pick when the playing deck is within 20s of ending, if
        the other deck is idle.
      </p>
    </div>
  );
}

function NextTrackRadar({ eng, decks, tracks }: { eng: ReturnType<typeof useEngine>; decks: ReturnType<typeof useDecks>; tracks: Track[] }) {
  const masterIdx = eng.state?.masterDeck;
  const referenceId =
    (masterIdx === 0 || masterIdx === 1 ? decks.deckTracks[masterIdx]?.trackId : undefined) ?? decks.deckTracks[0]?.trackId;
  const reference = tracks.find((t) => t.id === referenceId);
  const idleDeck: 0 | 1 = masterIdx === 0 ? 1 : 0;

  if (tracks.length === 0) return null;
  if (!reference) {
    return (
      <div className="panel" style={{ padding: 16, marginTop: 16 }}>
        <div className="section-title">RadicalAI &middot; Next-Track Radar</div>
        <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: 0 }}>
          Load a track from your library (not a quick-loaded file) to see live suggestions here.
        </p>
      </div>
    );
  }

  const suggestions = suggestNextTracks(reference, tracks, -1, 3);

  return (
    <div className="panel" style={{ padding: 16, marginTop: 16 }}>
      <div className="section-title">RadicalAI &middot; Next-Track Radar (after {reference.name})</div>
      {suggestions.map(({ track: t, score, reason }) => (
        <div className="suggestion" key={t.id}>
          <div style={{ minWidth: 0 }}>
            <div className="trackname" style={{ fontSize: 13 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>
              {t.camelot || "?"} &middot; {t.bpm > 0 ? `${t.bpm.toFixed(0)} BPM` : "? BPM"} &middot; {reason}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div className="score-bar">
              <div style={{ width: `${score.total * 100}%` }} />
            </div>
            <button className="btn small" onClick={() => decks.loadToDeck(idleDeck, t)}>
              Load to {idleDeck === 0 ? "A" : "B"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DecksView({
  eng,
  decks,
  tracks,
}: {
  eng: ReturnType<typeof useEngine>;
  decks: ReturnType<typeof useDecks>;
  tracks: Track[];
}) {
  const [autoMix, setAutoMix] = useState(false);
  const [smartOutroFx, setSmartOutroFx] = useState(true);
  const { phase } = useAutoMix(autoMix, smartOutroFx, eng.state, decks, tracks);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      const bindings: Record<string, () => void> = {
        " ": () => engine.call("djn_deck_toggle_play", 0),
        Enter: () => engine.call("djn_deck_toggle_play", 1),
        c: () => engine.call("djn_deck_cue", 0),
        v: () => engine.call("djn_deck_cue", 1),
        "1": () => engine.call("djn_deck_hot_cue_trigger", 0, 0),
        "2": () => engine.call("djn_deck_hot_cue_trigger", 0, 1),
        "3": () => engine.call("djn_deck_hot_cue_trigger", 0, 2),
        "4": () => engine.call("djn_deck_hot_cue_trigger", 0, 3),
        "7": () => engine.call("djn_deck_hot_cue_trigger", 1, 0),
        "8": () => engine.call("djn_deck_hot_cue_trigger", 1, 1),
        "9": () => engine.call("djn_deck_hot_cue_trigger", 1, 2),
        "0": () => engine.call("djn_deck_hot_cue_trigger", 1, 3),
      };
      const action = bindings[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div>
      <div className="grid2" style={{ marginBottom: 16 }}>
        <DeckPanel deck={0} eng={eng} decks={decks} />
        <DeckPanel deck={1} eng={eng} decks={decks} />
      </div>
      <Mixer
        decks={decks}
        autoMix={autoMix}
        onToggleAutoMix={() => setAutoMix((v) => !v)}
        autoMixPhase={phase}
        smartOutroFx={smartOutroFx}
        onToggleSmartOutroFx={() => setSmartOutroFx((v) => !v)}
      />
      <p style={{ fontSize: 11, color: "var(--ink-dim)", textAlign: "center", margin: "8px 0 0" }}>
        Keyboard: Space/Enter play A/B &middot; C/V cue A/B &middot; 1-4 hot cues A &middot; 7-0 hot cues B
      </p>
      <NextTrackRadar eng={eng} decks={decks} tracks={tracks} />
    </div>
  );
}
