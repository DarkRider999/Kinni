package com.nocternal.playz.lighting

/**
 * Hardware lighting backend contract. All credentials are caller-supplied at runtime —
 * nothing is hardcoded in the implementations.
 */
interface ExternalLightingController {
    fun connect(host: String, port: Int, token: String)
    fun disconnect()
    fun isConnected(): Boolean
    fun setColor(r: Int, g: Int, b: Int, brightness: Float)
    fun strobe(bpm: Float)
    fun pulse(durationMs: Long)
    fun blackout()
}

/** Philips Hue bridge stub. Token = HUE username obtained via /api endpoint. */
class HueController : ExternalLightingController {
    private var connected = false
    override fun connect(host: String, port: Int, token: String) { connected = true }
    override fun disconnect() { connected = false }
    override fun isConnected() = connected
    override fun setColor(r: Int, g: Int, b: Int, brightness: Float) = Unit
    override fun strobe(bpm: Float) = Unit
    override fun pulse(durationMs: Long) = Unit
    override fun blackout() = Unit
}

/** WLED HTTP/JSON stub (default port 80). Token = optional WLED password. */
class WledController : ExternalLightingController {
    private var connected = false
    override fun connect(host: String, port: Int, token: String) { connected = true }
    override fun disconnect() { connected = false }
    override fun isConnected() = connected
    override fun setColor(r: Int, g: Int, b: Int, brightness: Float) = Unit
    override fun strobe(bpm: Float) = Unit
    override fun pulse(durationMs: Long) = Unit
    override fun blackout() = Unit
}

/** Nanoleaf OpenAPI stub (default port 16021). Token = Nanoleaf auth token. */
class NanoleafController : ExternalLightingController {
    private var connected = false
    override fun connect(host: String, port: Int, token: String) { connected = true }
    override fun disconnect() { connected = false }
    override fun isConnected() = connected
    override fun setColor(r: Int, g: Int, b: Int, brightness: Float) = Unit
    override fun strobe(bpm: Float) = Unit
    override fun pulse(durationMs: Long) = Unit
    override fun blackout() = Unit
}

/** Art-Net / DMX over UDP stub (default port 6454). Token unused. */
class DmxController : ExternalLightingController {
    private var connected = false
    override fun connect(host: String, port: Int, token: String) { connected = true }
    override fun disconnect() { connected = false }
    override fun isConnected() = connected
    override fun setColor(r: Int, g: Int, b: Int, brightness: Float) = Unit
    override fun strobe(bpm: Float) = Unit
    override fun pulse(durationMs: Long) = Unit
    override fun blackout() = Unit
}

/** Govee LAN API stub (default port 4003). Token = Govee device SKU/IP resolved at runtime. */
class GoveeController : ExternalLightingController {
    private var connected = false
    override fun connect(host: String, port: Int, token: String) { connected = true }
    override fun disconnect() { connected = false }
    override fun isConnected() = connected
    override fun setColor(r: Int, g: Int, b: Int, brightness: Float) = Unit
    override fun strobe(bpm: Float) = Unit
    override fun pulse(durationMs: Long) = Unit
    override fun blackout() = Unit
}

/** Factory — returns the correct stub for the requested brand. */
object LightingControllerFactory {
    enum class Brand { HUE, WLED, NANOLEAF, DMX, GOVEE }

    fun create(brand: Brand): ExternalLightingController = when (brand) {
        Brand.HUE -> HueController()
        Brand.WLED -> WledController()
        Brand.NANOLEAF -> NanoleafController()
        Brand.DMX -> DmxController()
        Brand.GOVEE -> GoveeController()
    }
}
