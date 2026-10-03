package com.subzero.messenger.ui.decoy

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Calendar

/**
 * A believable Weather decoy: current conditions, an hourly strip, and a 5-day
 * forecast. Values are plausible and vary a little by the hour so it looks live.
 * Blue gradient theme matches the Weather disguise icon.
 */
private data class Hour(val label: String, val glyph: String, val temp: Int)
private data class Day(val label: String, val glyph: String, val hi: Int, val lo: Int)

@Composable
fun WeatherScreen() {
    val hour = remember { Calendar.getInstance().get(Calendar.HOUR_OF_DAY) }
    val current = 18 + (hour % 7)          // gentle deterministic variation
    val condition = if (hour in 6..17) "Partly Cloudy" else "Clear"
    val glyph = if (hour in 6..17) "⛅" else "☀"

    val hours = remember(hour) {
        (0..7).map { i ->
            val h = (hour + i) % 24
            val g = if (h in 6..17) listOf("☀", "⛅", "☁").random() else "☽"
            Hour(if (i == 0) "Now" else "%02d:00".format(h), g, current + (-2..3).random())
        }
    }
    val days = remember {
        listOf("Mon", "Tue", "Wed", "Thu", "Fri").mapIndexed { i, d ->
            Day(d, listOf("☀", "⛅", "☁", "🌧").random(), 21 + i % 4, 12 + i % 3)
        }
    }

    Column(
        Modifier.fillMaxSize().background(
            Brush.verticalGradient(listOf(Color(0xFF4AA3F0), Color(0xFF1E5FA8)))
        ).padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(24.dp))
        Text("San Francisco", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Medium)
        Text("$current°", color = Color.White, fontSize = 88.sp, fontWeight = FontWeight.Thin)
        Text("$glyph  $condition", color = Color.White, fontSize = 18.sp)
        Text("H:${current + 4}°   L:${current - 6}°", color = Color(0xCCFFFFFF), fontSize = 15.sp)

        Spacer(Modifier.height(24.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                .background(Color(0x33000000)).horizontalScroll(rememberScrollState())
                .padding(12.dp),
        ) {
            hours.forEach { h ->
                Column(
                    Modifier.padding(horizontal = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(h.label, color = Color(0xCCFFFFFF), fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(h.glyph, fontSize = 22.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("${h.temp}°", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                .background(Color(0x33000000)).padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            days.forEach { d ->
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(d.label, color = Color.White, fontSize = 16.sp, modifier = Modifier.width(56.dp))
                    Text(d.glyph, fontSize = 20.sp)
                    Spacer(Modifier.weight(1f))
                    Text("${d.lo}°", color = Color(0x99FFFFFF), fontSize = 16.sp)
                    Spacer(Modifier.width(16.dp))
                    Text("${d.hi}°", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
