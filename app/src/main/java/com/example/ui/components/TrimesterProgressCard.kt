package com.example.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.Rose100
import com.example.ui.theme.Rose200
import com.example.ui.theme.Rose300
import com.example.ui.theme.Rose400
import com.example.ui.theme.Rose500
import com.example.ui.theme.Rose600
import com.example.ui.theme.WarmSlate500
import com.example.ui.theme.WarmSlate700
import com.example.ui.theme.WarmSlate800

@Composable
fun TrimesterProgressCard(
    currentWeek: Int,
    modifier: Modifier = Modifier
) {
    val progressFraction = ((currentWeek - 1).toFloat() / 39f).coerceIn(0f, 1f)
    val animatedProgress by animateFloatAsState(
        targetValue = progressFraction,
        animationSpec = tween(durationMillis = 600),
        label = "trimester_progress"
    )
    val percentText = String.format("%.1f", animatedProgress * 100)

    val currentTrimester = when {
        currentWeek <= 13 -> 1
        currentWeek <= 27 -> 2
        else -> 3
    }

    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.5.dp, Rose100),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        modifier = modifier
            .fillMaxWidth()
            .testTag("trimester_progress_card")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = "Pregnancy Progress",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Serif,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(18.dp))

            // 3 Trimester Indicator circles
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TrimesterIndicator(
                    number = 1,
                    title = "1st Trimester",
                    subtitle = "Weeks 1-13",
                    isActive = currentTrimester == 1,
                    isCompleted = currentTrimester > 1
                )

                TrimesterIndicator(
                    number = 2,
                    title = "2nd Trimester",
                    subtitle = "Weeks 14-27",
                    isActive = currentTrimester == 2,
                    isCompleted = currentTrimester > 2
                )

                TrimesterIndicator(
                    number = 3,
                    title = "3rd Trimester",
                    subtitle = "Weeks 28-40",
                    isActive = currentTrimester == 3,
                    isCompleted = false
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Custom Smooth Progress Bar
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(14.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Rose100)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(animatedProgress)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            Brush.horizontalGradient(
                                listOf(Rose400, Rose500, Rose600)
                            )
                        )
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "$percentText% complete (Week $currentWeek of 40)",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = WarmSlate500,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        }
    }
}

@Composable
private fun TrimesterIndicator(
    number: Int,
    title: String,
    subtitle: String,
    isActive: Boolean,
    isCompleted: Boolean
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        val circleColor = when {
            isActive -> Rose500
            isCompleted -> Rose400
            else -> Rose200
        }
        val textColor = if (isActive || isCompleted) Color.White else WarmSlate700

        Surface(
            shape = CircleShape,
            color = circleColor,
            modifier = Modifier.size(42.dp),
            shadowElevation = if (isActive) 4.dp else 0.dp
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = if (isCompleted) "✓" else "$number",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = textColor
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = title,
            fontSize = 12.sp,
            fontWeight = if (isActive) FontWeight.Bold else FontWeight.SemiBold,
            color = if (isActive) Rose600 else MaterialTheme.colorScheme.onSurface
        )

        Text(
            text = subtitle,
            fontSize = 11.sp,
            color = WarmSlate500
        )
    }
}
