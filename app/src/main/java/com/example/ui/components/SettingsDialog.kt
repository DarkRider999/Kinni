package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.data.model.UserProfile
import com.example.ui.theme.Rose100
import com.example.ui.theme.Rose200
import com.example.ui.theme.Rose500
import com.example.ui.theme.Rose600
import com.example.ui.theme.Teal600
import com.example.ui.theme.WarmSlate500
import com.example.ui.theme.WarmSlate800

@Composable
fun SettingsDialog(
    profile: UserProfile,
    onDismiss: () -> Unit,
    onSave: (
        motherName: String,
        babyNickname: String,
        currentWeek: Int,
        currentDay: Int,
        dueDateYear: Int,
        dueDateMonth: String,
        dueDateDay: Int,
        daysLeft: Int
    ) -> Unit
) {
    var motherName by remember { mutableStateOf(profile.motherName) }
    var babyNickname by remember { mutableStateOf(profile.babyNickname) }
    var weekText by remember { mutableStateOf(profile.currentWeek.toString()) }
    var dayText by remember { mutableStateOf(profile.currentDay.toString()) }
    var dueDateMonth by remember { mutableStateOf(profile.dueDateMonth) }
    var dueDateDayText by remember { mutableStateOf(profile.dueDateDay.toString()) }
    var dueDateYearText by remember { mutableStateOf(profile.dueDateYear.toString()) }
    var daysLeftText by remember { mutableStateOf(profile.daysLeft.toString()) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(2.dp, Rose200),
            shadowElevation = 12.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(22.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Customize Journey",
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Serif,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = WarmSlate500
                        )
                    }
                }

                OutlinedTextField(
                    value = motherName,
                    onValueChange = { motherName = it },
                    label = { Text("Mother's Name") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Rose500,
                        unfocusedBorderColor = Rose200
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = babyNickname,
                    onValueChange = { babyNickname = it },
                    label = { Text("Baby's Nickname / Title") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Rose500,
                        unfocusedBorderColor = Rose200
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = weekText,
                        onValueChange = { weekText = it },
                        label = { Text("Week (1-40)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Rose500,
                            unfocusedBorderColor = Rose200
                        ),
                        modifier = Modifier.weight(1f)
                    )

                    OutlinedTextField(
                        value = dayText,
                        onValueChange = { dayText = it },
                        label = { Text("Day (1-7)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Rose500,
                            unfocusedBorderColor = Rose200
                        ),
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = dueDateMonth,
                        onValueChange = { dueDateMonth = it },
                        label = { Text("Month") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Rose500,
                            unfocusedBorderColor = Rose200
                        ),
                        modifier = Modifier.weight(1.2f)
                    )

                    OutlinedTextField(
                        value = dueDateDayText,
                        onValueChange = { dueDateDayText = it },
                        label = { Text("Day") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Rose500,
                            unfocusedBorderColor = Rose200
                        ),
                        modifier = Modifier.weight(0.9f)
                    )

                    OutlinedTextField(
                        value = dueDateYearText,
                        onValueChange = { dueDateYearText = it },
                        label = { Text("Year") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Rose500,
                            unfocusedBorderColor = Rose200
                        ),
                        modifier = Modifier.weight(1.1f)
                    )
                }

                OutlinedTextField(
                    value = daysLeftText,
                    onValueChange = { daysLeftText = it },
                    label = { Text("Days Left to Due Date") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Rose500,
                        unfocusedBorderColor = Rose200
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }

                    Button(
                        onClick = {
                            val weekInt = weekText.toIntOrNull() ?: profile.currentWeek
                            val dayInt = dayText.toIntOrNull() ?: profile.currentDay
                            val dueDayInt = dueDateDayText.toIntOrNull() ?: profile.dueDateDay
                            val dueYearInt = dueDateYearText.toIntOrNull() ?: profile.dueDateYear
                            val daysLeftInt = daysLeftText.toIntOrNull() ?: profile.daysLeft

                            onSave(
                                motherName,
                                babyNickname,
                                weekInt,
                                dayInt,
                                dueYearInt,
                                dueDateMonth.ifBlank { "October" },
                                dueDayInt,
                                daysLeftInt
                            )
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Rose600),
                        modifier = Modifier
                            .weight(1.2f)
                            .testTag("save_profile_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Save,
                            contentDescription = "Save",
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Save Changes", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
