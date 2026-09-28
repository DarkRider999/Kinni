package com.subzero.messenger.ui.theme

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource

/**
 * A soft, faded photo backdrop behind a screen's content. The image sits at low
 * alpha over the dark theme, with a gentle dark gradient scrim so text stays
 * readable. Content is drawn on top.
 */
@Composable
fun FadedBackdrop(@DrawableRes image: Int, content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0xFF0B0F14))) {
        Image(
            painter = painterResource(image),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            alpha = 0.16f,
            modifier = Modifier.fillMaxSize(),
        )
        // Scrim: slightly darker at top/bottom so headers and the input row read clearly.
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    listOf(Color(0xCC0B0F14), Color(0x660B0F14), Color(0xCC0B0F14))
                )
            )
        )
        content()
    }
}
