package com.subzero.messenger.ui.safezone.games

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/** Pattern Match (Simon): watch the sequence light up, then repeat it. */
@Composable
fun PatternMatchGame() {
    val colors = listOf(Color(0xFF35E0C4), Color(0xFFE05A5A), Color(0xFFE0C435), Color(0xFF5A8CE0))
    var sequence by remember { mutableStateOf(listOf(seedStep())) }
    var userIndex by remember { mutableStateOf(0) }
    var highlight by remember { mutableStateOf(-1) }
    var showing by remember { mutableStateOf(true) }
    var level by remember { mutableStateOf(1) }
    var failed by remember { mutableStateOf(false) }

    LaunchedEffect(sequence, showing) {
        if (showing) {
            delay(400)
            for (step in sequence) { highlight = step; delay(450); highlight = -1; delay(200) }
            showing = false; userIndex = 0
        }
    }

    fun tap(i: Int) {
        if (showing) return
        if (i == sequence[userIndex]) {
            userIndex++
            if (userIndex == sequence.size) {
                level++; sequence = sequence + seedStep(); showing = true
            }
        } else failed = true
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Pattern Match", color = Color(0xFF35E0C4), fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(if (failed) "Missed! Reached level $level"
             else if (showing) "Watch…" else "Repeat (level $level)",
            color = Color.Gray, fontSize = 14.sp)
        Spacer(Modifier.height(24.dp))
        for (r in 0 until 2) {
            Row {
                for (c in 0 until 2) {
                    val i = r * 2 + c
                    Box(
                        Modifier.padding(8.dp).size(100.dp).clip(RoundedCornerShape(16.dp))
                            .background(colors[i].copy(alpha = if (highlight == i) 1f else 0.35f))
                            .clickable(enabled = !failed) { tap(i) },
                    )
                }
            }
        }
    }
}

private fun seedStep(): Int = (0..3).random()
