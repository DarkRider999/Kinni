package com.nocternal.playz.offline

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class NetworkState(val online: Boolean, val unmetered: Boolean, val wifi: Boolean = false, val cellular: Boolean = false)

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
        // INTERNET is enough: "validated" is often missing on mobile data and some Wi-Fi, which made the app
        // think it was offline while it wasn't.
        val online = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        return NetworkState(
            online = online,
            unmetered = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED),
            wifi = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET),
            cellular = caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR),
        )
    }
}
