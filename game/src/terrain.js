// Terrain renderer for Skyline Courier: sky, solid-shaded heightfield with
// directional light, river and lake water, and the valley road. Props live
// in scenery.js and the airfield/course furniture in airfield.js.
import { WORLD, COLORS } from './config.js';
import { terrainHeight, terrainColor, riverCenter } from './world.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * f, 0, 255) | 0;
  const g = clamp(((n >> 8) & 255) * f, 0, 255) | 0;
  const b = clamp((n & 255) * f, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}
export function poly(ctx, pts) {
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
  gg.addColorStop(0, '#a9c48f'); gg.addColorStop(0.25, '#7fae56'); gg.addColorStop(1, '#4e8a42');
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
// Distant facets keep enough contrast to read as ranges, not a white grid.
export function drawTerrain(ctx, cam, project) {
  const STEP = 140, RANGE = 9800;
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
      let light = clamp(0.94 - gx * 0.42 - gz * 0.24, 0.66, 1.16);
      if (d > 2500) light = 0.92 + (light - 0.92) * 0.45; // soften distant facets
      quads.push({ corners, d, color: shade(terrainColor(hC, slope, cx, cz), light) });
    }
  }
  quads.sort((a, b) => b.d - a.d);
  for (const q of quads) {
    ctx.fillStyle = q.color;
    poly(ctx, q.corners); ctx.fill();
    const hz = clamp((q.d - 4300) / 7600, 0, 0.3);
    if (hz > 0.02) {
      ctx.fillStyle = `rgba(190,216,238,${hz})`;
      poly(ctx, q.corners); ctx.fill();
    }
  }
}

// River ribbon plus lake disc, both at water level, far to near, with a
// lighter current line so the water reads as moving surface, not flat fill.
export function drawWater(ctx, cam, project) {
  const polys = [];
  for (let z = -9500; z < 9500; z += 300) {
    const c0 = riverCenter(z), c1 = riverCenter(z + 300), w = 82;
    const pts = [
      project(c0 - w, WORLD.waterLevel + 0.3, z), project(c0 + w, WORLD.waterLevel + 0.3, z),
      project(c1 + w, WORLD.waterLevel + 0.3, z + 300), project(c1 - w, WORLD.waterLevel + 0.3, z + 300),
    ];
    if (pts.some((p) => !p)) continue;
    polys.push({ pts, d: Math.hypot(c0 - cam.x, z - cam.z), c0, c1, z });
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
    polys.push({ pts: lakePts, d: Math.hypot(WORLD.lake.x - cam.x, WORLD.lake.z - cam.z), lake: true });
  }
  polys.sort((a, b) => b.d - a.d);
  for (const p of polys) {
    ctx.fillStyle = COLORS.water;
    poly(ctx, p.pts); ctx.fill();
    ctx.fillStyle = 'rgba(120,190,235,0.24)';
    poly(ctx, p.pts); ctx.fill();
    if (!p.lake) {
      const a = project(p.c0, WORLD.waterLevel + 0.7, p.z + 40);
      const b = project(p.c1, WORLD.waterLevel + 0.7, p.z + 260);
      if (a && b) {
        ctx.strokeStyle = 'rgba(190,232,255,0.5)';
        ctx.lineWidth = Math.max(1, a.scale * 2.2);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
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
