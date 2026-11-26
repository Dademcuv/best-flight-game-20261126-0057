// Skyline Courier — shared tuning constants for physics, world and rendering.
export const VIEW = { w: 1280, h: 720, fov: 1.9 }; // fov scales the focal length
export const WORLD = {
  size: 24000,          // playable square, metres
  waterLevel: 4,
  runway: { x: 0, z: -2600, length: 900, width: 46, heading: 0 }, // heading 0 = north (-z)
  lake: { x: -2800, z: -1800, radius: 1250 },
  cargoZone: { x: -2350, z: -1650, radius: 190 },
};
export const PLANE = {
  minSpeed: 22, maxSpeed: 118, cruise: 62,
  stallSpeed: 30, climbRate: 26, turnRate: 0.85,
  fuelStart: 100, fuelBurn: 0.55,
};
export const MISSION = {
  ringCount: 8, ringRadius: 26,
  parTime: 150,
  cargoBonus: 400,
};
export const COLORS = {
  skyTop: '#2a66c4', skyMid: '#79b4ec', skyLow: '#d7ecfa',
  sun: '#fff3c4',
  water: '#25679f', waterHi: '#57a8d8', waterDeep: '#174a76',
  sand: '#d9c48a', grass: '#5da653', grassDry: '#a8b45c', field: '#7fae4e',
  forest: '#2f6e3e', forestDark: '#245631', rock: '#8a8378', rockDark: '#5f594f', snow: '#f6f9fc', snowShade: '#c9d8ea',
  road: '#6d6a61', roadLine: '#e8e2c8',
  runway: '#343a42', runwayLine: '#eef2f5', runwayEdge: '#ffd76e',
  ring: '#ffb02e', ringNext: '#ffe45e', ringDone: '#58d68a',
  cargo: '#ff8a3d', cargoZone: '#ffcf5e',
  ink: '#0e1a2b', panel: 'rgba(9,20,36,0.9)', panelEdge: '#456b8f',
  hud: '#eef6ff', hudDim: '#a8c8ea', warn: '#ff5d5d', amber: '#ffb02e', ok: '#58d68a',
  planeBody: '#eef3f8', planeShade: '#b9c9d8', planeTrim: '#d64541', planeDark: '#22303f',
  canopy: '#6fb6e8', canopyHi: '#dff3ff',
};
