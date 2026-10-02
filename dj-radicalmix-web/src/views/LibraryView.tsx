import { useMemo, useRef, useState } from "react";
import { trackInCrate, type Crate, type CrateRule, type Track } from "../lib/library";
import { suggestNextTracks } from "../lib/suggestions";
import type { useCrates } from "../state/useCrates";
import type { useDecks } from "../state/useDecks";
import type { useEngine } from "../state/useEngine";
import type { useLibrary } from "../state/useLibrary";

function Dropzone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`dropzone${drag ? " drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      Drop tracks here, or click to choose files. BPM and key are detected automatically on import.
    </div>
  );
}

function SmartCrateForm({ onCreate, onCancel }: { onCreate: (name: string, rule: CrateRule) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [energyMin, setEnergyMin] = useState("");
  const [energyMax, setEnergyMax] = useState("");
  const [genre, setGenre] = useState("");
  const [mode, setMode] = useState<"" | "major" | "minor">("");

  const submit = () => {
    if (!name.trim()) return;
    const rule: CrateRule = {};
    if (bpmMin) rule.bpmMin = parseFloat(bpmMin);
    if (bpmMax) rule.bpmMax = parseFloat(bpmMax);
    if (energyMin) rule.energyMin = parseFloat(energyMin);
    if (energyMax) rule.energyMax = parseFloat(energyMax);
    if (genre.trim()) rule.genre = genre.trim();
    if (mode) rule.mode = mode;
    onCreate(name.trim(), rule);
  };

  return (
    <div className="panel" style={{ padding: 12, marginBottom: 10 }}>
      <div className="section-title">New smart crate</div>
      <div className="row">
        <label>Name</label>
        <input className="field" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Peak-Time Techno" />
      </div>
      <div className="row">
        <label>BPM</label>
        <input className="field" style={{ width: 60 }} value={bpmMin} onChange={(e) => setBpmMin(e.target.value)} placeholder="min" />
        <input className="field" style={{ width: 60 }} value={bpmMax} onChange={(e) => setBpmMax(e.target.value)} placeholder="max" />
        <label style={{ width: "auto", marginLeft: 10 }}>Energy</label>
        <input className="field" style={{ width: 50 }} value={energyMin} onChange={(e) => setEnergyMin(e.target.value)} placeholder="min" />
        <input className="field" style={{ width: 50 }} value={energyMax} onChange={(e) => setEnergyMax(e.target.value)} placeholder="max" />
      </div>
      <div className="row">
        <label>Genre</label>
        <input className="field" style={{ width: 120 }} value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="any" />
        <label style={{ width: "auto", marginLeft: 10 }}>Mode</label>
        <select className="field" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
          <option value="">any</option>
          <option value="major">major</option>
          <option value="minor">minor</option>
        </select>
      </div>
      <div className="transport" style={{ marginTop: 6 }}>
        <button className="btn small primary" onClick={submit}>
          Create
        </button>
        <button className="btn small ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function LibraryView({
  lib,
  crates,
  decks,
  eng,
}: {
  lib: ReturnType<typeof useLibrary>;
  crates: ReturnType<typeof useCrates>;
  decks: ReturnType<typeof useDecks>;
  eng: ReturnType<typeof useEngine>;
}) {
  const [query, setQuery] = useState("");
  const [refId, setRefId] = useState<string>("");
  const [targetEnergy, setTargetEnergy] = useState(-1);
  const [activeCrateId, setActiveCrateId] = useState<string | null>(null);
  const [showSmartForm, setShowSmartForm] = useState(false);

  const activeCrate: Crate | undefined = crates.crates.find((c) => c.id === activeCrateId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lib.tracks.filter((t) => {
      // Smart crates filter the list by their rule. Manual crates don't --
      // every track stays visible so its "in crate" checkbox can be used to
      // add it; filtering those out here would make an empty manual crate
      // impossible to ever put a first track into.
      if (activeCrate?.kind === "smart" && !trackInCrate(t, activeCrate)) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || t.camelot.toLowerCase().includes(q);
    });
  }, [lib.tracks, query, activeCrate]);

  const masterDeckTrackId = eng.state && eng.state.masterDeck >= 0 ? decks.deckTracks[eng.state.masterDeck]?.trackId : undefined;
  const masterDeckTrack = lib.tracks.find((t) => t.id === masterDeckTrackId);
  const reference = lib.tracks.find((t) => t.id === refId) ?? masterDeckTrack ?? lib.tracks[0];

  const suggestions = useMemo(() => {
    if (!reference) return [];
    return suggestNextTracks(reference, lib.tracks, targetEnergy, 6);
  }, [reference, lib.tracks, targetEnergy]);

  const nudgeBias = (t: Track, delta: number) => {
    lib.edit({ ...t, userBias: Math.max(-1, Math.min(1, t.userBias + delta)) });
  };

  return (
    <div>
      <Dropzone onFiles={lib.importFiles} />
      {lib.importing.length > 0 && (
        <div className="panel" style={{ padding: 10, marginBottom: 16, fontSize: 12 }}>
          {lib.importing.map((i) => (
            <div key={i.name}>
              {i.done ? "done" : "analyzing"}: {i.name}
            </div>
          ))}
        </div>
      )}

      <div className="crate-rail">
        <button className={`chip-btn${activeCrateId === null ? " active" : ""}`} onClick={() => setActiveCrateId(null)}>
          All tracks ({lib.tracks.length})
        </button>
        {crates.crates.map((c) => (
          <button
            key={c.id}
            className={`chip-btn${activeCrateId === c.id ? " active" : ""}`}
            onClick={() => setActiveCrateId(c.id)}
            title={c.kind === "smart" ? "Smart crate (rule-based)" : "Manual crate"}
          >
            {c.kind === "smart" ? "⚡" : "\u{1F4C1}"} {c.name} ({lib.tracks.filter((t) => trackInCrate(t, c)).length})
            <span
              className="chip-x"
              onClick={(e) => {
                e.stopPropagation();
                if (activeCrateId === c.id) setActiveCrateId(null);
                crates.remove(c.id);
              }}
            >
              &times;
            </span>
          </button>
        ))}
        <button
          className="btn compact"
          onClick={() => {
            const name = window.prompt("Manual crate name?");
            if (name && name.trim()) crates.createManual(name.trim());
          }}
        >
          + Manual
        </button>
        <button className="btn compact" onClick={() => setShowSmartForm((v) => !v)}>
          + Smart
        </button>
      </div>

      {showSmartForm && (
        <SmartCrateForm
          onCreate={(name, rule) => {
            crates.createSmart(name, rule);
            setShowSmartForm(false);
          }}
          onCancel={() => setShowSmartForm(false)}
        />
      )}

      <div className="library-grid">
        <div className="panel" style={{ padding: 16, overflowX: "auto" }}>
          <div className="section-title">
            {activeCrate ? activeCrate.name : "Library"} ({filtered.length})
          </div>
          <input
            className="field"
            placeholder="Search name, genre, key..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <table className="tracklist">
            <thead>
              <tr>
                <th>Name</th>
                <th>BPM</th>
                <th>Key</th>
                <th>Energy</th>
                <th>Genre</th>
                <th>Last played</th>
                {activeCrate?.kind === "manual" && <th>In crate</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td title={t.name}>{t.name.length > 20 ? `${t.name.slice(0, 18)}...` : t.name}</td>
                  <td>{t.bpm > 0 ? t.bpm.toFixed(1) : "?"}</td>
                  <td>{t.camelot || "?"}</td>
                  <td>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={t.energy}
                      style={{ width: 54 }}
                      onChange={(e) => lib.edit({ ...t, energy: parseInt(e.target.value, 10) })}
                    />
                  </td>
                  <td>
                    <input
                      className="field"
                      style={{ width: 56 }}
                      value={t.genre}
                      placeholder="genre"
                      onChange={(e) => lib.edit({ ...t, genre: e.target.value })}
                    />
                  </td>
                  <td>
                    {t.lastPlayedAt
                      ? new Date(t.lastPlayedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "never"}
                  </td>
                  {activeCrate?.kind === "manual" && (
                    <td>
                      <input
                        type="checkbox"
                        checked={activeCrate.trackIds.includes(t.id)}
                        onChange={() => crates.toggleTrack(activeCrate, t.id)}
                      />
                    </td>
                  )}
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn compact" onClick={() => decks.loadToDeck(0, t)} title="Load to Deck A">
                        A
                      </button>
                      <button className="btn compact" onClick={() => decks.loadToDeck(1, t)} title="Load to Deck B">
                        B
                      </button>
                      <button className="btn compact" onClick={() => lib.remove(t.id)} title="Remove from library">
                        &times;
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ color: "var(--ink-dim)" }}>
                    {lib.tracks.length === 0 ? "No tracks yet -- import some above." : "No tracks match this crate/search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="section-title">RadicalAI &middot; next-track suggestions</div>
          <div className="row">
            <label>Reference</label>
            <select className="field" style={{ flex: 1 }} value={reference?.id ?? ""} onChange={(e) => setRefId(e.target.value)}>
              {lib.tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {masterDeckTrack?.id === t.id ? "(playing)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label>Target energy</label>
            <input
              type="range"
              min={-1}
              max={10}
              value={targetEnergy}
              onChange={(e) => setTargetEnergy(parseInt(e.target.value, 10))}
            />
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, width: 60 }}>
              {targetEnergy < 0 ? "match ref" : targetEnergy}
            </span>
          </div>

          {!reference && <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>Import at least one track to get suggestions.</p>}

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
                <button className="btn small" onClick={() => decks.loadToDeck(0, t)}>
                  A
                </button>
                <button className="btn small" onClick={() => decks.loadToDeck(1, t)}>
                  B
                </button>
                <button className="btn small" onClick={() => nudgeBias(t, 0.25)} title="Favor this suggestion more often">
                  +
                </button>
                <button className="btn small" onClick={() => nudgeBias(t, -0.25)} title="Suggest this less often">
                  -
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
