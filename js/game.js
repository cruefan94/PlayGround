'use strict';
/* ============================================================
   NAM '68 — Operation Iron Triangle.
   Top-down wave shooter + human squad reinforcements + store.
   ============================================================ */
const CV = document.getElementById('cv'), CX = CV.getContext('2d');
const WW = 1560, WH = 1180, VW = 1280, VH = 720, TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const lerp = (a, b, t) => a + (b - a) * t;
const curGun = () => (R && R.run.p.wi === 1 ? R.run.p.w1 : R.run.p.w2);
const $ = id => document.getElementById(id);

/* ---------------- weapon pricing + rarity tiers ---------------- */
const CAT_LABEL = { AR: 'RIFLE', BR: 'BATTLE RIFLE', SM: 'SMG', SG: 'SHOTGUN', SN: 'SNIPER', MG: 'LMG', PI: 'PISTOL', SP: 'SPECIAL' };
const CAT_PRICE = { PI: 34, SM: 52, SG: 66, AR: 92, BR: 104, SN: 138, MG: 185, SP: 205 };
for (const w of WEAPONS) {
  w.price = Math.round(CAT_PRICE[w.c] + w.d * 1.15 + w.m * .5 + (w.md === 'auto' ? 12 : 0) + (w.pc > 1 ? 8 : 0));
}
{
  const sorted = WEAPONS.slice().sort((a, b) => a.price - b.price);
  const bucket = Math.ceil(sorted.length / 5);
  sorted.forEach((w, i) => w.tier = clamp(1 + Math.floor(i / bucket), 1, 5));
}
const ARMOR_TIER = [1, 1, 2, 2, 3, 3, 4, 5];
const CLOTH_TIER = [1, 1, 2, 3, 3, 4];
const BOOT_TIER = [1, 2, 3];
const wByName = n => WEAPONS.find(w => w.n === n);
const armorById = i => ARMORS[i] || ARMORS[0];
const mateByName = n => MATES.find(r => r.name === n);

/* ---------------- persistent profile ---------------- */
const SAVE_KEY = 'nam68_v3';
const DEF = () => ({
  name: '', skin: 0, head: 0, paint: 0, cloth: 0, boots: 0, armor: 0,
  primary: 'M3 Grease Gun', sidearm: 'M1911A1 .45',
  ownedW: ['M3 Grease Gun', 'M1911A1 .45'],
  ownedArm: [0], ownedCloth: [0], ownedBoots: [0],
  ownedMates: [], squad: [null, null, null],
  req: ECON.startReq, bestRound: 0, bestScore: 0, totalKills: 0, bosses: 0, raidLast: 0,
});
let S = DEF();
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const p = JSON.parse(raw); if (p.ownedBots && !p.ownedMates) { p.ownedMates = p.ownedBots; delete p.ownedBots; } S = Object.assign(DEF(), p); } } catch (e) { }
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } };

/* ---------------- squad buffs ---------------- */
function computeBuffs() {
  const b = { dmg: 0, spd: 0, hp: 0, prot: 0, reload: 0 };
  S.squad.forEach(n => { const r = n && mateByName(n); if (r) b[r.buff] += r.buffVal; });
  return b;
}

/* ---------------- tiny synth audio ---------------- */
let AC = null, NOISE = null;
function audio() {
  if (!AC) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    AC = new Ctx();
    NOISE = AC.createBuffer(1, AC.sampleRate * .5, AC.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function boom(vol, dur, f0, f1) {
  const ac = audio(); if (!ac) return;
  const src = ac.createBufferSource(); src.buffer = NOISE;
  const flt = ac.createBiquadFilter(); flt.type = 'lowpass';
  flt.frequency.setValueAtTime(f0, ac.currentTime);
  flt.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur);
  src.connect(flt); flt.connect(g); g.connect(ac.destination);
  src.start(); src.stop(ac.currentTime + dur);
}
function tone(freq, dur, vol, type, slide) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq - slide), ac.currentTime + dur);
  g.gain.setValueAtTime(vol || .15, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur);
  o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}
function sShot(w) {
  const c = w ? w.c : 'AR';
  if (c === 'PI') boom(.22, .1, 1600, 500);
  else if (c === 'SN') { boom(.38, .3, 1500, 100); tone(120, .12, .08, 'sawtooth', 60); }
  else if (c === 'MG') boom(.26, .12, 900, 200);
  else if (c === 'SG') boom(.4, .22, 1100, 90);
  else if (c === 'SP') { tone(220, .2, .16, 'sawtooth', 140); boom(.28, .25, 500, 80); }
  else boom(.24, .13, 1400, 220);
}
const sHit = () => boom(.12, .07, 700, 300);
const sHurt = () => { boom(.28, .2, 500, 100); tone(90, .18, .14, 'sawtooth', 50); };
const sExpl = () => { boom(.5, .5, 300, 40); tone(70, .35, .22, 'sawtooth', 40); };
const sDry = () => tone(700, .04, .06, 'square', 300);
const sReload = () => { tone(500, .05, .08, 'square'); setTimeout(() => tone(700, .05, .08, 'square'), 130); };
const sCash = () => { tone(880, .07, .09, 'square'); setTimeout(() => tone(1320, .09, .09, 'square'), 70); };
const sHeal = () => tone(520, .15, .08, 'sine', 200);
const sBoss = () => { tone(60, .8, .28, 'sawtooth', 20); boom(.4, .7, 400, 60); };
const sGren = () => tone(240, .12, .12, 'sine', 120);
const sLoot = () => { tone(300, .1, .12, 'triangle'); setTimeout(() => tone(500, .12, .12, 'triangle'), 110); setTimeout(() => tone(750, .16, .12, 'triangle'), 240); };

/* ---------------- sprites ---------------- */
function drawSoldier(c, x, y, a, k) {
  const s = k.scale || 1;
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(2 * s, 4 * s, 12 * s, 8.5 * s, 0, 0, TAU); c.fill();
  c.rotate(a + Math.PI / 2);
  c.fillStyle = k.body; c.beginPath(); c.ellipse(0, 0, 9 * s, 12 * s, 0, 0, TAU); c.fill();
  c.fillStyle = k.alt; c.beginPath(); c.ellipse(0, 4 * s, 6.5 * s, 5 * s, 0, 0, TAU); c.fill();
  if (k.prot > 0) {
    c.fillStyle = 'rgba(26,26,20,' + Math.min(.8, k.prot * 1.5) + ')';
    c.beginPath(); c.ellipse(0, .5 * s, 8.6 * s, 9 * s, 0, 0, TAU); c.fill();
  }
  c.strokeStyle = k.body; c.lineWidth = 4 * s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(6.5 * s, 2 * s); c.lineTo(12 * s, -6 * s); c.stroke();
  c.beginPath(); c.moveTo(-6.5 * s, 2 * s); c.lineTo(2 * s, -8 * s); c.stroke();
  c.strokeStyle = '#2b2317'; c.lineWidth = 3.2 * s;
  c.beginPath(); c.moveTo(3 * s, -4 * s); c.lineTo(18 * s, -14 * s); c.stroke();
  c.fillStyle = k.skin; c.beginPath(); c.arc(0, 1.5 * s, 5.4 * s, 0, TAU); c.fill();
  if (k.paint === 1) { c.fillStyle = 'rgba(20,40,15,.75)'; c.fillRect(-5 * s, -.5 * s, 4 * s, 2.2 * s); c.fillRect(1.6 * s, -1 * s, 3.4 * s, 2.4 * s); }
  if (k.paint === 2) { c.fillStyle = 'rgba(15,32,12,.8)'; c.fillRect(-6 * s, 0, 12 * s, 2.6 * s); c.fillStyle = 'rgba(90,80,40,.5)'; c.fillRect(-6 * s, -3.4 * s, 12 * s, 2.6 * s); }
  if (k.head === 0) { c.fillStyle = '#4a4a33'; c.beginPath(); c.arc(0, 1.5 * s, 6 * s, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.4 * s; c.stroke(); }
  else if (k.head === 1) { c.fillStyle = '#a3402e'; c.beginPath(); c.arc(0, .3 * s, 5.6 * s, Math.PI, TAU); c.fill(); c.fillRect(-5.6 * s, .3 * s, 11.2 * s, 1.8 * s); }
  else if (k.head === 2) { c.fillStyle = '#8a7b4e'; c.beginPath(); c.arc(0, 1.5 * s, 6 * s, 0, TAU); c.fill(); c.strokeStyle = 'rgba(138,123,78,.85)'; c.lineWidth = 2.4 * s; c.beginPath(); c.arc(0, 1.5 * s, 8.4 * s, 0, TAU); c.stroke(); }
  else { c.fillStyle = 'rgba(30,22,12,.9)'; c.beginPath(); c.arc(0, -.4 * s, 4.8 * s, Math.PI, TAU); c.fill(); }
  c.restore();
}
// squadmate: soldier in national uniform with tier chevron
function drawMate(c, x, y, a, m, hpFrac) {
  const nat = NAT_COL[m.nat] || NAT_COL.US;
  const headStyle = m.nat === 'US' ? 0 : 2; // ARVN/ROK/AUS wear boonies
  drawSoldier(c, x, y, a, { body: nat[0], alt: nat[1], skin: m.nat === 'ARVN' || m.nat === 'ROK' ? '#c98d5f' : '#e6b78e', head: headStyle, paint: 1, prot: m.tier >= 3 ? .35 : 0, scale: 1 });
  // rank/tier chevrons above the soldier
  c.save();
  const t = m.tier;
  for (let i = 0; i < Math.min(5, t); i++) {
    c.fillStyle = TIER_COL[t - 1];
    const cx0 = x - 11 + i * 5.5;
    c.beginPath(); c.moveTo(cx0, y - 24); c.lineTo(cx0 + 3, y - 27); c.lineTo(cx0 + 6, y - 24); c.lineTo(cx0 + 3, y - 21); c.closePath(); c.fill();
  }
  c.restore();
  if (hpFrac < 1) {
    c.fillStyle = '#000'; c.fillRect(x - 12, y - 18, 24, 3);
    c.fillStyle = '#6aa2c8'; c.fillRect(x - 12, y - 18, 24 * clamp(hpFrac, 0, 1), 3);
  }
}

/* ---------------- ground painting (per area) ---------------- */
const ground = document.createElement('canvas'); ground.width = WW; ground.height = WH;
function paddyZones() {
  const z = [];
  for (let py = 0; py < 4; py++) for (let px = 0; px < 5; px++) z.push({ x: 55 + px * 300, y: 75 + py * 280, w: 230, h: 210 });
  return z;
}
function paintGround(biome) {
  const g = ground.getContext('2d');
  const b = biome || BIOMES[0];
  const base = { VILLAGE: ['#7d6f52', '#6f6349', '#867759'], PADDIES: ['#4a5f36', '#3f542e', '#557038'], JUNGLE: ['#243018', '#1c2712', '#2a3820'], OPEN: ['#6e6a42', '#5f5c38', '#7c7748'] }[b.short];
  for (let y = 0; y < WH; y += 24) for (let x = 0; x < WW; x += 24) {
    g.fillStyle = base[Math.floor(Math.random() * 3)];
    g.fillRect(x, y, 24, 24);
  }
  // noise speckle
  for (let i = 0; i < 900; i++) {
    g.fillStyle = 'rgba(0,0,0,' + rnd(.02, .07) + ')';
    g.fillRect(rnd(0, WW), rnd(0, WH), rnd(2, 6), rnd(2, 6));
  }
  if (b.short === 'VILLAGE') {
    // dirt roads
    g.fillStyle = 'rgba(120,100,70,.55)';
    g.fillRect(0, WH * .47, WW, 60); g.fillRect(WW * .38, 0, 60, WH);
    g.fillStyle = 'rgba(60,50,36,.3)';
    g.fillRect(0, WH * .47 + 56, WW, 6); g.fillRect(WW * .38 + 56, 0, 6, WH);
    for (let i = 0; i < 40; i++) { // grass tufts
      g.strokeStyle = 'rgba(95,115,55,.5)'; g.lineWidth = 1.6;
      const x = rnd(0, WW), y = rnd(0, WH);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-3, 3), y - rnd(5, 10)); g.stroke();
    }
  }
  if (b.short === 'PADDIES') {
    // flooded rect plots with dikes (same layout game.js uses for slow zones)
    paddyZones().forEach(({ x, y, w, h }) => {
      g.fillStyle = '#5a7d76';
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(120,180,170,.25)';
      for (let ry = 0; ry < 5; ry++) g.fillRect(x + 8, y + 20 + ry * 40, w - 16, 3);
      g.strokeStyle = '#8a7a58'; g.lineWidth = 10; g.strokeRect(x - 2, y - 2, w + 4, h + 4);
      g.strokeStyle = '#6e6244'; g.lineWidth = 3; g.strokeRect(x - 5, y - 5, w + 10, h + 10);
    });
  }
  if (b.short === 'JUNGLE') {
    for (let i = 0; i < 160; i++) {
      g.fillStyle = 'rgba(' + [30, 50, 26] + ',' + rnd(.1, .3) + ')';
      g.beginPath(); g.ellipse(rnd(0, WW), rnd(0, WH), rnd(20, 70), rnd(14, 46), rnd(0, TAU), 0, TAU); g.fill();
    }
  }
  if (b.short === 'OPEN') {
    for (let i = 0; i < 14; i++) { // shell craters visuals
      const x = rnd(80, WW - 80), y = rnd(80, WH - 80);
      g.fillStyle = 'rgba(70,58,40,.6)'; g.beginPath(); g.ellipse(x, y, rnd(18, 42), rnd(14, 32), rnd(0, TAU), 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,34,22,.5)'; g.lineWidth = 3; g.stroke();
    }
    for (let i = 0; i < 200; i++) {
      g.strokeStyle = 'rgba(150,130,80,.25)'; g.lineWidth = 1.4;
      const x = rnd(0, WW), y = rnd(0, WH);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y - rnd(4, 9)); g.stroke();
    }
  }
}

