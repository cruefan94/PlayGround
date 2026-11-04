/* Canvas renderers: animated miner, ore vein, wasteland combat. */
import { LAYERS, ZONES, ORES, layerMaxHp, pickPower } from './data.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgba(hex, a) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], clamp(t, 0, 1))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function outfitCoat(level) {
  const palette = ['#1c1e16', '#263027', '#3b3322', '#42262a', '#2b2138'];
  return palette[Math.min(palette.length - 1, Math.floor((level || 0) / 4))];
}
function outfitGoggles(level) {
  if (level >= 10) return '#ffd27a';
  if (level >= 5) return '#b7ee58';
  return '#8ff2f0';
}

class BaseRenderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.ctx = canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    this.last = performance.now();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement || canvas);
    this.resize();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    this.w = rect.width;
    this.h = rect.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.dpr !== dpr || this.canvas.width !== Math.round(rect.width * dpr) || this.canvas.height !== Math.round(rect.height * dpr)) {
      this.dpr = dpr;
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.onResize();
  }
  frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    if (this.w > 2 && this.h > 2) {
      const t = now / 1000;
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.draw(dt, t);
    }
    this.raf = requestAnimationFrame(this.frame);
  }
  onResize() {}
  draw() {}
}

/* ═══════════════════════════════════════════════════════════════
   MINE
   ═══════════════════════════════════════════════════════════════ */
export class MineRenderer extends BaseRenderer {
  constructor(canvas, game) {
    super(canvas, game);
    this.swing = 1;
    this.impacted = true;
    this.shake = 0;
    this.flash = 0;
    this.veinHidden = 0;
    this.nodePulse = 0;
    this.particles = [];
    this.floats = [];
    this.dust = [];
    this.lastKey = '';
    this.lastLayer = -1;
    this.smokeClock = 0;
    this.bgSeed = 1;
    this.strikeFx = [];
    this.initAmbient();
  }

  initAmbient() {
    const rnd = mulberry32(77);
    this.dust = Array.from({ length: 26 }, () => ({
      x: rnd(), y: rnd(), spd: 0.004 + rnd() * 0.012, drift: 0.3 + rnd(),
      r: 0.5 + rnd() * 1.5, a: 0.06 + rnd() * 0.22, ph: rnd() * TAU,
    }));
  }

  onResize() {
    this.floorY = this.h * 0.86;
    this.scale = clamp(this.h / 300, 0.8, 1.32);
    this.minerX = this.w * 0.615;
    this.veinX = this.w * 0.815;
    this.veinY = this.floorY - 58 * this.scale;
    this.bgSeed = 3 + (this.game.state.layer || 0) * 17;
    this.regenerateVein();
  }

  currentLayer() {
    return LAYERS[this.game.state.layer || 0] || LAYERS[0];
  }

