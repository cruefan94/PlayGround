import {
  COLS, ROWS, HEX_SIZE, HEX_W, BOARD_PAD, BOARD_W, BOARD_H, TERRAIN,
  terrainAt, terrainKeyAt, isRoad, isBaseCell, MAP_LABELS, CRATERS, BRIDGE
} from './data.js'
import { hexToPixel, neighborsOf } from './engine.js'
import {
  TAU, FONT_MONO, FONT_DISPLAY, h2, hexPoints, hexPath, clipHex,
  roundedRect, drawSpacedText
} from './render-utils.js'

const STATIC_SCALE = 1.55

function colLetter(c) {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[c] || '?'
}

function drawJungle(ctx, x, y, c, r) {
  const g = ctx.createRadialGradient(x - 10, y - 12, 3, x, y, HEX_SIZE * 1.1)
  g.addColorStop(0, '#334d29')
  g.addColorStop(0.6, '#263b21')
  g.addColorStop(1, '#192816')
  ctx.fillStyle = g
  ctx.fillRect(x - HEX_SIZE, y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2)

  // Shadowed understory
  for (let i = 0; i < 5; i++) {
    const px = x + (h2(c, r, i) - 0.5) * HEX_SIZE * 1.35
    const py = y + (h2(c, r, i + 30) - 0.5) * HEX_SIZE * 1.1
    const rr = 11 + h2(c, r, i + 60) * 10
    ctx.fillStyle = 'rgba(8,15,8,.35)'
    ctx.beginPath()
    ctx.ellipse(px + 3, py + 4, rr * 1.08, rr * 0.82, 0, 0, TAU)
    ctx.fill()
  }
  // Canopy clusters
  for (let i = 0; i < 9; i++) {
    const px = x + (h2(c, r, i + 100) - 0.5) * HEX_SIZE * 1.55
    const py = y + (h2(c, r, i + 200) - 0.5) * HEX_SIZE * 1.25
    const rr = 8 + h2(c, r, i + 300) * 13
    const shade = h2(c, r, i + 400)
    const grad = ctx.createRadialGradient(px - rr * 0.35, py - rr * 0.4, 1, px, py, rr)
    grad.addColorStop(0, shade > 0.55 ? '#4c6b37' : '#3d5b2e')
    grad.addColorStop(0.55, '#2b4525')
    grad.addColorStop(1, 'rgba(21,35,17,.15)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(px, py, rr, rr * 0.82, h2(c, r, i + 500) * 2, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(115,141,78,.13)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(px - 1, py - 1, rr * 0.7, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
  }
  // Trunks and leaf litter
  ctx.strokeStyle = 'rgba(14,22,12,.55)'
  ctx.lineWidth = 1.3
  for (let i = 0; i < 4; i++) {
    const px = x + (h2(c, r, i + 600) - 0.5) * HEX_SIZE * 1.35
    const py = y + (h2(c, r, i + 700) - 0.5) * HEX_SIZE * 1.1
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.quadraticCurveTo(px + 3, py - 8, px + 1, py - 16)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(172,168,118,.12)'
  for (let i = 0; i < 9; i++) {
    const px = x + (h2(c, r, i + 800) - 0.5) * HEX_SIZE * 1.5
    const py = y + (h2(c, r, i + 900) - 0.5) * HEX_SIZE * 1.2
    ctx.fillRect(px, py, 1.4, 1)
  }
}

function drawPaddy(ctx, x, y, c, r) {
  const g = ctx.createLinearGradient(x - HEX_SIZE, y - HEX_SIZE, x + HEX_SIZE, y + HEX_SIZE)
  g.addColorStop(0, '#5d6c3b')
  g.addColorStop(0.5, '#4f6034')
  g.addColorStop(1, '#45552d')
  ctx.fillStyle = g
  ctx.fillRect(x - HEX_SIZE, y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2)

  // Water bands
  for (let i = 0; i < 4; i++) {
    const py = y - 30 + i * 17 + h2(c, r, i) * 5
    ctx.fillStyle = `rgba(126,150,104,${0.08 + h2(c, r, i + 10) * 0.07})`
    ctx.beginPath()
    ctx.moveTo(x - HEX_SIZE, py)
    ctx.quadraticCurveTo(x - 10, py - 5, x + 16, py + 1)
    ctx.quadraticCurveTo(x + 38, py + 4, x + HEX_SIZE, py - 2)
    ctx.lineTo(x + HEX_SIZE, py + 7)
    ctx.quadraticCurveTo(x + 20, py + 12, x - 6, py + 6)
    ctx.quadraticCurveTo(x - 30, py + 2, x - HEX_SIZE, py + 7)
    ctx.closePath()
    ctx.fill()
  }
  // Rice rows
  ctx.strokeStyle = 'rgba(112,136,73,.72)'
  ctx.lineWidth = 1.1
  for (let row = 0; row < 5; row++) {
    const py = y - 24 + row * 12
    ctx.beginPath()
    for (let col = 0; col < 8; col++) {
      const px = x - 30 + col * 9 + h2(c, r, row * 10 + col) * 2
      ctx.moveTo(px, py)
      ctx.lineTo(px + 1.5, py - 4 - h2(c, r, row + col * 4) * 3)
    }
    ctx.stroke()
  }
  // Dikes
  ctx.strokeStyle = 'rgba(64,64,38,.85)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x - 38, y - 30)
  ctx.quadraticCurveTo(x - 5, y - 36, x + 36, y - 28)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(90,90,54,.7)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x - 38, y - 32)
  ctx.quadraticCurveTo(x - 5, y - 38, x + 36, y - 30)
  ctx.stroke()
  // Specular glints
  ctx.fillStyle = 'rgba(200,218,165,.13)'
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(x - 30 + h2(c, r, i + 20) * 60, y - 24 + h2(c, r, i + 40) * 48, 5 + h2(c, r, i) * 7, 1)
  }
}

