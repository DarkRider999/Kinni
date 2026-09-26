package com.nocternal.playz.ui.radio

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nocternal.playz.designsystem.GlowCard
import com.nocternal.playz.designsystem.Neon
import com.nocternal.playz.designsystem.NeonChip
import com.nocternal.playz.designsystem.SectionTitle
import com.nocternal.playz.radio.RadioCountry
import com.nocternal.playz.radio.RadioDirectory
import com.nocternal.playz.radio.RadioProvider
import com.nocternal.playz.radio.RadioStation
import com.nocternal.playz.radio.RadioTag
import com.nocternal.playz.theme.GenreCatalog
import kotlinx.coroutines.launch
import java.util.Locale

private enum class RadioTab(val label: String) { GENRE("By genre"), COUNTRY("By country"), SOMAFM("SomaFM"), FM("FM dial") }

/**
 * Radio Hub (spec §3 panel 3 + §10) over free, open directories: Radio Browser (community, ~50k stations),
 * SomaFM (listener-supported, ad-free) and the Icecast directory. Browse by genre, by country, or both at once;
 * search across sources; tune local FM stations' online streams on the FM dial.
 */
@Composable
fun RadioHubScreen(
    client: RadioDirectory,
    online: Boolean,
    externalQuery: String?,
    initialGenreId: String?,
    onPlay: (station: RadioStation, genreId: String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = Neon.palette
    val scope = rememberCoroutineScope()
    val localCountry = remember { Locale.getDefault().country.ifBlank { "IN" } }
    var tab by remember { mutableStateOf(RadioTab.GENRE) }
    var genreId by remember { mutableStateOf<String?>(initialGenreId ?: GenreCatalog.all.first().id) }
    var freeTag by remember { mutableStateOf<String?>(null) }
    var genreCountry by remember { mutableStateOf<RadioCountry?>(null) }
    var country by remember { mutableStateOf<RadioCountry?>(null) }
    var countryGenre by remember { mutableStateOf<String?>(null) }
    var countryFilter by remember { mutableStateOf("") }
    var query by remember { mutableStateOf("") }
    var searching by remember { mutableStateOf(false) }
    var stations by remember { mutableStateOf<List<RadioStation>>(emptyList()) }
    var countries by remember { mutableStateOf<List<RadioCountry>>(emptyList()) }
    var tags by remember { mutableStateOf<List<RadioTag>>(emptyList()) }
    var soma by remember { mutableStateOf<List<RadioStation>>(emptyList()) }
    var fm by remember { mutableStateOf<List<RadioStation>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var freq by remember { mutableFloatStateOf(98.3f) }

    suspend fun load(block: suspend () -> List<RadioStation>) { loading = true; stations = block(); loading = false }

    LaunchedEffect(initialGenreId) { initialGenreId?.let { genreId = it; freeTag = null; tab = RadioTab.GENRE } }
    LaunchedEffect(online) {
        if (!online) return@LaunchedEffect
        countries = client.radioBrowser.countries()
        tags = client.radioBrowser.tags()
    }
    LaunchedEffect(tab, genreId, freeTag, genreCountry, country, countryGenre, online, searching) {
        if (!online || searching) return@LaunchedEffect
        when (tab) {
            RadioTab.GENRE -> load {
                val t = freeTag?.let { listOf(it) } ?: GenreCatalog.byId(genreId ?: "")?.radioTags.orEmpty()
                client.byGenre(t, genreCountry?.code)
            }
            RadioTab.COUNTRY -> country?.let { c ->
                load { client.byCountry(c.code, countryGenre?.let { GenreCatalog.byId(it)?.radioTags?.firstOrNull() }) }
            } ?: run { stations = emptyList() }
            RadioTab.SOMAFM -> { loading = true; soma = client.somaFm.channels(); loading = false }
            RadioTab.FM -> fm = client.radioBrowser.fmStations(country?.code ?: localCountry)
        }
    }
    LaunchedEffect(externalQuery) {
        val q = externalQuery ?: return@LaunchedEffect
        query = q; searching = true; load { client.search(q) }
    }

    if (!online) {
        Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Radio needs a connection — check Wi-Fi / mobile data in Settings.", color = p.muted, modifier = Modifier.padding(24.dp)) }
        return
    }

    LazyColumn(modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            OutlinedTextField(
                value = query, onValueChange = { query = it; if (it.isBlank()) searching = false }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                placeholder = { Text("Search all stations") }, leadingIcon = { Icon(Icons.Filled.Search, null) },
                keyboardActions = KeyboardActions(onSearch = { if (query.isNotBlank()) { searching = true; scope.launch { load { client.search(query) } } } }),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent, cursorColor = p.accent),
                shape = RoundedCornerShape(16.dp),
            )
        }
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(RadioTab.entries) { t -> NeonChip(t.label, selected = !searching && tab == t) { searching = false; query = ""; tab = t } }
            }
        }

        if (searching) {
            item { SectionTitle("Results for “$query”") }
            stationList(this, stations, loading) { onPlay(it, null) }
            return@LazyColumn
        }

        when (tab) {
            RadioTab.GENRE -> {
                item { SectionTitle("Genres") }
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(GenreCatalog.all, key = { it.id }) { g -> NeonChip("${g.emoji} ${g.displayName}", selected = freeTag == null && g.id == genreId) { genreId = g.id; freeTag = null } }
                    }
                }
                if (tags.isNotEmpty()) item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(tags, key = { "t" + it.name }) { t -> NeonChip("#${t.name} · ${t.stationCount}", selected = freeTag == t.name) { freeTag = t.name } }
                    }
                }
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item { NeonChip("🌐 All countries", selected = genreCountry == null) { genreCountry = null } }
                        items(countries.take(40), key = { "gc" + it.code }) { c -> NeonChip("${c.flag} ${c.name}", selected = genreCountry?.code == c.code) { genreCountry = c } }
                    }
                }
                stationList(this, stations, loading) { onPlay(it, if (freeTag == null) genreId else null) }
            }
            RadioTab.COUNTRY -> {
                val c = country
                if (c == null) {
                    item {
                        OutlinedTextField(countryFilter, { countryFilter = it }, Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("Find a country") },
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = p.accent), shape = RoundedCornerShape(16.dp))
                    }
                    val list = countries.filter { countryFilter.isBlank() || it.name.contains(countryFilter, true) }
                        .sortedByDescending { if (it.code.equals(localCountry, true)) Int.MAX_VALUE else it.stationCount }
                    if (list.isEmpty()) item { Text("Loading countries…", color = p.muted) }
                    items(list, key = { "c" + it.code }) { ct ->
                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { country = ct; countryGenre = null }.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(ct.flag, style = MaterialTheme.typography.headlineSmall)
                            Spacer(Modifier.width(12.dp))
                            Text(ct.name, color = p.onBackground, modifier = Modifier.weight(1f))
                            Text("${ct.stationCount} stations", color = p.muted, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                } else {
                    item { NeonChip("⬅ ${c.flag} ${c.name} · all countries") { country = null } }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            item { NeonChip("All genres", selected = countryGenre == null) { countryGenre = null } }
                            items(GenreCatalog.all, key = { "cg" + it.id }) { g -> NeonChip("${g.emoji} ${g.displayName}", selected = countryGenre == g.id) { countryGenre = g.id } }
                        }
                    }
                    stationList(this, stations, loading) { onPlay(it, countryGenre) }
                }
            }
            RadioTab.SOMAFM -> {
                item { Text("Listener-supported, commercial-free channels from San Francisco.", color = p.muted, style = MaterialTheme.typography.labelSmall) }
                stationList(this, soma, loading) { onPlay(it, null) }
            }
            RadioTab.FM -> {
                item { SectionTitle("FM dial · ${country?.let { "${it.flag} ${it.name}" } ?: localCountry}") }
                item {
                    GlowCard(Modifier.fillMaxWidth()) {
                        FmDial(freq, fm, onTune = { freq = it }, onSettle = { f -> tuneTo(fm, f)?.let { onPlay(it, null) } }, modifier = Modifier.fillMaxWidth())
                        if (fm.isEmpty()) Text("Looking for FM stations that stream online…", style = MaterialTheme.typography.labelSmall, color = p.muted)
                    }
                }
                item { Text("Pick another country under “By country” to tune its FM stations.", color = p.muted, style = MaterialTheme.typography.labelSmall) }
            }
        }
    }
}

private fun stationList(scope: LazyListScope, stations: List<RadioStation>, loading: Boolean, onPlay: (RadioStation) -> Unit) = with(scope) {
    if (loading) item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Neon.palette.accent) } }
    items(stations, key = { it.provider.name + it.id }) { s -> StationRow(s) { onPlay(s) } }
    if (!loading && stations.isEmpty()) item { Text("No stations found.", color = Neon.palette.muted) }
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
                val meta = listOf(s.country, s.tagList.take(2).joinToString(" · "), s.codec, if (s.bitrate > 0) "${s.bitrate} kbps" else "")
                Text(meta.filter { it.isNotBlank() }.joinToString(" · "), color = p.muted, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Column(horizontalAlignment = Alignment.End) {
                s.fmFrequency?.let { Text("%.1f".format(it), color = p.accent, style = MaterialTheme.typography.labelSmall) }
                if (s.provider != RadioProvider.RADIO_BROWSER) Text(s.provider.label, color = p.secondary, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}
