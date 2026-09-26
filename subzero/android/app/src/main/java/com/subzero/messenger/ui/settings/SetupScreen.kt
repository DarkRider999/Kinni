package com.subzero.messenger.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.subzero.messenger.data.RelaySettings

/**
 * First-run / settings screen for connecting the two phones over the internet.
 * Paste the deployed relay URL and pick two agreed addresses — no code editing.
 * Saving persists the settings; the caller restarts the app to reconnect.
 */
@Composable
fun SetupScreen(settings: RelaySettings, onSaved: () -> Unit, onBack: () -> Unit) {
    var url by remember { mutableStateOf(settings.url) }
    var self by remember { mutableStateOf(settings.selfAddress) }
    var peer by remember { mutableStateOf(settings.peerAddress) }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B0F14)).verticalScroll(rememberScrollState()),
    ) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("‹", color = Color(0xFF35E0C4), fontSize = 28.sp, modifier = Modifier.clickable { onBack() })
            Spacer(Modifier.width(12.dp))
            Text("Connection setup", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }

        Text(
            "To message over the internet, deploy the relay server (see the guide) " +
                "and paste its address here. Leave blank to stay fully on-device.",
            color = Color(0xFF9AA0A6), fontSize = 14.sp,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
        )

        Field("Relay URL", "wss://your-relay.onrender.com", url) { url = it }
        Field("Your address", "e.g. roshan", self) { self = it }
        Field("Their address", "e.g. priya", peer) { peer = it }

        Text(
            "Tip: use the same two addresses on both phones, but swap which is " +
                "“yours” and “theirs”. Pick hard-to-guess words.",
            color = Color(0xFF667079), fontSize = 12.sp,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        )

        Row(Modifier.fillMaxWidth().padding(20.dp)) {
            Button(
                onClick = { settings.save(url, self, peer); onSaved() },
                modifier = Modifier.weight(1f),
            ) { Text("Save & connect") }
            Spacer(Modifier.width(12.dp))
            OutlinedButton(
                onClick = { settings.save("", "", ""); url = ""; self = ""; peer = ""; onSaved() },
                modifier = Modifier.weight(1f),
            ) { Text("Go offline") }
        }
    }
}

@Composable
private fun Field(label: String, hint: String, value: String, onChange: (String) -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
        Text(label, color = Color(0xFF35E0C4), fontSize = 13.sp)
        OutlinedTextField(
            value = value, onValueChange = onChange, singleLine = true,
            placeholder = { Text(hint, color = Color(0xFF667079)) },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
