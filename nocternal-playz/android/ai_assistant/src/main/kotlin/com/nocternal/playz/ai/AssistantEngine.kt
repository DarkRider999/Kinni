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
 * The Nocternal Bot: a fully on-device command bot (no AI/network dependency) that understands text and
 * voice commands — including turning any app setting on or off from one place — via [CommandParser] and
 * the recommenders. The engine never touches the player directly — it returns [AssistantAction]s for the
 * app to run.
 */
class AssistantEngine(
    /** Plugin commands get a chance first, e.g. "start pomodoro". */
    private val pluginHandler: (String) -> String? = { null },
    private val genres: GenreDetector = GenreDetector(),
    private val moods: MoodDetector = MoodDetector(genres),
    private val recommender: RecommendationEngine = RecommendationEngine(genres, moods),
    private val art: AlbumArtGenerator = AlbumArtGenerator(genres),
) {
    suspend fun handle(text: String, ctx: AssistantContext): AssistantResponse {
        val intent = CommandParser.parse(text)
        if (intent is AssistantIntent.Unknown) {
            pluginHandler(text)?.let { return AssistantResponse(it) }
            return AssistantResponse(helpText())
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
        is AssistantIntent.ToggleSetting -> AssistantResponse(
            "${intent.setting.label} turned ${if (intent.on) "on" else "off"}.",
            listOf(AssistantAction.UpdateSetting(intent.setting, intent.on)),
        )
        is AssistantIntent.SetCrossfade -> AssistantResponse(
            if (intent.seconds <= 0f) "Crossfade off — true gapless playback." else "Crossfade set to ${intent.seconds.toInt()}s.",
            listOf(AssistantAction.SetCrossfadeSeconds(intent.seconds)),
        )
        is AssistantIntent.Unknown -> AssistantResponse(helpText())
    }

    private fun playGenre(genreId: String, ctx: AssistantContext): AssistantResponse {
        val g = GenreCatalog.byId(genreId) ?: return AssistantResponse(helpText())
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

    private fun helpText() = "Try “play trance playlist”, “boost bass”, “activate meditation theme”, “sleep in 30 minutes”, " +
        "“turn on gapless”, “turn off private mode”, “crossfade to 8 seconds” or “what song is this?”."

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
