// Navigation aids for Skyline Courier: the heading compass tape across
// the top of the HUD and the next-ring bearing arrow at the right edge.
import { COLORS } from './config.js';

export function drawCompass(hud, game) {
  const ctx = hud.ctx;
  const w = 340, x = (hud.w - w) / 2, y = 14;
  hud.panel(x, y, w, 44);
  const hdg = game.headingDeg;
  ctx.save(); ctx.beginPath(); ctx.rect(x + 6, y + 4, w - 12, 36); ctx.clip();
  for (let d = -60; d <= 60; d += 5) {
    const deg = ((Math.round(hdg / 5) * 5 + d) % 360 + 360) % 360;
    const px = hud.w / 2 + d * 2.6;
    const major = deg % 30 === 0;
    ctx.strokeStyle = COLORS.hudDim; ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(px, y + (major ? 22 : 30)); ctx.lineTo(px, y + 38); ctx.stroke();
    if (major) {
      const name = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] || String(deg / 10);
      hud.label(name, px, y + 19, 14, COLORS.hud, 'center', 700);
    }
  }
  ctx.restore();
  ctx.fillStyle = COLORS.ringNext;
  ctx.beginPath(); ctx.moveTo(hud.w / 2 - 7, y + 40); ctx.lineTo(hud.w / 2 + 7, y + 40); ctx.lineTo(hud.w / 2, y + 30); ctx.closePath(); ctx.fill();
}

export function drawRingArrow(hud, game) {
  const ring = game.rings[game.nextRing];
  if (!ring || game.state !== 'flying') return;
  const ctx = hud.ctx;
  const target = Math.atan2(ring.x - game.pos.x, -(ring.z - game.pos.z));
  let rel = target - game.heading;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const x = hud.w - 70, y = 170;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rel);
  ctx.fillStyle = COLORS.ringNext;
  ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(12, 12); ctx.lineTo(0, 5); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
  ctx.restore();
  hud.label('NEXT RING', x, y + 42, 11);
}
