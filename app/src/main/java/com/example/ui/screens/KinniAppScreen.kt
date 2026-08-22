package com.example.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Divider
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.components.BabyKicksSection
import com.example.ui.components.HydrationSection
import com.example.ui.components.InsightsSection
import com.example.ui.components.KinniHeader
import com.example.ui.components.KinniTabBar
import com.example.ui.components.MainCountdownCard
import com.example.ui.components.NutritionSection
import com.example.ui.components.SettingsDialog
import com.example.ui.components.TrimesterProgressCard
import com.example.ui.theme.Cream50
import com.example.ui.theme.Rose100
import com.example.ui.theme.Rose200
import com.example.ui.theme.Rose300
import com.example.ui.theme.Rose50
import com.example.ui.theme.Rose500
import com.example.ui.theme.Rose600
import com.example.ui.theme.Rose700
import com.example.ui.theme.Teal100
import com.example.ui.theme.Teal50
import com.example.ui.theme.Teal600
import com.example.ui.theme.WarmSlate400
import com.example.ui.theme.WarmSlate500
import com.example.ui.theme.WarmSlate600
import com.example.ui.theme.WarmSlate700
import com.example.ui.theme.WarmSlate800
import com.example.ui.viewmodel.KinniTab
import com.example.ui.viewmodel.KinniViewModel

@Composable
fun KinniAppScreen(
    viewModel: KinniViewModel,
    modifier: Modifier = Modifier
) {
    val profile by viewModel.userProfile.collectAsState()
    val selectedWeek by viewModel.selectedWeek.collectAsState()
    val weekInfo by viewModel.currentWeekInfo.collectAsState()
    val selectedTab by viewModel.selectedTab.collectAsState()
    val waterCups by viewModel.waterCups.collectAsState()
    val completedKeys by viewModel.completedChecklistKeys.collectAsState()
    val kickState by viewModel.kickState.collectAsState()
    val pastKickSessions by viewModel.pastKickSessions.collectAsState()
    val journalEntries by viewModel.journalEntries.collectAsState()

    var showSettingsDialog by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            item {
                KinniHeader(
                    profile = profile,
                    onOpenSettings = { showSettingsDialog = true }
                )
            }

            // Hero Banner image (if drawable exists) with warm rounded frame
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp)
                        .clip(RoundedCornerShape(22.dp))
                        .background(
                            Brush.horizontalGradient(
                                listOf(Rose100, Teal100)
                            )
                        )
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.kinni_hero_banner),
                        contentDescription = "Kinni Pregnancy Banner",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(130.dp)
                    )
                }
            }

            // Quick Week Browser Horizontal Strip
            item {
                Column(modifier = Modifier.padding(horizontal = 18.dp)) {
                    Text(
                        text = "BROWSE WEEKS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.1.sp,
                        color = WarmSlate500,
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                    WeekSelectorBar(
                        selectedWeek = selectedWeek,
                        currentPregnancyWeek = profile.currentWeek,
                        onSelectWeek = { viewModel.setSelectedWeek(it) }
                    )
                }
            }

            // Main Countdown Card with Baby Visuals
            item {
                Box(modifier = Modifier.padding(horizontal = 18.dp)) {
                    MainCountdownCard(
                        profile = profile,
                        selectedWeek = selectedWeek,
                        weekInfo = weekInfo,
                        onPreviousWeek = { viewModel.setSelectedWeek(selectedWeek - 1) },
                        onNextWeek = { viewModel.setSelectedWeek(selectedWeek + 1) },
                        onResetToCurrentWeek = { viewModel.goToCurrentWeek() }
                    )
                }
            }

            // Trimester Progress Card
            item {
                Box(modifier = Modifier.padding(horizontal = 18.dp)) {
                    TrimesterProgressCard(currentWeek = selectedWeek)
                }
            }

            // Navigation Tabs
            item {
                Box(modifier = Modifier.padding(horizontal = 18.dp)) {
                    KinniTabBar(
                        selectedTab = selectedTab,
                        onTabSelected = { viewModel.setSelectedTab(it) }
                    )
                }
            }

            // Active Tab Content
            item {
                Box(modifier = Modifier.padding(horizontal = 18.dp)) {
                    Crossfade(
                        targetState = selectedTab,
                        animationSpec = tween(250),
                        label = "tab_crossfade"
                    ) { tab ->
                        when (tab) {
                            KinniTab.INSIGHTS -> {
                                InsightsSection(
                                    weekInfo = weekInfo,
                                    completedKeys = completedKeys,
                                    onToggleItem = { key, category, text ->
                                        viewModel.toggleCheckItem(key, weekInfo.week, category, text)
                                    },
                                    journalEntries = journalEntries,
                                    onAddJournal = { mood, title, note ->
                                        viewModel.saveJournalEntry(mood, title, note)
                                    },
                                    onDeleteJournal = { id ->
                                        viewModel.deleteJournalEntry(id)
                                    }
                                )
                            }
                            KinniTab.NUTRITION -> {
                                NutritionSection(
                                    weekInfo = weekInfo,
                                    completedKeys = completedKeys,
                                    onToggleFood = { key, text ->
                                        viewModel.toggleCheckItem(key, weekInfo.week, "FOOD", text)
                                    }
                                )
                            }
                            KinniTab.HYDRATION -> {
                                HydrationSection(
                                    waterCups = waterCups,
                                    waterGoal = profile.waterGoal,
                                    onAddWater = { viewModel.addWater() },
                                    onRemoveWater = { viewModel.removeWater() },
                                    onSetWaterCups = { viewModel.setWaterCupsDirectly(it) }
                                )
                            }
                            KinniTab.KICKS -> {
                                BabyKicksSection(
                                    kickState = kickState,
                                    pastSessions = pastKickSessions,
                                    onStartTracking = { viewModel.startKickTracking() },
                                    onRegisterKick = { viewModel.registerKick() },
                                    onFinishTracking = { viewModel.finishKickTracking() },
                                    onCancelTracking = { viewModel.cancelKickTracking() },
                                    onDeleteSession = { viewModel.deleteKickSession(it) }
                                )
                            }
                        }
                    }
                }
            }

            // Footer
            item {
                KinniFooter(profile = profile)
            }
        }
    }

    if (showSettingsDialog) {
        SettingsDialog(
            profile = profile,
            onDismiss = { showSettingsDialog = false },
            onSave = { mother, baby, week, day, dueYear, dueMonth, dueDay, daysLeft ->
                viewModel.updateProfile(mother, baby, week, day, dueYear, dueMonth, dueDay, daysLeft)
                showSettingsDialog = false
            }
        )
    }
}

