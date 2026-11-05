import {
  SAVE_KEY, VERSION, LAYERS, ZONES, ORE_ORDER, MINING_TOOLS, COMBAT_WEAPONS,
  GEAR_SLOTS, MAX_INVENTORY, sanitizeLootItem, CREW_POOL, TASKS,
  makeEnemy, playerStats, drillRate, salvageCapsRate, layerMaxHp, fmt,
} from './data.js';

export function defaultState() {
  return {
    version: VERSION,
    ores: { scrap: 0, iron: 0, copper: 0, titanium: 0, uranium: 0, singularity: 0 },
    caps: 25,
    shards: 0,
    pickaxe: 1,
    drills: LAYERS.map(() => 0),
    crew: 0,
    nodes: LAYERS.map(() => 0),
    veinHp: LAYERS.map((l) => l.hp),
    layersUnlocked: 1,
    layer: 0,
    level: 1,
    xp: 0,
    points: 0,
    perkPoints: 0,
    attributes: { str: 0, vit: 0, agi: 0, luk: 0 },
    perks: {},
    outfits: { rebreather: 0, duster: 0, charm: 0 },
    tools: { pick: true },
    weapons: { pipeaxe: true },
    equippedTool: 'pick',
    equippedWeapon: 'pipeaxe',
    inventory: [],
    loadout: { weapon: null, tool: null, armor: null, helm: null, charm: null },
    crew: {},
    tower: { floor: 1, best: 0, active: false },
    iso: 0,
    tasks: {},
    store: { stock: [] },
    combat: {
      zone: 0,
      unlocked: 1,
      waves: ZONES.map(() => 1),
      enemy: null,
      hp: 100,
      auto: true,
      gear: { weapon: 1, armor: 1, stim: 0 },
      deadUntil: 0,
      nextPlayerAttack: 0,
      primeKills: 0,
    },
    stats: {
      totalMined: 0, totalCaps: 0, clicks: 0, kills: 0, deaths: 0,
      detonations: 0, startedAt: Date.now(),
    },
    autoMine: false,
    sound: true,
    lastSeen: Date.now(),
  };
}

function mergeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  base.ores = { ...base.ores, ...(raw.ores || {}) };
  base.caps = Number(raw.caps) || 0;
  base.shards = Number(raw.shards) || 0;
  base.pickaxe = Math.max(1, Math.floor(Number(raw.pickaxe) || 1));
  base.crew = Math.max(0, Math.floor(Number(raw.crew) || 0));
  base.level = Math.max(1, Math.floor(Number(raw.level) || 1));
  base.xp = Math.max(0, Number(raw.xp) || 0);
  base.points = Math.max(0, Math.floor(Number(raw.points) || 0));
  base.perkPoints = Math.max(0, Math.floor(Number(raw.perkPoints) || 0));
  base.attributes = {
    str: Math.max(0, Math.floor(Number(raw.attributes?.str) || 0)),
    vit: Math.max(0, Math.floor(Number(raw.attributes?.vit) || 0)),
    agi: Math.max(0, Math.floor(Number(raw.attributes?.agi) || 0)),
    luk: Math.max(0, Math.floor(Number(raw.attributes?.luk) || 0)),
  };
  base.perks = {};
  for (const [id, rank] of Object.entries(raw.perks || {})) {
    const value = Math.max(0, Math.min(5, Math.floor(Number(rank) || 0)));
    if (value) base.perks[id] = value;
  }
  base.outfits = {
    rebreather: Math.max(0, Math.min(15, Math.floor(Number(raw.outfits?.rebreather) || 0))),
    duster: Math.max(0, Math.min(15, Math.floor(Number(raw.outfits?.duster) || 0))),
    charm: Math.max(0, Math.min(15, Math.floor(Number(raw.outfits?.charm) || 0))),
  };

  base.tools = { pick: true };
  for (const tool of MINING_TOOLS) {
    if (tool.id === 'pick' || raw.tools?.[tool.id] === true) base.tools[tool.id] = true;
  }
  base.weapons = { pipeaxe: true };
  for (const weapon of COMBAT_WEAPONS) {
    if (weapon.id === 'pipeaxe' || raw.weapons?.[weapon.id] === true) base.weapons[weapon.id] = true;
  }
  base.equippedTool = base.tools[raw.equippedTool] ? raw.equippedTool : 'pick';
  base.equippedWeapon = base.weapons[raw.equippedWeapon] ? raw.equippedWeapon : 'pipeaxe';

  base.inventory = [];
  const seen = new Set();
  if (Array.isArray(raw.inventory)) {
    for (const entry of raw.inventory) {
      if (base.inventory.length >= MAX_INVENTORY) break;
      const item = sanitizeLootItem(entry);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      base.inventory.push(item);
    }
  }
  base.loadout = { weapon: null, tool: null, armor: null, helm: null, charm: null };
  for (const slot of GEAR_SLOTS) {
    const id = raw.loadout?.[slot.id];
    if (typeof id === 'string' && base.inventory.some((item) => item.id === id && item.slot === slot.id)) {
      base.loadout[slot.id] = id;
    }
  }

  // crew: booleans for valid crew ids only
  base.crew = {};
  for (const member of CREW_POOL) {
    if (raw.crew?.[member.id] === true) base.crew[member.id] = true;
  }
  base.tower = {
    floor: Math.min(999, Math.max(1, Math.floor(Number(raw.tower?.floor) || 1))),
    best: Math.min(999, Math.max(0, Math.floor(Number(raw.tower?.best) || 0))),
    active: false,
  };
  base.iso = Math.max(0, Math.floor(Number(raw.iso) || 0));
  base.tasks = {};
  for (const task of TASKS) {
    if (raw.tasks?.[task.id] === true) base.tasks[task.id] = true;
  }
  base.store = { stock: [] };
  if (Array.isArray(raw.store?.stock)) {
    for (const entry of raw.store.stock) {
      if (base.store.stock.length >= 4) break;
      const item = sanitizeLootItem(entry);
      if (item) base.store.stock.push(item);
    }
  }

  base.layersUnlocked = Math.min(LAYERS.length, Math.max(1, Math.floor(Number(raw.layersUnlocked) || 1)));
  base.layer = Math.min(base.layersUnlocked - 1, Math.max(0, Math.floor(Number(raw.layer) || 0)));
  if (Array.isArray(raw.drills)) base.drills = base.drills.map((_, i) => Math.max(0, Math.floor(Number(raw.drills[i]) || 0)));
  if (Array.isArray(raw.nodes)) base.nodes = base.nodes.map((_, i) => Math.max(0, Math.floor(Number(raw.nodes[i]) || 0)));
  if (Array.isArray(raw.veinHp)) base.veinHp = base.veinHp.map((_, i) => Math.max(0.01, Number(raw.veinHp[i]) || base.veinHp[i]));
  base.veinHp = base.veinHp.map((hp, i) => Math.min(hp, layerMaxHp(base, i)));

  const c = raw.combat || {};
  base.combat.unlocked = Math.min(ZONES.length, Math.max(1, Math.floor(Number(c.unlocked) || 1)));
  base.combat.zone = Math.min(base.combat.unlocked - 1, Math.max(0, Math.floor(Number(c.zone) || 0)));
  if (Array.isArray(c.waves)) {
    base.combat.waves = base.combat.waves.map((v, i) => Math.max(1, Math.floor(Number(c.waves[i]) || 1)));
  }
  base.combat.auto = c.auto !== false;
  base.combat.gear = {
    weapon: Math.max(1, Math.floor(Number(c.gear?.weapon) || 1)),
    armor: Math.max(1, Math.floor(Number(c.gear?.armor) || 1)),
    stim: Math.min(10, Math.max(0, Math.floor(Number(c.gear?.stim) || 0))),
  };
  base.combat.primeKills = Math.max(0, Math.floor(Number(c.primeKills) || 0));
  base.combat.enemy = c.enemy && typeof c.enemy === 'object' ? c.enemy : null;
  const stats = playerStats(base);
  base.combat.hp = Math.min(stats.maxHp, Math.max(1, Number(c.hp) || stats.maxHp));
  base.combat.deadUntil = Number(c.deadUntil) || 0;

  base.stats = { ...base.stats, ...(raw.stats || {}) };
  base.stats.totalMined = Math.max(0, Number(base.stats.totalMined) || 0);
  base.stats.totalCaps = Math.max(0, Number(base.stats.totalCaps) || 0);
  base.stats.clicks = Math.max(0, Math.floor(Number(base.stats.clicks) || 0));
  base.stats.kills = Math.max(0, Math.floor(Number(base.stats.kills) || 0));
  base.stats.deaths = Math.max(0, Math.floor(Number(base.stats.deaths) || 0));
  base.stats.bossKills = Math.max(0, Math.floor(Number(base.stats.bossKills) || 0));
  base.stats.legendaryFound = Math.max(0, Math.floor(Number(base.stats.legendaryFound) || 0));
  base.stats.detonations = Math.max(0, Math.floor(Number(base.stats.detonations) || 0));
  base.autoMine = raw.autoMine === true;
  base.sound = raw.sound !== false;
  base.lastSeen = Number(raw.lastSeen) || Date.now();
  base.version = VERSION;
  return base;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { state: defaultState(), fresh: true };
    return { state: mergeState(JSON.parse(raw)), fresh: false };
  } catch {
    return { state: defaultState(), fresh: true };
  }
}

