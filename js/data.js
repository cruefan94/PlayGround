// ---------------------------------------------------------------------------
// FIREBASE RAVEN — static game data
// A fictional 1968 Vietnam War engagement. Equipment references are period.
// ---------------------------------------------------------------------------

export const COLS = 12
export const ROWS = 9
export const MAX_TURNS = 10
export const HEX_SIZE = 48
export const BOARD_PAD = 38
export const HEX_W = Math.sqrt(3) * HEX_SIZE
export const BOARD_W = BOARD_PAD * 2 + COLS * HEX_W + HEX_W / 2
export const BOARD_H = BOARD_PAD * 2 + HEX_SIZE * 2 + (ROWS - 1) * HEX_SIZE * 1.5

export const TERRAIN = {
  jungle: {
    name: 'Jungle', move: 2, cover: 2, color: '#24341f', edge: '#1a2717',
    detail: 'Dense triple-canopy jungle. Slow going, excellent cover.'
  },
  paddy: {
    name: 'Rice Paddy', move: 1, cover: 0, color: '#4f5f34', edge: '#3d4a28',
    detail: 'Flooded, open ground. Fast but brutally exposed.'
  },
  hill: {
    name: 'Hill', move: 2, cover: 1, color: '#5a5537', edge: '#47432b',
    detail: 'Broken high ground. Elevation and scattered cover.'
  },
  village: {
    name: 'Ban Doc Village', move: 1, cover: 2, color: '#6b5938', edge: '#54452c',
    detail: 'Thatched hooches and hedgerows. Strong cover.'
  },
  base: {
    name: 'Firebase Raven', move: 1, cover: 2, color: '#665d43', edge: '#4f4834',
    detail: 'Sandbagged firebase. Strong cover from prepared positions.'
  },
  grass: {
    name: 'Elephant Grass', move: 1, cover: 1, color: '#4f5b33', edge: '#3e4827',
    detail: 'Waist-high grass. Some concealment, little protection.'
  },
  river: {
    name: 'Song River', move: 99, cover: 0, color: '#2b4d50', edge: '#203c3f',
    water: true, impassable: true,
    detail: 'Deep, fast water. Impassable except at the bridge.'
  },
  bridge: {
    name: 'Bridge', move: 1, cover: 0, color: '#67532f', edge: '#4d3d23',
    detail: 'Timber bridge over the Song River. A vital choke point.'
  }
}

// 12 columns × 9 rows. B = firebase, P = paddy, J = jungle, H = hill,
// V = village, G = elephant grass, R = river (bridge painted at 10,4).
const MAP_ROWS = [
  'JJJJJHHJJVRJ',
  'JJJJJHJJVVRJ',
  'GGGJJJJJVVRJ',
  'BBBGJJVVVJRJ',
  'GBBBBGVVVGRJ',
  'JBBBBGPPPPRJ',
  'JJGGGPPPPPRJ',
  'JJGPPPPPPPRJ',
  'JJPPPPPPPPRJ'
]

export const BRIDGE = { c: 10, r: 4 }

// A few cosmetic shell craters, kept away from critical paths.
export const CRATERS = [
  { c: 5, r: 4, s: 16 },
  { c: 6, r: 6, s: 11 },
  { c: 9, r: 5, s: 13 },
  { c: 4, r: 6, s: 9 },
  { c: 7, r: 5, s: 8 }
]

const TERRAIN_BY_CODE = {
  J: TERRAIN.jungle,
  P: TERRAIN.paddy,
  H: TERRAIN.hill,
  V: TERRAIN.village,
  B: TERRAIN.base,
  G: TERRAIN.grass,
  R: TERRAIN.river
}

export function terrainAt(c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null
  if (c === BRIDGE.c && r === BRIDGE.r) return TERRAIN.bridge
  return TERRAIN_BY_CODE[MAP_ROWS[r][c]] || null
}

export function terrainKeyAt(c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null
  if (c === BRIDGE.c && r === BRIDGE.r) return 'bridge'
  return MAP_ROWS[r][c]
}

export const ROAD_CELLS = new Set(
  Array.from({ length: COLS }, (_, c) => `${c},4`)
)

export function isRoad(c, r) {
  return ROAD_CELLS.has(`${c},${r}`)
}

export function isBaseCell(c, r) {
  return terrainKeyAt(c, r) === 'B'
}

// ---------------------------------------------------------------------------
// Unit catalogue
// ---------------------------------------------------------------------------

