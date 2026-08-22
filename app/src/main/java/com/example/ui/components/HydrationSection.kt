package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.CleanBlueContainer
import com.example.ui.theme.CleanBlueText
import com.example.ui.theme.CleanOutline
import com.example.ui.theme.CleanOutlineVariant
import com.example.ui.theme.CleanPrimary
import com.example.ui.theme.CleanPrimaryContainer
import com.example.ui.theme.CleanSurfaceContainer
import com.example.ui.theme.CleanTealContainer
import com.example.ui.theme.CleanTealText
import com.example.ui.theme.CleanTextPrimary
import com.example.ui.theme.CleanTextSecondary
import com.example.ui.theme.Teal500
import com.example.ui.theme.Teal600
import com.example.ui.theme.WaterBlue
import com.example.ui.theme.WaterBlueDark
import com.example.ui.theme.WaterBlueLight

@Composable
fun HydrationSection(
    waterCups: Int,
    waterGoal: Int = 8,
    onAddWater: () -> Unit,
    onRemoveWater: () -> Unit,
    onSetWaterCups: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val progressFraction = if (waterGoal > 0) (waterCups.toFloat() / waterGoal.toFloat()).coerceIn(0f, 1f) else 0f
    val animatedProgress by animateFloatAsState(
        targetValue = progressFraction,
        animationSpec = tween(durationMillis = 500, easing = FastOutSlowInEasing),
        label = "water_circular_progress"
    )
    val percentageInt = (progressFraction * 100).toInt()
    val isGoalReached = waterCups >= waterGoal && waterGoal > 0

    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, CleanOutlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = modifier
            .fillMaxWidth()
            .testTag("hydration_section_card")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Section Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "💧 Water Intake Tracker",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Serif,
                        color = CleanTextPrimary
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "Daily Target: $waterGoal glasses (~${(waterGoal * 250) / 1000f}L)",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = CleanTextSecondary
                    )
                }

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (isGoalReached) CleanTealContainer else CleanBlueContainer
                ) {
                    Text(
                        text = if (isGoalReached) "Target Met ✓" else "$percentageInt%",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isGoalReached) CleanTealText else CleanBlueText,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }

            // Main Circular Progress Tracking Card
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = CleanSurfaceContainer,
                border = BorderStroke(1.dp, CleanOutlineVariant),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp, horizontal = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Circular Progress Indicator Component
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(190.dp)
                            .testTag("hydration_circular_progress")
                    ) {
                        // Custom Canvas Circular Progress Ring
                        val primaryWaterColor = WaterBlue
                        val secondaryWaterColor = Teal500
                        val trackColor = CleanOutlineVariant.copy(alpha = 0.6f)

                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val strokeWidth = 14.dp.toPx()
                            val diameter = size.minDimension - strokeWidth
                            val topLeft = Offset((size.width - diameter) / 2, (size.height - diameter) / 2)
                            val arcSize = Size(diameter, diameter)

                            // Background Track Circle
                            drawArc(
                                color = trackColor,
                                startAngle = -90f,
                                sweepAngle = 360f,
                                useCenter = false,
                                topLeft = topLeft,
                                size = arcSize,
                                style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                            )

                            // Active Progress Arc
                            if (animatedProgress > 0f) {
                                drawArc(
                                    brush = Brush.sweepGradient(
                                        listOf(
                                            primaryWaterColor,
                                            secondaryWaterColor,
                                            primaryWaterColor
                                        )
                                    ),
                                    startAngle = -90f,
                                    sweepAngle = animatedProgress * 360f,
                                    useCenter = false,
                                    topLeft = topLeft,
                                    size = arcSize,
                                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                                )
                            }
                        }

                        // Inside Circle Content
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "💧",
                                fontSize = 28.sp
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Row(verticalAlignment = Alignment.Bottom) {
                                Text(
                                    text = "$waterCups",
                                    fontSize = 36.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isGoalReached) Teal600 else CleanTextPrimary
                                )
                                Text(
                                    text = "/$waterGoal",
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = CleanTextSecondary,
                                    modifier = Modifier.padding(bottom = 4.dp, start = 2.dp)
                                )
                            }
                            Text(
                                text = "Glasses",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = CleanTextSecondary
                            )
                            Text(
                                text = "${waterCups * 250} ml",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = WaterBlueDark
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Goal Status / Encouragement Message
                    AnimatedVisibility(visible = isGoalReached) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = CleanTealContainer,
                            modifier = Modifier.padding(bottom = 12.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = "Goal reached",
                                    tint = CleanTealText,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Daily hydration goal achieved! Keep sipping!",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = CleanTealText
                                )
                            }
                        }
                    }

                    if (!isGoalReached) {
                        val remaining = (waterGoal - waterCups).coerceAtLeast(0)
                        Text(
                            text = if (remaining == 1) "1 more glass to complete your daily goal!" else "$remaining glasses remaining today",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = CleanTextSecondary,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )
                    }

                    // Action Buttons Row (Add Glass & Undo)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = onRemoveWater,
                            enabled = waterCups > 0,
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, if (waterCups > 0) CleanOutline else CleanOutlineVariant),
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp)
                                .testTag("undo_water_button")
                        ) {
                            Text(
                                text = "Undo",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (waterCups > 0) CleanTextPrimary else CleanTextSecondary.copy(alpha = 0.5f)
                            )
                        }

                        Button(
                            onClick = onAddWater,
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = WaterBlue,
                                contentColor = Color.White
                            ),
                            elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp),
                            modifier = Modifier
                                .weight(2f)
                                .height(50.dp)
                                .testTag("add_glass_button")
                                .testTag("add_water_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Add Glass",
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Add Glass",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Quick Interactive Glasses Grid
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Quick Glass Selector",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = CleanTextPrimary
                )

                // 2 Rows of 4 glasses
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    for (i in 0 until 4) {
                        WaterCupItem(
                            index = i,
                            isFilled = i < waterCups,
                            onClick = {
                                if (i < waterCups) {
                                    onSetWaterCups(i)
                                } else {
                                    onSetWaterCups(i + 1)
                                }
                            }
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    for (i in 4 until 8) {
                        WaterCupItem(
                            index = i,
                            isFilled = i < waterCups,
                            onClick = {
                                if (i < waterCups) {
                                    onSetWaterCups(i)
                                } else {
                                    onSetWaterCups(i + 1)
                                }
                            }
                        )
                    }
                }
            }

            // Benefits of Hydration during Pregnancy
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = CleanBlueContainer.copy(alpha = 0.45f),
                border = BorderStroke(1.dp, CleanBlueContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "✨ Why Hydration Matters for Baby & Mom",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = CleanBlueText
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    listOf(
                        "Helps form amniotic fluid around baby",
                        "Increases blood volume to nourish the placenta",
                        "Eases pregnancy headaches, swelling, and cramps",
                        "Flushes toxins and prevents urinary tract infections"
                    ).forEach { tip ->
                        Text(
                            text = "• $tip",
                            fontSize = 12.sp,
                            color = CleanTextPrimary,
                            lineHeight = 17.sp,
                            modifier = Modifier.padding(vertical = 2.dp)
                        )
                    }
                }
            }

            // Hydration Tips Card
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = CleanTealContainer.copy(alpha = 0.45f),
                border = BorderStroke(1.dp, CleanTealContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "💡 Daily Hydration Tips",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = CleanTealText
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    listOf(
                        "Start your morning with a tall glass of room temperature water",
                        "Carry a marked reusable bottle throughout the day",
                        "Infuse water with cucumber, mint, or lemon for flavor"
                    ).forEach { tip ->
                        Text(
                            text = "• $tip",
                            fontSize = 12.sp,
                            color = CleanTextPrimary,
                            lineHeight = 17.sp,
                            modifier = Modifier.padding(vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WaterCupItem(
    index: Int,
    isFilled: Boolean,
    onClick: () -> Unit
) {
    val animatedBg by animateColorAsState(
        targetValue = if (isFilled) WaterBlue else MaterialTheme.colorScheme.surface,
        animationSpec = tween(250),
        label = "cup_bg"
    )

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = animatedBg,
        border = BorderStroke(
            1.dp,
            if (isFilled) WaterBlueDark else CleanOutlineVariant
        ),
        shadowElevation = if (isFilled) 2.dp else 0.dp,
        modifier = Modifier
            .size(width = 68.dp, height = 62.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable { onClick() }
            .testTag("water_cup_$index")
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxSize()
        ) {
            Text(
                text = if (isFilled) "💧" else "🥛",
                fontSize = if (isFilled) 22.sp else 18.sp
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "Glass ${index + 1}",
                fontSize = 10.sp,
                fontWeight = if (isFilled) FontWeight.Bold else FontWeight.Normal,
                color = if (isFilled) Color.White else CleanTextSecondary
            )
        }
    }
}
