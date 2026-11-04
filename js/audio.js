/* Tiny WebAudio synth for feedback. No assets required. */
export class GameAudio {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.ctx = null;
    this.master = null;
  }

  ensure() {
    if (!this.enabled) return false;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && this.ctx) {
      try { this.ctx.suspend(); } catch { /* ignore */ }
    }
  }

  tone({ freq = 220, end = null, dur = 0.12, type = 'square', vol = 0.4, delay = 0, glide = true }) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end && glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise(dur = 0.1, vol = 0.25, freq = 1200, delay = 0) {
    if (!this.ensure()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  strike() {
    this.noise(0.06, 0.35, 2400);
    this.tone({ freq: 160, end: 60, dur: 0.1, type: 'square', vol: 0.25 });
  }

  crit() {
    this.strike();
    this.tone({ freq: 520, end: 900, dur: 0.14, type: 'triangle', vol: 0.25, delay: 0.03 });
  }

  shatter() {
    this.noise(0.35, 0.4, 900);
    this.tone({ freq: 90, end: 35, dur: 0.3, type: 'sawtooth', vol: 0.25 });
    this.tone({ freq: 440, end: 720, dur: 0.18, type: 'triangle', vol: 0.2, delay: 0.04 });
  }

  hit() {
    this.noise(0.09, 0.32, 500);
    this.tone({ freq: 120, end: 50, dur: 0.12, type: 'square', vol: 0.3 });
  }

  hurt() {
    this.tone({ freq: 210, end: 70, dur: 0.2, type: 'sawtooth', vol: 0.25 });
    this.noise(0.12, 0.2, 320);
  }

  kill() {
    [392, 523, 659].forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.18, delay: i * 0.06 }));
  }

  levelUp() {
    [330, 440, 554, 659, 880].forEach((f, i) => {
      this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.18, delay: i * 0.08 });
    });
  }

  buy() {
    this.tone({ freq: 330, dur: 0.08, type: 'triangle', vol: 0.2 });
    this.tone({ freq: 494, dur: 0.12, type: 'triangle', vol: 0.18, delay: 0.07 });
  }

  error() {
    this.tone({ freq: 130, end: 90, dur: 0.13, type: 'square', vol: 0.15 });
  }

  death() {
    this.tone({ freq: 220, end: 45, dur: 0.8, type: 'sawtooth', vol: 0.22 });
    this.noise(0.5, 0.18, 200);
  }

  overload() {
    [220, 277, 330, 440, 554, 660].forEach((f, i) => {
      this.tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.16, delay: i * 0.09 });
    });
    this.noise(0.8, 0.2, 300, 0.2);
  }
}
