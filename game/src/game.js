// Flight model and mission state for Skyline Courier: arcade physics with
// wind drift, a cargo-drop side goal, fuel and stall decisions, and a graded
// landing report. The ground is forgiving only on the runway.
import { PLANE, WORLD, MISSION } from './config.js';
import { terrainHeight, buildCourse } from './world.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Game {
  constructor() { this.reset(); }
  reset() {
    this.state = 'title'; // title | flying | landed | crashed
    this.pos = { x: 0, y: 120, z: 900 };
    this.heading = 0; // 0 = north (-z); forward = (sin h, -cos h)
    this.pitch = 0; this.roll = 0;
    this.speed = PLANE.cruise; this.throttle = 0.62;
    this.fuel = PLANE.fuelStart; this.time = 0; this.score = 0;
    this.rings = buildCourse(); this.nextRing = 0;
    this.message = ''; this.messageT = 0;
    this.endReason = '';
    this.grade = ''; this.ringScore = 0; this.landingBonus = 0;
    this.timeBonus = 0; this.fuelBonus = 0; this.cargoBonus = 0;
    this.cargo = { state: 'ready', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hit: false };
  }
  start() {
    this.reset();
    this.state = 'flying';
    this.say('Fly the rings, drop cargo, then land');
  }
  say(text) { this.message = text; this.messageT = 4; }
  get altitude() { return this.pos.y; }
  get agl() { return this.pos.y - terrainHeight(this.pos.x, this.pos.z); }
  get headingDeg() { return ((this.heading * 180 / Math.PI) % 360 + 360) % 360; }
  get stalled() { return this.speed < PLANE.stallSpeed + 3; }
  get lowFuel() { return this.fuel < 22; }

  // Wind veers slowly and deterministically; it drifts the ground track.
  wind() {
    const angle = 0.85 + 0.5 * Math.sin(this.time * 0.05);
    const speed = 6 + 3 * Math.sin(this.time * 0.11 + 2);
    return { angle, speed, x: Math.sin(angle) * speed, z: -Math.cos(angle) * speed };
  }

  dropCargo() {
    if (this.state !== 'flying' || this.cargo.state !== 'ready') return;
    const fwd = this.speed;
    this.cargo = {
      state: 'falling', x: this.pos.x, y: this.pos.y - 3, z: this.pos.z,
      vx: Math.sin(this.heading) * fwd, vy: -2, vz: -Math.cos(this.heading) * fwd, hit: false,
    };
    this.say('Cargo away — watch the wind');
  }

  updateCargo(dt) {
    const c = this.cargo;
    if (c.state !== 'falling') return;
    const w = this.wind();
    c.vy = Math.max(-16, c.vy - 20 * dt); // parachute descent
    c.vx += (w.x - c.vx) * Math.min(1, dt * 0.8);
    c.vz += (w.z - c.vz) * Math.min(1, dt * 0.8);
    c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
    if (c.y <= terrainHeight(c.x, c.z) + 1) {
      c.state = 'done';
      const d = Math.hypot(c.x - WORLD.cargoZone.x, c.z - WORLD.cargoZone.z);
      c.hit = d < WORLD.cargoZone.radius;
      if (c.hit) {
        this.cargoBonus = MISSION.cargoBonus;
        this.score += MISSION.cargoBonus;
        this.say(`Cargo delivered — +${MISSION.cargoBonus}`);
      } else {
        this.say('Cargo missed the zone');
      }
    }
  }

  update(dt, axes) {
    if (this.state !== 'flying') return;
    this.time += dt;
    if (this.messageT > 0) this.messageT -= dt;

    // controls
    this.throttle = clamp(this.throttle + axes.throttle * dt * 0.5, 0, 1);
    if (this.fuel <= 0) this.throttle = 0;
    const targetRoll = axes.roll * 1.05;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 5);
    this.pitch = clamp(this.pitch + axes.pitch * dt * 0.9, -0.62, 0.62);
    if (!axes.pitch) this.pitch += (0 - this.pitch) * Math.min(1, dt * 1.4);

    // speed: engine vs drag vs gravity along the flight path
    const engine = this.throttle * 26;
    const drag = (this.speed - 18) * 0.16;
    this.speed = clamp(this.speed + (engine - drag - Math.sin(this.pitch) * 22) * dt, 8, PLANE.maxSpeed + 30);
    const stalled = this.speed < PLANE.stallSpeed;
    const lift = stalled ? 0.25 : 1;

    this.heading += Math.sin(this.roll) * PLANE.turnRate * dt * clamp(this.speed / PLANE.cruise, 0.4, 1.2);
    const vy = Math.sin(this.pitch) * this.speed * lift - (stalled ? 9 : 0);
    const w = this.wind();
    this.pos.x += (Math.sin(this.heading) * Math.cos(this.pitch) * this.speed + w.x * 0.32) * dt;
    this.pos.z += (-Math.cos(this.heading) * Math.cos(this.pitch) * this.speed + w.z * 0.32) * dt;
    this.pos.y += vy * dt;
    this.pos.y = clamp(this.pos.y, 0, 1400);
    const lim = WORLD.size / 2;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
    this.fuel = Math.max(0, this.fuel - PLANE.fuelBurn * this.throttle * dt);

    this.updateCargo(dt);
    this.checkRings();
    this.checkGround(vy);
  }

  checkRings() {
    const ring = this.rings[this.nextRing];
    if (!ring) return;
    const d = Math.hypot(this.pos.x - ring.x, this.pos.y - ring.y, this.pos.z - ring.z);
    if (d < MISSION.ringRadius) {
      ring.done = true; this.nextRing++;
      const bonus = Math.max(0, Math.round(120 - this.time));
      this.score += 250 + bonus;
      this.say(this.nextRing >= this.rings.length
        ? 'All rings clear — land on the runway!'
        : `Ring ${this.nextRing} of ${this.rings.length} — +${250 + bonus}`);
    }
  }

  onRunway() {
    const r = WORLD.runway;
    return Math.abs(this.pos.x - r.x) < r.width / 2 + 6
      && this.pos.z < r.z + r.length / 2 && this.pos.z > r.z - r.length / 2;
  }

  // Landing grade from rings, cargo, time and fuel kept in hand.
  computeGrade() {
    const ringShare = this.nextRing / this.rings.length;
    const points = ringShare * 55 + (this.cargo.hit ? 15 : 0)
      + clamp(this.fuel, 0, 100) * 0.15 + clamp((MISSION.parTime - this.time) / MISSION.parTime, 0, 1) * 15;
    if (points >= 88) return 'S';
    if (points >= 72) return 'A';
    if (points >= 55) return 'B';
    if (points >= 38) return 'C';
    return 'D';
  }

  checkGround(vy) {
    const ground = Math.max(terrainHeight(this.pos.x, this.pos.z), WORLD.waterLevel);
    if (this.pos.y > ground + 2) return;
    const aligned = Math.abs(angDiff(this.heading, 0)) < 0.22 || Math.abs(angDiff(this.heading, Math.PI)) < 0.22;
    if (this.onRunway() && aligned && vy > -7 && this.speed < 78) {
      this.state = 'landed';
      this.ringScore = this.nextRing * 250;
      this.landingBonus = 400;
      this.timeBonus = Math.max(0, Math.round((MISSION.parTime - this.time) * 4));
      this.fuelBonus = Math.round(this.fuel * 3);
      this.score += this.landingBonus + this.timeBonus + this.fuelBonus;
      this.grade = this.computeGrade();
      this.endReason = this.nextRing >= this.rings.length
        ? 'Perfect sortie — every ring flown and home safe.'
        : `Home safe with ${this.nextRing} of ${this.rings.length} rings.`;
    } else {
      this.state = 'crashed';
      this.grade = '—';
      this.endReason = this.onRunway() && !aligned ? 'You touched down sideways. Line up with the strip.'
        : vy <= -7 ? 'Too hard a descent — flare before touchdown.'
        : this.speed >= 78 ? 'Too fast at touchdown. Throttle back on final.'
        : 'You flew into the terrain.';
    }
  }
}