function drawHill(ctx, x, y, c, r) {
  const g = ctx.createRadialGradient(x - 8, y - 14, 2, x, y, HEX_SIZE * 1.05)
  g.addColorStop(0, '#706a43')
  g.addColorStop(0.6, '#5d5838')
  g.addColorStop(1, '#49452c')
  ctx.fillStyle = g
  ctx.fillRect(x - HEX_SIZE, y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2)

  // Contour lines
  for (let i = 0; i < 4; i++) {
    const rr = 12 + i * 8 + h2(c, r, i) * 3
    ctx.strokeStyle = `rgba(197,184,132,${0.13 - i * 0.015})`
    ctx.lineWidth = 1.1
    ctx.beginPath()
    ctx.ellipse(x - 3, y + 2, rr, rr * 0.7, -0.24, 0, TAU)
    ctx.stroke()
  }
  // Exposed rock and scrub
  for (let i = 0; i < 7; i++) {
    const px = x + (h2(c, r, i + 20) - 0.5) * 62
    const py = y + (h2(c, r, i + 40) - 0.5) * 48
    if (i % 3 === 0) {
      ctx.fillStyle = 'rgba(120,113,85,.65)'
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + 5, py - 3)
      ctx.lineTo(px + 7, py + 3)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.strokeStyle = 'rgba(114,124,70,.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + 1, py - 5)
      ctx.stroke()
    }
  }
}