/* ---------------- run state ---------------- */
let G = { scene: 'title', keys: {}, md: false, mx: VW / 2, my: VH / 2, cam: { x: (WW - VW) / 2, y: (WH - VH) / 2 }, shake: 0, buff: computeBuffs() };
let R = null;
function obstacleGen(cfg) {
  const obs = [];
  for (const t of cfg.types) {
    if (t === 'hut') obs.push({ x: rnd(160, WW - 160), y: rnd(160, WH - 160), w: 100 + rnd(0, 60), h: 80 + rnd(0, 50), type: 'hut' });
    else if (t === 'trunk') obs.push({ x: rnd(140, WW - 140), y: rnd(140, WH - 140), r: rnd(13, 17) + (cfg.short === 'JUNGLE' ? rnd(0, 5) : 0), type: 'trunk' });
    else if (t === 'bags') obs.push({ x: rnd(140, WW - 140), y: rnd(140, WH - 140), r: rnd(38, 56), type: 'bags' });
    else if (t === 'crater') obs.push({ x: rnd(140, WW - 140), y: rnd(140, WH - 140), r: rnd(36, 60), type: 'crater' });
  }
  [[80, 80], [WW - 80, 80], [80, WH - 80], [WW - 80, WH - 80], [WW / 2, 66], [WW / 2, WH - 66]].forEach(([x, y]) => obs.push({ x, y, r: 32, type: 'sandbag' }));
  return obs;
}
function roundCfg(r) {
  const cap = 5 + Math.min(24, Math.floor(r * 1.9));
  const hpMul = 1 + (r - 1) * .085, spdMul = Math.min(1.5, 1 + (r - 1) * .016);
  const types = ['grunt', 'grunt', 'rusher'];
  if (r >= 3) types.push('sapper');
  if (r >= 5) types.push('sniper');
  if (r >= 7) types.push('grenadier');
  if (r >= 9) types.push('heavy');
  return { cap, hpMul, spdMul, types };
}
function mkGun(w) { return { w, mag: w.m, reserve: w.m * 4, cool: 0, reload: 0 }; }
function makeMate(m, slot) {
  const dmgMul = m.dmgMul;
  const T = {
    gunner:   { range: 430, rpm: 300, dmg: 7  * dmgMul, spread: .09, burst: 6, gap: 1.6 },
    marksman: { range: 650, rpm: 38,  dmg: 34 * dmgMul, spread: .012, burst: 1, gap: .1 },
    scatter:  { range: 200, rpm: 70,  dmg: 9  * dmgMul, spread: .16, burst: 1, gap: .1, pellets: 5 },
    medic:    { range: 300, rpm: 110, dmg: 5  * dmgMul, spread: .07, burst: 1, gap: .1, healEvery: 5.5, healAmt: 9 + m.tier * 3 },
    frag:     { range: 280, rpm: 90,  dmg: 5  * dmgMul, spread: .09, burst: 3, gap: 1.4, nadeEvery: 7.5 },
    jammer:   { range: 250, rpm: 150, dmg: 4.5 * dmgMul, spread: .08, burst: 1, gap: .1 },
    supply:   { range: 380, rpm: 110, dmg: 6  * dmgMul, spread: .08, burst: 1, gap: .1, crateEvery: 13 },
    taunt:    { range: 340, rpm: 130, dmg: 6.5 * dmgMul, spread: .09, burst: 1, gap: .1 },
  }[m.trait];
  return { m, slot, x: 0, y: 0, ang: 0, hp: m.hp, hpMax: m.hp * (m.trait === 'taunt' ? 1.6 : 1), T, cool: 0, burstLeft: 0, healT: T.healEvery || 0, nadeT: T.nadeEvery || 0, crateT: T.crateEvery || 0, dead: false };
}
function newRun() {
  const arm = armorById(S.armor), cloth = CLOTHES[S.cloth] || CLOTHES[0], boots = BOOTS[S.boots];
  G.buff = computeBuffs();
  const p = {
    x: WW / 2, y: WH / 2, r: 12, ang: 0,
    hp: 100 + G.buff.hp * 100, hpMax: 100 + G.buff.hp * 100,
    prot: Math.min(.85, arm.prot + G.buff.prot), spdMul: arm.spd * boots.spd * (1 + G.buff.spd),
    w1: mkGun(wByName(S.primary) || WEAPONS[2]), w2: mkGun(wByName(S.sidearm) || WEAPONS[59]), wi: 1,
    grenades: 4, iFrames: 0, hurtT: 0, stamina: 100,
  };
  return { biome: null, zones: [], round: 1, lastCleared: 0, kills: 0, score: 0, cashRun: 0, p, mates: instantiateSquad(),
    enemies: [], bullets: [], pickups: [], parts: [], lobs: [], toSpawn: 0, spawnT: 0, boss: null, obstacles: [], time: 0 };
}
function instantiateSquad() {
  const mates = [];
  S.squad.forEach((n, slot) => { const m = n && mateByName(n); if (m) mates.push(makeMate(m, slot)); });
  return mates;
}
function armorClothAll() {
  const cloth = CLOTHES[S.cloth] || CLOTHES[0];
  return { body: cloth.body, alt: cloth.alt, skin: SKINS[S.skin], head: S.head, paint: S.paint, prot: armorById(S.armor).prot };
}
function beginRound() {
  if (R.run.round > R.run.lastCleared) {
    // fresh area
    const b = BIOMES[(R.run.round - 1) % BIOMES.length];
    R.run.biome = b;
    R.run.obstacles = obstacleGen(b);
    R.run.zones = b.short === 'PADDIES' ? paddyZones() : [];
    paintGround(b);
    R.cfg = roundCfg(R.run.round);
    if (R.run.round % 10 === 0) spawnBoss();
    else R.run.toSpawn = R.cfg.cap;
    R.run.lastCleared = R.run.round;
    R.banner = { t0: 3.4, txt: 'AREA: ' + b.n + ' — ROUND ' + R.run.round };
  }
  const p = R.run.p;
  for (const g of [p.w1, p.w2]) if (g) { g.mag = g.w.m; g.reserve = Math.min(g.w.m * 4, g.reserve + g.w.m * 2); g.reload = 0; }
  p.grenades = Math.min(6, p.grenades + 2);
  p.hp = Math.min(p.hpMax, p.hp + 45);
  R.run.mates.forEach(m => { m.dead = false; m.hp = m.hpMax; m.x = p.x; m.y = p.y; });
}
function spawnAt(kind) {
  const edge = Math.floor(rnd(0, 4)); let x, y;
  if (edge === 0) { x = rnd(40, WW - 40); y = 26; }
  else if (edge === 1) { x = rnd(40, WW - 40); y = WH - 26; }
  else if (edge === 2) { x = 26; y = rnd(40, WH - 40); }
  else { x = WW - 26; y = rnd(40, WH - 40); }
  const t = ENEMY_TYPES[kind];
  R.run.enemies.push({ kind, x, y, hp: t.hp * R.cfg.hpMul, hpMax: t.hp * R.cfg.hpMul, spd: t.spd * R.cfg.spdMul, r: t.r, cool: rnd(.2, 1), ang: 0, t, strafe: rnd(-1, 1), meleeT: 0, targetMate: null });
}
function spawnBoss() {
  const seq = Math.max(0, R.run.round / 10 - 1);
  const b0 = BOSSES[seq % BOSSES.length];
  const cyc = Math.floor(seq / BOSSES.length);
  const hpMul = (1 + (R.run.round - 1) * .085) * (1 + cyc * .45);
  const b = { kind: 'boss', boss: b0, x: WW / 2, y: 70, hp: b0.hp * hpMul, hpMax: b0.hp * hpMul, spd: b0.spd,
    r: b0.r, cool: 2.5, ang: Math.PI / 2, t: { dmg: b0.dmg, rpm: 130, range: 620, spread: .055 }, strafe: rnd(-1, 1), summonT: 4, targetMate: null };
  R.run.boss = b; R.run.enemies.push(b);
  sBoss();
}

/* ---------------- input ---------------- */
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  G.keys[k] = true;
  if (e.key === 'Escape') { if (G.scene === 'game') pause(true); else if (G.scene === 'paused') pause(false); }
  if (G.scene === 'game') {
    if (k === 'r') startReload();
    if (k === '1' || k === '2') switchW(+k);
    if (k === 'g') throwGrenade();
  }
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', e => G.keys[e.key.toLowerCase()] = false);
CV.addEventListener('mousemove', e => {
  const r = CV.getBoundingClientRect();
  G.mx = (e.clientX - r.left) * (CV.width / r.width);
  G.my = (e.clientY - r.top) * (CV.height / r.height);
});
CV.addEventListener('mousedown', () => { audio(); if (G.scene === 'game') { G.md = true; fireTick(true); } });
addEventListener('mouseup', () => G.md = false);
CV.addEventListener('contextmenu', e => e.preventDefault());
function pause(on) { if (!R || G.scene === 'over') return; G.scene = on ? 'paused' : 'game'; if (on) screen('scr-pause'); else hideScreens(); }
function startReload() {
  const g = curGun(); if (!g) return;
  if (g.reload > 0 || g.mag === g.w.m || g.reserve <= 0) return;
  g.reload = g.w.rl * Math.max(.5, 1 - G.buff.reload); sReload();
}
function switchW(i) { const p = R.run.p; if (p.wi === i) return; p.wi = i; tone(320, .05, .07, 'square'); }
function throwGrenade() {
  const p = R.run.p;
  if (p.grenades <= 0) { sDry(); return; }
  p.grenades--; sGren();
  const a = p.ang;
  R.run.lobs.push({ x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, t: .85, kind: 'frag', dmg: 95, side: 'p' });
}

/* ---------------- shooting ---------------- */
function fireTick(click) {
  if (!R || G.scene !== 'game') return;
  const p = R.run.p, g = curGun(), w = g.w;
  if (g.reload > 0 || g.cool > 0) return;
  if (g.mag <= 0) { if (click) { sDry(); startReload(); } return; }
  if (w.md !== 'auto' && !click) return;
  g.cool = 60 / w.r; g.mag--;
  p.ang = Math.atan2(G.my + G.cam.y - p.y, G.mx + G.cam.x - p.x);
  sShot(w);
  G.shake = Math.min(10, G.shake + (w.c === 'SN' ? 5 : w.c === 'SG' ? 4 : 1.6));
  const n = w.pc || 1;
  for (let i = 0; i < n; i++) {
    const a = p.ang + rnd(-w.sp, w.sp);
    R.run.bullets.push({ x: p.x + Math.cos(p.ang) * 20, y: p.y + Math.sin(p.ang) * 20, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, dmg: w.d * (1 + G.buff.dmg), from: 'p', r: w.c === 'SP' ? 4 : 2, range: w.rng, c: w.c });
  }
  for (let i = 0; i < 3; i++) R.run.parts.push({ x: p.x + Math.cos(p.ang) * 24, y: p.y + Math.sin(p.ang) * 24, vx: Math.cos(p.ang) * rnd(50, 180), vy: Math.sin(p.ang) * rnd(50, 180), life: .08, t: 0, kind: 'flash' });
}
function mateFire(m, e) {
  const a = angTo(m.x, m.y, e.x, e.y) + rnd(-m.T.spread, m.T.spread);
  const n = m.T.pellets || 1;
  for (let i = 0; i < n; i++) {
    const aa = a + (n > 1 ? rnd(-m.T.spread, m.T.spread) : 0);
    R.run.bullets.push({ x: m.x + Math.cos(aa) * 18, y: m.y + Math.sin(aa) * 18, vx: Math.cos(aa) * 760, vy: Math.sin(aa) * 760, dmg: m.T.dmg, from: 'b', r: 2.2, range: m.T.range, c: 'B' });
  }
  boom(.09, .08, 1200, 300);
}
function enemyFire(e) {
  const tgt = (e.targetMate && !e.targetMate.dead) ? e.targetMate : R.run.p;
  const a = angTo(e.x, e.y, tgt.x, tgt.y) + rnd(-e.t.spread, e.t.spread);
  R.run.bullets.push({ x: e.x + Math.cos(a) * (e.r + 8), y: e.y + Math.sin(a) * (e.r + 8), vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, dmg: e.t.dmg, from: 'e', r: 2.4, range: e.t.range, c: 'E' });
  boom(.09, .09, 1100, 250);
}

