import { Game, terrainAt, coordLabel } from './engine.js'
import { MAX_TURNS, SUPPORTS, UNIT_TYPES, PLAYER_ORDER, TERRAIN } from './data.js'
import { Renderer } from './render.js'
import { portraitDataURL } from './render-utils.js'
import { AudioSystem } from './audio.js'

const $ = id => document.getElementById(id)
const ui = {
  selectedId: null,
  hover: null,
  mode: null,
  busy: false,
  started: false
}
const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches || false
let game = null
let renderer = null
let audio = null
let activeToastTimer = null
let bannerTimer = null

function loadSetting(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value == null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

function saveSetting(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage can be unavailable */ }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const BEST_KEY = 'firebase-raven-best'

// ---------------------------------------------------------------------------
// Engine event routing
// ---------------------------------------------------------------------------

function handleEvent(event) {
  if (!game) return
  if (renderer) renderer.handleEvent(event)
  const sound = audio
  if (sound) {
    if (event.type === 'attack') {
      const w = event.weapon || ''
      if (/M60|M2/.test(w)) sound.shot('mg')
      else if (/90mm|76\.2/.test(w)) sound.shot('cannon')
      else if (/mortar/i.test(w)) sound.shot('mortar')
      else if (/RPG/.test(w)) sound.shot('rpg')
      else sound.shot('rifle')
      if (event.killed) sound.explosion(false)
    } else if (event.type === 'death') {
      sound.explosion(false)
    } else if (event.type === 'support') {
      if (event.kind === 'artillery') sound.explosion(true)
      else if (event.kind === 'huey') { sound.helicopter(); setTimeout(() => sound.explosion(true), 380) }
      else if (event.kind === 'dustoff') sound.heal()
    } else if (event.type === 'spawn') {
      sound.warning()
    } else if (event.type === 'turnStart' && !event.first) {
      sound.turn()
    } else if (event.type === 'gameOver') {
      if (event.result === 'victory') sound.victory()
      else sound.defeat()
    }
  }

  if (event.type === 'turnStart') {
    if (!event.first && ui.started) showTurnBanner(event.turn, event.spawned?.length ? 'ENEMY REINFORCEMENTS INBOUND' : 'HOLD THE PERIMETER')
  }
  if (event.type === 'phase' && event.phase === 'enemy' && ui.started) {
    showPhaseBanner()
  }
  if (event.type === 'death' && ui.selectedId === event.unitId) ui.selectedId = null
  if (event.type === 'gameOver') {
    setTimeout(() => showResult(event), 950)
  }
  if (event.type === 'state' || event.type === 'phase' || event.type === 'turnStart' || event.type === 'log' || event.type === 'spawn' || event.type === 'gameOver') {
    syncUI()
  }
}

function setupGame(seed = Date.now()) {
  game = new Game({ seed, onEvent: handleEvent })
  game.setDelay(ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 1400))))
  ui.selectedId = null
  ui.hover = null
  ui.mode = null
  ui.busy = false
  if (renderer) renderer.setGame(game)
  syncUI()
}

// ---------------------------------------------------------------------------
// UI sync
// ---------------------------------------------------------------------------

const PHASE_LABEL = {
  briefing: 'BRIEFING',
  player: 'PLAYER',
  enemy: 'ENEMY',
  over: 'COMPLETE'
}

