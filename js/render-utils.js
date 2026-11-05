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

// Deterministic hash so foliage, camo and details stay identical across reloads.
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
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
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

// ===========================================================================
// Realistic unit art.
//
// Every unit is painted procedurally in its sprite's local space (+x = front),
// then cached at 5x supersampling and blitted rotated. Shared shading rules:
//   - sun from the north-west (light edges NW, shadow crests SE)
//   - cloth and vehicles get camo blotches keyed off a deterministic hash
// ===========================================================================

const ART_SS = 5
const spriteCache = new Map()

// Shorthand helpers ----------------------------------------------------------

function fill(ctx, rgba) {
  ctx.fillStyle = rgba
}
function line(ctx, x1, y1, x2, y2, w, color, cap = 'round') {
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.lineCap = cap
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}
function capsule(ctx, x1, y1, x2, y2, w, color) {
  line(ctx, x1, y1, x2, y2, w, color)
}
function dot(ctx, x, y, rad, color) {
  fill(ctx, color)
  ctx.beginPath()
  ctx.arc(x, y, rad, 0, TAU)
  ctx.fill()
}
function seg(ctx, x1, y1, x2, y2, w, rgba) {
  line(ctx, x1, y1, x2, y2, w, rgba)
}

// Clip-bounded camouflage blotches within the calling shape.
function camo(ctx, clipFn, base, light, dark, seed = 3, count = 6, box = null) {
  ctx.save()
  ctx.beginPath()
  clipFn()
  ctx.clip()
  fill(ctx, base)
  ctx.fill()
  for (let i = 0; i < count; i++) {
    const cx = box ? box.x + h2(i, seed, 1) * box.w : (h2(i, seed, 2) - 0.5) * 2.2
    const cy = box ? box.y + h2(i, seed, 3) * box.h : (h2(i, seed, 4) - 0.5) * 2.2
    const rad = (0.1 + h2(i, seed, 5) * 0.16)
    fill(ctx, i % 2 ? dark : light)
    ctx.beginPath()
    ctx.ellipse(cx, cy, rad, rad * (0.62 + h2(i, seed, 6) * 0.5), h2(i, seed, 7) * TAU, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

// Fabric grain: sparse 1px specks for cloth and quilted webbing.
function grain(ctx, cx, cy, w, h, color, seed = 9, n = 10) {
  for (let i = 0; i < n; i++) {
    const gx = cx + (h2(i, seed, 8) - 0.5) * w
    const gy = cy + (h2(i, seed, 9) - 0.5) * h
    fill(ctx, i % 2 ? color : 'rgba(255,255,255,.05)')
    ctx.beginPath()
    ctx.arc(gx, gy, 0.55, 0, TAU)
    ctx.fill()
  }
}

// US 5-point white star decal (low-vis canvas white).
function starUS(ctx, x, y, r, alpha = 0.85) {
  ctx.save()
  fill(ctx, `rgba(238,238,228,${alpha})`)
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5
    const rr = i % 2 === 0 ? r : r * 0.4
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = `rgba(30,34,22,${alpha * 0.5})`
  ctx.lineWidth = 0.5
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------------------

const US_KIT = {
  cloth: 'rgba(107,114,71,.96)', clothLit: 'rgba(146,151,99,.9)',
  clothDark: 'rgba(70,76,46,.95)', web: 'rgba(196,182,142,.95)',
  skin: 'rgba(178,132,95,.97)', boot: 'rgba(45,39,31,.98)',
  helmetBase: 'rgba(96,102,62,.98)', helmetLit: 'rgba(136,142,96,.9)',
  helmetDark: 'rgba(58,64,38,.95)'
}
const NVA_KIT = {
  cloth: 'rgba(80,90,58,.97)', clothLit: 'rgba(116,126,82,.9)',
  clothDark: 'rgba(52,60,38,.95)', web: 'rgba(163,150,116,.95)',
  skin: 'rgba(158,116,80,.97)', boot: 'rgba(40,37,32,.98)',
  helmetBase: 'rgba(107,109,64,.98)', helmetLit: 'rgba(146,148,94,.9)',
  helmetDark: 'rgba(64,66,40,.95)'
}
const VC_KIT = {
  cloth: 'rgba(48,46,42,.98)', clothLit: 'rgba(74,71,64,.9)',
  clothDark: 'rgba(30,29,26,.95)', web: 'rgba(129,120,101,.9)',
  skin: 'rgba(158,116,80,.97)', boot: 'rgba(38,35,30,.98)',
  helmetBase: 'rgba(196,178,134,.96)', helmetLit: 'rgba(228,212,168,.9)',
  helmetDark: 'rgba(138,124,88,.95)'
}
const US_VEHICLE = {
  base: 'rgba(80,88,56,.98)', light: 'rgba(116,124,80,.92)', dark: 'rgba(54,60,38,.95)',
  track: 'rgba(26,29,21,.97)', trackLit: 'rgba(88,92,72,.9)', metal: 'rgba(36,40,28,.96)',
  metalLit: 'rgba(112,117,88,.85)'
}

function helmetUS(ctx, k, x, y, r) {
  fill(ctx, k.helmetBase)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  // camo band over the helmet
  fill(ctx, 'rgba(52,60,34,.9)')
  ctx.beginPath()
  ctx.arc(x, y, r, 0.35, 2.6)
  ctx.arc(x, y, r * 0.82, 2.6, 0.35, true)
  ctx.closePath()
  ctx.fill()
  // net knot dots
  for (let i = 0; i < 4; i++) dot(ctx, x + (h2(i, 6, 21) - 0.5) * r, y + (h2(i, 6, 22) - 0.5) * r, r * 0.13, 'rgba(66,74,40,.75)')
  // rim + NW highlight, SE shade
  ctx.strokeStyle = k.helmetDark
  ctx.lineWidth = r * 0.16
  ctx.beginPath()
  ctx.arc(x, y, r * 0.94, 0.55, 2.35)
  ctx.stroke()
  ctx.strokeStyle = k.helmetLit
  ctx.lineWidth = r * 0.12
  ctx.beginPath()
  ctx.arc(x - r * 0.1, y - r * 0.1, r * 0.72, 2.2, 4.1)
  ctx.stroke()
  // chin strap
  seg(ctx, x - r * 0.22, y - r * 0.5, x - r * 0.3, y + r * 0.42, r * 0.06, 'rgba(38,34,26,.85)')
}
function helmetNVA(ctx, k, x, y, r) {
  // NVA sun/pith helmet: wide brim
  fill(ctx, k.helmetBase)
  ctx.beginPath()
  ctx.ellipse(x, y, r * 1.14, r * 0.92, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = k.helmetDark
  ctx.lineWidth = r * 0.12
  ctx.beginPath()
  ctx.arc(x + r * 0.08, y + r * 0.08, r * 0.88, 0.5, 2.3)
  ctx.stroke()
  fill(ctx, k.helmetLit)
  ctx.beginPath()
  ctx.ellipse(x - r * 0.14, y - r * 0.14, r * 0.5, r * 0.4, 0, 0, TAU)
  ctx.fill()
  dot(ctx, x, y, r * 0.2, k.helmetDark)
  ctx.strokeStyle = 'rgba(130,32,26,.9)' // red star flash
  ctx.lineWidth = r * 0.1
  ctx.beginPath()
  ctx.arc(x, y, r * 0.42, 0, TAU)
  ctx.stroke()
}
function helmetVC(ctx, k, x, y, r) {
  // rice / conical hat seen from above: wide bright disc with peak
  fill(ctx, k.helmetBase)
  ctx.beginPath()
  ctx.ellipse(x, y, r * 1.3, r * 1.16, 0, 0, TAU)
  ctx.fill()
  fill(ctx, k.helmetLit)
  ctx.beginPath()
  ctx.ellipse(x - r * 0.2, y - r * 0.2, r * 0.72, r * 0.6, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = k.helmetDark
  ctx.lineWidth = r * 0.09
  for (let i = 0; i < 5; i++) line(ctx, x, y, x + Math.cos(i * TAU / 5 + 0.4) * r * 1.28, y + Math.sin(i * TAU / 5 + 0.4) * r * 1.16, r * 0.07, 'rgba(120,106,76,.7)')
  dot(ctx, x, y, r * 0.16, k.helmetDark)
}

// infantry body shared by every soldier icon. headPath: 'us' | 'nva' | 'vc'
function soldier(ctx, r, kit, toolkit) {
  // ---- legs (drawn first, tucked under torso) ----
  for (const s of [-1, 1]) {
    capsule(ctx, -r * 0.1, s * r * 0.13, -r * 0.45, s * r * 0.2, r * 0.13, kit.clothDark)
    dot(ctx, -r * 0.52, s * r * 0.22, r * 0.11, kit.boot)
    // subtle top-light on thigh
    capsule(ctx, -r * 0.1, s * r * 0.16, -r * 0.4, s * r * 0.21, r * 0.05, kit.cloth)
  }
  // ---- pack behind torso ----
  fill(ctx, kit.clothDark)
  roundedRect(ctx, -r * 0.5, -r * 0.16, r * 0.2, r * 0.32, r * 0.06)
  ctx.fill()
  seg(ctx, -r * 0.42, -r * 0.12, -r * 0.42, r * 0.12, r * 0.04, 'rgba(30,28,22,.8)')
  // pack roll
  capsule(ctx, -r * 0.44, -r * 0.2, -r * 0.36, r * 0.2, r * 0.07, 'rgba(154,146,112,.9)')
  // ---- torso ----
  const torso = () => {
    roundedRect(ctx, -r * 0.3, -r * 0.27, r * 0.62, r * 0.54, r * 0.24)
    ctx.closePath()
  }
  camo(ctx, torso, kit.cloth, kit.clothLit, kit.clothDark, 5, 4)
  // webbing straps
  seg(ctx, -r * 0.02, -r * 0.26, -r * 0.02, r * 0.26, r * 0.07, kit.web)
  seg(ctx, -r * 0.16, -r * 0.26, -r * 0.16, r * 0.26, r * 0.07, shirtDark(kit))
  // belt pouches
  fill(ctx, kit.web)
  roundedRect(ctx, -r * 0.06, -r * 0.3, r * 0.1, r * 0.12, r * 0.03)
  ctx.fill()
  roundedRect(ctx, -r * 0.06, r * 0.18, r * 0.1, r * 0.12, r * 0.03)
  ctx.fill()
  grain(ctx, 0, 0, r * 0.8, r * 0.6, 'rgba(0,0,0,.3)', 4, 7)
  // ---- head ----
  const hx = r * 0.28
  if (toolkit.head === 'us') helmetUS(ctx, kit, hx, 0, r * 0.23)
  else if (toolkit.head === 'nva') helmetNVA(ctx, kit, hx, 0, r * 0.21)
  else helmetVC(ctx, kit, hx, 0, r * 0.19)
  return { hx }
}
function shirtDark(kit) {
  return kit === VC_KIT ? 'rgba(24,23,20,.9)' : 'rgba(40,44,28,.9)'
}

function weapons(ctx, r, kit, kind) {
  const dk = 'rgba(26,29,22,.98)'
  const metal = 'rgba(58,62,46,.98)'
  const wood = 'rgba(122,76,46,.98)'
  const woodLit = 'rgba(158,104,62,.95)'
  if (kind === 'rifle') {
    // M16A1: receiver + triangular handguard + barrel + carry handle + angled mag
    capsule(ctx, -r * 0.18, -r * 0.34, r * 0.6, -r * 0.34, r * 0.08, dk)
    capsule(ctx, r * 0.25, -r * 0.4, r * 0.34, -r * 0.4, r * 0.12, wood) // handguard highlight
    capsule(ctx, r * 0.52, -r * 0.36, r * 0.72, -r * 0.36, r * 0.055, metal) // barrel + flash hider
    seg(ctx, r * 0.05, -r * 0.42, r * 0.3, -r * 0.36, r * 0.05, metal) // carry handle
    // magazine (20-round, slightly angled)
    ctx.save()
    fill(ctx, metal)
    ctx.translate(r * 0.06, -r * 0.3)
    ctx.rotate(0.5)
    roundedRect(ctx, 0, 0, r * 0.08, r * 0.2, r * 0.02)
    ctx.fill()
    ctx.restore()
    // hands: forward grip + seasoning trigger hand
    dot(ctx, -r * 0.14, -r * 0.22, r * 0.075, kit.skin)
    dot(ctx, r * 0.3, -r * 0.3, r * 0.07, kit.skin)
    // sling
    ctx.strokeStyle = 'rgba(58,55,42,.85)'
    ctx.lineWidth = r * 0.028
    ctx.beginPath()
    ctx.moveTo(-r * 0.16, -r * 0.3)
    ctx.quadraticCurveTo(-r * 0.02, -r * 0.08, -r * 0.2, r * 0.22)
    ctx.stroke()
  } else if (kind === 'mg') {
    // M60: long barrel, bipod, belt, feed box on pack
    capsule(ctx, -r * 0.2, -r * 0.36, r * 0.56, -r * 0.36, r * 0.1, dk)
    capsule(ctx, r * 0.5, -r * 0.36, r * 0.98, -r * 0.36, r * 0.07, metal)
    dot(ctx, r * 1.0, -r * 0.36, r * 0.05, 'rgba(212,222,196,.95)') // muzzle
    seg(ctx, -r * 0.08, -r * 0.42, -r * 0.08, -r * 0.24, r * 0.05, metal)
    // bipod legs
    line(ctx, r * 0.62, -r * 0.32, r * 0.78, -r * 0.06, r * 0.05, metal)
    line(ctx, r * 0.62, -r * 0.4, r * 0.72, -r * 0.64, r * 0.05, metal)
    // belt strip + linked rounds
    for (let i = 0; i < 5; i++) dot(ctx, -r * 0.26 - i * r * 0.07, -r * 0.18 + i * r * 0.03, r * 0.035, i % 2 ? 'rgba(206,182,110,.95)' : 'rgba(120,104,64,.95)')
    fill(ctx, 'rgba(88,84,62,.96)') // assistant's feed bag
    roundedRect(ctx, -r * 0.52, r * 0.06, r * 0.16, r * 0.2, r * 0.05)
    ctx.fill()
    dot(ctx, -r * 0.1, -r * 0.24, r * 0.075, kit.skin)
    dot(ctx, r * 0.42, -r * 0.3, r * 0.07, kit.skin)
  } else if (kind === 'm79') {
    // M79: stubby break-action
    capsule(ctx, -r * 0.12, -r * 0.36, r * 0.5, -r * 0.36, r * 0.12, dk)
    capsule(ctx, r * 0.44, -r * 0.36, r * 0.56, -r * 0.36, r * 0.09, metal)
    capsule(ctx, -r * 0.1, -r * 0.42, -r * 0.02, -r * 0.36, r * 0.07, woodLit)
    // 40mm shell bandolier across torso
    for (let i = 0; i < 4; i++) dot(ctx, -r * 0.2 + i * r * 0.13, r * 0.05 - i * r * 0.02, r * 0.055, i % 2 ? 'rgba(74,62,40,.95)' : 'rgba(206,182,110,.95)')
    dot(ctx, -r * 0.02, -r * 0.26, r * 0.08, kit.skin)
    dot(ctx, r * 0.4, -r * 0.3, r * 0.07, kit.skin)
  } else if (kind === 'rpg') {
    // RPG-2 tube over the shoulder + conical warhead
    capsule(ctx, -r * 0.24, -r * 0.38, r * 0.52, -r * 0.38, r * 0.11, 'rgba(46,44,36,.98)')
    ctx.fillStyle = 'rgba(210,110,80,.95)'
    ctx.beginPath()
    ctx.moveTo(r * 0.5, -r * 0.52)
    ctx.lineTo(r * 0.92, -r * 0.38)
    ctx.lineTo(r * 0.5, -r * 0.24)
    ctx.closePath()
    ctx.fill()
    seg(ctx, r * 0.62, -r * 0.44, r * 0.62, -r * 0.32, r * 0.04, 'rgba(150,74,56,.9)')
    // rear wooden venturi
    capsule(ctx, -r * 0.3, -r * 0.38, -r * 0.24, -r * 0.38, r * 0.09, wood)
    dot(ctx, -r * 0.02, -r * 0.26, r * 0.075, kit.skin)
    dot(ctx, r * 0.3, -r * 0.32, r * 0.07, kit.skin)
    // spare rockets in the pack
    for (let i = 0; i < 2; i++) capsule(ctx, -r * 0.5, r * (0.24 + i * 0.08), -r * 0.66, r * (0.28 + i * 0.08), r * 0.055, i ? 'rgba(96,60,44,.95)' : 'rgba(58,56,46,.95)')
  } else if (kind === 'ak') {
    // AK-47 with wooden furniture and banana magazine
    capsule(ctx, -r * 0.2, -r * 0.34, r * 0.44, -r * 0.34, r * 0.08, dk)
    capsule(ctx, r * 0.1, -r * 0.4, r * 0.26, -r * 0.4, r * 0.1, wood)
    capsule(ctx, r * 0.4, -r * 0.36, r * 0.66, -r * 0.34, r * 0.05, metal)
    capsule(ctx, -r * 0.28, -r * 0.38, -r * 0.12, -r * 0.34, r * 0.07, wood) // stock
    ctx.save()
    fill(ctx, 'rgba(94,58,36,.98)')
    ctx.translate(r * 0.0, -r * 0.32)
    ctx.rotate(0.65)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(r * 0.05, r * 0.2, r * -0.04, r * 0.3)
    ctx.lineTo(r * -0.12, r * 0.26)
    ctx.quadraticCurveTo(r * -0.06, r * 0.16, r * -0.08, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    dot(ctx, -r * 0.08, -r * 0.22, r * 0.075, kit.skin)
    dot(ctx, r * 0.2, -r * 0.3, r * 0.07, kit.skin)
  } else if (kind === 'radio') {
    capsule(ctx, -r * 0.2, -r * 0.34, r * 0.44, -r * 0.34, r * 0.08, dk)
    capsule(ctx, r * 0.1, -r * 0.4, r * 0.26, -r * 0.4, r * 0.1, wood)
    capsule(ctx, r * 0.4, -r * 0.36, r * 0.66, -r * 0.34, r * 0.05, metal)
    dot(ctx, -r * 0.06, -r * 0.22, r * 0.075, kit.skin)
    dot(ctx, r * 0.18, -r * 0.3, r * 0.07, kit.skin)
  }
}

function trackRun(ctx, x1, x2, y, r) {
  fill(ctx, US_VEHICLE.track)
  roundedRect(ctx, x1, y - r * 0.1, x2 - x1, r * 0.2, r * 0.06)
  ctx.fill()
  // individual links catching light
  const n = 9
  for (let i = 0; i < n; i++) {
    const lx = x1 + (i + 0.5) * (x2 - x1) / n
    seg(ctx, lx - r * 0.035, y - r * 0.075, lx - r * 0.035, y + r * 0.075, r * 0.045, US_VEHICLE.trackLit)
  }
}

function whiteStar(ctx, x, y, s) {
  starUS(ctx, x, y, s, 0.8)
}

// ---------------------------------------------------------------------------
// Vehicle + structure art
// ---------------------------------------------------------------------------

function tank(ctx, r) {
  const V = US_VEHICLE
  // desert dust kicked up under the hull
  fill(ctx, 'rgba(120,110,84,.25)')
  ctx.beginPath()
  ctx.ellipse(-r * 0.2, 0, r * 0.9, r * 0.72, 0, 0, TAU)
  ctx.fill()
  trackRun(ctx, -r * 0.66, r * 0.66, -r * 0.46, r)
  trackRun(ctx, -r * 0.66, r * 0.66, r * 0.46, r)
  // hull
  const hull = () => {
    ctx.moveTo(-r * 0.62, -r * 0.4)
    ctx.lineTo(r * 0.34, -r * 0.42)
    ctx.quadraticCurveTo(r * 0.62, -r * 0.3, r * 0.78, 0)
    ctx.quadraticCurveTo(r * 0.62, r * 0.3, r * 0.34, r * 0.42)
    ctx.lineTo(-r * 0.62, r * 0.4)
    ctx.quadraticCurveTo(-r * 0.74, 0, -r * 0.62, -r * 0.4)
  }
  camo(ctx, hull, V.base, V.light, V.dark, 7, 7)
  // glacis highlight and rear shadow
  seg(ctx, r * 0.2, -r * 0.34, r * 0.6, -r * 0.1, r * 0.05, V.light)
  seg(ctx, -r * 0.56, -r * 0.34, -r * 0.6, r * 0.34, r * 0.05, V.dark)
  // engine deck grilles
  seg(ctx, -r * 0.5, -r * 0.24, -r * 0.36, -r * 0.24, r * 0.05, 'rgba(34,38,26,.9)')
  seg(ctx, -r * 0.5, 0, -r * 0.36, 0, r * 0.05, 'rgba(34,38,26,.9)')
  seg(ctx, -r * 0.5, r * 0.24, -r * 0.36, r * 0.24, r * 0.05, 'rgba(34,38,26,.9)')
  whiteStar(ctx, -r * 0.2, 0, r * 0.12)
  // headlamps and tow hooks
  dot(ctx, r * 0.6, -r * 0.2, r * 0.055, 'rgba(236,226,190,.95)')
  dot(ctx, r * 0.6, r * 0.2, r * 0.055, 'rgba(236,226,190,.95)')
  // exhaust stain
  fill(ctx, 'rgba(30,28,22,.5)')
  ctx.beginPath()
  ctx.ellipse(-r * 0.72, r * 0.3, r * 0.08, r * 0.2, -0.3, 0, TAU)
  ctx.fill()
  // turret
  const tur = () => {
    roundedRect(ctx, -r * 0.3, -r * 0.27, r * 0.6, r * 0.54, r * 0.24)
    ctx.closePath()
  }
  camo(ctx, tur, V.base, V.light, V.dark, 9, 4)
  ctx.strokeStyle = 'rgba(26,30,20,.7)'
  ctx.lineWidth = r * 0.035
  ctx.stroke()
  // commander cupola + hatch
  dot(ctx, -r * 0.12, 0, r * 0.12, 'rgba(70,74,52,.98)')
  ctx.strokeStyle = 'rgba(150,156,118,.7)'
  ctx.lineWidth = r * 0.03
  ctx.beginPath()
  ctx.arc(-r * 0.12, 0, r * 0.08, 0, TAU)
  ctx.stroke()
  // smoke dischargers
  dot(ctx, r * 0.02, -r * 0.3, r * 0.035, V.metal)
  dot(ctx, r * 0.09, -r * 0.31, r * 0.035, V.metal)
  dot(ctx, r * 0.02, r * 0.3, r * 0.035, V.metal)
  dot(ctx, r * 0.09, r * 0.31, r * 0.035, V.metal)
  // 90mm gun: mantlet, bore evacuator, muzzle
  seg(ctx, r * 0.26, 0, r * 0.98, 0, r * 0.15, V.metal)
  seg(ctx, r * 0.44, 0, r * 0.44, 0, r * 0.19, V.metal) // evacuator
  seg(ctx, r * 0.62, 0, r * 0.62, 0, r * 0.15, 'rgba(70,76,54,.95)')
  dot(ctx, r * 1.02, 0, r * 0.09, 'rgba(20,22,16,.98)')
  fill(ctx, 'rgba(130,136,102,.5)') // sun on barrel
  ctx.beginPath()
  ctx.arc(r * 0.6, -r * 0.055, r * 0.045, 0, TAU)
  ctx.fill()
  // radio antenna
  line(ctx, -r * 0.24, -r * 0.22, -r * 0.5, -r * 0.78, r * 0.028, 'rgba(208,204,168,.7)')
}

function pt76(ctx, r) {
  const base = 'rgba(84,90,58,.98)'
  const light = 'rgba(120,126,82,.9)'
  const dark = 'rgba(52,58,36,.95)'
  fill(ctx, 'rgba(96,60,42,.28)') // wake hint
  ctx.beginPath()
  ctx.ellipse(-r * 0.3, 0, r * 0.95, r * 0.8, 0, 0, TAU)
  ctx.fill()
  // rounded amphibious hull
  const hull = () => {
    ctx.moveTo(-r * 0.7, -r * 0.42)
    ctx.quadraticCurveTo(-r * 0.82, 0, -r * 0.7, r * 0.42)
    ctx.lineTo(r * 0.34, r * 0.46)
    ctx.quadraticCurveTo(r * 0.74, r * 0.3, r * 0.88, 0)
    ctx.quadraticCurveTo(r * 0.74, -r * 0.3, r * 0.34, -r * 0.46)
    ctx.lineTo(-r * 0.7, -r * 0.42)
  }
  camo(ctx, hull, base, light, dark, 11, 6)
  seg(ctx, r * 0.2, -r * 0.38, r * 0.6, -r * 0.12, r * 0.045, light)
  // bow wave deflector
  seg(ctx, r * 0.34, -r * 0.45, r * 0.34, r * 0.45, r * 0.04, 'rgba(30,34,22,.85)')
  // turret
  dot(ctx, -r * 0.04, 0, r * 0.33, 'rgba(72,78,50,.98)')
  fill(ctx, light)
  ctx.beginPath()
  ctx.ellipse(-r * 0.16, -r * 0.12, r * 0.14, r * 0.1, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = dark
  ctx.lineWidth = r * 0.035
  ctx.stroke()
  // D-56T gun
  seg(ctx, r * 0.2, 0, r * 1.0, 0, r * 0.1, 'rgba(36,40,28,.98)')
  seg(ctx, r * 0.64, 0, r * 0.64, 0, r * 0.13, 'rgba(48,52,36,.95)')
  dot(ctx, r * 1.06, 0, r * 0.06, 'rgba(20,22,16,.98)')
  // red star + antennas
  dot(ctx, -r * 0.32, 0, r * 0.075, 'rgba(178,52,40,.95)')
  line(ctx, -r * 0.3, -r * 0.36, -r * 0.6, -r * 0.84, r * 0.028, 'rgba(208,204,168,.65)')
  line(ctx, r * 0.1, -r * 0.4, r * 0.24, -r * 0.86, r * 0.028, 'rgba(208,204,168,.65)')
}

function apc(ctx, r) {
  const V = US_VEHICLE
  trackRun(ctx, -r * 0.72, r * 0.72, -r * 0.48, r)
  trackRun(ctx, -r * 0.72, r * 0.72, r * 0.48, r)
  const hull = () => {
    ctx.moveTo(-r * 0.7, -r * 0.36)
    ctx.lineTo(r * 0.4, -r * 0.36)
    ctx.lineTo(r * 0.78, 0)
    ctx.lineTo(r * 0.4, r * 0.36)
    ctx.lineTo(-r * 0.7, r * 0.36)
    ctx.quadraticCurveTo(-r * 0.8, 0, -r * 0.7, -r * 0.36)
  }
  camo(ctx, hull, V.base, V.light, V.dark, 13, 6)
  // water-cooled nose highlight
  seg(ctx, r * 0.16, -r * 0.32, r * 0.6, -r * 0.06, r * 0.045, V.light)
  // rear ramp + hatch seams
  seg(ctx, -r * 0.5, -r * 0.32, -r * 0.5, r * 0.32, r * 0.045, 'rgba(30,34,24,.9)')
  seg(ctx, -r * 0.32, -r * 0.34, -r * 0.32, r * 0.34, r * 0.03, 'rgba(30,34,24,.75)')
  seg(ctx, -r * 0.46, 0, -r * 0.2, 0, r * 0.03, 'rgba(120,126,88,.7)')
  whiteStar(ctx, -r * 0.12, 0, r * 0.1)
  // side stowage / fuel pouches
  fill(ctx, V.dark)
  roundedRect(ctx, -r * 0.16, -r * 0.46, r * 0.34, r * 0.09, r * 0.03)
  ctx.fill()
  roundedRect(ctx, -r * 0.16, r * 0.37, r * 0.34, r * 0.09, r * 0.03)
  ctx.fill()
  // cupola with M2
  dot(ctx, r * 0.14, -r * 0.02, r * 0.2, 'rgba(72,78,52,.97)')
  ctx.strokeStyle = V.metalLit
  ctx.lineWidth = r * 0.035
  ctx.beginPath()
  ctx.arc(r * 0.14, -r * 0.02, r * 0.15, 0, TAU)
  ctx.stroke()
  seg(ctx, r * 0.3, -r * 0.02, r * 0.78, -r * 0.02, r * 0.09, V.metal)
  seg(ctx, r * 0.62, -r * 0.02, r * 0.62, -r * 0.02, r * 0.13, V.metal) // barrel bushing
  fill(ctx, 'rgba(28,32,22,.98)') // M2 shield
  roundedRect(ctx, r * 0.3, -r * 0.16, r * 0.08, r * 0.26, r * 0.02)
  ctx.fill()
  dot(ctx, r * 0.82, -r * 0.02, r * 0.05, 'rgba(30,32,24,.98)')
  dot(ctx, r * 0.46, -r * 0.1, r * 0.035, 'rgba(236,226,190,.85)') // hatch light
  // twin antennas
  line(ctx, -r * 0.52, -r * 0.3, -r * 0.84, -r * 0.78, r * 0.028, 'rgba(208,204,168,.7)')
  line(ctx, -r * 0.52, r * 0.3, -r * 0.8, r * 0.8, r * 0.028, 'rgba(208,204,168,.7)')
}

function bunker(ctx, r) {
  // dirt pad and firebreak ring
  fill(ctx, 'rgba(104,94,70,.9)')
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.86, 0, TAU)
  ctx.fill()
  fill(ctx, 'rgba(70,62,44,.55)')
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.62, 0, TAU)
  ctx.fill()
  // sandbag courses, staggered
  const courses = [
    { rad: r * 0.76, n: 15, tone: 'rgba(183,167,122,.98)' },
    { rad: r * 0.6, n: 12, tone: 'rgba(157,143,103,.98)' }
  ]
  for (const { rad, n, tone } of courses) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (rad === r * 0.6 ? TAU / (n * 2) : 0)
      const x = Math.cos(a) * rad
      const y = Math.sin(a) * rad
      fill(ctx, 'rgba(20,18,12,.55)')
      ctx.beginPath()
      ctx.ellipse(x + 0.8, y + 1.1, r * 0.13, r * 0.1, a, 0, TAU)
      ctx.fill()
      fill(ctx, tone)
      ctx.beginPath()
      ctx.ellipse(x, y, r * 0.13, r * 0.1, a, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(232,220,180,.28)' // NW highlight per bag
      ctx.beginPath()
      ctx.ellipse(x - rad * 0.05, y - rad * 0.05, r * 0.08, r * 0.055, a, 0, TAU)
      ctx.fill()
    }
  }
  // sand floor crest
  fill(ctx, 'rgba(112,102,76,.92)')
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.42, 0, TAU)
  ctx.fill()
  // bunker block (corrugated tin roof)
  const block = () => {
    roundedRect(ctx, -r * 0.28, -r * 0.24, r * 0.62, r * 0.48, r * 0.07)
    ctx.closePath()
  }
  camo(ctx, block, 'rgba(96,90,64,.98)', 'rgba(126,120,88,.9)', 'rgba(64,58,42,.92)', 15, 3)
  for (let i = 0; i <= 5; i++) {
    const fx = -r * 0.26 + i * r * 0.11
    seg(ctx, fx, -r * 0.22, fx, r * 0.22, r * 0.022, 'rgba(28,26,20,.5)')
  }
  ctx.strokeStyle = 'rgba(22,20,14,.8)'
  ctx.lineWidth = r * 0.045
  ctx.stroke()
  // firing slit + M2
  fill(ctx, 'rgba(16,14,10,.98)')
  roundedRect(ctx, r * 0.05, -r * 0.07, r * 0.28, r * 0.14, r * 0.04)
  ctx.fill()
  seg(ctx, r * 0.2, 0, r * 0.52, 0, r * 0.055, 'rgba(30,32,24,.98)')
  dot(ctx, r * 0.55, 0, r * 0.045, 'rgba(212,222,196,.9)')
  // ammo crates and phosphor canisters
  fill(ctx, 'rgba(76,74,54,.97)')
  roundedRect(ctx, -r * 0.18, r * 0.3, r * 0.14, r * 0.1, r * 0.02)
  ctx.fill()
  seg(ctx, -r * 0.18, r * 0.35, -r * 0.04, r * 0.35, r * 0.016, 'rgba(150,144,112,.8)')
  fill(ctx, 'rgba(76,74,54,.97)')
  roundedRect(ctx, -r * 0.18, -r * 0.4, r * 0.14, r * 0.1, r * 0.02)
  ctx.fill()
  // radio antenna + pennant
  line(ctx, -r * 0.3, -r * 0.3, -r * 0.52, -r * 0.9, r * 0.03, 'rgba(210,200,165,.8)')
  fill(ctx, 'rgba(197,114,72,.95)')
  ctx.beginPath()
  ctx.moveTo(-r * 0.52, -r * 0.9)
  ctx.lineTo(-r * 0.2, -r * 0.78)
  ctx.lineTo(-r * 0.52, -r * 0.64)
  ctx.closePath()
  ctx.fill()
}

function mortar(ctx, r) {
  // pinned crew kneeling behind the tube
  const kit = NVA_KIT
  // baseplate
  fill(ctx, 'rgba(150,148,110,.42)')
  ctx.beginPath()
  ctx.ellipse(-r * 0.1, r * 0.34, r * 0.42, r * 0.26, -0.2, 0, TAU)
  ctx.fill()
  fill(ctx, 'rgba(128,124,92,.98)')
  ctx.beginPath()
  ctx.ellipse(-r * 0.1, r * 0.34, r * 0.34, r * 0.2, -0.2, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(40,40,28,.9)'
  ctx.lineWidth = r * 0.04
  ctx.stroke()
  // baseplate socket
  dot(ctx, -r * 0.06, r * 0.3, r * 0.1, 'rgba(58,56,42,.98)')
  // 82mm tube (angled NW)
  ctx.save()
  ctx.rotate(-0.95)
  fill(ctx, 'rgba(44,46,34,.98)')
  roundedRect(ctx, -r * 0.07, -r * 0.78, r * 0.14, r * 1.2, r * 0.06)
  ctx.fill()
  fill(ctx, 'rgba(94,96,72,.8)') // sun stripe
  roundedRect(ctx, -r * 0.07, -r * 0.78, r * 0.05, r * 1.2, r * 0.06)
  ctx.fill()
  dot(ctx, 0, r * 0.42, r * 0.09, 'rgba(30,32,24,.98)') // breech cap
  ctx.restore()
  // bipod legs
  line(ctx, r * 0.1, r * 0.2, r * 0.44, r * 0.44, r * 0.045, 'rgba(40,42,30,.98)')
  line(ctx, r * 0.1, r * 0.2, r * 0.02, r * 0.5, r * 0.045, 'rgba(40,42,30,.98)')
  // prepared shells fanned at the ready
  for (let i = 0; i < 3; i++) {
    const a = 2.2 + i * 0.4
    dot(ctx, Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66, r * 0.08, i % 2 ? 'rgba(196,150,88,.98)' : 'rgba(56,54,40,.98)')
  }
  // ammo crate
  fill(ctx, 'rgba(88,84,60,.97)')
  roundedRect(ctx, -r * 0.62, -r * 0.5, r * 0.2, r * 0.14, r * 0.02)
  ctx.fill()
  // gunner kneeling behind the tube
  fill(ctx, kit.cloth)
  roundedRect(ctx, r * 0.14, r * 0.02, r * 0.26, r * 0.2, r * 0.08)
  ctx.fill()
  helmetNVA(ctx, kit, r * 0.34, r * 0.06, r * 0.15)
}

// ---------------------------------------------------------------------------
// Icon dispatch + sprite cache
// ---------------------------------------------------------------------------

function drawUnitArt(ctx, icon, r) {
  switch (icon) {
    case 'tank': tank(ctx, r); break
    case 'pt76': pt76(ctx, r); break
    case 'apc': apc(ctx, r); break
    case 'bunker': bunker(ctx, r); break
    case 'mortar': mortar(ctx, r); break
    case 'mg': soldier(ctx, r, US_KIT, { head: 'us' }); weapons(ctx, r, US_KIT, 'mg'); break
    case 'm79': soldier(ctx, r, US_KIT, { head: 'us' }); weapons(ctx, r, US_KIT, 'm79'); break
    case 'rpg': soldier(ctx, r, NVA_KIT, { head: 'nva' }); weapons(ctx, r, NVA_KIT, 'rpg'); break
    case 'rifle': soldier(ctx, r, US_KIT, { head: 'us' }); weapons(ctx, r, US_KIT, 'rifle'); break
    case 'vc': soldier(ctx, r, VC_KIT, { head: 'vc' }); weapons(ctx, r, VC_KIT, 'ak'); break
    case 'nva': soldier(ctx, r, NVA_KIT, { head: 'nva' }); weapons(ctx, r, NVA_KIT, 'ak'); break
    case 'command': soldier(ctx, r, NVA_KIT, { head: 'nva' }); weapons(ctx, r, NVA_KIT, 'radio')
      line(ctx, -r * 0.3, r * 0.12, -r * 0.44, -r * 0.86, r * 0.03, 'rgba(220,214,180,.8)')
      fill(ctx, 'rgba(220,120,90,.95)')
      ctx.beginPath()
      ctx.moveTo(-r * 0.44, -r * 0.86)
      ctx.lineTo(-r * 0.12, -r * 0.74)
      ctx.lineTo(-r * 0.44, -r * 0.6)
      ctx.closePath()
      ctx.fill()
      break
    default: soldier(ctx, r, US_KIT, { head: 'us' }); weapons(ctx, r, US_KIT, 'rifle')
  }
}

export function getUnitSprite(icon, r) {
  const key = `${icon}|${Math.round(r * 2) / 2}`
  if (spriteCache.has(key)) return spriteCache.get(key)
  const half = r * 1.65
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.ceil(half * 2 * ART_SS)
  const sctx = canvas.getContext('2d')
  sctx.scale(ART_SS, ART_SS)
  sctx.translate(half, half)
  // local drop shadow baked under the art for grounded look
  sctx.save()
  sctx.translate(r * 0.08, r * 0.11)
  sctx.fillStyle = 'rgba(6,8,5,.45)'
  roundedRect(sctx, -r * 1.05, -r * 1.05, r * 2.1, r * 2.1, r)
  sctx.fill()
  sctx.restore()
  drawUnitArt(sctx, icon, r)
  const sprite = { canvas, half }
  spriteCache.set(key, sprite)
  return sprite
}

export function drawUnitIcon(ctx, unit, r) {
  const sprite = getUnitSprite(unit.icon, r)
  ctx.save()
  if (Number.isFinite(unit.facing)) ctx.rotate(unit.facing)
  ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half, sprite.half * 2, sprite.half * 2)
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Portraits — richer framed vignettes for the roster UI.
// ---------------------------------------------------------------------------

const portraitCache = new Map()

const PORTRAIT_ICONS = {
  alpha: 'rifle', bravo: 'mg', delta: 'm79', patton: 'tank', acav: 'apc',
  bunker: 'bunker', vc: 'vc', nva: 'nva', rpg: 'rpg', pt76: 'pt76',
  mortar: 'mortar', command: 'command'
}

export function portraitDataURL(type, side = 'us', size = 96) {
  const cacheKey = `${type}:${side}:${size}`
  if (portraitCache.has(cacheKey)) return portraitCache.get(cacheKey)
  const icon = PORTRAIT_ICONS[type] || 'rifle'
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  // jungle-vignette backdrop (warm earth for NVA side)
  const grad = ctx.createLinearGradient(0, size, size, 0)
  if (side === 'us') {
    grad.addColorStop(0, '#20291a')
    grad.addColorStop(1, '#42502f')
  } else {
    grad.addColorStop(0, '#241612')
    grad.addColorStop(1, '#56362a')
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  // ground clutter: a few grass strokes keyed off the hash
  for (let i = 0; i < 9; i++) {
    const gx = h2(i, type.length + 2, 3) * size
    const gy = size * (0.2 + h2(i, 3, 4) * 0.75)
    ctx.strokeStyle = side === 'us' ? 'rgba(126,140,88,.4)' : 'rgba(150,100,70,.4)'
    ctx.lineWidth = 1
    line(ctx, gx, gy, gx + (h2(i, 5, 6) - 0.5) * 6, gy - 4, 1, ctx.strokeStyle)
  }
  // radial spotlight
  const spot = ctx.createRadialGradient(cx, size * 0.42, size * 0.1, cx, size * 0.5, size * 0.55)
  spot.addColorStop(0, 'rgba(236,226,186,.16)')
  spot.addColorStop(1, 'rgba(0,0,0,.4)')
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, size, size)
  // the unit art itself, generous framing
  ctx.save()
  ctx.translate(cx, size * 0.52)
  drawUnitIcon(ctx, { icon, facing: 0 }, size * 0.27)
  ctx.restore()
  // frame
  ctx.strokeStyle = side === 'us' ? 'rgba(178,206,148,.75)' : 'rgba(221,118,94,.75)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, size - 2, size - 2)
  ctx.strokeStyle = 'rgba(12,16,10,.9)'
  ctx.lineWidth = 1
  ctx.strokeRect(3.5, 3.5, size - 7, size - 7)
  const url = canvas.toDataURL()
  portraitCache.set(cacheKey, url)
  return url
}