export const UNIT_TYPES = {
  // United States / ARVN
  alpha: {
    side: 'us', name: 'Alpha Squad', callsign: 'ALPHA', role: 'infantry',
    weapon: 'M16A1 · 5.56mm', icon: 'rifle', hp: 12, soft: 6, armorAtk: 2,
    range: 1, move: 2, armor: 0,
    blurb: 'Rifle squad. Balanced movement and close-range firepower.'
  },
  bravo: {
    side: 'us', name: 'Bravo Squad', callsign: 'BRAVO', role: 'mg',
    weapon: 'M60 · 7.62mm', icon: 'mg', hp: 12, soft: 5, armorAtk: 2,
    range: 2, move: 1, armor: 0, suppression: true,
    blurb: 'Machine-gun team. Longer reach; pins enemy units.'
  },
  delta: {
    side: 'us', name: 'Delta Squad', callsign: 'DELTA', role: 'grenadier',
    weapon: 'M79 · 40mm', icon: 'm79', hp: 12, soft: 7, armorAtk: 3,
    range: 2, move: 2, armor: 0, splash: 2,
    blurb: 'Grenadier team. Splash damage against clustered targets.'
  },
  patton: {
    side: 'us', name: 'M48A3 Patton', callsign: 'IRONHIDE', role: 'armor',
    weapon: '90mm M41', icon: 'tank', hp: 20, soft: 7, armorAtk: 10,
    range: 2, move: 3, armor: 2, vehicle: true,
    blurb: 'Main battle tank. Devastating against armour; thin-skinned to RPGs.'
  },
  acav: {
    side: 'us', name: 'M113 ACAV', callsign: 'TRACKER', role: 'apc',
    weapon: 'M2 · .50 cal', icon: 'apc', hp: 16, soft: 6, armorAtk: 4,
    range: 2, move: 4, armor: 1, vehicle: true, suppression: true,
    blurb: 'Armoured cavalry vehicle. Fast, versatile, and a rocket magnet.'
  },
  bunker: {
    side: 'us', name: 'Command Bunker', callsign: 'RAVEN 6', role: 'bunker',
    weapon: '—', icon: 'bunker', hp: 18, soft: 0, armorAtk: 0,
    range: 0, move: 0, armor: 2, immobile: true, objective: true, cannotAct: true,
    blurb: 'The firebase command post. If it falls, the valley is lost.'
  },

  // North Vietnamese Army / Viet Cong
  vc: {
    side: 'nva', name: 'VC Sapper', callsign: 'VC', role: 'sapper',
    weapon: 'AK-47 · satchel', icon: 'vc', hp: 9, soft: 4, armorAtk: 4,
    range: 1, move: 2, armor: 0, demo: 2,
    blurb: 'Local force sapper. Fast, stealthy, and deadly against bunkers.'
  },
  nva: {
    side: 'nva', name: 'NVA Rifle Squad', callsign: 'NVA', role: 'infantry',
    weapon: 'AK-47 · 7.62mm', icon: 'nva', hp: 10, soft: 5, armorAtk: 3,
    range: 1, move: 2, armor: 0,
    blurb: 'Regular NVA infantry. Disciplined and persistent.'
  },
  rpg: {
    side: 'nva', name: 'NVA RPG Team', callsign: 'RPG', role: 'antiarmor',
    weapon: 'RPG-2 · 82mm', icon: 'rpg', hp: 8, soft: 3, armorAtk: 9,
    range: 1, move: 2, armor: 0, antiarmor: true,
    blurb: 'Shoulder-fired anti-tank team. Priority threat to vehicles.'
  },
  pt76: {
    side: 'nva', name: 'PT-76', callsign: 'PT-76', role: 'armor',
    weapon: '76.2mm D-56T', icon: 'pt76', hp: 16, soft: 5, armorAtk: 6,
    range: 2, move: 3, armor: 2, vehicle: true, amphibious: true,
    blurb: 'Amphibious light tank. Can ford the Song River away from the bridge.'
  },
  mortar: {
    side: 'nva', name: '82mm Mortar Team', callsign: 'MORTAR', role: 'mortar',
    weapon: '82mm mortar', icon: 'mortar', hp: 8, soft: 4, armorAtk: 2,
    range: 5, minRange: 2, move: 1, armor: 0, indirect: true, suppression: true,
    blurb: 'Indirect-fire team. Shells the firebase from stand-off range.'
  },
  command: {
    side: 'nva', name: 'NVA Command Group', callsign: 'COMMAND', role: 'command',
    weapon: 'AK-47 · radio', icon: 'command', hp: 12, soft: 5, armorAtk: 3,
    range: 1, move: 2, armor: 0, aura: 2,
    blurb: 'Battalion command element. Its presence sharpens nearby attacks.'
  }
}

