package com.subzero.messenger.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.subzero.messenger.R
import com.subzero.messenger.data.AppPreferences
import com.subzero.messenger.data.RelaySettings
import com.subzero.messenger.identity.AppIdentity
import com.subzero.messenger.identity.IdentityManager
import com.subzero.messenger.ui.theme.FadedBackdrop

/**
 * One place for every setting: connection (relay), app lock, disappearing
 * messages, disguise identity, vault, and secure wipe.
 */
@Composable
fun SettingsScreen(
    relay: RelaySettings,
    prefs: AppPreferences,
    identity: IdentityManager,
    onApplyRestart: () -> Unit,   // recreate the activity so changes take effect
    onOpenVault: () -> Unit,
    onSecureLogout: () -> Unit,
    onBack: () -> Unit,
) {
    val neon = Color(0xFF35E0C4)
    var url by remember { mutableStateOf(relay.url) }
    var self by remember { mutableStateOf(relay.selfAddress) }
    var peer by remember { mutableStateOf(relay.peerAddress) }
    var lock by remember { mutableStateOf(prefs.appLockEnabled) }
    var ttl by remember { mutableStateOf(prefs.disappearingSeconds) }

    FadedBackdrop(image = R.drawable.bg2) {
     Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
    ) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("‹  Back", color = neon, fontSize = 18.sp, modifier = Modifier.clickable { onBack() })
            Spacer(Modifier.weight(1f))
            Text("Settings", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }

        // --- Connection ---
        Section("Connect over the internet") {
            Text("Deploy the relay (see the guide), then paste its address. Leave blank to stay on this phone only.",
                color = Color(0xFF9AA0A6), fontSize = 13.sp, modifier = Modifier.padding(bottom = 6.dp))
            LabeledField("Relay URL", "wss://your-relay.onrender.com", url) { url = it }
            LabeledField("Your address", "e.g. roshan", self) { self = it }
            LabeledField("Their address", "e.g. anjali", peer) { peer = it }
            Row(Modifier.padding(top = 8.dp)) {
                Button(onClick = { relay.save(url, self, peer); onApplyRestart() }, modifier = Modifier.weight(1f)) {
                    Text("Save & connect")
                }
                Spacer(Modifier.width(12.dp))
                OutlinedButton(onClick = { relay.save("", "", ""); url = ""; self = ""; peer = ""; onApplyRestart() },
                    modifier = Modifier.weight(1f)) { Text("Go offline") }
            }
        }

        // --- App lock ---
        Section("App lock") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Require fingerprint / face to open", color = Color.White, fontSize = 15.sp)
                    Text("Off by default. When on, unlock with a button + biometrics.",
                        color = Color(0xFF667079), fontSize = 12.sp)
                }
                Switch(checked = lock, onCheckedChange = { lock = it; prefs.appLockEnabled = it })
            }
        }

        // --- Disappearing messages ---
        Section("Disappearing messages") {
            val options = listOf(0 to "Off", 60 to "1 min", 3600 to "1 hour", 86400 to "1 day")
            Row {
                options.forEach { (secs, label) ->
                    val selected = ttl == secs
                    Box(
                        Modifier.padding(end = 8.dp).clip(RoundedCornerShape(20.dp))
                            .background(if (selected) neon else Color(0xFF1B2530))
                            .clickable { ttl = secs; prefs.disappearingSeconds = secs; onApplyRestart() }
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                    ) { Text(label, color = if (selected) Color.Black else Color.White, fontSize = 13.sp) }
                }
            }
        }

        // --- Disguise identity ---
        Section("Disguise (home-screen name & icon)") {
            AppIdentity.entries.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                    row.forEach { id ->
                        Box(
                            Modifier.weight(1f).padding(end = 8.dp).clip(RoundedCornerShape(20.dp))
                                .background(Color(0xFF1B2530))
                                .clickable { identity.switchTo(id) }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center,
                        ) { Text(id.label, color = Color.White, fontSize = 13.sp) }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
            Text("Changes the icon + name on the home screen. Still visible in system Settings.",
                color = Color(0xFF667079), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }

        // --- Vault & privacy ---
        Section("Vault & privacy") {
            Button(onClick = onOpenVault, modifier = Modifier.fillMaxWidth()) { Text("Open encrypted vault") }
            Spacer(Modifier.height(10.dp))
            OutlinedButton(onClick = onSecureLogout, modifier = Modifier.fillMaxWidth()) {
                Text("Secure logout (wipe messages now)", color = Color(0xFFE05A5A))
            }
        }

        Section("About") {
            Text("SubZero 0.1 — private, end-to-end encrypted messenger.",
                color = Color(0xFF9AA0A6), fontSize = 13.sp)
            Text("Encryption: X3DH + Double Ratchet. No cloud backup. No evidence-destruction features by design.",
                color = Color(0xFF667079), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }
        Spacer(Modifier.height(24.dp))
     }
    }
}

@Composable
private fun Section(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp)) {
        Text(title.uppercase(), color = Color(0xFF35E0C4), fontSize = 12.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 8.dp))
        content()
        HorizontalDivider(Modifier.padding(top = 14.dp), color = Color(0xFF1B2530))
    }
}

@Composable
private fun LabeledField(label: String, hint: String, value: String, onChange: (String) -> Unit) {
    Column(Modifier.padding(vertical = 4.dp)) {
        Text(label, color = Color(0xFF9AA0A6), fontSize = 12.sp)
        OutlinedTextField(
            value = value, onValueChange = onChange, singleLine = true,
            placeholder = { Text(hint, color = Color(0xFF667079)) },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