function syncUI() {
  if (!game) return
  const bunker = game.getBunker()
  const bunkerHp = bunker?.alive ? bunker.hp : 0
  const bunkerMax = bunker?.maxHp || 18
  $('hud-turn').innerHTML = `${String(game.turn).padStart(2, '0')}<span>/${MAX_TURNS}</span>`
  $('hud-phase').textContent = PHASE_LABEL[game.phase] || game.phase.toUpperCase()
  $('hud-phase').className = `phase-${game.phase}`
  $('hud-cp').textContent = `${game.cp} CP`
  $('hud-bunker').textContent = `${bunkerHp}/${bunkerMax}`
  $('hud-bunker').className = bunkerHp <= 5 ? 'critical' : bunkerHp <= 10 ? 'warn' : ''

  const turnsLeft = Math.max(0, MAX_TURNS - game.turn + (game.phase === 'over' ? 0 : 1))
  $('objective-sub').textContent = game.phase === 'over'
    ? (game.result === 'victory' ? 'Firebase held until relief' : 'Firebase lost')
    : turnsLeft <= 1 ? 'Relief column is at the wire' : `Relief arrives in ${turnsLeft} turns`
  $('relief-turns').textContent = game.phase === 'over'
    ? (game.result === 'victory' ? 'ARRIVED' : 'FAILED')
    : `${turnsLeft} ${turnsLeft === 1 ? 'TURN' : 'TURNS'}`
  $('bunker-status').textContent = bunkerHp <= 0 ? 'DESTROYED' : bunkerHp <= 5 ? 'CRITICAL' : bunkerHp <= 10 ? 'DAMAGED' : 'NOMINAL'
  $('bunker-status').className = bunkerHp <= 5 ? 'critical' : bunkerHp <= 10 ? 'warn' : ''
  $('mission-progress-fill').style.width = `${Math.max(0, Math.min(100, (bunkerHp / bunkerMax) * 100))}%`
  $('stat-kills').textContent = game.stats.kills
  $('stat-losses').textContent = game.stats.losses
  $('log-count').textContent = String(game.logEntries.length).padStart(2, '0')
  $('cp-value').textContent = game.cp
  renderCpPips()

  renderRoster()
  renderUnitStrip()
  renderSelection()
  renderSupportButtons()
  renderLog()
  renderWaveIntel()
  renderEndTurn()
  document.body.classList.toggle('is-busy', !!ui.busy)
}

function renderCpPips() {
  const wrap = $('cp-pips')
  if (!wrap) return
  const pips = []
  for (let i = 0; i < 10; i++) pips.push(`<i class="${i < game.cp ? 'on' : ''}"></i>`)
  wrap.innerHTML = pips.join('')
}

function statusFor(unit) {
  if (!unit.alive) return { text: 'DESTROYED', cls: 'dead' }
  if (unit.objective) return { text: unit.hp <= 5 ? 'CRITICAL' : 'OBJECTIVE', cls: unit.hp <= 5 ? 'critical' : 'objective' }
  if (unit.attacked) return { text: 'SPENT', cls: 'spent' }
  if (unit.moved) return { text: 'MOVED', cls: 'moved' }
  if (unit.suppressed) return { text: 'PINNED', cls: 'pinned' }
  return { text: 'READY', cls: 'ready' }
}

function renderRoster() {
  const list = $('unit-list')
  if (!list) return
  const units = PLAYER_ORDER
    .map(type => game.units.find(u => u.side === 'us' && u.type === type && u.alive) || game.units.find(u => u.side === 'us' && u.type === type))
    .filter(Boolean)
  list.innerHTML = units.map(unit => {
    const status = statusFor(unit)
    const selected = ui.selectedId === unit.id
    const hp = Math.max(0, unit.hp)
    const pct = Math.round((hp / unit.maxHp) * 100)
    return `
      <button class="unit-card ${selected ? 'selected' : ''} ${status.cls} ${unit.objective ? 'objective' : ''}" data-unit-id="${unit.id}" ${unit.alive ? '' : 'disabled'} aria-pressed="${selected}" title="${escapeHtml(unit.name)} — ${escapeHtml(unit.weapon)}">
        <img class="uc-portrait" src="${portraitDataURL(unit.type, 'us')}" alt="" draggable="false">
        <span class="uc-main">
          <span class="uc-top"><strong>${escapeHtml(unit.label)}</strong><em class="state-pill ${status.cls}">${status.text}</em></span>
          <span class="uc-weapon">${escapeHtml(unit.weapon)}</span>
          <span class="uc-hp-track"><i style="width:${pct}%"></i></span>
          <span class="uc-meta"><span>${hp}/${unit.maxHp} HP</span><span>${unit.armor ? `ARM ${unit.armor}` : `MOVE ${unit.move}`} · RNG ${unit.range || '—'}</span></span>
        </span>
      </button>`
  }).join('')
}

