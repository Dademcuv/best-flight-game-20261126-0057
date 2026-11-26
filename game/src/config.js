// Skyline Courier — tuning constants shared by physics, world and render.
export const VIEW = { w: 1280, h: 720, fov: 1.9 }; // fov: focal length scale factor
export const WORLD = {
  size: 24000,          // playable square, metres
  waterLevel: 4,
  runway: { x: 0, z: -2600, length: 900, width: 46, heading: 0 }, // heading 0 = north (-z)
};
export const PLANE = {
  minSpeed: 22, maxSpeed: 118, cruise: 62,
  stallSpeed: 30, climbRate: 26, turnRate: 0.85,
  fuelStart: 100, fuelBurn: 0.55,
};
export const MISSION = {
  ringCount: 8, ringRadius: 26,
  parTime: 150,
};
export const COLORS = {
  skyTop: '#2e6fd8', skyMid: '#7db8ee', skyLow: '#cfe8f7',
  sun: '#fff3c4',
  water: '#2b6ea8', waterHi: '#4d94c9',
  sand: '#d9c48a', grass: '#5da653', grassDry: '#8fae4e',
  forest: '#3e7d46', rock: '#8a8378', rockDark: '#6b655b', snow: '#f4f7fa',
  runway: '#3c4148', runwayLine: '#e8ecf0',
  ring: '#ffb02e', ringNext: '#ffe45e', ringDone: '#58d68a',
  ink: '#0e1a2b', panel: 'rgba(10,22,38,0.88)', panelEdge: '#3d5a7a',
  hud: '#eaf4ff', hudDim: '#9fc3e8', warn: '#ff5d5d', ok: '#58d68a',
  planeBody: '#e8eef4', planeTrim: '#d64541', planeDark: '#22303f',
};
