package com.subzero.messenger.ui.safezone.games

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.random.Random

/** Bubble Pop: tap bubbles before they escape. 30-second round. */
@Composable
fun BubblePopGame() {
    data class Bubble(val id: Long, val xFrac: Float, val yFrac: Float, val size: Int, val color: Color)

    var bubbles by remember { mutableStateOf(listOf<Bubble>()) }
    var score by remember { mutableStateOf(0) }
    var timeLeft by remember { mutableStateOf(30) }
    var box by remember { mutableStateOf(IntSize.Zero) }
    val palette = listOf(Color(0xFF35E0C4), Color(0xFFE05A5A), Color(0xFFE0C435), Color(0xFF5A8CE0))
    val over = timeLeft <= 0

    LaunchedEffect(Unit) {
        var id = 0L
        while (timeLeft > 0) {
            delay(1000); timeLeft--
            bubbles = bubbles.takeLast(4) + Bubble(
                id++, Random.nextFloat() * 0.8f, Random.nextFloat() * 0.8f,
                (48..88).random(), palette.random(),
            )
        }
        bubbles = emptyList()
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Bubble Pop", color = Color(0xFF35E0C4), fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(if (over) "Time! Score $score" else "⏱ $timeLeft   ★ $score", color = Color.Gray, fontSize = 14.sp)
        Spacer(Modifier.height(8.dp))
        Box(Modifier.weight(1f).fillMaxWidth().onSizeChanged { box = it }) {
            bubbles.forEach { b ->
                Box(
                    Modifier
                        .absoluteOffset(
                            x = with(androidx.compose.ui.platform.LocalDensity.current) { (b.xFrac * box.width).toDp() },
                            y = with(androidx.compose.ui.platform.LocalDensity.current) { (b.yFrac * box.height).toDp() },
                        )
                        .size(b.size.dp).clip(CircleShape).background(b.color)
                        .clickable {
                            score++; bubbles = bubbles.filterNot { it.id == b.id }
                        },
                )
            }
        }
    }
}
