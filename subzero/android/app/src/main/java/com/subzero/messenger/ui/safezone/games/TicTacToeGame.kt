package com.subzero.messenger.ui.safezone.games

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** A complete, playable Tic-Tac-Toe used as a SafeZone decoy game. */
@Composable
fun TicTacToeGame() {
    var board by remember { mutableStateOf(List(9) { "" }) }
    var xTurn by remember { mutableStateOf(true) }
    val winner = remember(board) { winnerOf(board) }

    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            when {
                winner != null -> "$winner wins!"
                board.none { it.isEmpty() } -> "Draw"
                else -> "${if (xTurn) "X" else "O"}'s turn"
            },
            color = Color(0xFF35E0C4), fontSize = 24.sp, fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(24.dp))
        for (row in 0..2) {
            Row {
                for (col in 0..2) {
                    val i = row * 3 + col
                    Box(
                        modifier = Modifier.padding(4.dp).size(88.dp)
                            .background(Color(0xFF16202B))
                            .clickable(enabled = board[i].isEmpty() && winner == null) {
                                board = board.toMutableList().also { it[i] = if (xTurn) "X" else "O" }
                                xTurn = !xTurn
                            },
                        contentAlignment = Alignment.Center,
                    ) { Text(board[i], color = Color.White, fontSize = 40.sp) }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
        Button(onClick = { board = List(9) { "" }; xTurn = true }) { Text("New game") }
    }
}

private fun winnerOf(b: List<String>): String? {
    val lines = listOf(
        listOf(0,1,2), listOf(3,4,5), listOf(6,7,8),
        listOf(0,3,6), listOf(1,4,7), listOf(2,5,8),
        listOf(0,4,8), listOf(2,4,6),
    )
    for (l in lines) {
        val (a, c, d) = l
        if (b[a].isNotEmpty() && b[a] == b[c] && b[c] == b[d]) return b[a]
    }
    return null
}