/* ---------------- damage & economy ---------------- */
function hurtPlayer(d) {
  const p = R.run.p;
  if (p.iFrames > 0 || G.scene !== 'game') return;
  p.hp -= d * (1 - p.prot);
  p.iFrames = .25; p.hurtT = .45; G.shake = Math.min(14, G.shake + 4); sHurt();
  for (let i = 0; i < 5; i++) R.run.parts.push(blood(p.x, p.y));
  if (p.hp <= 0) { p.hp = 0; die(); }
}
function hurtMate(m, d) { m.hp -= d; if (m.hp <= 0 && !m.dead) { m.dead = true; explodeFx(m.x, m.y, 34); tone(130, .25, .15, 'sawtooth', 90); floaty(m.x, m.y, m.m.name.toUpperCase() + ' WOUNDED-EVAC'); } }
function hurtEnemy(e, d) {
  if (e.dead) return;
  e.hp -= d; sHit();
  if (Math.random() < .5) R.run.parts.push(blood(e.x, e.y));
  if (e.hp <= 0) killEnemy(e);
}
function blood(x, y) { return { x, y, vx: rnd(-90, 90), vy: rnd(-90, 90), life: rnd(.25, .55), t: 0, kind: 'blood' }; }
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  S.totalKills++; R.run.kills++;
  const val = e.kind === 'boss' ? e.boss.score : e.t.score;
  R.run.score += val;
  addCash(Math.round(val * ECON.killRatio), e.x, e.y);
  if (e.kind === 'sapper') explode(e.x, e.y, 70, e.t.dmg, 'e');
  if (e.kind === 'boss') {
    explode(e.x, e.y, 150, 0, 'fx'); G.shake = 16; S.bosses++;
    for (let i = 0; i < 5; i++) R.run.pickups.push({ x: e.x + rnd(-46, 46), y: e.y + rnd(-46, 46), kind: i < 2 ? 'hp' : 'cash', v: 60, t: 0 });
  } else if (Math.random() < .22) {
    const kind = Math.random() < .45 ? 'hp' : Math.random() < .7 ? 'ammo' : 'cash';
    R.run.pickups.push({ x: e.x, y: e.y, kind, v: kind === 'cash' ? Math.round(rnd(25, 60)) : 0, t: 0 });
  }
}
function explode(x, y, radius, dmg, side) {
  explodeFx(x, y, radius * .6);
  if (dmg > 0) {
    if (side === 'p') R.run.enemies.forEach(en => { if (!en.dead && dist(en.x, en.y, x, y) < radius + en.r) { en.hp -= dmg * (1 - dist(en.x, en.y, x, y) / (radius + en.r)); if (en.hp <= 0) killEnemy(en); } });
    if (side === 'e') {
      if (dist(R.run.p.x, R.run.p.y, x, y) < radius) hurtPlayer(dmg * .8);
      R.run.mates.forEach(m => { if (!m.dead && dist(m.x, m.y, x, y) < radius) hurtMate(m, dmg * .6); });
    }
  }
}
function explodeFx(x, y, size) {
  sExpl(); G.shake = Math.max(G.shake, Math.min(12, size / 12));
  for (let i = 0; i < Math.round(size / 4); i++) R.run.parts.push({ x, y, vx: rnd(-240, 240), vy: rnd(-240, 240), life: rnd(.2, .55), t: 0, kind: 'fire' });
}
function addCash(c, x, y) { S.req += c; R.run.cashRun += c; save(); if (x !== undefined) floaty(x, y, '+$' + c); }
function floaty(x, y, txt) { R.run.parts.push({ x, y, vy: -40, vx: rnd(-10, 10), life: 1, t: 0, kind: 'txt', txt }); }
function inWaterSlow(x, y) {
  for (const z of R.run.zones) if (x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h) return R.run.biome.slow;
  return 1;
}
function die() {
  G.scene = 'over';
  explodeFx(R.run.p.x, R.run.p.y, 110);
  S.bestRound = Math.max(S.bestRound, R.run.round - 1);
  S.bestScore = Math.max(S.bestScore, R.run.score);
  save();
  setTimeout(() => {
    $('overStats').innerHTML =
      'SPC. ' + esc(S.name || 'SOMEBODY') + ' cleared ' + (R.run.round - 1) + ' rounds from ' + R.run.biome.n + '.<br>' +
      R.run.kills + ' kills this tour · score ' + R.run.score + ' · requisition earned this tour $' + R.run.cashRun + '<br>' +
      '<span style="color:#7fb069">Lifetime: round ' + S.bestRound + ' · ' + S.totalKills + ' kills · ' + S.bosses + ' bosses · bank $' + S.req + '</span>';
    screen('scr-over');
  }, 700);
}
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ---------------- main update ---------------- */
let last = performance.now();
function tick(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (G.scene === 'game' && R) update(dt);
  render();
  requestAnimationFrame(tick);
}
function update(dt) {
  const ru = R.run, p = ru.p;
  ru.time += dt;
  p.ang = Math.atan2(G.my + G.cam.y - p.y, G.mx + G.cam.x - p.x);
  const kx = (G.keys.d || G.keys.arrowright ? 1 : 0) - (G.keys.a || G.keys.arrowleft ? 1 : 0);
  const ky = (G.keys.s || G.keys.arrowdown ? 1 : 0) - (G.keys.w || G.keys.arrowup ? 1 : 0);
  const ml = Math.hypot(kx, ky) || 1;
  const wantSprint = G.keys.shift && (kx || ky) && p.stamina > 2;
  p.stamina = clamp(p.stamina + (wantSprint ? -32 : 20) * dt, 0, 100);
  const bog = inWaterSlow(p.x, p.y);
  const spd = 195 * p.spdMul * (wantSprint ? 1.45 : 1) * bog;
  p.x = clamp(p.x + kx / ml * spd * dt, 20, WW - 20); p.y = clamp(p.y + ky / ml * spd * dt, 20, WH - 20);
  if (bog < 1 && Math.random() < .3) ru.parts.push({ x: p.x + rnd(-8, 8), y: p.y + rnd(-4, 8), vx: 0, vy: -6, life: .4, t: 0, kind: 'ripple' });
  for (const o of ru.obstacles) {
    let hit = null, cx, cy, rr;
    if (o.type === 'hut') { const nx = clamp(p.x, o.x - o.w / 2, o.x + o.w / 2), ny = clamp(p.y, o.y - o.h / 2, o.y + o.h / 2); if (dist(p.x, p.y, nx, ny) < p.r) { hit = { x: p.x - nx, y: p.y - ny, d: dist(p.x, p.y, nx, ny) || .01 }; cx = nx; cy = ny; } if (hit) { p.x += hit.x / hit.d * (p.r + 2 - hit.d); p.y += hit.y / hit.d * (p.r + 2 - hit.d); } continue; }
    else if (o.type === 'crater') continue;
    else { rr = o.r + p.r; if (dist(p.x, p.y, o.x, o.y) < rr) { const d = dist(p.x, p.y, o.x, o.y) || 1; p.x += (p.x - o.x) / d * (rr - d); p.y += (p.y - o.y) / d * (rr - d); } }
  }
  p.iFrames = Math.max(0, p.iFrames - dt); p.hurtT = Math.max(0, p.hurtT - dt);
  for (const gg of [p.w1, p.w2]) {
    gg.cool = Math.max(0, gg.cool - dt);
    if (gg.reload > 0) {
      gg.reload -= dt;
      if (gg.reload <= 0) { const use = Math.min(gg.w.m - gg.mag, gg.reserve); gg.mag += use; gg.reserve -= use; gg.reload = 0; }
    }
  }
  if (G.md) fireTick(false);

  if (!ru.boss && ru.toSpawn > 0) {
    ru.spawnT -= dt;
    if (ru.spawnT <= 0 && ru.enemies.length < 30) {
      ru.spawnT = Math.max(.4, 1.5 - ru.round * .055);
      spawnAt(R.cfg.types[Math.floor(rnd(0, R.cfg.types.length))]);
      ru.toSpawn--;
    }
  }
  if (!ru.boss && ru.toSpawn === 0 && ru.enemies.length === 0) return roundClear();

  // sergeant (taunt) steals targets
  const tauntMates = ru.mates.filter(m => !m.dead && m.m.trait === 'taunt');
  for (const e of ru.enemies) {
    if (e.dead) continue;
    e.targetMate = null;
    for (const m of tauntMates) if (dist(e.x, e.y, m.x, m.y) < 240) { e.targetMate = m; break; }
  }

  // squadmates update
  for (const m of ru.mates) {
    if (m.dead) continue;
    const bog2 = inWaterSlow(m.x, m.y);
    const off = p.ang + Math.PI + (m.slot - 1) * .85;
    const fx = p.x + Math.cos(off) * 58, fy = p.y + Math.sin(off) * 58;
    let tgt = null, best = 1e9;
    for (const e of ru.enemies) {
      if (e.dead) continue;
      const d = dist(m.x, m.y, e.x, e.y);
      if (d < m.T.range && d < best) { best = d; tgt = e; }
    }
    let mx = fx - m.x, my = fy - m.y;
    const dm = Math.hypot(mx, my);
    const mspd = (170 + m.m.tier * 8) * bog2;
    if (dm > 14) { m.x += mx / dm * mspd * dt; m.y += my / dm * mspd * dt; }
    else if (tgt) { m.x += Math.cos(angTo(m.x, m.y, tgt.x, tgt.y)) * 12 * dt; m.y += Math.sin(angTo(m.x, m.y, tgt.x, tgt.y)) * 12 * dt; }
    if (tgt) m.ang = angTo(m.x, m.y, tgt.x, tgt.y); else if (dm > 14) m.ang = Math.atan2(my, mx);
    m.cool -= dt;
    if (m.burstLeft > 0 && m.cool <= 0 && tgt) { mateFire(m, tgt); m.burstLeft--; m.cool = .09; }
    else if (m.burstLeft === 0 && tgt && m.cool <= 0) {
      mateFire(m, tgt);
      if (m.T.burst > 1) m.burstLeft = m.T.burst - 1;
      m.cool = 60 / m.T.rpm + m.T.gap;
    }
    if (m.m.trait === 'medic') {
      m.healT -= dt;
      if (m.healT <= 0 && dist(m.x, m.y, p.x, p.y) < 320 && p.hp < p.hpMax) {
        m.healT = m.T.healEvery; p.hp = Math.min(p.hpMax, p.hp + m.T.healAmt);
        floaty(p.x, p.y - 18, 'PATCHED +' + m.T.healAmt); sHeal();
        for (let i = 0; i < 6; i++) ru.parts.push({ x: p.x + rnd(-10, 10), y: p.y + rnd(-10, 10), vy: -30, vx: 0, life: .5, t: 0, kind: 'glint' });
      } else if (m.healT <= 0) m.healT = 2;
    }
    if (m.m.trait === 'frag') {
      m.nadeT -= dt;
      if (m.nadeT <= 0 && tgt) {
        m.nadeT = m.T.nadeEvery; sGren();
        const a = angTo(m.x, m.y, tgt.x, tgt.y);
        ru.lobs.push({ x: m.x, y: m.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, t: Math.max(.2, dist(m.x, m.y, tgt.x, tgt.y) / 290), kind: 'frag', dmg: 40 + m.m.tier * 22, side: 'p' });
      }
    }
    if (m.m.trait === 'supply') {
      m.crateT -= dt;
      if (m.crateT <= 0) {
        m.crateT = m.T.crateEvery;
        ru.pickups.push({ x: m.x + rnd(-20, 20), y: m.y + rnd(-20, 20), kind: 'ammo', v: 0, t: 0 });
        floaty(m.x, m.y, 'CRATE'); tone(300, .1, .08, 'triangle');
      }
    }
    for (const o of ru.obstacles) {
      if (o.type === 'crater') continue;
      if (o.type === 'hut') {
        const nx = clamp(m.x, o.x - o.w / 2, o.x + o.w / 2), ny = clamp(m.y, o.y - o.h / 2, o.y + o.h / 2);
        const d = dist(m.x, m.y, nx, ny);
        if (d < 8) { m.x += (m.x - nx) / (d || 1) * (8 - d); m.y += (m.y - ny) / (d || 1) * (8 - d); }
      } else {
        const d = dist(m.x, m.y, o.x, o.y), mn = o.r + 10;
        if (d < mn) { m.x += (m.x - o.x) / (d || 1) * (mn - d); m.y += (m.y - o.y) / (d || 1) * (mn - d); }
      }
    }
  }

  // enemies
  for (const e of ru.enemies) {
    if (e.dead) continue;
    const tgt = (e.targetMate && !e.targetMate.dead) ? e.targetMate : p;
    const a = angTo(e.x, e.y, tgt.x, tgt.y); e.ang = a;
    const d = dist(e.x, e.y, tgt.x, tgt.y);
    const boss = e.kind === 'boss';
    const range = boss ? e.t.range : e.t.range || 0;
    const stopAt = boss ? (e.boss.gun ? range * .78 : 34) : range > 0 ? range * .85 : 22;
    let slow = 1;
    for (const m of ru.mates) if (!m.dead && m.m.trait === 'jammer' && dist(e.x, e.y, m.x, m.y) < 210) { slow = .45; break; }
    const bogE = inWaterSlow(e.x, e.y);
    const wav = Math.sin(ru.time * (e.kind === 'sapper' ? 5 : 3) + e.strafe * 6);
    if (range === 0 || d < stopAt || e.kind === 'rusher' || e.kind === 'sapper') {
      const sp = e.spd * slow * bogE;
      e.x += (Math.cos(a) * sp + Math.cos(a + Math.PI / 2) * wav * 46) * dt;
      e.y += (Math.sin(a) * sp + Math.sin(a + Math.PI / 2) * wav * 46) * dt;
      if (e.kind === 'sapper' && d < e.r + (tgt.r || 12) + 8) { explode(e.x, e.y, 70, e.t.dmg, 'e'); killEnemy(e); continue; }
      if (e.kind === 'rusher') {
        e.meleeT -= dt;
        if (d < e.r + (tgt.r || 12) + 6 && e.meleeT <= 0) {
          e.meleeT = .8;
          if (tgt === p) hurtPlayer(e.t.dmg); else hurtMate(tgt, e.t.dmg);
        }
      }
    } else {
      const sp = e.spd * slow * bogE * .8;
      e.x += (Math.cos(a + Math.PI / 2) * e.strafe * 34 + Math.cos(a) * (d > stopAt + 60 ? sp : -sp * .4)) * dt;
      e.y += (Math.sin(a + Math.PI / 2) * e.strafe * 34 + Math.sin(a) * (d > stopAt + 60 ? sp : -sp * .4)) * dt;
      e.cool -= dt;
      if (d < range && e.cool <= 0) {
        e.cool = boss ? rnd(1.3, 2.4) : 60 / e.t.rpm + rnd(0, .5);
        if (boss) {
          for (let i = 0; i < e.boss.bursts; i++) setTimeout(() => { if (G.scene === 'game' && !e.dead && G.scene === 'game') enemyFire(e); }, i * 100);
        } else if (e.kind === 'grenadier') {
          sGren();
          ru.lobs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, t: Math.max(.2, d / 320), kind: 'enemy', dmg: e.t.dmg, side: 'e' });
        } else enemyFire(e);
      }
    }
    if (boss) {
      e.summonT -= dt;
      if (e.summonT <= 0 && ru.enemies.length < 20) {
        e.summonT = e.boss.gun ? 7 : 3.6;
        for (let i = 0; i < 3; i++) spawnAt(e.boss.gun ? 'rusher' : 'sapper');
        floaty(e.x, e.y - 30, 'REINFORCEMENTS!');
      }
    }
    for (const o of ru.obstacles) {
      if (o.type === 'crater') continue;
      if (o.type === 'hut') {
        const nx = clamp(e.x, o.x - o.w / 2, o.x + o.w / 2), ny = clamp(e.y, o.y - o.h / 2, o.y + o.h / 2);
        const d2 = dist(e.x, e.y, nx, ny);
        if (d2 < e.r) { e.x += (e.x - nx) / (d2 || 1) * (e.r - d2); e.y += (e.y - ny) / (d2 || 1) * (e.r - d2); }
      } else {
        const dd = dist(e.x, e.y, o.x, o.y), mn = o.r + e.r;
        if (dd < mn) { e.x += (e.x - o.x) / (dd || 1) * (mn - dd); e.y += (e.y - o.y) / (dd || 1) * (mn - dd); }
      }
    }
  }

  // bullets
  for (const b of ru.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.range -= Math.hypot(b.vx, b.vy) * dt;
    if (b.range <= 0 || b.x < 8 || b.y < 8 || b.x > WW - 8 || b.y > WH - 8) { b.dead = true; continue; }
    for (const o of ru.obstacles) {
      if (o.type === 'crater') continue;
      if (o.type === 'hut') { if (Math.abs(b.x - o.x) < o.w / 2 + 2 && Math.abs(b.y - o.y) < o.h / 2 + 2) { b.dead = true; break; } }
      else if (dist(b.x, b.y, o.x, o.y) < o.r) { b.dead = true; break; }
    }
    if (b.dead) continue;
    if (b.from === 'p' || b.from === 'b') {
      for (const e of ru.enemies) if (!e.dead && dist(b.x, b.y, e.x, e.y) < e.r + b.r) { hurtEnemy(e, b.dmg); b.dead = true; break; }
    } else {
      for (const m of ru.mates) if (!m.dead && dist(b.x, b.y, m.x, m.y) < 11) { hurtMate(m, b.dmg); b.dead = true; break; }
      if (!b.dead && dist(b.x, b.y, p.x, p.y) < p.r + b.r) { hurtPlayer(b.dmg); b.dead = true; }
    }
  }
  // lobs
  for (const L of ru.lobs) {
    L.x += L.vx * dt; L.y += L.vy * dt; L.t -= dt;
    if (L.t <= 0) { L.dead = true; explode(L.x, L.y, L.kind === 'frag' ? 96 : 78, L.dmg, L.side || 'e'); }
  }
  // pickups
  for (const k of ru.pickups) {
    k.t += dt;
    if (k.t > 18) { k.dead = true; continue; }
    if (dist(k.x, k.y, p.x, p.y) < p.r + 13) {
      k.dead = true;
      if (k.kind === 'hp') { p.hp = Math.min(p.hpMax, p.hp + (k.v || 30)); sHeal(); floaty(k.x, k.y, 'MEDIC!'); }
      else if (k.kind === 'ammo') { for (const gg of [p.w1, p.w2]) gg.reserve = Math.min(gg.w.m * 4, gg.reserve + gg.w.m * 2); floaty(k.x, k.y, 'AMMO'); tone(400, .1, .08, 'square'); }
      else { addCash(k.v, k.x, k.y); sCash(); }
    }
  }
  // particles
  for (const q of ru.parts) {
    q.t += dt; q.x += (q.vx || 0) * dt; q.y += (q.vy || 0) * dt;
    if (q.t > q.life) q.dead = true;
  }
  ru.bullets = ru.bullets.filter(b => !b.dead);
  ru.lobs = ru.lobs.filter(l => !l.dead);
  ru.pickups = ru.pickups.filter(k => !k.dead);
  ru.parts = ru.parts.filter(q => !q.dead);
  ru.enemies = ru.enemies.filter(e => !e.dead);
  if (ru.boss && ru.boss.dead) ru.boss = null;

  G.cam.x = clamp(lerp(G.cam.x, clamp(p.x - VW / 2, 0, WW - VW), .14), 0, WW - VW);
  G.cam.y = clamp(lerp(G.cam.y, clamp(p.y - VH / 2, 0, WH - VH), .14), 0, WH - VH);
  G.shake = Math.max(0, G.shake - dt * 32);
  if (R.banner) { R.banner.t0 -= dt; if (R.banner.t0 <= 0) R.banner = null; }
}

