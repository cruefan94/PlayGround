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

/* Salvage tools and combat weapons. Tools trade strike speed, vein damage,
   yield and crit against one another. Weapons trade damage, swing speed and
   crit. The Forge's tuning tracks raise every item in the slot. */
export const MINING_TOOLS = [
  {
    id: 'pick', name: 'Scrap Pickaxe', icon: '⛏', tier: 'SALVAGE', visual: 'pick',
    blurb: 'Rebar and a sharpened truck spring. Nothing fancy, never quits.',
    powerMult: 1, yieldMult: 1, cooldown: 45, critBonus: 0,
    unlock: null,
    stats: 'BALANCED · 45ms SWING',
  },
  {
    id: 'maul', name: 'Breaker Maul', icon: '🔨', tier: 'HEAVY', visual: 'maul',
    blurb: 'A rail spike welded to a hydraulic ram. Veins do not argue with it.',
    powerMult: 2.15, yieldMult: 1.3, cooldown: 110, critBonus: 0.02,
    unlock: { scrap: 140, caps: 45 },
    stats: 'HEAVY DAMAGE · +30% YIELD',
  },
  {
    id: 'drill', name: 'Rockeater Drill', icon: '⚙', tier: 'POWERED', visual: 'drill',
    blurb: 'A salvage motor bolted to a mining bit. Loud, thirsty, effective.',
    powerMult: 0.55, yieldMult: 1.7, cooldown: 28, critBonus: 0,
    unlock: { scrap: 700, iron: 60, caps: 400 },
    stats: 'FAST · +70% YIELD',
  },
  {
    id: 'cutter', name: 'Arc Cutter', icon: '⚡', tier: 'ARC', visual: 'cutter',
    blurb: 'A live plasma nib pulled from a dead welder. Cuts seams like paper.',
    powerMult: 0.45, yieldMult: 1.05, cooldown: 18, critBonus: 0.18,
    unlock: { iron: 350, copper: 180, caps: 1800 },
    stats: 'VERY FAST · +18% CRIT',
  },
  {
    id: 'ripper', name: 'Void Seam Ripper', icon: '✦', tier: 'ANOMALY', visual: 'ripper',
    blurb: 'A black-vault tooth on a haft of frozen light. It hums when it bites.',
    powerMult: 2.4, yieldMult: 2.1, cooldown: 65, critBonus: 0.1,
    unlock: { titanium: 260, uranium: 90, singularity: 12, caps: 12000 },
    stats: 'EXCAVATION-GRADE · +110% YIELD',
  },
];

export const MINING_TOOL_MAP = Object.fromEntries(MINING_TOOLS.map((t) => [t.id, t]));

