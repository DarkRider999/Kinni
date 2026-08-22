package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.db.KinniDatabase
import com.example.data.model.BabyWeekDatabase
import com.example.data.model.BabyWeekInfo
import com.example.data.model.KickSessionEntity
import com.example.data.model.PregnancyJournalEntity
import com.example.data.model.UserProfile
import com.example.data.repository.KinniRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class KinniTab(val title: String, val emoji: String) {
    INSIGHTS("Insights", "💡"),
    NUTRITION("Nutrition", "🥗"),
    HYDRATION("Hydration", "💧"),
    KICKS("Baby Kicks", "👶")
}

data class KickTrackingState(
    val isTracking: Boolean = false,
    val kicks: Int = 0,
    val elapsedSeconds: Long = 0L,
    val targetKicks: Int = 10
)

class KinniViewModel(application: Application) : AndroidViewModel(application) {
    private val repository: KinniRepository

    init {
        val db = KinniDatabase.getDatabase(application)
        repository = KinniRepository(db.kinniDao())
    }

    // User Profile
    private val _userProfile = MutableStateFlow(
        UserProfile(
            motherName = "Anjali",
            babyNickname = "Kinni",
            currentWeek = 30,
            currentDay = 3,
            dueDateYear = 2026,
            dueDateMonth = "October",
            dueDateDay = 29,
            daysLeft = 67,
            waterGoal = 8
        )
    )
    val userProfile: StateFlow<UserProfile> = _userProfile.asStateFlow()

    // Selected Week for preview/exploration (defaults to current pregnancy week)
    private val _selectedWeek = MutableStateFlow(30)
    val selectedWeek: StateFlow<Int> = _selectedWeek.asStateFlow()

    val currentWeekInfo: StateFlow<BabyWeekInfo> = _selectedWeek.map { week ->
        BabyWeekDatabase.getInfoForWeek(week)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = BabyWeekDatabase.getInfoForWeek(30)
    )

    // Current Active Tab
    private val _selectedTab = MutableStateFlow(KinniTab.INSIGHTS)
    val selectedTab: StateFlow<KinniTab> = _selectedTab.asStateFlow()

    // Hydration
    val hydrationRecord = repository.getTodayHydration().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = null
    )

    val waterCups: StateFlow<Int> = hydrationRecord.map { it?.cups ?: 0 }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 0
    )

    // Checklists from Room
    val currentWeekChecklist = _selectedWeek.combine(
        repository.getChecklistForWeek(30) // placeholder; updated via separate flow
    ) { week, _ -> week }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 30
    )

    val roomChecklistItems = repository.getChecklistForWeek(30).stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    // Fast in-memory checklist set for smooth toggles backed by Room
    private val _completedChecklistKeys = MutableStateFlow<Set<String>>(setOf())
    val completedChecklistKeys: StateFlow<Set<String>> = _completedChecklistKeys.asStateFlow()

    // Kick Tracker
    private val _kickState = MutableStateFlow(KickTrackingState())
    val kickState: StateFlow<KickTrackingState> = _kickState.asStateFlow()
    private var timerJob: Job? = null

    val pastKickSessions: StateFlow<List<KickSessionEntity>> = repository.getKickSessions().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    // Journal
    val journalEntries: StateFlow<List<PregnancyJournalEntity>> = repository.getJournalEntries().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    fun setSelectedTab(tab: KinniTab) {
        _selectedTab.value = tab
    }

    fun setSelectedWeek(week: Int) {
        _selectedWeek.value = week.coerceIn(1, 40)
    }

    fun goToCurrentWeek() {
        _selectedWeek.value = _userProfile.value.currentWeek
    }

    fun addWater() {
        val current = waterCups.value
        if (current < 20) {
            val next = current + 1
            viewModelScope.launch {
                repository.updateHydration(next, _userProfile.value.waterGoal)
            }
        }
    }

    fun removeWater() {
        val current = waterCups.value
        if (current > 0) {
            val next = current - 1
            viewModelScope.launch {
                repository.updateHydration(next, _userProfile.value.waterGoal)
            }
        }
    }

    fun setWaterCupsDirectly(cups: Int) {
        viewModelScope.launch {
            repository.updateHydration(cups.coerceIn(0, 20), _userProfile.value.waterGoal)
        }
    }

    fun toggleCheckItem(key: String, week: Int, category: String, text: String) {
        val currentSet = _completedChecklistKeys.value
        val isNowCompleted = !currentSet.contains(key)
        _completedChecklistKeys.value = if (isNowCompleted) {
            currentSet + key
        } else {
            currentSet - key
        }

        viewModelScope.launch {
            repository.toggleChecklistItem(
                id = key,
                week = week,
                category = category,
                text = text,
                currentStatus = !isNowCompleted
            )
        }
    }

    // Kick Tracker Actions
    fun startKickTracking() {
        if (_kickState.value.isTracking) return
        _kickState.value = KickTrackingState(isTracking = true, kicks = 0, elapsedSeconds = 0)
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (_kickState.value.isTracking) {
                delay(1000)
                _kickState.value = _kickState.value.copy(
                    elapsedSeconds = _kickState.value.elapsedSeconds + 1
                )
            }
        }
    }

    fun registerKick() {
        if (!_kickState.value.isTracking) {
            startKickTracking()
        }
        val nextKicks = _kickState.value.kicks + 1
        _kickState.value = _kickState.value.copy(kicks = nextKicks)
    }

    fun finishKickTracking(notes: String = "") {
        val current = _kickState.value
        timerJob?.cancel()
        _kickState.value = KickTrackingState(isTracking = false)
        if (current.kicks > 0) {
            viewModelScope.launch {
                repository.saveKickSession(
                    count = current.kicks,
                    durationSeconds = current.elapsedSeconds,
                    notes = notes
                )
            }
        }
    }

    fun cancelKickTracking() {
        timerJob?.cancel()
        _kickState.value = KickTrackingState(isTracking = false)
    }

    fun deleteKickSession(id: Long) {
        viewModelScope.launch {
            repository.deleteKickSession(id)
        }
    }

    // Journal Actions
    fun saveJournalEntry(moodEmoji: String, title: String, note: String) {
        viewModelScope.launch {
            repository.addJournalEntry(
                week = _selectedWeek.value,
                moodEmoji = moodEmoji,
                title = title,
                note = note
            )
        }
    }

    fun deleteJournalEntry(id: Long) {
        viewModelScope.launch {
            repository.deleteJournalEntry(id)
        }
    }

    // Profile Settings Update
    fun updateProfile(
        motherName: String,
        babyNickname: String,
        currentWeek: Int,
        currentDay: Int,
        dueDateYear: Int,
        dueDateMonth: String,
        dueDateDay: Int,
        daysLeft: Int
    ) {
        _userProfile.value = _userProfile.value.copy(
            motherName = motherName.ifBlank { "Anjali" },
            babyNickname = babyNickname.ifBlank { "Kinni" },
            currentWeek = currentWeek.coerceIn(1, 40),
            currentDay = currentDay.coerceIn(1, 7),
            dueDateYear = dueDateYear,
            dueDateMonth = dueDateMonth,
            dueDateDay = dueDateDay,
            daysLeft = daysLeft.coerceAtLeast(0)
        )
        _selectedWeek.value = currentWeek
    }
}
