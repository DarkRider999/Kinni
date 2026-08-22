package com.example.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.BabyWeekInfo
import com.example.data.model.UserProfile
import com.example.ui.theme.Cream50
import com.example.ui.theme.Rose100
import com.example.ui.theme.Rose200
import com.example.ui.theme.Rose50
import com.example.ui.theme.Rose500
import com.example.ui.theme.Rose600
import com.example.ui.theme.Rose700
import com.example.ui.theme.Teal100
import com.example.ui.theme.Teal50
import com.example.ui.theme.Teal600
import com.example.ui.theme.WarmSlate500
import com.example.ui.theme.WarmSlate600
import com.example.ui.theme.WarmSlate700
import com.example.ui.theme.WarmSlate800

@Composable
fun MainCountdownCard(
    profile: UserProfile,
    selectedWeek: Int,
    weekInfo: BabyWeekInfo,
    onPreviousWeek: () -> Unit,
    onNextWeek: () -> Unit,
    onResetToCurrentWeek: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(2.5.dp, Rose200),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        modifier = modifier
            .fillMaxWidth()
            .testTag("main_countdown_card")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            // Week header & Week navigation stepper
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "MY BABY",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.2.sp,
                        color = Rose600
                    )
                    AnimatedContent(
                        targetState = Pair(selectedWeek, if (selectedWeek == profile.currentWeek) profile.currentDay else 1),
                        transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) },
                        label = "week_title"
                    ) { (w, d) ->
                        Text(
                            text = "Week $w Day $d",
                            fontSize = 26.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }

                // Week step buttons
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onPreviousWeek,
                        enabled = selectedWeek > 1,
                        modifier = Modifier
                            .testTag("prev_week_button")
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Rose50),
                        colors = IconButtonDefaults.iconButtonColors(contentColor = Rose600)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Previous Week",
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(6.dp))

                    if (selectedWeek != profile.currentWeek) {
                        FilledTonalIconButton(
                            onClick = onResetToCurrentWeek,
                            modifier = Modifier
                                .testTag("reset_week_button")
                                .size(36.dp),
                            colors = IconButtonDefaults.filledTonalIconButtonColors(
                                containerColor = Teal100,
                                contentColor = Teal600
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.RestartAlt,
                                contentDescription = "Back to current week",
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                    }

                    IconButton(
                        onClick = onNextWeek,
                        enabled = selectedWeek < 40,
                        modifier = Modifier
                            .testTag("next_week_button")
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Rose50),
                        colors = IconButtonDefaults.iconButtonColors(contentColor = Rose600)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = "Next Week",
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Countdown box: Days Left
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.horizontalGradient(
                            listOf(
                                Rose100.copy(alpha = 0.8f),
                                Teal100.copy(alpha = 0.8f)
                            )
                        )
                    )
                    .padding(vertical = 18.dp, horizontal = 16.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Days Left",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = WarmSlate600
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${profile.daysLeft}",
                        fontSize = 48.sp,
                        fontWeight = FontWeight.Black,
                        color = Rose500
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "for your bundle of joy! ",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = WarmSlate700
                        )
                        Text(text = "🎉", fontSize = 16.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Due Date Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.CalendarMonth,
                    contentDescription = "Due Date",
                    tint = Rose600,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Due Date: ",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = WarmSlate600
                )
                Text(
                    text = "${profile.dueDateMonth} ${profile.dueDateDay}, ${profile.dueDateYear}",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Baby Visualization Box
            BabyVisualBox(weekInfo = weekInfo)
        }
    }
}

@Composable
fun BabyVisualBox(
    weekInfo: BabyWeekInfo,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        border = BorderStroke(1.5.dp, Rose200),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Big Emoji
            Text(
                text = weekInfo.emoji,
                fontSize = 54.sp,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "BABY LOOKS LIKE",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.1.sp,
                color = WarmSlate500
            )

            Text(
                text = weekInfo.animal,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Rose700
            )

            Text(
                text = "Fruit size: ${weekInfo.fruitEmoji} ${weekInfo.fruit}",
                fontSize = 13.sp,
                color = WarmSlate600,
                modifier = Modifier.padding(top = 2.dp)
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Stat Cards (SIZE & WEIGHT)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Size Stat
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Rose50,
                    border = BorderStroke(1.dp, Rose200),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(
                        modifier = Modifier.padding(vertical = 10.dp, horizontal = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "SIZE",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = WarmSlate500
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = weekInfo.size,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = WarmSlate800
                        )
                    }
                }

                // Weight Stat
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Teal50,
                    border = BorderStroke(1.dp, Teal100),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(
                        modifier = Modifier.padding(vertical = 10.dp, horizontal = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "WEIGHT",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = WarmSlate500
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = weekInfo.weight,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = WarmSlate800
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Insight & Fun Feature
            Text(
                text = "✨ ${weekInfo.insight}",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Medium,
                color = WarmSlate700,
                textAlign = TextAlign.Center,
                lineHeight = 19.sp
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = weekInfo.feature,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = Rose600,
                textAlign = TextAlign.Center
            )
        }
    }
}
