/* Game data and pure progression formulas. */

export const SAVE_KEY = 'ashfall.save.v1';
export const VERSION = 1;

export const ORES = {
  scrap:      { name: 'Scrap',      label: 'SCRAP',      color: '#9aa8b2' },
  iron:       { name: 'Iron',       label: 'IRON',       color: '#c97a52' },
  copper:     { name: 'Copper',     label: 'COPPER',     color: '#e88a3c' },
  titanium:   { name: 'Titanium',   label: 'TITANIUM',   color: '#6fd8dc' },
  uranium:    { name: 'Uranium',    label: 'URANIUM',    color: '#b7ee58' },
  singularity:{ name: 'Void Shard', label: 'VOID',       color: '#b98aff' },
};
export const ORE_ORDER = ['scrap', 'iron', 'copper', 'titanium', 'uranium', 'singularity'];

/* Outfits are permanent survivor gear. Each level is bought with caps (money) + ore. */
export const OUTFITS = [
  {
    id: 'rebreather', name: 'Glowcap Rebreather', slot: 'HEAD', icon: '☣',
    max: 15,
    blurb: 'A scavenged filter rig. Sharpens the eye and the mind.',
    effect: (lvl) => `Crit +${(lvl * 1.5).toFixed(1)}% · XP +${lvl * 4}%`,
    cost: (lvl) => ({ caps: Math.ceil(80 * Math.pow(1.5, lvl)), iron: Math.ceil(10 * Math.pow(1.4, lvl)) }),
  },
  {
    id: 'duster', name: 'Slagwalker Duster', slot: 'COAT', icon: '⛨',
    max: 15,
    blurb: 'Waxed canvas and welded plate. Built to take a beating.',
    effect: (lvl) => `Max HP +${(lvl * 2.5).toFixed(1)}% · Resist +${(lvl * 0.6).toFixed(1)}%`,
    cost: (lvl) => ({ caps: Math.ceil(100 * Math.pow(1.5, lvl)), scrap: Math.ceil(120 * Math.pow(1.4, lvl)) }),
  },
  {
    id: 'charm', name: 'Warden Charm', slot: 'CHARM', icon: '✦',
    max: 15,
    blurb: 'A dead warden\'s token. The wastes pay tribute to it.',
    effect: (lvl) => `Caps +${lvl * 3}% · Ore +${(lvl * 1.5).toFixed(1)}%`,
    cost: (lvl) => ({ caps: Math.ceil(180 * Math.pow(1.5, lvl)), iron: Math.ceil(25 * Math.pow(1.4, lvl)) }),
  },
];

export const OUTFIT_MAP = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));

export function outfitLevel(state, id) {
  return Math.max(0, Math.floor(Number(state.outfits?.[id]) || 0));
}

export function outfitCost(outfit, level) {
  return outfit.cost(level);
}

export function outfitOreMult(state) {
  return 1 + outfitLevel(state, 'charm') * 0.015;
}

export function outfitCapsMult(state) {
  return 1 + outfitLevel(state, 'charm') * 0.03;
}

export function outfitXpMult(state) {
  return 1 + outfitLevel(state, 'rebreather') * 0.04;
}

export function xpNeeded(level) {
  return Math.floor(60 * Math.pow(Math.max(1, level), 1.55));
}

/* RPG attributes and perks. */
export const ATTRIBUTES = [
  { id: 'str', key: 'STR', name: 'Strength', desc: '+2.5% attack per point', effect: (v) => `+${(v * 2.5).toFixed(1)}% ATK` },
  { id: 'vit', key: 'VIT', name: 'Vitality', desc: '+8 HP and +0.4% resist per point', effect: (v) => `+${v * 8} HP · +${(v * 0.4).toFixed(1)}% DEF` },
  { id: 'agi', key: 'AGI', name: 'Agility', desc: '+0.6% crit per point', effect: (v) => `+${(v * 0.6).toFixed(1)}% CRIT` },
  { id: 'luk', key: 'LUK', name: 'Luck', desc: '+0.8% ore and +1.5% caps per point', effect: (v) => `+${(v * 0.8).toFixed(1)}% ORE · +${(v * 1.5).toFixed(1)}% CAPS` },
];

