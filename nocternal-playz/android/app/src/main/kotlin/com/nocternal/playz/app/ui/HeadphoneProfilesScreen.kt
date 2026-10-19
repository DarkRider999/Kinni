package com.nocternal.playz.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nocternal.playz.app.AppContainer
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonButton
import com.nocternal.playz.model.HeadphoneProfile
import com.nocternal.playz.theme.EqPresets
import com.nocternal.playz.theme.HeadphoneProfileCatalog

/** Headphone Profiles (spec #12): built-in brand EQ tunings, plus saving the active EQ as a custom one. */
@Composable
fun HeadphoneProfilesScreen(c: AppContainer, onBack: () -> Unit) {
    val p = Neon.palette
    val settings by c.settingsRepo.settings.collectAsStateWithLifecycle()
    var newName by remember { mutableStateOf("") }

    fun apply(profile: HeadphoneProfile) {
        val presetId = profile.eqPresetId
        val gains = profile.customGainsDb
        if (presetId != null) {
            c.audio.applyPreset(EqPresets.byId(presetId))
        } else if (gains != null) {
            c.audio.updateFx { it.copy(eqEnabled = true, eqGainsDb = gains) }
        }
    }

    fun saveCurrentAsProfile(name: String) {
        if (name.isBlank()) return
        val fx = c.audio.fxSettings.value
        val profile = HeadphoneProfile(id = "hp_custom_" + System.currentTimeMillis(), name = name.trim(), customGainsDb = fx.eqGainsDb, isUserCreated = true)
        c.settingsRepo.update { it.copy(headphoneProfiles = it.headphoneProfiles + profile) }
        newName = ""
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, "Back", tint = p.onBackground) }
            Text("Headphone Profiles", style = MaterialTheme.typography.headlineSmall, color = p.onBackground)
        }
        LazyColumn(contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Text("Built-in", color = p.muted, style = MaterialTheme.typography.labelSmall) }
            items(HeadphoneProfileCatalog.all, key = { it.id }) { profile -> ProfileRow(profile) { apply(profile) } }

            item { Text("Yours", color = p.muted, style = MaterialTheme.typography.labelSmall) }
            if (settings.headphoneProfiles.isEmpty()) {
                item { Text("No custom profiles yet — dial in an EQ, then save it below.", color = p.muted, style = MaterialTheme.typography.bodySmall) }
            }
            items(settings.headphoneProfiles, key = { it.id }) { profile ->
                ProfileRow(profile, onDelete = { c.settingsRepo.update { s -> s.copy(headphoneProfiles = s.headphoneProfiles.filterNot { it.id == profile.id }) } }) { apply(profile) }
            }

            item {
                GlowCard(Modifier.fillMaxWidth()) {
                    Text("Save the currently active EQ as a new profile", color = p.muted, style = MaterialTheme.typography.labelSmall)
                    OutlinedTextField(
                        value = newName, onValueChange = { newName = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                        placeholder = { Text("e.g. My Studio Monitors", color = p.muted) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent, unfocusedBorderColor = p.muted),
                    )
                    NeonButton("Save profile") { saveCurrentAsProfile(newName) }
                }
            }
        }
    }
}

@Composable
private fun ProfileRow(profile: HeadphoneProfile, onDelete: (() -> Unit)? = null, onApply: () -> Unit) {
    val p = Neon.palette
    GlowCard(Modifier.fillMaxWidth(), onClick = onApply) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Headphones, null, tint = p.accent)
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(profile.name, color = p.onBackground, style = MaterialTheme.typography.bodyMedium)
                Text(if (profile.isUserCreated) "Custom profile" else "Built-in", color = p.muted, style = MaterialTheme.typography.labelSmall)
            }
            if (onDelete != null) IconButton(onClick = onDelete) { Icon(Icons.Filled.Close, "Remove", tint = p.muted) }
        }
    }
}
