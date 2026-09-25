package com.nocternal.playz.ui.radio

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Radio
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.theme.GenreCatalog
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Radio Hub (spec §3 panel 3 + §10): genre stations for every built-in genre, search, and an FM dial for
 * local FM stations that stream online.
 */
@Composable
fun RadioHubScreen(
    client: RadioBrowserClient,
    online: Boolean,
    externalQuery: String?,
    initialGenreId: String?,
    onPlay: (station: RadioStation, genreId: String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = Neon.palette
    val scope = rememberCoroutineScope()
    var genreId by remember { mutableStateOf(initialGenreId ?: GenreCatalog.all.first().id) }
    var query by remember { mutableStateOf("") }
    var stations by remember { mutableStateOf<List<RadioStation>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var fm by remember { mutableStateOf<List<RadioStation>>(emptyList()) }
    var freq by remember { mutableFloatStateOf(98.3f) }
    val country = remember { Locale.getDefault().country.ifBlank { "IN" } }

    suspend fun loadGenre(id: String) {
        val g = GenreCatalog.byId(id) ?: return
        loading = true
        stations = g.radioTags.firstNotNullOfOrNull { tag -> client.byTag(tag).takeIf { it.isNotEmpty() } }.orEmpty()
        loading = false
    }

    LaunchedEffect(initialGenreId) { initialGenreId?.let { genreId = it } }
    LaunchedEffect(genreId, online) { if (online) loadGenre(genreId) }
    LaunchedEffect(online) { if (online) fm = client.fmStations(country) }
    LaunchedEffect(externalQuery) {
        val q = externalQuery ?: return@LaunchedEffect
        query = q; loading = true; stations = client.search(q); loading = false
    }

    if (!online) {
        Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Radio needs a connection — you're offline.", color = p.muted) }
        return
    }

    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            OutlinedTextField(
                value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                placeholder = { Text("Search stations") }, leadingIcon = { Icon(Icons.Filled.Search, null) },
                keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = { scope.launch { loading = true; stations = client.search(query); loading = false } }),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Search),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent, cursorColor = p.accent),
                shape = RoundedCornerShape(16.dp),
            )
        }
        item { SectionTitle("FM dial · $country") }
        item {
            GlowCard(Modifier.fillMaxWidth()) {
                FmDial(freq, fm, onTune = { freq = it }, onSettle = { f -> tuneTo(fm, f)?.let { onPlay(it, null) } }, modifier = Modifier.fillMaxWidth())
                if (fm.isEmpty()) Text("Looking for FM stations that stream online…", style = MaterialTheme.typography.labelSmall, color = p.muted)
            }
        }
        item { SectionTitle("Genre stations") }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(GenreCatalog.all, key = { it.id }) { g -> NeonChip("${g.emoji} ${g.displayName}", selected = g.id == genreId) { genreId = g.id } }
            }
        }
        if (loading) item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = p.accent) } }
        items(stations, key = { it.id }) { s -> StationRow(s) { onPlay(s, genreId) } }
        if (!loading && stations.isEmpty()) item { Text("No stations found.", color = p.muted) }
    }
}

@Composable
private fun StationRow(s: RadioStation, onClick: () -> Unit) {
    val p = Neon.palette
    GlowCard(Modifier.fillMaxWidth(), glowColor = p.accent.copy(alpha = 0.4f), onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(p.background), contentAlignment = Alignment.Center) {
                if (s.favicon.isNotBlank()) AsyncImage(s.favicon, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else Icon(Icons.Filled.Radio, null, tint = p.accent)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(s.name.trim(), color = p.onBackground, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(listOf(s.country, s.codec, if (s.bitrate > 0) "${s.bitrate} kbps" else "").filter { it.isNotBlank() }.joinToString(" · "), color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
            }
            s.fmFrequency?.let { Text("%.1f".format(it), color = p.accent, style = MaterialTheme.typography.labelSmall) }
        }
    }
}
