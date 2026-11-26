// Keyboard + mouse input. Keys are tracked as a set; the mouse steers while held.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this.pressed = new Set(); // edge-triggered, cleared each frame
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.key)) this.pressed.add(e.key);
      this.keys.add(e.key);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key));
    canvas.addEventListener('mousedown', (e) => { this.mouse.down = true; this.mouse.x = e.offsetX; this.mouse.y = e.offsetY; });
    addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.offsetX; this.mouse.y = e.offsetY; });
  }
  down(...names) { return names.some((n) => this.keys.has(n)); }
  hit(...names) { return names.some((n) => this.pressed.has(n)); }
  endFrame() { this.pressed.clear(); }
  // -1..1 control axes for the flight model.
  axes(canvas) {
    let pitch = 0, roll = 0, throttle = 0;
    if (this.down('ArrowUp', 'w', 'W')) pitch += 1;
    if (this.down('ArrowDown', 's', 'S')) pitch -= 1;
    if (this.down('ArrowLeft', 'a', 'A')) roll -= 1;
    if (this.down('ArrowRight', 'd', 'D')) roll += 1;
    if (this.down('Shift')) throttle += 1;
    if (this.down('Control', 'c', 'C')) throttle -= 1;
    if (this.mouse.down) {
      roll += (this.mouse.x / canvas.width - 0.5) * 2.2;
      pitch += (0.5 - this.mouse.y / canvas.height) * 2.2;
    }
    const cl = (v) => Math.max(-1, Math.min(1, v));
    return { pitch: cl(pitch), roll: cl(roll), throttle };
  }
}
