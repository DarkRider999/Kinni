package com.subzero.messenger.ui.safezone.games

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
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

/** Memory Puzzle: flip cards to find matching emoji pairs (4x4). */
@Composable
fun MemoryGame() {
    val symbols = remember { listOf("★","●","◆","▲","♥","♠","♣","✦") }
    var deck by remember { mutableStateOf(newDeck(symbols)) }
    var flipped by remember { mutableStateOf(listOf<Int>()) }
    var matched by remember { mutableStateOf(setOf<Int>()) }
    var moves by remember { mutableStateOf(0) }
    var lock by remember { mutableStateOf(false) }

    LaunchedEffect(flipped) {
        if (flipped.size == 2) {
            lock = true
            val (a, b) = flipped
            if (deck[a] == deck[b]) matched = matched + a + b
            delay(650)
            flipped = emptyList(); lock = false
        }
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Memory", color = Color(0xFF35E0C4), fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Text(if (matched.size == deck.size) "Solved in $moves moves!" else "Moves $moves",
            color = Color.Gray, fontSize = 14.sp)
        Spacer(Modifier.height(16.dp))
        for (r in 0 until 4) {
            Row {
                for (c in 0 until 4) {
                    val i = r * 4 + c
                    val show = i in flipped || i in matched
                    Box(
                        Modifier.padding(4.dp).size(68.dp).clip(RoundedCornerShape(10.dp))
                            .background(if (show) Color(0xFF1C7A6E) else Color(0xFF1B2530))
                            .clickable(enabled = !lock && !show && flipped.size < 2) {
                                flipped = flipped + i; if (flipped.size == 2) moves++
                            },
                        contentAlignment = Alignment.Center,
                    ) { Text(if (show) deck[i] else "", color = Color.White, fontSize = 28.sp) }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        Button(onClick = { deck = newDeck(symbols); flipped = emptyList(); matched = emptySet(); moves = 0 }) {
            Text("New game")
        }
    }
}

private fun newDeck(symbols: List<String>): List<String> = (symbols + symbols).shuffled()