function renderUnitStrip() {
  const strip = $('unit-strip')
  if (!strip) return
  const units = game.aliveUnits('us').filter(u => !u.objective)
  strip.innerHTML = units.map(unit => {
    const selected = ui.selectedId === unit.id
    const pct = Math.round((unit.hp / unit.maxHp) * 100)
    const status = statusFor(unit)
    return `<button class="strip-unit ${selected ? 'selected' : ''} ${status.cls}" data-unit-id="${unit.id}" aria-pressed="${selected}" aria-label="${escapeHtml(unit.name)}, ${unit.hp} of ${unit.maxHp} HP">
      <img src="${portraitDataURL(unit.type, 'us')}" alt="" draggable="false">
      <span class="strip-hp"><i style="width:${pct}%"></i></span>
      <b>${escapeHtml(unit.label)}</b>
    </button>`
  }).join('')
}

function selectedUnit() {
  return game.getUnit(ui.selectedId)
}

function renderSelection() {
  const unit = selectedUnit()
  const empty = $('sel-empty')
  const content = $('sel-content')
  if (!unit) {
    empty.classList.remove('hidden')
    content.classList.add('hidden')
    empty.querySelector('p').textContent = game.phase === 'enemy'
      ? 'Enemy movement in progress. Hold the line.'
      : game.phase === 'over'
        ? 'The engagement is over. Redeploy to try another defence.'
        : 'Select a unit on the map or in the order of battle.'
    return
  }
  empty.classList.add('hidden')
  content.classList.remove('hidden')
  const sideLabel = unit.side === 'us' ? (unit.objective ? 'OBJECTIVE' : 'FRIENDLY') : 'ENEMY CONTACT'
  const status = statusFor(unit)
  $('sel-portrait').src = portraitDataURL(unit.type, unit.side)
  $('sel-name').textContent = unit.name
  $('sel-weapon').textContent = `${sideLabel} · ${unit.weapon}`
  const atk = unit.armor ? `${unit.soft}/${unit.armorAtk}` : `${unit.soft} soft`
  $('sel-stats').innerHTML = `
    <span><b>HP</b> ${unit.hp}/${unit.maxHp}</span>
    <span><b>FIRE</b> ${unit.range ? `${atk} · RNG ${unit.range}` : '—'}</span>
    <span><b>MOVE</b> ${unit.move || '—'}</span>
    <span><b>COVER</b> +${game.coverOf(unit)}</span>
    <span class="sel-state ${status.cls}">${status.text}</span>
  `
  $('sel-hpfill').style.width = `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%`
  $('sel-hpfill').className = unit.hp / unit.maxHp <= 0.3 ? 'low' : unit.hp / unit.maxHp <= 0.6 ? 'mid' : ''
  $('sel-hp').textContent = `${unit.hp}/${unit.maxHp}`
  $('selection-card').classList.toggle('enemy-selected', unit.side === 'nva')
}

function renderSupportButtons() {
  for (const kind of Object.keys(SUPPORTS)) {
    const btn = document.querySelector(`[data-support="${kind}"]`)
    if (!btn) continue
    const def = SUPPORTS[kind]
    const charges = game.supportCharges[kind]
    const costEl = btn.querySelector('em')
    if (costEl) costEl.textContent = `${def.cost} CP · ${charges}`
    btn.disabled = !game.supportAvailable(kind) || ui.busy || game.phase !== 'player'
    btn.classList.toggle('active', ui.mode?.kind === kind)
    btn.setAttribute('aria-pressed', ui.mode?.kind === kind ? 'true' : 'false')
    btn.title = def.desc
  }
}

function renderLog() {
  const log = $('log')
  if (!log) return
  const entries = game.logEntries.slice(-45).reverse()
  log.innerHTML = entries.map(entry => `
    <div class="log-entry kind-${entry.kind}">
      <span class="log-meta">T${String(entry.turn).padStart(2, '0')} · ${entry.time}</span>
      <p>${escapeHtml(entry.text)}</p>
    </div>`).join('')
}