export const COMBAT_WEAPONS = [
  {
    id: 'pipeaxe', name: 'Pipe Axe', icon: '⚔', tier: 'SALVAGE', visual: 'axe',
    blurb: 'A fire-axe head on a length of lead pipe. The wasteland classic.',
    damageMult: 1, speedMult: 1, critBonus: 0,
    unlock: null,
    stats: 'BALANCED · 0.75s SWING',
  },
  {
    id: 'rivet', name: 'Rivet Bat', icon: '🏏', tier: 'BRAWL', visual: 'bat',
    blurb: 'Rebar wrapped in razor wire and rivets. Fast hands win fights.',
    damageMult: 0.85, speedMult: 0.72, critBonus: 0.05,
    unlock: { scrap: 120, caps: 35 },
    stats: 'FAST · +5% CRIT',
  },
  {
    id: 'cleaver', name: 'Slag Cleaver', icon: '🪓', tier: 'HEAVY', visual: 'cleaver',
    blurb: 'A foundry shear with a bone grip. One swing, one problem solved.',
    damageMult: 1.6, speedMult: 1.3, critBonus: -0.02,
    unlock: { iron: 180, caps: 650 },
    stats: 'HEAVY HIT · SLOW SWING',
  },
  {
    id: 'lance', name: 'Rad Lance', icon: '🗡', tier: 'REACH', visual: 'lance',
    blurb: 'A reactor control rod with a glass tip. Keeps the ugly ones at range.',
    damageMult: 1.25, speedMult: 0.95, critBonus: 0.04,
    unlock: { copper: 220, caps: 2200 },
    stats: 'REACH · +4% CRIT',
  },
  {
    id: 'carbine', name: 'Pulse Carbine', icon: '⌁', tier: 'ENERGY', visual: 'rifle',
    blurb: 'Scavenged coilgun with a cracked cell. Spits light; asks no questions.',
    damageMult: 0.9, speedMult: 0.58, critBonus: 0.08,
    unlock: { titanium: 160, caps: 6000 },
    stats: 'RAPID FIRE · +8% CRIT',
  },
  {
    id: 'pistol', name: 'Scrap Pistol', icon: '🔫', tier: 'SIDEARM', visual: 'pistol',
    blurb: 'A pipe barrel, a nail for a firing pin, and one stubborn bullet at a time.',
    damageMult: 0.72, speedMult: 0.48, critBonus: 0.03,
    unlock: { scrap: 90, caps: 30 },
    stats: 'FAST SIDEARM · 0.36s SHOT',
  },
  {
    id: 'smg', name: 'Rivet SMG', icon: '⌇', tier: 'AUTO', visual: 'smg',
    blurb: 'A stamped receiver that eats rivets and spits them back at raiders.',
    damageMult: 0.55, speedMult: 0.36, critBonus: 0.02,
    unlock: { iron: 120, caps: 500 },
    stats: 'SPRAY · 0.27s BURST',
  },
  {
    id: 'shotgun', name: 'Slag Scattergun', icon: '⌖', tier: 'SPREAD', visual: 'shotgun',
    blurb: 'Sawn-off slagthrower. Whatever is in front of it becomes part of the wall.',
    damageMult: 1.4, speedMult: 0.92, critBonus: 0.03,
    unlock: { scrap: 400, iron: 90, caps: 900 },
    stats: 'CLOSE RANGE · 0.69s PUMP',
  },
  {
    id: 'rifle', name: 'Warden Rifle', icon: '⌐', tier: 'RIFLE', visual: 'rifle',
    blurb: 'A warden-issue marksman rifle with a cracked scope and a steady curse.',
    damageMult: 1.15, speedMult: 0.62, critBonus: 0.07,
    unlock: { iron: 300, copper: 90, caps: 2400 },
    stats: 'PRECISE · 0.47s CYCLE',
  },
  {
    id: 'mg', name: 'Breach MG', icon: '≡', tier: 'MACHINE GUN', visual: 'mg',
    blurb: 'Belt-fed, water-cooled, and held together by prayer and baling wire.',
    damageMult: 0.8, speedMult: 0.30, critBonus: 0.01,
    unlock: { iron: 600, copper: 220, caps: 6000 },
    stats: 'SUSTAINED FIRE · 0.23s BELT',
  },
  {
    id: 'railgun', name: 'Void Railgun', icon: '⌁', tier: 'ANOMALY', visual: 'railgun',
    blurb: 'A black-vault rail assembly that fires a sliver of folded space.',
    damageMult: 2.6, speedMult: 1.28, critBonus: 0.15,
    unlock: { titanium: 300, uranium: 120, singularity: 20, caps: 22000 },
    stats: 'PIERCE · 0.96s CHARGE',
  },
  {
    id: 'reaver', name: 'Void Reaver', icon: '☄', tier: 'ANOMALY', visual: 'reaver',
    blurb: 'A vault-forged scythe that cuts the space between heartbeats.',
    damageMult: 1.9, speedMult: 0.85, critBonus: 0.1,
    unlock: { uranium: 140, singularity: 18, caps: 18000 },
    stats: 'DEVASTATING · +10% CRIT',
  },
];

export const COMBAT_WEAPON_MAP = Object.fromEntries(COMBAT_WEAPONS.map((w) => [w.id, w]));

export function miningTool(state) {
  const loot = equippedItem(state, 'tool');
  return MINING_TOOL_MAP[loot?.classId] || MINING_TOOL_MAP[state?.equippedTool] || MINING_TOOLS[0];
}

export function combatWeapon(state) {
  const loot = equippedItem(state, 'weapon');
  return COMBAT_WEAPON_MAP[loot?.classId] || COMBAT_WEAPON_MAP[state?.equippedWeapon] || COMBAT_WEAPONS[0];
}