@Composable
private fun WeekSelectorBar(
    selectedWeek: Int,
    currentPregnancyWeek: Int,
    onSelectWeek: (Int) -> Unit
) {
    val scrollState = rememberScrollState()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(scrollState),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        for (w in 1..40) {
            val isSelected = w == selectedWeek
            val isCurrent = w == currentPregnancyWeek

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = when {
                    isSelected -> Rose500
                    isCurrent -> Rose100
                    else -> MaterialTheme.colorScheme.surface
                },
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (isSelected) Rose600 else if (isCurrent) Rose300 else Rose100
                ),
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .clickable { onSelectWeek(w) }
                    .testTag("week_chip_$w")
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "W$w",
                        fontSize = 13.sp,
                        fontWeight = if (isSelected || isCurrent) FontWeight.Bold else FontWeight.Medium,
                        color = when {
                            isSelected -> Color.White
                            isCurrent -> Rose700
                            else -> WarmSlate700
                        }
                    )
                    if (isCurrent) {
                        Text(
                            text = "Now",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isSelected) Color.White else Rose600
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun KinniFooter(
    profile: com.example.data.model.UserProfile,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
            .background(
                Brush.horizontalGradient(
                    listOf(Rose100.copy(alpha = 0.7f), Teal100.copy(alpha = 0.7f))
                )
            )
            .padding(vertical = 24.dp, horizontal = 20.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "👶 ${profile.babyNickname} is excited to meet you soon!",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = WarmSlate800
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Tracking ${profile.motherName}'s healthy & beautiful pregnancy journey",
                fontSize = 12.5.sp,
                color = WarmSlate600
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Estimated Delivery: ${profile.dueDateMonth} ${profile.dueDateDay}, ${profile.dueDateYear}",
                fontSize = 11.sp,
                color = WarmSlate500
            )
        }
    }
}

