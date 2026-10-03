package com.subzero.messenger.ui.safezone.games

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs

/** A complete, swipe-driven 2048 used as a SafeZone decoy game. */
@Composable
fun Game2048() {
    var grid by remember { mutableStateOf(spawn(spawn(emptyGrid()))) }
    var score by remember { mutableStateOf(0) }

    fun move(dir: Dir) {
        val (next, gained) = slide(grid, dir)
        if (next != grid) { grid = spawn(next); score += gained }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(24.dp)
            .pointerInput(Unit) {
                var dx = 0f; var dy = 0f
                detectDragGestures(
                    onDragStart = { dx = 0f; dy = 0f },
                    onDragEnd = {
                        if (abs(dx) > abs(dy)) move(if (dx > 0) Dir.RIGHT else Dir.LEFT)
                        else move(if (dy > 0) Dir.DOWN else Dir.UP)
                    },
                    onDrag = { _, amt -> dx += amt.x; dy += amt.y },
                )
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("2048", color = Color(0xFF35E0C4), fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Text("Score $score", color = Color.Gray, fontSize = 16.sp)
        Spacer(Modifier.height(16.dp))
        for (r in 0..3) {
            Row {
                for (c in 0..3) {
                    val v = grid[r][c]
                    Box(
                        Modifier.padding(4.dp).size(72.dp).clip(RoundedCornerShape(8.dp))
                            .background(tileColor(v)),
                        contentAlignment = Alignment.Center,
                    ) { if (v > 0) Text("$v", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold) }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        Text("Swipe to move", color = Color.Gray, fontSize = 14.sp)
    }
}

private enum class Dir { UP, DOWN, LEFT, RIGHT }
private typealias Grid = List<List<Int>>

private fun emptyGrid(): Grid = List(4) { List(4) { 0 } }

private fun spawn(g: Grid): Grid {
    val empties = buildList { for (r in 0..3) for (c in 0..3) if (g[r][c] == 0) add(r to c) }
    if (empties.isEmpty()) return g
    val (r, c) = empties.random()
    return g.mapIndexed { ri, row -> row.mapIndexed { ci, v -> if (ri == r && ci == c) (if (Math.random() < 0.9) 2 else 4) else v } }
}

private fun slide(g: Grid, dir: Dir): Pair<Grid, Int> {
    var gained = 0
    fun collapse(line: List<Int>): List<Int> {
        val nums = line.filter { it != 0 }.toMutableList()
        var i = 0
        while (i < nums.size - 1) {
            if (nums[i] == nums[i + 1]) { nums[i] *= 2; gained += nums[i]; nums.removeAt(i + 1) }
            i++
        }
        while (nums.size < 4) nums.add(0)
        return nums
    }
    val rows = (0..3).map { r -> (0..3).map { c -> g[r][c] } }.toMutableList()
    val result: Grid = when (dir) {
        Dir.LEFT -> rows.map { collapse(it) }
        Dir.RIGHT -> rows.map { collapse(it.reversed()).reversed() }
        Dir.UP -> transpose((0..3).map { r -> collapse((0..3).map { c -> transpose(rows)[r][c] }) })
        Dir.DOWN -> transpose((0..3).map { r -> collapse((0..3).map { c -> transpose(rows)[r][c] }.reversed()).reversed() })
    }
    return result to gained
}

private fun transpose(g: Grid): Grid = (0..3).map { c -> (0..3).map { r -> g[r][c] } }

private fun tileColor(v: Int): Color = when (v) {
    0 -> Color(0xFF16202B); 2 -> Color(0xFF1E3A3A); 4 -> Color(0xFF215050)
    8 -> Color(0xFF1C7A6E); 16 -> Color(0xFF199E86); 32 -> Color(0xFF16C0A0)
    else -> Color(0xFF35E0C4)
}
