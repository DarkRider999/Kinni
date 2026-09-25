package com.nocternal.playz.audio

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import com.nocternal.playz.fx.OutputRoute
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Tracks where audio goes (speaker, wired, Bluetooth) for speaker boost, safe mode and EQ advice. */
class OutputRouteMonitor(context: Context) {
    private val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val _route = MutableStateFlow(current())
    val route: StateFlow<OutputRoute> = _route.asStateFlow()

    private val callback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) { _route.value = current() }
        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) { _route.value = current() }
    }

    fun start() = am.registerAudioDeviceCallback(callback, Handler(Looper.getMainLooper()))
    fun stop() = am.unregisterAudioDeviceCallback(callback)

    private fun current(): OutputRoute {
        val types = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).map { it.type }.toSet()
        return when {
            types.any { it in WIRED } -> OutputRoute.WIRED_HEADPHONES
            types.any { it in BLUETOOTH } -> OutputRoute.BLUETOOTH
            else -> OutputRoute.SPEAKER
        }
    }

    private companion object {
        val WIRED = setOf(AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_USB_HEADSET)
        val BLUETOOTH = setOf(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO, 26 /* TYPE_BLE_HEADSET */, 27 /* TYPE_BLE_SPEAKER */)
    }
}