export const PERKS = [
  { id: 'berserker', name: 'Berserker', max: 5, desc: '+10% attack per rank.' },
  { id: 'ironhide', name: 'Ironhide', max: 5, desc: '+10% max HP per rank.' },
  { id: 'prospector', name: 'Prospector', max: 5, desc: '+10% ore yield per rank.' },
  { id: 'scavenger', name: 'Scavenger', max: 5, desc: '+10% caps (money) from kills per rank.' },
  { id: 'executioner', name: 'Executioner', max: 5, desc: '+5% critical chance per rank.' },
  { id: 'quickhands', name: 'Quick Hands', max: 5, desc: '+8% attack speed per rank.' },
  { id: 'fieldmedic', name: 'Field Medic', max: 5, desc: '+5 HP healed per kill per rank.' },
  { id: 'deeplung', name: 'Deep Lung', max: 5, desc: '+8% experience gained per rank.' },
];

export function attrLevel(state, id) {
  return Math.max(0, Math.floor(Number(state.attributes?.[id]) || 0));
}
export function perkRank(state, id) {
  return Math.max(0, Math.floor(Number(state.perks?.[id]) || 0));
}
export function perkAtkMult(state) { return 1 + perkRank(state, 'berserker') * 0.10; }
export function perkHpMult(state) { return 1 + perkRank(state, 'ironhide') * 0.10; }
export function perkOreMult(state) { return 1 + perkRank(state, 'prospector') * 0.10; }
export function perkCapsMult(state) { return 1 + perkRank(state, 'scavenger') * 0.10; }
export function perkCritBonus(state) { return perkRank(state, 'executioner') * 0.05; }
export function perkSpeedMult(state) { return 1 + perkRank(state, 'quickhands') * 0.08; }
export function perkHealBonus(state) { return perkRank(state, 'fieldmedic') * 5; }
export function perkXpMult(state) { return 1 + perkRank(state, 'deeplung') * 0.08; }

export function attributeOreMult(state) {
  return 1 + attrLevel(state, 'luk') * 0.008;
}
export function attributeCapsMult(state) {
  return 1 + attrLevel(state, 'luk') * 0.015;
}
export function oreMultiplier(state) {
  return outfitOreMult(state) * attributeOreMult(state) * perkOreMult(state);
}
export function xpMultiplier(state) {
  return outfitXpMult(state) * perkXpMult(state);
}
export function levelHpMult(state) { return 1 + (Math.max(1, state.level || 1) - 1) * 0.04; }
export function levelAtkMult(state) { return 1 + (Math.max(1, state.level || 1) - 1) * 0.02; }

export const LAYERS = [
  {
    id: 'rubble', name: 'Surface Rubble', short: 'SURFACE', ore: 'scrap',
    hp: 24, baseYield: 1, depth: 12,
    unlock: null,
    blurb: 'Twisted rebar and shattered concrete. Everything starts here.',
    cave: '#2b241b', glow: '#9aa8b2',
  },
  {
    id: 'flats', name: 'Rust Flats', short: 'RUST FLATS', ore: 'iron',
    hp: 52, baseYield: 2, depth: 84,
    unlock: { pickaxe: 3, ore: { scrap: 200 } },
    blurb: 'A sea of oxidized husks. The iron still holds.',
    cave: '#33231a', glow: '#c97a52',
  },
  {
    id: 'foundry', name: 'Toxic Foundry', short: 'FOUNDRY', ore: 'copper',
    hp: 128, baseYield: 5, depth: 210,
    unlock: { pickaxe: 6, ore: { iron: 220 } },
    blurb: 'Green runoff, live cables, and miles of copper spine.',
    cave: '#1f2b1c', glow: '#e88a3c',
  },
  {
    id: 'crater', name: 'Glassed Crater', short: 'CRATER', ore: 'titanium',
    hp: 300, baseYield: 12, depth: 480,
    unlock: { pickaxe: 10, ore: { copper: 450 } },
    blurb: 'The impact fused the earth into glass. Something glitters beneath.',
    cave: '#182a2b', glow: '#6fd8dc',
  },
  {
    id: 'reactor', name: 'Reactor Depths', short: 'DEPTHS', ore: 'uranium',
    hp: 620, baseYield: 26, depth: 910,
    unlock: { pickaxe: 15, ore: { titanium: 400 } },
    blurb: 'The old reactor never died. It only went quiet.',
    cave: '#242b14', glow: '#b7ee58',
  },
  {
    id: 'vault', name: 'The Black Vault', short: 'VAULT', ore: 'singularity',
    hp: 1200, baseYield: 60, depth: 1600,
    unlock: { pickaxe: 22, ore: { uranium: 650 } },
    blurb: 'Below the reactor, a door that was never meant to open.',
    cave: '#251d2e', glow: '#b98aff',
  },
];

