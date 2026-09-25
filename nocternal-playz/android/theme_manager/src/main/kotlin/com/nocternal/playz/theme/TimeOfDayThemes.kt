package com.nocternal.playz.theme

import com.nocternal.playz.model.GenreDefinition

/** Auto theme by time: sunrise amber in the morning, focus by day, chill at dusk, galaxy at night, moonlit when asleep. */
object TimeOfDayThemes {
    fun genreForHour(hour: Int): GenreDefinition = when (((hour % 24) + 24) % 24) {
        in 5..8 -> GenreCatalog.MORNING_VIBES
        in 9..16 -> GenreCatalog.FOCUS
        in 17..20 -> GenreCatalog.CHILLOUT
        in 21..23 -> GenreCatalog.NIGHT_DRIVE
        else -> GenreCatalog.SLEEP
    }
}
