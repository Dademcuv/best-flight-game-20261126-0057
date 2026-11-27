// Mission state for Skyline Courier: sortie setup, score bookkeeping and
// the per-frame update that delegates physics to flight.js and the course
// and touchdown rules to landing.js.
import { PLANE } from './config.js';
import { terrainHeight, buildCourse } from './world.js';
import { windFor, dropCargo, stepFlight } from './flight.js';
import { checkRings, onRunway, computeGrade, checkGround } from './landing.js';

export class Game {
  constructor() { this.reset(); }
  reset() {
    this.state = 'title'; // title | flying | landed | crashed
    this.pos = { x: 0, y: 120, z: 900 };
    this.heading = 0; // 0 = north (-z); forward = (sin h, -cos h)
    this.pitch = 0; this.roll = 0; this.cameraPitch = null;
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

  wind() { return windFor(this.time); }
  dropCargo() { dropCargo(this); }
  onRunway() { return onRunway(this); }
  computeGrade() { return computeGrade(this); }

  update(dt, axes) {
    if (this.state !== 'flying') return;
    const vy = stepFlight(this, dt, axes);
    checkRings(this);
    checkGround(this, vy);
  }
}