export const ZONES = [
  {
    id: 'rustyard', name: 'Rustyard', sector: 'SECTOR 01',
    enemies: ['Rust Rat', 'Scavenger Dog', 'Wire Hound'], bossName: 'GUTTER KING',
    baseHp: 24, baseDmg: 5, interval: 2050, caps: 7, ore: 'scrap', oreAmt: 3,
    unlock: null, shape: 'critter',
    sky: ['#241812', '#0c0907'], accent: '#ff7a2b', enemy: '#8f5b3d',
  },
  {
    id: 'highway', name: 'Highway Camp', sector: 'SECTOR 02',
    enemies: ['Road Raider', 'Marauder', 'Dust Ghoul'], bossName: 'ROAD BARON',
    baseHp: 70, baseDmg: 10, interval: 2000, caps: 26, ore: 'iron', oreAmt: 6,
    unlock: { caps: 120, ore: { iron: 30 } }, shape: 'raider',
    sky: ['#2b1a16', '#0d0807'], accent: '#e6513d', enemy: '#a4633f',
  },
  {
    id: 'foundry', name: 'Foundry Ruins', sector: 'SECTOR 03',
    enemies: ['Slag Golem', 'Furnace Wraith', 'Cinder Hound'], bossName: 'SLAG COLOSSUS',
    baseHp: 190, baseDmg: 20, interval: 2300, caps: 90, ore: 'copper', oreAmt: 8,
    unlock: { caps: 600, ore: { copper: 60 } }, shape: 'golem',
    sky: ['#231a12', '#0c0806'], accent: '#e88a3c', enemy: '#7d5a44',
  },
  {
    id: 'crater', name: 'Glassed Crater', sector: 'SECTOR 04',
    enemies: ['Rad Stalker', 'Ash Brute', 'Glass Crawler'], bossName: 'RAD MATRIARCH',
    baseHp: 520, baseDmg: 38, interval: 2200, caps: 300, ore: 'titanium', oreAmt: 7,
    unlock: { caps: 2500, ore: { titanium: 50 } }, shape: 'brute',
    sky: ['#1a2626', '#070b0b'], accent: '#6fd8dc', enemy: '#5f8c82',
  },
  {
    id: 'depths', name: 'Reactor Depths', sector: 'SECTOR 05',
    enemies: ['Core Warden', 'Melted Sentry', 'Flux Hound'], bossName: 'CORE SENTINEL',
    baseHp: 1500, baseDmg: 70, interval: 2400, caps: 1000, ore: 'uranium', oreAmt: 6,
    unlock: { caps: 9000, ore: { uranium: 40 } }, shape: 'sentry',
    sky: ['#1c2412', '#070a05'], accent: '#b7ee58', enemy: '#7d9445',
  },
  {
    id: 'vault', name: 'The Black Vault', sector: 'SECTOR 06',
    enemies: ['Void Herald', 'Null Reaper', 'Hollow Saint'], bossName: 'WARDEN PRIME',
    baseHp: 4200, baseDmg: 130, interval: 2500, caps: 3200, ore: 'singularity', oreAmt: 4,
    unlock: { caps: 30000, ore: { singularity: 15 } }, shape: 'void',
    sky: ['#1e172a', '#08060c'], accent: '#b98aff', enemy: '#8466a8',
  },
];

/* ── multipliers ───────────────────────────────────────────── */
export function shardYieldMult(state) { return 1 + (state.shards || 0) * 0.10; }
export function shardDamageMult(state) { return 1 + (state.shards || 0) * 0.08; }
export function crewMult(state) { return 1 + (state.crew || 0) * 0.08; }

export function pickPower(state) { return 2 + 2.3 * (state.pickaxe - 1); }

export function nodeRichness(node) { return 1 + 0.04 * (node || 0); }

