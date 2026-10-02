import { useMemo, useState } from "react";
import "./app.css";
import { engine } from "./engine/engineBridge";
import { useCrates } from "./state/useCrates";
import { useDecks } from "./state/useDecks";
import { useEngine } from "./state/useEngine";
import { useLibrary } from "./state/useLibrary";
import type { MidiHandlers } from "./state/useMidi";
import { useMidi } from "./state/useMidi";
import { useSessionLog } from "./state/useSessionLog";
import { DecksView } from "./views/DecksView";
import { FxView } from "./views/FxView";
import { Home } from "./views/Home";
import { LibraryView } from "./views/LibraryView";
import { SamplerView } from "./views/SamplerView";
import { SettingsView } from "./views/SettingsView";

type View = "home" | "decks" | "library" | "sampler" | "fx" | "settings";

const TABS: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "decks", label: "Decks & Mixer" },
  { id: "library", label: "Library & RadicalAI" },
  { id: "sampler", label: "Sampler" },
  { id: "fx", label: "FX Rack" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [view, setView] = useState<View>("home");
  const eng = useEngine();
  const lib = useLibrary();
  const crates = useCrates();
  const sessionLog = useSessionLog();
  const decks = useDecks(lib.markPlayed, sessionLog.log);

  // Lives at the top level (not inside DecksView) so a MIDI controller keeps
  // working regardless of which tab is showing, same as real DJ hardware.
  const midiHandlers = useMemo<MidiHandlers>(
    () => ({
      "deckA.playPause": () => engine.call("djn_deck_toggle_play", 0),
      "deckA.cue": () => engine.call("djn_deck_cue", 0),
      "deckB.playPause": () => engine.call("djn_deck_toggle_play", 1),
      "deckB.cue": () => engine.call("djn_deck_cue", 1),
      crossfader: (v) => decks.setCrossfader(v),
      "deckA.fader": (v) => engine.call("djn_mixer_set_fader", 0, v),
      "deckB.fader": (v) => engine.call("djn_mixer_set_fader", 1, v),
    }),
    [decks],
  );
  const midi = useMidi(midiHandlers);

  const ready = eng.status === "running";

  return (
    <div className="shell">
      <nav className="topnav">
        <span className="brand">
          DJ <b>RadicalMix</b>
        </span>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`navbtn${view === t.id ? " active" : ""}`}
            onClick={() => setView(t.id)}
            disabled={t.id !== "home" && !ready}
          >
            {t.label}
          </button>
        ))}
        <div className="status">
          <span className={`dot`} style={{ background: ready ? "var(--good)" : "var(--bad)" }} />
          {ready ? `${eng.mode} / ${eng.thread}` : eng.status}
          {ready && eng.state && <span>dsp {(eng.state.dspLoad * 100).toFixed(0)}%</span>}
        </div>
      </nav>
      <div className="main">
        {view === "home" && <Home eng={eng} onEnter={() => eng.enter().then(() => setView("decks"))} />}
        {view === "decks" && ready && <DecksView eng={eng} decks={decks} tracks={lib.tracks} />}
        {view === "library" && ready && <LibraryView lib={lib} crates={crates} decks={decks} eng={eng} />}
        {view === "sampler" && ready && <SamplerView />}
        {view === "fx" && ready && <FxView eng={eng} />}
        {view === "settings" && ready && <SettingsView eng={eng} sessionLog={sessionLog} midi={midi} />}
      </div>
    </div>
  );
}