/* ── loot, rarities and character loadout ─────────────────── */
export const MAX_INVENTORY = 30;

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#9aa8b2', rank: 0, prefix: 'Scavenged', affixes: 1 },
  { id: 'uncommon', name: 'Uncommon', color: '#7fdc6a', rank: 1, prefix: 'Riveted', affixes: 2 },
  { id: 'rare', name: 'Rare', color: '#6fa8ff', rank: 2, prefix: "Warden's", affixes: 2 },
  { id: 'epic', name: 'Epic', color: '#c58bff', rank: 3, prefix: 'Reactor-Forged', affixes: 3 },
  { id: 'legendary', name: 'Legendary', color: '#ffb15c', rank: 4, prefix: 'Vault-Touched', affixes: 4 },
];
export const RARITY_MAP = Object.fromEntries(RARITIES.map((r) => [r.id, r]));

export const GEAR_SLOTS = [
  { id: 'weapon', name: 'WEAPON', icon: '⚔' },
  { id: 'tool', name: 'MINING TOOL', icon: '⛏' },
  { id: 'armor', name: 'ARMOR', icon: '⛨' },
  { id: 'helm', name: 'HEAD', icon: '☣' },
  { id: 'charm', name: 'CHARM', icon: '✦' },
];
export const GEAR_SLOT_MAP = Object.fromEntries(GEAR_SLOTS.map((s) => [s.id, s]));

export const GEAR_STAT_LABELS = {
  damage: 'DMG', crit: 'CRIT', speed: 'SPEED', hp: 'HP', heal: 'HEAL',
  defense: 'DEF', ore: 'ORE', caps: 'CAPS', xp: 'XP',
  power: 'POWER', yield: 'YIELD', cooldown: 'SWING',
};
const PCT_STATS = new Set(['damage', 'crit', 'speed', 'defense', 'ore', 'caps', 'xp', 'power', 'yield', 'cooldown']);

const LOOT_AFFIXES = {
  weapon: [
    { key: 'damage', min: 0.03, max: 0.12 },
    { key: 'crit', min: 0.005, max: 0.025 },
    { key: 'speed', min: 0.015, max: 0.06 },
    { key: 'hp', min: 5, max: 18, flat: true },
    { key: 'heal', min: 1, max: 4, flat: true },
  ],
  tool: [
    { key: 'power', min: 0.04, max: 0.14 },
    { key: 'yield', min: 0.04, max: 0.16 },
    { key: 'cooldown', min: 0.01, max: 0.05 },
    { key: 'crit', min: 0.005, max: 0.02 },
    { key: 'ore', min: 0.02, max: 0.08 },
  ],
  armor: [
    { key: 'hp', min: 8, max: 28, flat: true },
    { key: 'defense', min: 0.004, max: 0.014 },
    { key: 'heal', min: 1, max: 3, flat: true },
    { key: 'caps', min: 0.02, max: 0.07 },
  ],
  helm: [
    { key: 'hp', min: 4, max: 14, flat: true },
    { key: 'crit', min: 0.005, max: 0.022 },
    { key: 'xp', min: 0.02, max: 0.08 },
    { key: 'ore', min: 0.02, max: 0.07 },
  ],
  charm: [
    { key: 'ore', min: 0.02, max: 0.08 },
    { key: 'caps', min: 0.02, max: 0.08 },
    { key: 'crit', min: 0.004, max: 0.018 },
    { key: 'speed', min: 0.01, max: 0.04 },
  ],
};

const LOOT_BASE_NAMES = {
  armor: ['Scrap Carapace', 'Riveted Plate', 'Warden Shell', 'Reactor Carapace', 'Void Mantle'],
  helm: ['Filter Hood', 'Welder Mask', 'Ranger Helm', 'Warden Crown', 'Void Halo'],
  charm: ['Bone Charm', 'Geiger Rosary', 'Slag Talisman', 'Warden Sigil', 'Void Relic'],
};

export function rarityOf(item) {
  return RARITY_MAP[item?.rarity] || RARITIES[0];
}

export function equippedItem(state, slot) {
  const id = state?.loadout?.[slot];
  if (!id || !Array.isArray(state?.inventory)) return null;
  return state.inventory.find((item) => item.id === id) || null;
}

export function gearStats(state) {
  const total = {};
  for (const slot of GEAR_SLOTS) {
    const item = equippedItem(state, slot.id);
    if (!item) continue;
    for (const [key, value] of Object.entries(item.stats || {})) {
      total[key] = (total[key] || 0) + (Number(value) || 0);
    }
  }
  return total;
}