/* ---------------- round flow ---------------- */
function roundClear() {
  G.scene = 'inter';
  const bonus = ECON.clearBase + ECON.clearPerRound * R.run.round;
  S.req += bonus; R.run.cashRun += bonus;
  const bossRound = R.run.round % 10 === 0;
  save();
  $('interTitle').textContent = bossRound ? 'BOSS DOWN — SECTOR CLEARED' : 'ROUND CLEARED';
  $('irRound').textContent = R.run.round;
  $('irKills').textContent = R.run.kills;
  $('irCash').textContent = '$' + bonus;
  $('irTotal').textContent = '$' + S.req;
  const nextB = BIOMES[R.run.round % BIOMES.length];
  $('irNote').textContent = 'Req. bonus $' + bonus + ' credited. Next drop zone: ' + nextB.n + ' — ' + nextB.hint;
  R.run.kills = 0;
  R.run.round += 1;
  screen('scr-inter');
}
function deploy() {
  R = { run: newRun(), banner: null };
  beginRound();
  G.cam.x = clamp(R.run.p.x - VW / 2, 0, WW - VW); G.cam.y = clamp(R.run.p.y - VH / 2, 0, WH - VH);
  G.scene = 'game';
  hideScreens();
}
function nextRound() {
  if (!R) return deploy();
  beginRound();
  G.scene = 'game';
  hideScreens();
}

