package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.BabyWeekInfo
import com.example.data.model.PregnancyJournalEntity
import com.example.ui.theme.Amber100
import com.example.ui.theme.Amber200
import com.example.ui.theme.Amber400
import com.example.ui.theme.Amber50
import com.example.ui.theme.Amber600
import com.example.ui.theme.Rose100
import com.example.ui.theme.Rose200
import com.example.ui.theme.Rose50
import com.example.ui.theme.Rose500
import com.example.ui.theme.Rose600
import com.example.ui.theme.Rose700
import com.example.ui.theme.Teal100
import com.example.ui.theme.Teal200
import com.example.ui.theme.Teal50
import com.example.ui.theme.Teal600
import com.example.ui.theme.WarmSlate500
import com.example.ui.theme.WarmSlate600
import com.example.ui.theme.WarmSlate700
import com.example.ui.theme.WarmSlate800
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun InsightsSection(
    weekInfo: BabyWeekInfo,
    completedKeys: Set<String>,
    onToggleItem: (key: String, category: String, text: String) -> Unit,
    journalEntries: List<PregnancyJournalEntity>,
    onAddJournal: (moodEmoji: String, title: String, note: String) -> Unit,
    onDeleteJournal: (id: Long) -> Unit,
    modifier: Modifier = Modifier
) {
    var isJournalFormOpen by remember { mutableStateOf(false) }
    var newJournalTitle by remember { mutableStateOf("") }
    var newJournalNote by remember { mutableStateOf("") }
    var selectedMood by remember { mutableStateOf("😊") }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Milestone Insights Card
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.5.dp, Rose100),
            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "💡 Week ${weekInfo.week} Insights",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif,
                    color = MaterialTheme.colorScheme.onSurface
                )

                // Baby's Vision / Development Milestone
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Rose50)
                        .padding(16.dp)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(text = "👀", fontSize = 18.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Baby's Key Milestone",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Rose700
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "${weekInfo.insight} ${weekInfo.feature}",
                            fontSize = 13.5.sp,
                            color = WarmSlate700,
                            lineHeight = 20.sp
                        )
                    }
                }

                // Mama Care Tips
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Teal50)
                        .padding(16.dp)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(text = "💪", fontSize = 18.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Mama Care Tips",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Teal600
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        weekInfo.mamaTips.forEach { tip ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 3.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Text(
                                    text = "•",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Teal600,
                                    modifier = Modifier.padding(end = 8.dp)
                                )
                                Text(
                                    text = tip,
                                    fontSize = 13.5.sp,
                                    color = WarmSlate700,
                                    lineHeight = 19.sp
                                )
                            }
                        }
                    }
                }

                // Week Checklist
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Amber50)
                        .padding(16.dp)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(text = "🎯", fontSize = 18.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Week ${weekInfo.week} Checklist",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Amber600
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        weekInfo.checklist.forEachIndexed { index, task ->
                            val itemKey = "week_${weekInfo.week}_task_$index"
                            val isChecked = completedKeys.contains(itemKey)

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        onToggleItem(itemKey, "CHECKLIST", task)
                                    }
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = {
                                        onToggleItem(itemKey, "CHECKLIST", task)
                                    },
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = Rose500,
                                        uncheckedColor = WarmSlate500
                                    ),
                                    modifier = Modifier.size(24.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = task,
                                    fontSize = 13.5.sp,
                                    fontWeight = if (isChecked) FontWeight.Normal else FontWeight.Medium,
                                    color = if (isChecked) WarmSlate500 else WarmSlate800,
                                    textDecoration = if (isChecked) TextDecoration.LineThrough else TextDecoration.None,
                                    lineHeight = 18.sp
                                )
                            }
                        }
                    }
                }
            }
        }

        // Mama's Pregnancy Journal
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.5.dp, Rose100),
            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = "📖", fontSize = 20.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Mom's Pregnancy Journal",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Serif,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    Button(
                        onClick = { isJournalFormOpen = !isJournalFormOpen },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isJournalFormOpen) Rose100 else Rose500,
                            contentColor = if (isJournalFormOpen) Rose600 else Color.White
                        ),
                        modifier = Modifier.testTag("add_journal_button")
                    ) {
                        Icon(
                            imageVector = if (isJournalFormOpen) Icons.Default.TaskAlt else Icons.Default.Add,
                            contentDescription = "Add Journal Entry",
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (isJournalFormOpen) "Close" else "Write",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                AnimatedVisibility(visible = isJournalFormOpen) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 16.dp)
                            .background(Rose50.copy(alpha = 0.6f), RoundedCornerShape(16.dp))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "Today's Mood",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = WarmSlate600
                        )

                        // Mood selector
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf("🥰", "😊", "😴", "🤰", "✨", "🌸").forEach { emoji ->
                                Surface(
                                    shape = CircleShape,
                                    color = if (selectedMood == emoji) Rose200 else Color.White,
                                    border = BorderStroke(1.dp, if (selectedMood == emoji) Rose500 else Rose100),
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clickable { selectedMood = emoji }
                                ) {
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(text = emoji, fontSize = 18.sp)
                                    }
                                }
                            }
                        }

                        OutlinedTextField(
                            value = newJournalTitle,
                            onValueChange = { newJournalTitle = it },
                            label = { Text("Title / Milestone (e.g. Felt first big kick!)") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Rose500,
                                unfocusedBorderColor = Rose200
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("journal_title_input")
                        )

                        OutlinedTextField(
                            value = newJournalNote,
                            onValueChange = { newJournalNote = it },
                            label = { Text("Write your thoughts, feelings, or symptoms...") },
                            minLines = 3,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Rose500,
                                unfocusedBorderColor = Rose200
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("journal_note_input")
                        )

                        Button(
                            onClick = {
                                if (newJournalTitle.isNotBlank() || newJournalNote.isNotBlank()) {
                                    onAddJournal(
                                        selectedMood,
                                        newJournalTitle.ifBlank { "Week ${weekInfo.week} Reflection" },
                                        newJournalNote
                                    )
                                    newJournalTitle = ""
                                    newJournalNote = ""
                                    isJournalFormOpen = false
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Rose600),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("save_journal_button")
                        ) {
                            Text("Save Memory to Journal", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (journalEntries.isEmpty()) {
                    Text(
                        text = "No notes written yet. Tap 'Write' above to record memories for baby Kinni!",
                        fontSize = 13.sp,
                        color = WarmSlate500,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        journalEntries.take(5).forEach { entry ->
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                border = BorderStroke(1.dp, Rose100),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.Top,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = entry.moodEmoji,
                                            fontSize = 24.sp,
                                            modifier = Modifier.padding(end = 10.dp, top = 2.dp)
                                        )
                                        Column {
                                            Text(
                                                text = entry.title,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = WarmSlate800
                                            )
                                            Text(
                                                text = "Week ${entry.week} • ${entry.date}",
                                                fontSize = 11.sp,
                                                color = WarmSlate500
                                            )
                                            if (entry.note.isNotBlank()) {
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    text = entry.note,
                                                    fontSize = 13.sp,
                                                    color = WarmSlate700,
                                                    lineHeight = 18.sp
                                                )
                                            }
                                        }
                                    }

                                    IconButton(
                                        onClick = { onDeleteJournal(entry.id) },
                                        modifier = Modifier.size(30.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.DeleteOutline,
                                            contentDescription = "Delete Entry",
                                            tint = WarmSlate500,
                                            modifier = Modifier.size(18.dp)
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
}