export function persist(state) {
  state.lastSeen = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function offlineReport(state, now = Date.now()) {
  const elapsed = Math.max(0, Math.min(8 * 3600, (now - (state.lastSeen || now)) / 1000));
  if (elapsed < 60) return null;
  const gains = {};
  let total = 0;
  LAYERS.forEach((layer, i) => {
    const count = state.drills[i] || 0;
    if (!count) return;
    const amount = count * drillRate(state, i) * elapsed * 0.5;
    if (amount <= 0) return;
    gains[layer.ore] = (gains[layer.ore] || 0) + amount;
    state.ores[layer.ore] += amount;
    state.stats.totalMined += amount;
    total += amount;
  });
  const capRate = salvageCapsRate(state);
  const caps = capRate > 0 ? capRate * elapsed * 0.5 : 0;
  if (caps > 0) {
    state.caps += caps;
    state.stats.totalCaps = (state.stats.totalCaps || 0) + caps;
  }
  const stats = playerStats(state);
  state.combat.hp = Math.min(stats.maxHp, state.combat.hp + stats.maxHp * 0.01 * elapsed);
  if (state.combat.deadUntil < now) state.combat.deadUntil = 0;
  if (total <= 0 && caps <= 0) return null;
  return { seconds: elapsed, gains, total, caps };
}

export function resetProgress(state) {
  const fresh = defaultState();
  // Prestige wipes the run, but the survivor's RPG progression and outfits persist.
  fresh.shards = state.shards;
  fresh.sound = state.sound;
  fresh.autoMine = !!state.autoMine;
  fresh.stats.startedAt = state.stats.startedAt;
  fresh.level = state.level;
  fresh.xp = state.xp;
  fresh.points = state.points;
  fresh.perkPoints = state.perkPoints;
  fresh.attributes = { ...state.attributes };
  fresh.perks = { ...state.perks };
  fresh.outfits = { ...state.outfits };
  // Crewed survivors, isotopes, contracts, the store stall and the tower's
  // best floor are part of the survivor, not the run.
  fresh.crew = { ...state.crew };
  fresh.tower = { floor: 1, best: Math.max(0, state.tower?.best || 0), active: false };
  fresh.iso = state.iso || 0;
  fresh.tasks = { ...state.tasks };
  fresh.store = { stock: (state.store?.stock || []).map((item) => ({ ...item, stats: { ...item.stats } })) };
  // Schematics are knowledge, not hardware: unlocked tools and weapons survive.
  fresh.tools = { ...state.tools };
  fresh.weapons = { ...state.weapons };
  fresh.equippedTool = state.equippedTool;
  fresh.equippedWeapon = state.equippedWeapon;
  // Salvage and fitted gear are physical, but the survivor keeps their pack.
  fresh.inventory = (state.inventory || []).map((item) => ({ ...item, stats: { ...item.stats } }));
  fresh.loadout = { ...state.loadout };
  fresh.combat.hp = playerStats(fresh).maxHp;
  return fresh;
}

export function formatGainList(gains) {
  return ORE_ORDER
    .filter((o) => gains[o] > 0)
    .map((o) => `${fmt(gains[o], 1)} ${o}`)
    .join(' · ');
}