/* ---------------- render ---------------- */
function render() {
  CX.setTransform(1, 0, 0, 1, 0, 0);
  CX.fillStyle = '#0d0c08'; CX.fillRect(0, 0, CV.width, CV.height);
  const inGame = R && ['game', 'paused', 'over', 'inter'].includes(G.scene);
  if (inGame) {
    const shx = G.shake > 0 ? rnd(-G.shake, G.shake) : 0, shy = G.shake > 0 ? rnd(-G.shake, G.shake) : 0;
    CX.translate(-G.cam.x + shx, -G.cam.y + shy);
    CX.drawImage(ground, 0, 0);
    // obstacles by type
    for (const o of R.run.obstacles) {
      if (o.type === 'crater') { CX.strokeStyle = 'rgba(35,30,20,.4)'; CX.lineWidth = 3; CX.beginPath(); CX.ellipse(o.x, o.y, o.r, o.r * .7, 0, 0, TAU); CX.stroke(); continue; }
      if (o.type === 'hut') {
        CX.fillStyle = 'rgba(0,0,0,.25)'; CX.fillRect(o.x - o.w / 2 + 5, o.y - o.h / 2 + 6, o.w, o.h);
        CX.fillStyle = '#6e5a42'; CX.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
        CX.fillStyle = '#7a4a32'; CX.fillRect(o.x - o.w / 2 + 6, o.y - o.h / 2 + 6, o.w - 12, o.h - 12);
        CX.strokeStyle = '#5a3a26'; CX.lineWidth = 2;
        for (let i = 0; i < 5; i++) { CX.beginPath(); CX.moveTo(o.x - o.w / 2 + 6 + i * (o.w - 12) / 4, o.y - o.h / 2 + 6); CX.lineTo(o.x - o.w / 2 + 6 + i * (o.w - 12) / 4, o.y + o.h / 2 - 6); CX.stroke(); }
        continue;
      }
      if (o.type === 'trunk') {
        CX.fillStyle = '#3a2b18'; CX.beginPath(); CX.arc(o.x, o.y, o.r, 0, TAU); CX.fill();
        CX.fillStyle = '#50402a'; CX.beginPath(); CX.arc(o.x - 3, o.y - 3, o.r * .7, 0, TAU); CX.fill();
      } else { // bags/sandbag
        for (let i = 0; i < 5; i++) {
          CX.fillStyle = i % 2 ? '#6e6448' : '#5d5439';
          CX.beginPath();
          CX.ellipse(o.x + Math.cos(i * 1.26) * o.r * .5, o.y + Math.sin(i * 1.26) * o.r * .4, o.r * .52, o.r * .38, i, 0, TAU);
          CX.fill();
        }
      }
    }
    for (const q of R.run.parts) if (q.kind === 'blood') {
      CX.fillStyle = 'rgba(120,20,15,' + clamp(1 - q.t / q.life, 0, .85) + ')';
      CX.beginPath(); CX.arc(q.x, q.y, 4 + 9 * (q.t / q.life), 0, TAU); CX.fill();
    }
    for (const q of R.run.parts) if (q.kind === 'ripple') {
      CX.strokeStyle = 'rgba(190,230,220,' + (1 - q.t / q.life) * .5 + ')'; CX.lineWidth = 1;
      CX.beginPath(); CX.arc(q.x, q.y, 6 * q.t / q.life * 4, 0, TAU); CX.stroke();
    }
    for (const k of R.run.pickups) drawPickup(k);
    for (const L of R.run.lobs) {
      CX.fillStyle = 'rgba(0,0,0,.25)'; CX.beginPath(); CX.arc(L.x - L.vx * .12, L.y - L.vy * .12, 4, 0, TAU); CX.fill();
      CX.fillStyle = '#39392b'; CX.beginPath(); CX.arc(L.x, L.y, 4, 0, TAU); CX.fill();
    }
    for (const m of R.run.mates) if (!m.dead) drawMate(CX, m.x, m.y, m.ang, m.m, m.hp / m.hpMax);
    for (const e of R.run.enemies) drawEnemy(e);
    drawPlayer();
    for (const b of R.run.bullets) {
      CX.strokeStyle = b.from === 'p' ? '#ffe9a8' : b.from === 'b' ? '#8ecae6' : '#ff8b6b';
      CX.lineWidth = b.r + (b.c === 'SN' ? 1.2 : 0);
      CX.beginPath(); CX.moveTo(b.x - b.vx * .016, b.y - b.vy * .016); CX.lineTo(b.x, b.y); CX.stroke();
    }
    for (const q of R.run.parts) {
      const a = 1 - q.t / q.life; if (a <= 0) continue;
      if (q.kind === 'flash') { CX.fillStyle = 'rgba(255,210,110,' + a * .85 + ')'; CX.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); }
      else if (q.kind === 'fire') { CX.fillStyle = 'rgba(255,' + Math.floor(110 + 110 * a) + ',40,' + a + ')'; CX.beginPath(); CX.arc(q.x, q.y, 3 + 11 * (1 - a), 0, TAU); CX.fill(); }
      else if (q.kind === 'txt') { CX.fillStyle = 'rgba(127,176,105,' + a + ')'; CX.font = 'bold 14px Georgia'; CX.textAlign = 'center'; CX.fillText(q.txt, q.x, q.y - (1 - a) * 22); }
      else if (q.kind === 'glint') { CX.fillStyle = 'rgba(140,220,140,' + a + ')'; CX.fillRect(q.x - 2, q.y - 2, 4, 4); }
    }
    // canopy over jungle trees
    const den = R.run.biome.short === 'JUNGLE' ? 1.5 : 1;
    for (const o of R.run.obstacles) if (o.type === 'trunk') {
      CX.fillStyle = 'rgba(24,36,18,' + (.55 * den) + ')'; CX.beginPath(); CX.arc(o.x, o.y - 2, 32 * den, 0, TAU); CX.fill();
      CX.fillStyle = 'rgba(34,50,24,' + (.5 * den) + ')'; CX.beginPath(); CX.arc(o.x - 12, o.y + 8, 22 * den, 0, TAU); CX.fill();
      CX.beginPath(); CX.arc(o.x + 14, o.y + 2, 18 * den, 0, TAU); CX.fill();
    }
    CX.setTransform(1, 0, 0, 1, 0, 0);
    drawHUD();
    if (R.banner) {
      const a = clamp(R.banner.t0 / .8, 0, 1);
      CX.fillStyle = 'rgba(200,168,75,' + a + ')'; CX.font = 'bold 26px Georgia'; CX.textAlign = 'center';
      CX.fillText(R.banner.txt, VW / 2, 140);
    }
    if (R.run.p.hurtT > 0) { CX.fillStyle = 'rgba(176,71,59,' + R.run.p.hurtT * .45 + ')'; CX.fillRect(0, 0, VW, VH); }
  } else {
    drawMenuScene();
  }
}
function drawEnemy(e) {
  if (e.dead) return;
  if (e.kind === 'boss') {
    const b = e.boss;
    CX.fillStyle = 'rgba(176,71,59,' + (.08 + .05 * Math.sin(performance.now() / 280)) + ')';
    CX.beginPath(); CX.arc(e.x, e.y, e.r + 28, 0, TAU); CX.fill();
    drawSoldier(CX, e.x, e.y, e.ang, { body: b.color, alt: '#151510', skin: SKINS[S.skin], head: 0, paint: 2, prot: .55, scale: e.r / 11 });
    CX.fillStyle = '#c8a84b';
    CX.save(); CX.translate(e.x, e.y); CX.rotate(e.ang + Math.PI / 2);
    [-8, 8].forEach(sx => { CX.beginPath(); CX.moveTo(sx, -8); for (let i = 1; i <= 4; i++) CX.lineTo(sx + (i % 2 ? 2 : -2) * 1.7, -8 + i * 2.2); CX.lineTo(sx, -8); CX.fill(); });
    CX.restore();
    CX.fillStyle = '#000'; CX.fillRect(e.x - 24, e.y - 32, 48, 5);
    CX.fillStyle = '#b0473b'; CX.fillRect(e.x - 24, e.y - 32, 48 * clamp(e.hp / e.hpMax, 0, 1), 5);
    return;
  }
  const t = e.t;
  drawSoldier(CX, e.x, e.y, e.ang, { body: t.col, alt: '#1e241a', skin: '#c98d5f', head: 0, paint: e.kind === 'sapper' ? 2 : 1, prot: e.kind === 'heavy' ? .3 : 0, scale: e.r / 12 });
  if (e.hp < e.hpMax) {
    CX.fillStyle = '#000'; CX.fillRect(e.x - 13, e.y - 20, 26, 3);
    CX.fillStyle = '#b0473b'; CX.fillRect(e.x - 13, e.y - 20, 26 * clamp(e.hp / e.hpMax, 0, 1), 3);
  }
}
function drawPlayer() {
  const p = R.run.p;
  drawSoldier(CX, p.x, p.y, p.ang, armorClothAll());
  if (p.iFrames > 0) { CX.strokeStyle = 'rgba(255,90,60,' + Math.min(1, p.iFrames * 3) + ')'; CX.lineWidth = 2; CX.beginPath(); CX.arc(p.x, p.y, 17, 0, TAU); CX.stroke(); }
  const g = curGun();
  if (g) {
    CX.strokeStyle = 'rgba(255,233,168,.14)'; CX.setLineDash([3, 7]);
    CX.beginPath(); CX.moveTo(p.x, p.y); CX.lineTo(p.x + Math.cos(p.ang) * g.w.rng, p.y + Math.sin(p.ang) * g.w.rng); CX.stroke();
    CX.setLineDash([]);
  }
}
function drawPickup(k) {
  const bob = Math.sin(k.t * 4) * 2;
  CX.save(); CX.translate(k.x, k.y + bob);
  CX.fillStyle = 'rgba(0,0,0,.25)'; CX.beginPath(); CX.ellipse(0, 7, 9, 4, 0, 0, TAU); CX.fill();
  if (k.kind === 'hp') {
    CX.fillStyle = '#d9d0b4'; CX.fillRect(-7, -6, 14, 12);
    CX.fillStyle = '#b0473b'; CX.fillRect(-2, -4, 4, 8); CX.fillRect(-5, -1, 10, 3);
  } else if (k.kind === 'ammo') {
    CX.fillStyle = '#6e6448'; CX.fillRect(-8, -5, 16, 10);
    CX.fillStyle = '#443c24'; CX.fillRect(-8, -5, 16, 3);
    CX.fillStyle = '#c8a84b'; CX.fillRect(-5, 0, 10, 2);
  } else { CX.fillStyle = '#7fb069'; CX.font = 'bold 11px Georgia'; CX.textAlign = 'center'; CX.fillText('$' + k.v, 0, 1); }
  CX.restore();
}
function drawHUD() {
  const p = R.run.p, g = curGun();
  const bw2 = 300;
  CX.textAlign = 'left';
  CX.fillStyle = 'rgba(10,8,5,.72)'; CX.fillRect(18, VH - 80, bw2, 68);
  CX.fillStyle = '#2a2a20'; CX.fillRect(26, VH - 66, 260, 13);
  CX.fillStyle = p.hp / p.hpMax > .4 ? '#8faa52' : '#b0473b';
  CX.fillRect(26, VH - 66, 260 * clamp(p.hp / p.hpMax, 0, 1), 13);
  CX.fillStyle = '#2a2a20'; CX.fillRect(26, VH - 49, 260, 7);
  CX.fillStyle = '#4a7080'; CX.fillRect(26, VH - 49, 260 * p.stamina / 100, 7);
  CX.fillStyle = '#e8dcc2'; CX.font = '11px Georgia';
  CX.fillText((S.name || 'PVT. SOMEBODY').toUpperCase(), 26, VH - 70);
  CX.fillStyle = '#a3997e';
  CX.fillText('ARMOR ' + Math.round(p.prot * 100) + '% · SPEED ' + Math.round(p.spdMul * 100) + '%' + (R.run.biome.slow ? ' · WADING' : ''), 26, VH - 28);
  if (g) {
    CX.fillStyle = 'rgba(10,8,5,.72)'; CX.fillRect(VW - bw2 - 18, VH - 80, bw2, 68);
    CX.fillStyle = '#c8a84b'; CX.font = '12px Georgia';
    CX.fillText('[' + p.wi + '] ' + g.w.n.toUpperCase().slice(0, 36), VW - bw2 - 8, VH - 70);
    CX.fillStyle = '#c8a84b'; CX.font = 'bold 24px Georgia';
    CX.fillText(g.mag + ' | ' + g.reserve, VW - bw2 - 8, VH - 42);
    if (g.reload > 0) {
      CX.fillStyle = 'rgba(200,168,75,.9)'; CX.font = '13px Georgia';
      CX.fillText('RELOADING…', VW - 130, VH - 42);
    }
    CX.fillStyle = '#a3997e'; CX.font = '12px Georgia';
    CX.fillText('FRAG ' + p.grenades + ' [G] · R RELOAD · [' + (p.wi === 1 ? '2' : '1') + '] SWAP', VW - bw2 - 8, VH - 20);
  }
  CX.textAlign = 'center';
  CX.fillStyle = 'rgba(10,8,5,.72)'; CX.fillRect(VW / 2 - 165, 12, 330, 34);
  const bossOn = R.run.boss;
  CX.fillStyle = bossOn ? '#b0473b' : '#c8a84b'; CX.font = 'bold 15px Georgia';
  CX.fillText(bossOn ? 'BOSS — ' + R.run.boss.boss.name.toUpperCase() : 'ROUND ' + R.run.round + ' · ' + R.run.biome.n, VW / 2, 35);
  if (bossOn) {
    const e = R.run.boss;
    CX.fillStyle = 'rgba(10,8,5,.8)'; CX.fillRect(VW / 2 - 220, 50, 440, 12);
    CX.fillStyle = '#b0473b'; CX.fillRect(VW / 2 - 218, 52, 436 * clamp(e.hp / e.hpMax, 0, 1), 8);
  }
  const aliveLeft = R.run.enemies.filter(e => e.kind !== 'boss').length;
  CX.fillStyle = '#a3997e'; CX.font = '12px Georgia';
  CX.fillText(bossOn ? 'KILL THE BOSS' : ('HOSTILES: ' + aliveLeft + (R.run.toSpawn ? ' + ' + R.run.toSpawn + ' inbound' : '')), VW / 2, 76);
  CX.textAlign = 'left'; CX.fillStyle = '#e8dcc2'; CX.font = 'bold 13px Georgia';
  CX.fillText('SCORE ' + R.run.score, 30, 30);
  CX.fillStyle = '#8ecae6';
  CX.fillText('SQUAD ' + R.run.mates.filter(m => !m.dead).length + '/' + R.run.mates.length, 30, 52);
  updateChip();
  CX.strokeStyle = 'rgba(255,233,168,.85)'; CX.lineWidth = 1.5;
  CX.beginPath();
  CX.moveTo(G.mx - 8, G.my); CX.lineTo(G.mx - 3, G.my);
  CX.moveTo(G.mx + 3, G.my); CX.lineTo(G.mx + 8, G.my);
  CX.moveTo(G.mx, G.my - 8); CX.lineTo(G.mx, G.my - 3);
  CX.moveTo(G.mx, G.my + 3); CX.lineTo(G.mx, G.my + 8);
  CX.stroke();
}

/* ---------------- screens ---------------- */
function screen(id) { hideScreens(); if (id) $(id).classList.add('on'); }
function hideScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); }

/* ---------------- menu screens: loadout / store / squad ---------------- */
let storeSel = null, lastCrateResult = null;
const tabs = { load: 'W', store: 'BR', squad: 'SQUAD' };
const MODE_TABS = {
  load: [['W', 'WEAPONS (OWNED)'], ['ARMORW', 'ARMOR (OWNED)']],
  store: [['BR', 'BATTLE'], ['AR', 'RIFLES'], ['SM', 'SMG'], ['SG', 'SHOTGUNS'], ['SN', 'SNIPER'], ['MG', 'LMG'], ['PI', 'PISTOLS'], ['SP', 'SPECIAL'], ['ARMOR', 'ARMOR'], ['CLOTH', 'CLOTHING']],
  squad: [['SQUAD', 'SQUAD — TROOPS'], ['CRATES', 'REINFORCEMENT OFFICE']],
};
function tierBadge(t) { return '<span style="color:' + TIER_COL[t - 1] + ';font-size:11px;letter-spacing:.1em">T' + t + ' ' + TIER_NAMES[t - 1] + '</span>'; }

