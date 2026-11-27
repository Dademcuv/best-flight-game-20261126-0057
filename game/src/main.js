// Skyline Courier entry point: wires input, physics, sound and rendering,
// and provides deterministic screenshot poses via ?shot= for the entry.
import { Game } from './game.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';

const canvas = document.getElementById('game');
const game = new Game();
const input = new Input(canvas);
const renderer = new Renderer(canvas);
const sound = new Sound();
let paused = false;
let lastRings = 0, lastState = game.state, lastCargo = game.cargo.state;

function fitCanvas() {
  const s = Math.min(innerWidth / canvas.width, innerHeight / canvas.height);
  canvas.style.width = `${canvas.width * s}px`;
  canvas.style.height = `${canvas.height * s}px`;
}
addEventListener('resize', fitCanvas);
fitCanvas();

// Deterministic poses for screenshots: real game state, rendered by the game.
function applyShot(name) {
  if (name === 'title') { game.reset(); return; }
  game.start();
  if (name === 'cover') {
    // Ring 1 centred ahead with the runway strip visible beyond it.
    game.pos = { x: 0, y: 312, z: -790 };
    game.heading = 0; game.speed = 64; game.throttle = 0.66; game.pitch = -0.03; game.roll = 0.03;
    game.cameraPitch = -0.17;
    game.fuel = 82; game.time = 12;
    game.say('Ring 1 ahead — runway beyond');
  } else if (name === 'rings') {
    // Banking toward Ring 2 over the east foothills, cargo still aboard.
    game.pos = { x: 500, y: 282, z: -1980 };
    game.heading = 0.44; game.roll = -0.42; game.speed = 71; game.pitch = -0.02; game.throttle = 0.7;
    game.rings[0].done = true; game.nextRing = 1; game.score = 320; game.time = 38; game.fuel = 76;
    game.say('Ring 1 of 8 — +320');
  } else if (name === 'landing') {
    // Final approach on the strip with the low-fuel warning lit.
    game.pos = { x: 0, y: 112, z: -1420 };
    game.heading = 0; game.speed = 47; game.throttle = 0.3; game.pitch = -0.1; game.roll = 0;
    game.rings.forEach((r) => { r.done = true; }); game.nextRing = 8; game.score = 2210; game.time = 118;
    game.fuel = 14;
    game.cargo.state = 'done'; game.cargo.hit = true; game.cargoBonus = 400;
    game.say('Final approach — runway ahead');
  } else if (name === 'results') {
    // Touchdown report: parked on the strip, grade and score breakdown.
    game.pos = { x: 0, y: 20, z: -2320 };
    game.heading = 0; game.speed = 0; game.throttle = 0; game.pitch = 0; game.roll = 0;
    game.rings.forEach((r) => { r.done = true; }); game.nextRing = 8;
    game.ringScore = 2000; game.cargoBonus = 400; game.landingBonus = 400;
    game.timeBonus = 72; game.fuelBonus = 54; game.score = 2926;
    game.time = 132; game.fuel = 18;
    game.cargo.state = 'done'; game.cargo.hit = true;
    game.state = 'landed';
    game.grade = game.computeGrade();
    game.endReason = 'Perfect sortie — every ring flown and home safe.';
    game.messageT = 0;
  }
}
const shot = new URLSearchParams(location.search).get('shot');
if (shot) applyShot(shot);

canvas.addEventListener('click', () => {
  sound.ensure();
  if (game.state === 'title') game.start();
  else if (game.state === 'flying') game.dropCargo();
  else if (game.state === 'landed' || game.state === 'crashed') game.start();
});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (input.hit('Enter')) { sound.ensure(); if (game.state !== 'flying') game.start(); }
  if (input.hit(' ')) { sound.ensure(); game.dropCargo(); }
  if (input.hit('p', 'P')) paused = !paused;
  if (!paused && !shot) {
    game.update(dt, input.axes(canvas));
    if (game.nextRing !== lastRings) { sound.ring(); lastRings = game.nextRing; }
    if (game.cargo.state !== lastCargo) {
      if (game.cargo.state === 'done' && game.cargo.hit) sound.ring();
      lastCargo = game.cargo.state;
    }
    if (game.state !== lastState) {
      if (game.state === 'crashed') sound.crash();
      if (game.state === 'landed') sound.land();
      lastState = game.state;
    }
    sound.setEngine(game.throttle, game.speed, game.state === 'flying');
  }
  renderer.draw(game, now / 1000);
  if (paused) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(8,18,34,0.5)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = '800 42px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PAUSED — press P to resume', canvas.width / 2, canvas.height / 2);
  }
  input.endFrame();
}
requestAnimationFrame(frame);