function renderWaveIntel() {
  const box = $('next-wave-content')
  if (!box) return
  if (game.phase === 'over') {
    box.innerHTML = `<div class="wave-final">${game.result === 'victory' ? 'RELIEF COLUMN ARRIVED' : 'NO FURTHER CONTACTS'}</div>`
    return
  }
  if (game.turn >= MAX_TURNS) {
    box.innerHTML = `<div class="wave-final victory">RELIEF COLUMN INBOUND<br><span>Hold until end of turn</span></div>`
    return
  }
  const wave = game.nextWave()
  const turn = game.turn + 1
  if (!wave.length) {
    box.innerHTML = `<div class="wave-final"><span>INBOUND T${String(turn).padStart(2, '0')}</span><br>No further movement detected</div>`
    return
  }
  const counts = new Map()
  for (const spec of wave) counts.set(spec.type, (counts.get(spec.type) || 0) + 1)
  const items = [...counts.entries()].map(([type, count]) => {
    const def = UNIT_TYPES[type]
    return `<div class="wave-unit"><img src="${portraitDataURL(type, 'nva')}" alt="" draggable="false"><span><b>${count}× ${escapeHtml(def.callsign)}</b><small>${escapeHtml(def.weapon)}</small></span></div>`
  }).join('')
  box.innerHTML = `<div class="wave-turn">INBOUND T${String(turn).padStart(2, '0')}</div><div class="wave-list">${items}</div>`
}

function renderEndTurn() {
  const btn = $('btn-end-turn')
  if (!btn) return
  const ready = game.readyUnits().length
  if (game.phase === 'player') {
    btn.disabled = ui.busy
    btn.querySelector('.end-turn-label').textContent = 'END TURN'
    $('end-turn-sub').textContent = ready ? `${ready} ${ready === 1 ? 'UNIT' : 'UNITS'} READY` : 'ALL UNITS COMMITTED'
  } else if (game.phase === 'enemy') {
    btn.disabled = true
    btn.querySelector('.end-turn-label').textContent = 'ENEMY PHASE'
    $('end-turn-sub').textContent = 'MOVEMENT IN PROGRESS'
  } else {
    btn.disabled = true
    btn.querySelector('.end-turn-label').textContent = 'OPERATION OVER'
    $('end-turn-sub').textContent = game.result === 'victory' ? 'FIREBASE HELD' : 'FIREBASE LOST'
  }
}

// ---------------------------------------------------------------------------
// Board interactions
// ---------------------------------------------------------------------------

function selectUnit(id, { toggle = true, sound = true } = {}) {
  if (ui.busy) return
  if (toggle && ui.selectedId === id && !ui.mode) {
    ui.selectedId = null
  } else {
    ui.selectedId = id
    ui.mode = null
    hideTargetPrompt()
  }
  if (sound) audio?.select()
  syncUI()
}

function clearSelection() {
  ui.selectedId = null
  ui.mode = null
  hideTargetPrompt()
  syncUI()
}

function startTargetMode(kind) {
  if (ui.busy || game.phase !== 'player') return
  if (!game.supportAvailable(kind)) {
    toast(kind === 'dustoff' ? 'No medevac sorties remaining.' : 'Not enough command points or sorties remaining.', 'warning')
    return
  }
  if (ui.mode?.kind === kind) {
    cancelTargetMode()
    return
  }
  ui.mode = { kind, staged: null }
  ui.selectedId = null
  ui.hover = null
  const text = kind === 'artillery'
    ? 'Select the impact hex · 105mm battery standing by'
    : kind === 'huey'
      ? 'Select the strafe hex · UH-1B gunship on station'
      : 'Select a friendly unit to evacuate'
  $('target-text').textContent = text
  $('target-prompt').classList.remove('hidden')
  document.body.classList.add('targeting')
  audio?.select()
  syncUI()
}

function cancelTargetMode() {
  ui.mode = null
  $('target-prompt').classList.add('hidden')
  document.body.classList.remove('targeting')
  syncUI()
}

function hideTargetPrompt() {
  $('target-prompt').classList.add('hidden')
  document.body.classList.remove('targeting')
}

