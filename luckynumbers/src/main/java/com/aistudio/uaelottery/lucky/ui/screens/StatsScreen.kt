package com.aistudio.uaelottery.lucky.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aistudio.uaelottery.lucky.domain.DrawStatsCalculator
import com.aistudio.uaelottery.lucky.ui.components.DisclaimerBanner
import com.aistudio.uaelottery.lucky.ui.viewmodel.LotteryViewModel

@Composable
fun StatsScreen(viewModel: LotteryViewModel, modifier: Modifier = Modifier) {
    val stats by viewModel.stats.collectAsState()

    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        DisclaimerBanner(modifier = Modifier.fillMaxWidth())

        if (stats.isEmpty()) {
            Text(
                text = "No past draws logged yet. Add some in the Past Draws tab to see " +
                    "which numbers have come up most and least often.",
                style = MaterialTheme.typography.bodyMedium
            )
        } else {
            Text(
                text = "Frequency of each number across the draws you've logged " +
                    "(most-seen first). Past frequency doesn't influence the next draw.",
                style = MaterialTheme.typography.bodySmall
            )
            val maxCount = stats.maxOf { it.count }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items(stats) { entry ->
                    FrequencyBar(entry = entry, maxCount = maxCount)
                }
            }
        }
    }
}

@Composable
private fun FrequencyBar(entry: DrawStatsCalculator.NumberFrequency, maxCount: Int) {
    Row(
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = entry.number.toString().padStart(2, '0'),
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.width(32.dp)
        )
        val fraction = if (maxCount > 0) entry.count.toFloat() / maxCount else 0f
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(18.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction.coerceIn(0.05f, 1f))
                    .height(18.dp)
                    .background(MaterialTheme.colorScheme.tertiary, RoundedCornerShape(4.dp))
            )
        }
        Text(text = entry.count.toString(), style = MaterialTheme.typography.labelMedium)
    }
}