function drawVillage(ctx, x, y, c, r) {
  const g = ctx.createLinearGradient(x - 30, y - 30, x + 30, y + 30)
  g.addColorStop(0, '#7a6643')
  g.addColorStop(1, '#5d4c32')
  ctx.fillStyle = g
  ctx.fillRect(x - HEX_SIZE, y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2)

  // Dirt paths
  ctx.strokeStyle = 'rgba(126,108,73,.45)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(x - 36, y + 20)
  ctx.quadraticCurveTo(x - 4, y + 2, x + 34, y - 24)
  ctx.stroke()

  // Hooches
  const houses = [
    { dx: -20, dy: -13, w: 24, h: 16, rot: -0.12 },
    { dx: 17, dy: 14, w: 20, h: 13, rot: 0.08 }
  ]
  for (let i = 0; i < houses.length; i++) {
    const ho = houses[i]
    ctx.save()
    ctx.translate(x + ho.dx, y + ho.dy)
    ctx.rotate(ho.rot + (h2(c, r, i) - 0.5) * 0.18)
    ctx.fillStyle = 'rgba(24,20,12,.28)'
    ctx.fillRect(-ho.w / 2 + 3, -ho.h / 2 + 4, ho.w, ho.h)
    ctx.fillStyle = i % 2 ? '#8d7647' : '#9a7f4b'
    ctx.fillRect(-ho.w / 2, -ho.h / 2, ho.w, ho.h)
    ctx.strokeStyle = 'rgba(72,53,28,.85)'
    ctx.lineWidth = 1.2
    ctx.strokeRect(-ho.w / 2, -ho.h / 2, ho.w, ho.h)
    // ridge + thatch
    ctx.strokeStyle = 'rgba(63,45,24,.65)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-ho.w / 2, 0)
    ctx.lineTo(ho.w / 2, 0)
    ctx.stroke()
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath()
      ctx.moveTo(k * 5, -ho.h / 2 + 1)
      ctx.lineTo(k * 5, ho.h / 2 - 1)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Palms
  for (let i = 0; i < 3; i++) {
    const px = x + (h2(c, r, i + 30) - 0.5) * 60
    const py = y + (h2(c, r, i + 50) - 0.5) * 46
    ctx.strokeStyle = 'rgba(48,39,24,.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(px, py + 7)
    ctx.quadraticCurveTo(px + 3, py - 5, px + 1, py - 15)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(58,84,44,.85)'
    ctx.lineWidth = 1.4
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * TAU + h2(c, r, f) * 0.3
      ctx.beginPath()
      ctx.moveTo(px + 1, py - 15)
      ctx.quadraticCurveTo(px + Math.cos(a) * 8, py - 18 + Math.sin(a) * 4, px + Math.cos(a) * 13, py - 15 + Math.sin(a) * 8)
      ctx.stroke()
    }
  }

  // Hedgerow
  ctx.fillStyle = 'rgba(46,68,34,.7)'
  for (let i = 0; i < 5; i++) {
    const px = x - 30 + i * 15
    const py = y + 28 + (h2(c, r, i + 70) - 0.5) * 4
    ctx.beginPath()
    ctx.arc(px, py, 3.4, 0, TAU)
    ctx.fill()
  }
}