export function gearScore(item) {
  const stats = item?.stats || {};
  let score = 0;
  for (const [key, value] of Object.entries(stats)) {
    if (PCT_STATS.has(key)) score += value * 100;
    else if (key === 'hp') score += value * 0.4;
    else score += value * 2;
  }
  return Math.round(score);
}

export function gearStatText(key, value) {
  const label = GEAR_STAT_LABELS[key] || key.toUpperCase();
  if (PCT_STATS.has(key)) return `${label} +${(value * 100).toFixed(1)}%`;
  return `${label} +${Math.round(value)}`;
}

export function gearStatLines(item) {
  return Object.entries(item?.stats || {}).map(([key, value]) => gearStatText(key, value));
}

export function scrapValue(item) {
  const rarity = rarityOf(item);
  return Math.ceil(8 + (item?.level || 1) * 2.5 + rarity.rank * 14);
}

export function lootRunCost(state) {
  const level = Math.max(1, state?.level || 1);
  const zones = Math.max(1, state?.combat?.unlocked || 1);
  return Math.ceil(35 + level * 10 + (zones - 1) * 40);
}

function rollRarity(state, boss = false) {
  const bonus = Math.min(26,
    (state?.level || 1) * 0.35
    + (state?.combat?.unlocked || 1) * 2
    + (state?.shards || 0) * 0.6
    + (boss ? 8 : 0));
  const roll = Math.random() * 100;
  if (roll < 1 + bonus * 0.12) return RARITIES[4];
  if (roll < 4 + bonus * 0.32) return RARITIES[3];
  if (roll < 14 + bonus * 0.8) return RARITIES[2];
  if (roll < 38 + bonus * 0.4) return RARITIES[1];
  return RARITIES[0];
}

function pickSlot() {
  const roll = Math.random() * 100;
  if (roll < 28) return 'weapon';
  if (roll < 49) return 'tool';
  if (roll < 71) return 'armor';
  if (roll < 87) return 'helm';
  return 'charm';
}