async function executeSupport(cell, unit) {
  const kind = ui.mode.kind
  if (kind === 'dustoff' && (!unit || unit.side !== 'us' || unit.objective)) {
    toast('Medevac must target a friendly combat unit.', 'warning')
    audio?.warning()
    return
  }
  if (coarsePointer && ui.mode.staged !== `${cell.c},${cell.r}`) {
    ui.mode.staged = `${cell.c},${cell.r}`
    ui.hover = { c: cell.c, r: cell.r }
    $('target-text').textContent = 'Tap the same hex again to confirm'
    syncUI()
    return
  }

  ui.mode = null
  hideTargetPrompt()
  ui.hover = null
  ui.busy = true
  syncUI()
  try {
    if (kind === 'artillery') await game.callArtillery(cell.c, cell.r)
    else if (kind === 'huey') await game.callHuey(cell.c, cell.r)
    else if (kind === 'dustoff') await game.callDustoff(unit.id)
  } finally {
    ui.busy = false
    syncUI()
  }
}

async function doMove(unit, cell) {
  ui.busy = true
  ui.hover = { c: cell.c, r: cell.r }
  syncUI()
  try {
    await game.movePlayerUnit(unit.id, cell.c, cell.r)
  } finally {
    ui.busy = false
    syncUI()
  }
}

async function doAttack(attacker, target) {
  ui.busy = true
  syncUI()
  try {
    await game.attack(attacker.id, target.id)
  } finally {
    ui.busy = false
    syncUI()
  }
}

function onBoardPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (!ui.started || ui.busy) return
  if (document.body.classList.contains('is-busy')) return
  const cell = renderer.pickHex(event.clientX, event.clientY)
  if (!cell) return
  const unit = game.occupied(cell.c, cell.r)

  if (ui.mode) {
    executeSupport(cell, unit)
    return
  }
  if (game.phase !== 'player') {
    if (unit) selectUnit(unit.id)
    return
  }

  const selected = selectedUnit()
  if (unit && unit.side === 'us') {
    selectUnit(unit.id)
    return
  }
  if (selected && selected.side === 'us' && unit && unit.side === 'nva') {
    if (game.inAttackRange(selected, unit) && !selected.attacked && !selected.cannotAct) {
      doAttack(selected, unit)
    } else {
      toast(`${unit.name} is outside ${selected.label}'s engagement range.`, 'warning')
      audio?.warning()
    }
    return
  }
  if (selected && selected.side === 'us' && !selected.moved && !selected.attacked && !selected.cannotAct && game.canMoveTo(selected, cell.c, cell.r)) {
    if (cell.c === selected.c && cell.r === selected.r) {
      syncUI()
      return
    }
    doMove(selected, cell)
    return
  }
  if (unit) {
    selectUnit(unit.id)
    return
  }
  clearSelection()
}

function onBoardPointerMove(event) {
  if (event.pointerType !== 'mouse' || !ui.started) return
  const cell = renderer.pickHex(event.clientX, event.clientY)
  ui.hover = cell
  if (!cell) {
    hideTooltip()
    return
  }
  const unit = game.occupied(cell.c, cell.r)
  updateTooltipForCell(cell, unit, event)
}

