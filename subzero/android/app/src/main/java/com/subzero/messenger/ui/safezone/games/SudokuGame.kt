package com.subzero.messenger.ui.safezone.games

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Sudoku with a baked puzzle. Givens are locked; tap an empty cell then a
 * number to fill it. Conflicts are highlighted; completion is detected.
 */
@Composable
fun SudokuGame() {
    val puzzle = remember { PUZZLE.map { it } }
    var grid by remember { mutableStateOf(puzzle.toMutableList()) }
    var selected by remember { mutableStateOf(-1) }
    val solved = remember(grid) { grid.none { it == 0 } && grid.indices.all { !conflicts(grid, it) } }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Sudoku", color = Color(0xFF35E0C4), fontSize = 24.sp, fontWeight = FontWeight.Bold)
        if (solved) Text("Solved!", color = Color(0xFF35E0C4), fontSize = 16.sp)
        Spacer(Modifier.height(8.dp))
        for (r in 0 until 9) {
            Row {
                for (c in 0 until 9) {
                    val i = r * 9 + c
                    val given = puzzle[i] != 0
                    val bad = grid[i] != 0 && conflicts(grid, i)
                    Box(
                        Modifier.size(34.dp)
                            .border(
                                width = if (selected == i) 2.dp else 0.5.dp,
                                color = if (selected == i) Color(0xFF35E0C4) else Color(0xFF2A3846),
                            )
                            .background(
                                when {
                                    bad -> Color(0xFF5A2020)
                                    (r / 3 + c / 3) % 2 == 0 -> Color(0xFF141C24)
                                    else -> Color(0xFF0F151B)
                                }
                            )
                            .clickable(enabled = !given) { selected = i },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (grid[i] != 0) Text(
                            "${grid[i]}",
                            color = if (given) Color.Gray else Color.White,
                            fontSize = 16.sp,
                            fontWeight = if (given) FontWeight.Bold else FontWeight.Normal,
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Row {
            (1..9).forEach { n ->
                Box(
                    Modifier.padding(2.dp).size(30.dp).background(Color(0xFF1C7A6E))
                        .clickable(enabled = selected >= 0 && puzzle[selected] == 0) {
                            grid = grid.toMutableList().also { it[selected] = n }
                        },
                    contentAlignment = Alignment.Center,
                ) { Text("$n", color = Color.White, fontSize = 16.sp) }
            }
        }
        Spacer(Modifier.height(6.dp))
        Box(
            Modifier.padding(2.dp).height(30.dp).width(80.dp).background(Color(0xFF2A3846))
                .clickable(enabled = selected >= 0 && puzzle[selected] == 0) {
                    grid = grid.toMutableList().also { it[selected] = 0 }
                },
            contentAlignment = Alignment.Center,
        ) { Text("Erase", color = Color.White, fontSize = 14.sp) }
    }
}

/** True if the value at [i] duplicates within its row, column, or 3x3 box. */
private fun conflicts(g: List<Int>, i: Int): Boolean {
    val v = g[i]; if (v == 0) return false
    val r = i / 9; val c = i % 9
    for (k in 0 until 9) {
        if (k != c && g[r * 9 + k] == v) return true
        if (k != r && g[k * 9 + c] == v) return true
    }
    val br = (r / 3) * 3; val bc = (c / 3) * 3
    for (dr in 0 until 3) for (dc in 0 until 3) {
        val j = (br + dr) * 9 + (bc + dc)
        if (j != i && g[j] == v) return true
    }
    return false
}

// 0 = empty. A single valid puzzle (decoy game; one baked board is plenty).
private val PUZZLE = intArrayOf(
    5,3,0, 0,7,0, 0,0,0,
    6,0,0, 1,9,5, 0,0,0,
    0,9,8, 0,0,0, 0,6,0,
    8,0,0, 0,6,0, 0,0,3,
    4,0,0, 8,0,3, 0,0,1,
    7,0,0, 0,2,0, 0,0,6,
    0,6,0, 0,0,0, 2,8,0,
    0,0,0, 4,1,9, 0,0,5,
    0,0,0, 0,8,0, 0,7,9,
).toList()