function renderTabs(px) {
  const P = ({ load: 'lo', store: 'st', squad: 'sq' })[px] || px;
  const el = $(P + '-tabs'); if (!el) return; el.innerHTML = '';
  MODE_TABS[px].forEach(([k, lab]) => {
    const t = document.createElement('span');
    t.className = 'tab' + (tabs[px] === k ? ' on' : ''); t.textContent = lab;
    t.onclick = () => { tabs[px] = k; storeSel = null; renderTabs(px); renderList(px); renderDetail(px); };
    el.appendChild(t);
  });
}
function renderList(px) {
  const P = ({ load: 'lo', store: 'st', squad: 'sq' })[px] || px;
  const L = $(P + '-list'); if (!L) return;
  L.innerHTML = '';
  const addRow = (html, cls, onclick) => {
    const row = document.createElement('div');
    row.className = 'witem ' + cls; row.innerHTML = html;
    row.onclick = onclick;
    L.appendChild(row);
  };
  const tab = tabs[px];
  if (px === 'load') {
    if (tab === 'W') {
      WEAPONS.filter(w => S.ownedW.includes(w.n)).forEach(w => {
        addRow('<span class="n">' + w.n + '</span><span class="cat">' + CAT_LABEL[w.c] + '</span>',
          (storeSel === w ? 'sel ' : ''),
          () => { storeSel = w; storeSel.kind = 'weapon'; renderList(px); renderDetail(px); });
      });
    } else {
      ARMORS.forEach((a, i) => {
        if (!S.ownedArm.includes(i)) return;
        addRow('<span class="n">' + a.n + (S.armor === i ? ' ✔' : '') + '</span><span class="cat">PROT ' + Math.round(a.prot * 100) + '%</span>',
          (storeSel && storeSel.kind === 'armor' && storeSel.i === i ? 'sel' : ''),
          () => { storeSel = { kind: 'armor', i }; renderList(px); renderDetail(px); });
      });
    }
  } else if (px === 'store') {
    if (tab === 'ARMOR') {
      ARMORS.forEach((a, i) => {
        const owned = S.ownedArm.includes(i);
        addRow('<span class="n">' + a.n + (S.armor === i ? ' ✔' : '') + '</span><span class="pr">' + (owned ? 'OWNED' : '$' + a.p) + '</span>',
          (storeSel && storeSel.kind === 'armor' && storeSel.i === i ? 'sel ' : '') + (owned ? 'owned' : ''),
          () => { storeSel = { kind: 'armor', i }; renderList(px); renderDetail(px); });
      });
    } else if (tab === 'CLOTH') {
      CLOTHES.forEach((a, i) => {
        const owned = S.ownedCloth.includes(i), inUse = S.cloth === i;
        addRow('<span class="n">' + a.n + (inUse ? ' ✔' : '') + '</span><span class="pr">' + (owned ? 'OWNED' : '$' + a.p) + '</span>',
          (storeSel && storeSel.kind === 'cloth' && storeSel.i === i ? 'sel ' : '') + (owned ? 'owned' : ''),
          () => { storeSel = { kind: 'cloth', i }; renderList(px); renderDetail(px); });
      });
      BOOTS.forEach((a, i) => {
        const owned = S.ownedBoots.includes(i), inUse = S.boots === i;
        addRow('<span class="n">' + a.n + (inUse ? ' ✔' : '') + '</span><span class="pr">' + (owned ? 'OWNED' : '$' + a.p) + '</span>',
          (storeSel && storeSel.kind === 'boots' && storeSel.i === i ? 'sel ' : '') + (owned ? 'owned' : ''),
          () => { storeSel = { kind: 'boots', i }; renderList(px); renderDetail(px); });
      });
    } else {
      WEAPONS.filter(w => w.c === tab).forEach(w => {
        const owned = S.ownedW.includes(w.n);
        addRow('<span class="n">' + w.n + '</span><span class="pr">' + (owned ? 'OWNED' : '$' + w.price) + '</span>',
          (storeSel === w ? 'sel ' : '') + (owned ? 'owned' : 'locked'),
          () => { storeSel = w; storeSel.kind = 'weapon'; renderList(px); renderDetail(px); });
      });
    }
  } else { // squad
    if (tab === 'SQUAD') {
      for (let t = 1; t <= 5; t++) {
        const hdr = document.createElement('div');
        hdr.style.cssText = 'padding:8px 10px 3px;color:' + TIER_COL[t - 1] + ';font-size:12px;letter-spacing:.2em';
        hdr.textContent = 'TIER ' + t + ' — ' + TIER_NAMES[t - 1];
        L.appendChild(hdr);
        for (const m of MATES.filter(r => r.tier === t)) {
          const owned = S.ownedMates.includes(m.name);
          const equipped = S.squad.includes(m.name);
          addRow('<span class="n">' + m.name + ' <span style="color:#a3997e;font-size:10px">· ' + NAT_LABEL[m.nat] + '</span>' + (equipped ? ' ✔' : '') + '</span><span class="pr">' + (owned ? 'READY' : 'PAPERS ONLY') + '</span>',
            (storeSel === m ? 'sel ' : '') + (owned ? 'owned' : ''),
            () => { storeSel = m; renderList(px); renderDetail(px); });
        }
      }
    } else { // CRATES
      CRATES.forEach((c, i) => {
        const bought = (S.cratesBought || [0, 0, 0])[i] || 0;
        addRow('<span class="n">' + c.n + '</span><span class="pr">$' + c.price + (bought ? ' ×' + bought : '') + '</span>',
          (storeSel && storeSel.kind === 'crate' && storeSel.i === i ? 'sel' : ''),
          () => { storeSel = { kind: 'crate', i }; renderList(px); renderDetail(px); });
      });
      const note = document.createElement('div');
      note.className = 'wd'; note.style.cssText = 'padding:10px;font-size:12px';
      note.textContent = 'Each package processes 1 gear item + 2 soldier transfers. Higher price buys better paperwork: rarer ranks and better gear.';
      L.appendChild(note);
    }
  }
}
function weaponDetailHTML(w, owned) {
  const dps = Math.round((w.d * (w.pc || 1)) * w.r / 60);
  const blurb = {
    AR: 'Selective fire 5.56×45 carbine — the in-country standard.',
    SM: 'Close-quarters automatic. Wall the brush at breath range.',
    SG: 'Buckshot through the wire — tunnel rat work.',
    SN: 'One round, one act of arithmetic.',
    MG: 'Heavy. Loud. Owns the treeline.',
    BR: 'Full-power rifle round. Slower, harder, more legs.',
    SP: 'Specialist launcher. Leave craters.',
    PI: 'The pistol you carry when plans fall apart.',
  }[w.c] || '';
  return '<div class="wn">' + w.n + '</div>' + tierBadge(w.tier || 1) +
    '<span style="color:#a3997e;font-size:12px;letter-spacing:.14em;margin-left:10px">' + CAT_LABEL[w.c] + ' · ' + w.md.toUpperCase() + '</span>' +
    '<div class="statgrid">' +
    '<div><span class="k">Damage</span><br>' + w.d + (w.pc > 1 ? '×' + w.pc : '') + '</div>' +
    '<div><span class="k">Rate</span><br>' + w.r + ' rpm</div>' +
    '<div><span class="k">Mag</span><br>' + w.m + '</div>' +
    '<div><span class="k">Reload</span><br>' + w.rl + 's</div>' +
    '<div><span class="k">Spread</span><br>' + Math.round(w.sp * 57.3) + '°</div>' +
    '<div><span class="k">Range</span><br>' + w.rng + '</div>' +
    '<div><span class="k">Est DPS</span><br>' + dps + '</div>' +
    '<div><span class="k">Price</span><br>$' + w.price + '</div></div>' +
    '<div class="wd">' + blurb + '</div>';
}
function renderDetail(px) {
  const P = ({ load: 'lo', store: 'st', squad: 'sq' })[px] || px;
  const D = $(P + '-detail'); if (!D) return;
  const tab = tabs[px];
  // button visibility by selection type
  const isWeapon = storeSel && storeSel.kind === 'weapon';
  const isArmor = storeSel && storeSel.kind === 'armor';
  const isMate = storeSel && storeSel.tier && !storeSel.kind;
  const isCrate = storeSel && storeSel.kind === 'crate';
  if (px === 'load') {
    $('lo-set1').style.display = isWeapon ? '' : 'none';
    $('lo-set2').style.display = isWeapon ? '' : 'none';
    $('lo-setA').style.display = isArmor ? '' : 'none';
    $('lo-set1').disabled = $('lo-set2').disabled = !(isWeapon && S.ownedW.includes(storeSel.n));
    $('lo-setA').disabled = !(isArmor && S.ownedArm.includes(storeSel.i) && S.armor !== storeSel.i);
  } else if (px === 'squad') {
    const on = isMate && S.ownedMates.includes(storeSel.name);
    ['sq-set1', 'sq-set2', 'sq-set3'].forEach(id => {
      $(id).style.display = isMate ? '' : 'none';
      $(id).disabled = !on;
    });
    $('sq-buy').style.display = tab === 'CRATES' ? '' : 'none';
  }
  if (!storeSel) {
    if (px === 'load') D.innerHTML = '<div class="wd">Pick an owned weapon for slot 1 (primary) or slot 2 (sidearm), and choose the vest you fight in. Buy new gear at the S-4 Store.</div>';
    else if (px === 'squad') D.innerHTML = '<div class="wd">Assign transferred troops to your three march-out slots. They fight beside you and buff your soldier (top bar). Troops join the roster via the REINFORCEMENT OFFICE tab here.</div>';
    else D.innerHTML = '<div class="wd">Everything on credit. Weapons by class, armor and era-accurate fatigues. Equip purchases back at the Loadout screen.</div>';
    return;
  }
  if (isWeapon) {
    const w = storeSel, owned = S.ownedW.includes(w.n);
    D.innerHTML = weaponDetailHTML(w, owned);
    if (px === 'store') {
      const b = $('st-buy');
      b.textContent = owned ? 'OWNED — EQUIP IN LOADOUT' : 'BUY $' + w.price;
      b.disabled = owned ? true : S.req < w.price;
    }
    return;
  }
  if (isArmor) {
    const a = ARMORS[storeSel.i], owned = S.ownedArm.includes(storeSel.i);
    D.innerHTML = '<div class="wn">' + a.n + '</div>' + tierBadge(ARMOR_TIER[storeSel.i]) +
      '<span style="color:#a3997e;font-size:12px;letter-spacing:.14em;margin-left:10px">ARMOR</span><div class="wd">' + a.desc + '</div>' +
      '<div class="chips"><span>PROTECTION <b>' + Math.round(a.prot * 100) + '%</b></span><span>SPEED <b>' + Math.round(a.spd * 100) + '%</b></span></div>';
    if (px === 'load') {
      const b = $('lo-setA');
      b.textContent = S.armor === storeSel.i ? 'ALREADY WORN' : 'WEAR THIS';
      b.disabled = S.armor === storeSel.i;
    } else {
      const b = $('st-buy');
      b.textContent = owned ? (S.armor === storeSel.i ? 'WORN' : 'OWNED — WEAR IN LOADOUT') : 'BUY $' + a.p;
      b.disabled = owned ? true : S.req < a.p;
    }
    return;
  }
  if (storeSel.kind === 'cloth' || storeSel.kind === 'boots') { // store only
    const tiers = storeSel.kind === 'cloth' ? CLOTH_TIER : BOOT_TIER;
    const arr = storeSel.kind === 'cloth' ? CLOTHES : BOOTS;
    const a = arr[storeSel.i];
    const own = storeSel.kind === 'cloth' ? S.ownedCloth : S.ownedBoots;
    const owned = own.includes(storeSel.i);
    D.innerHTML = '<div class="wn">' + a.n + '</div>' + tierBadge(tiers[storeSel.i]) +
      '<span style="color:#a3997e;font-size:12px;letter-spacing:.14em;margin-left:10px">' + storeSel.kind.toUpperCase() + '</span><div class="wd">' + a.desc + '</div>' +
      '<div class="chips"><span>' + (storeSel.kind === 'cloth' ? 'PERIOD CUT' : 'SPEED') + ' <b>' + (storeSel.kind === 'cloth' ? 'issued &amp; faded' : Math.round(a.spd * 100) + '%') + '</b></span></div>';
    $('st-buy').textContent = owned ? 'OWNED — WEAR IN BARRACKS' : 'BUY $' + a.p;
    $('st-buy').disabled = owned ? true : S.req < a.p;
    return;
  }
  if (isMate) {
    const m = storeSel, owned = S.ownedMates.includes(m.name);
    const ti = TRAIT_INFO[m.trait];
    D.innerHTML = '<div class="wn">' + m.name + '</div>' + tierBadge(m.tier) +
      '<span style="color:#a3997e;font-size:12px;letter-spacing:.14em;margin-left:10px">' + NAT_LABEL[m.nat] + '</span>' +
      '<div class="wd"><b style="color:#8ecae6">' + ti.n + '</b> — ' + ti.d + '</div>' +
      '<div class="chips"><span>SQUAD BUFF <b>+' + Math.round(m.buffVal * 100) + '% ' + BUFF_LABEL[m.buff] + '</b></span><span>STAMINA <b>' + m.hp + '</b></span><span>FIREPOWER <b>×' + m.dmgMul.toFixed(2) + '</b></span></div>' +
      '<div class="wd">' + (owned ? 'Transferred in — assign him to a march-out slot.' : 'Not on your roster. Process transfer papers at the REINFORCEMENT OFFICE tab.') + '</div>';
    return;
  }
  if (isCrate) {
    const c = CRATES[storeSel.i];
    const pool = c.tierW.map((w, i) => w > 0 ? 'T' + (i + 1) + ' ' + w + '%' : null).filter(Boolean).join(' · ');
    D.innerHTML = '<div class="wn">' + c.n + '</div><span style="color:#a3997e;font-size:12px;letter-spacing:.14em">REINFORCEMENT PACKAGE</span>' +
      '<div class="wd">' + c.d + '</div>' +
      '<div class="chips"><span>GRANTS <b>1 GEAR ITEM + 2 SOLDIER TRANSFERS</b></span></div>' +
      '<div class="wd">Transfer odds: ' + pool + '</div>' +
      (lastCrateResult && lastCrateResult.crate === c.n ?
        '<div class="wd" style="color:#7fb069">Last package: ' + lastCrateResult.lines.join(' · ') + '</div>' : '');
    $('sq-buy').textContent = 'PROCESS PACKAGE $' + c.price;
    $('sq-buy').disabled = S.req < c.price;
  }
}
/* reinforcement package roll: 1 gear item + 2 soldiers (shared by store + silent raid) */
function rollPackage(c) {
  const lines = [];
  const tierRoll = () => { const r = Math.random() * 100; let acc = 0; for (let i = 0; i < 5; i++) { acc += c.tierW[i]; if (r < acc) return i + 1; } return 1; };
  let gearKind = Math.random() < .55 ? 'weapon' : Math.random() < .45 ? 'armor' : 'cloth';
  if (gearKind === 'weapon') {
    const pool = WEAPONS.filter(w => w.tier === tierRoll());
    const pick = pool.length ? pool[Math.floor(rnd(0, pool.length))] : WEAPONS[Math.floor(rnd(0, WEAPONS.length))];
    if (!S.ownedW.includes(pick.n)) { S.ownedW.push(pick.n); lines.push('Gear: ' + pick.n); }
    else { const back = Math.round(pick.price * .4); S.req += back; lines.push('Duplicate gear sold (+$' + back + ')'); }
  } else if (gearKind === 'armor') {
    const t = tierRoll();
    const idx = ARMOR_TIER.map((v, i) => v === t ? i : -1).filter(i => i >= 0 && !S.ownedArm.includes(i));
    if (idx.length) { const pick = idx[Math.floor(rnd(0, idx.length))]; S.ownedArm.push(pick); lines.push('Gear: ' + ARMORS[pick].n); }
    else { const back = Math.round(c.price * .3); S.req += back; lines.push('Armor excess refunded (+$' + back + ')'); }
  } else {
    const isBoot = Math.random() < .35;
    const t = tierRoll();
    const tiers = isBoot ? BOOT_TIER : CLOTH_TIER;
    const arr = isBoot ? BOOTS : CLOTHES;
    const ownArr = isBoot ? S.ownedBoots : S.ownedCloth;
    const idx = tiers.map((v, i) => v >= t - 1 && v <= t ? i : -1).filter(i => i >= 0 && !ownArr.includes(i));
    if (idx.length) { const pick = idx[Math.floor(rnd(0, idx.length))]; ownArr.push(pick); lines.push('Gear: ' + arr[pick].n); }
    else { const back = Math.round(c.price * .25); S.req += back; lines.push('Clothing excess refunded (+$' + back + ')'); }
  }
  for (let k = 0; k < 2; k++) {
    let tried = 0, mate = null;
    while (tried++ < 6 && !mate) {
      const t = Math.min(5, tierRoll() + Math.floor((tried - 1) / 2));
      const pool = MATES.filter(r => r.tier === t && !S.ownedMates.includes(r.name));
      if (pool.length) mate = pool[Math.floor(rnd(0, pool.length))];
    }
    if (mate) {
      S.ownedMates.push(mate.name);
      lines.push('Troop: ' + mate.name + ' (T' + mate.tier + ' ' + TIER_NAMES[mate.tier - 1] + ' · ' + NAT_LABEL[mate.nat] + ' · ' + TRAIT_INFO[mate.trait].n + ')');
    } else {
      const back = MATE_VAL(tierRoll());
      S.req += back; lines.push('Roster full → reassignment credit (+$' + back + ')');
    }
  }
  return lines;
}
function openCrate() {
  const c = CRATES[storeSel.i];
  if (S.req < c.price) return;
  S.req -= c.price;
  S.cratesBought = S.cratesBought || [0, 0, 0];
  S.cratesBought[storeSel.i]++;
  const lines = rollPackage(c);
  lastCrateResult = { crate: c.n, lines };
  sLoot();
  save(); renderList('squad'); renderDetail('squad'); refreshTop(); renderChar();
}
function buyStore() {
  if (!storeSel) return;
  if (storeSel.kind === 'armor') {
    const a = ARMORS[storeSel.i];
    if (!S.ownedArm.includes(storeSel.i)) { if (S.req < a.p) return; S.req -= a.p; S.ownedArm.push(storeSel.i); S.armor = storeSel.i; }
  } else if (storeSel.kind === 'cloth' || storeSel.kind === 'boots') {
    const a = (storeSel.kind === 'cloth' ? CLOTHES : BOOTS)[storeSel.i];
    const own = storeSel.kind === 'cloth' ? S.ownedCloth : S.ownedBoots;
    if (!own.includes(storeSel.i)) { if (S.req < a.p) return; S.req -= a.p; own.push(storeSel.i); }
    S[storeSel.kind] = storeSel.i;
  } else if (storeSel.kind === 'weapon') {
    if (!S.ownedW.includes(storeSel.n)) { if (S.req < storeSel.price) return; S.req -= storeSel.price; S.ownedW.push(storeSel.n); }
  }
  save(); renderList('store'); renderDetail('store'); refreshTop(); renderChar();
}
function equipWeapon(slot) {
  if (!storeSel || storeSel.kind !== 'weapon' || !S.ownedW.includes(storeSel.n)) return;
  if (slot === 1) S.primary = storeSel.n; else S.sidearm = storeSel.n;
  tone(320, .05, .07, 'square');
  save(); refreshTop(); renderDetail('load');
}
function wearArmor() {
  if (!storeSel || storeSel.kind !== 'armor' || !S.ownedArm.includes(storeSel.i)) return;
  S.armor = storeSel.i;
  tone(320, .05, .07, 'square');
  save(); refreshTop(); renderDetail('load'); renderChar();
}
function equipSquad(slot) {
  if (!storeSel || !storeSel.tier || storeSel.kind) return;
  if (!S.ownedMates.includes(storeSel.name)) return;
  const i = slot - 1;
  if (S.squad[i] === storeSel.name) return;
  const dup = S.squad.indexOf(storeSel.name);
  if (dup >= 0) S.squad[dup] = null;
  S.squad[i] = storeSel.name;
  tone(320, .05, .07, 'square');
  save(); G.buff = computeBuffs(); renderList('squad'); renderDetail('squad'); refreshTop(); renderChar();
}
function updateChip() { const c = $('chipReq'); if (c && c.textContent !== '$' + S.req) c.textContent = '$' + S.req; }
function refreshTop() {
  const chip = $('chipReq'); if (chip) chip.textContent = '$' + S.req;
  document.querySelectorAll('.topstrip').forEach(ts => {
    ts.querySelector('.req').textContent = '$' + S.req;
    ts.querySelector('.best').textContent = S.bestRound ? 'Best round ' + S.bestRound + ' · ' + S.totalKills + ' kills · ' + S.ownedMates.length + ' troops' : 'No tours yet';
    ts.querySelector('.who').textContent = 'SPC. ' + (S.name || 'SOMEBODY').toUpperCase();
  });
  $('lo-slot1').textContent = S.primary || '—';
  $('lo-slot2').textContent = S.sidearm || '—';
  $('lo-slotA').textContent = ARMORS[S.armor].n;
  for (let i = 0; i < 3; i++) $('sq-s' + (i + 1)).textContent = S.squad[i] || '— open —';
}
function gotoTitle() { G.scene = 'title'; screen('scr-title'); refreshTop(); }
function buffSummary() {
  const b = computeBuffs();
  const out = [];
  if (b.dmg) out.push('DMG +' + Math.round(b.dmg * 100) + '%');
  if (b.spd) out.push('SPD +' + Math.round(b.spd * 100) + '%');
  if (b.hp) out.push('HP +' + Math.round(b.hp * 100));
  if (b.prot) out.push('ARM +' + Math.round(b.prot * 100) + '%');
  if (b.reload) out.push('RLD +' + Math.round(b.reload * 100) + '%');
  return out.join(', ');
}
function openLoad() { G.scene = 'load'; screen('scr-load'); refreshTop(); renderTabs('load'); renderList('load'); renderDetail('load'); }
function openStore() { G.scene = 'store'; screen('scr-store'); refreshTop(); renderTabs('store'); renderList('store'); renderDetail('store'); }
function openSquad() { G.scene = 'squad'; screen('scr-squad'); refreshTop(); renderTabs('squad'); renderList('squad'); renderDetail('squad'); }