function updateTooltipForCell(cell, unit, event) {
  const tip = $('tooltip')
  if (!tip) return
  const t = terrainAt(cell.c, cell.r) || TERRAIN.grass
  const selected = selectedUnit()
  let html = `<div class="tip-head"><b>${t.name}</b><span>${coordLabel(cell.c, cell.r)}</span></div>
    <div class="tip-sub">MOVE ${t.impassable ? '—' : t.move} · COVER +${t.cover}</div>
    <p>${escapeHtml(t.detail)}</p>`

  if (unit) {
    const side = unit.side === 'us' ? 'FRIENDLY' : 'ENEMY'
    const status = statusFor(unit)
    html += `<div class="tip-unit ${unit.side}">
      <div class="tip-unit-head"><b>${escapeHtml(unit.name)}</b><span>${side}</span></div>
      <div class="tip-grid">
        <span>HP <b>${unit.hp}/${unit.maxHp}</b></span>
        <span>FIRE <b>${unit.soft}/${unit.armorAtk}</b></span>
        <span>RNG <b>${unit.range || '—'}</b></span>
        <span>COVER <b>+${game.coverOf(unit)}</b></span>
      </div>
      <div class="tip-weapon">${escapeHtml(unit.weapon)} ${status.text === 'READY' ? '' : `· ${status.text}`}</div>`
    if (selected && selected.side === 'us' && unit.side === 'nva' && game.inAttackRange(selected, unit) && !selected.attacked) {
      html += `<div class="tip-damage">EST. ${game.estimateDamage(selected, unit)} DMG · CLICK TO FIRE</div>`
    } else if (selected && selected.side === 'us' && unit.side === 'nva' && selected.attacked) {
      html += `<div class="tip-damage muted">ALREADY FIRED THIS TURN</div>`
    }
    html += '</div>'
  } else if (selected && selected.side === 'us' && game.canMoveTo(selected, cell.c, cell.r) && !selected.attacked) {
    html += `<div class="tip-action">CLICK TO MOVE HERE</div>`
  }

  if (ui.mode) {
    const preview = game.previewSupport(ui.mode.kind, cell.c, cell.r)
    if (ui.mode.kind === 'dustoff') {
      html += `<div class="tip-action ${preview.length ? 'good' : 'bad'}">${preview.length ? 'CLICK TO MEDEVAC THIS UNIT' : 'SELECT A FRIENDLY COMBAT UNIT'}</div>`
    } else {
      const enemies = preview.filter(p => p.side === 'nva').length
      const friendlies = preview.filter(p => p.friendly).length
      html += `<div class="tip-action ${friendlies ? 'bad' : enemies ? 'good' : ''}">${enemies} ENEMY · ${friendlies} FRIENDLY IN BLAST${friendlies ? ' · DANGER CLOSE' : ''}</div>`
    }
  }

  tip.innerHTML = html
  tip.classList.remove('hidden')
  if (event) {
    const pad = 16
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    let x = event.clientX + pad
    let y = event.clientY + pad
    if (x + w > vw - 10) x = event.clientX - w - pad
    if (y + h > vh - 10) y = event.clientY - h - pad
    tip.style.left = `${Math.max(8, x)}px`
    tip.style.top = `${Math.max(8, y)}px`
  }
}

function hideTooltip() {
  $('tooltip')?.classList.add('hidden')
}

// ---------------------------------------------------------------------------
// Turn flow / outcomes
// ---------------------------------------------------------------------------

async function endTurn() {
  if (ui.busy || game.phase !== 'player' || !ui.started) return
  ui.mode = null
  ui.hover = null
  hideTargetPrompt()
  hideTooltip()
  ui.busy = true
  syncUI()
  audio?.turn()
  try {
    await game.endPlayerTurn()
  } finally {
    ui.busy = false
    syncUI()
  }
}

function showTurnBanner(turn, subtitle) {
  const banner = $('turn-banner')
  if (!banner) return
  banner.querySelector('span').textContent = `TURN ${String(turn).padStart(2, '0')} / ${MAX_TURNS}`
  banner.querySelector('strong').textContent = subtitle
  banner.classList.remove('hidden')
  banner.classList.add('show')
  clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => {
    banner.classList.remove('show')
    setTimeout(() => banner.classList.add('hidden'), 450)
  }, 1450)
}

function showPhaseBanner() {
  const banner = $('turn-banner')
  if (!banner) return
  banner.querySelector('span').textContent = 'ENEMY MOVEMENT'
  banner.querySelector('strong').textContent = 'HOLD THE LINE'
  banner.classList.remove('hidden')
  banner.classList.add('show')
  clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => {
    banner.classList.remove('show')
    setTimeout(() => banner.classList.add('hidden'), 450)
  }, 900)
}