  regenerateVein() {
    const layerIndex = this.game.state.layer || 0;
    const node = this.game.state.nodes?.[layerIndex] || 0;
    const rnd = mulberry32(1000 + layerIndex * 131 + node * 17 + Math.floor(this.w));
    this.lastKey = `${layerIndex}:${node}`;
    this.crystals = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const dist = 8 + rnd() * Math.min(44, this.w * 0.085);
      this.crystals.push({
        x: Math.cos(a) * dist,
        y: Math.sin(a) * dist * 0.65,
        len: 16 + rnd() * 42,
        wid: 4 + rnd() * 9,
        rot: rnd() * TAU,
        tone: 0.55 + rnd() * 0.7,
        front: rnd(),
      });
    }
    this.crystals.sort((a, b) => a.y - b.y);
    this.crackSeed = mulberry32(500 + layerIndex * 37 + node * 7);
  }

  strike() {
    this.swing = 0;
    this.impacted = false;
  }

  floatOre(amount, ore, crit = false) {
    const c = ORES[ore]?.color || '#ffb15c';
    this.floats.push({
      x: this.veinX + (Math.random() * 22 - 11),
      y: this.veinY - 12 + Math.random() * 10,
      vy: -32 - Math.random() * 12,
      life: 1.15,
      max: 1.15,
      text: `+${amount}`,
      color: crit ? '#fff0b8' : c,
      size: crit ? 15 : 11,
    });
  }

  veinBreak() {
    this.veinHidden = 0.22;
    this.flash = 1;
    this.shake = 9;
    this.nodePulse = 1;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU;
      const sp = 30 + Math.random() * 130;
      this.particles.push({
        x: this.veinX, y: this.veinY,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: 0.5 + Math.random() * 0.7, max: 1.2,
        size: 1 + Math.random() * 3.2, color: this.currentLayer().glow,
        gravity: 230,
      });
    }
    this.floats.push({
      x: this.veinX, y: this.veinY - 40, vy: -22, life: 1.5, max: 1.5,
      text: 'VEIN SHATTERED', color: '#ffe3bc', size: 10,
    });
  }

  addDustBurst(x, y, count = 8, color = '#c9b18d') {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 18 + Math.random() * 60;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.4, max: 0.7, size: 1 + Math.random() * 2.2,
        color, gravity: 120,
      });
    }
  }

  draw(dt, t) {
    const ctx = this.ctx;
    const state = this.game.state;
    const layerIndex = state.layer || 0;
    const layer = LAYERS[layerIndex] || LAYERS[0];
    const node = state.nodes?.[layerIndex] || 0;
    const key = `${layerIndex}:${node}`;
    if (key !== this.lastKey) {
      this.regenerateVein();
      this.nodePulse = 1;
    }
    if (this.lastLayer !== layerIndex) {
      this.lastLayer = layerIndex;
      this.bgSeed = 3 + layerIndex * 17;
      this.regenerateVein();
    }

    this.shake = Math.max(0, this.shake - dt * 28);
    this.flash = Math.max(0, this.flash - dt * 3.4);
    this.veinHidden = Math.max(0, this.veinHidden - dt);
    this.nodePulse = Math.max(0, this.nodePulse - dt * 2.2);

    if (this.swing < 1) {
      this.swing = Math.min(1, this.swing + dt / 0.34);
      if (!this.impacted && this.swing >= 0.42) {
        this.impacted = true;
        this.shake = Math.max(this.shake, 5);
        const px = this.veinX - 6 * this.scale;
        const py = this.veinY + 2;
        this.addDustBurst(px, py, 12, layer.glow);
        for (let i = 0; i < 5; i++) {
          this.particles.push({
            x: px, y: py,
            vx: -40 - Math.random() * 70, vy: -40 - Math.random() * 90,
            life: 0.25 + Math.random() * 0.3, max: 0.55,
            size: 0.8 + Math.random() * 1.8, color: '#ffd9a5', gravity: 300,
          });
        }
      }
    }

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this.drawBackground(ctx, t, layer, layerIndex);
    this.drawDust(ctx, t);
    this.drawCart(ctx, t, layer);
    this.drawDrillRig(ctx, t, layer, index0(state, layerIndex));
    this.drawCritter(ctx, t);
    this.drawVein(ctx, t, layer, state, layerIndex, node, key);
    this.drawMiner(ctx, t, layer);

    ctx.restore();

    this.updateParticles(dt);
    this.drawParticles(ctx);
    this.drawFloats(dt, ctx);

    // hit flash
    if (this.flash > 0.02) {
      const g = ctx.createRadialGradient(this.veinX, this.veinY, 4, this.veinX, this.veinY, this.w * 0.5);
      g.addColorStop(0, rgba(layer.glow, 0.28 * this.flash));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // vignette
    const v = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.2, this.w / 2, this.h / 2, this.h * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawBackground(ctx, t, layer, layerIndex) {
    const { w, h, floorY } = this;
    const cave = layer.cave;
    const glow = layer.glow;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#070806');
    g.addColorStop(0.35, cave);
    g.addColorStop(1, '#060706');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // warm glow around vein
    const vg = ctx.createRadialGradient(this.veinX, this.veinY, 2, this.veinX, this.veinY, Math.max(90, w * 0.35));
    vg.addColorStop(0, rgba(glow, 0.16));
    vg.addColorStop(0.5, rgba(glow, 0.045));
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    const rnd = mulberry32(this.bgSeed);

    // rock plates on walls
    for (let i = 0; i < 16; i++) {
      const x = rnd() * w;
      const y = rnd() * h * 0.65;
      const rw = 26 + rnd() * 90;
      const rh = 16 + rnd() * 55;
      ctx.beginPath();
      ctx.moveTo(x - rw / 2, y + rh / 2);
      ctx.lineTo(x - rw * 0.3, y - rh / 2);
      ctx.lineTo(x + rw * 0.35, y - rh * 0.42);
      ctx.lineTo(x + rw / 2, y + rh * 0.3);
      ctx.closePath();
      ctx.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.14})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // tunnel arch in back
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w * 0.42, floorY - 30, w * 0.23, h * 0.36, 0, Math.PI, 0);
    ctx.lineTo(w * 0.65, floorY - 8);
    ctx.lineTo(w * 0.19, floorY - 8);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, floorY - h * 0.5, 0, floorY);
    tg.addColorStop(0, '#020302');
    tg.addColorStop(1, '#080907');
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.stroke();
    ctx.restore();

    // wooden support beams
    this.drawBeam(ctx, w * 0.12, floorY, h * 0.56, 9 * this.scale, layerIndex);
    this.drawBeam(ctx, w * 0.37, floorY, h * 0.44, 7 * this.scale, layerIndex);

    // crossbeam
    ctx.save();
    ctx.strokeStyle = '#1b1710';
    ctx.lineWidth = 9 * this.scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.12);
    ctx.lineTo(w * 0.44, h * 0.09);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,160,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // stalactites
    const rnd2 = mulberry32(this.bgSeed + 9);
    ctx.fillStyle = '#070806';
    for (let i = 0; i < 12; i++) {
      const x = rnd2() * w;
      const len = 10 + rnd2() * 34;
      const wid = 4 + rnd2() * 10;
      ctx.beginPath();
      ctx.moveTo(x - wid, 0);
      ctx.lineTo(x + wid, 0);
      ctx.lineTo(x + wid * 0.15, len);
      ctx.closePath();
      ctx.fill();
    }

    // rails and floor
    const fg = ctx.createLinearGradient(0, floorY - 20, 0, h);
    fg.addColorStop(0, '#1a1711');
    fg.addColorStop(1, '#070806');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(0, floorY + 2);
    for (let x = 0; x <= w; x += 24) {
      ctx.lineTo(x, floorY + 2 + Math.sin(x * 0.09) * 2.5);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // rail
    ctx.save();
    ctx.strokeStyle = '#2b2a25';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY + 15);
    ctx.lineTo(w, floorY + 17);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, floorY + 13);
    ctx.lineTo(w, floorY + 15);
    ctx.stroke();
    // sleepers
    ctx.strokeStyle = '#18160f';
    ctx.lineWidth = 5;
    for (let x = 8; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, floorY + 10);
      ctx.lineTo(x + 5, floorY + 21);
      ctx.stroke();
    }
    ctx.restore();

    // foreground rubble
    const rnd3 = mulberry32(this.bgSeed + 33);
    for (let i = 0; i < 10; i++) {
      const x = rnd3() * w;
      const y = floorY + 12 + rnd3() * (h - floorY - 14);
      const rw = 8 + rnd3() * 26;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rw * 0.35, rnd3(), 0, TAU);
      ctx.fillStyle = `rgba(0,0,0,${0.3 + rnd3() * 0.35})`;
      ctx.fill();
    }

    // hanging lamp
    const lampX = w * 0.28;
    const lampY = h * 0.22 + Math.sin(t * 1.4) * 2;
    ctx.save();
    ctx.strokeStyle = '#1c1a15';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lampX, 0);
    ctx.lineTo(lampX, lampY - 6);
    ctx.stroke();
    const flicker = 0.75 + Math.sin(t * 13.1) * 0.08 + Math.sin(t * 27.3) * 0.05;
    const lg = ctx.createRadialGradient(lampX, lampY, 1, lampX, lampY, Math.min(110, w * 0.28));
    lg.addColorStop(0, `rgba(255,180,90,${0.22 * flicker})`);
    lg.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffc47a';
    ctx.beginPath();
    ctx.arc(lampX, lampY, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawBeam(ctx, x, floorY, topY, width, idx) {
    ctx.save();
    ctx.fillStyle = '#17130d';
    ctx.beginPath();
    ctx.moveTo(x - width / 2, 0);
    ctx.lineTo(x + width / 2, 0);
    ctx.lineTo(x + width * 0.4, floorY);
    ctx.lineTo(x - width * 0.55, floorY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,150,0.055)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // nails
    ctx.fillStyle = 'rgba(255,210,150,0.12)';
    for (let y = 14; y < floorY; y += 40) {
      ctx.fillRect(x - width * 0.2, y, 2, 2);
      ctx.fillRect(x + width * 0.14, y + 18, 2, 2);
    }
    ctx.restore();
  }

  drawDust(ctx, t) {
    for (const d of this.dust) {
      const x = (d.x * this.w + Math.sin(t * 0.3 + d.ph) * 14 + t * d.drift * 5) % this.w;
      const y = (d.y * this.h - ((t * d.spd * 30) % (this.h * 0.5)) + this.h) % this.h;
      ctx.fillStyle = `rgba(255,222,170,${d.a * (0.5 + 0.5 * Math.sin(t + d.ph))})`;
      ctx.beginPath();
      ctx.arc(x, y, d.r, 0, TAU);
      ctx.fill();
    }
  }

  drawCart(ctx, t, layer) {
    const x = ((t * 6) % (this.w + 140)) - 70;
    const y = this.floorY + 4;
    const s = this.scale * 0.75;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.translate(x, y);
    ctx.scale(s, s);
    // cart body
    ctx.fillStyle = '#15140f';
    ctx.beginPath();
    ctx.moveTo(-22, -20); ctx.lineTo(22, -20); ctx.lineTo(17, 0); ctx.lineTo(-17, 0); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,150,0.09)';
    ctx.stroke();
    // ore lumps
    ctx.fillStyle = rgba(layer.glow, 0.55);
    ctx.beginPath(); ctx.arc(-8, -23, 6, 0, TAU); ctx.arc(3, -26, 7, 0, TAU); ctx.arc(13, -22, 5, 0, TAU); ctx.fill();
    // wheels
    ctx.fillStyle = '#0d0e0a';
    ctx.beginPath(); ctx.arc(-12, 3, 7, 0, TAU); ctx.arc(12, 3, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2;
    for (const wx of [-12, 12]) {
      ctx.beginPath(); ctx.arc(wx, 3, 7, 0, TAU); ctx.stroke();
      ctx.beginPath();
      const a = t * 2.5;
      ctx.moveTo(wx + Math.cos(a) * 5, 3 + Math.sin(a) * 5);
      ctx.lineTo(wx - Math.cos(a) * 5, 3 - Math.sin(a) * 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawDrillRig(ctx, t, layer, drills) {
    if (!drills || drills <= 0) return;
    const x = this.w * 0.155;
    const y = this.floorY + 3;
    const s = this.scale * 0.84;
    const speed = 2.4 + Math.min(4, drills * 0.16);
    const piston = (Math.sin(t * speed) + 1) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 0, 38, 7, 0, 0, TAU); ctx.fill();

    // ore pile
    ctx.fillStyle = rgba(layer.glow, 0.35);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-30 + i * 9, -4 - (i % 2) * 3, 4 + (i % 3), 0, TAU);
      ctx.fill();
    }

    // base
    ctx.fillStyle = '#1b1d17';
    ctx.fillRect(-26, -14, 52, 13);
    ctx.fillStyle = '#2a2c24';
    ctx.fillRect(-26, -16, 52, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeRect(-26, -14, 52, 13);

    // mast
    ctx.strokeStyle = '#31352b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-14, -16); ctx.lineTo(-7, -64);
    ctx.moveTo(14, -16); ctx.lineTo(7, -64);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#454a3b';
    ctx.beginPath();
    ctx.moveTo(-19, -30); ctx.lineTo(17, -44);
    ctx.moveTo(-18, -44); ctx.lineTo(16, -30);
    ctx.stroke();

    // piston
    const py = -30 - piston * 26;
    ctx.strokeStyle = '#5c6250';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(0, py); ctx.stroke();
    ctx.fillStyle = '#363b2f';
    ctx.fillRect(-9, py, 18, 11);
    ctx.fillStyle = '#1c1f18';
    ctx.fillRect(-11, py + 8, 22, 4);

    // spinning flywheel
    ctx.save();
    ctx.translate(17, -24);
    ctx.rotate(t * speed * 0.9);
    ctx.strokeStyle = '#4a5040';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.stroke();
    }
    ctx.restore();

    // lamp
    const blink = Math.sin(t * (3 + drills * 0.2)) > 0.65;
    ctx.fillStyle = blink ? '#ffb15c' : '#5a3a1e';
    ctx.beginPath(); ctx.arc(0, -68, 2.5, 0, TAU); ctx.fill();
    if (blink) {
      const lg = ctx.createRadialGradient(0, -68, 0, 0, -68, 18);
      lg.addColorStop(0, 'rgba(255,177,92,0.25)');
      lg.addColorStop(1, 'rgba(255,177,92,0)');
      ctx.fillStyle = lg; ctx.fillRect(-20, -88, 40, 40);
    }

    // exhaust puffs
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.5 + i * 0.33) % 1;
      ctx.fillStyle = `rgba(170,170,150,${0.14 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(-8 - ph * 14, -20 - ph * 30, 3 + ph * 7, 0, TAU);
      ctx.fill();
    }

    // count
    if (drills > 1) {
      ctx.font = `700 ${9 / s}px ${'ui-monospace, monospace'}`;
      ctx.fillStyle = 'rgba(232,225,207,0.55)';
      ctx.textAlign = 'center';
      ctx.fillText(`×${drills}`, 0, -76);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  drawCritter(ctx, t) {
    const cycle = (t * 0.18) % 1;
    const x = cycle * (this.w + 100) - 50;
    if (x < -20 || x > this.w + 20) return;
    const y = this.floorY + 10;
    const s = this.scale * 0.42;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#0c0d0a';
    ctx.beginPath(); ctx.ellipse(0, -8, 11, 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-10, -11, 4, 0, TAU); ctx.fill();
    // tail
    ctx.strokeStyle = '#0c0d0a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(10, -9); ctx.quadraticCurveTo(17, -16 + Math.sin(t * 10) * 3, 22, -8); ctx.stroke();
    // legs
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const off = Math.sin(t * 16 + i * 2) * 2;
      ctx.beginPath();
      ctx.moveTo(-6 + i * 6, -5);
      ctx.lineTo(-6 + i * 6 + off, 0);
      ctx.stroke();
    }
    // eye
    ctx.fillStyle = '#ffb15c';
    ctx.beginPath(); ctx.arc(-12, -12, 0.9, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawVein(ctx, t, layer, state, layerIndex, node, key) {
    if (this.veinHidden > 0) return;
    const { veinX: cx, veinY: cy, scale: s } = this;
    const hp = state.veinHp?.[layerIndex] ?? layer.hp;
    const maxHp = layerMaxHp(state, layerIndex);
    const dmg = clamp(1 - hp / Math.max(1, maxHp), 0, 1);
    const pulse = 0.82 + Math.sin(t * 2.3) * 0.18;
    const rich = 1 + 0.02 * node;

    ctx.save();
    ctx.translate(cx, cy + Math.sin(t * 1.7) * 1.5);
    ctx.scale(s * rich, s * rich);

    // base glow
    const glow = layer.glow;
    const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, 78);
    gg.addColorStop(0, rgba(glow, 0.22 * pulse));
    gg.addColorStop(0.5, rgba(glow, 0.06));
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(-90, -90, 180, 180);

    // rock base
    ctx.fillStyle = '#161611';
    ctx.beginPath();
    ctx.moveTo(-34, 30); ctx.lineTo(-28, 12); ctx.lineTo(-10, 4);
    ctx.lineTo(8, 8); ctx.lineTo(28, 2); ctx.lineTo(35, 30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.stroke();

    // crystals
    const crystals = this.crystals || [];
    for (const c of crystals) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      const col = mixHex(glow, '#ffffff', 0.1 + c.tone * 0.16);
      ctx.shadowColor = rgba(glow, 0.7);
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(0, -c.len * 0.55);
      ctx.lineTo(c.wid, 0);
      ctx.lineTo(0, c.len * 0.5);
      ctx.lineTo(-c.wid, 0);
      ctx.closePath();
      ctx.fillStyle = rgba(col, 0.22 + 0.3 * c.tone);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(mixHex(glow, '#ffffff', 0.5), 0.5);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      // facets
      ctx.beginPath();
      ctx.moveTo(0, -c.len * 0.5);
      ctx.lineTo(0, c.len * 0.45);
      ctx.strokeStyle = rgba('#ffffff', 0.16);
      ctx.stroke();
      ctx.restore();
    }

    // cracks as integrity drops
    const cracks = Math.floor(dmg * 6);
    if (cracks > 0) {
      ctx.strokeStyle = 'rgba(10,8,6,0.65)';
      ctx.lineWidth = 1.4;
      const rnd = mulberry32(500 + layerIndex * 37 + node * 7);
      for (let i = 0; i < cracks; i++) {
        let x = (rnd() - 0.5) * 40;
        let y = (rnd() - 0.5) * 30;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 3; k++) {
          x += (rnd() - 0.5) * 16;
          y += (rnd() - 0.5) * 14;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // node pulse ring
    if (this.nodePulse > 0) {
      ctx.globalAlpha = this.nodePulse;
      ctx.strokeStyle = rgba(glow, 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 40 + (1 - this.nodePulse) * 50, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawMiner(ctx, t, layer) {
    const s = this.scale;
    const baseX = this.minerX;
    const floorY = this.floorY;
    const outfits = this.game.state.outfits || {};
    const duster = outfits.duster || 0;
    const rebreather = outfits.rebreather || 0;
    const charm = outfits.charm || 0;
    const coatColor = outfitCoat(duster);
    const goggleColor = outfitGoggles(rebreather);
    const p = this.swing;
    let swingAngle;
    if (p >= 1) swingAngle = -0.62;
    else if (p < 0.22) swingAngle = lerp(-0.62, -1.95, easeOut(p / 0.22));
    else if (p < 0.46) swingAngle = lerp(-1.95, 0.5, easeInOut((p - 0.22) / 0.24));
    else swingAngle = lerp(0.5, -0.62, easeInOut((p - 0.46) / 0.54));

    const strikeLean = p < 1 ? Math.sin(Math.PI * clamp((p - 0.15) / 0.5, 0, 1)) : 0;
    const bob = Math.sin(t * 2.1) * 1.2;
    const ox = baseX + strikeLean * 7 * s;

    ctx.save();
    ctx.translate(ox, floorY);
    ctx.scale(s, s);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(4, 1, 26, 6, 0, 0, TAU);
    ctx.fill();

    // light pool
    const lp = ctx.createRadialGradient(0, -20, 4, 0, -20, 70);
    lp.addColorStop(0, 'rgba(255,190,120,0.055)');
    lp.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = lp;
    ctx.fillRect(-70, -90, 140, 92);

    // legs
    ctx.strokeStyle = '#11120d';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -34);
    ctx.lineTo(-12, -17 + bob * 0.2);
    ctx.lineTo(-16, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, -34);
    ctx.lineTo(11, -17 - bob * 0.2);
    ctx.lineTo(13, -2);
    ctx.stroke();
    // boots
    ctx.fillStyle = '#0b0c08';
    ctx.beginPath(); ctx.ellipse(-17, -2, 7, 3, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(14, -2, 7, 3, 0, 0, TAU); ctx.fill();

    // backpack
    ctx.fillStyle = '#15160f';
    rr(ctx, -19, -61, 12, 25, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,150,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,170,90,0.25)';
    ctx.fillRect(-17, -57, 8, 3);

    // torso / coat
    ctx.beginPath();
    ctx.moveTo(-12, -36);
    ctx.lineTo(-15, -58);
    ctx.quadraticCurveTo(-4, -64, 9, -60);
    ctx.lineTo(13, -40);
    ctx.lineTo(9, -32);
    ctx.lineTo(-8, -32);
    ctx.closePath();
    ctx.fillStyle = coatColor;
    ctx.fill();
    // rim light
    ctx.strokeStyle = 'rgba(255,170,90,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(9, -60);
    ctx.lineTo(13, -40);
    ctx.lineTo(9, -32);
    ctx.stroke();
    // coat tatters
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.moveTo(-8, -33); ctx.lineTo(-10, -24); ctx.lineTo(-4, -29); ctx.lineTo(0, -23); ctx.lineTo(3, -30); ctx.lineTo(9, -26); ctx.lineTo(9, -32);
    ctx.closePath(); ctx.fill();
    // belt
    ctx.fillStyle = '#3a2a16';
    ctx.fillRect(-10, -42, 21, 3);
    ctx.fillStyle = '#8a6a35';
    ctx.fillRect(1, -43, 4, 5);

    // shoulder pad
    ctx.fillStyle = '#2b2318';
    ctx.beginPath(); ctx.arc(-2, -58, 8, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,177,92,0.25)'; ctx.stroke();

    // head + hood
    ctx.fillStyle = '#14150e';
    ctx.beginPath(); ctx.arc(2, -69 + bob * 0.15, 9.5, 0, TAU); ctx.fill();
    // hood rim
    ctx.strokeStyle = 'rgba(255,190,120,0.3)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(2, -69, 9.5, -0.9, 1.8); ctx.stroke();
    // face plate
    ctx.fillStyle = '#3b3d30';
    ctx.beginPath(); ctx.ellipse(7, -68, 5, 4, -0.2, 0, TAU); ctx.fill();
    // breathing filter
    ctx.fillStyle = '#22241b';
    ctx.beginPath(); ctx.arc(11, -65.5, 2.6, 0, TAU); ctx.fill();
    // goggles
    const pulse = 0.75 + Math.sin(t * 3.2) * 0.25;
    ctx.fillStyle = goggleColor;
    ctx.shadowColor = goggleColor;
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(5, -70, 1.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(9.5, -70.4, 1.4, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // helmet lamp
    ctx.fillStyle = '#ffdca6';
    ctx.beginPath(); ctx.arc(0, -76.5, 1.2, 0, TAU); ctx.fill();
    // warden charm
    if (charm > 0) {
      ctx.fillStyle = 'rgba(185,138,255,0.85)';
      ctx.shadowColor = '#b98aff';
      ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.arc(2, -48, 1.8, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // arm + pickaxe
    const shoulderX = 7;
    const shoulderY = -56;
    const handX = shoulderX + Math.cos(swingAngle) * 19;
    const handY = shoulderY + Math.sin(swingAngle) * 19;
    ctx.strokeStyle = '#191a12';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.fillStyle = '#2c2a20';
    ctx.beginPath(); ctx.arc(handX, handY, 3, 0, TAU); ctx.fill();

    // pickaxe
    const pickLen = 48;
    const tipX = handX + Math.cos(swingAngle) * pickLen;
    const tipY = handY + Math.sin(swingAngle) * pickLen;
    ctx.strokeStyle = '#4e3520';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,150,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(handX, handY - 1);
    ctx.lineTo(tipX, tipY - 1);
    ctx.stroke();
    // axe head
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(swingAngle + Math.PI / 2);
    ctx.fillStyle = '#7c7d6e';
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(0, -5); ctx.lineTo(8, 0); ctx.lineTo(5, 4); ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,177,92,0.35)';
    ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(0, -4); ctx.lineTo(3, -2); ctx.closePath(); ctx.fill();
    ctx.restore();

    // impact spark ring
    if (p > 0.35 && p < 0.55) {
      const k = (p - 0.35) / 0.2;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = 'rgba(255,220,170,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tipX + 4, tipY, 4 + k * 20, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = clamp(p.life / (p.max || 1), 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFloats(dt, ctx) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      if (f.life <= 0) { this.floats.splice(i, 1); continue; }
      f.y += f.vy * dt;
      f.vy *= 0.96;
      const a = clamp(f.life / (f.max || 1), 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `700 ${f.size}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }
}

