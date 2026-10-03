package com.subzero.messenger.ui.safezone.games

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.math.abs

/** Classic Snake. Swipe to steer; grows on eating food; ends on self/wall hit. */
@Composable
fun SnakeGame() {
    val cols = 16; val rows = 24
    var snake by remember { mutableStateOf(listOf(7 to 12, 7 to 13, 7 to 14)) }
    var dir by remember { mutableStateOf(0 to -1) } // moving up
    var food by remember { mutableStateOf(5 to 5) }
    var alive by remember { mutableStateOf(true) }
    var score by remember { mutableStateOf(0) }

    fun reset() {
        snake = listOf(7 to 12, 7 to 13, 7 to 14); dir = 0 to -1
        food = (0 until cols).random() to (0 until rows).random(); alive = true; score = 0
    }

    LaunchedEffect(alive) {
        while (alive) {
            delay(140)
            val head = snake.first()
            val next = ((head.first + dir.first + cols) % cols) to ((head.second + dir.second + rows) % rows)
            if (snake.contains(next)) { alive = false; break }
            val grew = next == food
            snake = listOf(next) + if (grew) snake else snake.dropLast(1)
            if (grew) {
                score += 10
                do { food = (0 until cols).random() to (0 until rows).random() } while (snake.contains(food))
            }
        }
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(16.dp)
            .pointerInput(Unit) {
                var dx = 0f; var dy = 0f
                detectDragGestures(
                    onDragStart = { dx = 0f; dy = 0f },
                    onDragEnd = {
                        val nd = if (abs(dx) > abs(dy)) (if (dx > 0) 1 to 0 else -1 to 0)
                        else (if (dy > 0) 0 to 1 else 0 to -1)
                        if (nd.first != -dir.first || nd.second != -dir.second) dir = nd
                    },
                    onDrag = { _, a -> dx += a.x; dy += a.y },
                )
            },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Snake", color = Color(0xFF35E0C4), fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Text("Score $score", color = Color.Gray, fontSize = 14.sp)
        Spacer(Modifier.height(8.dp))
        Canvas(Modifier.weight(1f).fillMaxWidth()) {
            val cw = size.width / cols; val ch = size.height / rows
            drawRect(Color(0xFF16202B), size = size)
            drawRect(Color(0xFFE05A5A), topLeft = Offset(food.first * cw, food.second * ch), size = Size(cw, ch))
            snake.forEachIndexed { i, (x, y) ->
                drawRect(
                    if (i == 0) Color(0xFF35E0C4) else Color(0xFF1C7A6E),
                    topLeft = Offset(x * cw, y * ch), size = Size(cw - 1, ch - 1),
                )
            }
        }
        if (!alive) {
            Spacer(Modifier.height(8.dp))
            Text("Game over", color = Color(0xFFE05A5A), fontSize = 18.sp)
            Button(onClick = { reset() }) { Text("Restart") }
        }
        Spacer(Modifier.height(4.dp))
        Text("Swipe to steer", color = Color.Gray, fontSize = 12.sp)
    }
}
