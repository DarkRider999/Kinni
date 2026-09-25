package com.nocternal.playz.audio

import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import com.nocternal.playz.fx.FxChain
import com.nocternal.playz.fx.analysis.SpectrumAnalyzer
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Runs the shared Kotlin [FxChain] inside ExoPlayer's audio sink, so every effect, the auto-fader and the
 * limiter apply to local files, YouTube-less streams and radio alike. Mono input is up-mixed to stereo;
 * formats it can't handle (float, > 2 channels) are passed through untouched.
 * The post-FX signal feeds the [SpectrumAnalyzer] that drives the lighting.
 */
@OptIn(UnstableApi::class)
class FxAudioProcessor(private val chain: FxChain) : BaseAudioProcessor() {
    @Volatile var analyzer: SpectrumAnalyzer? = null
        private set
    private var scratch = FloatArray(0)

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT || inputAudioFormat.channelCount !in 1..2) {
            return AudioProcessor.AudioFormat.NOT_SET
        }
        chain.prepare(inputAudioFormat.sampleRate)
        if (analyzer == null || lastRate != inputAudioFormat.sampleRate) {
            analyzer = SpectrumAnalyzer(inputAudioFormat.sampleRate)
            lastRate = inputAudioFormat.sampleRate
        }
        return AudioProcessor.AudioFormat(inputAudioFormat.sampleRate, 2, C.ENCODING_PCM_16BIT)
    }

    private var lastRate = 0

    override fun queueInput(inputBuffer: ByteBuffer) {
        val bytes = inputBuffer.remaining()
        if (bytes == 0) return
        val inCh = inputAudioFormat.channelCount
        val frames = bytes / (2 * inCh)
        if (scratch.size < frames * 2) scratch = FloatArray(frames * 2)
        val input = inputBuffer.order(ByteOrder.nativeOrder())
        for (f in 0 until frames) {
            val l = input.getShort() / 32768f
            val r = if (inCh == 2) input.getShort() / 32768f else l
            scratch[2 * f] = l; scratch[2 * f + 1] = r
        }
        inputBuffer.position(inputBuffer.limit())
        chain.process(scratch, frames)
        analyzer?.push(scratch, frames)
        val out = replaceOutputBuffer(frames * 4)
        for (i in 0 until frames * 2) out.putShort((scratch[i] * 32767f).toInt().coerceIn(-32768, 32767).toShort())
        out.flip()
    }

    override fun onReset() {
        chain.reset()
    }
}