/* ---------------- barracks ---------------- */
function pills(rowEl, list, cur, cb) {
  const el = $(rowEl); el.innerHTML = '';
  list.forEach((label, i) => {
    const p = document.createElement('span');
    p.className = 'pill' + (cur === i ? ' on' : '');
    p.textContent = label; p.onclick = () => cb(i);
    el.appendChild(p);
  });
}
function renderChar() {
  const el = $('inName'); if (!el) return;
  el.value = S.name;
  const sk = $('swSkin'); sk.innerHTML = '';
  SKINS.forEach((c, i) => {
    const d = document.createElement('div'); d.className = 'sw' + (S.skin === i ? ' on' : ''); d.style.background = c;
    d.onclick = () => { S.skin = i; save(); renderChar(); }; sk.appendChild(d);
  });
  pills('rowHead', HEADWEAR, S.head, i => { S.head = i; save(); renderChar(); });
  pills('rowPaint', PAINT, S.paint, i => { S.paint = i; save(); renderChar(); });
  pills('rowCloth', CLOTHES.map((c, i) => c.n + (S.ownedCloth.includes(i) ? ' ✔' : ' $' + c.p)), S.cloth, i => {
    if (!S.ownedCloth.includes(i)) return charNote('Not issued — buy at the S-4 Store ($' + CLOTHES[i].p + ').');
    S.cloth = i; save(); renderChar(); charNote('');
  });
  pills('rowBoots', BOOTS.map((b, i) => b.n + (S.ownedBoots.includes(i) ? ' ✔' : ' $' + b.p)), S.boots, i => {
    if (!S.ownedBoots.includes(i)) return charNote('Not issued — buy at the S-4 Store ($' + BOOTS[i].p + ').');
    S.boots = i; save(); renderChar(); charNote('');
  });
  pills('rowArmor', ARMORS.map((a, i) => a.n + (S.ownedArm.includes(i) ? ' ✔' : ' $' + a.p)), S.armor, i => {
    if (!S.ownedArm.includes(i)) return charNote('Not issued — buy at the S-4 Store ($' + ARMORS[i].p + ').');
    S.armor = i; save(); renderChar(); charNote('');
  });
  const qs = $('charSquad');
  const sq = S.squad.map((n, i) => {
    const r = n && mateByName(n);
    return r ? '<b style="color:' + TIER_COL[r.tier - 1] + '">' + r.name + '</b> (+' + Math.round(r.buffVal * 100) + '% ' + BUFF_LABEL[r.buff] + ')'
             : '<span style="opacity:.5">SLOT ' + (i + 1) + ': open</span>';
  });
  qs.innerHTML = 'SQUAD — ' + sq.join(' &nbsp;·&nbsp; ') + (buffSummary() ? ' &nbsp;<span style="color:#7fb069">BUFFS: ' + buffSummary() + '</span>' : '') +
    '<br>Troops arrive via the SQUAD screen: US, ARVN, ROK Marines and Aussies across 5 rank tiers. Levels rotate across villages, paddies, jungle and open ground.';
  drawCharacter(); refreshTop();
}
function charNote(t) { $('charDetail').textContent = t; }
const chCx = $('charCanvas').getContext('2d');
function drawCharacter() {
  chCx.fillStyle = '#100e0a'; chCx.fillRect(0, 0, 240, 280);
  drawSoldier(chCx, 118, 128, 0, Object.assign(armorClothAll(), { scale: 3.4 }));
  S.squad.slice(0, 3).forEach((n, i) => {
    const r = n && mateByName(n);
    if (r) drawMate(chCx, 46 + i * 76, 214, 0, r, 1);
  });
  chCx.fillStyle = '#a3997e'; chCx.font = '11px Georgia'; chCx.textAlign = 'center';
  const cl = CLOTHES[S.cloth], arm = armorById(S.armor);
  chCx.fillText(cl.n + ' · ' + arm.n, 120, 252);
  chCx.fillText('BARRACKS PREVIEW', 120, 270);
}

