import { useEffect, useRef } from 'react'

interface WaveformProps {
  buffer: AudioBuffer | null
  progress: number // 0-1
  color: string
}

export function Waveform({ buffer, progress, color }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peaksRef = useRef<{ min: Float32Array; max: Float32Array } | null>(null)

  useEffect(() => {
    if (!buffer) {
      peaksRef.current = null
      return
    }
    const canvas = canvasRef.current
    const width = canvas?.width ?? 600
    const data = buffer.getChannelData(0)
    const bucketSize = Math.max(1, Math.floor(data.length / width))
    const min = new Float32Array(width)
    const max = new Float32Array(width)
    for (let i = 0; i < width; i++) {
      let lo = 1
      let hi = -1
      const start = i * bucketSize
      const end = Math.min(data.length, start + bucketSize)
      for (let j = start; j < end; j++) {
        const v = data[j]
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      min[i] = lo
      max[i] = hi
    }
    peaksRef.current = { min, max }
  }, [buffer])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0b0b14'
    ctx.fillRect(0, 0, width, height)

    const peaks = peaksRef.current
    if (peaks) {
      const mid = height / 2
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 4
      ctx.beginPath()
      for (let x = 0; x < width; x++) {
        const lo = peaks.min[x] ?? 0
        const hi = peaks.max[x] ?? 0
        ctx.moveTo(x, mid + lo * mid)
        ctx.lineTo(x, mid + hi * mid)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    const playheadX = Math.max(0, Math.min(width, progress * width))
    ctx.strokeStyle = '#ff2dd1'
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.stroke()
  }, [progress, color, buffer])

  return <canvas ref={canvasRef} width={600} height={90} className="waveform-canvas" />
}
