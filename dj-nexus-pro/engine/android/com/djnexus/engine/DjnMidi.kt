package com.djnexus.engine

import android.content.Context
import android.content.pm.PackageManager
import android.media.midi.MidiDevice
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiInputPort
import android.media.midi.MidiManager
import android.media.midi.MidiOutputPort
import android.media.midi.MidiReceiver
import android.os.Handler
import android.os.Looper

/**
 * Connects USB / Bluetooth MIDI controllers to the DJ Nexus engine on Android.
 *
 * The engine has no MIDI ports of its own on Android. This class receives
 * bytes from android.media.midi and hands them to the engine's mapping
 * (djn_midi_feed), and sends the engine's LED feedback (djn_midi_read_output)
 * back to the controller.
 *
 * `midiHandle` is the pointer returned by djn_midi_create(engine, 0), passed
 * from Dart as an int (its service thread handles jog timing and LEDs). The app must
 * load libdjnexus.so before using this class (Flutter does when it opens the
 * library through dart:ffi; otherwise call System.loadLibrary("djnexus")).
 *
 * Requires <uses-feature android:name="android.software.midi" android:required="false"/>.
 */
class DjnMidi(context: Context, private val midiHandle: Long) {
    private val manager: MidiManager? =
        if (context.packageManager.hasSystemFeature(PackageManager.FEATURE_MIDI)) {
            context.getSystemService(Context.MIDI_SERVICE) as MidiManager?
        } else {
            null
        }
    private val handler = Handler(Looper.getMainLooper())
    private var device: MidiDevice? = null
    private var fromController: MidiOutputPort? = null  // controller -> app
    private var toController: MidiInputPort? = null     // app -> controller (LEDs)
    private val ledBuffer = ByteArray(1024)

    /** Controllers that can be opened: name and the info needed to open them. */
    @Suppress("DEPRECATION") // getDevices() still works on API 33+; getDevicesForTransport adds UMP devices we don't use
    fun devices(): List<Pair<String, MidiDeviceInfo>> =
        manager?.devices?.filter { it.outputPortCount > 0 }?.map { info ->
            val p = info.properties
            val name = p.getString(MidiDeviceInfo.PROPERTY_NAME)
                ?: listOfNotNull(p.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER),
                                 p.getString(MidiDeviceInfo.PROPERTY_PRODUCT)).joinToString(" ")
            name to info
        } ?: emptyList()

    /** Opens a controller (closing any previous one). `onOpened` runs on the main thread. */
    fun open(info: MidiDeviceInfo, onOpened: (Boolean) -> Unit = {}) {
        val m = manager ?: return onOpened(false)
        close()
        m.openDevice(info, { dev ->
            if (dev == null) {
                onOpened(false)
                return@openDevice
            }
            device = dev
            // Port naming is from the device's point of view: its *output* port
            // carries what the controller sends.
            fromController = dev.openOutputPort(0)?.also { it.connect(receiver) }
            if (info.inputPortCount > 0) toController = dev.openInputPort(0)
            handler.post(ledPump)
            onOpened(fromController != null)
        }, handler)
    }

    fun close() {
        handler.removeCallbacks(ledPump)
        fromController?.let { it.disconnect(receiver); it.close() }
        toController?.close()
        device?.close()
        fromController = null
        toController = null
        device = null
    }

    private val receiver = object : MidiReceiver() {
        override fun onSend(msg: ByteArray, offset: Int, count: Int, timestamp: Long) {
            nativeFeed(midiHandle, msg, offset, count)
        }
    }

    // LED feedback: drain the engine's queue every 10 ms.
    private val ledPump = object : Runnable {
        override fun run() {
            val port = toController
            while (true) {
                val n = nativeReadOutput(midiHandle, ledBuffer)
                if (n <= 0) break
                try {
                    port?.send(ledBuffer, 0, n)
                } catch (e: java.io.IOException) {
                    break  // unplugged: the next open() starts over
                }
            }
            handler.postDelayed(this, 10)
        }
    }

    companion object {
        @JvmStatic external fun nativeFeed(handle: Long, data: ByteArray, offset: Int, count: Int)
        @JvmStatic external fun nativeReadOutput(handle: Long, buffer: ByteArray): Int
    }
}
