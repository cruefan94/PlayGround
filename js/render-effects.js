import { TAU, clamp, easeOutCubic, FONT_MONO } from './render-utils.js'

const SIDE_COLORS = {
  us: 'rgba(198,224,165,.95)',
  nva: 'rgba(238,145,116,.95)'
}

function explosion(ctx, effect, now) {
  const p = clamp((now - effect.start) / effect.dur, 0, 1)
  if (p <= 0 || p >= 1) return
  const e = easeOutCubic(p)
  const size = effect.size || 24
  ctx.save()
  ctx.globalAlpha = (1 - p) * 0.95
  // flash
  if (p < 0.45) {
    const g = ctx.createRadialGradient(effect.x, effect.y, 1, effect.x, effect.y, size * (0.5 + e))
    g.addColorStop(0, 'rgba(255,247,200,.98)')
    g.addColorStop(0.25, 'rgba(255,190,79,.9)')
    g.addColorStop(0.6, 'rgba(213,94,47,.5)')
    g.addColorStop(1, 'rgba(94,44,24,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(effect.x, effect.y, size * (0.9 + e * 1.2), 0, TAU)
    ctx.fill()
  }
  // shock ring
  ctx.strokeStyle = `rgba(244,205,137,${(1 - p) * 0.55})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(effect.x, effect.y, 6 + e * size * 1.7, 0, TAU)
  ctx.stroke()
  // smoke puffs
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + effect.seed
    const rr = 5 + e * (10 + i * 2)
    const px = effect.x + Math.cos(a) * e * size * 0.7
    const py = effect.y + Math.sin(a) * e * size * 0.55 - e * 10
    ctx.fillStyle = `rgba(${70 + i * 5},${63 + i * 4},${48 + i * 3},${(1 - p) * 0.28})`
    ctx.beginPath()
    ctx.arc(px, py, rr, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

function tracer(ctx, effect, now) {
  const p = clamp((now - effect.start) / effect.dur, 0, 1)
  if (p < 0 || p > 1) return
  const x1 = effect.x1, y1 = effect.y1, x2 = effect.x2, y2 = effect.y2
  const alpha = 1 - p * 0.55
  ctx.save()
  ctx.globalAlpha = alpha
  if (p < 0.18) {
    const g = ctx.createRadialGradient(x1, y1, 0, x1, y1, 14)
    g.addColorStop(0, 'rgba(255,246,194,.95)')
    g.addColorStop(1, 'rgba(255,180,70,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x1, y1, 14, 0, TAU)
    ctx.fill()
  }
  const grad = ctx.createLinearGradient(x1, y1, x2, y2)
  grad.addColorStop(0, 'rgba(255,239,182,.2)')
  grad.addColorStop(1, SIDE_COLORS[effect.side] || SIDE_COLORS.us)
  ctx.strokeStyle = grad
  ctx.lineWidth = effect.heavy ? 2.6 : 1.5
  ctx.globalAlpha = alpha * 0.9
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  // travelling round
  const hx = x1 + (x2 - x1) * clamp(p * 1.25, 0, 1)
  const hy = y1 + (y2 - y1) * clamp(p * 1.25, 0, 1)
  ctx.globalAlpha = 1 - p
  ctx.fillStyle = effect.side === 'nva' ? '#ffb08f' : '#fff1ba'
  ctx.beginPath()
  ctx.arc(hx, hy, effect.heavy ? 3.4 : 2.1, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function arcShot(ctx, effect, now) {
  const p = clamp((now - effect.start) / effect.dur, 0, 1)
  if (p < 0 || p > 1) return
  const x1 = effect.x1, y1 = effect.y1, x2 = effect.x2, y2 = effect.y2
  const cx = (x1 + x2) / 2
  const cy = Math.min(y1, y2) - 100
  const point = (t) => {
    const mt = 1 - t
    return {
      x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
      y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2
    }
  }
  ctx.save()
  ctx.globalAlpha = 0.42 * (1 - p * 0.4)
  ctx.setLineDash([3, 5])
  ctx.strokeStyle = 'rgba(238,220,165,.7)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  for (let i = 1; i <= 12; i++) {
    const pt = point(i / 12)
    ctx.lineTo(pt.x, pt.y)
  }
  ctx.stroke()
  ctx.setLineDash([])
  const shell = point(clamp(p * 1.2, 0, 1))
  ctx.globalAlpha = 1 - p * 0.5
  ctx.fillStyle = '#f4e0a2'
  ctx.beginPath()
  ctx.arc(shell.x, shell.y, 2.4, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function floatingText(ctx, effect, now) {
  const p = clamp((now - effect.start) / effect.dur, 0, 1)
  if (p < 0 || p > 1) return
  const rise = 26 * easeOutCubic(p)
  ctx.save()
  ctx.globalAlpha = p < 0.15 ? p / 0.15 : 1 - Math.pow(p, 2.2)
  ctx.font = `700 ${effect.size || 14}px ${FONT_MONO}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(8,11,6,.8)'
  ctx.strokeText(effect.text, effect.x, effect.y - rise)
  ctx.fillStyle = effect.color || '#f2e6b7'
  ctx.fillText(effect.text, effect.x, effect.y - rise)
  ctx.restore()
}

function ring(ctx, effect, now) {
  const p = clamp((now - effect.start) / effect.dur, 0, 1)
  if (p < 0 || p > 1) return
  const e = easeOutCubic(p)
  ctx.save()
  ctx.globalAlpha = 1 - p
  ctx.strokeStyle = effect.color || 'rgba(240,215,140,.85)'
  ctx.lineWidth = effect.width || 1.5
  ctx.beginPath()
  ctx.arc(effect.x, effect.y, (effect.radius || 18) * e, 0, TAU)
  ctx.stroke()
  ctx.restore()
}

function heal(ctx, effect, now) {
  const p = clamp((now - effect.start) / effect.dur, 0, 1)
  if (p < 0 || p > 1) return
  ctx.save()
  ctx.globalAlpha = 1 - p
  ctx.strokeStyle = 'rgba(130,224,165,.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(effect.x, effect.y, 12 + easeOutCubic(p) * 22, 0, TAU)
  ctx.stroke()
  const y = effect.y - 18 - easeOutCubic(p) * 24
  ctx.fillStyle = 'rgba(151,239,180,.95)'
  ctx.fillRect(effect.x - 2, y - 7, 4, 14)
  ctx.fillRect(effect.x - 7, y - 2, 14, 4)
  ctx.restore()
}

function helicopter(ctx, x, y, s, now) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.055)
  // rotor blur
  ctx.globalAlpha = 0.18
  ctx.strokeStyle = 'rgba(218,226,204,.85)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(0, 0, 38 * s, 5 * s, 0, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, 0, 5 * s, 38 * s, 0, 0, TAU)
  ctx.stroke()
  ctx.globalAlpha = 1
  // tail boom
  ctx.fillStyle = 'rgba(74,84,55,.96)'
  ctx.fillRect(-38 * s, -3 * s, 30 * s, 6 * s)
  ctx.fillRect(-38 * s, -8 * s, 4 * s, 16 * s)
  ctx.fillRect(-50 * s, -14 * s, 2 * s, 28 * s)
  // fuselage
  const g = ctx.createLinearGradient(-20, -12, 20, 12)
  g.addColorStop(0, 'rgba(118,130,84,.98)')
  g.addColorStop(1, 'rgba(60,70,42,.98)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(3 * s, 0, 24 * s, 11 * s, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(30,36,22,.9)'
  ctx.lineWidth = 1
  ctx.stroke()
  // canopy
  ctx.fillStyle = 'rgba(168,190,172,.8)'
  ctx.beginPath()
  ctx.ellipse(14 * s, 0, 8 * s, 6 * s, 0, 0, TAU)
  ctx.fill()
  // skids
  ctx.strokeStyle = 'rgba(42,48,31,.9)'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(-5 * s, -14 * s)
  ctx.lineTo(-5 * s, 14 * s)
  ctx.moveTo(20 * s, -14 * s)
  ctx.lineTo(20 * s, 14 * s)
  ctx.stroke()
  // door gunner flash
  const flicker = Math.sin(now * 0.09) > 0.2
  if (flicker) {
    ctx.fillStyle = 'rgba(255,238,160,.95)'
    ctx.beginPath()
    ctx.arc(27 * s, 7 * s, 2.4 * s, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

function hueyRun(ctx, effect, now) {
  const p = clamp((now - effect.start) / effect.dur, 0, 1)
  if (p < 0 || p > 1) return
  const x = effect.x - 250 + 500 * p
  const y = effect.y - 130 + Math.sin(p * Math.PI) * -8
  helicopter(ctx, x, y, 0.9, now)
  if (p > 0.32 && p < 0.75) {
    const hx = x + 24
    const hy = y + 5
    ctx.save()
    ctx.globalAlpha = 0.75
    ctx.strokeStyle = 'rgba(255,220,130,.8)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.lineTo(effect.x, effect.y)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,240,180,.95)'
    ctx.beginPath()
    ctx.arc(hx, hy, 2.4, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}

function dust(ctx, effect, now) {
  const p = clamp((now - effect.start) / effect.dur, 0, 1)
  if (p < 0 || p > 1) return
  ctx.save()
  ctx.globalAlpha = (1 - p) * 0.3
  for (let i = 0; i < 4; i++) {
    const a = effect.seed + i * 1.4
    ctx.fillStyle = 'rgba(174,156,112,.9)'
    ctx.beginPath()
    ctx.arc(effect.x + Math.cos(a) * p * 12, effect.y + Math.sin(a) * p * 7, 2 + p * 5, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

export function drawEffect(ctx, effect, now) {
  switch (effect.type) {
    case 'explosion': explosion(ctx, effect, now); break
    case 'tracer': tracer(ctx, effect, now); break
    case 'arc': arcShot(ctx, effect, now); break
    case 'text': floatingText(ctx, effect, now); break
    case 'ring': ring(ctx, effect, now); break
    case 'heal': heal(ctx, effect, now); break
    case 'huey': hueyRun(ctx, effect, now); break
    case 'dust': dust(ctx, effect, now); break
    default: break
  }
}
