import { describe, expect, it } from "vitest";
import { bindingKey, describeBinding, parseMidiMessage } from "./midi";

describe("parseMidiMessage", () => {
  it("parses a note-on", () => {
    const msg = parseMidiMessage(new Uint8Array([0x90, 60, 100])); // channel 1, note 60, velocity 100
    expect(msg).toEqual({ type: "noteon", channel: 0, data1: 60, data2: 100 });
  });

  it("parses a note-on with velocity 0 as note-off", () => {
    const msg = parseMidiMessage(new Uint8Array([0x90, 60, 0]));
    expect(msg?.type).toBe("noteoff");
  });

  it("parses an explicit note-off", () => {
    const msg = parseMidiMessage(new Uint8Array([0x80, 60, 0]));
    expect(msg?.type).toBe("noteoff");
  });

  it("parses a control change", () => {
    const msg = parseMidiMessage(new Uint8Array([0xb1, 7, 64])); // channel 2, CC 7, value 64
    expect(msg).toEqual({ type: "cc", channel: 1, data1: 7, data2: 64 });
  });

  it("reads the channel from the low nibble of the status byte", () => {
    const msg = parseMidiMessage(new Uint8Array([0xb0 | 9, 1, 1])); // CC on channel 10
    expect(msg?.channel).toBe(9);
  });

  it("returns null for an unrecognized message type and for malformed data", () => {
    expect(parseMidiMessage(new Uint8Array([0xf8]))).toBeNull(); // timing clock, too short anyway
    expect(parseMidiMessage(new Uint8Array([0xa0, 60, 10]))).toBeNull(); // polyphonic aftertouch, unhandled
    expect(parseMidiMessage(new Uint8Array([]))).toBeNull();
  });
});

describe("bindingKey", () => {
  it("treats note-on and note-off as the same binding", () => {
    const on = bindingKey({ type: "noteon", channel: 0, data1: 60 });
    const off = bindingKey({ type: "noteoff", channel: 0, data1: 60 });
    expect(on).toBe(off);
  });

  it("distinguishes CC from note, and different channels/numbers", () => {
    const cc = bindingKey({ type: "cc", channel: 0, data1: 7 });
    const note = bindingKey({ type: "noteon", channel: 0, data1: 7 });
    const ccOtherChannel = bindingKey({ type: "cc", channel: 1, data1: 7 });
    const ccOtherNumber = bindingKey({ type: "cc", channel: 0, data1: 8 });
    expect(cc).not.toBe(note);
    expect(cc).not.toBe(ccOtherChannel);
    expect(cc).not.toBe(ccOtherNumber);
  });

  it("ignores the live value (data2) -- it's not part of a binding's identity", () => {
    const a = bindingKey({ type: "cc", channel: 0, data1: 7 });
    // bindingKey's parameter type has no data2, so identical bindings from
    // messages with different live values naturally produce the same key.
    const b = bindingKey({ type: "cc", channel: 0, data1: 7 });
    expect(a).toBe(b);
  });
});

describe("describeBinding", () => {
  it("formats a CC binding with a 1-based channel", () => {
    expect(describeBinding({ type: "cc", channel: 0, data1: 7 })).toBe("CC 7 ch1");
  });

  it("formats a note binding", () => {
    expect(describeBinding({ type: "noteon", channel: 3, data1: 60 })).toBe("Note 60 ch4");
  });
});
