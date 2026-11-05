import {
  COLS, ROWS, HEX_SIZE, HEX_W, BOARD_W, BOARD_H, TERRAIN,
  terrainAt, terrainKeyAt, MAP_LABELS, BRIDGE
} from './data.js'
import { hexToPixel, hexDistance, neighborsOf, keyOf } from './engine.js'
import { buildStaticLayer } from './render-terrain.js'
import {
  TAU, FONT_MONO, FONT_DISPLAY, clamp, easeOutCubic, easeInOut, h2,
  hexPath, roundedRect, drawUnitIcon
} from './render-utils.js'
import { drawEffect } from './render-effects.js'

const US_RING = 'rgba(174,211,146,.95)'
const NVA_RING = 'rgba(226,120,96,.95)'
const GOLD = 'rgba(226,193,112,.95)'

function hexCenter(c, r) {
  return hexToPixel(c, r)
}

function inCell(a, b) {
  return a && b && a.c === b.c && a.r === b.r
}

export class Renderer {
  constructor(canvas, game, ui) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.game = game
    this.ui = ui
    this.staticLayer = buildStaticLayer()
    this.view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 }
    this.effects = []
    this.shake = null
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement || canvas)
    window.addEventListener('resize', () => this.resize())
    this.resize()
    this.loop = this.loop.bind(this)
    requestAnimationFrame(this.loop)
  }

  setGame(game) {
    this.game = game
    this.effects = []
    this.shake = null
  }

  resize() {
    const parent = this.canvas.parentElement || this.canvas
    const rect = parent.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
    const pad = w < 560 ? 4 : 8
    const scale = Math.min((w - pad * 2) / BOARD_W, (h - pad * 2) / BOARD_H)
    this.view = {
      w, h, dpr, scale,
      ox: (w - BOARD_W * scale) / 2,
      oy: (h - BOARD_H * scale) / 2
    }
  }

  screenToBoard(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    const x = (clientX - rect.left - this.view.ox) / this.view.scale
    const y = (clientY - rect.top - this.view.oy) / this.view.scale
    return { x, y }
  }

  pickHex(clientX, clientY) {
    const p = this.screenToBoard(clientX, clientY)
    if (p.x < 0 || p.y < 0 || p.x > BOARD_W || p.y > BOARD_H) return null
    let best = null
    let bestDist = Infinity
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const center = hexCenter(c, r)
        const d = (center.x - p.x) ** 2 + (center.y - p.y) ** 2
        if (d < bestDist) {
          bestDist = d
          best = { c, r }
        }
      }
    }
    if (!best || bestDist > (HEX_SIZE * 1.12) ** 2) return null
    return best
  }

  pickUnit(clientX, clientY) {
    const cell = this.pickHex(clientX, clientY)
    if (!cell) return null
    return this.game.occupied(cell.c, cell.r)
  }

  addEffect(effect) {
    this.effects.push(effect)
    if (this.effects.length > 160) this.effects.shift()
  }

  addShake(mag = 4, dur = 280) {
    const now = Date.now()
    if (this.shake) {
      const remaining = this.shake.dur - (now - this.shake.start)
      if (remaining > dur * 0.5 && this.shake.mag >= mag) return
    }
    this.shake = { start: now, dur, mag }
  }

  handleEvent(event) {
    if (!event) return
    const now = Date.now()
    switch (event.type) {
      case 'attack': {
        const a = hexCenter(event.from.c, event.from.r)
        const b = hexCenter(event.to.c, event.to.r)
        const heavy = /90mm|76\.2|82mm|RPG|mortar/i.test(event.weapon || '')
        const killedTarget = event.killed
        if (event.indirect) {
          this.addEffect({ type: 'arc', x1: a.x, y1: a.y, x2: b.x, y2: b.y, start: now, dur: 500, side: event.attackerSide })
          this.addEffect({ type: 'explosion', x: b.x, y: b.y, start: now + 470, dur: 780, size: heavy ? 31 : 23, seed: h2(event.to.c, event.to.r) * TAU })
        } else {
          this.addEffect({ type: 'tracer', x1: a.x, y1: a.y, x2: b.x, y2: b.y, start: now, dur: 340, side: event.attackerSide, heavy })
          this.addEffect({ type: 'explosion', x: b.x, y: b.y, start: now + 180, dur: 620, size: heavy ? 28 : 18, seed: h2(event.to.c, event.to.r) * TAU })
        }
        if (event.attackerSide === 'nva') this.addShake(heavy ? 7 : 3.2)
        this.addEffect({
          type: 'text',
          x: b.x,
          y: b.y - 18,
          text: `-${event.damage}`,
          start: now + 240,
          dur: 900,
          color: event.defenderSide === 'us' ? '#ff9b83' : '#f4dc9c',
          size: heavy ? 17 : 14
        })
        if (event.suppressed) {
          this.addEffect({
            type: 'text', x: b.x, y: b.y - 32, text: 'PINNED', start: now + 330,
            dur: 900, color: '#e9b36b', size: 10
          })
        }
        if (killedTarget) {
          this.addEffect({
            type: 'text', x: b.x, y: b.y - 42, text: 'DESTROYED', start: now + 360,
            dur: 1100, color: event.defenderSide === 'us' ? '#ff8b74' : '#dfc077', size: 10
          })
        }
        if (event.splash?.length) {
          for (const s of event.splash) {
            const target = this.game.getUnit(s.unitId)
            if (!target) continue
            const p = hexCenter(target.c, target.r)
            this.addEffect({ type: 'explosion', x: p.x, y: p.y, start: now + 230, dur: 520, size: 16, seed: h2(target.c, target.r) * TAU })
            this.addEffect({ type: 'text', x: p.x, y: p.y - 16, text: `-${s.damage}`, start: now + 300, dur: 780, color: '#f4dc9c', size: 11 })
          }
        }
        break
      }
      case 'support': {
        const p = hexCenter(event.c, event.r)
        if (event.kind === 'artillery') {
          this.addShake(11, 560)
          this.addEffect({ type: 'ring', x: p.x, y: p.y, start: now, dur: 700, radius: 52, color: 'rgba(255,214,130,.7)', width: 2 })
          this.addEffect({ type: 'explosion', x: p.x, y: p.y, start: now, dur: 1100, size: 48, seed: 1.1 })
          const around = neighborsOf(event.c, event.r)
          for (let i = 0; i < around.length; i += 2) {
            const q = hexCenter(around[i].c, around[i].r)
            this.addEffect({ type: 'explosion', x: q.x, y: q.y, start: now + 120 + i * 55, dur: 700, size: 23, seed: i * 1.7 })
          }
          this.addEffect({ type: 'text', x: p.x, y: p.y - 42, text: '105mm', start: now + 60, dur: 1200, color: '#ffe6a8', size: 13 })
        } else if (event.kind === 'huey') {
          this.addShake(7, 650)
          this.addEffect({ type: 'huey', x: p.x, y: p.y, start: now, dur: 1600 })
          this.addEffect({ type: 'explosion', x: p.x, y: p.y, start: now + 450, dur: 800, size: 30, seed: 0.4 })
          const around = neighborsOf(event.c, event.r)
          for (let i = 1; i < around.length; i += 3) {
            const q = hexCenter(around[i].c, around[i].r)
            this.addEffect({ type: 'explosion', x: q.x, y: q.y, start: now + 520 + i * 30, dur: 560, size: 18, seed: i })
          }
          this.addEffect({ type: 'text', x: p.x, y: p.y - 48, text: 'GUNSHIP', start: now + 380, dur: 1100, color: '#d9f0bd', size: 11 })
        } else if (event.kind === 'dustoff') {
          this.addEffect({ type: 'heal', x: p.x, y: p.y, start: now, dur: 1200 })
          if (event.heal > 0) {
            this.addEffect({ type: 'text', x: p.x, y: p.y - 24, text: `+${event.heal}`, start: now, dur: 1200, color: '#9ce7b4', size: 14 })
          }
        }
        break
      }
      case 'death': {
        const p = hexCenter(event.c, event.r)
        this.addEffect({ type: 'explosion', x: p.x, y: p.y, start: now, dur: 800, size: event.objective ? 50 : 24, seed: h2(event.c, event.r) * TAU })
        if (event.objective) this.addShake(13, 800)
        break
      }
      case 'move': {
        const p = hexCenter(event.to.c, event.to.r)
        this.addEffect({ type: 'dust', x: p.x, y: p.y + 8, start: now + 80, dur: 520, seed: h2(event.to.c, event.to.r) * TAU })
        break
      }
      case 'spawn': {
        const p = hexCenter(event.c, event.r)
        this.addEffect({ type: 'ring', x: p.x, y: p.y, start: now, dur: 900, radius: 30, color: 'rgba(230,130,104,.8)', width: 2 })
        break
      }
      case 'gameOver': {
        if (event.result === 'defeat') {
          const bunker = this.game.getBunker()
          if (bunker) {
            const p = hexCenter(bunker.c, bunker.r)
            this.addEffect({ type: 'explosion', x: p.x, y: p.y, start: now + 300, dur: 1600, size: 60, seed: 2.3 })
          }
          this.addShake(10, 900)
        }
        break
      }
      default:
        break
    }
  }

  loop() {
    const now = Date.now()
    this.draw(now)
    requestAnimationFrame(this.loop)
  }

  draw(now) {
    const ctx = this.ctx
    const { w, h, dpr, scale, ox, oy } = this.view
    if (!w || !h) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Canvas backdrop / map-table texture
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.35, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.78)
    bg.addColorStop(0, '#1c2418')
    bg.addColorStop(0.55, '#11170f')
    bg.addColorStop(1, '#080b07')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(190,180,140,.035)'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 46) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let y = 0; y < h; y += 46) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    let sx = 0
    let sy = 0
    if (this.shake) {
      const sp = (now - this.shake.start) / this.shake.dur
      if (sp >= 1) this.shake = null
      else {
        const mag = this.shake.mag * (1 - sp)
        sx = Math.sin(now * 0.11) * mag
        sy = Math.cos(now * 0.14) * mag * 0.7
      }
    }

    // Board shadow
    ctx.save()
    ctx.translate(ox + sx, oy + sy)
    ctx.scale(scale, scale)
    ctx.shadowColor = 'rgba(0,0,0,.55)'
    ctx.shadowBlur = 18
    ctx.fillStyle = '#0d120c'
    ctx.fillRect(-6, -6, BOARD_W + 12, BOARD_H + 12)
    ctx.shadowBlur = 0
    ctx.drawImage(this.staticLayer, 0, 0, BOARD_W, BOARD_H)

    this.drawWater(ctx, now)
    if (!this.reducedMotion) this.drawMist(ctx, now)
    this.drawSmoke(ctx, now)
    this.drawObjectiveRing(ctx, now)
    this.drawOverlaysBelow(ctx, now)
    this.drawUnits(ctx, now)
    this.drawOverlaysAbove(ctx, now)
    this.drawEffects(ctx, now)
    if (!this.reducedMotion) this.drawRain(ctx, now)
    ctx.restore()
  }

  drawWater(ctx, now) {
    const t = this.reducedMotion ? 0 : now * 0.00065
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = terrainKeyAt(c, r)
        if (key !== 'R') continue
        const p = hexCenter(c, r)
        ctx.save()
        ctx.beginPath()
        hexPath(ctx, p.x, p.y, HEX_SIZE * 1.002)
        ctx.clip()
        for (let i = 0; i < 2; i++) {
          const off = Math.sin(t + h2(c, r, i) * TAU) * 7
          const y = p.y - 20 + i * 22 + off
          ctx.strokeStyle = `rgba(182,222,210,${0.075 + 0.03 * Math.sin(t * 1.3 + i)})`
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.moveTo(p.x - 38, y)
          ctx.quadraticCurveTo(p.x - 4 + off, y - 4, p.x + 20, y + 1)
          ctx.quadraticCurveTo(p.x + 33, y + 3, p.x + 40, y)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(220,240,226,.08)'
        const gx = p.x - 24 + ((now * 0.008 + h2(c, r, 4) * 100) % 52)
        ctx.fillRect(gx, p.y - 10 + Math.sin(t + h2(c, r, 7) * 8) * 10, 6, 1.2)
        ctx.restore()
      }
    }
  }

  drawMist(ctx, now) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, BOARD_W, BOARD_H)
    ctx.clip()
    for (let i = 0; i < 4; i++) {
      const x = ((now * 0.005 + i * 280 + h2(i, 1) * 130) % (BOARD_W + 300)) - 150
      const y = BOARD_H * (0.18 + i * 0.18)
      const g = ctx.createRadialGradient(x, y, 4, x, y, 180)
      g.addColorStop(0, 'rgba(180,190,166,.055)')
      g.addColorStop(1, 'rgba(180,190,166,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x, y, 220, 48, 0.04, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  drawSmoke(ctx, now) {
    const bunker = this.game.getBunker()
    if (bunker && bunker.alive) {
      const p = hexCenter(bunker.c, bunker.r)
      this.plume(ctx, p.x - 4, p.y - 18, now, 1)
    }
    const p2 = hexCenter(1, 3)
    this.plume(ctx, p2.x + 8, p2.y - 12, now + 800, 2, 0.72)
    if (this.game.phase === 'over' && this.game.result === 'defeat') {
      const p = hexCenter(this.game.getBunker()?.c || 2, this.game.getBunker()?.r || 4)
      this.plume(ctx, p.x, p.y - 12, now + 300, 3, 1.3)
    }
  }

  plume(ctx, x, y, now, seed, scale = 1) {
    const t = this.reducedMotion ? 0 : now * 0.00012
    ctx.save()
    for (let i = 0; i < 6; i++) {
      const phase = (t + i / 6 + seed * 0.17) % 1
      const px = x + Math.sin(phase * 5 + seed + i) * 8 + phase * 18
      const py = y - phase * 58 * scale
      const rr = (3 + phase * 8) * scale
      ctx.fillStyle = `rgba(73,73,61,${(1 - phase) * 0.2})`
      ctx.beginPath()
      ctx.arc(px, py, rr, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  drawRain(ctx, now) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, BOARD_W, BOARD_H)
    ctx.clip()
    ctx.strokeStyle = 'rgba(190,206,184,.06)'
    ctx.lineWidth = 0.8
    for (let i = 0; i < 74; i++) {
      const speed = 0.06 + h2(i, 8) * 0.08
      const x = (h2(i, 2) * BOARD_W + now * speed) % BOARD_W
      const y = (h2(i, 3) * BOARD_H + now * speed * 1.4) % BOARD_H
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 3, y + 9)
      ctx.stroke()
    }
    ctx.restore()
  }

  drawObjectiveRing(ctx, now) {
    const bunker = this.game.getBunker()
    if (!bunker || !bunker.alive) return
    const p = hexCenter(bunker.c, bunker.r)
    const pulse = 0.5 + Math.sin(now * 0.003) * 0.2
    ctx.save()
    ctx.strokeStyle = `rgba(225,193,110,${pulse})`
    ctx.lineWidth = 1.4
    ctx.setLineDash([4, 5])
    ctx.lineDashOffset = -now * 0.02
    ctx.beginPath()
    ctx.arc(p.x, p.y, 34, 0, TAU)
    ctx.stroke()
    ctx.restore()
  }

  drawOverlaysBelow(ctx, now) {
    const game = this.game
    const selected = game.getUnit(this.ui.selectedId)
    const hover = this.ui.hover
    const phase = game.phase

    if (selected && selected.side === 'us' && selected.alive && phase === 'player') {
      if (!selected.moved && !selected.attacked && !selected.cannotAct) {
        const { costs } = game.reachableMap(selected)
        for (const k of costs.keys()) {
          const [c, r] = k.split(',').map(Number)
          if (c === selected.c && r === selected.r) continue
          const p = hexCenter(c, r)
          ctx.fillStyle = 'rgba(159,205,144,.13)'
          hexPath(ctx, p.x, p.y, HEX_SIZE * 0.94)
          ctx.fill()
          ctx.strokeStyle = 'rgba(177,219,157,.28)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
        if (hover && costs.has(keyOf(hover.c, hover.r))) {
          const path = game.pathFromMap(selected, hover.c, hover.r, game.reachableMap(selected).prev)
          if (path && path.length > 1) this.drawPath(ctx, path, now, 'rgba(222,205,142,.9)')
        }
      }
      if (!selected.attacked && !selected.cannotAct && selected.range > 0) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const d = hexDistance({ c, r }, selected)
            if (d > selected.range || d < (selected.minRange || 0) || d === 0) continue
            const p = hexCenter(c, r)
            ctx.strokeStyle = 'rgba(220,108,84,.10)'
            ctx.lineWidth = 1
            hexPath(ctx, p.x, p.y, HEX_SIZE * 0.91)
            ctx.stroke()
          }
        }
        for (const enemy of game.enemyUnits()) {
          if (!game.inAttackRange(selected, enemy)) continue
          const p = hexCenter(enemy.c, enemy.r)
          const pulse = 0.5 + Math.sin(now * 0.006) * 0.15
          ctx.fillStyle = `rgba(220,91,68,${0.12 + pulse * 0.06})`
          hexPath(ctx, p.x, p.y, HEX_SIZE * 0.98)
          ctx.fill()
          ctx.strokeStyle = 'rgba(239,125,98,.55)'
          ctx.lineWidth = 1.6
          ctx.stroke()
        }
      }
    }

    if (hover) {
      const p = hexCenter(hover.c, hover.r)
      const unit = game.occupied(hover.c, hover.r)
      if (!this.ui.mode) {
        ctx.strokeStyle = unit ? 'rgba(235,222,176,.72)' : 'rgba(220,209,164,.28)'
        ctx.lineWidth = unit ? 1.8 : 1
        hexPath(ctx, p.x, p.y, HEX_SIZE * 0.97)
        ctx.stroke()
      }
    }

    if (this.ui.mode && hover) this.drawSupportRadius(ctx, hover.c, hover.r, now)
  }

  drawSupportRadius(ctx, c, r, now) {
    const kind = this.ui.mode.kind
    const isDustoff = kind === 'dustoff'
    const cells = isDustoff ? [{ c, r }] : [{ c, r }, ...neighborsOf(c, r)]
    for (const cell of cells) {
      const p = hexCenter(cell.c, cell.r)
      const color = isDustoff ? 'rgba(128,220,158,' : kind === 'artillery' ? 'rgba(237,174,86,' : 'rgba(172,224,154,'
      ctx.fillStyle = color + '0.11)'
      hexPath(ctx, p.x, p.y, HEX_SIZE * 0.96)
      ctx.fill()
      ctx.strokeStyle = color + '0.5)'
      ctx.lineWidth = 1.3
      ctx.stroke()
    }
    const p = hexCenter(c, r)
    const pulse = 0.65 + Math.sin(now * 0.008) * 0.2
    ctx.save()
    ctx.strokeStyle = `rgba(245,215,142,${pulse})`
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.arc(p.x, p.y, 16, 0, TAU)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(p.x - 9, p.y); ctx.lineTo(p.x + 9, p.y)
    ctx.moveTo(p.x, p.y - 9); ctx.lineTo(p.x, p.y + 9)
    ctx.stroke()
    ctx.restore()
  }

  drawPath(ctx, path, now, color) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.8
    ctx.setLineDash([5, 4])
    ctx.lineDashOffset = -now * 0.02
    ctx.beginPath()
    const first = hexCenter(path[0].c, path[0].r)
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < path.length; i++) {
      const p = hexCenter(path[i].c, path[i].r)
      ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
    const last = hexCenter(path[path.length - 1].c, path[path.length - 1].r)
    const prev = hexCenter(path[path.length - 2].c, path[path.length - 2].r)
    const a = Math.atan2(last.y - prev.y, last.x - prev.x)
    ctx.setLineDash([])
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(last.x - Math.cos(a - 0.5) * 9, last.y - Math.sin(a - 0.5) * 9)
    ctx.lineTo(last.x - Math.cos(a + 0.5) * 9, last.y - Math.sin(a + 0.5) * 9)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  renderPos(unit, now) {
    const target = hexCenter(unit.c, unit.r)
    const lm = unit.lastMove
    if (!lm || now - lm.start > lm.duration || lm.duration <= 0) return target
    const path = lm.path.map(p => hexCenter(p.c, p.r))
    if (path.length < 2) return target
    const lengths = []
    let total = 0
    for (let i = 1; i < path.length; i++) {
      const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
      lengths.push(d)
      total += d
    }
    const p = easeInOut((now - lm.start) / lm.duration)
    let remaining = total * p
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i]) {
        const t = lengths[i] ? remaining / lengths[i] : 0
        return {
          x: path[i].x + (path[i + 1].x - path[i].x) * t,
          y: path[i].y + (path[i + 1].y - path[i].y) * t
        }
      }
      remaining -= lengths[i]
    }
    return path[path.length - 1]
  }

  drawUnits(ctx, now) {
    const units = this.game.aliveUnits()
      .map(u => ({ u, p: this.renderPos(u, now) }))
      .sort((a, b) => a.p.y - b.p.y)
    for (const { u, p } of units) this.drawUnit(ctx, u, p.x, p.y, now)
  }

  drawUnit(ctx, unit, x, y, now) {
    const selected = this.ui.selectedId === unit.id
    const hovered = this.ui.hover && this.ui.hover.c === unit.c && this.ui.hover.r === unit.r
    const active = this.game.activeEnemyId === unit.id
    const r = unit.objective ? 27 : unit.vehicle ? 22 : 19.5
    const sideColor = unit.side === 'us' ? US_RING : NVA_RING
    const age = now - (unit.spawnedAt || 0)
    const spawnPulse = age >= 0 && age < 720
    const pulse = 0.5 + Math.sin(now * 0.006 + (unit.id.length || 1)) * 0.5

    ctx.save()
    ctx.translate(x, y)
    if (spawnPulse) {
      const t = clamp(age / 720, 0, 1)
      ctx.globalAlpha = t
      const s = 0.72 + easeOutCubic(t) * 0.28
      ctx.scale(s, s)
      ctx.strokeStyle = `rgba(231,137,104,${(1 - t) * 0.8})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, r + 10 + t * 22, 0, TAU)
      ctx.stroke()
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(4,7,4,.38)'
    ctx.beginPath()
    ctx.ellipse(0, r * 0.75, r * 0.9, r * 0.34, 0, 0, TAU)
    ctx.fill()

    if (selected) {
      ctx.save()
      ctx.rotate(now * 0.0006)
      ctx.strokeStyle = GOLD
      ctx.lineWidth = 1.7
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(0, 0, r + 7, 0, TAU)
      ctx.stroke()
      ctx.restore()
    }
    if (active) {
      ctx.strokeStyle = `rgba(231,118,91,${0.55 + pulse * 0.35})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, r + 5, 0, TAU)
      ctx.stroke()
    }
    if (hovered && !selected) {
      ctx.strokeStyle = 'rgba(231,219,174,.7)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(0, 0, r + 3, 0, TAU)
      ctx.stroke()
    }

    // Token plate
    const grad = ctx.createRadialGradient(-r * 0.28, -r * 0.34, 1, 0, 0, r * 1.16)
    if (unit.side === 'us') {
      grad.addColorStop(0, '#5c6c49')
      grad.addColorStop(0.62, '#33412b')
      grad.addColorStop(1, '#1b2418')
    } else {
      grad.addColorStop(0, '#6f4438')
      grad.addColorStop(0.62, '#42271f')
      grad.addColorStop(1, '#221510')
    }
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = sideColor
    ctx.lineWidth = unit.objective ? 2.2 : 1.6
    ctx.stroke()
    ctx.strokeStyle = unit.side === 'us' ? 'rgba(110,138,88,.7)' : 'rgba(140,70,54,.7)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, r - 3.2, 0, TAU)
    ctx.stroke()

    // Faction mark
    if (unit.side === 'us') {
      ctx.strokeStyle = 'rgba(199,220,168,.7)'
      ctx.lineWidth = 1.1
      ctx.beginPath()
      ctx.arc(0, 0, r - 1.4, -0.7, 0.7)
      ctx.stroke()
    } else {
      ctx.fillStyle = 'rgba(233,147,119,.8)'
      ctx.beginPath()
      const starR = 3
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5
        const rr = i % 2 === 0 ? starR : starR * 0.42
        const px = Math.cos(a) * rr
        const py = Math.sin(a) * rr + r * 0.7
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
    }

    drawUnitIcon(ctx, unit, r * 0.88)

    // Suppression marker
    if (unit.suppressed) {
      ctx.save()
      ctx.translate(r * 0.75, -r * 0.75)
      ctx.fillStyle = '#e9ad63'
      ctx.beginPath()
      ctx.moveTo(0, -5)
      ctx.lineTo(5, 4)
      ctx.lineTo(-5, 4)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#20170c'
      ctx.font = `700 6px ${FONT_MONO}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('!', 0, 1.5)
      ctx.restore()
    }

    // HP bar
    const barW = r * 1.85
    const by = r + 6
    ctx.fillStyle = 'rgba(8,11,7,.8)'
    roundedRect(ctx, -barW / 2, by, barW, 4.2, 1.5)
    ctx.fill()
    const frac = unit.hp / unit.maxHp
    ctx.fillStyle = frac > 0.6 ? '#8cbf73' : frac > 0.3 ? '#d1a54f' : '#cf644e'
    roundedRect(ctx, -barW / 2 + 0.6, by + 0.6, (barW - 1.2) * frac, 3, 1)
    ctx.fill()
    ctx.strokeStyle = 'rgba(235,225,188,.25)'
    ctx.lineWidth = 0.5
    roundedRect(ctx, -barW / 2, by, barW, 4.2, 1.5)
    ctx.stroke()

    // Name tag
    if (this.view.scale > 0.56) {
      ctx.font = `700 7.8px ${FONT_MONO}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const label = unit.label
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(11,15,9,.72)'
      roundedRect(ctx, -tw / 2 - 3.5, -r - 16, tw + 7, 11, 2.5)
      ctx.fill()
      ctx.fillStyle = unit.objective ? '#e5c67f' : unit.side === 'us' ? '#d4ddbd' : '#e5b9a8'
      ctx.fillText(label, 0, -r - 10.3)
    }

    if (unit.objective) {
      // Pennant above the command bunker
      const flagY = -r - 30
      ctx.strokeStyle = 'rgba(226,205,151,.8)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-1, flagY + 12)
      ctx.lineTo(-1, flagY - 3)
      ctx.stroke()
      ctx.fillStyle = 'rgba(204,119,76,.95)'
      ctx.beginPath()
      ctx.moveTo(-1, flagY - 3)
      ctx.lineTo(13, flagY + 1)
      ctx.lineTo(-1, flagY + 5)
      ctx.closePath()
      ctx.fill()
    }

    ctx.restore()
  }

  drawOverlaysAbove(ctx, now) {
    const game = this.game
    const selected = game.getUnit(this.ui.selectedId)
    const hover = this.ui.hover

    if (selected && hover && game.phase === 'player') {
      const target = game.occupied(hover.c, hover.r)
      if (target && target.side === 'nva' && game.inAttackRange(selected, target) && !selected.attacked) {
        const a = hexCenter(selected.c, selected.r)
        const b = hexCenter(target.c, target.r)
        ctx.save()
        ctx.strokeStyle = 'rgba(238,133,105,.8)'
        ctx.lineWidth = 1.3
        ctx.setLineDash([3, 5])
        ctx.lineDashOffset = -now * 0.03
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        ctx.setLineDash([])
        const pulse = 0.55 + Math.sin(now * 0.009) * 0.2
        ctx.strokeStyle = `rgba(244,151,116,${pulse})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(b.x, b.y, 26, 0, TAU)
        ctx.stroke()
        ctx.restore()
      }
    }

    if (this.ui.mode && hover) {
      const preview = game.previewSupport(this.ui.mode.kind, hover.c, hover.r)
      for (const hit of preview) {
        const u = game.getUnit(hit.unitId)
        if (!u) continue
        const p = hexCenter(u.c, u.r)
        let text, color
        if (this.ui.mode.kind === 'dustoff') {
          text = hit.heal > 0 ? `+${hit.heal}` : 'FULL'
          color = hit.heal > 0 ? '#9ce7b4' : '#c8d3ac'
        } else if (hit.friendly) {
          text = `-${hit.damage}`
          color = '#f0b466'
        } else {
          text = `-${hit.damage}`
          color = hit.killed ? '#ffd27c' : '#f0d39a'
        }
        this.badge(ctx, p.x, p.y - 36, text, color)
        if (hit.friendly && this.ui.mode.kind === 'artillery') {
          this.badge(ctx, p.x, p.y - 49, 'DANGER', '#f0a45c')
        }
      }
      if (this.ui.mode.kind === 'dustoff') {
        for (const u of game.playerCombatUnits()) {
          if (u.hp >= u.maxHp && !u.suppressed) continue
          const p = hexCenter(u.c, u.r)
          const pulse = 0.5 + Math.sin(now * 0.006) * 0.25
          ctx.strokeStyle = `rgba(132,222,160,${pulse})`
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.arc(p.x, p.y, 28, 0, TAU)
          ctx.stroke()
        }
      }
    }

    if (selected && selected.side === 'us' && selected.alive) {
      const p = hexCenter(selected.c, selected.r)
      ctx.save()
      ctx.strokeStyle = 'rgba(236,213,146,.6)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(p.x - 30, p.y - 30)
      ctx.lineTo(p.x - 30, p.y - 25)
      ctx.moveTo(p.x - 30, p.y - 30)
      ctx.lineTo(p.x - 25, p.y - 30)
      ctx.moveTo(p.x + 30, p.y - 30)
      ctx.lineTo(p.x + 30, p.y - 25)
      ctx.moveTo(p.x + 30, p.y - 30)
      ctx.lineTo(p.x + 25, p.y - 30)
      ctx.restore()
    }
  }

  badge(ctx, x, y, text, color) {
    ctx.save()
    ctx.font = `700 10px ${FONT_MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const w = ctx.measureText(text).width + 8
    ctx.fillStyle = 'rgba(10,14,9,.86)'
    roundedRect(ctx, x - w / 2, y - 7, w, 14, 3)
    ctx.fill()
    ctx.strokeStyle = 'rgba(236,215,150,.35)'
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.fillStyle = color
    ctx.fillText(text, x, y + 0.5)
    ctx.restore()
  }

  drawEffects(ctx, now) {
    this.effects = this.effects.filter(e => now - e.start < e.dur)
    for (const effect of this.effects) {
      if (now >= effect.start) drawEffect(ctx, effect, now)
    }
  }
}
