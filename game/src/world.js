// World model for Skyline Courier: an analytic coastal valley with a river,
// a lake, snow-capped side ranges and a northern backdrop range. Everything
// is deterministic value noise, so every run and screenshot is identical.
import { WORLD } from './config.js';

function hash(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function noise2(x, z, scale) {
  const gx = x / scale, gz = z / scale;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = smooth(gx - ix), fz = smooth(gz - iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

// The river winds down the west side of the valley floor.
export function riverCenter(z) {
  return -680 + 430 * Math.sin(z / 2100) + 120 * Math.sin(z / 640);
}

// Terrain height in metres at world (x, z). The flight corridor stays low;
// ranges climb steeply beyond it and a high backdrop closes the north.
export function terrainHeight(x, z) {
  const valley = clamp(1 - Math.abs(x) / 5200, 0, 1);
  const sideRidge = Math.pow(clamp((Math.abs(x) - 1500) / 2600, 0, 1), 1.25);
  const northRidge = Math.pow(clamp((-z - 6500) / 3000, 0, 1), 1.3);
  const southRise = Math.pow(clamp((z - 7200) / 4200, 0, 1), 1.6);
  let h = 16
    + noise2(x, z, 2600) * 74 * (0.3 + valley)
    + noise2(x + 9000, z - 4000, 900) * 34
    + noise2(x - 3000, z + 7000, 320) * 9
    + sideRidge * (880 + noise2(x, z, 1500) * 360)
    + northRidge * (760 + noise2(x + 5000, z, 1700) * 320)
    + southRise * 240;
  // Lake basin on the west shore of the course.
  const lakeD = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
  h = lerp(-7, h, clamp((lakeD - WORLD.lake.radius * 0.62) / 760, 0, 1));
  // River channel carved through the valley floor.
  const riverD = Math.abs(x - riverCenter(z));
  h = lerp(WORLD.waterLevel - 2, h, clamp((riverD - 85) / 240, 0, 1));
  // Airfield pad flattened around the runway.
  const r = WORLD.runway;
  const padD = Math.hypot(x - r.x, z - r.z);
  h = lerp(18, h, clamp((padD - 620) / 700, 0, 1));
  return h;
}

// Smooth large-scale patchiness so valley fields read as farmland, not grid.
export function fieldTone(x, z) {
  return noise2(x + 14000, z - 8000, 1500) * 0.65 + noise2(x - 6000, z + 3000, 520) * 0.35;
}
export function forestTone(x, z) {
  return noise2(x - 11000, z + 9000, 780);
}

// Base terrain colour before directional shading in the terrain renderer.
export function terrainColor(h, slope, x, z) {
  if (h < WORLD.waterLevel + 1.6) return '#d9c48a';
  if (h > 545 || (h > 470 && slope > 0.4)) return '#f6f9fc';
  if (slope > 0.52 || h > 430) return h > 500 ? '#8a8378' : '#655e52';
  if (h > 250) return '#3e7d46';
  const tone = fieldTone(x, z);
  if (forestTone(x, z) > 0.62 && h > 45) return '#2f6e3e';
  if (tone > 0.66) return '#a8b45c';
  if (tone < 0.3) return '#4f9a4c';
  return '#6fae52';
}

// Ring course: north up the valley, west over the lake, home to the field.
export function buildCourse() {
  const pts = [
    [0, 300, -1200], [700, 280, -2400], [-650, 320, -3600], [500, 350, -4800],
    [-1800, 310, -3600], [-2900, 250, -1800], [-2400, 210, 400], [-700, 205, -900],
  ];
  return pts.map(([x, y, z], i) => ({ x, y, z, done: false, index: i }));
}

// Scattered clouds at deterministic positions.
export function buildClouds() {
  const out = [];
  for (let i = 0; i < 52; i++) {
    out.push({
      x: (hash(i, 71) - 0.5) * 18000,
      y: 430 + hash(i, 97) * 340,
      z: (hash(i, 131) - 0.5) * 18000,
      s: 150 + hash(i, 57) * 280,
    });
  }
  return out;
}

// Scale cues: conifers on the valley floor and foothills, kept off the
// runway, river and lake so the flight corridor stays readable.
export function buildTrees() {
  const out = [];
  for (let gx = -5200; gx <= 5200; gx += 240) {
    for (let gz = -8200; gz <= 8200; gz += 240) {
      const jx = gx + (hash(gx, gz) - 0.5) * 150;
      const jz = gz + (hash(gz, gx) - 0.5) * 150;
      const h = terrainHeight(jx, jz);
      if (h < 22 || h > 330) continue;
      if (Math.abs(jx - riverCenter(jz)) < 190) continue;
      if (Math.hypot(jx - WORLD.lake.x, jz - WORLD.lake.z) < WORLD.lake.radius + 80) continue;
      if (Math.hypot(jx - WORLD.runway.x, jz - WORLD.runway.z) < 760) continue;
      if (hash(gx * 3, gz * 7) > 0.42 + forestTone(jx, jz) * 0.3) continue;
      out.push({ x: jx, z: jz, y: h, s: 0.75 + hash(gx, gz * 5) * 0.8 });
    }
  }
  return out;
}

// Airfield buildings and a small village: hangars, a tower and houses.
export function buildBuildings() {
  const boxes = [];
  const add = (x, z, w, d, h, color, roof, yOff = 0) => boxes.push({ x, z, y: terrainHeight(x, z) + yOff, w, d, h, color, roof });
  add(-150, -2250, 90, 60, 22, '#c8cfd6', '#7a4a3a');   // hangar west
  add(150, -2250, 90, 60, 22, '#c8cfd6', '#7a4a3a');    // hangar east
  add(120, -2920, 34, 34, 58, '#b9c9d8', '#34455c');    // control tower shaft
  add(120, -2920, 44, 44, 12, '#34455c', '#22303f', 58); // tower cab
  add(-130, -2920, 70, 46, 16, '#d8c9a8', '#8a5a44');   // terminal shed
  for (let i = 0; i < 9; i++) {
    const x = 430 + (hash(i, 31) - 0.5) * 160;
    const z = -700 + i * 210 + (hash(i, 47) - 0.5) * 90;
    add(x, z, 34 + hash(i, 13) * 16, 28, 13 + hash(i, 19) * 7, '#e3d7bd', '#96604a');
  }
  return boxes;
}