export function makeLootItem(state, opts = {}) {
  const slotId = opts.slot || pickSlot();
  const slot = GEAR_SLOT_MAP[slotId];
  if (!slot) return null;
  const rarity = opts.rarity ? (RARITY_MAP[opts.rarity] || RARITIES[0]) : rollRarity(state, !!opts.boss);
  const level = Math.max(1, Math.floor(
    (state?.level || 1) * 0.8
    + (state?.combat?.unlocked || 1) * 2
    + (opts.boss ? 3 : 0)
    + Math.random() * 2
  ));

  let classId = null;
  let baseName;
  if (slotId === 'weapon') {
    const weapon = COMBAT_WEAPONS[Math.floor(Math.random() * COMBAT_WEAPONS.length)];
    classId = weapon.id;
    baseName = weapon.name;
  } else if (slotId === 'tool') {
    const tool = MINING_TOOLS[Math.floor(Math.random() * MINING_TOOLS.length)];
    classId = tool.id;
    baseName = tool.name;
  } else {
    const names = LOOT_BASE_NAMES[slotId];
    baseName = names[Math.min(names.length - 1, rarity.rank)];
  }

  const pool = [...LOOT_AFFIXES[slotId]].sort(() => Math.random() - 0.5).slice(0, rarity.affixes);
  const scale = (0.75 + Math.min(60, level) * 0.035) * (1 + rarity.rank * 0.12);
  const stats = {};
  for (const affix of pool) {
    const base = affix.min + Math.random() * (affix.max - affix.min);
    const value = base * scale * (affix.flat ? 1 + level * 0.08 : 1);
    stats[affix.key] = affix.flat ? Math.max(1, Math.round(value)) : Math.round(value * 1000) / 1000;
  }

  return {
    id: `loot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    slot: slotId,
    rarity: rarity.id,
    name: `${rarity.prefix} ${baseName}`,
    level,
    classId,
    stats,
  };
}

export function sanitizeLootItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const slot = GEAR_SLOT_MAP[raw.slot];
  if (!slot) return null;
  const rarity = RARITY_MAP[raw.rarity] || RARITIES[0];
  const stats = {};
  for (const [key, value] of Object.entries(raw.stats || {})) {
    if (!(key in GEAR_STAT_LABELS)) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) stats[key] = n;
  }
  if (!Object.keys(stats).length) return null;
  const classId = (slot.id === 'weapon' && COMBAT_WEAPON_MAP[raw.classId])
    ? raw.classId
    : (slot.id === 'tool' && MINING_TOOL_MAP[raw.classId]) ? raw.classId : null;
  return {
    id: String(raw.id || `loot_${Math.random().toString(36).slice(2, 9)}`),
    slot: slot.id,
    rarity: rarity.id,
    name: String(raw.name || `${rarity.prefix} ${slot.name}`),
    level: Math.max(1, Math.floor(Number(raw.level) || 1)),
    classId,
    stats,
  };
}

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

/* ── crew grades and salvage chests ────────────────────────── */
/* A crew member is a person: { id, grade, name }. Every member boosts
   every ore source by their grade bonus. Grade 1 (Drifter, COMMON) is
   the baseline; grade 5 (TRUE SURVIVOR) is the crown of the roster. */
export const CREW_GRADES = [
  { grade: 1, id: 'drifter', title: 'COMMON CREW', name: 'Drifter', bonus: 0.08, color: '#9aa8b2', icon: '☗' },
  { grade: 2, id: 'steady', title: 'RIVETED CREW', name: 'Steady Hand', bonus: 0.12, color: '#7fdc6a', icon: '⚙' },
  { grade: 3, id: 'foreman', title: 'VETERAN CREW', name: 'Foreman', bonus: 0.17, color: '#6fa8ff', icon: '⚑' },
  { grade: 4, id: 'overseer', title: 'WARDEN CREW', name: 'Overseer', bonus: 0.22, color: '#c58bff', icon: '⛨' },
  { grade: 5, id: 'legend', title: 'TRUE SURVIVOR', name: 'True Survivor', bonus: 0.30, color: '#ffb15c', icon: '☄' },
];
export const CREW_GRADE_MAP = Object.fromEntries(CREW_GRADES.map((g) => [g.grade, g]));
export const CREW_LIMIT = 16;

export function gradeOf(member) {
  const g = Math.min(5, Math.max(1, Math.floor(Number(member?.grade) || 1)));
  return CREW_GRADE_MAP[g];
}
export function crewCount(state) {
  return Array.isArray(state.crew) ? state.crew.length : Math.floor(Number(state.crew) || 0);
}
export function crewBonus(state) {
  let sum = 0;
  for (const member of state.crew || []) sum += gradeOf(member).bonus;
  return sum;
}
export function rosterFull(state) {
  return crewCount(state) >= CREW_LIMIT;
}

export const CREW_CHESTS = [
  {
    id: 'common', name: 'COMMON CHEST', icon: '▣', color: '#9aa8b2',
    cost: { caps: 500 }, weights: [0.72, 0.24, 0.04, 0, 0],
    blurb: 'Locked crates from the overpass. Mostly drifters inside.',
  },
  {
    id: 'rare', name: 'RARE CHEST', icon: '◈', color: '#6fa8ff',
    cost: { caps: 2600 }, weights: [0.15, 0.45, 0.30, 0.10, 0],
    blurb: 'Salvage-vault seals intact. Steady hands and foremen are common here.',
  },
  {
    id: 'epic', name: 'EPIC CHEST', icon: '✦', color: '#c58bff',
    cost: { caps: 9000 }, weights: [0, 0.25, 0.45, 0.22, 0.08],
    blurb: 'Warden-era lockboxes. Overseers keep their own boots on.',
  },
  {
    id: 'legendary', name: 'LEGENDARY CHEST', icon: '☄', color: '#ffb15c',
    cost: { caps: 28000 }, weights: [0, 0, 0.20, 0.47, 0.33],
    blurb: 'Someone from the old world sleeps inside. Every legend started here.',
  },
];
export const CHEST_MAP = Object.fromEntries(CREW_CHESTS.map((c) => [c.id, c]));

export const CREW_NAMES = [
  'Dust', 'Rook', 'Vex', 'Sadie', 'Marrow', 'Kite', 'Halo', 'Socks',
  'Grinner', 'Salt', 'Pyre', 'Nickel', 'Wren', 'Moss', 'Tally', 'Hex',
  'Bones', 'Flint', 'Sparrow', 'Comet', 'Slate', 'Juniper', 'Ember', 'Cinder',
];

export function rollCrewGrade(weights) {
  const roll = Math.random();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (roll < acc) return Math.min(5, i + 1);
  }
  return 1;
}

export function makeCrewMember(grade, opts = {}) {
  const gradeName = CREW_GRADE_MAP[grade].name;
  const name = opts.name || CREW_NAMES[Math.floor(Math.random() * CREW_NAMES.length)] + ' the ' + gradeName;
  return {
    id: opts.id || `crew_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    grade,
    name,
  };
}