function showResult(event) {
  const best = Number(loadSetting(BEST_KEY, 0)) || 0
  const isBest = event.score > best
  if (isBest) saveSetting(BEST_KEY, event.score)
  const modal = $('result-modal')
  const victory = event.result === 'victory'
  modal.querySelector('.result-grade').textContent = event.grade
  modal.querySelector('.result-title').textContent = victory ? 'FIREBASE HELD' : 'FIREBASE OVERRUN'
  modal.querySelector('.result-kicker').textContent = victory ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'
  modal.querySelector('.result-reason').textContent = event.reason
  modal.querySelector('.result-score').textContent = event.score.toLocaleString()
  modal.querySelector('.result-best').textContent = isBest ? 'NEW BEST' : `BEST ${best.toLocaleString()}`
  modal.querySelector('.result-stats').innerHTML = `
    <div><span>ENEMY DESTROYED</span><b>${event.stats.kills}</b></div>
    <div><span>FRIENDLY LOSSES</span><b>${event.stats.losses}</b></div>
    <div><span>BUNKER HP</span><b>${event.stats.bunkerHp}</b></div>
    <div><span>TURNS HELD</span><b>${event.stats.turns}</b></div>
    <div><span>ARTILLERY / AIR</span><b>${event.stats.supportUses}</b></div>
    <div><span>ENEMIES ENGAGED</span><b>${event.stats.enemiesSpawned}</b></div>
  `
  modal.classList.toggle('victory', victory)
  modal.classList.toggle('defeat', !victory)
  modal.classList.remove('hidden')
  document.body.classList.add('result-open')
}

function startOperation() {
  if (game.phase !== 'briefing') return
  audio?.unlock()
  audio?.click()
  game.start()
  ui.started = true
  $('start-modal').classList.add('hidden')
  document.getElementById('app').classList.add('in-game')
  syncUI()
}

function restartOperation() {
  audio?.unlock()
  audio?.click()
  $('result-modal').classList.add('hidden')
  $('manual-modal').classList.add('hidden')
  $('start-modal').classList.add('hidden')
  document.body.classList.remove('result-open')
  setupGame(Date.now())
  game.start()
  ui.started = true
  document.getElementById('app').classList.add('in-game')
  syncUI()
  showTurnBanner(1, 'HOLD THE PERIMETER')
  toast('New operation started. Firebase Raven is standing by.', 'system')
}

function openManual() {
  audio?.unlock()
  audio?.click()
  $('manual-modal').classList.remove('hidden')
}

function closeManual() {
  $('manual-modal').classList.add('hidden')
}

function closeResult() {
  $('result-modal').classList.add('hidden')
  document.body.classList.remove('result-open')
}

