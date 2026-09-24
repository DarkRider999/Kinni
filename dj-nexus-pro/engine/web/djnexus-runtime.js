// DJ Nexus engine runtime for the browser. Wraps the WebAssembly build (or its
// wasm2js fallback) with a small JS API. Works both inside an AudioWorklet and
// on the main thread, so it is written as a classic script that sets a global.
(function () {
  "use strict";

  // Deck fields exposed by djnw_deck() (see src/web/djnexus_web.cpp).
  var DECK_FIELDS = ["loaded", "playing", "keyLock", "sync", "slip", "reverse", "looping", "master",
    "position", "duration", "trackBpm", "effectiveBpm", "rate", "beatPhase", "loopStart", "loopEnd",
    "cue", "peakL", "peakR"];
  var ENGINE_FIELDS = ["masterPeakL", "masterPeakR", "limiterDb", "dspLoad", "masterDeck", "clockBpm",
    "samplerLoadedLo", "samplerLoadedHi", "samplerPlayingLo", "samplerPlayingHi"];
  var FX_FIELDS = ["on", "type", "target", "tail", "beats", "depth", "wet"];
  var DECKS = 2, FX_UNITS = 2;

  function Runtime() {
    this.exports = null;
    this.memory = null;
    this.engine = 0;
    this.mode = "";
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

  Runtime.prototype.initWasm = function (bytes, sampleRate) {
    var self = this;
    return WebAssembly.instantiate(bytes, { wasi_snapshot_preview1: this.wasiImports() }).then(function (r) {
      self.exports = r.instance.exports;
      self.memory = self.exports.memory;
      self.mode = "WebAssembly";
      self._start(sampleRate);
    });
  };

  Runtime.prototype.initAsm = function (sampleRate) {
    if (typeof globalThis.DJNexusAsm !== "function") throw new Error("JS fallback not loaded");
    var env = this.wasiImports();
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