export function layerMaxHp(state, layerIndex) {
  const layer = LAYERS[layerIndex];
  return Math.ceil(layer.hp * (1 + 0.08 * (state.nodes[layerIndex] || 0)));
}

export function strikeYield(state, layerIndex) {
  const layer = LAYERS[layerIndex];
  return layer.baseYield
    * (1 + 0.22 * (state.pickaxe - 1))
    * crewMult(state)
    * shardYieldMult(state)
    * oreMultiplier(state)
    * nodeRichness(state.nodes[layerIndex]);
}

export function drillRate(state, layerIndex) {
  const layer = LAYERS[layerIndex];
  return layer.baseYield * 0.22 * crewMult(state) * shardYieldMult(state) * oreMultiplier(state);
}

export function allDrillRate(state) {
  let total = 0;
  for (let i = 0; i < LAYERS.length; i++) total += (state.drills[i] || 0) * drillRate(state, i);
  return total;
}

/* ── costs ─────────────────────────────────────────────────── */
export function pickaxeCost(level) {
  const base = 18 * Math.pow(1.55, level - 1);
  const cost = {
    scrap: Math.ceil(base),
    caps: Math.ceil(6 * Math.pow(1.3, level - 1)),
  };
  if (level >= 4) cost.iron = Math.ceil(base * 0.08);
  if (level >= 8) cost.copper = Math.ceil(base * 0.025);
  if (level >= 12) cost.titanium = Math.ceil(base * 0.008);
  if (level >= 16) cost.uranium = Math.ceil(base * 0.0025);
  return cost;
}

export function drillCost(layerIndex, count) {
  const layer = LAYERS[layerIndex];
  const cost = { [layer.ore]: Math.ceil(layer.baseYield * 20 * Math.pow(1.24, count)) };
  const caps = Math.ceil((6 + layerIndex * 12) * Math.pow(1.18, count));
  if (caps > 0) cost.caps = caps;
  return cost;
}

export function crewCost(level) {
  return { caps: Math.ceil(120 * Math.pow(1.75, level)) };
}

export function weaponCost(level) {
  const base = 26 * Math.pow(1.46, level - 1);
  const cost = { scrap: Math.ceil(base), caps: Math.ceil(10 * Math.pow(1.42, level - 1)) };
  if (level >= 3) cost.iron = Math.ceil(base * 0.10);
  if (level >= 7) cost.copper = Math.ceil(base * 0.018);
  if (level >= 12) cost.titanium = Math.ceil(base * 0.0035);
  if (level >= 16) cost.uranium = Math.ceil(base * 0.0008);
  return cost;
}

export function armorCost(level) {
  const base = 22 * Math.pow(1.45, level - 1);
  const cost = { scrap: Math.ceil(base), caps: Math.ceil(8 * Math.pow(1.4, level - 1)) };
  if (level >= 3) cost.iron = Math.ceil(base * 0.09);
  if (level >= 8) cost.copper = Math.ceil(base * 0.016);
  if (level >= 12) cost.titanium = Math.ceil(base * 0.003);
  if (level >= 16) cost.uranium = Math.ceil(base * 0.0007);
  return cost;
}

export const STIM_MAX = 10;
export function stimCost(level) {
  const cost = { caps: Math.ceil(150 * Math.pow(1.8, level)) };
  if (level >= 1) cost.iron = Math.ceil(8 * Math.pow(1.55, level));
  if (level >= 3) cost.copper = Math.ceil(3 * Math.pow(1.5, level - 2));
  if (level >= 6) cost.titanium = Math.ceil(2 * Math.pow(1.5, level - 5));
  return cost;
}

