// Tiny WebAudio synth: engine hum tied to throttle, ring chime, touchdown thud.
// No audio files — everything is generated, so the game loads offline.
export class Sound {
  constructor() { this.ctx = null; this.engine = null; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const osc = this.ctx.createOscillator(); osc.type = 'sawtooth';
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
    const gain = this.ctx.createGain(); gain.gain.value = 0;
    osc.connect(filt).connect(gain).connect(this.ctx.destination);
    osc.start();
    this.engine = { osc, filt, gain };
  }
  setEngine(throttle, speed, on) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.osc.frequency.setTargetAtTime(55 + throttle * 95 + speed * 0.4, t, 0.08);
    this.engine.filt.frequency.setTargetAtTime(300 + throttle * 700, t, 0.1);
    this.engine.gain.gain.setTargetAtTime(on ? 0.05 + throttle * 0.05 : 0, t, 0.1);
  }
  blip(freq, dur = 0.18, type = 'sine', vol = 0.16) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  ring() { this.blip(880, 0.16); setTimeout(() => this.blip(1318, 0.22), 70); }
  crash() { this.blip(90, 0.5, 'square', 0.22); }
  land() { this.blip(392, 0.2); setTimeout(() => this.blip(523, 0.25), 90); setTimeout(() => this.blip(659, 0.3), 180); }
}
