// Terrain renderer for Skyline Courier: sky, solid-shaded heightfield with
// directional light, river and lake water, roads, trees, buildings, the
// runway, target rings and the cargo zone. No wireframe, no grid strokes.
import { WORLD, COLORS, MISSION } from './config.js';
import { terrainHeight, terrainColor, riverCenter, buildClouds, buildTrees, buildBuildings } from './world.js';

const CLOUDS = buildClouds();
const TREES = buildTrees();
const BUILDINGS = buildBuildings();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * f, 0, 255) | 0;
  const g = clamp(((n >> 8) & 255) * f, 0, 255) | 0;
  const b = clamp((n & 255) * f, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

export function drawSky(ctx, view, cam, project) {
  const g = ctx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, COLORS.skyTop); g.addColorStop(0.45, COLORS.skyMid); g.addColorStop(0.72, COLORS.skyLow);
  ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
  const horizon = project(cam.x + Math.sin(cam.heading) * 9000, cam.y, cam.z - Math.cos(cam.heading) * 9000);
  const hy = horizon ? horizon.y : view.h * 0.55;
  const gg = ctx.createLinearGradient(0, hy, 0, view.h);
  gg.addColorStop(0, '#b9d3a0'); gg.addColorStop(0.25, '#7fae56'); gg.addColorStop(1, '#4e8a42');
  ctx.fillStyle = gg; ctx.fillRect(0, hy, view.w, view.h - hy);
  const sun = project(cam.x - 4000, cam.y + 2600, cam.z - 9000);
  if (sun) {
    const rg = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 160);
    rg.addColorStop(0, 'rgba(255,243,196,0.95)'); rg.addColorStop(0.25, 'rgba(255,243,196,0.4)'); rg.addColorStop(1, 'rgba(255,243,196,0)');
    ctx.fillStyle = rg; ctx.fillRect(sun.x - 160, sun.y - 160, 320, 320);
    ctx.fillStyle = COLORS.sun; ctx.beginPath(); ctx.arc(sun.x, sun.y, 27, 0, 7); ctx.fill();
  }
}

// Heightfield mesh: one cached height grid per frame, quads shaded by the
// surface normal against a north-west sun, painter-sorted far to near.
export function drawTerrain(ctx, cam, project) {
  const STEP = 160, RANGE = 9800;
  const gx0 = Math.floor((cam.x - RANGE) / STEP), gx1 = Math.ceil((cam.x + RANGE) / STEP);
  const gz0 = Math.floor((cam.z - RANGE) / STEP), gz1 = Math.ceil((cam.z + RANGE) / STEP);
  const nx = gx1 - gx0 + 1, nz = gz1 - gz0 + 1;
  const heights = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      heights[iz * nx + ix] = terrainHeight((gx0 + ix) * STEP, (gz0 + iz) * STEP);
    }
  }
  const quads = [];
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const x = (gx0 + ix) * STEP, z = (gz0 + iz) * STEP;
      const cx = x + STEP / 2, cz = z + STEP / 2;
      const d = Math.hypot(cx - cam.x, cz - cam.z);
      if (d > RANGE) continue;
      const h00 = heights[iz * nx + ix], h10 = heights[iz * nx + ix + 1];
      const h01 = heights[(iz + 1) * nx + ix], h11 = heights[(iz + 1) * nx + ix + 1];
      const corners = [
        project(x, h00, z), project(x + STEP, h10, z),
        project(x + STEP, h11, z + STEP), project(x, h01, z + STEP),
      ];
      if (corners.some((p) => !p)) continue;
      const hC = (h00 + h10 + h01 + h11) / 4;
      const gx = ((h10 + h11) - (h00 + h01)) / (2 * STEP);
      const gz = ((h01 + h11) - (h00 + h10)) / (2 * STEP);
      const slope = Math.abs(gx) + Math.abs(gz);
      const light = clamp(0.9 - gx * 0.34 - gz * 0.19, 0.72, 1.09);
      quads.push({ corners, d, color: shade(terrainColor(hC, slope, cx, cz), light) });
    }
  }
  quads.sort((a, b) => b.d - a.d);
  for (const q of quads) {
    ctx.fillStyle = q.color;
    poly(ctx, q.corners); ctx.fill();
    const hz = clamp((q.d - 3400) / 6200, 0, 0.55);
    if (hz > 0.02) {
      ctx.fillStyle = `rgba(207,232,247,${hz})`;
      poly(ctx, q.corners); ctx.fill();
    }
  }
}

