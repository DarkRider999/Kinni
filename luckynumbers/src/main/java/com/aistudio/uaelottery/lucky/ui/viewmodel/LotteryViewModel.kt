package com.aistudio.uaelottery.lucky.ui.viewmodel

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.aistudio.uaelottery.lucky.data.db.LotteryDatabase
import com.aistudio.uaelottery.lucky.data.db.PastDrawEntity
import com.aistudio.uaelottery.lucky.data.repository.LotteryRepository
import com.aistudio.uaelottery.lucky.domain.DrawStatsCalculator
import com.aistudio.uaelottery.lucky.domain.GameFormat
import com.aistudio.uaelottery.lucky.domain.GameFormats
import com.aistudio.uaelottery.lucky.domain.LuckyNumberGenerator
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class LotteryViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = LotteryRepository(LotteryDatabase.getDatabase(application).lotteryDao())

    // Prefilled with the birth date given for the numerology-flavored seed; editable.
    var birthDate by mutableStateOf("1987-08-24")
    var drawDate by mutableStateOf("")
    var selectedFormat by mutableStateOf<GameFormat>(GameFormats.MEGA7)
    var generatedNumbers by mutableStateOf<List<Int>>(emptyList())
    var lifePathNumber by mutableStateOf<Int?>(null)
    var generateError by mutableStateOf<String?>(null)

    val pastDraws: StateFlow<List<PastDrawEntity>> = repository.pastDraws
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val stats: StateFlow<List<DrawStatsCalculator.NumberFrequency>> = pastDraws
        .map { DrawStatsCalculator.frequencies(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun generate() {
        if (birthDate.isBlank() || drawDate.isBlank()) {
            generateError = "Enter both your birth date and the draw date."
            return
        }
        generateError = null
        generatedNumbers = LuckyNumberGenerator.generate(birthDate, drawDate, selectedFormat)
        lifePathNumber = LuckyNumberGenerator.lifePathNumber(birthDate)
    }

    fun addPastDraw(date: String, numbers: List<Int>) {
        if (date.isBlank() || numbers.isEmpty()) return
        viewModelScope.launch {
            repository.addDraw(date, numbers, selectedFormat.label)
        }
    }

    fun deletePastDraw(draw: PastDrawEntity) {
        viewModelScope.launch {
            repository.deleteDraw(draw)
        }
    }
}