/* ── combat stats ──────────────────────────────────────────── */
export function playerStats(state) {
  const g = state.combat?.gear || state.gear || { weapon: 1, armor: 1, stim: 0 };
  const lvl = Math.max(1, state.level || 1);
  const outfits = state.outfits || {};
  const duster = Math.max(0, Math.floor(outfits.duster || 0));
  const rebreather = Math.max(0, Math.floor(outfits.rebreather || 0));
  const charm = Math.max(0, Math.floor(outfits.charm || 0));
  const str = attrLevel(state, 'str');
  const vit = attrLevel(state, 'vit');
  const agi = attrLevel(state, 'agi');
  const luk = attrLevel(state, 'luk');
  const baseHp = 100 + 30 * (g.armor - 1) + vit * 8;
  const maxHp = Math.max(1, Math.round(
    baseHp
    * levelHpMult(state)
    * (1 + duster * 0.025)
    * perkHpMult(state)
  ));
  const attack = (4 + 4 * (g.weapon - 1))
    * levelAtkMult(state)
    * (1 + str * 0.025)
    * shardDamageMult(state)
    * perkAtkMult(state);
  const crit = Math.min(0.60, 0.12 + rebreather * 0.015 + agi * 0.006 + perkCritBonus(state));
  const defense = Math.min(0.68, 0.035 * (g.armor - 1) + duster * 0.006 + vit * 0.004);
  const capsMult = (1 + charm * 0.03) * (1 + luk * 0.015) * perkCapsMult(state);
  return {
    maxHp,
    attack,
    crit,
    defense,
    capsMult,
    oreMult: oreMultiplier(state),
    xpMult: xpMultiplier(state),
    healPerKill: (g.stim > 0 ? 8 + 5 * g.stim : 6) + perkHealBonus(state),
    deathMs: Math.max(1500, 4000 - 250 * g.stim),
    speedMult: perkSpeedMult(state),
    level: lvl,
  };
}

export function playerAttackInterval(state) {
  const mult = state ? perkSpeedMult(state) : 1;
  return Math.max(280, Math.round(750 / mult));
}

export function makeEnemy(zoneIndex, wave) {
  const zone = ZONES[zoneIndex];
  const boss = wave % 10 === 0;
  const waveIdx = Math.max(0, wave - 1);
  const hpMult = 1 + 0.15 * waveIdx;
  const dmgMult = 1 + 0.08 * waveIdx;
  return {
    name: boss ? zone.bossName : zone.enemies[(wave + zoneIndex) % zone.enemies.length],
    boss,
    maxHp: Math.ceil(zone.baseHp * hpMult * (boss ? 3 : 1)),
    hp: Math.ceil(zone.baseHp * hpMult * (boss ? 3 : 1)),
    dmg: zone.baseDmg * dmgMult * (boss ? 1.4 : 1),
    interval: zone.interval,
    caps: Math.ceil(zone.caps * (1 + 0.06 * waveIdx) * (boss ? 4 : 1)),
    ore: zone.ore,
    oreAmt: Math.ceil(zone.oreAmt * (1 + 0.03 * waveIdx) * (boss ? 3 : 1)),
    xp: Math.ceil((5 + zoneIndex * 7) * (1 + 0.08 * waveIdx) * (boss ? 6 : 1)),
    nextAttack: 0,
    hitFlash: 0,
    lunge: 0,
    spawn: 0,
  };
}

export function overloadGain(state) {
  return 1 + (state.combat.primeKills || 0) * 2;
}

/* ── formatting helpers ────────────────────────────────────── */
export function fmt(n, digits = 0) {
  if (!isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs < 1000) {
    if (abs === 0) return '0';
    if (abs < 10 && digits > 0) return n.toFixed(digits);
    if (abs < 100 && digits > 0 && n % 1 !== 0) return n.toFixed(1);
    return String(Math.floor(n));
  }
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
  let i = -1;
  let v = n;
  while (Math.abs(v) >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  const dec = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return `${v.toFixed(dec).replace(/\.0+$/, '')}${units[i]}`;
}

export function fmtRate(n) {
  if (n === 0) return '0.00/s';
  if (n < 1) return `${n.toFixed(2)}/s`;
  return `${fmt(n, 1)}/s`;
}

export function costLabel(cost) {
  return Object.entries(cost).map(([k, v]) => {
    const name = k === 'caps' ? 'caps' : ORES[k].name;
    return `${fmt(v)} ${name}`;
  }).join(' · ');
}

export function canAfford(state, cost) {
  for (const [k, v] of Object.entries(cost)) {
    if (k === 'caps') { if ((state.caps || 0) < v) return false; }
    else if ((state.ores[k] || 0) < v) return false;
  }
  return true;
}

export function spend(state, cost) {
  if (!canAfford(state, cost)) return false;
  for (const [k, v] of Object.entries(cost)) {
    if (k === 'caps') state.caps -= v;
    else state.ores[k] -= v;
  }
  return true;
}
