package com.nocternal.playz.app

import android.app.Application
import com.nocternal.playz.audio.AudioEngine
import com.nocternal.playz.audio.AudioEngineHost

class NocternalApplication : Application(), AudioEngineHost {
    lateinit var container: AppContainer
        private set
    lateinit var actions: ActionExecutor
        private set

    override val audioEngine: AudioEngine get() = container.audio

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        actions = ActionExecutor(container)
        container.start()
    }
}