/* ── tokens, gambler's slot and sideline games ─────────────── */
/* Tokens are a run-persistent currency: the survivor earns one for
   every 10 levels of progress and spends them on games of chance. */
export const MILESTONE_EVERY = 10;
export function tokenMilestonesTotal(level) {
  return Math.floor(Math.max(0, Math.floor(level || 0)) / MILESTONE_EVERY);
}
export function tokenBasePay(level) {
  return 80 + Math.max(1, Math.floor(level || 1)) * 20;
}

export function rollSlotSpin() {
  const roll = Math.random();
  const fill = (a, b, c) => ({ reels: [a, b, c] });
  if (roll < 0.02) return { label: 'JACKPOT', mult: 20, tone: 'lore', ...fill('★', '★', '★') };
  if (roll < 0.05) return { label: 'TRIPLE TOOLS', mult: 8, tone: 'good', ...fill('⚙', '⚙', '⚙') };
  if (roll < 0.15) {
    const g = Math.random() < 0.5 ? '⛏' : '⚙';
    const other = g === '⛏' ? '⚙' : '☠';
    return { label: 'A PAIR', mult: 3, tone: 'good', ...fill(g, g, other) };
  }
  if (roll < 0.40) return { label: 'SCRAP SPARK', mult: 0.5, tone: '', ...fill('▞', '▞', '☠') };
  return { label: 'NO MATCH', mult: 0, tone: 'bad', ...fill('☠', '⛏', '▞') };
}

/* ── the pit: NPC duels from level 1 upward ────────────────── */
export const PIT_TOKEN_CHANCE = 0.18;

export const PIT_ROSTER = [
  'Scrap Punk', 'Bleacher Rat', 'Rust Champion', 'Road Duelist',
  'Slag Brute', 'Wire Ghost', 'Foundry Brawler', 'Glass Stalker',
  'Ash Marshal', 'Reactor Ronin', 'Vault Fanatic', 'Null Duelist',
  'Warden Adept', 'Prime Myrmidon', 'Echo of the Old Camp', 'Last Undefeated',
];

export function pitRankOf(wins) {
  return Math.min(6, 1 + Math.floor(wins / 5));
}
export const PIT_RANK_NAMES = [
  'JUNK BRACKET', 'RIVET BRACKET', 'EMBER BRACKET',
  'STORM BRACKET', 'WARDEN BRACKET', 'TRUE SURVIVOR BRACKET',
];
export function pitRankName(wins) {
  return PIT_RANK_NAMES[pitRankOf(wins) - 1];
}

export function makeChallenger(state) {
  const stats = playerStats(state);
  const wins = (state.pit && Math.floor(state.pit.wins)) || 0;
  const hpRamp = 0.5 + 0.15 * Math.min(10, wins);
  const dmgRamp = 0.35 + 0.04 * Math.min(12, wins);
  const name = `${PIT_ROSTER[Math.min(PIT_ROSTER.length - 1, Math.floor(wins / 2))]} · RANK ${pitRankOf(wins)}`;
  return {
    name,
    maxHp: Math.max(30, Math.round(stats.maxHp * hpRamp)),
    hp: Math.max(30, Math.round(stats.maxHp * hpRamp)),
    attack: Math.max(2, stats.attack * dmgRamp),
    crit: Math.min(0.45, stats.crit * 0.8),
    defense: Math.min(0.35, stats.defense * 0.7),
  };
}

export function pitCapsReward(state) {
  const level = Math.max(1, state.level || 1);
  const wins = (state.pit && Math.floor(state.pit.wins)) || 0;
  return Math.round((45 + level * 14) * (1 + wins * 0.16));
}

/* Scrap dig: a quick 5-round timing game on a moving marker. */
export const DIG_ROUNDS = 5;
export const DIG_COOLDOWN = 45000;
export function digRoundPay(level) {
  return 20 + Math.max(1, level) * 6;
}

