package com.subzero.messenger.ui.safezone.games

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Convincing loading/idle screen for games whose full logic is not yet built.
 * Keeps the SafeZone flow believable end-to-end. Replace with the real game as
 * each is implemented (see [GameRegistry]).
 */
@Composable
fun PlaceholderGame(name: String) {
    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(name, color = Color(0xFF35E0C4), fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text("Loading…", color = Color.Gray, fontSize = 16.sp)
    }
}
