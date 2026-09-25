// DJ Nexus engine runtime for the browser. Wraps the WebAssembly build (or its
// wasm2js fallback) with a small JS API. Works both inside an AudioWorklet and
// on the main thread, so it is written as a classic script that sets a global.
(function () {
  "use strict";

  // Deck fields exposed by djnw_deck() (see src/web/djnexus_web.cpp).
  var DECK_FIELDS = ["loaded", "playing", "keyLock", "sync", "slip", "reverse", "looping", "master",
    "position", "duration", "trackBpm", "effectiveBpm", "rate", "beatPhase", "loopStart", "loopEnd",
    "cue", "peakL", "peakR", "slipRoll", "censor", "trackId", "stemsLoaded",
    "stemDrums", "stemBass", "stemVocals", "stemOther"];
  var ENGINE_FIELDS = ["masterPeakL", "masterPeakR", "limiterDb", "dspLoad", "masterDeck", "clockBpm",
    "samplerLoadedLo", "samplerLoadedHi", "samplerPlayingLo", "samplerPlayingHi",
    "colorFx", "colorParam", "macro", "macroTarget", "macroProgress", "macroBeatsLeft"];
  var FX_FIELDS = ["on", "type", "target", "tail", "beats", "depth", "wet"];
  var DECKS = 2, FX_UNITS = 2;

  function Runtime() {
    this.exports = null;
    this.memory = null;
    this.engine = 0;
    this.mode = "";
    this.midiPtr = 0;
    this.midiBuf = 0;
    this.stateSize = DECKS * DECK_FIELDS.length + ENGINE_FIELDS.length + FX_UNITS * FX_FIELDS.length;
  }

  // WASI imports. The engine only needs a clock and (for fatal messages) stdout.
  Runtime.prototype.wasiImports = function () {
    var self = this;
    function view() { return new DataView(self.memory.buffer); }
    return {
      clock_time_get: function () {
        var ptr = arguments[arguments.length - 1];  // i64 args differ between wasm and wasm2js
        var ns = Date.now() * 1e6;
        var dv = view();
        dv.setUint32(ptr, ns % 4294967296, true);
        dv.setUint32(ptr + 4, Math.floor(ns / 4294967296), true);
        return 0;
      },
      fd_write: function (fd, iovs, count, nwritten) {
        var dv = view(), total = 0, text = "";
        for (var i = 0; i < count; i++) {
          var p = dv.getUint32(iovs + i * 8, true), n = dv.getUint32(iovs + i * 8 + 4, true);
          var bytes = new Uint8Array(self.memory.buffer, p, n);
          for (var k = 0; k < n; k++) text += String.fromCharCode(bytes[k]);
          total += n;
        }
        dv.setUint32(nwritten, total, true);
        if (text.trim()) console.warn("[djnexus] " + text.trim());
        return 0;
      },
      fd_close: function () { return 0; },
      fd_seek: function () { return 70; }  // ESPIPE
    };
  };

  // Functions the engine calls back into (progress of long jobs).
  Runtime.prototype.envImports = function () {
    var self = this;
    return {
      djnw_on_progress: function (p) { return self.onProgress && self.onProgress(p) ? 1 : 0; }
    };
  };

  Runtime.prototype.initWasm = function (bytes, sampleRate) {
    var self = this;
    return WebAssembly.instantiate(bytes, { wasi_snapshot_preview1: this.wasiImports(), env: this.envImports() })
      .then(function (r) {
      self.exports = r.instance.exports;
      self.memory = self.exports.memory;
      self.mode = "WebAssembly";
      self._start(sampleRate);
    });
  };

  Runtime.prototype.initAsm = function (sampleRate) {
    if (typeof globalThis.DJNexusAsm !== "function") throw new Error("JS fallback not loaded");
    var env = this.wasiImports();
    var extra = this.envImports();
    for (var k in extra) env[k] = extra[k];
    env.setTempRet0 = function () {};
    env.abort = function () { throw new Error("engine abort"); };
    this.exports = globalThis.DJNexusAsm(env);
    this.memory = this.exports.memory;
    this.mode = "JavaScript";
    this._start(sampleRate);
  };

  Runtime.prototype._start = function (sampleRate) {
    this.exports.__wasm_call_ctors();
    this.engine = this.exports.djnw_create(sampleRate, DECKS);
    if (!this.engine) throw new Error("engine create failed");
    this.exports.djn_mixer_set_xfader_assign(this.engine, 0, 1);  // deck A -> crossfader A
    this.exports.djn_mixer_set_xfader_assign(this.engine, 1, 2);  // deck B -> crossfader B
  };

  // Calls any djn_* function; the engine handle is prepended automatically.
  Runtime.prototype.call = function (fn, args) {
    var f = this.exports[fn];
    if (typeof f !== "function") throw new Error("no such engine function: " + fn);
    return f.apply(null, [this.engine].concat(args || []));
  };

  Runtime.prototype.load = function (deck, left, right, sampleRate, bpm, firstBeat) {
    var n = left.length;
    var ptr = this.exports.djnw_malloc(n * 8);
    if (!ptr) return -3;  // DJN_ERR_NO_MEMORY
    var f = new Float32Array(this.memory.buffer, ptr, n * 2);
    for (var i = 0, j = 0; i < n; i++, j += 2) {
      f[j] = left[i];
      f[j + 1] = right[i];
    }
    var r = this.exports.djnw_load(this.engine, deck, ptr, n, 2, sampleRate, bpm, firstBeat);
    this.exports.djnw_free(ptr);
    this.exports.djn_engine_collect_garbage(this.engine);
    return r;
  };

  Runtime.prototype.loadSample = function (slot, left, right, sampleRate, bpm) {
    var n = left.length;
    var ptr = this.exports.djnw_malloc(n * 8);
    if (!ptr) return -3;
    var f = new Float32Array(this.memory.buffer, ptr, n * 2);
    for (var i = 0, j = 0; i < n; i++, j += 2) {
      f[j] = left[i];
      f[j + 1] = right[i];
    }
    var r = this.exports.djnw_sampler_load(this.engine, slot, ptr, n, 2, sampleRate, bpm);
    this.exports.djnw_free(ptr);
    this.exports.djn_engine_collect_garbage(this.engine);
    return r;
  };

  Runtime.prototype.render = function (outL, outR, frames) {
    var done = 0;
    while (done < frames) {
      var n = Math.min(4096, frames - done);
      var ptr = this.exports.djnw_render(this.engine, n);
      var f = new Float32Array(this.memory.buffer, ptr, n * 2);
      for (var i = 0; i < n; i++) {
        outL[done + i] = f[2 * i];
        outR[done + i] = f[2 * i + 1];
      }
      done += n;
    }
  };

  // ---------------------------------------------------------------- MIDI
  // The web build has no MIDI ports of its own: the page receives Web MIDI
  // messages and passes the bytes in; LED bytes come back from midiService().
  // Strings cross the boundary as UTF-8 (TextEncoder isn't available inside
  // an AudioWorklet, hence the small codec).
  function utf8Encode(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.codePointAt(i);
      if (c > 0xffff) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function utf8Decode(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length;) {
      var b = bytes[i++], c;
      if (b < 0x80) c = b;
      else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++] & 63);
      else if (b < 0xf0) { c = ((b & 15) << 12) | ((bytes[i] & 63) << 6) | (bytes[i + 1] & 63); i += 2; }
      else { c = ((b & 7) << 18) | ((bytes[i] & 63) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3; }
      s += String.fromCodePoint(c);
    }
    return s;
  }

  // Copies bytes (plus a terminator when `cstring`) into engine memory.
  Runtime.prototype._bytesIn = function (bytes, cstring) {
    var ptr = this.exports.djnw_malloc(bytes.length + 1);
    if (!ptr) throw new Error("out of memory");
    var m = new Uint8Array(this.memory.buffer, ptr, bytes.length + 1);
    m.set(bytes);
    m[bytes.length] = 0;
    return ptr;
  };

  Runtime.prototype._midiHandle = function () {
    if (!this.midiPtr) {
      this.midiPtr = this.exports.djn_midi_create(this.engine, 1);  // DJN_MIDI_MANUAL_SERVICE
      if (!this.midiPtr) throw new Error("MIDI create failed");
      this.midiBuf = this.exports.djnw_malloc(1024);
    }
    return this.midiPtr;
  };

  // One entry point for every MIDI operation, so the page can post the same
  // request to a worklet or call it directly:
  // op = feed | load | get | learn | info | builtins | builtinText | match.
  Runtime.prototype.midi = function (op, arg) {
    var ex = this.exports, m = this._midiHandle(), ptr, r;
    if (op === "feed") {
      ptr = this._bytesIn(arg, false);
      r = ex.djn_midi_feed(m, ptr, arg.length);
      ex.djnw_free(ptr);
      return r;
    }
    if (op === "load") {  // returns "" or the error message
      ptr = this._bytesIn(utf8Encode(arg), true);
      var err = ex.djnw_malloc(256);
      r = ex.djn_midi_load_mapping(m, ptr, err, 256);
      var msg = r === 0 ? "" : utf8Decode(this._cstring(err));
      ex.djnw_free(err);
      ex.djnw_free(ptr);
      return msg;
    }
    if (op === "get") {
      var n = ex.djn_midi_get_mapping(m, 0, 0);
      ptr = ex.djnw_malloc(n + 1);
      ex.djn_midi_get_mapping(m, ptr, n + 1);
      var text = utf8Decode(new Uint8Array(this.memory.buffer, ptr, n));
      ex.djnw_free(ptr);
      return text;
    }
    if (op === "learn") {  // arg: action text, or null to cancel
      if (arg == null) return ex.djn_midi_learn(m, 0);
      ptr = this._bytesIn(utf8Encode(arg), true);
      r = ex.djn_midi_learn(m, ptr);
      ex.djnw_free(ptr);
      return r;
    }
    if (op === "builtins") {  // [{id, name}] of the mappings built into the engine
      var list = [];
      for (var i = 0; i < ex.djn_midi_builtin_count(); i++) {
        list.push({ id: utf8Decode(this._cstring(ex.djn_midi_builtin_id(i))),
          name: utf8Decode(this._cstring(ex.djn_midi_builtin_name(i))) });
      }
      return list;
    }
    if (op === "builtinText") {
      ptr = this._bytesIn(utf8Encode(arg), true);
      r = ex.djn_midi_builtin_text(ptr);
      ex.djnw_free(ptr);
      return r ? utf8Decode(this._cstring(r)) : null;
    }
    if (op === "match") {  // port name -> built-in mapping id, or null
      ptr = this._bytesIn(utf8Encode(arg), true);
      r = ex.djn_midi_builtin_for_device(ptr);
      ex.djnw_free(ptr);
      return r ? utf8Decode(this._cstring(r)) : null;
    }
    if (op === "info") {  // learning flag and the last message received
      var len = ex.djn_midi_last_message(m, this.midiBuf);
      return { learning: ex.djn_midi_learning(m), last: Array.from(new Uint8Array(this.memory.buffer, this.midiBuf, len)) };
    }
    throw new Error("unknown MIDI op " + op);
  };

  Runtime.prototype._cstring = function (ptr) {
    var m = new Uint8Array(this.memory.buffer), end = ptr;
    while (m[end]) end++;
    return m.subarray(ptr, end);
  };

  // Jog timing and LED feedback; returns the LED bytes to send (or null).
  // Call every few milliseconds with a monotonic time in seconds.
  Runtime.prototype.midiService = function (seconds) {
    if (!this.midiPtr) return null;
    this.exports.djn_midi_service(this.midiPtr, seconds);
    var n = this.exports.djn_midi_read_output(this.midiPtr, this.midiBuf, 1024);
    return n > 0 ? new Uint8Array(this.memory.buffer.slice(this.midiBuf, this.midiBuf + n)) : null;
  };

  // ---------------------------------------------------------------- analysis
  // Tempo, beat grid (first downbeat) and key of a whole track. Blocking: run
  // it in a Worker (djnexus-analyzer.js), not on the audio thread.
  Runtime.prototype.analyze = function (left, right, sampleRate, minBpm, maxBpm) {
    var ex = this.exports, n = left.length;
    var ptr = ex.djnw_malloc(n * 8);
    if (!ptr) throw new Error("out of memory");
    var f = new Float32Array(this.memory.buffer, ptr, n * 2);
    for (var i = 0, j = 0; i < n; i++, j += 2) {
      f[j] = left[i];
      f[j + 1] = right[i];
    }
    var r = ex.djnw_analyze(ptr, n, 2, sampleRate, minBpm || 0, maxBpm || 0);
    ex.djnw_free(ptr);
    if (r !== 0) throw new Error("analysis failed (" + r + ")");
    var num = function (k) { return ex.djnw_analysis_num(k); };
    var str = function (k) { return utf8Decode(this._cstring(ex.djnw_analysis_str(k))); }.bind(this);
    return {
      bpm: num(0), firstBeat: num(1), bpmConfidence: num(2), downbeatConfidence: num(3), tempoStable: !!num(4),
      key: num(5), keyConfidence: num(6), tuningCents: num(7), keyName: str(0), camelot: str(1), openKey: str(2)
    };
  };

  // ---------------------------------------------------------------- stems
  // Splits a track into drums, bass and vocals (other = the rest). Blocking:
  // run it in a Worker. onProgress(0..1) may return true to cancel.
  // Returns {drums: [L, R], bass: [L, R], vocals: [L, R]} (Float32Arrays).
  Runtime.prototype.separate = function (left, right, sampleRate, onProgress) {
    var ex = this.exports, n = left.length, bytes = n * 8;
    var inPtr = ex.djnw_malloc(bytes), d = ex.djnw_malloc(bytes), b = ex.djnw_malloc(bytes), v = ex.djnw_malloc(bytes);
    try {
      if (!inPtr || !d || !b || !v) throw new Error("not enough memory to split this track");
      var f = new Float32Array(this.memory.buffer, inPtr, n * 2);
      for (var i = 0, j = 0; i < n; i++, j += 2) { f[j] = left[i]; f[j + 1] = right[i]; }
      this.onProgress = onProgress || null;
      var r = ex.djnw_separate(inPtr, n, 2, sampleRate, d, b, v);
      this.onProgress = null;
      if (r === -8) throw new Error("cancelled");
      if (r !== 0) throw new Error("stem separation failed (" + r + ")");
      var mem = this.memory.buffer;
      var planar = function (ptr) {
        var x = new Float32Array(mem, ptr, n * 2), L = new Float32Array(n), R = new Float32Array(n);
        for (var i = 0, j = 0; i < n; i++, j += 2) { L[i] = x[j]; R[i] = x[j + 1]; }
        return [L, R];
      };
      return { drums: planar(d), bass: planar(b), vocals: planar(v) };
    } finally {
      [inPtr, d, b, v].forEach(function (p) { if (p) ex.djnw_free(p); });
    }
  };

  // Attaches stems (planar pairs from separate()) to the track on `deck`.
  Runtime.prototype.loadStems = function (deck, trackId, parts, sampleRate) {
    var ex = this.exports, n = parts.drums[0].length, ptrs = [];
    try {
      ["drums", "bass", "vocals"].forEach(function (k) {
        var p = ex.djnw_malloc(n * 8);
        if (!p) throw new Error("not enough memory for stems");
        ptrs.push(p);
        var f = new Float32Array(this.memory.buffer, p, n * 2), L = parts[k][0], R = parts[k][1];
        for (var i = 0, j = 0; i < n; i++, j += 2) { f[j] = L[i]; f[j + 1] = R[i]; }
      }, this);
      return ex.djnw_load_stems(this.engine, deck, trackId, ptrs[0], ptrs[1], ptrs[2], n, 2, sampleRate);
    } finally {
      ptrs.forEach(function (p) { ex.djnw_free(p); });
      ex.djn_engine_collect_garbage(this.engine);
    }
  };

  // Packs the current engine state into a Float64Array (see unpack()).
  Runtime.prototype.state = function (out) {
    out = out || new Float64Array(this.stateSize);
    this.exports.djnw_poll(this.engine);
    var k = 0;
    for (var d = 0; d < DECKS; d++) {
      for (var f = 0; f < DECK_FIELDS.length; f++) out[k++] = this.exports.djnw_deck(d, f);
    }
    for (var e = 0; e < ENGINE_FIELDS.length; e++) out[k++] = this.exports.djnw_engine(e);
    for (var u = 0; u < FX_UNITS; u++) {
      for (var x = 0; x < FX_FIELDS.length; x++) out[k++] = this.exports.djnw_fx(u, x);
    }
    return out;
  };

  Runtime.unpack = function (a) {
    var s = { decks: [] }, k = 0;
    for (var d = 0; d < DECKS; d++) {
      var o = {};
      for (var f = 0; f < DECK_FIELDS.length; f++) o[DECK_FIELDS[f]] = a[k++];
      s.decks.push(o);
    }
    for (var e = 0; e < ENGINE_FIELDS.length; e++) s[ENGINE_FIELDS[e]] = a[k++];
    s.fx = [];
    for (var u = 0; u < FX_UNITS; u++) {
      var fx = {};
      for (var x = 0; x < FX_FIELDS.length; x++) fx[FX_FIELDS[x]] = a[k++];
      s.fx.push(fx);
    }
    // Sampler masks as bit tests: slot n playing?
    s.samplerLoaded = function (n) { return ((n < 32 ? s.samplerLoadedLo : s.samplerLoadedHi) >>> (n % 32)) & 1; };
    s.samplerPlaying = function (n) { return ((n < 32 ? s.samplerPlayingLo : s.samplerPlayingHi) >>> (n % 32)) & 1; };
    return s;
  };

  globalThis.DJNexusRuntime = Runtime;
})();
