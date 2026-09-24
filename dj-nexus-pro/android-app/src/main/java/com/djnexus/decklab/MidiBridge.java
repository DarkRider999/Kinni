package com.djnexus.decklab;

import android.content.Context;
import android.content.pm.PackageManager;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiInputPort;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Connects android.media.midi to the page. The page sees a Web MIDI API
 * (assets/midi-shim.js); bytes from a controller are passed to
 * window.__djnMidiHost.message(), and the page's LED bytes come back through
 * {@link #send}. Methods marked @JavascriptInterface run on the WebView's
 * bridge thread.
 */
final class MidiBridge {
    private final Context context;
    private final WebView web;
    private final MidiManager manager;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<Integer, Opened> opened = new HashMap<>();  // guarded by this
    private final Set<Integer> opening = new HashSet<>();         // guarded by this
    private final MidiManager.DeviceCallback deviceCallback;

    private static final class Opened {
        MidiDevice device;
        MidiOutputPort fromDevice;  // what the controller sends
        MidiInputPort toDevice;     // LEDs
    }

    @SuppressWarnings("deprecation")  // registerDeviceCallback(Handler): the Executor form is API 33+
    MidiBridge(Context context, WebView web) {
        this.context = context;
        this.web = web;
        MidiManager m = null;
        if (context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_MIDI)) {
            m = (MidiManager) context.getSystemService(Context.MIDI_SERVICE);
        }
        manager = m;
        deviceCallback = new MidiManager.DeviceCallback() {
            @Override
            public void onDeviceAdded(MidiDeviceInfo info) {
                notifyChanged();
            }

            @Override
            public void onDeviceRemoved(MidiDeviceInfo info) {
                closeDevice(info.getId());
                notifyChanged();
            }
        };
        if (manager != null) manager.registerDeviceCallback(deviceCallback, main);
    }

    /** Installs navigator.requestMIDIAccess in the page (called after each load). */
    void injectShim() {
        try (InputStream in = context.getAssets().open("midi-shim.js")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) bytes.write(buf, 0, n);
            web.evaluateJavascript(new String(bytes.toByteArray(), StandardCharsets.UTF_8), null);
        } catch (IOException ignored) {
        }
    }

    @SuppressWarnings("deprecation")
    private Collection<MidiDeviceInfo> deviceInfos() {
        List<MidiDeviceInfo> list = new ArrayList<>();
        if (manager == null) return list;
        if (Build.VERSION.SDK_INT >= 33) {
            list.addAll(manager.getDevicesForTransport(MidiManager.TRANSPORT_MIDI_BYTE_STREAM));
        } else {
            for (MidiDeviceInfo info : manager.getDevices()) list.add(info);
        }
        return list;
    }

    private MidiDeviceInfo find(int id) {
        for (MidiDeviceInfo info : deviceInfos()) {
            if (info.getId() == id) return info;
        }
        return null;
    }

    /** JSON list: [{id, name, manufacturer, inputs, outputs}] from the page's point of view. */
    @JavascriptInterface
    public String devices() {
        JSONArray out = new JSONArray();
        for (MidiDeviceInfo info : deviceInfos()) {
            try {
                Bundle p = info.getProperties();
                String name = p.getString(MidiDeviceInfo.PROPERTY_NAME);
                if (name == null) name = p.getString(MidiDeviceInfo.PROPERTY_PRODUCT, "MIDI device " + info.getId());
                JSONObject d = new JSONObject();
                d.put("id", info.getId());
                d.put("name", name);
                d.put("manufacturer", p.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER, ""));
                d.put("inputs", info.getOutputPortCount());   // device outputs = page inputs
                d.put("outputs", info.getInputPortCount());
                out.put(d);
            } catch (Exception ignored) {
            }
        }
        return out.toString();
    }

    /** Opens a device (once); its messages then flow to the page. */
    @JavascriptInterface
    public void open(final int id) {
        synchronized (this) {
            if (manager == null || opened.containsKey(id) || opening.contains(id)) return;
            opening.add(id);
        }
        main.post(() -> {
            MidiDeviceInfo info = find(id);
            if (info == null) {
                synchronized (MidiBridge.this) { opening.remove(id); }
                return;
            }
            manager.openDevice(info, device -> {
                synchronized (MidiBridge.this) { opening.remove(id); }
                if (device == null) return;
                Opened o = new Opened();
                o.device = device;
                if (info.getOutputPortCount() > 0) {
                    o.fromDevice = device.openOutputPort(0);
                    if (o.fromDevice != null) o.fromDevice.connect(new Receiver(id));
                }
                if (info.getInputPortCount() > 0) o.toDevice = device.openInputPort(0);
                synchronized (MidiBridge.this) { opened.put(id, o); }
            }, main);
        });
    }

    /** Bytes from the page (comma-separated decimal) to a device. */
    @JavascriptInterface
    public void send(int id, String csv) {
        MidiInputPort port;
        synchronized (this) {
            Opened o = opened.get(id);
            port = o != null ? o.toDevice : null;
        }
        if (port == null || csv == null || csv.isEmpty()) return;
        String[] parts = csv.split(",");
        byte[] bytes = new byte[parts.length];
        try {
            for (int i = 0; i < parts.length; i++) bytes[i] = (byte) Integer.parseInt(parts[i].trim());
            port.send(bytes, 0, bytes.length);
        } catch (NumberFormatException | IOException ignored) {
        }
    }

    private final class Receiver extends MidiReceiver {
        private final int id;

        Receiver(int id) {
            this.id = id;
        }

        @Override
        public void onSend(byte[] msg, int offset, int count, long timestamp) {
            StringBuilder js = new StringBuilder(48 + count * 4);
            js.append("window.__djnMidiHost&&window.__djnMidiHost.message(").append(id).append(",[");
            for (int i = 0; i < count; i++) {
                if (i > 0) js.append(',');
                js.append(msg[offset + i] & 0xFF);
            }
            js.append("])");
            final String script = js.toString();
            main.post(() -> web.evaluateJavascript(script, null));
        }
    }

    private void notifyChanged() {
        main.post(() -> web.evaluateJavascript("window.__djnMidiHost&&window.__djnMidiHost.changed()", null));
    }

    private void closeDevice(int id) {
        Opened o;
        synchronized (this) { o = opened.remove(id); }
        if (o == null) return;
        try {
            if (o.fromDevice != null) o.fromDevice.close();
            if (o.toDevice != null) o.toDevice.close();
            o.device.close();
        } catch (IOException ignored) {
        }
    }

    void close() {
        if (manager != null) manager.unregisterDeviceCallback(deviceCallback);
        List<Integer> ids;
        synchronized (this) { ids = new ArrayList<>(opened.keySet()); }
        for (int id : ids) closeDevice(id);
    }
}