export function attributeOreMult(state) {
  return 1 + attrLevel(state, 'luk') * 0.008;
}
export function attributeCapsMult(state) {
  return 1 + attrLevel(state, 'luk') * 0.015;
}
export function oreMultiplier(state) {
  return outfitOreMult(state) * attributeOreMult(state) * perkOreMult(state) * (1 + (gearStats(state).ore || 0));
}
export function xpMultiplier(state) {
  return outfitXpMult(state) * perkXpMult(state) * (1 + (gearStats(state).xp || 0));
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
export function crewMult(state) {
  let bonus = 0;
  const roster = state.crew;
  if (Array.isArray(roster)) {
    for (const member of roster) bonus += gradeOf(member).bonus;
  } else {
    // legacy numeric saves: every recruit was an 8% Drifter
    bonus = Math.max(0, Math.floor(Number(roster) || 0)) * 0.08;
  }
  return 1 + bonus;
}

/* Passive income from working the salvage line. Each drill rig contributes a
   small cap trickle, modified by the same charm/luck/scavenger bonuses as kills. */
export function salvageCapsRate(state) {
  const drills = (state.drills || []).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
  return drills * 0.08 * outfitCapsMult(state) * attributeCapsMult(state) * perkCapsMult(state)
    * (1 + (gearStats(state).caps || 0));
}

export function pickPower(state) {
  return (2 + 2.3 * (state.pickaxe - 1))
    * miningTool(state).powerMult
    * (1 + (gearStats(state).power || 0));
}

export function toolCooldown(state) {
  return Math.max(8, Math.round(miningTool(state).cooldown * (1 - Math.min(0.5, gearStats(state).cooldown || 0))));
}

export function nodeRichness(node) { return 1 + 0.04 * (node || 0); }

export function layerMaxHp(state, layerIndex) {
  const layer = LAYERS[layerIndex];
  return Math.ceil(layer.hp * (1 + 0.08 * (state.nodes[layerIndex] || 0)));
}

export function strikeYield(state, layerIndex) {
  const layer = LAYERS[layerIndex];
  return layer.baseYield
    * (1 + 0.22 * (state.pickaxe - 1))
    * miningTool(state).yieldMult
    * (1 + (gearStats(state).yield || 0))
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

export function crewCost(memberCount) {
  return { caps: Math.ceil(120 * Math.pow(1.75, memberCount)) };
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
  const gear = gearStats(state);
  const duster = Math.max(0, Math.floor(outfits.duster || 0));
  const rebreather = Math.max(0, Math.floor(outfits.rebreather || 0));
  const charm = Math.max(0, Math.floor(outfits.charm || 0));
  const str = attrLevel(state, 'str');
  const vit = attrLevel(state, 'vit');
  const agi = attrLevel(state, 'agi');
  const luk = attrLevel(state, 'luk');
  const baseHp = 100 + 30 * (g.armor - 1) + vit * 8 + (gear.hp || 0);
  const maxHp = Math.max(1, Math.round(
    baseHp
    * levelHpMult(state)
    * (1 + duster * 0.025)
    * perkHpMult(state)
  ));
  const weapon = combatWeapon(state);
  const attack = (4 + 4 * (g.weapon - 1))
    * weapon.damageMult
    * (1 + (gear.damage || 0))
    * levelAtkMult(state)
    * (1 + str * 0.025)
    * shardDamageMult(state)
    * perkAtkMult(state);
  const crit = Math.min(0.60, 0.12 + rebreather * 0.015 + agi * 0.006 + perkCritBonus(state) + weapon.critBonus + (gear.crit || 0));
  const defense = Math.min(0.68, 0.035 * (g.armor - 1) + duster * 0.006 + vit * 0.004 + (gear.defense || 0));
  const capsMult = (1 + charm * 0.03) * (1 + luk * 0.015) * perkCapsMult(state) * (1 + (gear.caps || 0));
  return {
    maxHp,
    attack,
    crit,
    defense,
    capsMult,
    oreMult: oreMultiplier(state),
    xpMult: xpMultiplier(state),
    healPerKill: (g.stim > 0 ? 8 + 5 * g.stim : 6) + perkHealBonus(state) + (gear.heal || 0),
    deathMs: 5000,
    speedMult: perkSpeedMult(state) * (1 + (gear.speed || 0)),
    level: lvl,
  };
}

export function playerAttackInterval(state) {
  const mult = state ? perkSpeedMult(state) : 1;
  const weapon = state ? combatWeapon(state) : COMBAT_WEAPONS[0];
  const speed = state ? (gearStats(state).speed || 0) : 0;
  return Math.max(220, Math.round((750 * weapon.speedMult) / (mult * (1 + speed))));
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
