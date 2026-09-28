package com.subzero.messenger.ui.decoy

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * A believable, fully-working Notes decoy. Notes are held in memory only (this
 * is a disguise screen, not real storage). The user can browse, open, edit, and
 * add notes — enough to pass a glance. Yellow theme matches the Notes disguise
 * icon.
 */
private data class Note(var title: String, var body: String, val time: String)

private fun seedNotes(): MutableList<Note> = mutableListOf(
    Note("Groceries", "Milk, eggs, coffee, olive oil, spinach, pasta, tomatoes", "9:24 AM"),
    Note("Weekend", "Trail hike Saturday, brunch Sunday with the Patels", "Yesterday"),
    Note("Gift ideas", "Headphones, that jacket she liked, weekend trip?", "Mon"),
    Note("Books", "Project Hail Mary, The Overstory, Educated", "Sun"),
    Note("Wifi", "Guest network password is sunflower-42", "Aug 3"),
)

private val PAPER = Color(0xFF20242B)
private val YELLOW = Color(0xFFF7CE46)
private val YELLOW_DK = Color(0xFFE6A700)

@Composable
fun NotesScreen() {
    val notes = remember { mutableStateListOf<Note>().apply { addAll(seedNotes()) } }
    var editing by remember { mutableStateOf<Int?>(null) }

    if (editing != null) {
        NoteEditor(
            note = notes[editing!!],
            onDone = { title, body ->
                notes[editing!!] = notes[editing!!].copy(title = title, body = body)
                editing = null
            },
        )
        return
    }

    Column(Modifier.fillMaxSize().background(Color(0xFF14171C))) {
        Row(
            Modifier.fillMaxWidth().background(YELLOW).padding(horizontal = 20.dp, vertical = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Notes", color = Color(0xFF2A2400), fontSize = 30.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Text("${notes.size} notes", color = Color(0xFF6A5A00), fontSize = 14.sp)
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(12.dp)) {
            items(notes) { note ->
                val index = notes.indexOf(note)
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 6.dp)
                        .clip(RoundedCornerShape(14.dp)).background(PAPER)
                        .clickable { editing = index }
                        .padding(16.dp),
                ) {
                    Text(note.title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Row {
                        Text(note.time, color = YELLOW_DK, fontSize = 13.sp)
                        Spacer(Modifier.width(10.dp))
                        Text(note.body, color = Color(0xFF9AA0A6), fontSize = 13.sp, maxLines = 1)
                    }
                }
            }
        }
        Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.CenterEnd) {
            Box(
                Modifier.size(58.dp).clip(CircleShape).background(YELLOW)
                    .clickable {
                        notes.add(0, Note("New note", "", now()))
                        editing = 0
                    },
                contentAlignment = Alignment.Center,
            ) { Text("+", color = Color(0xFF2A2400), fontSize = 32.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun NoteEditor(note: Note, onDone: (String, String) -> Unit) {
    var title by remember { mutableStateOf(note.title) }
    var body by remember { mutableStateOf(note.body) }

    Column(Modifier.fillMaxSize().background(Color(0xFF14171C))) {
        Row(
            Modifier.fillMaxWidth().background(YELLOW).padding(horizontal = 16.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("‹ Notes", color = Color(0xFF2A2400), fontSize = 18.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { onDone(title, body) })
            Spacer(Modifier.weight(1f))
            Text("Done", color = Color(0xFF2A2400), fontSize = 16.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable { onDone(title, body) })
        }
        BasicTextField(
            value = title, onValueChange = { title = it },
            textStyle = TextStyle(color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(YELLOW),
            modifier = Modifier.fillMaxWidth().padding(20.dp, 20.dp, 20.dp, 4.dp),
        )
        BasicTextField(
            value = body, onValueChange = { body = it },
            textStyle = TextStyle(color = Color(0xFFCED2D6), fontSize = 16.sp),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(YELLOW),
            modifier = Modifier.fillMaxSize().padding(20.dp, 4.dp, 20.dp, 20.dp),
        )
    }
}

private fun now(): String = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date())
