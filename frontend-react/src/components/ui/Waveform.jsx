import { useRef, useEffect } from 'react'
import { C } from '@/lib/theme'

export function Waveform({ analyserRef, isRecording, height = 120 }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  // Animation loop — reads analyserRef.current on every frame (refs are stable)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      if (!W || !H) return
      const mid = H / 2

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      // Centre line
      ctx.beginPath()
      ctx.strokeStyle = C.border
      ctx.lineWidth = 0.5
      ctx.moveTo(0, mid)
      ctx.lineTo(W, mid)
      ctx.stroke()

      const analyser = analyserRef?.current
      if (!analyser || !isRecording) {
        // Idle: slow sine wave
        const t = Date.now() / 1600
        ctx.beginPath()
        ctx.strokeStyle = C.cyanDim + '44'
        ctx.lineWidth = 1
        for (let x = 0; x < W; x++) {
          const y = mid + Math.sin((x / W) * Math.PI * 4 + t) * 5
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        return
      }

      const bufLen = analyser.frequencyBinCount
      const data   = new Uint8Array(bufLen)
      analyser.getByteTimeDomainData(data)

      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0, C.cyanDim + '88')
      grad.addColorStop(0.5, C.cyan)
      grad.addColorStop(1, C.cyanDim + '88')

      const drawWave = (flip) => {
        ctx.beginPath()
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        const sw = W / bufLen
        let x = 0
        for (let i = 0; i < bufLen; i++) {
          const v   = data[i] / 128.0
          const amp = (v - 1) * (H / 2.6)
          const y   = mid + (flip ? -amp : amp)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          x += sw
        }
        ctx.stroke()
      }

      ctx.shadowBlur  = 12
      ctx.shadowColor = C.cyan + '55'
      drawWave(false)
      drawWave(true)
      ctx.shadowBlur  = 0
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyserRef, isRecording]) // analyserRef is stable; isRecording drives the branch

  // Canvas sizing — use a ResizeObserver that resets the transform correctly
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w   = canvas.offsetWidth
      const h   = canvas.offsetHeight
      if (canvas.width  === w * dpr && canvas.height === h * dpr) return
      canvas.width  = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')
      // Reset transform before applying DPR scale (prevents accumulation)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    return () => ro.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height,
        borderRadius: 8,
        border: `1px solid ${isRecording ? C.cyan + '44' : C.border}`,
        boxShadow: isRecording ? `0 0 20px ${C.cyan}1a` : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    />
  )
}
