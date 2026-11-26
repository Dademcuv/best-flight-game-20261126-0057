// Deterministic value noise + terrain height field for Skyline Courier.
// The world is analytic (no stored heightmap), so every run is identical.
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

// Terrain height in metres at world (x, z). A coastal valley runs north-south
// through the middle; mountain ranges rise to the east and west.
export function terrainHeight(x, z) {
  const valley = clamp(1 - Math.abs(x) / 5200, 0, 1);          // 1 in the valley
  const ridge = Math.pow(clamp((Math.abs(x) - 1700) / 4300, 0, 1), 1.35);
  let h = 14
    + noise2(x, z, 2600) * 90 * (0.25 + valley)
    + noise2(x + 9000, z - 4000, 900) * 46
    + noise2(x - 3000, z + 7000, 320) * 14
    + ridge * (700 + noise2(x, z, 1500) * 420)
    + Math.pow(clamp((Math.abs(z) - 7000) / 5000, 0, 1), 2) * 260;
  // a lake basin south-west of the valley
  const lakeD = Math.hypot(x + 3400, z - 2600);
  h = lerp(-6, h, clamp((lakeD - 700) / 900, 0, 1));
  // flatten the airfield pad around the runway
  const r = WORLD.runway;
  const padD = Math.hypot(x - r.x, z - r.z);
  h = lerp(18, h, clamp((padD - 620) / 700, 0, 1));
  return h;
}

export function terrainColor(h, slope) {
  if (h < WORLD.waterLevel + 1.5) return '#d9c48a';
  if (h > 620) return '#f4f7fa';
  if (slope > 0.55 || h > 430) return h > 520 ? '#8a8378' : '#6b655b';
  if (h > 240) return '#3e7d46';
  if (h > 90) return '#5da653';
  return '#8fae4e';
}

// Ring course: a slalom up the valley, over the lake, back to the field.
export function buildCourse() {
  const pts = [
    [0, 210, -1200], [700, 260, -2400], [-650, 300, -3600], [500, 340, -4800],
    [-1800, 300, -3600], [-3000, 240, -1400], [-2400, 200, 400], [-700, 190, -900],
  ];
  return pts.map(([x, y, z], i) => ({ x, y, z, done: false, index: i }));
}

// Scattered low clouds (deterministic positions).
export function buildClouds() {
  const out = [];
  for (let i = 0; i < 46; i++) {
    out.push({
      x: (hash(i, 71) - 0.5) * 18000,
      y: 420 + hash(i, 97) * 320,
      z: (hash(i, 131) - 0.5) * 18000,
      s: 140 + hash(i, 57) * 260,
    });
  }
  return out;
}
