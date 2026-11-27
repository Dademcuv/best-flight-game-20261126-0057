// Airfield and course furniture for Skyline Courier: the marked runway,
// the cargo drop zone and falling crate, and the eight target rings with
// readable distance labels for the next ring.
import { WORLD, COLORS, MISSION } from './config.js';
import { terrainHeight } from './world.js';
import { poly } from './terrain.js';

export function drawRunway(ctx, project) {
  const r = WORLD.runway;
  const hw = r.width / 2, hl = r.length / 2, y = 18.4;
  // Draw the strip in segments so the visible part still renders when the
  // near threshold is behind the camera (parked/results view).
  ctx.fillStyle = COLORS.runway;
  for (let z = -hl; z < hl; z += 90) {
    const seg = [[r.x - hw, r.z + z], [r.x + hw, r.z + z], [r.x + hw, r.z + z + 90], [r.x - hw, r.z + z + 90]]
      .map(([x, zz]) => project(x, y, zz));
    if (seg.some((p) => !p)) continue;
    poly(ctx, seg); ctx.fill();
    ctx.strokeStyle = COLORS.runwayEdge; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(seg[3].x, seg[3].y); ctx.lineTo(seg[0].x, seg[0].y);
    ctx.moveTo(seg[2].x, seg[2].y); ctx.lineTo(seg[1].x, seg[1].y);
    ctx.stroke();
  }
  ctx.strokeStyle = COLORS.runwayLine; ctx.fillStyle = COLORS.runwayLine;
  for (let i = -8; i <= 8; i++) {
    const a = project(r.x, y, r.z + i * 52 - 14);
    const b = project(r.x, y, r.z + i * 52 + 14);
    if (!a || !b) continue;
    ctx.lineWidth = Math.max(1, a.scale * 1.6);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const end of [-hl + 26, hl - 26]) {
    for (let i = -2; i <= 2; i++) {
      const p = project(r.x + i * 9, y, r.z + end);
      if (!p) continue;
      ctx.fillRect(p.x - p.scale * 1.6, p.y - p.scale * 3.4, p.scale * 3.2, p.scale * 6.8);
    }
  }
  ctx.fillStyle = COLORS.runwayEdge;
  for (let i = -4; i <= 4; i++) {
    for (const side of [-hw - 7, hw + 7]) {
      const p = project(r.x + side, y + 1, r.z + i * 105);
      if (!p) continue;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.4, p.scale * 1.1), 0, 7); ctx.fill();
    }
  }
  for (let i = 1; i <= 5; i++) {
    const p = project(r.x, y + 1, r.z + hl + i * 60);
    if (!p) continue;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.6, p.scale * 1.2), 0, 7); ctx.fill();
  }
}

// Cargo drop zone: concentric ground rings with a readable label.
export function drawCargoZone(ctx, project) {
  const z = WORLD.cargoZone;
  const c = project(z.x, terrainHeight(z.x, z.z) + 1, z.z);
  if (!c || c.depth > 6500) return;
  const rx = z.radius * c.scale, ry = rx * 0.3;
  if (rx < 3) return;
  ctx.strokeStyle = COLORS.cargoZone; ctx.lineWidth = Math.max(1.6, rx * 0.05);
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rx * 0.55, ry * 0.55, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = COLORS.cargo;
  ctx.beginPath(); ctx.ellipse(c.x, c.y, Math.max(2, rx * 0.12), Math.max(1.2, ry * 0.12), 0, 0, 7); ctx.fill();
  if (c.depth < 4200) {
    ctx.fillStyle = COLORS.hud; ctx.font = '700 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('CARGO ZONE', c.x, c.y - ry - 10);
  }
}

// Falling cargo crate under a parachute canopy.
export function drawCargoCrate(ctx, project, game) {
  const c = game.cargo;
  if (c.state === 'ready') return;
  const p = project(c.x, c.y, c.z);
  if (!p) return;
  const s = Math.max(2, 5 * p.scale);
  if (c.state === 'falling') {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.beginPath(); ctx.arc(p.x, p.y - s * 1.1, s * 1.5, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x - s * 1.4, p.y - s * 1.1); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x + s * 1.4, p.y - s * 1.1); ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  ctx.fillStyle = COLORS.cargo;
  ctx.fillRect(p.x - s * 0.6, p.y - s * 0.6, s * 1.2, s * 1.2);
  ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 1;
  ctx.strokeRect(p.x - s * 0.6, p.y - s * 0.6, s * 1.2, s * 1.2);
}

function ringLabel(ctx, text, x, y) {
  ctx.font = '700 17px system-ui, sans-serif'; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 22;
  ctx.fillStyle = 'rgba(9,20,36,0.82)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 21, w, 27, 8); ctx.fill();
  ctx.fillStyle = COLORS.hud;
  ctx.fillText(text, x, y);
}

export function drawRings(ctx, cam, project, game, t) {
  const sorted = game.rings.map((ring, i) => ({ ring, i, d: Math.hypot(ring.x - cam.x, ring.z - cam.z) }))
    .sort((a, b) => b.d - a.d);
  for (const { ring, i } of sorted) {
    const c = project(ring.x, ring.y, ring.z);
    if (!c || c.depth > 9000) continue;
    const rad = MISSION.ringRadius * c.scale;
    if (rad < 2) continue;
    const isNext = i === game.nextRing;
    const col = ring.done ? COLORS.ringDone : isNext ? COLORS.ringNext : COLORS.ring;
    const pulse = isNext ? 1 + Math.sin(t * 4) * 0.05 : 1;
    ctx.save();
    ctx.translate(c.x, c.y); ctx.scale(pulse, pulse);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.4, rad * 0.13);
    ctx.shadowColor = col; ctx.shadowBlur = isNext ? 24 : 8;
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, 7); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, rad * 0.035);
    ctx.beginPath(); ctx.arc(0, 0, rad * 0.85, 0, 7); ctx.stroke();
    ctx.restore();
    if (isNext && c.depth < 4200) {
      const above = c.y - rad - 18;
      ringLabel(ctx, `RING ${i + 1} · ${Math.round(c.depth)} m`, c.x, above < 196 ? 196 : above);
    }
  }
}
