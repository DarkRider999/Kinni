import { useMemo, useRef, useState } from "react";
import { explainSuggestion, scoreNextTrack, type TrackInfo } from "../engine/advisor";
import { secondsSincePlayed, type Track } from "../lib/library";
import type { useDecks } from "../state/useDecks";
import type { useEngine } from "../state/useEngine";
import type { useLibrary } from "../state/useLibrary";

function toTrackInfo(t: Track): TrackInfo {
  return {
    bpm: t.bpm,
    keyPitchClass: t.keyPitchClass,
    keyIsMinor: t.keyIsMinor,
    energy: t.energy,
    genre: t.genre,
    secondsSincePlayed: secondsSincePlayed(t),
    userBias: t.userBias,
  };
}

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

export function LibraryView({
  lib,
  decks,
  eng,
}: {
  lib: ReturnType<typeof useLibrary>;
  decks: ReturnType<typeof useDecks>;
  eng: ReturnType<typeof useEngine>;
}) {
  const [query, setQuery] = useState("");
  const [refId, setRefId] = useState<string>("");
  const [targetEnergy, setTargetEnergy] = useState(-1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lib.tracks;
    return lib.tracks.filter(
      (t) => t.name.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || t.camelot.toLowerCase().includes(q),
    );
  }, [lib.tracks, query]);

  const masterDeckTrack = eng.state && eng.state.masterDeck >= 0 ? decks.deckTracks[eng.state.masterDeck]?.track : undefined;
  const reference = lib.tracks.find((t) => t.id === refId) ?? masterDeckTrack ?? lib.tracks[0];

  const suggestions = useMemo(() => {
    if (!reference) return [];
    const current = toTrackInfo(reference);
    return lib.tracks
      .filter((t) => t.id !== reference.id)
      .map((t) => {
        const s = scoreNextTrack(current, toTrackInfo(t), targetEnergy);
        return { track: t, score: s, reason: explainSuggestion(current, toTrackInfo(t), s) };
      })
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, 6);
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

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="panel" style={{ padding: 16, overflowX: "auto" }}>
          <div className="section-title">Library ({lib.tracks.length})</div>
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
                  <td colSpan={7} style={{ color: "var(--ink-dim)" }}>
                    No tracks yet -- import some above.
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
