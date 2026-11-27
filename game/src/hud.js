// HUD for Skyline Courier: altitude/speed/heading readouts, a compass
// tape, lit instruments with wind and cargo status, and stall and low-fuel
// warnings. The title and touchdown screens live in screens.js.
import { COLORS, PLANE } from './config.js';
import { drawTitleScreen, drawEndScreen } from './screens.js';
import { drawCompass, drawRingArrow } from './navigation.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Hud {
  constructor(ctx, view) {
    this.ctx = ctx;
    this.w = view.w; this.h = view.h;
  }
  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.panel;
    ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
  }
  label(text, x, y, size = 13, color = COLORS.hudDim, align = 'center', weight = 600) {
    const ctx = this.ctx;
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  draw(game) {
    if (game.state === 'title') { drawTitleScreen(this); return; }
    this.flightData(game);
    this.missionData(game);
    drawCompass(this, game);
    if (game.state === 'landed' || game.state === 'crashed') { drawEndScreen(this, game); return; }
    this.message(game);
    this.warnings(game);
    this.instruments(game);
    drawRingArrow(this, game);
  }

  flightData(game) {
    const alt = Math.round(game.altitude * 3.28);
    const spd = Math.round(game.speed * 1.94);
    const hdg = Math.round(game.headingDeg);
    this.panel(16, 14, 252, 96);
    this.label('ALT', 58, 40); this.label('SPD', 132, 40); this.label('HDG', 212, 40);
    this.label(`${alt}`, 58, 74, 28, COLORS.hud, 'center', 800);
    this.label(`${spd}`, 132, 74, 28, COLORS.hud, 'center', 800);
    this.label(`${String(hdg).padStart(3, '0')}°`, 212, 74, 28, COLORS.hud, 'center', 800);
    this.label('ft', 58, 94, 12); this.label('kt', 132, 94, 12); this.label('deg', 212, 94, 12);
  }

  missionData(game) {
    this.panel(this.w - 268, 14, 252, 96);
    this.label('RINGS', this.w - 220, 40); this.label('SCORE', this.w - 140, 40); this.label('TIME', this.w - 60, 40);
    this.label(`${game.nextRing}/${game.rings.length}`, this.w - 220, 74, 28, COLORS.hud, 'center', 800);
    this.label(`${game.score}`, this.w - 140, 74, 28, COLORS.hud, 'center', 800);
    const mm = String(Math.floor(game.time / 60)).padStart(2, '0'), ss = String(Math.floor(game.time % 60)).padStart(2, '0');
    this.label(`${mm}:${ss}`, this.w - 60, 74, 28, COLORS.hud, 'center', 800);
    this.label('flown', this.w - 220, 94, 12); this.label('points', this.w - 140, 94, 12); this.label('min:sec', this.w - 60, 94, 12);
  }

  message(game) {
    if (game.messageT <= 0 || !game.message) return;
    const ctx = this.ctx;
    ctx.font = '700 24px system-ui, sans-serif'; ctx.textAlign = 'center';
    const tw = ctx.measureText(game.message).width + 44;
    this.panel((this.w - tw) / 2, 118, tw, 44);
    this.label(game.message, this.w / 2, 148, 22, COLORS.hud, 'center', 700);
  }

  warnings(game) {
    if (game.state !== 'flying') return;
    let row = 0;
    if (game.stalled) this.warn('STALL', row++);
    else if (game.agl < 45 && !game.onRunway()) this.warn('TERRAIN', row++);
    if (game.lowFuel) this.warn('LOW FUEL', row++);
    if (game.cargo.state === 'ready' && game.nextRing >= 2) this.note('CARGO READY — SPACE', row);
  }
  warn(text, row) {
    const ctx = this.ctx;
    const y = 176 + row * 42;
    ctx.fillStyle = 'rgba(165,25,25,0.88)';
    ctx.beginPath(); ctx.roundRect(this.w / 2 - 96, y, 192, 36, 8); ctx.fill();
    this.label(text, this.w / 2, y + 25, 20, '#fff', 'center', 800);
  }
  note(text, row) {
    const ctx = this.ctx;
    const y = 176 + row * 42;
    ctx.fillStyle = 'rgba(146,84,12,0.88)';
    ctx.beginPath(); ctx.roundRect(this.w / 2 - 130, y, 260, 36, 8); ctx.fill();
    this.label(text, this.w / 2, y + 25, 17, '#fff', 'center', 800);
  }

  instruments(game) {
    const ctx = this.ctx;
    const y = this.h - 128, h = 112;
    this.panel(this.w / 2 - 330, y, 660, h);
    const hx = this.w / 2 - 240, hy = y + 56;
    ctx.save();
    ctx.beginPath(); ctx.arc(hx, hy, 42, 0, 7); ctx.clip();
    ctx.translate(hx, hy); ctx.rotate(-game.roll);
    ctx.fillStyle = '#3f7fd0'; ctx.fillRect(-60, -60 + game.pitch * 55, 120, 60);
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(-60, game.pitch * 55, 120, 60);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-60, game.pitch * 55); ctx.lineTo(60, game.pitch * 55); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, 42, 0, 7); ctx.stroke();
    ctx.strokeStyle = COLORS.ringNext; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx - 24, hy); ctx.lineTo(hx - 8, hy); ctx.lineTo(hx, hy + 6); ctx.lineTo(hx + 8, hy); ctx.lineTo(hx + 24, hy); ctx.stroke();
    this.label('ATTITUDE', hx, y + h - 8, 11);
    this.gauge(this.w / 2 - 120, y + 22, 180, 'THROTTLE', game.throttle, COLORS.ok);
    this.gauge(this.w / 2 - 120, y + 62, 180, 'FUEL', game.fuel / 100, game.lowFuel ? COLORS.warn : COLORS.amber);
    this.label('VERT SPEED', this.w / 2 + 150, y + 34, 11);
    const vs = Math.round(Math.sin(game.pitch) * game.speed * 196.85 / 10) * 10;
    this.label(`${vs > 0 ? '+' : ''}${vs} fpm`, this.w / 2 + 150, y + 62, 22, COLORS.hud, 'center', 800);
    this.label('HEIGHT AGL', this.w / 2 + 262, y + 34, 11);
    this.label(`${Math.max(0, Math.round(game.agl * 3.28))} ft`, this.w / 2 + 262, y + 62, 22, COLORS.hud, 'center', 800);
    this.windReadout(game, y, h);
  }

  // Wind arrow relative to heading, plus cargo status, under the readouts.
  windReadout(game, y, h) {
    const ctx = this.ctx;
    const w = game.wind();
    const rel = Math.atan2(Math.sin(w.angle - game.heading), Math.cos(w.angle - game.heading));
    const x = this.w / 2 + 118, cy = y + h - 16;
    this.label('WIND', x - 34, cy + 4, 11);
    ctx.save(); ctx.translate(x, cy); ctx.rotate(rel);
    ctx.fillStyle = COLORS.hud;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    this.label(`${Math.round(w.speed * 1.94)} kt`, x + 30, cy + 4, 12, COLORS.hud, 'left', 700);
    const cargoText = game.cargo.state === 'ready' ? 'CARGO READY'
      : game.cargo.state === 'falling' ? 'CARGO AWAY'
      : game.cargo.hit ? `CARGO +${game.cargoBonus}` : 'CARGO MISSED';
    this.label(cargoText, this.w / 2 + 262, y + h - 12, 11, game.cargo.hit ? COLORS.ok : COLORS.amber, 'center', 700);
  }

  gauge(x, y, w, name, frac, color) {
    const ctx = this.ctx;
    this.label(name, x, y - 4, 11, COLORS.hudDim, 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 13, 6); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(8, w * clamp(frac, 0, 1)), 13, 6); ctx.fill();
  }

}
