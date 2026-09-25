package com.nocternal.playz.fx.analysis

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** In-place iterative radix-2 FFT with a precomputed twiddle table and Hann window. */
class Fft(val size: Int) {
    init { require(size >= 2 && size and (size - 1) == 0) { "FFT size must be a power of two" } }

    private val cosT = FloatArray(size / 2) { cos(2 * PI * it / size).toFloat() }
    private val sinT = FloatArray(size / 2) { -sin(2 * PI * it / size).toFloat() }
    val window = FloatArray(size) { (0.5 - 0.5 * cos(2 * PI * it / (size - 1))).toFloat() }
    private val bitRev = IntArray(size).also { rev ->
        val bits = Integer.numberOfTrailingZeros(size)
        for (i in 0 until size) rev[i] = Integer.reverse(i) ushr (32 - bits)
    }

    fun transform(re: FloatArray, im: FloatArray) {
        for (i in 0 until size) {
            val j = bitRev[i]
            if (j > i) {
                var t = re[i]; re[i] = re[j]; re[j] = t
                t = im[i]; im[i] = im[j]; im[j] = t
            }
        }
        var len = 2
        while (len <= size) {
            val half = len / 2; val step = size / len
            var i = 0
            while (i < size) {
                for (k in 0 until half) {
                    val wr = cosT[k * step]; val wi = sinT[k * step]
                    val a = i + k; val b = a + half
                    val xr = re[b] * wr - im[b] * wi
                    val xi = re[b] * wi + im[b] * wr
                    re[b] = re[a] - xr; im[b] = im[a] - xi
                    re[a] += xr; im[a] += xi
                }
                i += len
            }
            len *= 2
        }
    }

    /** Windowed magnitude spectrum (size/2 bins) of [input] starting at [offset]. */
    fun magnitudes(input: FloatArray, offset: Int, out: FloatArray, re: FloatArray = FloatArray(size), im: FloatArray = FloatArray(size)) {
        for (i in 0 until size) { re[i] = input.getOrElse(offset + i) { 0f } * window[i]; im[i] = 0f }
        transform(re, im)
        for (i in 0 until size / 2) out[i] = kotlin.math.sqrt(re[i] * re[i] + im[i] * im[i])
    }
}