/* ---------------- silent raid into cambodia (12h covert supply drop) ---------------- */
const RAID_CD = 12 * 3600 * 1000;
const raidReady = () => !S.raidLast || Date.now() - S.raidLast >= RAID_CD;
const raidLeft = () => Math.max(0, RAID_CD - (Date.now() - (S.raidLast || 0)));
function fmtCd(ms) {
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
function openRaid() {
  $('raidPanel').classList.toggle('on');
  renderRaid();
}
function renderRaid() {
  const ready = raidReady();
  $('b-raidGo').disabled = !ready;
  $('b-raidGo').textContent = ready ? 'Go Silent — Launch Raid' : 'Extraction Underway';
  $('raidCd').textContent = ready ? 'Packages staged — raid window open.' : 'Next raid window in ' + fmtCd(raidLeft()) + '.';
  $('raidTimer').textContent = ready ? '▲ SILENT RAID INTO CAMBODIA' : '▲ SILENT RAID · ' + fmtCd(raidLeft());
}
function runRaid() {
  if (!raidReady()) return;
  S.raidLast = Date.now();
  const field = rollPackage(CRATES[0]);
  const black = rollPackage(CRATES[2]);
  sLoot(); setTimeout(sLoot, 260);
  const el = $('raidRes');
  el.innerHTML =
    '<b style="color:#c8a84b">FIELD TRANSFER PAPERS:</b>' + field.map(l => '<div class="line">' + l + '</div>').join('') +
    '<b style="color:#8ecae6">MACV-SOG BLACK FILE:</b>' + black.map(l => '<div class="line">' + l + '</div>').join('');
  save(); refreshTop(); renderChar(); renderRaid();
}
setInterval(() => {
  const btn = $('raidTimer');
  if (!btn) return;
  btn.textContent = raidReady() ? '▲ SILENT RAID INTO CAMBODIA' : '▲ SILENT RAID · ' + fmtCd(raidLeft());
  if ($('raidPanel').classList.contains('on')) renderRaid();
}, 1000);

/* ---------------- wiring ---------------- */
function wire() {
  $('tagline').textContent = WEAPONS.length + ' period weapons · 5 troop tiers · 4 areas · boss every 10th round';
  $('b-start').onclick = () => { audio(); deploy(); };
  $('b-raid').onclick = openRaid;
  $('b-raidGo').onclick = runRaid;
  $('b-raidClose').onclick = () => { $('raidPanel').classList.remove('on'); };
  $('b-char').onclick = () => { audio(); G.scene = 'char'; screen('scr-char'); renderChar(); };
  $('b-load').onclick = () => { audio(); openLoad(); };
  $('b-store').onclick = () => { audio(); openStore(); };
  $('b-squad').onclick = () => { audio(); openSquad(); };
  // barracks
  $('b-back1').onclick = gotoTitle;
  $('b-toLoadout').onclick = () => openLoad();
  $('b-toStore').onclick = () => openStore();
  $('b-toSquad').onclick = () => openSquad();
  // loadout
  $('lo-back').onclick = gotoTitle;
  $('lo-deploy').onclick = () => { audio(); deploy(); };
  $('lo-set1').onclick = () => equipWeapon(1);
  $('lo-set2').onclick = () => equipWeapon(2);
  $('lo-setA').onclick = wearArmor;
  // store
  $('st-back').onclick = gotoTitle;
  $('st-load').onclick = () => openLoad();
  $('st-buy').onclick = buyStore;
  // squad
  $('sq-back').onclick = gotoTitle;
  $('sq-deploy').onclick = () => { audio(); deploy(); };
  $('sq-set1').onclick = () => equipSquad(1);
  $('sq-set2').onclick = () => equipSquad(2);
  $('sq-set3').onclick = () => equipSquad(3);
  $('sq-buy').onclick = openCrate;
  // inter
  $('b-next').onclick = () => nextRound();
  $('b-inter-load').onclick = () => openLoad();
  $('b-inter-squad').onclick = () => openSquad();
  $('b-inter-store').onclick = () => openStore();
  // pause
  $('b-resume').onclick = () => pause(false);
  $('b-abort').onclick = gotoTitle;
  // over
  $('b-retry').onclick = () => deploy();
  $('b-loadOver').onclick = () => openLoad();
  $('b-squadOver').onclick = () => openSquad();
  $('b-storeOver').onclick = () => openStore();
  $('b-menu').onclick = gotoTitle;
  $('inName').addEventListener('input', e => { S.name = e.target.value; save(); refreshTop(); });
  $('inName').addEventListener('keydown', e => e.stopPropagation());
}
/* ---------------- animated menu backdrop: jungle + Huey + M60 door gunner ---------------- */
function drawMenuScene() {
  const t = performance.now() / 1000;
  // sky gradient (hot hazy afternoon)
  const g = CX.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#23241a'); g.addColorStop(.5, '#4a4430'); g.addColorStop(1, '#38331f');
  CX.fillStyle = g; CX.fillRect(0, 0, VW, VH);
  // sun haze
  CX.fillStyle = 'rgba(220,186,120,.1)';
  CX.beginPath(); CX.ellipse(VW * .7, VH * .38, 300, 150, 0, 0, TAU); CX.fill();
  CX.fillStyle = 'rgba(255,240,200,.08)';
  CX.beginPath(); CX.arc(VW * .7, VH * .37, 60, 0, TAU); CX.fill();
  // layered jungle silhouettes
  treeLayer(VH * .52, 'rgba(38,47,26,.85)', 24, 900, .012);
  treeLayer(VH * .63, 'rgba(28,36,20,.92)', 32, 350, .017);
  treeLayer(VH * .78, 'rgba(20,26,14,.98)', 40, 700, .022);
  // hazy fog bands
  for (let i = 0; i < 3; i++) {
    CX.fillStyle = 'rgba(180,170,130,' + (.03 + i * .015) + ')';
    const fy = VH * (.5 + i * .1) + Math.sin(t * .2 + i) * 8;
    CX.fillRect(0, fy, VW, 30 + i * 12);
  }
  // near canopy calliandra bushes along the bottom
  CX.fillStyle = '#131a0d';
  CX.beginPath(); CX.moveTo(0, VH);
  for (let x = 0; x <= VW; x += 40) CX.lineTo(x, VH - 30 - Math.abs(Math.sin(x * .02)) * 44);
  CX.lineTo(VW, VH); CX.closePath(); CX.fill();
  for (let i = 0; i < 7; i++) palmTree(90 + i * 190 + Math.sin(i * 7) * 30, VH - 42, 1 + (i % 3) * .18);
  // Huey flying with door gunner laying fire
  drawHuey(t);
  // light film grain
  CX.fillStyle = 'rgba(0,0,0,.05)';
  for (let i = 0; i < 40; i++) CX.fillRect(Math.random() * VW, Math.random() * VH, 2, 2);
}
function treeLayer(y, col, amp, seed, freq) {
  CX.fillStyle = col;
  CX.beginPath(); CX.moveTo(0, VH);
  for (let x = 0; x <= VW; x += 26) {
    const h = Math.sin((x + seed) * freq) * amp + Math.sin((x + seed) * (freq * 2.7)) * amp * .5;
    CX.lineTo(x, y + h);
  }
  CX.lineTo(VW, VH); CX.closePath(); CX.fill();
}
function palmTree(x, y, s) {
  CX.strokeStyle = '#1c2313'; CX.lineWidth = 6 * s;
  CX.beginPath(); CX.moveTo(x, y); CX.quadraticCurveTo(x + 10 * s, y - 60 * s, x + 2 * s, y - 110 * s); CX.stroke();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * .15 - i * (Math.PI * .7 / 6);
    CX.lineWidth = 4 * s;
    CX.beginPath();
    CX.moveTo(x + 2 * s, y - 110 * s);
    CX.quadraticCurveTo(x + 2 * s + Math.cos(a) * 50 * s, y - 110 * s + Math.sin(a) * 34 * s - 12,
                        x + 2 * s + Math.cos(a) * 86 * s, y - 110 * s + Math.sin(a) * 10 * s + 18);
    CX.stroke();
  }
}
function drawHuey(t) {
  // flight path: sweeps the sky, slow bob
  const x = (t * 46 % (VW + 560)) - 280;
  const y = VH * .3 + Math.sin(t * .5) * 26 + Math.sin(t * 1.3) * 6;
  const pitch = Math.sin(t * .5 + 1.2) * .04;
  const dir = Math.PI / 2; // facing right
  CX.save();
  CX.translate(x, y); CX.rotate(pitch);
  // shadow on the canopy below
  CX.fillStyle = 'rgba(0,0,0,.18)';
  CX.beginPath(); CX.ellipse(60, VH * .74 - y, 90, 22, 0, 0, TAU); CX.fill();
  // tail boom
  CX.fillStyle = '#3e4636'; CX.fillRect(-150, -6, 150, 9);
  CX.fillStyle = '#2e352a'; CX.fillRect(-166, -12, 20, 24);
  // tail rotor
  CX.save(); CX.translate(-158, 0);
  CX.strokeStyle = 'rgba(200,205,190,.5)'; CX.lineWidth = 2;
  const tr = t * 40;
  CX.beginPath(); CX.moveTo(Math.cos(tr) * 16, Math.sin(tr) * 16); CX.lineTo(-Math.cos(tr) * 16, -Math.sin(tr) * 16); CX.stroke();
  CX.restore();
  // fuselage
  CX.fillStyle = '#485240';
  CX.beginPath();
  CX.moveTo(78, 6); CX.quadraticCurveTo(88, -20, 60, -26); CX.lineTo(6, -26); CX.quadraticCurveTo(-36, -22, -42, 4);
  CX.quadraticCurveTo(-30, 22, 10, 24); CX.quadraticCurveTo(60, 24, 78, 6);
  CX.closePath(); CX.fill();
  CX.fillStyle = '#333c2e';
  CX.beginPath(); CX.ellipse(4, -8, 40, 12, 0, 0, TAU); CX.fill();
  // cockpit glass glint
  CX.strokeStyle = 'rgba(190,220,210,.4)'; CX.lineWidth = 3;
  CX.beginPath(); CX.moveTo(70, -18); CX.quadraticCurveTo(50, -30, 30, -26); CX.stroke();
  // door open + gunner hanging out
  CX.fillStyle = '#22281f'; CX.fillRect(-12, -6, 30, 18);
  const kick = Math.min(1, (t * .7 % 1.2) / 1.2); // weapon recoil sway
  CX.fillStyle = '#2c331f';
  CX.beginPath(); CX.ellipse(2 - kick * 3, 6, 8, 7, 0, 0, TAU); CX.fill();  // gunner torso
  CX.fillStyle = '#4a4a33'; CX.beginPath(); CX.arc(0 - kick * 3, -2, 5, 0, TAU); CX.fill(); // helmet head
  // M60 barrel pointing down-forward
  const firing = (t * .8 % 1.4) < .55;
  CX.strokeStyle = '#191914'; CX.lineWidth = 5;
  CX.beginPath(); CX.moveTo(4, 8); CX.lineTo(46 - kick * 4, 34); CX.stroke();
  CX.strokeStyle = '#0d0d0a'; CX.lineWidth = 3;
  CX.beginPath(); CX.moveTo(-2, 10); CX.lineTo(-18, 2); CX.stroke(); // ammo belt back to cabin
  // tracers when firing
  if (firing) {
    const burst = performance.now() / 1000;
    for (let i = 0; i < 4; i++) {
      const tt = (burst * 7 + i * .23) % 1;
      const sx = 46, sy = 34, tx = 46 + 420 * tt + i * 6, ty = 34 + 190 * tt + Math.sin((i + t) * 3) * 8 * tt;
      CX.strokeStyle = 'rgba(255,120,60,' + (1 - tt) * .9 + ')';
      CX.lineWidth = 2.4;
      CX.beginPath(); CX.moveTo(sx + (tx - sx) * Math.max(0, tt - .1), sy + (ty - sy) * Math.max(0, tt - .1)); CX.lineTo(tx, ty); CX.stroke();
    }
    // ground impacts (dirt puffs near treeline)
    for (let i = 0; i < 3; i++) {
      const px = x + 46 + 90 + i * 130 + Math.sin(t * 3 + i) * 20, py = y + 34 + 190 + 40;
      CX.fillStyle = 'rgba(150,120,80,.4)';
      CX.beginPath(); CX.arc(px, py, 6 + 4 * Math.sin(t * 9 + i * 2), 0, TAU); CX.fill();
    }
    // muzzle flash
    CX.fillStyle = 'rgba(255,220,120,' + (.7 + .3 * Math.sin(t * 60)) + ')';
    CX.save(); CX.translate(46 - kick * 4, 34);
    for (let i = 0; i < 4; i++) { CX.rotate(Math.PI / 2); CX.fillRect(0, -1.5, 14, 3); }
    CX.restore();
    // brass shells ejecting
    CX.fillStyle = '#c8a84b';
    CX.fillRect(-24 - ((t * 40) % 14), 12 + ((t * 40) % 14), 3, 2);
  }
  // skids
  CX.strokeStyle = '#232822'; CX.lineWidth = 4;
  CX.beginPath(); CX.moveTo(-30, 26); CX.lineTo(-30, 38); CX.lineTo(56, 38); CX.moveTo(14, 26); CX.lineTo(14, 38); CX.stroke();
  // main rotor mast + blur
  CX.fillStyle = '#20241c'; CX.fillRect(-4, -46, 8, 22);
  const ra = (t * 22) % TAU;
  CX.strokeStyle = 'rgba(190,195,180,.16)'; CX.lineWidth = 9;
  CX.beginPath(); CX.moveTo(-260, -48); CX.lineTo(260, -48); CX.stroke();
  CX.strokeStyle = 'rgba(210,215,200,.55)'; CX.lineWidth = 3;
  CX.beginPath();
  CX.moveTo(Math.cos(ra) * 260, -48 + Math.sin(ra) * 6);
  CX.lineTo(-Math.cos(ra) * 260, -48 - Math.sin(ra) * 6);
  CX.stroke();
  CX.restore();
}

/* go */
paintGround(BIOMES[0]);
wire();
refreshTop();
renderChar();
requestAnimationFrame(tick);
