package com.nocternal.playz.app

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.nocternal.playz.fx.FxSettings
import com.nocternal.playz.model.AppSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

private val Context.dataStore by preferencesDataStore("settings")

/** App settings persisted in DataStore as one JSON document (the same shape the backup uses). */
class SettingsRepository(private val context: Context, private val scope: CoroutineScope) {
    private val key = stringPreferencesKey("app_settings")
    private val secretKey = stringPreferencesKey("audd_token")
    private val fxKey = stringPreferencesKey("active_fx")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }

    val settings: StateFlow<AppSettings> = context.dataStore.data
        .map { prefs -> prefs[key]?.let { runCatching { json.decodeFromString(AppSettings.serializer(), it) }.getOrNull() } ?: AppSettings() }
        .stateIn(scope, SharingStarted.Eagerly, AppSettings())

    /** Music-recognition (AudD) token, kept outside [AppSettings] so it is never backed up. */
    val recognitionToken: StateFlow<String?> = context.dataStore.data.map { it[secretKey] }.stateIn(scope, SharingStarted.Eagerly, null)

    fun update(block: (AppSettings) -> AppSettings) = scope.launch {
        context.dataStore.edit { prefs ->
            val current = prefs[key]?.let { runCatching { json.decodeFromString(AppSettings.serializer(), it) }.getOrNull() } ?: AppSettings()
            prefs[key] = json.encodeToString(AppSettings.serializer(), block(current))
        }
    }

    fun setRecognitionToken(token: String?) = scope.launch {
        context.dataStore.edit { if (token.isNullOrBlank()) it.remove(secretKey) else it[secretKey] = token.trim() }
    }

    /**
     * The live EQ/FX chain (bands, bass boost, reverb, etc.) persisted so it survives an app restart —
     * spec: "Saved EQ presets" / "Audio Settings" must restore automatically when the app reopens.
     * A genuine suspend read (not the eagerly-defaulted [settings] StateFlow) so the caller gets the real
     * saved value rather than a default racing ahead of disk I/O.
     */
    suspend fun loadActiveFx(): FxSettings? = context.dataStore.data
        .map { prefs -> prefs[fxKey]?.let { runCatching { json.decodeFromString(FxSettings.serializer(), it) }.getOrNull() } }
        .first()

    fun saveActiveFx(fx: FxSettings) = scope.launch {
        context.dataStore.edit { it[fxKey] = json.encodeToString(FxSettings.serializer(), fx) }
    }
}
