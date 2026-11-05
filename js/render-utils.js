import { HEX_SIZE } from './data.js'

export const TAU = Math.PI * 2
export const FONT_MONO = '"Courier New", Courier, monospace'
export const FONT_DISPLAY = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif'

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3)
}

export function easeInOut(t) {
  const p = clamp(t, 0, 1)
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
}

// Deterministic hash so foliage and details stay identical across reloads.
export function h2(c, r, s = 0) {
  let x = Math.imul(c + 17, 374761393) ^ Math.imul(r + 31, 668265263) ^ Math.imul(s + 7, 1274126177)
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

export function hexPoints(x, y, size = HEX_SIZE, shrink = 1) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 3
    pts.push({ x: x + Math.cos(a) * size * shrink, y: y + Math.sin(a) * size * shrink })
  }
  return pts
}

export function hexPath(ctx, x, y, size = HEX_SIZE * 1.006) {
  const pts = hexPoints(x, y, size)
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
  return pts
}

export function clipHex(ctx, x, y, size = HEX_SIZE * 1.006) {
  hexPath(ctx, x, y, size)
  ctx.clip()
}

export function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

export function drawSpacedText(ctx, text, x, y, spacing = 2) {
  let total = 0
  for (const ch of text) total += ctx.measureText(ch).width + spacing
  total -= spacing
  let cursor = x - total / 2
  const align = ctx.textAlign
  ctx.textAlign = 'left'
  for (const ch of text) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + spacing
  }
  ctx.textAlign = align
}

// ---------------------------------------------------------------------------
// Tiny top-down unit art. All drawn procedurally in the token's local space.
// ---------------------------------------------------------------------------

function line(ctx, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function soldier(ctx, r, { helmet = 'us', weapon = 'rifle' } = {}) {
  const body = 'rgba(232,226,200,.94)'
  const dark = 'rgba(18,22,14,.85)'
  // pack
  ctx.fillStyle = 'rgba(192,184,150,.85)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.2, 0, r * 0.19, r * 0.28, 0, 0, TAU)
  ctx.fill()
  // torso
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.27, r * 0.35, 0, 0, TAU)
  ctx.fill()
  // rifle / launcher
  if (weapon === 'mg') {
    ctx.fillStyle = dark
    ctx.fillRect(r * 0.02, -r * 0.08, r * 0.7, r * 0.1)
    line(ctx, r * 0.62, -r * 0.12, r * 0.85, -r * 0.22, r * 0.06, dark)
    line(ctx, r * 0.62, -r * 0.12, r * 0.85, 0, r * 0.06, dark)
    line(ctx, r * 0.2, r * 0.18, r * 0.05, r * 0.47, r * 0.06, dark)
    line(ctx, r * 0.2, r * 0.18, r * 0.37, r * 0.45, r * 0.06, dark)
  } else if (weapon === 'm79') {
    ctx.fillStyle = dark
    roundedRect(ctx, r * 0.12, -r * 0.17, r * 0.55, r * 0.24, r * 0.08)
    ctx.fill()
    line(ctx, r * 0.65, -r * 0.05, r * 0.82, -r * 0.05, r * 0.09, 'rgba(20,24,15,.9)')
  } else if (weapon === 'rpg') {
    ctx.fillStyle = 'rgba(28,32,18,.9)'
    ctx.fillRect(-r * 0.38, -r * 0.13, r * 0.95, r * 0.11)
    ctx.beginPath()
    ctx.moveTo(r * 0.55, -r * 0.24)
    ctx.lineTo(r * 0.86, -r * 0.075)
    ctx.lineTo(r * 0.55, r * 0.09)
    ctx.closePath()
    ctx.fillStyle = 'rgba(210,110,80,.95)'
    ctx.fill()
  } else {
    ctx.fillStyle = dark
    ctx.fillRect(r * 0.05, -r * 0.12, r * 0.72, r * 0.09)
    line(ctx, r * 0.38, -r * 0.12, r * 0.38, -r * 0.24, r * 0.06, dark)
    line(ctx, r * 0.58, -r * 0.12, r * 0.58, -r * 0.25, r * 0.06, dark)
  }
  // helmet / head
  ctx.fillStyle = body
  ctx.beginPath()
  if (helmet === 'vc') {
    ctx.ellipse(r * 0.17, 0, r * 0.26, r * 0.22, 0, 0, TAU)
  } else if (helmet === 'nva') {
    ctx.arc(r * 0.17, 0, r * 0.24, 0, TAU)
  } else {
    ctx.arc(r * 0.16, 0, r * 0.23, 0, TAU)
    ctx.strokeStyle = 'rgba(20,24,15,.6)'
    ctx.lineWidth = r * 0.07
    ctx.stroke()
  }
  ctx.fill()
  // shoulder / helmet rim detail
  ctx.strokeStyle = 'rgba(20,24,15,.35)'
  ctx.lineWidth = r * 0.06
  ctx.beginPath()
  ctx.arc(r * 0.16, 0, r * 0.16, 0.4, Math.PI - 0.4)
  ctx.stroke()
}

