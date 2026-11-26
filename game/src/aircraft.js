// Aircraft renderer for Skyline Courier: a shaded chase-view plane with a
// ground shadow that tracks altitude, a blurred propeller disc, lit
// navigation lights and a highlighted canopy.
import { COLORS } from './config.js';
import { terrainHeight } from './world.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Soft shadow projected onto the terrain under the aircraft.
function drawGroundShadow(ctx, project, game) {
  const ground = project(game.pos.x, terrainHeight(game.pos.x, game.pos.z) + 0.5, game.pos.z);
  if (!ground) return;
  const agl = Math.max(0, game.agl);
  const spread = clamp(1 + agl / 260, 1, 2.1);
  const alpha = clamp(0.34 - agl / 1400, 0.08, 0.34);
  ctx.fillStyle = `rgba(12,26,18,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, 15 * ground.scale * spread, 4.2 * ground.scale * spread, 0, 0, 7);
  ctx.fill();
}

export function drawAircraft(ctx, view, project, game, t) {
  drawGroundShadow(ctx, project, game);
  const cx = view.w / 2, cy = view.h * 0.62;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(game.roll * 0.9);
  ctx.translate(0, Math.sin(t * 2.1) * 2.5 - game.pitch * 26);
  const s = 1.18;
  ctx.scale(s, s);

  // Main wing with a light-to-shade gradient and red tips.
  const wing = ctx.createLinearGradient(-128, 0, 128, 0);
  wing.addColorStop(0, COLORS.planeShade); wing.addColorStop(0.5, COLORS.planeBody); wing.addColorStop(1, COLORS.planeShade);
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-130, 7); ctx.lineTo(-30, -7); ctx.lineTo(30, -7); ctx.lineTo(130, 7);
  ctx.lineTo(124, 20); ctx.lineTo(28, 12); ctx.lineTo(-28, 12); ctx.lineTo(-124, 20);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.planeTrim;
  ctx.fillRect(-130, 7, 23, 10); ctx.fillRect(107, 7, 23, 10);
  ctx.strokeStyle = 'rgba(34,48,63,0.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-96, 2); ctx.lineTo(-34, 6); ctx.moveTo(96, 2); ctx.lineTo(34, 6); ctx.stroke();

  // Fuselage with belly shading and a trim band.
  const body = ctx.createLinearGradient(-21, 0, 21, 0);
  body.addColorStop(0, COLORS.planeShade); body.addColorStop(0.45, COLORS.planeBody); body.addColorStop(1, COLORS.planeShade);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 2, 21, 53, 0, 0, 7); ctx.fill();
  ctx.fillStyle = COLORS.planeTrim;
  ctx.beginPath(); ctx.ellipse(0, 35, 21, 12, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = 'rgba(34,48,63,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 2, 21, 53, 0, 0, 7); ctx.stroke();

  // Canopy glass with a sky highlight.
  const glass = ctx.createLinearGradient(-13, -40, 13, 4);
  glass.addColorStop(0, COLORS.canopyHi); glass.addColorStop(0.5, COLORS.canopy); glass.addColorStop(1, '#3f7fb8');
  ctx.fillStyle = glass;
  ctx.beginPath(); ctx.ellipse(0, -18, 13, 22, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.ellipse(-4.5, -25, 4.6, 10, -0.4, 0, 7); ctx.fill();

  // Tailplane and fin.
  ctx.fillStyle = wing;
  ctx.beginPath(); ctx.moveTo(-53, 40); ctx.lineTo(53, 40); ctx.lineTo(47, 51); ctx.lineTo(-47, 51); ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.planeTrim;
  ctx.beginPath(); ctx.moveTo(-3.4, 47); ctx.lineTo(3.4, 47); ctx.lineTo(3.4, 21); ctx.lineTo(-3.4, 21); ctx.closePath(); ctx.fill();

  // Propeller: translucent blur disc, spinning blade arcs and spinner.
  const blur = 0.2 + game.throttle * 0.16;
  ctx.fillStyle = `rgba(30,40,55,${blur})`;
  ctx.beginPath(); ctx.ellipse(0, -53, 37, 6.5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = `rgba(30,40,55,${blur + 0.12})`; ctx.lineWidth = 2.4;
  const spin = (t * 28) % Math.PI;
  ctx.beginPath(); ctx.ellipse(0, -53, 34, 5.4, 0, spin, spin + 1.5); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -53, 34, 5.4, 0, spin + Math.PI, spin + Math.PI + 1.5); ctx.stroke();
  ctx.fillStyle = COLORS.planeDark;
  ctx.beginPath(); ctx.arc(0, -53, 4.8, 0, 7); ctx.fill();

  // Navigation lights: red port, green starboard, white tail.
  ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(-126, 13, 3.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#39e07a'; ctx.beginPath(); ctx.arc(126, 13, 3.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 51, 3.1, 0, 7); ctx.fill();
  ctx.restore();
}
