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

/** Quick Math: solve as many as possible before the 30s timer runs out. */
@Composable
fun QuickMathGame() {
    var question by remember { mutableStateOf(newQuestion()) }
    var score by remember { mutableStateOf(0) }
    var timeLeft by remember { mutableStateOf(30) }
    val over = timeLeft <= 0

    LaunchedEffect(Unit) {
        while (timeLeft > 0) { delay(1000); timeLeft-- }
    }

    Column(
        Modifier.fillMaxSize().background(Color(0xFF0B0F14)).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Quick Math", color = Color(0xFF35E0C4), fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(if (over) "Time! Score $score" else "⏱ $timeLeft   ★ $score", color = Color.Gray, fontSize = 16.sp)
        Spacer(Modifier.height(24.dp))
        if (!over) {
            Text(question.text, color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(24.dp))
            question.options.forEach { opt ->
                Box(
                    Modifier.padding(6.dp).fillMaxWidth(0.7f).clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF1B2530))
                        .clickable {
                            if (opt == question.answer) score++
                            question = newQuestion()
                        }.padding(16.dp),
                    contentAlignment = Alignment.Center,
                ) { Text("$opt", color = Color.White, fontSize = 24.sp) }
            }
        } else {
            Text("Reopen SafeZone to play again", color = Color.Gray, fontSize = 14.sp)
        }
    }
}

private data class MathQ(val text: String, val answer: Int, val options: List<Int>)

private fun newQuestion(): MathQ {
    val a = (2..20).random(); val b = (2..20).random()
    val op = listOf("+", "−", "×").random()
    val ans = when (op) { "+" -> a + b; "−" -> a - b; else -> a * b }
    val opts = (mutableSetOf(ans).apply {
        while (size < 4) add(ans + (-6..6).random())
    }).toList().shuffled()
    return MathQ("$a $op $b", ans, opts)
}
