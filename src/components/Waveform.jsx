import { useEffect, useRef } from 'react'

const W = 440
const H = 120
const MID = 60
const N = 40
const BAR_WIDTH = W / N
const CYCLE_MS = 3600

function noisyHeight(i, t) {
  const v =
    Math.sin(i * 1.7 + t * 0.002) * 0.5 +
    Math.sin(i * 3.1 + t * 0.003) * 0.3 +
    Math.sin(i * 0.6 + t * 0.001) * 0.5
  return Math.abs(v) * 46 + 6
}

function cleanHeight(i, t) {
  const v = Math.sin(i * 0.35 + t * 0.0015)
  return Math.abs(v) * 40 + 10
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function mixColor(c1, c2, t) {
  const p1 = hexToRgb(c1)
  const p2 = hexToRgb(c2)
  const r = Math.round(p1.r + (p2.r - p1.r) * t)
  const g = Math.round(p1.g + (p2.g - p1.g) * t)
  const b = Math.round(p1.b + (p2.b - p1.b) * t)
  return `rgb(${r},${g},${b})`
}

export default function Waveform() {
  const svgRef = useRef(null)
  const barsRef = useRef([])

  useEffect(() => {
    const svg = svgRef.current
    const NS = 'http://www.w3.org/2000/svg'
    const bars = []

    for (let i = 0; i < N; i++) {
      const rect = document.createElementNS(NS, 'rect')
      rect.setAttribute('x', i * BAR_WIDTH + BAR_WIDTH * 0.2)
      rect.setAttribute('width', BAR_WIDTH * 0.6)
      rect.setAttribute('rx', BAR_WIDTH * 0.3)
      rect.setAttribute('fill', '#3b4b6b')
      svg.appendChild(rect)
      bars.push(rect)
    }
    barsRef.current = bars

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReduced) {
      bars.forEach((rect, i) => {
        const h = cleanHeight(i, 0)
        rect.setAttribute('y', MID - h / 2)
        rect.setAttribute('height', h)
        rect.setAttribute('fill', '#e8a33d')
      })
      return
    }

    let start = null
    let rafId

    function frame(ts) {
      if (!start) start = ts
      const elapsed = (ts - start) % CYCLE_MS
      const phase = elapsed / CYCLE_MS

      let mix
      if (phase < 0.4) mix = 0
      else if (phase < 0.65) mix = (phase - 0.4) / 0.25
      else if (phase < 0.9) mix = 1
      else mix = 1 - (phase - 0.9) / 0.1
      mix = Math.max(0, Math.min(1, mix))

      bars.forEach((rect, i) => {
        const hN = noisyHeight(i, elapsed)
        const hC = cleanHeight(i, elapsed)
        const h = hN * (1 - mix) + hC * mix
        rect.setAttribute('y', MID - h / 2)
        rect.setAttribute('height', h)
        rect.setAttribute('fill', mixColor('#4a5c72', '#e8a33d', mix))
        rect.setAttribute('opacity', 0.55 + mix * 0.45)
      })

      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafId)
      bars.forEach((rect) => rect.remove())
    }
  }, [])

  return (
    <div className="mb-2 flex h-[140px] items-center justify-center">
      <svg
        ref={svgRef}
        className="overflow-visible"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
      />
    </div>
  )
}
