package com.subzero.messenger.ui.decoy

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.clickable

/**
 * A real, working calculator. Doubles as an identity disguise (the "Calculator"
 * app face) and as a SafeZone decoy screen. Optionally, entering a secret code
 * followed by "=" can be wired to reveal the messenger — that unlock hook is
 * exposed via [onSecretUnlock] but defaults to no-op so the calculator is just a
 * calculator unless the user configures it.
 */
@Composable
fun CalculatorScreen(
    secretCode: String? = null,
    onSecretUnlock: () -> Unit = {},
) {
    var display by remember { mutableStateOf("0") }
    var accumulator by remember { mutableStateOf<Double?>(null) }
    var pendingOp by remember { mutableStateOf<String?>(null) }
    var freshEntry by remember { mutableStateOf(true) }

    fun inputDigit(d: String) {
        display = if (freshEntry || display == "0") d else display + d
        freshEntry = false
    }
    fun applyPending(): Double {
        val cur = display.toDoubleOrNull() ?: 0.0
        val acc = accumulator ?: return cur
        return when (pendingOp) {
            "+" -> acc + cur; "−" -> acc - cur; "×" -> acc * cur
            "÷" -> if (cur != 0.0) acc / cur else Double.NaN
            else -> cur
        }
    }
    fun setOp(op: String) {
        accumulator = applyPending()
        display = formatNumber(accumulator!!)
        pendingOp = op
        freshEntry = true
    }
    fun equals() {
        if (secretCode != null && display == secretCode) { onSecretUnlock(); return }
        val result = applyPending()
        display = formatNumber(result)
        accumulator = null; pendingOp = null; freshEntry = true
    }

    val rows = listOf(
        listOf("C", "±", "%", "÷"),
        listOf("7", "8", "9", "×"),
        listOf("4", "5", "6", "−"),
        listOf("1", "2", "3", "+"),
        listOf("0", ".", "="),
    )

    Surface(color = Color(0xFF0B0F14), modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.Bottom) {
            Text(
                display, color = Color.White, fontSize = 64.sp, fontWeight = FontWeight.Light,
                textAlign = TextAlign.End, maxLines = 1,
                modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
            )
            rows.forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEach { key ->
                        CalcButton(
                            label = key,
                            weight = if (key == "0") 2f else 1f,
                            accent = key in listOf("÷", "×", "−", "+", "="),
                        ) {
                            when (key) {
                                "C" -> { display = "0"; accumulator = null; pendingOp = null; freshEntry = true }
                                "±" -> display = formatNumber((display.toDoubleOrNull() ?: 0.0) * -1)
                                "%" -> display = formatNumber((display.toDoubleOrNull() ?: 0.0) / 100)
                                "÷", "×", "−", "+" -> setOp(key)
                                "=" -> equals()
                                "." -> if (!display.contains(".")) { display += "."; freshEntry = false }
                                else -> inputDigit(key)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
            }
        }
    }
}

@Composable
private fun RowScope.CalcButton(label: String, weight: Float, accent: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier.weight(weight).aspectRatio(if (weight == 2f) 2f else 1f)
            .clip(CircleShape)
            .background(if (accent) Color(0xFF35E0C4) else Color(0xFF1B2530))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (accent) Color.Black else Color.White, fontSize = 28.sp) }
}

private fun formatNumber(d: Double): String =
    if (d.isNaN()) "Error"
    else if (d == d.toLong().toDouble()) d.toLong().toString()
    else d.toString()
