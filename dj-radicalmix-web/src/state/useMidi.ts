import { useCallback, useEffect, useRef, useState } from "react";
import { bindingKey, isMidiSupported, parseMidiMessage, type MidiMessage } from "../lib/midi";

const STORAGE_KEY = "dj-radicalmix-midi-mappings";

// The fixed set of controllable actions. Covers the controls an external
// mixer/controller is actually likely to send (transport + fader + cross-
// fader) rather than every knob in the app -- see docs/dj-radicalmix Sec 2
// Issue 18. `kind` decides how an incoming message's value is interpreted:
// a "button" action fires once per note-on/CC-press; a "fader" action gets
// the live 0..1 value on every message (noteon/cc alike).
export interface MidiAction {
  id: string;
  label: string;
  kind: "button" | "fader";
}

export const MIDI_ACTIONS: MidiAction[] = [
  { id: "deckA.playPause", label: "Deck A: Play/Pause", kind: "button" },
  { id: "deckA.cue", label: "Deck A: Cue", kind: "button" },
  { id: "deckB.playPause", label: "Deck B: Play/Pause", kind: "button" },
  { id: "deckB.cue", label: "Deck B: Cue", kind: "button" },
  { id: "crossfader", label: "Crossfader", kind: "fader" },
  { id: "deckA.fader", label: "Deck A: Channel Fader", kind: "fader" },
  { id: "deckB.fader", label: "Deck B: Channel Fader", kind: "fader" },
];

type Binding = Pick<MidiMessage, "type" | "channel" | "data1">;
type Mappings = Record<string, Binding>; // actionId -> binding

function loadMappings(): Mappings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Mappings) : {};
  } catch {
    return {};
  }
}

function saveMappings(m: Mappings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    /* localStorage unavailable (private mode, quota) -- mappings just won't persist */
  }
}

export type MidiHandlers = Partial<Record<string, (value: number) => void>>;

export function useMidi(handlers: MidiHandlers) {
  const [supported] = useState(isMidiSupported());
  const [deviceNames, setDeviceNames] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Mappings>(() => loadMappings());
  const [learning, setLearning] = useState<string | null>(null);
  // Mirrored into refs (updated in an effect, not during render) so the
  // MIDI message handler below -- registered once and not re-subscribed on
  // every prop/state change -- always reads the latest values.
  const handlersRef = useRef(handlers);
  const learningRef = useRef<string | null>(null);
  const mappingsRef = useRef<Mappings>(mappings);
  useEffect(() => {
    handlersRef.current = handlers;
    learningRef.current = learning;
    mappingsRef.current = mappings;
  }, [handlers, learning, mappings]);

  useEffect(() => {
    if (!supported) return;
    let access: MIDIAccess | null = null;
    const onMessage = (e: MIDIMessageEvent) => {
      if (!e.data) return;
      const msg = parseMidiMessage(e.data);
      if (!msg) return;

      if (learningRef.current) {
        const key = learningRef.current;
        const binding: Binding = { type: msg.type === "noteoff" ? "noteon" : msg.type, channel: msg.channel, data1: msg.data1 };
        setMappings((prev) => {
          const next = { ...prev, [key]: binding };
          saveMappings(next);
          return next;
        });
        setLearning(null);
        return;
      }

      const key = bindingKey(msg);
      for (const action of MIDI_ACTIONS) {
        const binding = mappingsRef.current[action.id];
        if (!binding || bindingKey(binding) !== key) continue;
        const handler = handlersRef.current[action.id];
        if (!handler) continue;
        if (action.kind === "button") {
          if (msg.type !== "noteoff") handler(1);
        } else {
          handler(msg.data2 / 127);
        }
      }
    };

    const attachAll = (acc: MIDIAccess) => {
      setDeviceNames(Array.from(acc.inputs.values()).map((i) => i.name ?? "Unknown device"));
      acc.inputs.forEach((input) => {
        input.onmidimessage = onMessage;
      });
    };

    navigator
      .requestMIDIAccess()
      .then((acc) => {
        access = acc;
        attachAll(acc);
        acc.onstatechange = () => attachAll(acc);
      })
      .catch(() => setDeviceNames([]));

    return () => {
      if (access) access.inputs.forEach((input) => (input.onmidimessage = null));
    };
  }, [supported]);

  const startLearning = useCallback((actionId: string) => setLearning(actionId), []);
  const cancelLearning = useCallback(() => setLearning(null), []);
  const clearMapping = useCallback((actionId: string) => {
    setMappings((prev) => {
      const next = { ...prev };
      delete next[actionId];
      saveMappings(next);
      return next;
    });
  }, []);

  return { supported, deviceNames, mappings, learning, startLearning, cancelLearning, clearMapping };
}
