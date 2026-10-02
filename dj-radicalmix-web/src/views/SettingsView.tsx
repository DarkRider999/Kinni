import { useRef, useState } from "react";
import { engine } from "../engine/engineBridge";
import type { useEngine } from "../state/useEngine";
import type { useSessionLog } from "../state/useSessionLog";

function Recorder({ sessionLog }: { sessionLog: ReturnType<typeof useSessionLog> }) {
  const [recording, setRecording] = useState(false);
  const [audioDownload, setAudioDownload] = useState<{ url: string; filename: string } | null>(null);
  const [tracklistDownload, setTracklistDownload] = useState<{ url: string; filename: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  const start = () => {
    const stream = engine.startRecordTap();
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const stamp = Date.now();
      const blob = new Blob(chunksRef.current, { type: mime });
      setAudioDownload((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob), filename: `radicalmix-set-${stamp}.webm` };
      });
      const tracklistBlob = new Blob([sessionLog.toText(startedAtRef.current)], { type: "text/plain" });
      setTracklistDownload((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(tracklistBlob), filename: `radicalmix-set-${stamp}-tracklist.txt` };
      });
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Record the set</h3>
      <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>
        Captures the master bus (post-limiter) as compressed audio (WebM/Opus -- a browser's MediaRecorder can't
        produce WAV/FLAC directly; that needs a native build, see docs/dj-radicalmix Sec 3 Issue 13), plus a
        tracklist built automatically from every track loaded to a deck during the recording.
      </p>
      <div className="transport">
        {!recording ? (
          <button className="btn primary" onClick={start}>
            Start recording
          </button>
        ) : (
          <button className="btn" onClick={stop}>
            Stop recording
          </button>
        )}
      </div>
      <div className="transport">
        {audioDownload && (
          <a className="btn small" href={audioDownload.url} download={audioDownload.filename}>
            Download audio (.webm)
          </a>
        )}
        {tracklistDownload && (
          <a className="btn small" href={tracklistDownload.url} download={tracklistDownload.filename}>
            Download tracklist (.txt)
          </a>
        )}
      </div>
    </div>
  );
}

export function SettingsView({ eng, sessionLog }: { eng: ReturnType<typeof useEngine>; sessionLog: ReturnType<typeof useSessionLog> }) {
  const s = eng.state;
  return (
    <div className="grid2">
      <div className="panel" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Engine</h3>
        <dl className="kv">
          <dt>Mode</dt>
          <dd>{eng.mode}</dd>
          <dt>Thread</dt>
          <dd>{eng.thread}</dd>
          <dt>DSP load</dt>
          <dd>{s ? `${(s.dspLoad * 100).toFixed(1)}%` : "--"}</dd>
          <dt>Master peak L/R</dt>
          <dd>{s ? `${s.masterPeakL.toFixed(2)} / ${s.masterPeakR.toFixed(2)}` : "--"}</dd>
          <dt>Limiter reduction</dt>
          <dd>{s ? `${s.limiterDb.toFixed(1)} dB` : "--"}</dd>
          <dt>Clock BPM</dt>
          <dd>{s ? s.clockBpm.toFixed(1) : "--"}</dd>
        </dl>
      </div>
      <Recorder sessionLog={sessionLog} />
      <div className="panel" style={{ padding: 16, gridColumn: "1 / -1" }}>
        <h3 style={{ marginTop: 0 }}>About this build</h3>
        <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
          DJ RadicalMix -- SplitFire Production, browser build. The audio engine (decks, mixer, EQ/filter,
          beat FX, colour FX, macros, sampler) is the real DJ Nexus Pro C++ engine compiled to WebAssembly --
          not a simulation. BPM/key detection and the RadicalAI next-track advisor are JS ports of that
          engine's native, unit-tested analyzer and scoring formula.
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
          What this build does <em>not</em> include: the 10,000+ licensed sampler/plugin library (the pads
          here are synthesized placeholders), stem separation/vocal removal (needs a trained ML model),
          cloud sync and a master-access account (needs a deployed backend), and app-store billing. See{" "}
          <code>docs/dj-radicalmix/SPEC.md</code> for the full picture of what is and isn't built.
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
          Everything here runs locally in this browser tab: your library is stored in this browser's IndexedDB
          and never leaves your device.
        </p>
      </div>
    </div>
  );
}