function tank(ctx, r, { amphibious = false } = {}) {
  const body = 'rgba(228,222,198,.95)'
  const dark = 'rgba(20,25,15,.9)'
  // tracks
  ctx.fillStyle = 'rgba(20,24,15,.75)'
  roundedRect(ctx, -r * 0.67, -r * 0.56, r * 1.34, r * 0.22, r * 0.06)
  ctx.fill()
  roundedRect(ctx, -r * 0.67, r * 0.34, r * 1.34, r * 0.22, r * 0.06)
  ctx.fill()
  // hull
  ctx.fillStyle = body
  if (amphibious) {
    ctx.beginPath()
    ctx.moveTo(-r * 0.62, -r * 0.36)
    ctx.lineTo(r * 0.42, -r * 0.4)
    ctx.quadraticCurveTo(r * 0.78, 0, r * 0.42, r * 0.4)
    ctx.lineTo(-r * 0.62, r * 0.36)
    ctx.closePath()
    ctx.fill()
  } else {
    roundedRect(ctx, -r * 0.58, -r * 0.37, r * 1.16, r * 0.74, r * 0.13)
    ctx.fill()
  }
  // turret
  ctx.fillStyle = 'rgba(206,200,174,.95)'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.34, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(20,24,15,.5)'
  ctx.lineWidth = r * 0.05
  ctx.stroke()
  // barrel
  ctx.fillStyle = dark
  ctx.fillRect(r * 0.18, -r * 0.075, r * 0.84, r * 0.15)
  ctx.fillRect(r * 0.96, -r * 0.11, r * 0.18, r * 0.22)
  // hatch + markings
  ctx.fillStyle = 'rgba(20,24,15,.55)'
  ctx.beginPath()
  ctx.arc(-r * 0.05, -r * 0.07, r * 0.13, 0, TAU)
  ctx.fill()
  line(ctx, -r * 0.4, 0, -r * 0.26, 0, r * 0.05, 'rgba(20,24,15,.3)')
}

function apc(ctx, r) {
  const body = 'rgba(228,222,198,.95)'
  const dark = 'rgba(20,25,15,.85)'
  ctx.fillStyle = 'rgba(20,24,15,.7)'
  roundedRect(ctx, -r * 0.7, -r * 0.55, r * 1.4, r * 0.2, r * 0.05)
  ctx.fill()
  roundedRect(ctx, -r * 0.7, r * 0.35, r * 1.4, r * 0.2, r * 0.05)
  ctx.fill()
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-r * 0.62, -r * 0.34)
  ctx.lineTo(r * 0.54, -r * 0.34)
  ctx.lineTo(r * 0.76, 0)
  ctx.lineTo(r * 0.54, r * 0.34)
  ctx.lineTo(-r * 0.62, r * 0.34)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(20,24,15,.45)'
  ctx.lineWidth = r * 0.04
  ctx.stroke()
  // cupola and .50
  ctx.fillStyle = 'rgba(206,200,174,.95)'
  ctx.beginPath()
  ctx.arc(r * 0.06, -r * 0.03, r * 0.22, 0, TAU)
  ctx.fill()
  ctx.fillStyle = dark
  ctx.fillRect(r * 0.18, -r * 0.11, r * 0.56, r * 0.1)
  line(ctx, r * 0.52, -r * 0.06, r * 0.72, -r * 0.18, r * 0.05, dark)
  // rear hatch
  line(ctx, -r * 0.43, -r * 0.2, -r * 0.43, r * 0.2, r * 0.06, 'rgba(20,24,15,.4)')
  line(ctx, -r * 0.28, -r * 0.2, -r * 0.28, r * 0.2, r * 0.04, 'rgba(20,24,15,.25)')
}

function bunker(ctx, r) {
  const dark = 'rgba(20,25,15,.85)'
  // sandbag ring
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    const x = Math.cos(a) * r * 0.67
    const y = Math.sin(a) * r * 0.67
    ctx.fillStyle = i % 2 ? 'rgba(157,143,103,.95)' : 'rgba(183,167,122,.95)'
    ctx.beginPath()
    ctx.ellipse(x, y, r * 0.17, r * 0.12, a, 0, TAU)
    ctx.fill()
  }
  // roof
  ctx.fillStyle = 'rgba(98,91,67,.98)'
  roundedRect(ctx, -r * 0.39, -r * 0.34, r * 0.78, r * 0.68, r * 0.08)
  ctx.fill()
  ctx.strokeStyle = 'rgba(20,25,15,.7)'
  ctx.lineWidth = r * 0.055
  ctx.stroke()
  // beams
  line(ctx, -r * 0.3, -r * 0.25, r * 0.3, -r * 0.25, r * 0.035, 'rgba(20,25,15,.35)')
  line(ctx, -r * 0.3, r * 0.25, r * 0.3, r * 0.25, r * 0.035, 'rgba(20,25,15,.35)')
  // firing slit
  ctx.fillStyle = dark
  ctx.fillRect(-r * 0.18, -r * 0.09, r * 0.38, r * 0.1)
  // M2 barrel
  ctx.fillStyle = 'rgba(20,24,15,.9)'
  ctx.fillRect(r * 0.15, -r * 0.05, r * 0.5, r * 0.07)
  // antenna
  line(ctx, -r * 0.25, -r * 0.25, -r * 0.38, -r * 0.82, r * 0.03, 'rgba(210,200,165,.75)')
  // pennant
  ctx.fillStyle = 'rgba(197,114,72,.95)'
  ctx.beginPath()
  ctx.moveTo(-r * 0.38, -r * 0.82)
  ctx.lineTo(-r * 0.12, -r * 0.72)
  ctx.lineTo(-r * 0.38, -r * 0.6)
  ctx.closePath()
  ctx.fill()
}

