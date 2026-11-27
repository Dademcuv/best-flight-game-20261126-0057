// Scenery for Skyline Courier: conifers, airfield buildings, the village
// and soft deterministic clouds. These give the valley scale cues without
// crowding the flight corridor or covering the course furniture.
import { COLORS } from './config.js';
import { buildClouds, buildTrees, buildBuildings } from './world.js';
import { shade, poly } from './terrain.js';

const CLOUDS = buildClouds();
const TREES = buildTrees();
const BUILDINGS = buildBuildings();

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

// Clouds stay high, small and translucent so they dress the sky without
// forming a white band across the horizon or hiding ring labels.
export function drawClouds(ctx, project) {
  for (const cl of CLOUDS) {
    const p = project(cl.x, cl.y, cl.z);
    if (!p || p.depth > 12000) continue;
    const s = cl.s * p.scale;
    if (s < 4) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    for (const [ox, oy, r] of [[0, 0, 1], [-0.55, 0.12, 0.7], [0.55, 0.1, 0.75], [0.1, -0.22, 0.6]]) {
      ctx.beginPath(); ctx.ellipse(p.x + ox * s, p.y + oy * s * 0.4, s * r, s * r * 0.34, 0, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(170,200,230,0.22)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + s * 0.16, s * 0.9, s * 0.18, 0, 0, 7); ctx.fill();
  }
}