function index0(state, layerIndex) {
  return state.drills?.[layerIndex] || 0;
}

/* ═══════════════════════════════════════════════════════════════
   COMBAT
   ═══════════════════════════════════════════════════════════════ */
export class CombatRenderer extends BaseRenderer {
  constructor(canvas, game) {
    super(canvas, game);
    this.playerAtk = 1;
    this.enemyAtk = 1;
    this.enemyFlash = 0;
    this.playerHurt = 0;
    this.shake = 0;
    this.floats = [];
    this.particles = [];
    this.spawnAt = 0;
    this.enemyKey = '';
    this.lastZone = -1;
    this.env = null;
    this.fallen = false;
    this.fallT = 0;
    this.targetFlash = 0;
    this.levelFx = 0;
  }

  onResize() {
    this.floorY = this.h * 0.80;
    this.scale = clamp(this.h / 280, 0.72, 1.35);
    this.playerX = this.w * 0.27;
    this.enemyX = this.w * 0.74;
    this.buildEnv(this.game.state.combat.zone || 0);
  }

  buildEnv(zoneIndex) {
    const zone = ZONES[zoneIndex] || ZONES[0];
    const rnd = mulberry32(1900 + zoneIndex * 71);
    const buildings = [];
    let x = -20;
    while (x < this.w + 60) {
      const bw = 24 + rnd() * 65;
      const bh = 20 + rnd() * 95;
      buildings.push({
        x, w: bw, h: bh,
        notch: rnd() < 0.35, antenna: rnd() < 0.22,
        windows: Array.from({ length: Math.floor(rnd() * 3) }, () => ({
          x: rnd(), y: rnd(), lit: rnd() < 0.55, phase: rnd() * 10,
        })),
      });
      x += bw + 4 + rnd() * 14;
    }
    this.env = { zone, buildings };
    this.lastZone = zoneIndex;
  }

