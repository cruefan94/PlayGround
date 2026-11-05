// Procedural Web Audio — no external assets, unlocked on the first user gesture.

export class AudioSystem {
  constructor({ muted = false } = {}) {
    this.ctx = null
    this.master = null
    this.ambient = null
    this.muted = muted
    this.ready = false
  }

  async unlock() {
    if (this.ready) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume().catch(() => {})
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    try {
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.55
      this.master.connect(this.ctx.destination)
      this.ready = true
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {})
      this.startAmbient()
    } catch {
      this.ready = false
    }
  }

  setMuted(muted) {
    this.muted = muted
    if (!this.ready) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setTargetAtTime(muted ? 0 : 0.55, t, 0.04)
  }

  noiseBuffer(duration = 0.5) {
    const rate = this.ctx.sampleRate
    const length = Math.floor(rate * duration)
    const buffer = this.ctx.createBuffer(1, length, rate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  noise({ duration = 0.25, gain = 0.2, freq = 1200, type = 'lowpass', when = 0, q = 0.7 }) {
    if (!this.ready || this.muted) return
    const t = this.ctx.currentTime + when
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer(duration + 0.05)
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(freq, t)
    filter.Q.value = q
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + duration + 0.1)
  }

  tone({ freq = 440, endFreq = freq, duration = 0.2, gain = 0.08, type = 'sine', when = 0 }) {
    if (!this.ready || this.muted) return
    const t = this.ctx.currentTime + when
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  startAmbient() {
    if (!this.ready || this.ambient) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer(6)
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 240
    const g = this.ctx.createGain()
    g.gain.value = 0.028
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()
    lfo.frequency.value = 0.08
    lfoGain.gain.value = 0.008
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
    lfo.start(t)
    this.ambient = { src, g, lfo }
  }

  click() {
    this.tone({ freq: 620, endFreq: 480, duration: 0.06, gain: 0.035, type: 'square' })
  }

  select() {
    this.tone({ freq: 440, endFreq: 660, duration: 0.08, gain: 0.04, type: 'triangle' })
  }

  shot(kind = 'rifle') {
    if (kind === 'mg') {
      for (let i = 0; i < 4; i++) this.noise({ duration: 0.08, gain: 0.16, freq: 1900, when: i * 0.055 })
      this.tone({ freq: 120, endFreq: 60, duration: 0.15, gain: 0.04, when: 0.12 })
    } else if (kind === 'cannon') {
      this.noise({ duration: 0.4, gain: 0.3, freq: 340 })
      this.tone({ freq: 110, endFreq: 38, duration: 0.42, gain: 0.15 })
    } else if (kind === 'mortar') {
      this.tone({ freq: 150, endFreq: 50, duration: 0.2, gain: 0.08 })
      this.noise({ duration: 0.5, gain: 0.24, freq: 400, when: 0.08 })
    } else if (kind === 'rpg') {
      this.noise({ duration: 0.32, gain: 0.16, freq: 2600, type: 'bandpass', q: 1.2 })
      this.tone({ freq: 280, endFreq: 90, duration: 0.25, gain: 0.05 })
    } else {
      this.noise({ duration: 0.14, gain: 0.16, freq: 1800, type: 'highpass' })
      this.tone({ freq: 160, endFreq: 80, duration: 0.12, gain: 0.03 })
    }
  }

  explosion(big = false) {
    this.noise({ duration: big ? 0.9 : 0.5, gain: big ? 0.38 : 0.25, freq: big ? 240 : 380 })
    this.tone({ freq: big ? 90 : 120, endFreq: 30, duration: big ? 0.8 : 0.45, gain: big ? 0.17 : 0.1 })
  }

  helicopter() {
    for (let i = 0; i < 8; i++) {
      this.noise({ duration: 0.1, gain: 0.06, freq: 180, type: 'lowpass', when: i * 0.11 })
    }
    this.tone({ freq: 70, endFreq: 65, duration: 0.9, gain: 0.035, type: 'sawtooth' })
  }

  heal() {
    this.tone({ freq: 520, endFreq: 780, duration: 0.18, gain: 0.05, type: 'sine' })
    this.tone({ freq: 780, endFreq: 1040, duration: 0.22, gain: 0.04, type: 'sine', when: 0.12 })
  }

  turn() {
    this.tone({ freq: 720, endFreq: 720, duration: 0.09, gain: 0.035, type: 'square' })
    this.tone({ freq: 960, endFreq: 960, duration: 0.08, gain: 0.025, type: 'square', when: 0.12 })
  }

  warning() {
    this.tone({ freq: 320, endFreq: 300, duration: 0.2, gain: 0.04, type: 'sawtooth' })
  }

  victory() {
    const notes = [392, 523, 659, 784]
    notes.forEach((f, i) => this.tone({ freq: f, endFreq: f, duration: 0.65, gain: 0.07, type: 'triangle', when: i * 0.15 }))
  }

  defeat() {
    this.tone({ freq: 180, endFreq: 60, duration: 1.4, gain: 0.09, type: 'sawtooth' })
    this.noise({ duration: 1.2, gain: 0.06, freq: 200 })
  }
}