// River ribbon plus lake disc, both at water level, far to near.
export function drawWater(ctx, cam, project) {
  const polys = [];
  for (let z = -9500; z < 9500; z += 300) {
    const c0 = riverCenter(z), c1 = riverCenter(z + 300), w = 82;
    const pts = [
      project(c0 - w, WORLD.waterLevel + 0.3, z), project(c0 + w, WORLD.waterLevel + 0.3, z),
      project(c1 + w, WORLD.waterLevel + 0.3, z + 300), project(c1 - w, WORLD.waterLevel + 0.3, z + 300),
    ];
    if (pts.some((p) => !p)) continue;
    polys.push({ pts, d: Math.hypot(c0 - cam.x, z - cam.z) });
  }
  const lakePts = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    lakePts.push(project(
      WORLD.lake.x + Math.cos(a) * WORLD.lake.radius * 0.74,
      WORLD.waterLevel + 0.3,
      WORLD.lake.z + Math.sin(a) * WORLD.lake.radius * 0.74,
    ));
  }
  if (!lakePts.some((p) => !p)) {
    polys.push({ pts: lakePts, d: Math.hypot(WORLD.lake.x - cam.x, WORLD.lake.z - cam.z) });
  }
  polys.sort((a, b) => b.d - a.d);
  for (const p of polys) {
    ctx.fillStyle = COLORS.water;
    poly(ctx, p.pts); ctx.fill();
    ctx.fillStyle = 'rgba(120,190,235,0.28)';
    poly(ctx, p.pts); ctx.fill();
  }
}

// Valley road: a simple ribbon east of the river for ground scale.
export function drawRoad(ctx, cam, project) {
  const segs = [];
  for (let z = -7600; z < 7600; z += 340) {
    const c0 = 430 + 90 * Math.sin(z / 1500), c1 = 430 + 90 * Math.sin((z + 340) / 1500), w = 13;
    const y0 = terrainHeight(c0, z) + 0.6, y1 = terrainHeight(c1, z + 340) + 0.6;
    const pts = [
      project(c0 - w, y0, z), project(c0 + w, y0, z),
      project(c1 + w, y1, z + 340), project(c1 - w, y1, z + 340),
    ];
    if (pts.some((p) => !p)) continue;
    segs.push({ pts, d: Math.hypot(c0 - cam.x, z - cam.z) });
  }
  segs.sort((a, b) => b.d - a.d);
  ctx.fillStyle = COLORS.road;
  for (const s of segs) { poly(ctx, s.pts); ctx.fill(); }
}

function drawTree(ctx, project, tree) {
  const base = project(tree.x, tree.y, tree.z);
  const top = project(tree.x, tree.y + 17 * tree.s, tree.z);
  if (!base || !top || base.depth > 5200) return;
  const w = Math.max(1.6, 7.5 * tree.s * base.scale);
  ctx.fillStyle = 'rgba(20,40,20,0.25)';
  ctx.beginPath(); ctx.ellipse(base.x + w * 0.5, base.y, w * 0.9, w * 0.22, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#5a4632'; ctx.lineWidth = Math.max(1, w * 0.14);
  ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(base.x, base.y - w * 0.5); ctx.stroke();
  ctx.fillStyle = COLORS.forestDark;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y); ctx.lineTo(base.x + w, base.y - w * 0.35); ctx.lineTo(base.x - w, base.y - w * 0.35);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.forest;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y + w * 0.55); ctx.lineTo(base.x + w * 0.62, base.y - w * 0.3); ctx.lineTo(base.x - w * 0.62, base.y - w * 0.3);
  ctx.closePath(); ctx.fill();
}

