package com.nocternal.playz.ai

import com.nocternal.playz.fx.EnhancerMode
import com.nocternal.playz.model.AudioSource
import com.nocternal.playz.model.Mood
import com.nocternal.playz.model.Playlist
import com.nocternal.playz.model.PlaylistKind
import com.nocternal.playz.theme.EqPresets
import com.nocternal.playz.theme.GenreCatalog
import com.nocternal.playz.theme.GenreDetector
import com.nocternal.playz.theme.ThemePresets

/**
 * The Nocternal AI assistant. Commands are understood and executed on-device ([CommandParser] + the
 * recommenders); open questions go to the optional [AssistantLlm] (Claude) when the user has configured it.
 * The engine never touches the player directly — it returns [AssistantAction]s for the app to run.
 */
class AssistantEngine(
    private val llm: AssistantLlm? = null,
    /** Plugin commands get a chance before the LLM, e.g. "start pomodoro". */
    private val pluginHandler: (String) -> String? = { null },
    private val genres: GenreDetector = GenreDetector(),
    private val moods: MoodDetector = MoodDetector(genres),
    private val recommender: RecommendationEngine = RecommendationEngine(genres, moods),
    private val art: AlbumArtGenerator = AlbumArtGenerator(genres),
) {
    private val conversation = ArrayDeque<LlmTurn>()

    suspend fun handle(text: String, ctx: AssistantContext): AssistantResponse {
        val intent = CommandParser.parse(text)
        if (intent is AssistantIntent.Unknown) {
            pluginHandler(text)?.let { return AssistantResponse(it) }
            return askLlm(text, ctx)
        }
        return execute(intent, ctx)
    }

    fun execute(intent: AssistantIntent, ctx: AssistantContext): AssistantResponse = when (intent) {
        is AssistantIntent.PlayGenre -> playGenre(intent.genreId, ctx)
        is AssistantIntent.PlayMood -> {
            val p = recommender.suggest(ctx, RecommendationEngine.Criteria(mood = intent.mood, hourOfDay = ctx.hourOfDay))
            val genre = genres.forMood(intent.mood, ctx.hourOfDay)
            if (p.trackIds.isEmpty()) searchOnline("${intent.mood.label} music", genre.id)
            else AssistantResponse("Here’s a ${intent.mood.label.lowercase()} mix — ${p.trackIds.size} songs.", listOf(AssistantAction.PlayQueue(p, genre.id)), listOf("Make it longer", "Boost bass", "Sleep in 30 min"))
        }
        is AssistantIntent.PlaySearch -> {
            val (q, src) = intent.query.split('@').let { it[0] to (it.getOrNull(1)?.let(AudioSource::valueOf) ?: AudioSource.LOCAL) }
            val local = ctx.tracks.filter { t -> q.split(' ').all { w -> "${t.title} ${t.artist} ${t.album}".lowercase().contains(w) } }
            if (src == AudioSource.LOCAL && local.isNotEmpty()) {
                AssistantResponse("Playing “${local.first().title}”${if (local.size > 1) " and ${local.size - 1} more" else ""}.",
                    listOf(AssistantAction.PlayQueue(Playlist("ai_search", "Search: $q", local.map { it.id }, PlaylistKind.AI))))
            } else {
                val target = if (src == AudioSource.LOCAL) AudioSource.YOUTUBE else src
                AssistantResponse("Not in your library — searching ${target.label} for “$q”.", listOf(AssistantAction.SwitchSource(target), AssistantAction.Search(q, target)))
            }
        }
        is AssistantIntent.SuggestPlaylist -> {
            val p = recommender.suggest(ctx, RecommendationEngine.Criteria(intent.genreId, intent.mood, intent.bpmMin, intent.bpmMax, ctx.hourOfDay))
            if (p.trackIds.isEmpty()) AssistantResponse("I couldn’t find matching songs in your library yet. Want me to look on YouTube Music or the Radio Hub?", suggestions = listOf("Search YouTube", "Open Radio Hub"))
            else AssistantResponse("I made “${p.name}” with ${p.trackIds.size} songs. ${p.description}.", listOf(AssistantAction.PlayQueue(p, p.genreId)), listOf("Save playlist", "Auto-mix it", "Shuffle"))
        }
        is AssistantIntent.AdjustBass -> AssistantResponse(
            if (intent.up) "Bass boosted. The limiter keeps it clean." else "Bass reduced.",
            listOf(AssistantAction.ChangeBass(if (intent.up) 0.2f else -0.2f)), listOf("More bass", "Reset EQ"),
        )
        is AssistantIntent.ApplyEqPreset -> AssistantResponse("EQ set to ${EqPresets.byId(intent.presetId).name}.", listOf(AssistantAction.SetEq(intent.presetId)))
        AssistantIntent.RecommendEq, AssistantIntent.OptimizeEq -> {
            val advice = EqAdvisor.recommend(ctx.nowPlaying, ctx.route, genres)
            AssistantResponse("${advice.reason}. Applied “${advice.preset.name}”.", listOf(AssistantAction.SetEq(advice.preset.id)), listOf("Boost bass", "Vocal clarity", "Flat"))
        }
        is AssistantIntent.ActivateTheme -> {
            val g = GenreCatalog.byId(intent.genreId)!!
            AssistantResponse("${ThemePresets.byId(g.themePresetId).name} activated ${g.emoji}", listOf(AssistantAction.ApplyGenreTheme(g.id)), listOf("Play ${g.displayName}", "Lighting settings"))
        }
        is AssistantIntent.SwitchSource -> AssistantResponse("Switched to ${intent.source.label}.", listOf(AssistantAction.SwitchSource(intent.source)))
        is AssistantIntent.SleepTimer -> AssistantResponse("Sleep timer set for ${formatMinutes(intent.minutes)}. I’ll fade the music out gently.", listOf(AssistantAction.SetSleepTimer(intent.minutes)), listOf("Play sleep sounds", "Cancel timer"))
        is AssistantIntent.Transport -> AssistantResponse(transportReply(intent.command), listOf(AssistantAction.Transport(intent.command)))
        is AssistantIntent.Enhance -> AssistantResponse("${intent.mode.label} on: ${intent.mode.description.replaceFirstChar { it.lowercase() }}.", listOf(AssistantAction.Enhance(intent.mode)), EnhancerMode.entries.filter { it != intent.mode }.take(2).map { it.label })
        is AssistantIntent.VocalRemover -> AssistantResponse(if (intent.on) "Karaoke mode on — vocals removed. Lyrics are on the player screen." else "Vocals are back.", listOf(AssistantAction.SetVocalRemover(if (intent.on) 1f else 0f)))
        is AssistantIntent.ExplainFeature -> AssistantResponse(FeatureExplainer.explain(intent.topic))
        AssistantIntent.IdentifySong -> AssistantResponse("Listening… hold your phone near the music.", listOf(AssistantAction.StartRecognition))
        AssistantIntent.GenerateAlbumArt -> ctx.nowPlaying?.let { AssistantResponse("Here’s neon art for “${it.title}”.", listOf(AssistantAction.ShowAlbumArt(art.generate(it)))) }
            ?: AssistantResponse("Play a song first and I’ll design its cover.")
        AssistantIntent.AutoMix -> AssistantResponse("DJ auto-mix on: I’ll pick key- and tempo-matched songs and blend them on the beat.", listOf(AssistantAction.EnableAutoMix(true)), listOf("Turn off auto-mix"))
        is AssistantIntent.Unknown -> AssistantResponse(helpText(ctx))
    }

    private fun playGenre(genreId: String, ctx: AssistantContext): AssistantResponse {
        val g = GenreCatalog.byId(genreId) ?: return AssistantResponse(helpText(ctx))
        val p = recommender.suggest(ctx, RecommendationEngine.Criteria(genreId = genreId, hourOfDay = ctx.hourOfDay))
        if (p.trackIds.isEmpty()) return searchOnline(g.aiSuggestions.first(), g.id)
        return AssistantResponse(
            "Playing your ${g.displayName} playlist ${g.emoji} — ${ThemePresets.byId(g.themePresetId).name} theme on.",
            listOf(AssistantAction.PlayQueue(p, g.id), AssistantAction.ApplyGenreTheme(g.id)),
            g.aiSuggestions.drop(1).take(2),
        )
    }

    private fun searchOnline(query: String, genreId: String): AssistantResponse = AssistantResponse(
        "Nothing like that in your library yet, so I’m tuning the Radio Hub to “$query”.",
        listOf(AssistantAction.ApplyGenreTheme(genreId), AssistantAction.SwitchSource(AudioSource.RADIO), AssistantAction.Search(query, AudioSource.RADIO)),
        listOf("Try YouTube Music instead"),
    )

    private suspend fun askLlm(text: String, ctx: AssistantContext): AssistantResponse {
        val client = llm ?: return AssistantResponse(helpText(ctx))
        val system = buildSystemPrompt(ctx)
        conversation.addLast(LlmTurn(LlmRole.USER, text))
        while (conversation.size > 12) conversation.removeFirst()
        return try {
            val reply = client.complete(system, conversation.toList())
            conversation.addLast(LlmTurn(LlmRole.ASSISTANT, reply))
            // The model can ask us to run a command by ending with a line "ACTION: <command>".
            val actionLine = reply.lines().lastOrNull { it.startsWith("ACTION:") }
            val clean = reply.lines().filterNot { it.startsWith("ACTION:") }.joinToString("\n").trim()
            val actions = actionLine?.removePrefix("ACTION:")?.trim()?.let { cmd ->
                CommandParser.parse(cmd).takeIf { it !is AssistantIntent.Unknown }?.let { execute(it, ctx).actions }
            }.orEmpty()
            AssistantResponse(clean, actions, fromLlm = true)
        } catch (e: Exception) {
            conversation.removeLast()
            AssistantResponse("I couldn’t reach the AI service (${e.message ?: "network error"}). Commands like “play lo-fi” still work offline.")
        }
    }

    private fun buildSystemPrompt(ctx: AssistantContext): String = buildString {
        appendLine("You are the assistant inside NOCTERNAL PLAYZ, a neon music player app. Answer in 1–4 short sentences, friendly and specific.")
        appendLine("You can control the app by ending your reply with one line \"ACTION: <command>\" using one of: play <genre|mood|song>, boost bass, reduce bass, recommend eq, activate <genre> theme, switch to <local|youtube|radio>, sleep in <n> minutes, enhance clarity, remove noise, karaoke on, auto mix, identify song. Only add an ACTION if the user wants something done.")
        appendLine("Built-in genres: ${GenreCatalog.all.joinToString { it.displayName }}.")
        appendLine("Time of day: ${ctx.hourOfDay}:00. Source: ${ctx.source.label}. Output: ${ctx.route.name.lowercase()}.")
        ctx.nowPlaying?.let { t ->
            append("Now playing: “${t.title}” by ${t.artist}")
            t.bpm?.let { append(", ${it.toInt()} BPM") }
            t.camelotKey?.let { append(", key $it") }
            genres.detect(t)?.let { append(", genre ${it.genre.displayName}") }
            appendLine(".")
        }
        if (!ctx.privateMode && ctx.tracks.isNotEmpty()) {
            val topGenres = ctx.tracks.mapNotNull { genres.detect(it)?.genre?.displayName }.groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.take(5)
            appendLine("Library: ${ctx.tracks.size} songs; top genres ${topGenres.joinToString { "${it.key} (${it.value})" }}.")
        }
    }

    private fun helpText(ctx: AssistantContext) = buildString {
        append("Try “play trance playlist”, “boost bass”, “activate meditation theme”, “sleep in 30 minutes” or “what song is this?”.")
        if (llm == null) append(" Add a Claude API key in Settings → AI to ask me anything else.")
    }

    private fun transportReply(c: TransportCommand) = when (c) {
        TransportCommand.PLAY -> "Playing."
        TransportCommand.PAUSE -> "Paused."
        TransportCommand.NEXT -> "Next song."
        TransportCommand.PREVIOUS -> "Going back."
        TransportCommand.SHUFFLE -> "Shuffle on."
        TransportCommand.REPEAT -> "Repeat on."
        TransportCommand.VOLUME_UP -> "Louder."
        TransportCommand.VOLUME_DOWN -> "Quieter."
        TransportCommand.LIKE -> "Added to Favorites 💜"
    }

    private fun formatMinutes(m: Int) = if (m >= 60 && m % 60 == 0) "${m / 60} h" else if (m >= 60) "${m / 60} h ${m % 60} min" else "$m min"

    companion object {
        /** Mood → a short line the Home screen shows when the AI detects the listening mood. */
        fun moodLine(mood: Mood) = "Feeling ${mood.label.lowercase()}? I matched the lights."
    }
}
