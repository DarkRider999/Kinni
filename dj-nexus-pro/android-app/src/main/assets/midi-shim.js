// Web MIDI for Android's WebView, which has none: navigator.requestMIDIAccess
// backed by android.media.midi through the DJNexusMidiHost bridge
// (MidiBridge.java). Enough of the API for Deck Lab: inputs with
// onmidimessage, outputs with send(), onstatechange, sysexEnabled.
(function () {
  "use strict";
  var host = window.DJNexusMidiHost;
  if (!host || window.__djnMidiHost) return;
  var access = null, ports = {};

  function port(key, props) {
    if (!ports[key]) ports[key] = props;
    ports[key].state = "connected";
    return ports[key];
  }

  function refresh() {
    var list = JSON.parse(host.devices()), inputs = new Map(), outputs = new Map();
    list.forEach(function (d) {
      if (d.inputs > 0) {
        var i = port("i" + d.id, { id: "i" + d.id, name: d.name, manufacturer: d.manufacturer || "", type: "input", onmidimessage: null });
        inputs.set(i.id, i);
      }
      if (d.outputs > 0) {
        var o = port("o" + d.id, { id: "o" + d.id, name: d.name, manufacturer: d.manufacturer || "", type: "output", dev: d.id,
          send: function (data) { host.send(this.dev, Array.prototype.join.call(data, ",")); } });
        outputs.set(o.id, o);
      }
      host.open(d.id);
    });
    access.inputs = inputs;
    access.outputs = outputs;
  }

  window.__djnMidiHost = {
    message: function (dev, bytes) {
      var p = ports["i" + dev];
      if (p && p.onmidimessage) p.onmidimessage({ data: new Uint8Array(bytes), target: p, timeStamp: performance.now() });
    },
    changed: function () {
      if (!access) return;
      refresh();
      if (access.onstatechange) access.onstatechange({});
    }
  };

  navigator.requestMIDIAccess = function () {
    if (!access) {
      access = { sysexEnabled: true, inputs: new Map(), outputs: new Map(), onstatechange: null };
      try { refresh(); } catch (e) { return Promise.reject(e); }
    }
    return Promise.resolve(access);
  };
})();
