import {
  COLS, ROWS, MAX_TURNS, TERRAIN, UNIT_TYPES, STARTING_UNITS, INITIAL_ENEMIES,
  WAVES, SUPPORTS, UNIT_ROMAN, FLAVOR, terrainAt, terrainKeyAt, isBaseCell
} from './data.js'

// ---------------------------------------------------------------------------
// Hex helpers — pointy-top hexes, odd-r offset coordinates
// ---------------------------------------------------------------------------

export const keyOf = (c, r) => `${c},${r}`

export function hexToCube(c, r) {
  const x = c - (r - (r & 1)) / 2
  const z = r
  const y = -x - z
  return { x, y, z }
}

export function hexDistance(a, b) {
  const ac = hexToCube(a.c, a.r)
  const bc = hexToCube(b.c, b.r)
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z))
}

export function neighborsOf(c, r) {
  const odd = r & 1
  return odd
    ? [
        { c: c + 1, r }, { c: c - 1, r },
        { c: c + 1, r: r - 1 }, { c, r: r - 1 },
        { c: c + 1, r: r + 1 }, { c, r: r + 1 }
      ]
    : [
        { c: c + 1, r }, { c: c - 1, r },
        { c, r: r - 1 }, { c: c - 1, r: r - 1 },
        { c, r: r + 1 }, { c: c - 1, r: r + 1 }
      ]
}

export function inBounds(c, r) {
  return c >= 0 && r >= 0 && c < COLS && r < ROWS
}

export function hexToPixel(c, r) {
  const size = 48
  const w = Math.sqrt(3) * size
  return {
    x: 38 + w / 2 + c * w + (r & 1) * (w / 2),
    y: 38 + size + r * 1.5 * size
  }
}

export function coordLabel(c, r) {
  return `${'ABCDEFGHIJKL'[c] || '?'}${r + 1}`
}

