package com.aistudio.uaelottery.lucky.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.aistudio.uaelottery.lucky.ui.viewmodel.LotteryViewModel

private val TAB_TITLES = listOf("Generate", "Past Draws", "Stats")

@Composable
fun LuckyNumbersApp(viewModel: LotteryViewModel) {
    var selectedTab by remember { mutableIntStateOf(0) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("UAE Lottery — Lucky Numbers") }) }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize()) {
            TabRow(selectedTabIndex = selectedTab) {
                TAB_TITLES.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { Text(title) }
                    )
                }
            }
            when (selectedTab) {
                0 -> GenerateScreen(viewModel = viewModel, modifier = Modifier.padding(padding))
                1 -> PastDrawsScreen(viewModel = viewModel, modifier = Modifier.padding(padding))
                2 -> StatsScreen(viewModel = viewModel, modifier = Modifier.padding(padding))
            }
        }
    }
}
