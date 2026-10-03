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

/** Word Shuffle: unscramble the letters by tapping them in order. */
@Composable
fun WordShuffleGame() {
    val words = remember { listOf("PLANET","GARDEN","ORANGE","SILVER","WINTER","CASTLE","MELODY","BRIDGE") }
    var target by remember { mutableStateOf(words.random()) }
    var scrambled by remember { mutableStateOf(scramble(target)) }
    var picked by remember { mutableStateOf(listOf<Int>()) }
    val current = picked.map { scrambled[it] }.joinToString("")
    val solved = current == target

    fun next() {
        target = words.random(); scrambled = scramble(target); picked = emptyList()
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Word Shuffle", color = Color(0xFF35E0C4), fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(16.dp))
        Text(if (solved) "✓ $target" else current.ifEmpty { "—" },
            color = if (solved) Color(0xFF35E0C4) else Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(24.dp))
        Row {
            scrambled.forEachIndexed { i, ch ->
                val used = i in picked
                Box(
                    Modifier.padding(4.dp).size(44.dp).clip(RoundedCornerShape(8.dp))
                        .background(if (used) Color(0xFF11181F) else Color(0xFF1C7A6E))
                        .clickable(enabled = !used && !solved) { picked = picked + i },
                    contentAlignment = Alignment.Center,
                ) { if (!used) Text("$ch", color = Color.White, fontSize = 22.sp) }
            }
        }
        Spacer(Modifier.height(24.dp))
        Row {
            Button(onClick = { picked = emptyList() }) { Text("Clear") }
            Spacer(Modifier.width(12.dp))
            Button(onClick = { next() }) { Text(if (solved) "Next" else "Skip") }
        }
    }
}

private fun scramble(word: String): List<Char> {
    var s: List<Char>
    do { s = word.toList().shuffled() } while (s.joinToString("") == word)
    return s
}