function mortar(ctx, r) {
  const dark = 'rgba(20,25,15,.85)'
  // baseplate
  ctx.fillStyle = 'rgba(170,158,118,.95)'
  ctx.beginPath()
  ctx.ellipse(0, r * 0.2, r * 0.34, r * 0.2, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = dark
  ctx.lineWidth = r * 0.05
  ctx.stroke()
  // tube
  ctx.save()
  ctx.rotate(-0.95)
  ctx.fillStyle = dark
  roundedRect(ctx, -r * 0.07, -r * 0.72, r * 0.14, r * 1.08, r * 0.06)
  ctx.fill()
  ctx.restore()
  // bipod
  line(ctx, r * 0.12, r * 0.12, r * 0.42, r * 0.4, r * 0.05, dark)
  line(ctx, r * 0.12, r * 0.12, r * 0.02, r * 0.46, r * 0.05, dark)
  // shell
  ctx.fillStyle = 'rgba(210,160,90,.95)'
  ctx.beginPath()
  ctx.arc(-r * 0.3, -r * 0.24, r * 0.09, 0, TAU)
  ctx.fill()
}

export function drawUnitIcon(ctx, unit, r) {
  const facing = Number.isFinite(unit.facing) ? unit.facing : 0
  ctx.save()
  ctx.rotate(facing)
  const pale = unit.side === 'us' ? 'rgba(235,232,212,.95)' : 'rgba(244,224,205,.95)'
  switch (unit.icon) {
    case 'tank':
      tank(ctx, r)
      break
    case 'pt76':
      tank(ctx, r, { amphibious: true })
      break
    case 'apc':
      apc(ctx, r)
      break
    case 'bunker':
      bunker(ctx, r)
      break
    case 'mortar':
      mortar(ctx, r)
      break
    case 'mg':
      soldier(ctx, r, { helmet: 'us', weapon: 'mg' })
      break
    case 'm79':
      soldier(ctx, r, { helmet: 'us', weapon: 'm79' })
      break
    case 'rpg':
      soldier(ctx, r, { helmet: 'nva', weapon: 'rpg' })
      break
    case 'vc':
      soldier(ctx, r, { helmet: 'vc', weapon: 'rifle' })
      break
    case 'nva':
      soldier(ctx, r, { helmet: 'nva', weapon: 'rifle' })
      break
    case 'command':
      soldier(ctx, r, { helmet: 'nva', weapon: 'rifle' })
      line(ctx, -r * 0.25, r * 0.1, -r * 0.4, -r * 0.85, r * 0.035, pale)
      ctx.fillStyle = 'rgba(220,120,90,.95)'
      ctx.beginPath()
      ctx.moveTo(-r * 0.4, -r * 0.85)
      ctx.lineTo(-r * 0.08, -r * 0.72)
      ctx.lineTo(-r * 0.4, -r * 0.58)
      ctx.closePath()
      ctx.fill()
      break
    default:
      soldier(ctx, r, { helmet: 'us', weapon: 'rifle' })
  }
  ctx.restore()
}

const portraitCache = new Map()

export function portraitDataURL(type, side = 'us', size = 64) {
  const cacheKey = `${type}:${side}:${size}`
  if (portraitCache.has(cacheKey)) return portraitCache.get(cacheKey)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.33
  const grad = ctx.createRadialGradient(cx, cy - 4, 1, cx, cy, size * 0.52)
  grad.addColorStop(0, side === 'us' ? 'rgba(95,122,72,.85)' : 'rgba(102,55,44,.85)')
  grad.addColorStop(1, 'rgba(10,14,9,.9)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.47, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = side === 'us' ? 'rgba(169,201,139,.8)' : 'rgba(220,116,94,.8)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  const fake = {
    side,
    icon: UNIT_TYPES_ICON(type),
    facing: 0
  }
  ctx.save()
  ctx.translate(cx, cy)
  drawUnitIcon(ctx, fake, r)
  ctx.restore()
  const url = canvas.toDataURL()
  portraitCache.set(cacheKey, url)
  return url
}

// Avoid importing the whole unit catalogue here; the icon id is all we need.
const ICONS = {
  alpha: 'rifle', bravo: 'mg', delta: 'm79', patton: 'tank', acav: 'apc',
  bunker: 'bunker', vc: 'vc', nva: 'nva', rpg: 'rpg', pt76: 'pt76',
  mortar: 'mortar', command: 'command'
}
function UNIT_TYPES_ICON(type) {
  return ICONS[type] || 'rifle'
}