function drawBox(ctx, project, b) {
  const hw = b.w / 2, hd = b.d / 2, y0 = b.y, y1 = b.y + b.h;
  const v = [
    [b.x - hw, y0, b.z - hd], [b.x + hw, y0, b.z - hd], [b.x + hw, y0, b.z + hd], [b.x - hw, y0, b.z + hd],
    [b.x - hw, y1, b.z - hd], [b.x + hw, y1, b.z - hd], [b.x + hw, y1, b.z + hd], [b.x - hw, y1, b.z + hd],
  ].map(([x, y, z]) => project(x, y, z));
  if (v.some((p) => !p)) return;
  const faces = [
    { idx: [4, 5, 6, 7], f: 1.0, roof: true },
    { idx: [0, 1, 5, 4], f: 0.82 }, { idx: [1, 2, 6, 5], f: 0.68 },
    { idx: [2, 3, 7, 6], f: 0.9 }, { idx: [3, 0, 4, 7], f: 0.74 },
  ].map((face) => ({
    ...face,
    pts: face.idx.map((i) => v[i]),
    d: face.idx.reduce((s, i) => s + v[i].depth, 0) / 4,
  })).sort((a, b2) => b2.d - a.d);
  for (const face of faces) {
    ctx.fillStyle = shade(face.roof ? b.roof : b.color, face.f);
    poly(ctx, face.pts); ctx.fill();
  }
}

// Trees and buildings merged into one far-to-near prop pass.
export function drawProps(ctx, cam, project) {
  const items = [];
  for (const t of TREES) {
    const d = Math.hypot(t.x - cam.x, t.z - cam.z);
    if (d < 5400) items.push({ d, draw: () => drawTree(ctx, project, t) });
  }
  for (const b of BUILDINGS) {
    const d = Math.hypot(b.x - cam.x, b.z - cam.z);
    if (d < 7000) items.push({ d, draw: () => drawBox(ctx, project, b) });
  }
  items.sort((a, b) => b.d - a.d);
  for (const item of items) item.draw();
}

export function drawRunway(ctx, project) {
  const r = WORLD.runway;
  const hw = r.width / 2, hl = r.length / 2, y = 18.4;
  const strip = [[r.x - hw, r.z - hl], [r.x + hw, r.z - hl], [r.x + hw, r.z + hl], [r.x - hw, r.z + hl]]
    .map(([x, z]) => project(x, y, z));
  if (strip.some((p) => !p)) return;
  ctx.fillStyle = COLORS.runway;
  poly(ctx, strip); ctx.fill();
  ctx.strokeStyle = COLORS.runwayEdge; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(strip[3].x, strip[3].y); ctx.lineTo(strip[0].x, strip[0].y);
  ctx.moveTo(strip[2].x, strip[2].y); ctx.lineTo(strip[1].x, strip[1].y);
  ctx.stroke();
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
      ctx.fillStyle = COLORS.hud; ctx.font = '700 17px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`RING ${i + 1} · ${Math.round(c.depth)} m`, c.x, c.y - rad - 12);
    }
  }
}

export function drawClouds(ctx, project) {
  for (const cl of CLOUDS) {
    const p = project(cl.x, cl.y, cl.z);
    if (!p || p.depth > 12000) continue;
    const s = cl.s * p.scale;
    if (s < 4) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [ox, oy, r] of [[0, 0, 1], [-0.55, 0.12, 0.7], [0.55, 0.1, 0.75], [0.1, -0.22, 0.6]]) {
      ctx.beginPath(); ctx.ellipse(p.x + ox * s, p.y + oy * s * 0.4, s * r, s * r * 0.36, 0, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(190,215,240,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + s * 0.16, s * 0.9, s * 0.2, 0, 0, 7); ctx.fill();
  }
}
