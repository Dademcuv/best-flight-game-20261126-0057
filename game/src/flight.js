// Flight systems for Skyline Courier: the deterministic wind field, the
// arcade flight step (throttle, drag, stall, turn and ground track), and
// the parachute cargo drop that drifts with the same wind.
import { PLANE, WORLD, MISSION } from './config.js';
import { terrainHeight } from './world.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Wind veers slowly and deterministically; it drifts the ground track.
export function windFor(time) {
  const angle = 0.85 + 0.5 * Math.sin(time * 0.05);
  const speed = 6 + 3 * Math.sin(time * 0.11 + 2);
  return { angle, speed, x: Math.sin(angle) * speed, z: -Math.cos(angle) * speed };
}

export function dropCargo(game) {
  if (game.state !== 'flying' || game.cargo.state !== 'ready') return;
  const fwd = game.speed;
  game.cargo = {
    state: 'falling', x: game.pos.x, y: game.pos.y - 3, z: game.pos.z,
    vx: Math.sin(game.heading) * fwd, vy: -2, vz: -Math.cos(game.heading) * fwd, hit: false,
  };
  game.say('Cargo away — watch the wind');
}

export function updateCargo(game, dt) {
  const c = game.cargo;
  if (c.state !== 'falling') return;
  const w = game.wind();
  c.vy = Math.max(-16, c.vy - 20 * dt); // parachute descent
  c.vx += (w.x - c.vx) * Math.min(1, dt * 0.8);
  c.vz += (w.z - c.vz) * Math.min(1, dt * 0.8);
  c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
  if (c.y <= terrainHeight(c.x, c.z) + 1) {
    c.state = 'done';
    const d = Math.hypot(c.x - WORLD.cargoZone.x, c.z - WORLD.cargoZone.z);
    c.hit = d < WORLD.cargoZone.radius;
    if (c.hit) {
      game.cargoBonus = MISSION.cargoBonus;
      game.score += MISSION.cargoBonus;
      game.say(`Cargo delivered — +${MISSION.cargoBonus}`);
    } else {
      game.say('Cargo missed the zone');
    }
  }
}

// One physics step. Returns the vertical speed so the landing check can
// judge the touchdown flare. Ring and ground checks live in landing.js.
export function stepFlight(game, dt, axes) {
  game.time += dt;
  if (game.messageT > 0) game.messageT -= dt;

  // controls
  game.throttle = clamp(game.throttle + axes.throttle * dt * 0.5, 0, 1);
  if (game.fuel <= 0) game.throttle = 0;
  const targetRoll = axes.roll * 1.05;
  game.roll += (targetRoll - game.roll) * Math.min(1, dt * 5);
  game.pitch = clamp(game.pitch + axes.pitch * dt * 0.9, -0.62, 0.62);
  if (!axes.pitch) game.pitch += (0 - game.pitch) * Math.min(1, dt * 1.4);

  // speed: engine vs drag vs gravity along the flight path
  const engine = game.throttle * 26;
  const drag = (game.speed - 18) * 0.16;
  game.speed = clamp(game.speed + (engine - drag - Math.sin(game.pitch) * 22) * dt, 8, PLANE.maxSpeed + 30);
  const stalled = game.speed < PLANE.stallSpeed;
  const lift = stalled ? 0.25 : 1;

  game.heading += Math.sin(game.roll) * PLANE.turnRate * dt * clamp(game.speed / PLANE.cruise, 0.4, 1.2);
  const vy = Math.sin(game.pitch) * game.speed * lift - (stalled ? 9 : 0);
  const w = game.wind();
  game.pos.x += (Math.sin(game.heading) * Math.cos(game.pitch) * game.speed + w.x * 0.32) * dt;
  game.pos.z += (-Math.cos(game.heading) * Math.cos(game.pitch) * game.speed + w.z * 0.32) * dt;
  game.pos.y += vy * dt;
  game.pos.y = clamp(game.pos.y, 0, 1400);
  const lim = WORLD.size / 2;
  game.pos.x = clamp(game.pos.x, -lim, lim);
  game.pos.z = clamp(game.pos.z, -lim, lim);
  game.fuel = Math.max(0, game.fuel - PLANE.fuelBurn * game.throttle * dt);

  updateCargo(game, dt);
  return vy;
}