export const PLAYER_ORDER = ['alpha', 'bravo', 'delta', 'patton', 'acav', 'bunker']

export const STARTING_UNITS = [
  { type: 'bunker', c: 2, r: 4 },
  { type: 'alpha', c: 3, r: 4 },
  { type: 'bravo', c: 1, r: 4 },
  { type: 'delta', c: 2, r: 3 },
  { type: 'patton', c: 4, r: 4 },
  { type: 'acav', c: 4, r: 5 }
]

export const INITIAL_ENEMIES = [
  { type: 'vc', c: 8, r: 3 },
  { type: 'vc', c: 9, r: 6 }
]

// Waves arrive at the start of the listed player turn.
export const WAVES = {
  2: [
    { type: 'nva', c: 11, r: 5 },
    { type: 'vc', c: 11, r: 6 }
  ],
  3: [
    { type: 'mortar', c: 8, r: 0 },
    { type: 'nva', c: 11, r: 2 }
  ],
  4: [
    { type: 'pt76', c: 11, r: 4 },
    { type: 'rpg', c: 11, r: 6 }
  ],
  5: [
    { type: 'nva', c: 11, r: 3 },
    { type: 'vc', c: 9, r: 0 }
  ],
  6: [
    { type: 'pt76', c: 11, r: 5 },
    { type: 'rpg', c: 11, r: 2 }
  ],
  7: [
    { type: 'nva', c: 11, r: 7 },
    { type: 'nva', c: 11, r: 3 },
    { type: 'mortar', c: 7, r: 0 }
  ],
  8: [
    { type: 'pt76', c: 11, r: 6 },
    { type: 'rpg', c: 11, r: 4 }
  ],
  9: [
    { type: 'command', c: 11, r: 4 },
    { type: 'vc', c: 11, r: 1 },
    { type: 'vc', c: 11, r: 7 }
  ],
  10: []
}

export const SUPPORTS = {
  artillery: {
    name: '105mm Fire Mission', short: '105mm', cost: 2, charges: 3,
    weapon: 'M101A1 howitzer battery', target: 'hex',
    desc: 'Off-map 105mm battery. Heavy damage in the target hex and lighter damage to adjacent hexes. Danger close.'
  },
  huey: {
    name: 'UH-1B Gunship', short: 'HUEY', cost: 2, charges: 2,
    weapon: 'UH-1B · rockets / M134', target: 'hex',
    desc: 'Rocket and minigun run. Damages and suppresses every enemy in the blast radius. No friendly fire.'
  },
  dustoff: {
    name: 'Dustoff Medevac', short: 'MEDEVAC', cost: 1, charges: 2,
    weapon: 'UH-1D medical evacuation', target: 'friendly',
    desc: 'Restore 7 HP and clear suppression on one friendly unit. Cannot revive a destroyed unit.'
  }
}

export const MAP_LABELS = [
  { text: 'FIREBASE RAVEN', c: 1.7, r: 2.15, size: 13, color: 'rgba(224,212,176,.72)', spacing: 2.2 },
  { text: 'BAN DOC', c: 7.1, r: 2.35, size: 12, color: 'rgba(224,212,176,.55)', spacing: 2.4 },
  { text: 'HILL 881', c: 5.3, r: 0.78, size: 11, color: 'rgba(224,212,176,.48)', spacing: 2 },
  { text: 'RICE PADDIES', c: 7.1, r: 7.3, size: 11, color: 'rgba(224,212,176,.38)', spacing: 2.4 },
  { text: 'SONG RIVER', c: 10.55, r: 6.4, size: 11, color: 'rgba(186,215,205,.5)', spacing: 2.2, rotate: Math.PI / 2 }
]

export const FLAVOR = {
  calls: [
    'Raven 6, this is Alpha. Contact, east side of the village.',
    'Foxtrot, foxtrot. Small arms from the tree line.',
    'Raven 6, we have movement across the paddy.',
    'Ironhide is buttoned up and ready.',
    'Tracker actual, .50 cal laid on the bridge.'
  ],
  enemy: [
    'Movement in the tree line.',
    'Sappers are working through the wire.',
    'Mortar fire! Everyone down!',
    'RPG team on the east bank!',
    'They are massing for another push.'
  ],
  relief: [
    'Relief column is on the road. Hold fast.',
    'Dawn in ten minutes. Keep that bunker.',
    'Raven 6, the cavalry is coming up Route 9.'
  ]
}

export const UNIT_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