function drawBaseGround(ctx, x, y, c, r) {
  const g = ctx.createLinearGradient(x - HEX_SIZE, y - HEX_SIZE, x + HEX_SIZE, y + HEX_SIZE)
  g.addColorStop(0, '#73694c')
  g.addColorStop(0.55, '#675e44')
  g.addColorStop(1, '#575039')
  ctx.fillStyle = g
  ctx.fillRect(x - HEX_SIZE, y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2)

  // gravel
  ctx.fillStyle = 'rgba(31,29,19,.22)'
  for (let i = 0; i < 14; i++) {
    const px = x + (h2(c, r, i) - 0.5) * 70
    const py = y + (h2(c, r, i + 20) - 0.5) * 60
    ctx.fillRect(px, py, 1.4, 1.2)
  }
  ctx.fillStyle = 'rgba(190,178,134,.12)'
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(x + (h2(c, r, i + 40) - 0.5) * 64, y + (h2(c, r, i + 60) - 0.5) * 54, 2.3, 1.4)
  }

  // Revetments, stores, and tents, keyed to their hex.
  if (c === 1 && r === 3) {
    // Command tent
    ctx.save()
    ctx.translate(x - 2, y - 5)
    ctx.fillStyle = 'rgba(24,22,14,.3)'
    ctx.fillRect(-16, -8, 34, 24)
    ctx.fillStyle = '#6d7448'
    ctx.beginPath()
    ctx.moveTo(-16, 8)
    ctx.lineTo(-16, -6)
    ctx.lineTo(2, -12)
    ctx.lineTo(18, -6)
    ctx.lineTo(18, 8)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(38,44,28,.8)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(2, -12)
    ctx.lineTo(2, 8)
    ctx.stroke()
    ctx.restore()
  }
  if (c === 0 && r === 3) {
    // Radio mast and crates
    ctx.strokeStyle = 'rgba(32,36,22,.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x + 6, y + 14)
    ctx.lineTo(x + 1, y - 26)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(210,202,166,.4)'
    ctx.lineWidth = 0.8
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(x + 4 - i * 2, y - 6 - i * 7)
      ctx.lineTo(x + 13 + i * 3, y - 10 - i * 7)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(93,78,48,.95)'
    ctx.fillRect(x - 24, y + 10, 10, 7)
    ctx.fillRect(x - 18, y + 14, 9, 6)
    ctx.strokeStyle = 'rgba(38,32,19,.7)'
    ctx.lineWidth = 0.8
    ctx.strokeRect(x - 24, y + 10, 10, 7)
  }
  if (c === 2 && r === 4) {
    // Bunker revetment
    ctx.strokeStyle = 'rgba(92,83,55,.9)'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(x, y, 31, -0.7, Math.PI + 0.7)
    ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = -0.55 + i * 0.36
      ctx.fillStyle = i % 2 ? 'rgba(160,146,103,.9)' : 'rgba(181,165,118,.9)'
      ctx.beginPath()
      ctx.ellipse(x + Math.cos(a) * 31, y + Math.sin(a) * 31, 4.4, 3, a, 0, TAU)
      ctx.fill()
    }
    // fuel drums
    ctx.fillStyle = 'rgba(89,96,67,.9)'
    ctx.beginPath()
    ctx.arc(x - 26, y + 25, 4, 0, TAU)
    ctx.arc(x - 18, y + 27, 4, 0, TAU)
    ctx.fill()
  }
  if (c === 3 && r === 4) {
    // Vehicle revetment and crates near the tank park
    ctx.strokeStyle = 'rgba(99,90,59,.9)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(x - 27, y - 20)
    ctx.lineTo(x - 27, y + 22)
    ctx.stroke()
    ctx.fillStyle = 'rgba(117,99,60,.9)'
    ctx.fillRect(x + 10, y - 22, 15, 8)
    ctx.fillRect(x + 14, y - 11, 12, 7)
    ctx.strokeStyle = 'rgba(45,37,21,.7)'
    ctx.lineWidth = 0.8
    ctx.strokeRect(x + 10, y - 22, 15, 8)
  }
  if (c === 4 && r === 5) {
    // Ammo stack and fuel bladders
    ctx.fillStyle = 'rgba(91,84,53,.95)'
    ctx.fillRect(x - 20, y + 15, 14, 8)
    ctx.fillRect(x - 14, y + 24, 11, 6)
    ctx.strokeStyle = 'rgba(39,33,19,.7)'
    ctx.lineWidth = 0.8
    ctx.strokeRect(x - 20, y + 15, 14, 8)
    ctx.fillStyle = 'rgba(78,83,56,.9)'
    ctx.beginPath()
    ctx.ellipse(x + 17, y + 18, 9, 5, 0.2, 0, TAU)
    ctx.fill()
  }
  if (c === 3 && r === 3) {
    // Canvas lean-to
    ctx.fillStyle = 'rgba(100,102,68,.85)'
    ctx.beginPath()
    ctx.moveTo(x - 12, y + 12)
    ctx.lineTo(x - 4, y - 10)
    ctx.lineTo(x + 16, y - 4)
    ctx.lineTo(x + 10, y + 13)
    ctx.closePath()
    ctx.fill()
  }
}

function drawGrass(ctx, x, y, c, r) {
  const g = ctx.createLinearGradient(x - HEX_SIZE, y - HEX_SIZE, x + HEX_SIZE, y + HEX_SIZE)
  g.addColorStop(0, '#59653a')
  g.addColorStop(1, '#47532e')
  ctx.fillStyle = g
  ctx.fillRect(x - HEX_SIZE, y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2)

  for (let i = 0; i < 46; i++) {
    const px = x + (h2(c, r, i) - 0.5) * 76
    const py = y + (h2(c, r, i + 100) - 0.5) * 60
    const len = 3 + h2(c, r, i + 200) * 5
    const hue = h2(c, r, i + 300)
    ctx.strokeStyle = hue > 0.6 ? 'rgba(132,143,79,.58)' : hue > 0.3 ? 'rgba(94,110,56,.7)' : 'rgba(65,80,38,.75)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px + (h2(c, r, i + 400) - 0.5) * 3, py - len)
    ctx.stroke()
  }
  // Shrubs
  for (let i = 0; i < 3; i++) {
    const px = x + (h2(c, r, i + 500) - 0.5) * 54
    const py = y + (h2(c, r, i + 600) - 0.5) * 42
    ctx.fillStyle = 'rgba(54,73,36,.7)'
    ctx.beginPath()
    ctx.arc(px, py, 3 + h2(c, r, i) * 3, 0, TAU)
    ctx.fill()
  }
}

