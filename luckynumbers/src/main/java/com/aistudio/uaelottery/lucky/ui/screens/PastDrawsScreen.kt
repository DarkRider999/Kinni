package com.aistudio.uaelottery.lucky.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.aistudio.uaelottery.lucky.ui.viewmodel.LotteryViewModel

@Composable
fun PastDrawsScreen(viewModel: LotteryViewModel, modifier: Modifier = Modifier) {
    var dateInput by remember { mutableStateOf("") }
    var numbersInput by remember { mutableStateOf("") }
    val pastDraws by viewModel.pastDraws.collectAsState()

    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Log past winning numbers here to see them in the Stats tab. " +
                "This is a record of what already happened — it has no bearing on future draws.",
            style = MaterialTheme.typography.bodySmall
        )

        OutlinedTextField(
            value = dateInput,
            onValueChange = { dateInput = it },
            label = { Text("Draw date (YYYY-MM-DD)") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = numbersInput,
            onValueChange = { numbersInput = it },
            label = { Text("Winning numbers, comma separated (e.g. 3, 12, 18, 27, 41)") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            onClick = {
                val numbers = numbersInput.split(",").mapNotNull { it.trim().toIntOrNull() }
                if (numbers.isNotEmpty() && dateInput.isNotBlank()) {
                    viewModel.addPastDraw(dateInput, numbers)
                    dateInput = ""
                    numbersInput = ""
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Add past draw")
        }

        HorizontalDivider()

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(pastDraws) { draw ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = draw.drawDate, style = MaterialTheme.typography.titleSmall)
                            Text(text = draw.numbersCsv, style = MaterialTheme.typography.bodyMedium)
                            Text(text = draw.gameLabel, style = MaterialTheme.typography.bodySmall)
                        }
                        IconButton(onClick = { viewModel.deletePastDraw(draw) }) {
                            Icon(imageVector = Icons.Default.Delete, contentDescription = "Delete")
                        }
                    }
                }
            }
        }
    }
}