  playerAttack() {
    this.playerAtk = 0;
    this.fallen = false;
  }

  enemyAttack() {
    this.enemyAtk = 0;
  }

  enemyHit() {
    this.enemyFlash = 1;
    this.shake = Math.max(this.shake, 4);
  }

  playerHit() {
    this.playerHurt = 1;
    this.shake = Math.max(this.shake, 8);
  }

  enemyKilled(zoneIndex, boss) {
    this.enemyFlash = 1;
    this.shake = 12;
    const color = ZONES[zoneIndex]?.enemy || '#a4633f';
    for (let i = 0; i < (boss ? 50 : 26); i++) {
      const a = Math.random() * TAU;
      const sp = 25 + Math.random() * 150;
      this.particles.push({
        x: this.enemyX + (Math.random() - 0.5) * 30,
        y: this.floorY - 40 - Math.random() * 50,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: 0.5 + Math.random() * 0.8, max: 1.3,
        size: 1 + Math.random() * 3, color: Math.random() < 0.3 ? '#ffb15c' : color,
        gravity: 250,
      });
    }
  }

  playerDied() {
    this.fallen = true;
    this.fallT = 0;
    this.shake = 14;
  }

  respawn() {
    this.fallen = false;
    this.fallT = 0;
    this.playerAtk = 1;
    this.enemyAtk = 1;
  }

