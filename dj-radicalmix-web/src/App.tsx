import { useState } from "react";
import "./app.css";
import { useDecks } from "./state/useDecks";
import { useEngine } from "./state/useEngine";
import { useLibrary } from "./state/useLibrary";
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
  const decks = useDecks(lib.markPlayed);

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
        {view === "decks" && ready && <DecksView eng={eng} decks={decks} />}
        {view === "library" && ready && <LibraryView lib={lib} decks={decks} eng={eng} />}
        {view === "sampler" && ready && <SamplerView />}
        {view === "fx" && ready && <FxView eng={eng} />}
        {view === "settings" && ready && <SettingsView eng={eng} />}
      </div>
    </div>
  );
}
