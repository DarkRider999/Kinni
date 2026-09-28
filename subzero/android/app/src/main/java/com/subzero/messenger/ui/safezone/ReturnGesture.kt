package com.subzero.messenger.ui.safezone

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput

/**
 * Hidden return-to-chat gestures layered over any SafeZone screen. Recognizes:
 *  - a double-tap in the top-right corner region,
 *  - a two-finger swipe down.
 * (A hidden long-press pixel and volume-down-twice are handled at the Activity
 * level in MainActivity via key events.)
 */
fun Modifier.safeZoneReturnGestures(
    screenWidthPx: Float,
    onReturn: () -> Unit,
): Modifier = this
    .pointerInput(Unit) {
        detectTapGestures(
            onDoubleTap = { offset ->
                val inTopRight = offset.x > screenWidthPx * 0.8f && offset.y < screenWidthPx * 0.2f
                if (inTopRight) onReturn()
            },
        )
    }
    .pointerInput(Unit) {
        var totalDy = 0f
        var pointers = 0
        detectDragGestures(
            onDragStart = { totalDy = 0f },
            onDragEnd = {
                if (pointers >= 2 && totalDy > 200f) onReturn()
                pointers = 0
            },
            onDrag = { change, dragAmount: Offset ->
                pointers = maxOf(pointers, change.pressed.let { if (it) 1 else 0 } + 1)
                totalDy += dragAmount.y
            },
        )
    }
