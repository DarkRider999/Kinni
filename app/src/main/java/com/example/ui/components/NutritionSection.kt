package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
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
import com.example.ui.theme.Amber100
import com.example.ui.theme.Amber200
import com.example.ui.theme.Amber50
import com.example.ui.theme.Amber500
import com.example.ui.theme.Amber600
import com.example.ui.theme.Rose100
import com.example.ui.theme.Rose200
import com.example.ui.theme.Rose300
import com.example.ui.theme.Rose50
import com.example.ui.theme.Rose500
import com.example.ui.theme.Rose600
import com.example.ui.theme.Teal100
import com.example.ui.theme.Teal200
import com.example.ui.theme.Teal50
import com.example.ui.theme.Teal500
import com.example.ui.theme.Teal600
import com.example.ui.theme.Teal700
import com.example.ui.theme.WarmSlate500
import com.example.ui.theme.WarmSlate600
import com.example.ui.theme.WarmSlate700
import com.example.ui.theme.WarmSlate800

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NutritionSection(
    weekInfo: BabyWeekInfo,
    completedKeys: Set<String>,
    onToggleFood: (key: String, text: String) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.5.dp, Rose100),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        modifier = modifier
            .fillMaxWidth()
            .testTag("nutrition_section_card")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Column {
                Text(
                    text = "🥗 Nutrition Focus",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = weekInfo.nutritionFocus,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Rose600
                )
            }

            // Best Foods Today Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Rose50, Rose100.copy(alpha = 0.5f))
                        )
                    )
                    .padding(16.dp)
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = "✨", fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Best Foods Today",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = WarmSlate800
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        weekInfo.foods.forEachIndexed { index, food ->
                            val foodKey = "food_week_${weekInfo.week}_$index"
                            val isChecked = completedKeys.contains(foodKey)

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color.White,
                                border = BorderStroke(1.dp, if (isChecked) Rose300 else Rose100),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onToggleFood(foodKey, food) }
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = isChecked,
                                        onCheckedChange = { onToggleFood(foodKey, food) },
                                        colors = CheckboxDefaults.colors(
                                            checkedColor = Rose500,
                                            uncheckedColor = WarmSlate500
                                        ),
                                        modifier = Modifier.size(22.dp)
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(
                                        text = food,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (isChecked) Rose600 else WarmSlate800
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Why This Matters Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Teal50, Teal100.copy(alpha = 0.5f))
                        )
                    )
                    .padding(16.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = "💡", fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Why This Matters",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Teal700
                        )
                    }

                    Text(
                        text = weekInfo.nutritionBenefit,
                        fontSize = 13.5.sp,
                        color = WarmSlate700,
                        lineHeight = 19.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color.White,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(text = "🧠", fontSize = 18.sp)
                            }
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "Brain Development",
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = WarmSlate800
                            )
                            Text(
                                text = "DHA & Omega-3s support neural connectivity and memory",
                                fontSize = 12.sp,
                                color = WarmSlate600
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color.White,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(text = "👁️", fontSize = 18.sp)
                            }
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "Eye Health & Retinal Wiring",
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = WarmSlate800
                            )
                            Text(
                                text = "Antioxidants and Vitamin A strengthen photoreceptors",
                                fontSize = 12.sp,
                                color = WarmSlate600
                            )
                        }
                    }
                }
            }

            // Daily Nutrition Goals Card
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Amber50,
                border = BorderStroke(1.dp, Amber200),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "⚡ Daily Nutrition Goals",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Amber600
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        NutritionGoalStat(
                            value = "${weekInfo.extraCalories}",
                            label = "Extra Cals",
                            color = Rose500,
                            modifier = Modifier.weight(1f)
                        )
                        NutritionGoalStat(
                            value = "${weekInfo.proteinGrams}g",
                            label = "Protein",
                            color = Teal600,
                            modifier = Modifier.weight(1f)
                        )
                        NutritionGoalStat(
                            value = "${weekInfo.calciumMg}mg",
                            label = "Calcium",
                            color = Amber500,
                            modifier = Modifier.weight(1f)
                        )
                        NutritionGoalStat(
                            value = "${weekInfo.ironMg}mg",
                            label = "Iron",
                            color = Color(0xFF16A34A),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NutritionGoalStat(
    value: String,
    label: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = value,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            color = color
        )
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = WarmSlate600,
            textAlign = TextAlign.Center
        )
    }
}

