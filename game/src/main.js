// Skyline Courier — entry point. Wires input, physics, sound and rendering,
// and provides deterministic screenshot poses via ?shot= for the entry cover.
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
let lastRings = 0, lastState = game.state;

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
    game.pos = { x: 260, y: 252, z: -600 };
    game.heading = -0.16; game.speed = 64; game.throttle = 0.66; game.pitch = 0.02; game.roll = 0.12;
    game.say('Ring 1 ahead — runway beyond');
  } else if (name === 'rings') {
    game.pos = { x: 640, y: 264, z: -1850 };
    game.heading = 0.05; game.roll = -0.38; game.speed = 71; game.pitch = 0.04;
    game.rings[0].done = true; game.nextRing = 1; game.score = 320; game.time = 38;
    game.say('Ring 1 of 8 — +320');
  } else if (name === 'landing') {
    game.pos = { x: 6, y: 122, z: -1720 };
    game.heading = 0; game.speed = 47; game.throttle = 0.3; game.pitch = -0.06;
    game.rings.forEach((r) => { r.done = true; }); game.nextRing = 8; game.score = 2210; game.time = 118;
    game.say('All rings clear — land on the runway!');
  }
}
const shot = new URLSearchParams(location.search).get('shot');
if (shot) applyShot(shot);

canvas.addEventListener('click', () => {
  sound.ensure();
  if (game.state === 'title') game.start();
  else if (game.state === 'landed' || game.state === 'crashed') game.start();
});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (input.hit('Enter')) { sound.ensure(); if (game.state !== 'flying') game.start(); }
  if (input.hit('p', 'P')) paused = !paused;
  if (!paused && !shot) {
    game.update(dt, input.axes(canvas));
    if (game.nextRing !== lastRings) { sound.ring(); lastRings = game.nextRing; }
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
