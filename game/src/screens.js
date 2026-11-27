// Full-screen reports for Skyline Courier: the title card with controls
// and the touchdown report. The results panel sits low and compact so the
// landed aircraft and the runway stay visible above it.
import { COLORS } from './config.js';

export function drawTitleScreen(hud) {
  const ctx = hud.ctx;
  ctx.fillStyle = 'rgba(8,18,34,0.42)'; ctx.fillRect(0, 0, hud.w, hud.h);
  hud.label('SKYLINE COURIER', hud.w / 2, 170, 62, '#ffffff', 'center', 900);
  hud.label('Fly the valley course, drop the cargo, and bring her home.', hud.w / 2, 212, 21, COLORS.hudDim);
  hud.panel(hud.w / 2 - 300, 250, 600, 240);
  const lines = [
    ['↑ / W · ↓ / S', 'climb and descend'],
    ['← → / A D', 'bank and turn'],
    ['Shift / Ctrl', 'throttle up / down'],
    ['Mouse hold + move', 'steer'],
    ['Space / click', 'drop cargo'],
    ['P', 'pause'],
  ];
  lines.forEach(([k, v], i) => {
    hud.label(k, hud.w / 2 - 40, 290 + i * 34, 18, COLORS.ringNext, 'right', 800);
    hud.label(v, hud.w / 2 - 16, 290 + i * 34, 18, COLORS.hud, 'left', 600);
  });
  hud.label('Press ENTER or click to take off', hud.w / 2, 548, 26, '#ffffff', 'center', 800);
  hud.label('8 rings · one cargo drop · one runway · mind the wind', hud.w / 2, 584, 17, COLORS.hudDim);
}

export function drawEndScreen(hud, game) {
  const ctx = hud.ctx;
  ctx.fillStyle = 'rgba(8,18,34,0.22)'; ctx.fillRect(0, 0, hud.w, hud.h);
  const landed = game.state === 'landed';
  hud.label(landed ? `TOUCHDOWN — GRADE ${game.grade}` : 'CRASHED', hud.w / 2, 132, 46, landed ? COLORS.ok : COLORS.warn, 'center', 900);
  hud.label(game.endReason, hud.w / 2, 166, 20, COLORS.hud);
  const px = hud.w / 2 - 310, py = 520, pw = 620, ph = 158;
  hud.panel(px, py, pw, ph);
  const rows = landed ? [
    [`Rings ${game.nextRing}/${game.rings.length}`, `${game.ringScore}`],
    ['Cargo delivery', game.cargo.hit ? `+${game.cargoBonus}` : '0'],
    ['Landing', `+${game.landingBonus}`],
    ['Time bonus', `+${game.timeBonus}`],
    ['Fuel bonus', `+${game.fuelBonus}`],
  ] : [
    [`Rings ${game.nextRing}/${game.rings.length}`, `${game.ringScore}`],
    ['Cargo delivery', game.cargo.hit ? `+${game.cargoBonus}` : '0'],
  ];
  rows.forEach(([k, v], i) => {
    hud.label(k, px + 44, py + 32 + i * 20, 18, COLORS.hudDim, 'left', 600);
    hud.label(v, px + pw - 44, py + 32 + i * 20, 18, COLORS.hud, 'right', 800);
  });
  hud.label(`SCORE ${game.score}`, px + 44, py + ph - 16, 24, COLORS.ringNext, 'left', 900);
  hud.label(`Fuel ${Math.round(game.fuel)}% · Time ${Math.floor(game.time)}s`, px + pw - 44, py + ph - 16, 19, COLORS.hud, 'right', 700);
  hud.label('Press ENTER to fly again', hud.w / 2, py + ph + 26, 20, '#ffffff', 'center', 800);
}
