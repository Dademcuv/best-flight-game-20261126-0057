// Renderer for Skyline Courier: a software-3D chase view on a 2D canvas.
// Terrain is a projected height-field grid, painter-sorted far to near, with
// distance haze, a lit instrument panel and a full flight HUD.
import { VIEW, WORLD, COLORS, MISSION } from './config.js';
import { terrainHeight, terrainColor, buildClouds } from './world.js';

const CLOUDS = buildClouds();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class Renderer {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.w = VIEW.w; this.h = VIEW.h;
    this.focal = VIEW.h * VIEW.fov;
  }

  // Camera sits behind and above the aircraft, looking along its heading.
  camera(game) {
    const back = 26, up = 7;
    const cx = game.pos.x - Math.sin(game.heading) * back;
    const cz = game.pos.z + Math.cos(game.heading) * back;
    const cy = game.pos.y + up;
    return { x: cx, y: cy, z: cz, heading: game.heading, pitch: game.pitch * 0.55 - 0.045, roll: game.roll * 0.35 };
  }

  project(cam, x, y, z) {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const sinH = Math.sin(cam.heading), cosH = Math.cos(cam.heading);
    // forward = (sinH, -cosH) in xz; right = (cosH, sinH)
    const fwd = dx * sinH - dz * cosH;
    const right = dx * cosH + dz * sinH;
    if (fwd < 2) return null;
    const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
    const up2 = dy * cosP - fwd * sinP;
    const fwd2 = dy * sinP + fwd * cosP;
    if (fwd2 < 2) return null;
    let sx = this.w / 2 + (right / fwd2) * this.focal;
    let sy = this.h / 2 - (up2 / fwd2) * this.focal;
    // camera roll rotates the whole frame slightly
    const cx = this.w / 2, cy = this.h / 2;
    const rx = sx - cx, ry = sy - cy;
    const cr = Math.cos(-cam.roll), sr = Math.sin(-cam.roll);
    sx = cx + rx * cr - ry * sr; sy = cy + rx * sr + ry * cr;
    return { x: sx, y: sy, depth: fwd2, scale: this.focal / fwd2 };
  }

  draw(game, t) {
    const ctx = this.ctx;
    const cam = this.camera(game);
    this.sky(cam, game);
    this.terrain(cam);
    this.water(cam);
    this.runway(cam);
    this.rings(cam, game, t);
    this.clouds(cam);
    this.aircraft(game, t);
    this.hud(game);
    if (game.state === 'title') this.titleScreen(game);
    if (game.state === 'landed' || game.state === 'crashed') this.endScreen(game);
  }

  sky(cam, game) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, COLORS.skyTop); g.addColorStop(0.45, COLORS.skyMid); g.addColorStop(0.72, COLORS.skyLow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    // ground haze below the horizon so dropped near quads never show sky
    const horizon = this.project(cam, cam.x + Math.sin(cam.heading) * 9000, cam.y, cam.z - Math.cos(cam.heading) * 9000);
    const hy = horizon ? horizon.y : this.h * 0.55;
    const gg = ctx.createLinearGradient(0, hy, 0, this.h);
    gg.addColorStop(0, '#b9d3a0'); gg.addColorStop(0.25, '#7fae56'); gg.addColorStop(1, '#4e8a42');
    ctx.fillStyle = gg; ctx.fillRect(0, hy, this.w, this.h - hy);
    // sun, fixed in the north-west sky
    const sun = this.project(cam, cam.x - 4000, cam.y + 2600, cam.z - 9000);
    if (sun) {
      const rg = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 150);
      rg.addColorStop(0, 'rgba(255,243,196,0.95)'); rg.addColorStop(0.25, 'rgba(255,243,196,0.45)'); rg.addColorStop(1, 'rgba(255,243,196,0)');
      ctx.fillStyle = rg; ctx.fillRect(sun.x - 150, sun.y - 150, 300, 300);
      ctx.fillStyle = COLORS.sun; ctx.beginPath(); ctx.arc(sun.x, sun.y, 26, 0, 7); ctx.fill();
    }
  }

  terrain(cam) {
    const ctx = this.ctx;
    const STEP = 190, RANGE = 9500;
    const quads = [];
    const x0 = Math.floor((cam.x - RANGE) / STEP) * STEP, x1 = cam.x + RANGE;
    const z0 = Math.floor((cam.z - RANGE) / STEP) * STEP, z1 = cam.z + RANGE;
    for (let x = x0; x < x1; x += STEP) {
      for (let z = z0; z < z1; z += STEP) {
        const cx = x + STEP / 2, cz = z + STEP / 2;
        const d = Math.hypot(cx - cam.x, cz - cam.z);
        if (d > RANGE) continue;
        const corners = [[x, z], [x + STEP, z], [x + STEP, z + STEP], [x, z + STEP]]
          .map(([px, pz]) => this.project(cam, px, terrainHeight(px, pz), pz));
        if (corners.some((p) => !p)) continue;
        const hC = terrainHeight(cx, cz);
        const slope = Math.abs(terrainHeight(cx + 60, cz) - hC) / 60 + Math.abs(terrainHeight(cx, cz + 60) - hC) / 60;
        quads.push({ corners, d, color: terrainColor(hC, slope), h: hC });
      }
    }
    quads.sort((a, b) => b.d - a.d);
    for (const q of quads) {
      const jitter = 0.92 + ((Math.sin(q.corners[0].x * 12.9898 + q.corners[0].y * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.16;
      const shade = clamp(0.82 + q.h / 2400, 0.8, 1.12) * jitter;
      ctx.fillStyle = this.shade(q.color, shade);
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = q.d > 3000 ? 0.6 : 1.4;
      ctx.beginPath();
      ctx.moveTo(q.corners[0].x, q.corners[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(q.corners[i].x, q.corners[i].y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // distance haze
      const hz = clamp((q.d - 3200) / 6000, 0, 0.62);
      if (hz > 0.02) {
        ctx.fillStyle = `rgba(207,232,247,${hz})`;
        ctx.fill();
      }
    }
  }

  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(((n >> 16) & 255) * f, 0, 255) | 0;
    const g = clamp(((n >> 8) & 255) * f, 0, 255) | 0;
    const b = clamp((n & 255) * f, 0, 255) | 0;
    return `rgb(${r},${g},${b})`;
  }

  water(cam) {
    const ctx = this.ctx;
    const pts = [[-3400 - 1500, 2600 - 1500], [-3400 + 1500, 2600 - 1500], [-3400 + 1500, 2600 + 1500], [-3400 - 1500, 2600 + 1500]]
      .map(([x, z]) => this.project(cam, x, WORLD.waterLevel, z));
    if (pts.some((p) => !p)) return;
    ctx.fillStyle = COLORS.water;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,190,235,0.35)';
    ctx.fill();
  }

  runway(cam) {
    const ctx = this.ctx, r = WORLD.runway;
    const hw = r.width / 2, hl = r.length / 2;
    const y = 18.4;
    const strip = [[r.x - hw, r.z - hl], [r.x + hw, r.z - hl], [r.x + hw, r.z + hl], [r.x - hw, r.z + hl]]
      .map(([x, z]) => this.project(cam, x, y, z));
    if (strip.some((p) => !p)) return;
    ctx.fillStyle = COLORS.runway;
    ctx.beginPath(); ctx.moveTo(strip[0].x, strip[0].y);
    strip.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath(); ctx.fill();
    // centreline dashes + threshold bars
    ctx.strokeStyle = COLORS.runwayLine; ctx.fillStyle = COLORS.runwayLine;
    for (let i = -8; i <= 8; i++) {
      const a = this.project(cam, r.x, y, r.z + i * 52 - 14);
      const b = this.project(cam, r.x, y, r.z + i * 52 + 14);
      if (!a || !b) continue;
      ctx.lineWidth = Math.max(1, a.scale * 1.6);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const end of [-hl + 26, hl - 26]) {
      for (let i = -2; i <= 2; i++) {
        const p = this.project(cam, r.x + i * 9, y, r.z + end);
        if (!p) continue;
        ctx.fillRect(p.x - p.scale * 1.6, p.y - p.scale * 3.4, p.scale * 3.2, p.scale * 6.8);
      }
    }
    // approach lights
    ctx.fillStyle = '#ffd76e';
    for (let i = 1; i <= 5; i++) {
      const p = this.project(cam, r.x, y + 1, r.z + hl + i * 60);
      if (!p) continue;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.4, p.scale * 1.1), 0, 7); ctx.fill();
    }
  }

  rings(cam, game, t) {
    const ctx = this.ctx;
    const sorted = game.rings.map((ring, i) => ({ ring, i, d: Math.hypot(ring.x - cam.x, ring.z - cam.z) }))
      .sort((a, b) => b.d - a.d);
    for (const { ring, i } of sorted) {
      const c = this.project(cam, ring.x, ring.y, ring.z);
      if (!c || c.depth > 9000) continue;
      const rad = MISSION.ringRadius * c.scale;
      if (rad < 2) continue;
      const isNext = i === game.nextRing;
      const col = ring.done ? COLORS.ringDone : isNext ? COLORS.ringNext : COLORS.ring;
      const pulse = isNext ? 1 + Math.sin(t * 4) * 0.05 : 1;
      ctx.save();
      ctx.translate(c.x, c.y); ctx.scale(pulse, pulse);
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, rad * 0.12);
      ctx.shadowColor = col; ctx.shadowBlur = isNext ? 22 : 8;
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, 7); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1, rad * 0.035);
      ctx.beginPath(); ctx.arc(0, 0, rad * 0.86, 0, 7); ctx.stroke();
      ctx.restore();
      if (isNext && c.depth < 4000) {
        ctx.fillStyle = COLORS.hud; ctx.font = '700 17px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`RING ${i + 1} · ${Math.round(c.depth)} m`, c.x, c.y - rad - 12);
      }
    }
  }

  clouds(cam) {
    const ctx = this.ctx;
    for (const cl of CLOUDS) {
      const p = this.project(cam, cl.x, cl.y, cl.z);
      if (!p || p.depth > 12000) continue;
      const s = cl.s * p.scale;
      if (s < 4) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      for (const [ox, oy, r] of [[0, 0, 1], [-0.55, 0.12, 0.7], [0.55, 0.1, 0.75], [0.1, -0.22, 0.6]]) {
        ctx.beginPath(); ctx.ellipse(p.x + ox * s, p.y + oy * s * 0.4, s * r, s * r * 0.36, 0, 0, 7); ctx.fill();
      }
    }
  }

  aircraft(game, t) {
    const ctx = this.ctx;
    const cx = this.w / 2, cy = this.h * 0.62;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(game.roll * 0.9);
    ctx.translate(0, Math.sin(t * 2.1) * 2.5 - game.pitch * 26);
    const s = 1.15;
    ctx.scale(s, s);
    // shadow of the wings' underside
    ctx.fillStyle = 'rgba(10,25,45,0.18)';
    ctx.beginPath(); ctx.ellipse(0, 46, 120, 14, 0, 0, 7); ctx.fill();
    // main wing
    ctx.fillStyle = COLORS.planeBody;
    ctx.beginPath();
    ctx.moveTo(-128, 8); ctx.lineTo(-30, -6); ctx.lineTo(30, -6); ctx.lineTo(128, 8);
    ctx.lineTo(122, 20); ctx.lineTo(28, 12); ctx.lineTo(-28, 12); ctx.lineTo(-122, 20);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.planeTrim;
    ctx.fillRect(-128, 8, 22, 10); ctx.fillRect(106, 8, 22, 10);
    // fuselage (seen from behind-above)
    ctx.fillStyle = COLORS.planeBody;
    ctx.beginPath(); ctx.ellipse(0, 2, 21, 52, 0, 0, 7); ctx.fill();
    ctx.fillStyle = COLORS.planeTrim;
    ctx.beginPath(); ctx.ellipse(0, 34, 21, 12, 0, 0, Math.PI); ctx.fill();
    // canopy
    ctx.fillStyle = '#79b8dd';
    ctx.beginPath(); ctx.ellipse(0, -18, 13, 22, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-4, -24, 5, 10, -0.4, 0, 7); ctx.fill();
    // tailplane + fin
    ctx.fillStyle = COLORS.planeBody;
    ctx.beginPath(); ctx.moveTo(-52, 40); ctx.lineTo(52, 40); ctx.lineTo(46, 50); ctx.lineTo(-46, 50); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.planeTrim;
    ctx.beginPath(); ctx.moveTo(-3, 46); ctx.lineTo(3, 46); ctx.lineTo(3, 22); ctx.lineTo(-3, 22); ctx.closePath(); ctx.fill();
    // propeller blur at the nose
    ctx.fillStyle = 'rgba(30,40,55,0.28)';
    ctx.beginPath(); ctx.ellipse(0, -52, 34, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = COLORS.planeDark;
    ctx.beginPath(); ctx.arc(0, -52, 4.5, 0, 7); ctx.fill();
    // navigation lights
    ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(-124, 14, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#39e07a'; ctx.beginPath(); ctx.arc(124, 14, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 50, 3, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---- HUD & instruments -------------------------------------------------
  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.panel;
    ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
  }
  label(text, x, y, size = 13, color = COLORS.hudDim, align = 'center', weight = 600) {
    const ctx = this.ctx;
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  hud(game) {
    const ctx = this.ctx;
    if (game.state === 'title') return;
    const alt = Math.round(game.altitude * 3.28);          // feet
    const spd = Math.round(game.speed * 1.94);             // knots
    const hdg = Math.round(game.headingDeg);
    // top-left: flight data
    this.panel(16, 14, 252, 96);
    this.label('ALT', 44, 40); this.label('SPD', 128, 40); this.label('HDG', 212, 40);
    this.label(`${alt}`, 44, 74, 30, COLORS.hud, 'center', 800);
    this.label(`${spd}`, 128, 74, 30, COLORS.hud, 'center', 800);
    this.label(`${String(hdg).padStart(3, '0')}°`, 212, 74, 30, COLORS.hud, 'center', 800);
    this.label('ft', 44, 94, 12); this.label('kt', 128, 94, 12); this.label('deg', 212, 94, 12);
    // top-right: mission
    this.panel(this.w - 268, 14, 252, 96);
    this.label('RINGS', this.w - 220, 40); this.label('SCORE', this.w - 140, 40); this.label('TIME', this.w - 60, 40);
    this.label(`${game.nextRing}/${game.rings.length}`, this.w - 220, 74, 28, COLORS.hud, 'center', 800);
    this.label(`${game.score}`, this.w - 140, 74, 28, COLORS.hud, 'center', 800);
    const mm = String(Math.floor(game.time / 60)).padStart(2, '0'), ss = String(Math.floor(game.time % 60)).padStart(2, '0');
    this.label(`${mm}:${ss}`, this.w - 60, 74, 28, COLORS.hud, 'center', 800);
    this.label('flown', this.w - 220, 94, 12); this.label('points', this.w - 140, 94, 12); this.label('min:sec', this.w - 60, 94, 12);
    // compass tape, top centre
    this.compass(game);
    // message
    if (game.messageT > 0) {
      ctx.font = '700 24px system-ui, sans-serif'; ctx.textAlign = 'center';
      const tw = ctx.measureText(game.message).width + 44;
      this.panel((this.w - tw) / 2, 118, tw, 44);
      this.label(game.message, this.w / 2, 148, 22, COLORS.hud, 'center', 700);
    }
    // warnings
    const agl = game.agl;
    if (game.state === 'flying' && game.speed < 32) this.warn('STALL', 0);
    else if (game.state === 'flying' && agl < 45 && !game.onRunway()) this.warn('TERRAIN', 0);
    if (game.state === 'flying' && game.fuel < 18) this.warn('LOW FUEL', 1);
    // instrument panel, bottom centre
    this.instruments(game);
    // next-ring direction arrow
    this.ringArrow(game);
  }

  warn(text, row) {
    const ctx = this.ctx;
    const y = 176 + row * 40;
    ctx.fillStyle = 'rgba(160,25,25,0.85)';
    ctx.beginPath(); ctx.roundRect(this.w / 2 - 92, y, 184, 34, 8); ctx.fill();
    this.label(text, this.w / 2, y + 24, 19, '#fff', 'center', 800);
  }

  compass(game) {
    const ctx = this.ctx;
    const w = 340, x = (this.w - w) / 2, y = 14;
    this.panel(x, y, w, 44);
    const hdg = game.headingDeg;
    ctx.save(); ctx.beginPath(); ctx.rect(x + 6, y + 4, w - 12, 36); ctx.clip();
    for (let d = -60; d <= 60; d += 5) {
      const deg = ((Math.round(hdg / 5) * 5 + d) % 360 + 360) % 360;
      const px = this.w / 2 + d * 2.6;
      const major = deg % 30 === 0;
      ctx.strokeStyle = COLORS.hudDim; ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(px, y + (major ? 22 : 30)); ctx.lineTo(px, y + 38); ctx.stroke();
      if (major) {
        const name = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] || String(deg / 10);
        this.label(name, px, y + 19, 14, COLORS.hud, 'center', 700);
      }
    }
    ctx.restore();
    ctx.fillStyle = COLORS.ringNext;
    ctx.beginPath(); ctx.moveTo(this.w / 2 - 7, y + 40); ctx.lineTo(this.w / 2 + 7, y + 40); ctx.lineTo(this.w / 2, y + 30); ctx.closePath(); ctx.fill();
  }

  instruments(game) {
    const ctx = this.ctx;
    const y = this.h - 128, h = 112;
    this.panel(this.w / 2 - 330, y, 660, h);
    // artificial horizon
    const hx = this.w / 2 - 240, hy = y + 56;
    ctx.save();
    ctx.beginPath(); ctx.arc(hx, hy, 42, 0, 7); ctx.clip();
    ctx.translate(hx, hy); ctx.rotate(-game.roll);
    ctx.fillStyle = '#3f7fd0'; ctx.fillRect(-60, -60 + game.pitch * 55, 120, 60);
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(-60, game.pitch * 55, 120, 60);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-60, game.pitch * 55); ctx.lineTo(60, game.pitch * 55); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, 42, 0, 7); ctx.stroke();
    ctx.strokeStyle = COLORS.ringNext; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx - 24, hy); ctx.lineTo(hx - 8, hy); ctx.lineTo(hx, hy + 6); ctx.lineTo(hx + 8, hy); ctx.lineTo(hx + 24, hy); ctx.stroke();
    this.label('ATTITUDE', hx, y + h - 8, 11);
    // throttle + fuel gauges
    this.gauge(this.w / 2 - 120, y + 22, 180, 'THROTTLE', game.throttle, COLORS.ok);
    this.gauge(this.w / 2 - 120, y + 62, 180, 'FUEL', game.fuel / 100, game.fuel < 18 ? COLORS.warn : '#ffb02e');
    // vertical speed + AGL readouts
    this.label('VERT SPEED', this.w / 2 + 150, y + 34, 11);
    const vs = Math.round(Math.sin(game.pitch) * game.speed * 196.85 / 10) * 10;
    this.label(`${vs > 0 ? '+' : ''}${vs} fpm`, this.w / 2 + 150, y + 62, 22, COLORS.hud, 'center', 800);
    this.label('HEIGHT AGL', this.w / 2 + 262, y + 34, 11);
    this.label(`${Math.max(0, Math.round(game.agl * 3.28))} ft`, this.w / 2 + 262, y + 62, 22, COLORS.hud, 'center', 800);
    this.label('GEAR DOWN · FLAPS AUTO', this.w / 2 + 206, y + h - 10, 11, COLORS.ok);
  }

  gauge(x, y, w, name, frac, color) {
    const ctx = this.ctx;
    this.label(name, x, y - 4, 11, COLORS.hudDim, 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 13, 6); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(8, w * clamp(frac, 0, 1)), 13, 6); ctx.fill();
  }

  ringArrow(game) {
    const ring = game.rings[game.nextRing];
    if (!ring || game.state !== 'flying') return;
    const ctx = this.ctx;
    const target = Math.atan2(ring.x - game.pos.x, -(ring.z - game.pos.z));
    let rel = target - game.heading;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const x = this.w - 70, y = 170;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rel);
    ctx.fillStyle = COLORS.ringNext;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(12, 12); ctx.lineTo(0, 5); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    this.label('NEXT RING', x, y + 42, 11);
  }

  titleScreen(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,18,34,0.55)'; ctx.fillRect(0, 0, this.w, this.h);
    this.label('SKYLINE COURIER', this.w / 2, 190, 64, '#ffffff', 'center', 900);
    this.label('Fly the valley course, thread every ring, and bring her home.', this.w / 2, 232, 21, COLORS.hudDim);
    this.panel(this.w / 2 - 300, 272, 600, 210);
    const lines = [
      ['↑ / W · ↓ / S', 'climb and descend'],
      ['← → / A D', 'bank and turn'],
      ['Shift / Ctrl', 'throttle up / down'],
      ['Mouse hold + move', 'steer'],
      ['P', 'pause'],
    ];
    lines.forEach(([k, v], i) => {
      this.label(k, this.w / 2 - 40, 312 + i * 34, 18, COLORS.ringNext, 'right', 800);
      this.label(v, this.w / 2 - 16, 312 + i * 34, 18, COLORS.hud, 'left', 600);
    });
    this.label('Press ENTER or click to take off', this.w / 2, 540, 26, '#ffffff', 'center', 800);
    this.label('8 rings · one runway · watch your fuel and your height', this.w / 2, 578, 17, COLORS.hudDim);
  }

  endScreen(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,18,34,0.55)'; ctx.fillRect(0, 0, this.w, this.h);
    const landed = game.state === 'landed';
    this.label(landed ? 'TOUCHDOWN!' : 'CRASHED', this.w / 2, 250, 58, landed ? COLORS.ok : COLORS.warn, 'center', 900);
    this.panel(this.w / 2 - 340, 292, 680, 150);
    this.label(game.endReason, this.w / 2, 340, 19, COLORS.hud);
    this.label(`Score ${game.score} · Rings ${game.nextRing}/${game.rings.length} · Time ${Math.floor(game.time)}s · Fuel ${Math.round(game.fuel)}%`, this.w / 2, 386, 20, COLORS.hud, 'center', 700);
    this.label('Press ENTER to fly again', this.w / 2, 500, 24, '#ffffff', 'center', 800);
  }
}
