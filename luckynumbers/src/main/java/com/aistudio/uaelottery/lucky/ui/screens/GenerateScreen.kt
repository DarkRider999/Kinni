package com.aistudio.uaelottery.lucky.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aistudio.uaelottery.lucky.domain.GameFormats
import com.aistudio.uaelottery.lucky.ui.components.DisclaimerBanner
import com.aistudio.uaelottery.lucky.ui.components.NumberBallRow
import com.aistudio.uaelottery.lucky.ui.viewmodel.LotteryViewModel

@Composable
fun GenerateScreen(viewModel: LotteryViewModel, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        DisclaimerBanner(modifier = Modifier.fillMaxWidth())

        Text(
            text = "Game format",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold
        )
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(GameFormats.PRESETS) { format ->
                FilterChip(
                    selected = viewModel.selectedFormat == format,
                    onClick = { viewModel.selectedFormat = format },
                    label = { Text(format.label) }
                )
            }
        }

        OutlinedTextField(
            value = viewModel.birthDate,
            onValueChange = { viewModel.birthDate = it },
            label = { Text("Your birth date (YYYY-MM-DD)") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = viewModel.drawDate,
            onValueChange = { viewModel.drawDate = it },
            label = { Text("Draw date (YYYY-MM-DD)") },
            modifier = Modifier.fillMaxWidth()
        )

        viewModel.generateError?.let { error ->
            Text(text = error, color = MaterialTheme.colorScheme.error)
        }

        Button(onClick = { viewModel.generate() }, modifier = Modifier.fillMaxWidth()) {
            Text("Generate lucky numbers")
        }

        if (viewModel.generatedNumbers.isNotEmpty()) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Your numbers for ${viewModel.drawDate}",
                        style = MaterialTheme.typography.titleMedium
                    )
                    NumberBallRow(numbers = viewModel.generatedNumbers, modifier = Modifier.fillMaxWidth())
                    viewModel.lifePathNumber?.let { lifePath ->
                        Text(
                            text = "Numerology life-path number: $lifePath " +
                                "(a fun personal-numerology flourish, not a prediction method).",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
    }
}
