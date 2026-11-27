// Renderer for Skyline Courier: owns the chase camera and projection, then
// composes the frame from the terrain, scenery, airfield, aircraft and HUD
// modules in order. The landed camera pulls back and up so the touchdown
// scene shows the whole aircraft on the strip.
import { VIEW } from './config.js';
import { drawSky, drawTerrain, drawWater, drawRoad } from './terrain.js';
import { drawProps, drawClouds } from './scenery.js';
import { drawRunway, drawCargoZone, drawCargoCrate, drawRings } from './airfield.js';
import { drawAircraft } from './aircraft.js';
import { Hud } from './hud.js';

export class Renderer {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.w = VIEW.w; this.h = VIEW.h;
    this.focal = VIEW.h * VIEW.fov;
    this.hud = new Hud(this.ctx, VIEW);
  }

  // Camera sits behind and above the aircraft, looking along its heading.
  // After touchdown it pulls farther back and higher, looking down the
  // strip so the runway markings read around the parked aircraft.
  camera(game) {
    const ended = game.state === 'landed' || game.state === 'crashed';
    const back = ended ? 96 : 26, up = ended ? 54 : 7;
    const cx = game.pos.x - Math.sin(game.heading) * back;
    const cz = game.pos.z + Math.cos(game.heading) * back;
    const cy = game.pos.y + up;
    const pitch = ended ? -0.2 : (game.cameraPitch ?? game.pitch * 0.55 - 0.075);
    return { x: cx, y: cy, z: cz, heading: game.heading, pitch, roll: game.roll * (ended ? 0.2 : 0.35) };
  }

  project(cam, x, y, z) {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const sinH = Math.sin(cam.heading), cosH = Math.cos(cam.heading);
    const fwd = dx * sinH - dz * cosH;
    const right = dx * cosH + dz * sinH;
    if (fwd < 2) return null;
    const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
    const up2 = dy * cosP - fwd * sinP;
    const fwd2 = dy * sinP + fwd * cosP;
    if (fwd2 < 2) return null;
    let sx = this.w / 2 + (right / fwd2) * this.focal;
    let sy = this.h / 2 - (up2 / fwd2) * this.focal;
    const cx = this.w / 2, cy = this.h / 2;
    const rx = sx - cx, ry = sy - cy;
    const cr = Math.cos(-cam.roll), sr = Math.sin(-cam.roll);
    sx = cx + rx * cr - ry * sr; sy = cy + rx * sr + ry * cr;
    return { x: sx, y: sy, depth: fwd2, scale: this.focal / fwd2 };
  }

  draw(game, t) {
    const cam = this.camera(game);
    const project = (x, y, z) => this.project(cam, x, y, z);
    drawSky(this.ctx, VIEW, cam, project);
    drawTerrain(this.ctx, cam, project);
    drawWater(this.ctx, cam, project);
    drawRoad(this.ctx, cam, project);
    drawProps(this.ctx, cam, project);
    drawRunway(this.ctx, project);
    drawCargoZone(this.ctx, project);
    drawCargoCrate(this.ctx, project, game);
    drawClouds(this.ctx, project);
    drawRings(this.ctx, cam, project, game, t);
    drawAircraft(this.ctx, VIEW, project, game, t);
    this.hud.draw(game);
  }
}
