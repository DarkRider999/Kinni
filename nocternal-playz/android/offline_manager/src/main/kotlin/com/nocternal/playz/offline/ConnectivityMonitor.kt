package com.nocternal.playz.offline

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class NetworkState(val online: Boolean, val unmetered: Boolean)

class ConnectivityMonitor(context: Context) {
    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val _state = MutableStateFlow(read())
    val state: StateFlow<NetworkState> = _state.asStateFlow()

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { _state.value = read() }
        override fun onLost(network: Network) { _state.value = read() }
        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) { _state.value = read() }
    }

    fun start() = cm.registerDefaultNetworkCallback(callback)
    fun stop() = runCatching { cm.unregisterNetworkCallback(callback) }

    private fun read(): NetworkState {
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return NetworkState(false, false)
        val online = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        return NetworkState(online, caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED))
    }
}
