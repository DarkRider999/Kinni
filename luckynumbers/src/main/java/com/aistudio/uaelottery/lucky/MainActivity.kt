package com.aistudio.uaelottery.lucky

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aistudio.uaelottery.lucky.ui.screens.LuckyNumbersApp
import com.aistudio.uaelottery.lucky.ui.theme.LuckyNumbersTheme
import com.aistudio.uaelottery.lucky.ui.viewmodel.LotteryViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            LuckyNumbersTheme {
                val viewModel: LotteryViewModel = viewModel()
                LuckyNumbersApp(viewModel = viewModel)
            }
        }
    }
}