// Mulberry32 — deterministic when a seed is supplied, so tests are repeatable.
function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9
  return function rand() {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(array, rand) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export class Game {
  constructor({ seed = Date.now(), onEvent = () => {} } = {}) {
    this.onEvent = onEvent
    this.delay = async () => {}
    this.seed = seed
    this.newOperation(seed)
  }

  setDelay(fn) {
    this.delay = typeof fn === 'function' ? fn : async () => {}
  }

  emit(event) {
    try { this.onEvent(event) } catch (err) { console.error('event handler failed', err) }
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  newOperation(seed = Date.now()) {
    this.rand = makeRng(seed)
    this.seed = seed
    this.units = []
    this.nextId = 1
    this.nameCount = {}
    this.turn = 1
    this.phase = 'briefing'
    this.started = false
    this.cp = 4
    this.maxCp = 12
    this.activeEnemyId = null
    this.logEntries = []
    this.logId = 0
    this.supportCharges = Object.fromEntries(
      Object.entries(SUPPORTS).map(([kind, def]) => [kind, def.charges])
    )
    this.stats = {
      kills: 0, losses: 0, shots: 0, supportUses: 0,
      damageDealt: 0, damageTaken: 0, enemiesSpawned: 0,
      playerUnitsLost: 0, bunkerMax: 18
    }
    this.result = null
    this.grade = null
    this.score = 0

    for (const u of STARTING_UNITS) this.addUnit(u.type, u.c, u.r)
    for (const u of INITIAL_ENEMIES) this.addUnit(u.type, u.c, u.r)

    const bunker = this.getBunker()
    if (bunker) this.stats.bunkerMax = bunker.maxHp
    this.stats.enemiesSpawned = this.units.filter(u => u.side === 'nva').length
    this.emit({ type: 'reset', seed })
    return this
  }

  start() {
    if (this.phase !== 'briefing') return
    this.started = true
    this.phase = 'player'
    this.log('Two VC cells are probing Ban Doc village.', 'warning')
    this.log('Hold Firebase Raven and its command bunker until the relief column arrives.', 'objective')
    this.log('105mm battery and UH-1B gunships are on call. Command points available.', 'system')
    this.emit({ type: 'turnStart', turn: this.turn, first: true })
    this.emit({ type: 'phase', phase: this.phase, turn: this.turn })
    return this
  }

  addUnit(type, c, r) {
    const def = UNIT_TYPES[type]
    if (!def) throw new Error(`Unknown unit type: ${type}`)
    const side = def.side
    let name = def.name
    let label = def.callsign
    if (side === 'nva') {
      this.nameCount[type] = (this.nameCount[type] || 0) + 1
      const n = this.nameCount[type]
      name = `${def.name} ${UNIT_ROMAN[n - 1] || n}`
      label = `${def.callsign} ${UNIT_ROMAN[n - 1] || n}`
    }
    const unit = {
      id: `u${this.nextId++}`,
      type,
      side,
      name,
      label: label || def.callsign,
      role: def.role,
      icon: def.icon,
      weapon: def.weapon,
      maxHp: def.hp,
      hp: def.hp,
      soft: def.soft,
      armorAtk: def.armorAtk,
      range: def.range,
      minRange: def.minRange || 0,
      move: def.move,
      armor: def.armor || 0,
      vehicle: !!def.vehicle,
      amphibious: !!def.amphibious,
      immobile: !!def.immobile,
      objective: !!def.objective,
      cannotAct: !!def.cannotAct,
      suppression: !!def.suppression,
      indirect: !!def.indirect,
      splash: def.splash || 0,
      demo: def.demo || 0,
      aura: def.aura || 0,
      antiarmor: !!def.antiarmor,
      blurb: def.blurb,
      c, r,
      alive: true,
      moved: false,
      attacked: false,
      suppressed: false,
      facing: side === 'us' ? 0 : Math.PI,
      lastMove: null,
      spawnedAt: Date.now()
    }
    this.units.push(unit)
    return unit
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getUnit(id) {
    return this.units.find(u => u.id === id) || null
  }

  getBunker() {
    return this.units.find(u => u.objective) || null
  }

  aliveUnits(side = null) {
    return this.units.filter(u => u.alive && (!side || u.side === side))
  }

  playerUnits() {
    return this.aliveUnits('us')
  }

  playerCombatUnits() {
    return this.aliveUnits('us').filter(u => !u.objective)
  }

  enemyUnits() {
    return this.aliveUnits('nva')
  }

  readyUnits() {
    return this.phase === 'player'
      ? this.playerCombatUnits().filter(u => !u.attacked)
      : []
  }

  occupied(c, r, exceptId = null) {
    return this.units.find(u => u.alive && u.c === c && u.r === r && u.id !== exceptId) || null
  }

  terrain(unit) {
    return terrainAt(unit.c, unit.r)
  }

  coverOf(unit) {
    const t = terrainAt(unit.c, unit.r)
    let cover = t ? t.cover : 0
    if (unit.objective) cover += 1
    return cover
  }

  effectiveMove(unit) {
    return Math.max(0, unit.move - (unit.suppressed ? 1 : 0))
  }

  missionTime(turn = this.turn) {
    const total = 4 * 60 + 40 + (Math.max(1, turn) - 1) * 12
    const h = Math.floor(total / 60) % 24
    const m = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  log(text, kind = 'system') {
    const entry = {
      id: ++this.logId,
      turn: this.turn,
      time: this.missionTime(),
      text,
      kind
    }
    this.logEntries.push(entry)
    if (this.logEntries.length > 100) this.logEntries.shift()
    this.emit({ type: 'log', entry })
    return entry
  }

  // -------------------------------------------------------------------------
  // Movement
  // -------------------------------------------------------------------------

  passableFor(unit, c, r) {
    if (!inBounds(c, r)) return false
    const t = terrainAt(c, r)
    if (!t) return false
    const other = this.occupied(c, r, unit.id)
    if (other) return false
    if (t.impassable) return unit.amphibious && t.water
    return true
  }

  moveCostFor(unit, c, r) {
    const t = terrainAt(c, r)
    if (!t) return Infinity
    if (t.water && unit.amphibious) return 2
    return t.move
  }

  /**
   * Dijkstra over the hex grid. Returns cost and previous-cell maps.
   * The unit's current hex is always reachable at cost 0.
   */
  reachableMap(unit) {
    const maxCost = this.effectiveMove(unit)
    const startKey = keyOf(unit.c, unit.r)
    const costs = new Map([[startKey, 0]])
    const prev = new Map()
    if (maxCost <= 0) return { costs, prev, maxCost }

    const open = [{ c: unit.c, r: unit.r, cost: 0 }]
    while (open.length) {
      open.sort((a, b) => a.cost - b.cost)
      const current = open.shift()
      const currentKey = keyOf(current.c, current.r)
      if (current.cost > (costs.get(currentKey) ?? Infinity)) continue
      for (const n of neighborsOf(current.c, current.r)) {
        if (!this.passableFor(unit, n.c, n.r)) continue
        const step = this.moveCostFor(unit, n.c, n.r)
        const total = current.cost + step
        if (total > maxCost) continue
        const nKey = keyOf(n.c, n.r)
        if (total < (costs.get(nKey) ?? Infinity)) {
          costs.set(nKey, total)
          prev.set(nKey, currentKey)
          open.push({ c: n.c, r: n.r, cost: total })
        }
      }
    }
    return { costs, prev, maxCost }
  }

  pathFromMap(unit, c, r, prev) {
    const startKey = keyOf(unit.c, unit.r)
    const endKey = keyOf(c, r)
    if (endKey === startKey) return [{ c: unit.c, r: unit.r }]
    if (!prev.has(endKey)) return null
    const path = []
    let k = endKey
    let guard = 0
    while (k && guard++ < 200) {
      const [pc, pr] = k.split(',').map(Number)
      path.push({ c: pc, r: pr })
      if (k === startKey) break
      k = prev.get(k)
    }
    if (path[path.length - 1]?.c !== unit.c) return null
    return path.reverse()
  }

  canMoveTo(unit, c, r) {
    if (!unit || !unit.alive || unit.immobile || unit.cannotAct) return false
    const { costs } = this.reachableMap(unit)
    return costs.has(keyOf(c, r))
  }

  async movePlayerUnit(unitId, c, r) {
    const unit = this.getUnit(unitId)
    if (!unit || unit.side !== 'us' || !unit.alive) return false
    if (this.phase !== 'player' || unit.moved || unit.attacked || unit.cannotAct) return false
    const { costs, prev } = this.reachableMap(unit)
    if (!costs.has(keyOf(c, r))) return false
    const path = this.pathFromMap(unit, c, r, prev)
    if (!path || path.length < 2) return false
    await this.animateMove(unit, path)
    unit.moved = true
    unit.attacked = false
    this.emit({ type: 'state' })
    return true
  }

  async animateMove(unit, path) {
    const from = { c: unit.c, r: unit.r }
    const next = path[path.length - 1]
    const duration = 150 + path.length * 90
    unit.c = next.c
    unit.r = next.r
    const p0 = path.length > 1 ? path[path.length - 2] : path[0]
    const a = hexToPixel(p0.c, p0.r)
    const b = hexToPixel(next.c, next.r)
    unit.facing = Math.atan2(b.y - a.y, b.x - a.x)
    unit.lastMove = { path: path.map(p => ({ ...p })), start: Date.now(), duration }
    this.emit({ type: 'move', unitId: unit.id, side: unit.side, from, to: { c: next.c, r: next.r }, path, duration })
    await this.delay(duration)
  }

  // -------------------------------------------------------------------------
  // Combat
  // -------------------------------------------------------------------------

  inAttackRange(attacker, target) {
    if (!attacker || !target || !attacker.alive || !target.alive) return false
    if (attacker.cannotAct || attacker.range <= 0) return false
    const d = hexDistance(attacker, target)
    return d <= attacker.range && d >= (attacker.minRange || 0)
  }

  auraBonus(attacker) {
    if (attacker.side !== 'nva') return 0
    return this.aliveUnits('nva').some(u => u !== attacker && u.aura > 0 && hexDistance(u, attacker) <= u.aura) ? 1 : 0
  }

  damageProfile(attacker, defender, { indirect = false, base = null, randomize = true } = {}) {
    let value = base
    if (value == null) value = defender.armor > 0 ? attacker.armorAtk : attacker.soft
    if (attacker && attacker.suppressed) value -= 2
    value += this.auraBonus(attacker)
    if (attacker?.demo && defender.objective) value += attacker.demo
    let cover = this.coverOf(defender)
    if (indirect) cover *= 0.5
    const armor = defender.armor || 0
    const variance = randomize ? 0.9 + this.rand() * 0.2 : 1
    const raw = value * variance - cover * 0.7 - armor * 0.6
    return {
      damage: Math.max(1, Math.round(raw)),
      base: value,
      cover,
      armor,
      indirect
    }
  }

  estimateDamage(attacker, defender) {
    if (!attacker) return 0
    return this.damageProfile(attacker, defender, { indirect: attacker.indirect, randomize: false }).damage
  }

  targetsInRange(unit) {
    const foes = unit.side === 'us' ? this.enemyUnits() : this.playerUnits()
    return foes.filter(t => this.inAttackRange(unit, t))
  }

  async attack(attackerId, defenderId, { silent = false } = {}) {
    const attacker = this.getUnit(attackerId)
    const defender = this.getUnit(defenderId)
    if (!attacker || !defender) return false
    if (this.phase !== 'player' || attacker.side !== 'us') return false
    if (attacker.attacked || attacker.cannotAct) return false
    if (!this.inAttackRange(attacker, defender)) return false

    attacker.attacked = true
    attacker.moved = true
    this.faceToward(attacker, defender)
    const profile = this.damageProfile(attacker, defender, { indirect: attacker.indirect })
    const splash = []

    if (attacker.splash) {
      const neighbors = this.enemyUnits().filter(u =>
        u.id !== defender.id && hexDistance(u, defender) === 1
      )
      for (const u of neighbors) {
        const sp = this.damageProfile(attacker, u, { base: attacker.splash, randomize: true })
        splash.push({ unitId: u.id, damage: sp.damage, name: u.name, side: u.side })
      }
    }

    const result = this.applyDamage(defender, profile.damage, attacker)
    const suppressed = attacker.suppression && defender.alive
    if (suppressed) defender.suppressed = true

    for (const s of splash) {
      const target = this.getUnit(s.unitId)
      if (target && target.alive) this.applyDamage(target, s.damage, attacker)
    }

    this.stats.shots += 1
    this.faceToward(attacker, defender)

    this.emit({
      type: 'attack', attackerId, defenderId,
      from: { c: attacker.c, r: attacker.r },
      to: { c: defender.c, r: defender.r },
      damage: profile.damage,
      killed: result.killed,
      suppressed,
      indirect: !!attacker.indirect,
      splash,
      weapon: attacker.weapon,
      attackerName: attacker.name,
      attackerSide: attacker.side,
      defenderName: defender.name,
      defenderSide: defender.side,
      profile
    })

    if (!silent) {
      const verb = attacker.indirect ? 'shells' : 'fires on'
      let line = `${attacker.label} ${verb} ${defender.name} — ${profile.damage} damage`
      if (result.killed) line += `, target destroyed`
      else if (suppressed) line += `, target pinned`
      this.log(line + '.', result.killed ? 'kill' : attacker.side === 'us' ? 'us' : 'enemy')
      if (splash.length) {
        const total = splash.reduce((n, s) => n + s.damage, 0)
        this.log(`M79 splash wounds ${splash.length} nearby ${splash.length === 1 ? 'unit' : 'units'} (${total} damage).`, 'us')
      }
    }

    await this.delay(460)
    this.checkOver()
    this.emit({ type: 'state' })
    return true
  }

  faceToward(a, b) {
    const pa = hexToPixel(a.c, a.r)
    const pb = hexToPixel(b.c, b.r)
    a.facing = Math.atan2(pb.y - pa.y, pb.x - pa.x)
  }

  applyDamage(target, damage, source = null) {
    if (!target || !target.alive) return { killed: false, damage: 0 }
    const dealt = Math.min(target.hp, Math.max(0, damage))
    target.hp = Math.max(0, target.hp - damage)
    if (target.side === 'us') this.stats.damageTaken += dealt
    else this.stats.damageDealt += dealt
    let killed = false
    if (target.hp <= 0) {
      target.alive = false
      target.hp = 0
      killed = true
      if (target.side === 'nva') {
        this.stats.kills += 1
        this.log(`${target.name} destroyed.`, 'kill')
      } else if (!target.objective) {
        this.stats.losses += 1
        this.stats.playerUnitsLost += 1
        this.log(`${target.name} is combat ineffective.`, 'loss')
      } else {
        this.log('The command bunker has been breached.', 'loss')
      }
      this.emit({ type: 'death', unitId: target.id, side: target.side, c: target.c, r: target.r, name: target.name, objective: target.objective })
    }
    return { killed, damage: dealt }
  }

  // -------------------------------------------------------------------------
  // Player turn / enemy turn
  // -------------------------------------------------------------------------

  async endPlayerTurn() {
    if (this.phase !== 'player') return false
    this.phase = 'enemy'
    this.activeEnemyId = null
    for (const u of this.aliveUnits('us')) u.suppressed = false
    for (const u of this.aliveUnits('nva')) {
      u.moved = false
      u.attacked = false
    }
    this.emit({ type: 'phase', phase: this.phase, turn: this.turn })
    this.log('ENEMY MOVEMENT PHASE.', 'phase')
    await this.delay(320)

    const enemies = this.aliveUnits('nva')
    for (const enemy of enemies) {
      if (!enemy.alive || this.phase !== 'enemy') break
      await this.enemyAct(enemy)
      if (this.phase === 'over') return true
      await this.delay(150)
    }

    if (this.phase === 'over') return true
    for (const u of this.aliveUnits('nva')) u.suppressed = false
    this.activeEnemyId = null

    if (this.turn >= MAX_TURNS) {
      this.finish('victory', 'The relief column reached Firebase Raven at first light.')
      return true
    }

    this.turn += 1
    this.startPlayerTurn()
    return true
  }

  startPlayerTurn() {
    if (this.phase === 'over') return
    this.phase = 'player'
    this.cp = Math.min(this.maxCp, this.cp + 2)
    for (const u of this.aliveUnits('us')) {
      u.moved = false
      u.attacked = false
    }
    for (const u of this.aliveUnits('nva')) u.suppressed = false

    const spawned = this.spawnWave(this.turn)
    this.log(`TURN ${this.turn} — ${this.missionTime()}. ${this.turn === MAX_TURNS ? 'Relief column is minutes away.' : 'Hold the perimeter.'}`, 'phase')
    if (spawned.length) {
      const counts = {}
      for (const s of spawned) counts[s.name] = (counts[s.name] || 0) + 1
      const summary = Object.entries(counts).map(([n, count]) => `${count}× ${n}`).join(', ')
      this.log(`Enemy reinforcements entering the valley: ${summary}.`, 'warning')
    }
    if (this.turn === MAX_TURNS) this.log(FLAVOR.relief[Math.floor(this.rand() * FLAVOR.relief.length)], 'objective')

    this.emit({ type: 'turnStart', turn: this.turn, spawned, cp: this.cp })
    this.emit({ type: 'phase', phase: this.phase, turn: this.turn })
    this.emit({ type: 'state' })
  }

  spawnWave(turn) {
    const wave = WAVES[turn] || []
    const spawned = []
    for (const spec of wave) {
      const cell = this.findSpawnCell(spec.c, spec.r, spec.type)
      if (!cell) {
        this.log('Enemy reinforcements are delayed by artillery interdiction.', 'warning')
        continue
      }
      const unit = this.addUnit(spec.type, cell.c, cell.r)
      unit.spawnedAt = Date.now()
      this.stats.enemiesSpawned += 1
      spawned.push(unit)
      this.emit({ type: 'spawn', unitId: unit.id, c: cell.c, r: cell.r, side: 'nva', name: unit.name })
    }
    return spawned
  }

  findSpawnCell(c, r, type) {
    const def = UNIT_TYPES[type]
    const probe = {
      side: 'nva',
      amphibious: !!def.amphibious,
      id: 'spawn-probe'
    }
    const free = (cc, rr) => {
      if (!inBounds(cc, rr)) return false
      if (this.occupied(cc, rr)) return false
      const t = terrainAt(cc, rr)
      if (!t) return false
      if (t.impassable && !probe.amphibious) return false
      return true
    }
    if (free(c, r)) return { c, r }
    const seen = new Set([keyOf(c, r)])
    let frontier = [{ c, r }]
    for (let ring = 0; ring < 5; ring++) {
      const next = []
      for (const cell of frontier) {
        for (const n of neighborsOf(cell.c, cell.r)) {
          const k = keyOf(n.c, n.r)
          if (seen.has(k)) continue
          seen.add(k)
          if (free(n.c, n.r)) return n
          next.push(n)
        }
      }
      frontier = next
    }
    // Last resort: scan the eastern / northern edges.
    const candidates = []
    for (let rr = 0; rr < ROWS; rr++) candidates.push({ c: COLS - 1, r: rr })
    for (let cc = 0; cc < COLS; cc++) candidates.push({ c: cc, r: 0 })
    return shuffle(candidates, this.rand).find(p => free(p.c, p.r)) || null
  }

  async enemyAct(enemy) {
    if (!enemy.alive) return
    this.activeEnemyId = enemy.id
    this.emit({ type: 'enemyActive', unitId: enemy.id })
    await this.delay(130)

    let target = this.chooseTarget(enemy)
    if (!target) {
      this.activeEnemyId = null
      return
    }

    // Fire from the current position when possible.
    if (this.inAttackRange(enemy, target)) {
      const best = this.pickAttackTarget(enemy, this.targetsInRange(enemy))
      if (best) await this.enemyAttack(enemy, best)
    } else {
      const destination = this.chooseDestination(enemy, target)
      if (destination && (destination.c !== enemy.c || destination.r !== enemy.r)) {
        const { prev } = this.reachableMap(enemy)
        const path = this.pathFromMap(enemy, destination.c, destination.r, prev)
        if (path && path.length > 1) await this.animateMove(enemy, path)
      }
      const inRange = this.targetsInRange(enemy)
      if (inRange.length) {
        const best = this.pickAttackTarget(enemy, inRange)
        if (best) await this.enemyAttack(enemy, best)
      }
    }

    enemy.suppressed = false
    this.activeEnemyId = null
    this.emit({ type: 'enemyActive', unitId: null })
  }

  async enemyAttack(enemy, target) {
    this.faceToward(enemy, target)
    const profile = this.damageProfile(enemy, target, { indirect: enemy.indirect })
    const result = this.applyDamage(target, profile.damage, enemy)
    const suppressed = enemy.suppression && target.alive
    if (suppressed) target.suppressed = true

    this.emit({
      type: 'attack',
      attackerId: enemy.id,
      defenderId: target.id,
      from: { c: enemy.c, r: enemy.r },
      to: { c: target.c, r: target.r },
      damage: profile.damage,
      killed: result.killed,
      suppressed,
      indirect: !!enemy.indirect,
      splash: [],
      weapon: enemy.weapon,
      attackerName: enemy.name,
      attackerSide: enemy.side,
      defenderName: target.name,
      defenderSide: target.side,
      profile
    })

    let line = `${enemy.label} ${enemy.indirect ? 'shells' : 'fires on'} ${target.name} — ${profile.damage} damage`
    if (result.killed) line += ', target destroyed'
    else if (suppressed) line += ', target pinned'
    this.log(line + '.', result.killed ? 'loss' : 'enemy')

    await this.delay(430)
    this.checkOver()
    this.emit({ type: 'state' })
  }

  chooseTarget(enemy) {
    const us = this.aliveUnits('us')
    if (!us.length) return null
    const vehicles = us.filter(u => u.vehicle)
    let pool = us
    if (enemy.antiarmor && vehicles.length) pool = vehicles

    const bunker = this.getBunker()
    const scored = pool.map(u => {
      let score = hexDistance(enemy, u)
      if (u.objective) score -= enemy.role === 'sapper' ? 2.2 : 1.1
      if (enemy.role === 'mortar') score -= 0.8
      if (enemy.antiarmor && u.vehicle) score -= 1.5
      if (u.hp <= 3) score -= 0.7
      if (u.suppressed) score -= 0.2
      score += this.rand() * 0.35
      return { u, score }
    }).sort((a, b) => a.score - b.score)

    // Sappers make a deliberate run at the command bunker when it is close.
    if (bunker && bunker.alive && enemy.role === 'sapper' && hexDistance(enemy, bunker) <= 4) return bunker
    return scored[0]?.u || null
  }

  chooseDestination(enemy, target) {
    const { costs, prev } = this.reachableMap(enemy)
    let best = { c: enemy.c, r: enemy.r }
    let bestScore = -Infinity
    for (const key of costs.keys()) {
      const [c, r] = key.split(',').map(Number)
      const cell = { c, r }
      if (this.occupied(c, r, enemy.id)) continue
      const d = hexDistance(cell, target)
      const t = terrainAt(c, r)
      let score = 0
      const inRange = d <= enemy.range && d >= (enemy.minRange || 0)
      if (inRange) score += 140
      score -= d * 7
      score += (t?.cover || 0) * 3.4
      if (t?.water && !enemy.amphibious) score -= 100
      if (enemy.role === 'mortar') {
        if (d < (enemy.minRange || 2)) score -= 80
        if (d >= 3 && d <= 4) score += 10
        if (d > 5) score -= 6
      }
      if (enemy.role === 'sapper') {
        const bunker = this.getBunker()
        if (bunker) score -= hexDistance(cell, bunker) * 1.2
      }
      // Avoid standing directly in the open beside several rifles.
      const adjacentThreats = this.aliveUnits('us').filter(u => hexDistance(u, cell) === 1).length
      score -= adjacentThreats * 1.6
      score += this.rand() * 0.4
      if (score > bestScore) {
        bestScore = score
        best = cell
      }
    }
    void prev
    return best
  }

  pickAttackTarget(enemy, targets) {
    if (!targets.length) return null
    const ranked = targets.map(t => {
      const estimated = this.estimateDamage(enemy, t)
      let score = estimated
      if (t.hp <= estimated) score += 7
      if (t.objective) score += 3
      if (enemy.antiarmor && t.vehicle) score += 4
      if (t.vehicle && !enemy.antiarmor) score += estimated > 4 ? 1 : -1
      return { t, score }
    }).sort((a, b) => b.score - a.score)
    return ranked[0].t
  }

  // -------------------------------------------------------------------------
  // Support missions
  // -------------------------------------------------------------------------

  supportAvailable(kind) {
    const def = SUPPORTS[kind]
    if (!def) return false
    return this.phase === 'player' && this.cp >= def.cost && this.supportCharges[kind] > 0
  }

  supportUnitsInRadius(c, r, radius = 1) {
    return this.aliveUnits().filter(u => hexDistance(u, { c, r }) <= radius)
  }

  supportDamage(unit, base, { randomize = true } = {}) {
    const cover = this.coverOf(unit) * 0.5
    const armor = unit.armor || 0
    const variance = randomize ? 0.92 + this.rand() * 0.16 : 1
    return Math.max(1, Math.round(base * variance - cover * 0.7 - armor * 0.5))
  }

  previewSupport(kind, c, r) {
    if (!SUPPORTS[kind] || !inBounds(c, r)) return []
    if (kind === 'dustoff') {
      const u = this.occupied(c, r)
      if (!u || u.side !== 'us') return []
      return [{ unitId: u.id, name: u.name, side: u.side, damage: 0, heal: Math.min(7, u.maxHp - u.hp), primary: true }]
    }
    const radius = 1
    return this.supportUnitsInRadius(c, r, radius).map(u => {
      const d = hexDistance(u, { c, r })
      // Friendly units caught by 105mm take the same flat danger-close damage
      // that callArtillery applies, not the hostile damage formula.
      const friendly = u.side === 'us' && !u.objective
      const base = kind === 'artillery' ? (d === 0 ? 9 : 5) : 5
      const damage = friendly
        ? (kind === 'artillery' ? (d === 0 ? 3 : 2) : 0)
        : this.supportDamage(u, base, { randomize: false })
      return {
        unitId: u.id,
        name: u.name,
        side: u.side,
        damage,
        killed: damage >= u.hp,
        primary: d === 0,
        friendly
      }
    })
  }

  async callArtillery(c, r) {
    if (!this.supportAvailable('artillery') || !inBounds(c, r)) return false
    this.cp -= SUPPORTS.artillery.cost
    this.supportCharges.artillery -= 1
    this.stats.supportUses += 1
    const hits = []
    const friendlies = []
    for (const u of this.aliveUnits()) {
      const d = hexDistance(u, { c, r })
      if (d > 1) continue
      if (u.side === 'nva') {
        const base = d === 0 ? 9 : 5
        const damage = this.supportDamage(u, base)
        const res = this.applyDamage(u, damage, null)
        if (u.alive) u.suppressed = true
        hits.push({ unitId: u.id, name: u.name, side: u.side, damage, killed: res.killed, primary: d === 0 })
      } else if (!u.objective) {
        const damage = d === 0 ? 3 : 2
        const res = this.applyDamage(u, damage, null)
        if (u.alive) u.suppressed = true
        friendlies.push({ unitId: u.id, name: u.name, side: u.side, damage, killed: res.killed, primary: d === 0, friendly: true })
      }
    }
    this.faceMissionTarget(c, r)
    this.emit({
      type: 'support', kind: 'artillery', c, r, radius: 1,
      hits, friendlies, cp: this.cp, charges: this.supportCharges.artillery
    })
    const enemyCount = hits.length
    this.log(`105mm fire mission on ${coordLabel(c, r)}. ${enemyCount ? `${enemyCount} enemy ${enemyCount === 1 ? 'element' : 'elements'} hit` : 'Rounds land on empty ground'}.`, 'support')
    if (friendlies.length) this.log(`Danger close — ${friendlies.length} friendly ${friendlies.length === 1 ? 'unit was' : 'units were'} caught in the blast.`, 'warning')
    await this.delay(950)
    this.checkOver()
    this.emit({ type: 'state' })
    return true
  }

  faceMissionTarget(c, r) {
    for (const u of this.playerCombatUnits()) {
      if (hexDistance(u, { c, r }) <= 2) {
        const pa = hexToPixel(u.c, u.r)
        const pb = hexToPixel(c, r)
        u.facing = Math.atan2(pb.y - pa.y, pb.x - pa.x)
      }
    }
  }

  async callHuey(c, r) {
    if (!this.supportAvailable('huey') || !inBounds(c, r)) return false
    this.cp -= SUPPORTS.huey.cost
    this.supportCharges.huey -= 1
    this.stats.supportUses += 1
    const hits = []
    for (const u of this.aliveUnits('nva')) {
      const d = hexDistance(u, { c, r })
      if (d > 1) continue
      const base = d === 0 ? 6 : 4
      const damage = this.supportDamage(u, base)
      const res = this.applyDamage(u, damage, null)
      if (u.alive) u.suppressed = true
      hits.push({ unitId: u.id, name: u.name, side: u.side, damage, killed: res.killed, primary: d === 0 })
    }
    this.faceMissionTarget(c, r)
    this.emit({
      type: 'support', kind: 'huey', c, r, radius: 1,
      hits, friendlies: [], cp: this.cp, charges: this.supportCharges.huey
    })
    this.log(`UH-1B gunship strafes ${coordLabel(c, r)}. ${hits.length ? `${hits.length} enemy ${hits.length === 1 ? 'element' : 'elements'} hit` : 'No targets in the run'}.`, 'support')
    await this.delay(1250)
    this.checkOver()
    this.emit({ type: 'state' })
    return true
  }

  async callDustoff(unitId) {
    if (!this.supportAvailable('dustoff')) return false
    const unit = this.getUnit(unitId)
    if (!unit || unit.side !== 'us' || !unit.alive || unit.objective) return false
    this.cp -= SUPPORTS.dustoff.cost
    this.supportCharges.dustoff -= 1
    this.stats.supportUses += 1
    const before = unit.hp
    unit.hp = Math.min(unit.maxHp, unit.hp + 7)
    unit.suppressed = false
    const healed = unit.hp - before
    this.emit({
      type: 'support', kind: 'dustoff', unitId, c: unit.c, r: unit.r,
      hits: [], friendlies: [], heal: healed, cp: this.cp, charges: this.supportCharges.dustoff
    })
    this.log(`Dustoff medevac reaches ${unit.label}. ${healed > 0 ? `+${healed} HP restored` : 'Crew is stable'}.`, 'support')
    await this.delay(800)
    this.emit({ type: 'state' })
    return true
  }

  // -------------------------------------------------------------------------
  // End conditions / scoring
  // -------------------------------------------------------------------------

  checkOver() {
    if (this.phase === 'over') return true
    const bunker = this.getBunker()
    if (!bunker || !bunker.alive) {
      this.finish('defeat', 'The command bunker was overrun. Firebase Raven has fallen.')
      return true
    }
    if (!this.playerCombatUnits().length) {
      this.finish('defeat', 'The platoon has been destroyed. Firebase Raven has fallen.')
      return true
    }
    return false
  }

  finish(result, reason) {
    if (this.phase === 'over') return
    this.phase = 'over'
    this.result = result
    const bunker = this.getBunker()
    const bunkerHp = bunker?.alive ? bunker.hp : 0
    const turns = this.turn
    const timeBonus = result === 'victory' ? Math.max(0, MAX_TURNS - turns) * 25 : 0
    const score = Math.max(0, Math.round(
      900 +
      this.stats.kills * 110 +
      bunkerHp * 28 -
      this.stats.losses * 130 +
      this.cp * 8 +
      (result === 'victory' ? 650 : 0) +
      timeBonus
    ))
    const grade = result === 'defeat'
      ? 'F'
      : score >= 3400 ? 'S' : score >= 2850 ? 'A' : score >= 2300 ? 'B' : score >= 1750 ? 'C' : 'D'
    this.score = score
    this.grade = grade
    this.log(
      result === 'victory' ? 'RELIEF COLUMN ARRIVES. Firebase Raven holds.' : reason,
      result === 'victory' ? 'objective' : 'loss'
    )
    this.emit({
      type: 'gameOver',
      result,
      reason,
      score,
      grade,
      turn: turns,
      stats: { ...this.stats, bunkerHp, turns },
      cp: this.cp
    })
  }

  nextWave(turn = this.turn) {
    if (turn >= MAX_TURNS) return []
    return WAVES[turn + 1] || []
  }

  waveSummary(wave) {
    if (!wave.length) return 'No further movement detected'
    const counts = {}
    for (const spec of wave) {
      const def = UNIT_TYPES[spec.type]
      const key = def.callsign
      counts[key] = (counts[key] || 0) + 1
    }
    return Object.entries(counts).map(([k, n]) => `${n}× ${k}`).join(' · ')
  }

  serialize() {
    const bunker = this.getBunker()
    return {
      turn: this.turn,
      phase: this.phase,
      cp: this.cp,
      score: this.score,
      grade: this.grade,
      result: this.result,
      bunkerHp: bunker?.hp ?? 0,
      supportCharges: { ...this.supportCharges },
      stats: { ...this.stats },
      units: this.units.map(u => ({
        id: u.id, type: u.type, side: u.side, name: u.name,
        c: u.c, r: u.r, hp: u.hp, maxHp: u.maxHp, alive: u.alive,
        moved: u.moved, attacked: u.attacked, suppressed: u.suppressed
      }))
    }
  }
}

export { TERRAIN, isBaseCell, terrainAt, terrainKeyAt }