function toast(text, kind = '') {
  const stack = $('toast-stack')
  if (!stack) return
  const el = document.createElement('div')
  el.className = `toast ${kind}`
  el.textContent = text
  stack.appendChild(el)
  while (stack.children.length > 3) stack.firstElementChild.remove()
  requestAnimationFrame(() => el.classList.add('in'))
  setTimeout(() => {
    el.classList.remove('in')
    setTimeout(() => el.remove(), 300)
  }, 2800)
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function bind() {
  $('btn-start').addEventListener('click', startOperation)
  $('btn-brief-manual').addEventListener('click', openManual)
  $('btn-manual').addEventListener('click', openManual)
  $('btn-restart').addEventListener('click', restartOperation)
  $('btn-end-turn').addEventListener('click', endTurn)
  $('btn-cancel-target').addEventListener('click', cancelTargetMode)
  $('btn-sound').addEventListener('click', () => {
    audio?.unlock()
    const muted = !audio.muted
    audio.setMuted(muted)
    saveSetting('firebase-raven-muted', muted)
    updateSoundButton()
    if (!muted) audio?.click()
  })

  for (const btn of document.querySelectorAll('[data-support]')) {
    btn.addEventListener('click', () => startTargetMode(btn.dataset.support))
  }
  for (const btn of document.querySelectorAll('[data-close-manual]')) btn.addEventListener('click', closeManual)
  for (const btn of document.querySelectorAll('[data-close-result]')) btn.addEventListener('click', closeResult)
  $('btn-result-restart').addEventListener('click', restartOperation)
  $('manual-modal').addEventListener('click', event => {
    if (event.target === $('manual-modal')) closeManual()
  })
  $('result-modal').addEventListener('click', event => {
    if (event.target === $('result-modal')) closeResult()
  })
  $('start-modal').addEventListener('click', event => {
    if (event.target === $('start-modal')) return
  })

  $('btn-units-mobile').addEventListener('click', () => {
    document.body.classList.toggle('drawer-roster')
    document.body.classList.remove('drawer-log')
  })
  $('btn-log-mobile').addEventListener('click', () => {
    document.body.classList.toggle('drawer-log')
    document.body.classList.remove('drawer-roster')
  })
  for (const btn of document.querySelectorAll('[data-close-drawer]')) {
    btn.addEventListener('click', () => {
      document.body.classList.remove('drawer-roster', 'drawer-log')
    })
  }

  const canvas = $('board')
  canvas.addEventListener('pointerdown', onBoardPointerDown)
  canvas.addEventListener('pointermove', onBoardPointerMove)
  canvas.addEventListener('pointerleave', () => {
    ui.hover = null
    hideTooltip()
  })
  canvas.addEventListener('contextmenu', event => event.preventDefault())

  document.addEventListener('keydown', event => {
    const modalOpen = !$('manual-modal').classList.contains('hidden') || !$('result-modal').classList.contains('hidden')
    if (event.key === 'Escape') {
      if (!$('manual-modal').classList.contains('hidden')) { closeManual(); return }
      if (!$('result-modal').classList.contains('hidden')) { closeResult(); return }
      if (ui.mode) { cancelTargetMode(); return }
      if (ui.selectedId) { clearSelection(); return }
    }
    if ($('start-modal').classList.contains('hidden') === false && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      startOperation()
      return
    }
    if (modalOpen) return
    if (!ui.started || ui.busy) return
    const key = event.key.toLowerCase()
    if (key === 'e') { event.preventDefault(); endTurn() }
    else if (key === 'a') startTargetMode('artillery')
    else if (key === 'h') startTargetMode('huey')
    else if (key === 'm') startTargetMode('dustoff')
    else if (key === '?') openManual()
    else if (/^[1-6]$/.test(key)) {
      const index = Number(key) - 1
      const type = PLAYER_ORDER[index]
      const unit = game.units.find(u => u.side === 'us' && u.type === type && u.alive)
      if (unit) selectUnit(unit.id)
    }
  })

  const roster = $('unit-list')
  roster.addEventListener('click', event => {
    const card = event.target.closest('[data-unit-id]')
    if (!card) return
    selectUnit(card.dataset.unitId)
  })
  const strip = $('unit-strip')
  strip.addEventListener('click', event => {
    const card = event.target.closest('[data-unit-id]')
    if (!card) return
    selectUnit(card.dataset.unitId)
    document.body.classList.remove('drawer-roster')
  })
}

function updateSoundButton() {
  const btn = $('btn-sound')
  if (!btn) return
  const muted = audio?.muted ?? true
  btn.classList.toggle('muted', muted)
  btn.innerHTML = muted ? soundOffIcon() + '<span>SOUND OFF</span>' : soundOnIcon() + '<span>SOUND ON</span>'
  btn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound')
}

function soundOnIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
}

function soundOffIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
}

// Debug/QA hook — useful for automated verification and not part of gameplay.
function exposeDebug() {
  window.__RAVEN__ = {
    get game() { return game },
    get ui() { return ui },
    get renderer() { return renderer },
    start: startOperation,
    restart: restartOperation,
    selectUnit,
    move: (id, c, r) => game.movePlayerUnit(id, c, r),
    attack: (attackerId, defenderId) => game.attack(attackerId, defenderId),
    endTurn,
    support: (kind, c, r) => {
      if (kind === 'dustoff') {
        const unit = game.occupied(c, r)
        return game.callDustoff(unit?.id)
      }
      if (kind === 'artillery') return game.callArtillery(c, r)
      return game.callHuey(c, r)
    },
    win: () => game.finish('victory', 'The relief column reached Firebase Raven at first light.'),
    lose: () => game.finish('defeat', 'The command bunker was overrun. Firebase Raven has fallen.'),
    turbo: () => game.setDelay(async () => {}),
    state: () => game.serialize()
  }
}

function boot() {
  const muted = loadSetting('firebase-raven-muted', false)
  audio = new AudioSystem({ muted: Boolean(muted) })
  setupGame(Date.now())
  renderer = new Renderer($('board'), game, ui)
  bind()
  updateSoundButton()
  exposeDebug()
  syncUI()
  hideTooltip()
}

boot()
