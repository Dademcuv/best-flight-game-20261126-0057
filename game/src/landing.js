// Course and landing rules for Skyline Courier: ring scoring, runway
// alignment, the S–D landing grade, and the touchdown verdict. The ground
// is forgiving only on the runway, lined up, slow and flared.
import { WORLD, MISSION } from './config.js';
import { terrainHeight } from './world.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function checkRings(game) {
  const ring = game.rings[game.nextRing];
  if (!ring) return;
  const d = Math.hypot(game.pos.x - ring.x, game.pos.y - ring.y, game.pos.z - ring.z);
  if (d < MISSION.ringRadius) {
    ring.done = true; game.nextRing++;
    const bonus = Math.max(0, Math.round(120 - game.time));
    game.score += 250 + bonus;
    game.say(game.nextRing >= game.rings.length
      ? 'All rings clear — land on the runway!'
      : `Ring ${game.nextRing} of ${game.rings.length} — +${250 + bonus}`);
  }
}

export function onRunway(game) {
  const r = WORLD.runway;
  return Math.abs(game.pos.x - r.x) < r.width / 2 + 6
    && game.pos.z < r.z + r.length / 2 && game.pos.z > r.z - r.length / 2;
}

// Landing grade from rings, cargo, time and fuel kept in hand.
export function computeGrade(game) {
  const ringShare = game.nextRing / game.rings.length;
  const points = ringShare * 55 + (game.cargo.hit ? 15 : 0)
    + clamp(game.fuel, 0, 100) * 0.15 + clamp((MISSION.parTime - game.time) / MISSION.parTime, 0, 1) * 15;
  if (points >= 88) return 'S';
  if (points >= 72) return 'A';
  if (points >= 55) return 'B';
  if (points >= 38) return 'C';
  return 'D';
}

export function checkGround(game, vy) {
  const ground = Math.max(terrainHeight(game.pos.x, game.pos.z), WORLD.waterLevel);
  if (game.pos.y > ground + 2) return;
  const aligned = Math.abs(angDiff(game.heading, 0)) < 0.22 || Math.abs(angDiff(game.heading, Math.PI)) < 0.22;
  if (onRunway(game) && aligned && vy > -7 && game.speed < 78) {
    game.state = 'landed';
    game.ringScore = game.nextRing * 250;
    game.landingBonus = 400;
    game.timeBonus = Math.max(0, Math.round((MISSION.parTime - game.time) * 4));
    game.fuelBonus = Math.round(game.fuel * 3);
    game.score += game.landingBonus + game.timeBonus + game.fuelBonus;
    game.grade = computeGrade(game);
    game.endReason = game.nextRing >= game.rings.length
      ? 'Perfect sortie — every ring flown and home safe.'
      : `Home safe with ${game.nextRing} of ${game.rings.length} rings.`;
  } else {
    game.state = 'crashed';
    game.grade = '—';
    game.endReason = onRunway(game) && !aligned ? 'You touched down sideways. Line up with the strip.'
      : vy <= -7 ? 'Too hard a descent — flare before touchdown.'
      : game.speed >= 78 ? 'Too fast at touchdown. Throttle back on final.'
      : 'You flew into the terrain.';
  }
}