  levelUp() {
    this.levelFx = 1;
    this.addFloat('LEVEL UP', '#ffe9a8', this.playerX + 10, this.floorY - 105 * this.scale, 13);
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * TAU;
      const sp = 20 + Math.random() * 90;
      this.particles.push({
        x: this.playerX, y: this.floorY - 45 * this.scale,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 45,
        life: 0.5 + Math.random() * 0.7, max: 1.2,
        size: 1 + Math.random() * 2.4, color: i % 3 ? '#ffe9a8' : '#b7ee58',
        gravity: -25,
      });
    }
  }

  addFloat(text, color, x, y, size = 12) {
    this.floats.push({ text, color, x, y, vy: -42, life: 0.95, max: 0.95, size });
  }

  damageNumber(amount, crit = false) {
    const x = this.enemyX + (Math.random() * 28 - 14);
    const y = this.floorY - 80 * this.scale - Math.random() * 20;
    this.floats.push({
      text: crit ? `${Math.round(amount)}!` : `${Math.round(amount)}`,
      color: crit ? '#fff1b8' : '#ffd8b8',
      x, y, vy: -46, life: 0.9, max: 0.9, size: crit ? 18 : 13,
    });
  }

  hurtNumber(amount) {
    this.floats.push({
      text: `-${Math.round(amount)}`,
      color: '#ff6f58',
      x: this.playerX + 10, y: this.floorY - 78 * this.scale,
      vy: -38, life: 0.85, max: 0.85, size: 12,
    });
  }

  draw(dt, t) {
    const ctx = this.ctx;
    const state = this.game.state;
    const combat = state.combat;
    const zoneIndex = combat.zone || 0;
    const zone = ZONES[zoneIndex] || ZONES[0];
    if (zoneIndex !== this.lastZone || !this.env) this.buildEnv(zoneIndex);

    this.playerAtk = Math.min(1, this.playerAtk + dt / 0.34);
    this.enemyAtk = Math.min(1, this.enemyAtk + dt / 0.46);
    this.enemyFlash = Math.max(0, this.enemyFlash - dt * 4.5);
    this.playerHurt = Math.max(0, this.playerHurt - dt * 3);
    this.levelFx = Math.max(0, this.levelFx - dt * 1.1);
    this.shake = Math.max(0, this.shake - dt * 36);
    if (this.fallen) this.fallT = Math.min(1, this.fallT + dt * 2.6);

    const enemy = combat.enemy;
    const key = enemy ? `${zoneIndex}:${enemy.name}:${enemy.maxHp}:${enemy.boss}` : '';
    if (key && key !== this.enemyKey) {
      this.enemyKey = key;
      this.spawnAt = t;
      this.enemyFlash = 0;
    }
    const spawnAge = t - this.spawnAt;

    ctx.save();
    if (this.shake > 0.3) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    this.drawSky(ctx, t, zone, zoneIndex);
    this.drawSkyline(ctx, t);
    this.drawGround(ctx, t);
    this.drawArenaProps(ctx, t);

    // enemy aura for boss / sentry
    if (enemy?.boss) {
      const aura = ctx.createRadialGradient(this.enemyX, this.floorY - 50 * this.scale, 2, this.enemyX, this.floorY - 50 * this.scale, 90 * this.scale);
      aura.addColorStop(0, rgba(zone.accent, 0.18 + Math.sin(t * 3) * 0.05));
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(this.enemyX - 110 * this.scale, this.floorY - 160 * this.scale, 220 * this.scale, 170 * this.scale);
    }

    if (enemy) {
      const p = this.enemyAtk;
      const lunge = p < 1 ? -14 * Math.sin(Math.PI * p) * this.scale : 0;
      const deathFade = enemy.hp <= 0 ? 1 : 0;
      ctx.save();
      const spawnK = clamp(spawnAge / 0.4, 0, 1);
      ctx.globalAlpha = spawnK * (1 - deathFade);
      const bounce = (1 - easeOut(spawnK)) * -14 * this.scale;
      this.drawEnemy(ctx, enemy, zone, zoneIndex, t, this.enemyX + lunge, this.floorY + bounce, this.scale, spawnAge);
      ctx.restore();
    }

    // player
    const pp = this.playerAtk;
    const lunge = pp < 1 ? 15 * Math.sin(Math.PI * pp) * this.scale : 0;
    if (this.levelFx > 0.02) {
      const k = 1 - this.levelFx;
      ctx.save();
      ctx.globalAlpha = this.levelFx * 0.7;
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.playerX, this.floorY - 2, (20 + k * 55) * this.scale, (6 + k * 12) * this.scale, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    this.drawPlayer(ctx, t, this.playerX + lunge, this.floorY, this.scale);

    ctx.restore();

    this.updateParticles(dt);
    this.drawParticles(ctx);
    this.drawFloats(dt, ctx);

    if (this.playerHurt > 0.02) {
      const hg = ctx.createRadialGradient(this.w * 0.5, this.h * 0.5, this.h * 0.25, this.w * 0.5, this.h * 0.5, this.h * 0.9);
      hg.addColorStop(0, 'rgba(180,20,10,0)');
      hg.addColorStop(1, `rgba(180,20,10,${0.3 * this.playerHurt})`);
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // vignette
    const v = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.2, this.w / 2, this.h / 2, this.h * 0.9);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.58)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawSky(ctx, t, zone, zoneIndex) {
    const { w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, zone.sky[0]);
    g.addColorStop(0.7, zone.sky[1]);
    g.addColorStop(1, '#050504');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // hazy sun
    const sx = w * 0.76;
    const sy = h * 0.2;
    const sr = Math.min(w, h) * 0.09;
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 3.2);
    sg.addColorStop(0, rgba(zone.accent, 0.20));
    sg.addColorStop(0.35, rgba(zone.accent, 0.07));
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - sr * 3.3, sy - sr * 3.3, sr * 6.6, sr * 6.6);
    ctx.fillStyle = rgba(zone.accent, 0.18);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();
    // cloud bands
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 4; i++) {
      const y = h * (0.12 + i * 0.07);
      const offset = (t * (2 + i)) % (w + 200);
      ctx.fillStyle = i % 2 ? zone.sky[0] : '#080706';
      ctx.beginPath();
      ctx.ellipse(w * 0.4 - 100 + offset - 100, y, w * 0.3, 6 + i * 2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // embers
    for (let i = 0; i < 22; i++) {
      const seed = i * 37.7;
      const x = (seed * 13 + t * (5 + (i % 5) * 2)) % (w + 40) - 20;
      const y = h * 0.8 - ((t * (8 + i % 7) + seed) % (h * 0.6));
      const a = 0.1 + (i % 4) * 0.05;
      ctx.fillStyle = i % 3 === 0 ? `rgba(255,177,92,${a})` : `rgba(200,200,180,${a * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.6 + (i % 3) * 0.5, 0, TAU);
      ctx.fill();
    }
  }

  drawSkyline(ctx, t) {
    if (!this.env) return;
    const zone = this.env.zone;
    for (const b of this.env.buildings) {
      const base = this.floorY - this.scale * 24;
      ctx.save();
      ctx.fillStyle = 'rgba(4,4,3,0.72)';
      ctx.beginPath();
      ctx.moveTo(b.x, base);
      ctx.lineTo(b.x, base - b.h);
      if (b.notch) {
        ctx.lineTo(b.x + b.w * 0.4, base - b.h);
        ctx.lineTo(b.x + b.w * 0.4, base - b.h + 8);
        ctx.lineTo(b.x + b.w * 0.6, base - b.h + 8);
        ctx.lineTo(b.x + b.w * 0.6, base - b.h);
      }
      ctx.lineTo(b.x + b.w, base - b.h);
      ctx.lineTo(b.x + b.w, base);
      ctx.closePath();
      ctx.fill();
      if (b.antenna) {
        ctx.strokeStyle = 'rgba(4,4,3,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.5, base - b.h);
        ctx.lineTo(b.x + b.w * 0.5, base - b.h - 14 - (b.w % 17));
        ctx.stroke();
      }
      for (const win of b.windows) {
        if (!win.lit) continue;
        const flick = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + win.phase));
        ctx.fillStyle = `rgba(255,150,60,${0.18 * flick})`;
        ctx.fillRect(b.x + win.x * b.w * 0.7 + 4, base - b.h + 6 + win.y * b.h * 0.5, 3, 3);
      }
      ctx.restore();
    }
    // distant smoke
    ctx.save();
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 3; i++) {
      const x = this.w * (0.2 + i * 0.28) + Math.sin(t * 0.2 + i) * 14;
      ctx.fillStyle = '#0a0907';
      ctx.beginPath();
      ctx.ellipse(x, this.floorY - this.scale * (60 + i * 15), 40 + i * 12, 16 + i * 5, 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawGround(ctx, t) {
    const { w, h, floorY } = this;
    const g = ctx.createLinearGradient(0, floorY, 0, h);
    g.addColorStop(0, '#181510');
    g.addColorStop(0.4, '#0d0c09');
    g.addColorStop(1, '#050504');
    ctx.fillStyle = g;
    ctx.fillRect(0, floorY, w, h - floorY);

    // horizon line
    ctx.strokeStyle = 'rgba(255,200,140,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(w, floorY);
    ctx.stroke();

    // perspective cracks
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.4;
    const rnd = mulberry32(44 + this.lastZone);
    for (let i = 0; i < 6; i++) {
      let x = rnd() * w;
      let y = floorY + 6 + rnd() * (h - floorY - 10);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rnd() - 0.5) * 40;
        y += (rnd() - 0.5) * 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // rubble
    for (let i = 0; i < 12; i++) {
      const x = rnd() * w;
      const y = floorY + 4 + rnd() * (h - floorY - 8);
      const rw = 3 + rnd() * 12;
      ctx.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rw * 0.28, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // dust rolling
    for (let i = 0; i < 4; i++) {
      const x = ((t * (8 + i * 3) + i * 130) % (w + 200)) - 100;
      ctx.fillStyle = `rgba(180,160,120,${0.025 + i * 0.008})`;
      ctx.beginPath();
      ctx.ellipse(x, floorY + 6, 80 + i * 20, 5 + i * 2, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawArenaProps(ctx, t) {
    const { w, h, floorY } = this;
    // barbed wire post left
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.06, floorY + 20);
    ctx.lineTo(w * 0.065, floorY - 28);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,110,90,0.14)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.06, floorY - 6 - i * 8);
      ctx.bezierCurveTo(w * 0.14, floorY - 14 - i * 8, w * 0.2, floorY - 2 - i * 8, w * 0.3, floorY - 10 - i * 8);
      ctx.stroke();
    }
    // right post
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.94, floorY + 18);
    ctx.lineTo(w * 0.945, floorY - 18);
    ctx.stroke();
    ctx.restore();

    // low fog
    const fg = ctx.createLinearGradient(0, floorY - 8, 0, floorY + 25);
    fg.addColorStop(0, 'rgba(120,115,95,0)');
    fg.addColorStop(0.7, 'rgba(120,115,95,0.05)');
    fg.addColorStop(1, 'rgba(120,115,95,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, floorY - 10, w, 45);
  }

  /* ── player survivor ─────────────────────────────────────── */
  drawPlayer(ctx, t, x, y, s) {
    const atk = this.playerAtk;
    const swing = atk < 1 ? Math.sin(Math.PI * atk) : 0;
    const bob = Math.sin(t * 2.4) * 1.3;
    const breathe = Math.sin(t * 1.7) * 0.8;
    const hurt = this.playerHurt;
    const outfits = this.game.state.outfits || {};
    const duster = outfits.duster || 0;
    const rebreather = outfits.rebreather || 0;
    const charm = outfits.charm || 0;
    const coatColor = outfitCoat(duster);
    const goggleColor = outfitGoggles(rebreather);
    const level = this.game.state.level || 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (this.fallen) {
      const k = easeOut(this.fallT);
      ctx.globalAlpha = 1 - k * 0.35;
      ctx.translate(0, k * 18);
      ctx.rotate(k * -1.1);
    }

    // survivor aura grows with level
    if (level >= 4) {
      const aura = ctx.createRadialGradient(2, -40, 4, 2, -40, 55);
      aura.addColorStop(0, `rgba(255,177,92,${0.035 + Math.min(0.05, level * 0.001)})`);
      aura.addColorStop(1, 'rgba(255,177,92,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(-60, -100, 120, 110);
    }

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(2, 1, 23, 6, 0, 0, TAU);
    ctx.fill();

    // back leg
    ctx.strokeStyle = '#0e0f0b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -36);
    ctx.lineTo(-10, -19);
    ctx.lineTo(-13, -2);
    ctx.stroke();
    // front leg
    ctx.beginPath();
    ctx.moveTo(4, -36);
    ctx.lineTo(10, -19);
    ctx.lineTo(15, -2);
    ctx.stroke();
    // boots
    ctx.fillStyle = '#090a07';
    ctx.beginPath(); ctx.ellipse(-13, -1, 7, 3.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, -1, 7, 3.2, 0, 0, TAU); ctx.fill();

    // backpack with bedroll
    ctx.fillStyle = '#171811';
    rr(ctx, -19, -60 + breathe * 0.3, 12, 24, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,180,110,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#2b2519';
    rr(ctx, -21, -59, 4, 12, 2); ctx.fill();

    // duster coat
    ctx.beginPath();
    ctx.moveTo(-11, -37);
    ctx.lineTo(-14, -59 + breathe * 0.2);
    ctx.quadraticCurveTo(-2, -64, 10, -60 + breathe * 0.2);
    ctx.lineTo(14, -42);
    ctx.lineTo(17, -34);
    ctx.lineTo(8, -35);
    ctx.lineTo(4, -30);
    ctx.lineTo(-4, -35);
    ctx.lineTo(-9, -29);
    ctx.lineTo(-11, -37);
    ctx.closePath();
    ctx.fillStyle = hurt > 0.25 ? mixHex(coatColor, '#7a2a20', hurt * 0.5) : coatColor;
    ctx.fill();
    // rim light
    ctx.strokeStyle = `rgba(255,177,92,${0.28 + hurt * 0.3})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(10, -60);
    ctx.lineTo(14, -42);
    ctx.lineTo(16, -35);
    ctx.stroke();
    // chest strap
    ctx.strokeStyle = '#332718';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-8, -57);
    ctx.lineTo(9, -44);
    ctx.stroke();
    // belt
    ctx.fillStyle = '#3a2b18';
    ctx.fillRect(-9, -44, 21, 3);
    ctx.fillStyle = '#8a6a35';
    ctx.fillRect(2, -45, 4, 5);

    // shoulder guard
    ctx.fillStyle = '#2f291c';
    ctx.beginPath();
    ctx.arc(2, -59, 8.5, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,120,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // spikes
    ctx.fillStyle = '#514737';
    ctx.beginPath(); ctx.moveTo(-2, -66); ctx.lineTo(1, -71); ctx.lineTo(3, -65); ctx.closePath(); ctx.fill();

    // head / gas mask
    ctx.fillStyle = '#14150f';
    ctx.beginPath(); ctx.arc(3, -69 + bob * 0.2 + breathe * 0.2, 9, 0, TAU); ctx.fill();
    // hood
    ctx.strokeStyle = 'rgba(255,177,92,0.3)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(3, -69, 9, -1.1, 1.9); ctx.stroke();
    // mask
    ctx.fillStyle = '#3a3d31';
    ctx.beginPath();
    ctx.ellipse(7.5, -68, 5.5, 4.4, -0.15, 0, TAU);
    ctx.fill();
    // filter — upgraded rebreathers get a heavier canister
    ctx.fillStyle = '#23251c';
    ctx.beginPath();
    ctx.arc(11.5, -65.5, 2.8 + (rebreather >= 8 ? 0.8 : 0), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4c4d3e';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (rebreather >= 4) {
      ctx.strokeStyle = 'rgba(196,239,82,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(11.5, -65.5, 3.6, -0.4, 2.4);
      ctx.stroke();
    }
    // goggles
    ctx.fillStyle = goggleColor;
    ctx.shadowColor = goggleColor;
    ctx.shadowBlur = 7;
    ctx.beginPath(); ctx.arc(5.5, -70, 1.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -70.4, 1.3, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // hood tip / lamp
    ctx.fillStyle = '#ffb15c';
    ctx.beginPath(); ctx.arc(0, -76, 1.2, 0, TAU); ctx.fill();

    // warden charm pendant
    if (charm > 0) {
      ctx.fillStyle = 'rgba(185,138,255,0.9)';
      ctx.shadowColor = '#b98aff';
      ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.arc(-4, -48, 1.9, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(185,138,255,0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-4, -54);
      ctx.lineTo(-4, -49.5);
      ctx.stroke();
    }

    // weapon arm (right)
    const armAngle = atk < 1
      ? lerp(-1.9, 0.35, easeInOut(clamp(atk / 0.65, 0, 1)))
      : -0.5 + Math.sin(t * 1.8) * 0.03;
    const shX = 8, shY = -57;
    const handX = shX + Math.cos(armAngle) * 18;
    const handY = shY + Math.sin(armAngle) * 18;
    ctx.strokeStyle = hurt > 0.3 ? '#5a2419' : '#191a13';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.fillStyle = '#2e2a1e';
    ctx.beginPath(); ctx.arc(handX, handY, 3, 0, TAU); ctx.fill();

    // pipe axe
    const len = 36;
    const tipX = handX + Math.cos(armAngle) * len;
    const tipY = handY + Math.sin(armAngle) * len;
    ctx.strokeStyle = '#4a3a26';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(armAngle + Math.PI / 2);
    ctx.fillStyle = '#8b8b78';
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(-2, -7); ctx.lineTo(7, -6); ctx.lineTo(8, 3); ctx.lineTo(-3, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,90,60,0.55)';
    ctx.beginPath(); ctx.arc(-1, -3, 1.5, 0, TAU); ctx.fill();
    ctx.restore();

    // off hand
    const offX = -10 + Math.sin(t * 2) * 0.4;
    ctx.fillStyle = '#1a1b13';
    ctx.beginPath(); ctx.arc(offX, -48, 3, 0, TAU); ctx.fill();

    // attack swipe arc
    if (atk < 0.7) {
      const k = easeOut(atk / 0.7);
      ctx.strokeStyle = `rgba(255,190,120,${0.5 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, -54, 44, -1.7, -1.7 + k * 2.1);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ── enemy art ───────────────────────────────────────────── */
  drawEnemy(ctx, enemy, zone, zoneIndex, t, x, y, scale, spawnAge) {
    const boss = enemy.boss;
    const s = scale * (boss ? 1.32 : 1);
    const idle = Math.sin(t * 2 + zoneIndex) * (boss ? 2 : 1.4);
    const flash = this.enemyFlash;
    const atk = this.enemyAtk;
    const lunge = atk < 1 ? Math.sin(Math.PI * atk) : 0;
    const appearance = enemy.name.includes('Hound') || enemy.name.includes('Dog') || enemy.name.includes('Rat')
      ? 'critter' : zone.shape;

    ctx.save();
    ctx.translate(x, y + idle * 0.4);
    ctx.scale(-s, s); // face left
    ctx.globalAlpha *= 1;
    if (boss) {
      // crown / spikes behind
      ctx.save();
      ctx.fillStyle = rgba(zone.accent, 0.2);
      ctx.beginPath();
      ctx.moveTo(-24, -94); ctx.lineTo(-16, -112); ctx.lineTo(-7, -98); ctx.lineTo(2, -118); ctx.lineTo(11, -98); ctx.lineTo(21, -112); ctx.lineTo(25, -94);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (appearance === 'critter') this.drawCritterEnemy(ctx, t, flash, atk, zone, boss);
    else if (appearance === 'raider') this.drawRaiderEnemy(ctx, t, flash, atk, zone, boss);
    else if (appearance === 'golem') this.drawGolemEnemy(ctx, t, flash, atk, zone, boss);
    else if (appearance === 'brute') this.drawBruteEnemy(ctx, t, flash, atk, zone, boss);
    else if (appearance === 'sentry') this.drawSentryEnemy(ctx, t, flash, atk, zone, boss);
    else this.drawVoidEnemy(ctx, t, flash, atk, zone, boss);

    // hit flash overlay
    if (flash > 0.03) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,120,90,${0.14 * flash})`;
      ctx.beginPath();
      ctx.arc(0, -50, 46, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    if (lunge > 0.4 && atk < 0.55) {
      // swipe
      ctx.save();
      ctx.translate(x - 24 * s, y - 44 * s);
      ctx.strokeStyle = `rgba(255,150,120,${0.5 * (1 - atk / 0.55)})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 30 * s, -1.2, 0.9);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawCritterEnemy(ctx, t, flash, atk, zone, boss) {
    const body = mixHex('#241a13', zone.enemy, 0.55 + flash * 0.3);
    const rim = rgba(zone.accent, 0.5);
    const step = Math.sin(t * 5) * 2.5;
    const crouch = atk < 1 ? Math.sin(Math.PI * atk) * 4 : 0;
    // tail
    ctx.strokeStyle = body;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, -16);
    ctx.quadraticCurveTo(36, -34 + Math.sin(t * 4) * 5, 46, -10);
    ctx.stroke();
    // legs
    ctx.strokeStyle = '#17120e';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const lx = -18 + i * 12;
      const ph = i % 2 ? step : -step;
      ctx.beginPath();
      ctx.moveTo(lx, -15);
      ctx.lineTo(lx + ph, -3);
      ctx.stroke();
    }
    // body
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, -21, 30, 15, -0.05, 0, TAU);
    ctx.fill();
    // ribs
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-2 + i * 7, -22, 9 - i, -1.2, 1.1);
      ctx.stroke();
    }
    // head
    ctx.fillStyle = mixHex(body, '#000', 0.1);
    ctx.beginPath();
    ctx.ellipse(-29, -28 - crouch * 0.4, 14, 11, -0.25, 0, TAU);
    ctx.fill();
    // snout
    ctx.beginPath();
    ctx.moveTo(-42, -26); ctx.lineTo(-31, -30); ctx.lineTo(-32, -19); ctx.closePath();
    ctx.fill();
    // teeth
    ctx.fillStyle = '#b9b49c';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-39 + i * 3, -22); ctx.lineTo(-37 + i * 3, -18); ctx.lineTo(-35 + i * 3, -22);
      ctx.closePath(); ctx.fill();
    }
    // ears
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-32, -36); ctx.lineTo(-27, -46); ctx.lineTo(-22, -35); ctx.closePath(); ctx.fill();
    // eyes
    ctx.fillStyle = '#ff7a2b';
    ctx.shadowColor = '#ff4a1a';
    ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(-34, -31, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-25, -33, 1.6, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // spine spikes
    ctx.fillStyle = mixHex(zone.accent, '#000', 0.4);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-12 + i * 8, -35);
      ctx.lineTo(-9 + i * 8, -42 - (i % 2) * 3);
      ctx.lineTo(-5 + i * 8, -34);
      ctx.closePath(); ctx.fill();
    }
    if (boss) {
      ctx.fillStyle = rgba(zone.accent, 0.7);
      ctx.beginPath(); ctx.arc(-30, -40, 2, 0, TAU); ctx.fill();
    }
    // rim light
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -21, 30, 15, -0.05, -1.2, 0.8); ctx.stroke();
  }

  drawRaiderEnemy(ctx, t, flash, atk, zone, boss) {
    const body = mixHex('#241d16', zone.enemy, 0.4 + flash * 0.35);
    const cloth = mixHex('#1a1510', zone.enemy, 0.22);
    const step = Math.sin(t * 3.5) * 2;
    const crouch = atk < 1 ? Math.sin(Math.PI * atk) : 0;

    ctx.save();
    if (boss) {
      // cape
      ctx.fillStyle = mixHex(cloth, '#000', 0.2);
      ctx.beginPath();
      ctx.moveTo(12, -64);
      ctx.quadraticCurveTo(40, -40, 28, 0);
      ctx.lineTo(12, -8);
      ctx.closePath();
      ctx.fill();
    }
    // legs
    ctx.strokeStyle = '#13110d';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, -38); ctx.lineTo(-12, -20); ctx.lineTo(-17, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -38); ctx.lineTo(13, -20 + step); ctx.lineTo(19, -2); ctx.stroke();
    ctx.fillStyle = '#0a0907';
    ctx.beginPath(); ctx.ellipse(-17, -1, 6, 3, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(19, -1, 6, 3, 0, 0, TAU); ctx.fill();
    // torso
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-13, -36);
    ctx.lineTo(-15, -62);
    ctx.lineTo(-4, -68);
    ctx.lineTo(12, -62);
    ctx.lineTo(15, -40);
    ctx.lineTo(8, -32);
    ctx.lineTo(-7, -33);
    ctx.closePath();
    ctx.fill();
    // straps
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -62); ctx.lineTo(10, -40); ctx.stroke();
    // belt and rag skirt
    ctx.fillStyle = '#3d2c18';
    ctx.fillRect(-12, -40, 27, 3);
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(-11, -36); ctx.lineTo(-10, -24); ctx.lineTo(-4, -32); ctx.lineTo(1, -23); ctx.lineTo(7, -32); ctx.lineTo(13, -25); ctx.lineTo(13, -36);
    ctx.closePath(); ctx.fill();
    // shoulder spikes
    ctx.fillStyle = '#5a4a35';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-6 + i * 14, -64);
      ctx.lineTo(-2 + i * 14, -73);
      ctx.lineTo(2 + i * 14, -63);
      ctx.closePath(); ctx.fill();
    }
    // head
    ctx.fillStyle = mixHex('#17140f', zone.enemy, 0.22);
    ctx.beginPath(); ctx.arc(2, -74, 9, 0, TAU); ctx.fill();
    // mohawk
    ctx.fillStyle = mixHex(zone.accent, '#000', 0.25);
    ctx.beginPath();
    ctx.moveTo(-6, -79); ctx.lineTo(-4, -92); ctx.lineTo(0, -81); ctx.lineTo(3, -94); ctx.lineTo(7, -80);
    ctx.closePath(); ctx.fill();
    // mask
    ctx.fillStyle = '#3b3a2d';
    ctx.beginPath(); ctx.ellipse(-5, -73, 4.5, 3.5, 0.2, 0, TAU); ctx.fill();
    // eyes
    ctx.fillStyle = zone.accent;
    ctx.shadowColor = zone.accent;
    ctx.shadowBlur = 7;
    ctx.beginPath(); ctx.arc(-8, -75, 1.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-3, -75.5, 1.2, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // weapon arm
    const angle = atk < 1 ? lerp(-1.4, 0.35, easeInOut(clamp(atk / 0.6, 0, 1))) : -0.9;
    const hx = -10, hy = -56;
    const ex = hx + Math.cos(angle) * 16;
    const ey = hy + Math.sin(angle) * 16;
    ctx.strokeStyle = body;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    // spear
    ctx.strokeStyle = '#3d2f21';
    ctx.lineWidth = 3;
    const tx = ex + Math.cos(angle) * 36;
    const ty = ey + Math.sin(angle) * 36;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = '#9a9a85';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + 7, ty - 5);
    ctx.lineTo(tx + 4, ty + 4);
    ctx.closePath(); ctx.fill();
    // rim
    ctx.strokeStyle = rgba(zone.accent, 0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(12, -62); ctx.lineTo(15, -40); ctx.lineTo(13, -25); ctx.stroke();
    ctx.restore();
  }

  drawGolemEnemy(ctx, t, flash, atk, zone, boss) {
    const rock = mixHex('#221c16', zone.enemy, 0.4 + flash * 0.4);
    const glow = zone.accent;
    const sway = Math.sin(t * 1.5) * 1.6;
    const stomp = atk < 1 ? Math.sin(Math.PI * atk) : 0;
    // legs
    ctx.fillStyle = '#17130f';
    ctx.fillRect(-18, -22, 13, 22);
    ctx.fillRect(6, -22 + stomp * 3, 13, 22 - stomp * 3);
    // arms
    ctx.save();
    ctx.translate(-20, -50);
    ctx.rotate(atk < 1 ? -0.2 - Math.sin(Math.PI * atk) * 0.9 : -0.1);
    ctx.fillStyle = mixHex(rock, '#000', 0.15);
    rr(ctx, -8, 0, 14, 42, 5); ctx.fill();
    ctx.fillStyle = '#241e17';
    ctx.beginPath(); ctx.arc(0, 42, 8, 0, TAU); ctx.fill();
    ctx.restore();
    // torso
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(-22, -76 + sway);
    ctx.lineTo(-16, -40);
    ctx.lineTo(-20, -24);
    ctx.lineTo(18, -24);
    ctx.lineTo(20, -44);
    ctx.lineTo(24, -74 + sway);
    ctx.lineTo(10, -80);
    ctx.lineTo(-10, -79);
    ctx.closePath();
    ctx.fill();
    // rock plates
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-14, -62); ctx.lineTo(8, -58); ctx.lineTo(17, -66);
    ctx.moveTo(-12, -46); ctx.lineTo(4, -42); ctx.lineTo(16, -50);
    ctx.stroke();
    // molten cracks
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-8, -70); ctx.lineTo(-2, -60); ctx.lineTo(-7, -52); ctx.lineTo(1, -44);
    ctx.moveTo(9, -73); ctx.lineTo(6, -62); ctx.lineTo(12, -56);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // head
    ctx.fillStyle = mixHex(rock, '#000', 0.2);
    ctx.beginPath();
    ctx.moveTo(-10, -79); ctx.lineTo(-8, -91); ctx.lineTo(8, -92); ctx.lineTo(12, -80);
    ctx.closePath(); ctx.fill();
    // eyes
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(-6, -85, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -85, 2, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // shoulder rocks
    ctx.fillStyle = mixHex(rock, '#fff', 0.06);
    ctx.beginPath(); ctx.arc(-20, -72, 10, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(20, -72, 9, 0, TAU); ctx.fill();
  }

  drawBruteEnemy(ctx, t, flash, atk, zone, boss) {
    const flesh = mixHex('#2a2118', zone.enemy, 0.5 + flash * 0.35);
    const glow = zone.accent;
    const bob = Math.sin(t * 1.9) * 2;
    const stomp = atk < 1 ? Math.sin(Math.PI * atk) : 0;
    // legs
    ctx.strokeStyle = mixHex(flesh, '#000', 0.2);
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, -34); ctx.lineTo(-18, -14); ctx.lineTo(-20, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -34); ctx.lineTo(20, -16 + stomp * 2); ctx.lineTo(25, -2); ctx.stroke();
    // torso
    ctx.fillStyle = flesh;
    ctx.beginPath();
    ctx.ellipse(2, -58 + bob, 30, 30, 0, 0, TAU);
    ctx.fill();
    // hunch
    ctx.beginPath();
    ctx.ellipse(-2, -78 + bob, 24, 16, -0.2, 0, TAU);
    ctx.fill();
    // arms
    for (const side of [-1, 1]) {
      const swingA = side === -1 && atk < 1 ? -0.3 - Math.sin(Math.PI * atk) * 1.2 : 0.1;
      ctx.save();
      ctx.translate(side * 28, -64 + bob);
      ctx.rotate(swingA);
      ctx.fillStyle = mixHex(flesh, '#000', 0.12);
      rr(ctx, -5, -2, 14, 48, 7); ctx.fill();
      // claws
      ctx.strokeStyle = '#b9b49c';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(side * 7, 42); ctx.lineTo(side * 7 + i * 3 - 3, 50); ctx.stroke();
      }
      ctx.restore();
    }
    // head
    ctx.fillStyle = mixHex(flesh, '#000', 0.15);
    ctx.beginPath(); ctx.ellipse(-10, -84 + bob, 13, 11, -0.2, 0, TAU); ctx.fill();
    // jaw
    ctx.fillStyle = '#33271d';
    ctx.beginPath(); ctx.ellipse(-19, -78 + bob, 7, 5, 0.2, 0, TAU); ctx.fill();
    // teeth
    ctx.fillStyle = '#c5bea3';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-24 + i * 3, -80 + bob); ctx.lineTo(-23 + i * 3, -76 + bob); ctx.lineTo(-21 + i * 3, -80 + bob);
      ctx.closePath(); ctx.fill();
    }
    // glowing veins
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-10, -70 + bob); ctx.lineTo(-2, -60 + bob); ctx.lineTo(-8, -48 + bob);
    ctx.moveTo(10, -72 + bob); ctx.lineTo(6, -58 + bob); ctx.lineTo(12, -46 + bob);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // eyes
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(-16, -88 + bob, 1.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-7, -89 + bob, 1.6, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // horns
    ctx.fillStyle = '#5b5242';
    ctx.beginPath(); ctx.moveTo(-18, -92 + bob); ctx.lineTo(-24, -104 + bob); ctx.lineTo(-11, -94 + bob); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, -93 + bob); ctx.lineTo(4, -104 + bob); ctx.lineTo(5, -90 + bob); ctx.closePath(); ctx.fill();
  }

  drawSentryEnemy(ctx, t, flash, atk, zone, boss) {
    const metal = mixHex('#231f19', zone.enemy, 0.45 + flash * 0.4);
    const glow = zone.accent;
    const hover = Math.sin(t * 2.2) * 5;
    const tilt = atk < 1 ? -0.25 * Math.sin(Math.PI * atk) : 0;
    // thruster glow
    const tg = ctx.createRadialGradient(0, 4, 1, 0, 4, 26);
    tg.addColorStop(0, rgba(glow, 0.35));
    tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(-30, -14, 60, 40);
    // cables
    ctx.strokeStyle = '#17140f';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-12 + i * 8, -18 + hover);
      ctx.quadraticCurveTo(-14 + i * 8 + Math.sin(t * 2 + i) * 3, 0, -18 + i * 8, 8);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(0, -46 + hover);
    ctx.rotate(tilt);
    // body
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.moveTo(-24, -20); ctx.lineTo(-16, -32); ctx.lineTo(18, -30); ctx.lineTo(26, -14);
    ctx.lineTo(18, 4); ctx.lineTo(-18, 4); ctx.lineTo(-27, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // wing fins
    ctx.fillStyle = mixHex(metal, glow, 0.12);
    ctx.beginPath(); ctx.moveTo(-24, -18); ctx.lineTo(-38, -6); ctx.lineTo(-24, -2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, -18); ctx.lineTo(38, -6); ctx.lineTo(24, -2); ctx.closePath(); ctx.fill();
    // eye housing
    ctx.fillStyle = '#0c0b09';
    ctx.beginPath(); ctx.ellipse(-4, -14, 11, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(-6, -14, 4.5 + Math.sin(t * 4) * 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4ffe0';
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(-7, -15, 1.6, 0, TAU); ctx.fill();
    // antenna
    ctx.strokeStyle = '#3f4436';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(10, -30); ctx.lineTo(16, -42); ctx.stroke();
    ctx.fillStyle = '#ff7a2b';
    ctx.beginPath(); ctx.arc(16, -42, 2, 0, TAU); ctx.fill();
    // rivets
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 4; i++) ctx.fillRect(-16 + i * 9, 1, 2, 2);
    ctx.restore();
  }

  drawVoidEnemy(ctx, t, flash, atk, zone, boss) {
    const robe = mixHex('#16101f', zone.enemy, 0.35 + flash * 0.4);
    const glow = zone.accent;
    const float = Math.sin(t * 1.6) * 6;
    const pulse = 0.6 + Math.sin(t * 3) * 0.4;
    // aura
    const ag = ctx.createRadialGradient(0, -54 + float, 2, 0, -54 + float, 58);
    ag.addColorStop(0, rgba(glow, 0.22 * pulse));
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag;
    ctx.fillRect(-70, -120 + float, 140, 130);
    // tendrils
    ctx.strokeStyle = mixHex(robe, glow, 0.15);
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const bx = -20 + i * 10;
      ctx.moveTo(bx, -20 + float);
      ctx.bezierCurveTo(bx + Math.sin(t * 2 + i) * 8, -4, bx + Math.cos(t * 1.7 + i) * 12, 6, bx + Math.sin(t * 2.4 + i) * 6, 14);
      ctx.stroke();
    }
    // robe body
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(-26, -18 + float);
    ctx.quadraticCurveTo(-34, -56 + float, -16, -82 + float);
    ctx.quadraticCurveTo(0, -98 + float, 16, -82 + float);
    ctx.quadraticCurveTo(34, -56 + float, 26, -18 + float);
    ctx.quadraticCurveTo(0, -4 + float, -26, -18 + float);
    ctx.closePath();
    ctx.fill();
    // tattered hem
    ctx.fillStyle = robe;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-24 + i * 12, -20 + float);
      ctx.lineTo(-20 + i * 12, -6 + float + (i % 2) * 5);
      ctx.lineTo(-14 + i * 12, -19 + float);
      ctx.closePath(); ctx.fill();
    }
    // inner glow seams
    ctx.strokeStyle = rgba(glow, 0.4 * pulse);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -82 + float); ctx.lineTo(-6, -54 + float); ctx.lineTo(5, -30 + float);
    ctx.stroke();
    // hood
    ctx.fillStyle = mixHex(robe, '#000', 0.2);
    ctx.beginPath();
    ctx.arc(0, -80 + float, 17, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#07050a';
    ctx.beginPath();
    ctx.ellipse(-3, -79 + float, 11, 13, 0, 0, TAU);
    ctx.fill();
    // mask / eyes
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(-6, -82 + float, 2.2, 3.2, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2, -82 + float, 2.2, 3.2, -0.2, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // arms
    const armA = atk < 1 ? -0.5 - Math.sin(Math.PI * atk) * 0.9 : -0.25;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 18, -60 + float);
      ctx.rotate(side * (0.35 + armA * 0.3));
      ctx.strokeStyle = robe;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * 12, 14, side * 8 + Math.sin(t * 2) * 3, 30);
      ctx.stroke();
      // claw
      ctx.strokeStyle = rgba(glow, 0.7);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(side * 8, 30);
        ctx.lineTo(side * (6 + i * 3), 38);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (boss) {
      // halo
      ctx.strokeStyle = rgba(glow, 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -104 + float, 26, 7, Math.sin(t) * 0.1, 0, TAU);
      ctx.stroke();
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = clamp(p.life / (p.max || 1), 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFloats(dt, ctx) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      if (f.life <= 0) { this.floats.splice(i, 1); continue; }
      f.y += f.vy * dt;
      f.vy *= 0.95;
      const a = clamp(f.life / (f.max || 1), 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `700 ${f.size}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }
}
