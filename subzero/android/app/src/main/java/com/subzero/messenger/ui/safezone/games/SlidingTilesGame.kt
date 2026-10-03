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
import kotlin.math.abs

/** 15-puzzle sliding tiles (4x4). Tap a tile adjacent to the blank to slide it. */
@Composable
fun SlidingTilesGame() {
    var tiles by remember { mutableStateOf(shuffledSolvable()) }
    val solved = remember(tiles) { tiles == (1..15).toList() + 0 }

    fun tap(i: Int) {
        val blank = tiles.indexOf(0)
        if (isAdjacent(i, blank)) {
            tiles = tiles.toMutableList().also { it[blank] = it[i]; it[i] = 0 }
        }
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Sliding Tiles", color = Color(0xFF35E0C4), fontSize = 24.sp, fontWeight = FontWeight.Bold)
        if (solved) Text("Solved!", color = Color(0xFF35E0C4), fontSize = 16.sp)
        Spacer(Modifier.height(16.dp))
        for (r in 0 until 4) {
            Row {
                for (c in 0 until 4) {
                    val i = r * 4 + c; val v = tiles[i]
                    Box(
                        Modifier.padding(4.dp).size(72.dp).clip(RoundedCornerShape(8.dp))
                            .background(if (v == 0) Color(0xFF11181F) else Color(0xFF1C7A6E))
                            .clickable(enabled = v != 0) { tap(i) },
                        contentAlignment = Alignment.Center,
                    ) { if (v != 0) Text("$v", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold) }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        Button(onClick = { tiles = shuffledSolvable() }) { Text("Shuffle") }
    }
}

private fun isAdjacent(a: Int, b: Int): Boolean {
    val ra = a / 4; val ca = a % 4; val rb = b / 4; val cb = b % 4
    return (ra == rb && abs(ca - cb) == 1) || (ca == cb && abs(ra - rb) == 1)
}

/** Shuffle by random legal slides from the solved state, guaranteeing solvability. */
private fun shuffledSolvable(): List<Int> {
    var t = (1..15).toList() + 0
    repeat(200) {
        val blank = t.indexOf(0)
        val moves = (0 until 16).filter { isAdjacent(it, blank) }
        val m = moves.random()
        t = t.toMutableList().also { it[blank] = it[m]; it[m] = 0 }
    }
    return t
}