function drawWater(ctx, x, y, c, r, bridge = false) {
  const g = ctx.createLinearGradient(x - 30, y - 30, x + 32, y + 34)
  g.addColorStop(0, '#386168')
  g.addColorStop(0.45, '#2d535a')
  g.addColorStop(1, '#224246')
  ctx.fillStyle = g
  ctx.fillRect(x - HEX_SIZE, y - HEX_SIZE, HEX_SIZE * 2, HEX_SIZE * 2)

  // Banks
  ctx.strokeStyle = 'rgba(119,127,83,.5)'
  ctx.lineWidth = 2
  for (const n of neighborsOf(c, r)) {
    const t = terrainKeyAt(n.c, n.r)
    if (t === 'R' || t === 'bridge' || t === null) continue
    const p = hexToPixel(n.c, n.r)
    const pts = hexPoints(x, y, HEX_SIZE * 0.99)
    const angle = Math.atan2(p.y - y, p.x - x)
    let seg = Math.round(((angle + TAU) % TAU) / (Math.PI / 3)) % 6
    const pairs = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 1]]
    const [ia, ib] = pairs[seg]
    ctx.beginPath()
    ctx.moveTo(pts[ia].x, pts[ia].y)
    ctx.lineTo(pts[ib].x, pts[ib].y)
    ctx.stroke()
  }

  // Surface ripples
  for (let i = 0; i < 5; i++) {
    const py = y - 28 + i * 14 + h2(c, r, i) * 5
    ctx.strokeStyle = `rgba(159,203,199,${0.09 + h2(c, r, i + 40) * 0.08})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x - 32 + h2(c, r, i + 10) * 16, py)
    ctx.quadraticCurveTo(x, py - 4, x + 30, py + 1)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(210,232,220,.08)'
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(x - 30 + h2(c, r, i + 70) * 60, y - 25 + h2(c, r, i + 90) * 50, 4 + h2(c, r, i) * 8, 1)
  }

  if (bridge) drawBridge(ctx, x, y, c, r)
}

function drawBridge(ctx, x, y) {
  // A timber deck crossing the river along the east-west road.
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(17,20,13,.35)'
  ctx.fillRect(-44, -13, 92, 34)
  ctx.fillStyle = '#75603a'
  ctx.fillRect(-44, -16, 88, 32)
  ctx.fillStyle = '#8b7246'
  ctx.fillRect(-44, -13, 88, 26)
  // Planks
  ctx.strokeStyle = 'rgba(67,51,27,.8)'
  ctx.lineWidth = 1.1
  for (let i = -40; i <= 40; i += 7) {
    ctx.beginPath()
    ctx.moveTo(i, -13)
    ctx.lineTo(i - 1.5, 13)
    ctx.stroke()
  }
  // Rails
  ctx.fillStyle = 'rgba(53,42,23,.95)'
  ctx.fillRect(-44, -17, 88, 3)
  ctx.fillRect(-44, 14, 88, 3)
  for (let i = -40; i <= 40; i += 18) {
    ctx.fillRect(i, -19, 2.5, 9)
    ctx.fillRect(i, 10, 2.5, 9)
  }
  // Tire tracks
  ctx.strokeStyle = 'rgba(52,43,25,.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-40, -5)
  ctx.lineTo(40, -5)
  ctx.moveTo(-40, 5)
  ctx.lineTo(40, 5)
  ctx.stroke()
  ctx.restore()
}

function drawRoad(ctx) {
  const pts = []
  for (let c = 0; c < COLS; c++) pts.push(hexToPixel(c, 4))
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pts[0].x - 10, pts[0].y)
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const mx = (prev.x + cur.x) / 2
    ctx.quadraticCurveTo(prev.x, prev.y + (h2(i, 4, 2) - 0.5) * 2, mx, (prev.y + cur.y) / 2)
    ctx.lineTo(cur.x, cur.y + (h2(i, 4, 3) - 0.5) * 2)
  }
  ctx.strokeStyle = 'rgba(49,41,25,.85)'
  ctx.lineWidth = 25
  ctx.stroke()
  ctx.strokeStyle = '#8b7347'
  ctx.lineWidth = 19
  ctx.stroke()
  ctx.strokeStyle = 'rgba(181,157,105,.45)'
  ctx.lineWidth = 3
  ctx.stroke()
  // Tire ruts
  ctx.strokeStyle = 'rgba(66,53,30,.4)'
  ctx.lineWidth = 1.6
  for (const off of [-5, 5]) {
    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      if (i === 0) ctx.moveTo(p.x, p.y + off)
      else {
        const prev = pts[i - 1]
        const mx = (prev.x + p.x) / 2
        ctx.quadraticCurveTo(prev.x, prev.y + off, mx, (prev.y + p.y) / 2 + off)
        ctx.lineTo(p.x, p.y + off)
      }
    }
    ctx.stroke()
  }
  ctx.restore()
}

function drawBasePerimeter(ctx) {
  const pairs = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 1]]
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isBaseCell(c, r)) continue
      const p = hexToPixel(c, r)
      for (const n of neighborsOf(c, r)) {
        if (!isBaseCell(n.c, n.r)) {
          const np = hexToPixel(n.c, n.r)
          const angle = Math.atan2(np.y - p.y, np.x - p.x)
          const seg = Math.round(((angle + TAU) % TAU) / (Math.PI / 3)) % 6
          const [ia, ib] = pairs[seg]
          const pts = hexPoints(p.x, p.y, HEX_SIZE * 0.94)
          const a = pts[ia]
          const b = pts[ib]
          // Leave a gate where the road enters the firebase.
          if (isRoad(c, r) && isRoad(n.c, n.r)) continue
          ctx.strokeStyle = 'rgba(53,47,31,.8)'
          ctx.lineWidth = 7
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          for (let t = 0.08; t <= 0.92; t += 0.14) {
            const px = a.x + (b.x - a.x) * t
            const py = a.y + (b.y - a.y) * t
            ctx.fillStyle = h2(c, r, Math.round(t * 100)) > 0.5
              ? 'rgba(188,174,126,.95)' : 'rgba(154,140,99,.95)'
            ctx.beginPath()
            ctx.ellipse(px, py, 3.6, 2.5, angle + Math.PI / 2, 0, TAU)
            ctx.fill()
            ctx.strokeStyle = 'rgba(65,57,37,.6)'
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
          // Concertina wire, outside the wall
          const ox = (a.x + b.x) / 2
          const oy = (a.y + b.y) / 2
          const nx = Math.cos(angle) * 5.5
          const ny = Math.sin(angle) * 5.5
          ctx.strokeStyle = 'rgba(62,62,48,.65)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(a.x + nx, a.y + ny)
          ctx.lineTo(b.x + nx, b.y + ny)
          ctx.stroke()
          for (let t = 0.1; t <= 0.9; t += 0.16) {
            const px = a.x + (b.x - a.x) * t + nx
            const py = a.y + (b.y - a.y) * t + ny
            ctx.beginPath()
            ctx.moveTo(px - 2, py - 2)
            ctx.lineTo(px + 2, py + 2)
            ctx.moveTo(px + 2, py - 2)
            ctx.lineTo(px - 2, py + 2)
            ctx.stroke()
          }
        }
      }
    }
  }
}

function drawCraters(ctx) {
  for (const crater of CRATERS) {
    const p = hexToPixel(crater.c, crater.r)
    const rr = crater.s
    const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rr)
    g.addColorStop(0, 'rgba(27,24,15,.8)')
    g.addColorStop(0.65, 'rgba(48,42,27,.55)')
    g.addColorStop(1, 'rgba(103,88,57,.08)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, rr, rr * 0.68, h2(crater.c, crater.r) * 2, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(167,149,103,.2)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, rr * 0.9, rr * 0.6, h2(crater.c, crater.r) * 2, 0, TAU)
    ctx.stroke()
  }
}

function drawMapLabels(ctx) {
  for (const label of MAP_LABELS) {
    const p = hexToPixel(label.c, label.r)
    ctx.save()
    ctx.translate(p.x, p.y)
    if (label.rotate) ctx.rotate(label.rotate)
    ctx.font = `600 ${label.size}px ${FONT_MONO}`
    ctx.fillStyle = label.color
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(5,8,4,.65)'
    ctx.shadowBlur = 4
    drawSpacedText(ctx, label.text, 0, 0, label.spacing)
    ctx.restore()
  }
  // Firebases get a crosshair marker.
  const fp = hexToPixel(2, 4)
  ctx.strokeStyle = 'rgba(211,190,124,.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(fp.x, fp.y, 34, 0, TAU)
  ctx.moveTo(fp.x - 42, fp.y)
  ctx.lineTo(fp.x - 37, fp.y)
  ctx.moveTo(fp.x + 37, fp.y)
  ctx.lineTo(fp.x + 42, fp.y)
  ctx.moveTo(fp.x, fp.y - 42)
  ctx.lineTo(fp.x, fp.y - 37)
  ctx.stroke()
}

function drawBorder(ctx) {
  ctx.strokeStyle = 'rgba(208,193,147,.22)'
  ctx.lineWidth = 1
  ctx.strokeRect(7, 7, BOARD_W - 14, BOARD_H - 14)
  ctx.strokeStyle = 'rgba(208,193,147,.12)'
  ctx.strokeRect(11, 11, BOARD_W - 22, BOARD_H - 22)

  // Corner brackets
  ctx.strokeStyle = 'rgba(224,205,150,.55)'
  ctx.lineWidth = 1.6
  const corners = [
    [18, 18, 1, 1], [BOARD_W - 18, 18, -1, 1],
    [18, BOARD_H - 18, 1, -1], [BOARD_W - 18, BOARD_H - 18, -1, -1]
  ]
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath()
    ctx.moveTo(x, y + sy * 16)
    ctx.lineTo(x, y)
    ctx.lineTo(x + sx * 16, y)
    ctx.stroke()
  }

  // Column coordinates
  ctx.font = `600 9px ${FONT_MONO}`
  ctx.fillStyle = 'rgba(208,193,147,.45)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let c = 0; c < COLS; c++) {
    const top = hexToPixel(c, 0)
    const bottom = hexToPixel(c, ROWS - 1)
    ctx.fillText(colLetter(c), top.x, 20)
    ctx.fillText(colLetter(c), bottom.x, BOARD_H - 20)
  }
  for (let r = 0; r < ROWS; r++) {
    const p = hexToPixel(0, r)
    ctx.fillText(String(r + 1), 20, p.y)
    ctx.fillText(String(r + 1), BOARD_W - 20, p.y)
  }

  // Compass rose
  ctx.save()
  ctx.translate(BOARD_W - 62, BOARD_H - 62)
  ctx.strokeStyle = 'rgba(211,196,150,.42)'
  ctx.fillStyle = 'rgba(211,196,150,.55)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, 17, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, -22)
  ctx.lineTo(4, 0)
  ctx.lineTo(0, 6)
  ctx.lineTo(-4, 0)
  ctx.closePath()
  ctx.fill()
  ctx.font = `700 8px ${FONT_MONO}`
  ctx.textAlign = 'center'
  ctx.fillText('N', 0, -26)
  ctx.restore()

  // Scale bar
  ctx.save()
  ctx.translate(26, BOARD_H - 38)
  ctx.strokeStyle = 'rgba(211,196,150,.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(90, 0)
  for (let i = 0; i <= 3; i++) {
    ctx.moveTo(i * 30, -3)
    ctx.lineTo(i * 30, 3)
  }
  ctx.stroke()
  ctx.font = `600 8px ${FONT_MONO}`
  ctx.fillStyle = 'rgba(211,196,150,.48)'
  ctx.textAlign = 'left'
  ctx.fillText('0', 0, 12)
  ctx.fillText('250 m', 58, 12)
  ctx.fillText('SHEET 1 · QUANG TRI', 0, -10)
  ctx.restore()
}

function drawGrain(ctx) {
  for (let i = 0; i < 1300; i++) {
    const x = h2(i, 1, 11) * BOARD_W
    const y = h2(i, 2, 12) * BOARD_H
    ctx.fillStyle = i % 3 === 0 ? 'rgba(224,210,166,.035)' : 'rgba(0,0,0,.05)'
    ctx.fillRect(x, y, 1, 1)
  }
  // Faint topo lines in the margin
  ctx.strokeStyle = 'rgba(194,184,142,.05)'
  ctx.lineWidth = 0.8
  for (let i = 0; i < 9; i++) {
    ctx.beginPath()
    ctx.ellipse(BOARD_W * 0.25 + i * 8, BOARD_H * 0.15, 160 + i * 26, 80 + i * 12, 0.3, 0, TAU)
    ctx.stroke()
  }
}

export function buildStaticLayer() {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(BOARD_W * STATIC_SCALE)
  canvas.height = Math.ceil(BOARD_H * STATIC_SCALE)
  const ctx = canvas.getContext('2d')
  ctx.scale(STATIC_SCALE, STATIC_SCALE)

  // Dark margin beneath the map.
  ctx.fillStyle = '#10150d'
  ctx.fillRect(0, 0, BOARD_W, BOARD_H)
  drawGrain(ctx)

  // Hex fills
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = terrainAt(c, r)
      const p = hexToPixel(c, r)
      const shade = h2(c, r, 1)
      ctx.fillStyle = t.color
      hexPath(ctx, p.x, p.y, HEX_SIZE * 1.012)
      ctx.fill()
      if (shade > 0.6) {
        ctx.fillStyle = 'rgba(220,208,160,.028)'
        ctx.fill()
      }
    }
  }

  // Terrain detail, clipped to each hex.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = terrainKeyAt(c, r)
      const p = hexToPixel(c, r)
      ctx.save()
      clipHex(ctx, p.x, p.y, HEX_SIZE * 1.004)
      if (key === 'J') drawJungle(ctx, p.x, p.y, c, r)
      else if (key === 'P') drawPaddy(ctx, p.x, p.y, c, r)
      else if (key === 'H') drawHill(ctx, p.x, p.y, c, r)
      else if (key === 'V') drawVillage(ctx, p.x, p.y, c, r)
      else if (key === 'B') drawBaseGround(ctx, p.x, p.y, c, r)
      else if (key === 'G') drawGrass(ctx, p.x, p.y, c, r)
      else if (key === 'R') drawWater(ctx, p.x, p.y, c, r)
      else if (key === 'bridge') drawWater(ctx, p.x, p.y, c, r, true)
      ctx.restore()
    }
  }

  drawRoad(ctx)
  // The bridge deck sits above the road for a convincing crossing.
  const bridgePixel = hexToPixel(BRIDGE.c, BRIDGE.r)
  ctx.save()
  clipHex(ctx, bridgePixel.x, bridgePixel.y, HEX_SIZE * 1.004)
  drawBridge(ctx, bridgePixel.x, bridgePixel.y)
  ctx.restore()

  drawBasePerimeter(ctx)
  drawCraters(ctx)

  // Soft hex lattice
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = hexToPixel(c, r)
      hexPath(ctx, p.x, p.y, HEX_SIZE)
      ctx.strokeStyle = 'rgba(8,12,7,.17)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  // Vignette along the map edge
  const vg = ctx.createRadialGradient(BOARD_W / 2, BOARD_H / 2, BOARD_H * 0.32, BOARD_W / 2, BOARD_H / 2, BOARD_W * 0.72)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(2,5,2,.42)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, BOARD_W, BOARD_H)

  drawMapLabels(ctx)
  drawBorder(ctx)

  return canvas
}

export { STATIC_SCALE }
