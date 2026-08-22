package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.KickSessionEntity
import com.example.ui.theme.Rose100
import com.example.ui.theme.Rose200
import com.example.ui.theme.Rose300
import com.example.ui.theme.Rose50
import com.example.ui.theme.Rose500
import com.example.ui.theme.Rose600
import com.example.ui.theme.Teal100
import com.example.ui.theme.Teal200
import com.example.ui.theme.Teal50
import com.example.ui.theme.Teal600
import com.example.ui.theme.WarmSlate500
import com.example.ui.theme.WarmSlate600
import com.example.ui.theme.WarmSlate700
import com.example.ui.theme.WarmSlate800
import com.example.ui.viewmodel.KickTrackingState

@Composable
fun BabyKicksSection(
    kickState: KickTrackingState,
    pastSessions: List<KickSessionEntity>,
    onStartTracking: () -> Unit,
    onRegisterKick: () -> Unit,
    onFinishTracking: () -> Unit,
    onCancelTracking: () -> Unit,
    onDeleteSession: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    val minutes = kickState.elapsedSeconds / 60
    val seconds = kickState.elapsedSeconds % 60
    val timeFormatted = String.format("%02d:%02d", minutes, seconds)

    val pulseTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by pulseTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (kickState.isTracking) 1.08f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.5.dp, Rose100),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        modifier = modifier
            .fillMaxWidth()
            .testTag("baby_kicks_card")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Column {
                Text(
                    text = "👶 Baby Kick Counter",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Goal: Count 10 movements in under 2 hours (ACOG recommended)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = Rose600
                )
            }

            // Main Active Kick Box
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(
                        Brush.verticalGradient(
                            listOf(Rose50, Teal50)
                        )
                    )
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (kickState.isTracking) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .padding(horizontal = 14.dp, vertical = 6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Timer,
                                contentDescription = "Timer",
                                tint = Teal600,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Elapsed: $timeFormatted",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = WarmSlate800
                            )
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        // Large Kick Tap Button
                        Surface(
                            shape = CircleShape,
                            color = Rose500,
                            shadowElevation = 8.dp,
                            modifier = Modifier
                                .size(130.dp)
                                .scale(pulseScale)
                                .clip(CircleShape)
                                .clickable { onRegisterKick() }
                                .testTag("record_kick_button")
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = "${kickState.kicks}",
                                        fontSize = 38.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.White
                                    )
                                    Text(
                                        text = "TAP FOR KICK",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Rose100
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        if (kickState.kicks >= 10) {
                            Text(
                                text = "🎉 10 Kicks recorded! Baby is active & healthy.",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Teal600,
                                textAlign = TextAlign.Center
                            )
                        } else {
                            Text(
                                text = "${10 - kickState.kicks} more kicks to reach 10",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = WarmSlate600
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = onCancelTracking,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Cancel",
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Cancel")
                            }

                            Button(
                                onClick = onFinishTracking,
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Rose600),
                                modifier = Modifier.weight(1.2f)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Done,
                                    contentDescription = "Save",
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Save Session", fontWeight = FontWeight.Bold)
                            }
                        }
                    } else {
                        // Start tracking view
                        Text(
                            text = "👶",
                            fontSize = 46.sp,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )

                        Text(
                            text = "Track Baby's Movement Session",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = WarmSlate800
                        )

                        Text(
                            text = "Best done after a meal or in the evening when baby is active",
                            fontSize = 12.5.sp,
                            color = WarmSlate600,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(vertical = 6.dp)
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        Button(
                            onClick = onStartTracking,
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Rose600),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .testTag("start_kick_session_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = "Start",
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Start Kick Counter Session", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Past Kick Sessions
            if (pastSessions.isNotEmpty()) {
                Text(
                    text = "Recent Sessions History",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = WarmSlate800
                )

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    pastSessions.take(5).forEach { session ->
                        val durationMin = session.durationSeconds / 60
                        val durationSec = session.durationSeconds % 60
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                            border = BorderStroke(1.dp, Rose100),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "🦶 ${session.kickCount} Kicks",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = WarmSlate800
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "in ${durationMin}m ${durationSec}s",
                                            fontSize = 12.sp,
                                            color = Teal600,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                    Text(
                                        text = session.date,
                                        fontSize = 11.sp,
                                        color = WarmSlate500
                                    )
                                }

                                IconButton(
                                    onClick = { onDeleteSession(session.id) },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.DeleteOutline,
                                        contentDescription = "Delete Session",
                                        tint = WarmSlate500,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
