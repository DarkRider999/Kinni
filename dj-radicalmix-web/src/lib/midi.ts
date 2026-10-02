// Generic MIDI controller support via the Web MIDI API -- "compatible with
// any external mixer/controller hardware" (docs/dj-radicalmix Sec 2 Issue 18,
// "Complex Setup for External Gear"). Rather than hardcoding per-device
// layouts (which would only cover the handful of controllers anyone bothered
// to map), this uses MIDI Learn: click Learn, move the physical control, and
// whatever message it sends gets bound -- works with literally any class-
// compliant MIDI device, old or new, cheap or expensive.
//
// Supported in Chrome/Edge/Opera (over HTTPS or localhost); not in Safari or
// Firefox without a flag. isMidiSupported() lets the UI degrade gracefully.

export function isMidiSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
}

export type MidiMessageType = "noteon" | "noteoff" | "cc";

export interface MidiMessage {
  type: MidiMessageType;
  channel: number; // 0-15
  data1: number; // note number or CC number
  data2: number; // velocity or CC value, 0-127
}

/** Parses a raw MIDI message (as delivered by MIDIInput.onmidimessage). */
export function parseMidiMessage(data: Uint8Array): MidiMessage | null {
  if (data.length < 2) return null;
  const status = data[0];
  const channel = status & 0x0f;
  const command = status & 0xf0;
  const data1 = data[1];
  const data2 = data.length > 2 ? data[2] : 0;

  if (command === 0x90 && data2 > 0) return { type: "noteon", channel, data1, data2 };
  // A note-on with velocity 0 is conventionally a note-off.
  if (command === 0x90 || command === 0x80) return { type: "noteoff", channel, data1, data2 };
  if (command === 0xb0) return { type: "cc", channel, data1, data2 };
  return null;
}

/** A mapping's identity -- everything except the live value (data2). Two
 * messages "match" the same binding when their bindingKey()s are equal. */
export function bindingKey(msg: Pick<MidiMessage, "type" | "channel" | "data1">): string {
  const kind = msg.type === "noteoff" ? "noteon" : msg.type; // bind on note-on, trigger on both
  return `${kind}:${msg.channel}:${msg.data1}`;
}

/** A short, human-readable label for a binding, e.g. "CC 7 ch1" or "Note 60 ch1". */
export function describeBinding(msg: Pick<MidiMessage, "type" | "channel" | "data1">): string {
  const chan = msg.channel + 1;
  return msg.type === "cc" ? `CC ${msg.data1} ch${chan}` : `Note ${msg.data1} ch${chan}`;
}
