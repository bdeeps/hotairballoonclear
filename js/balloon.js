// Shared parts for HotAirBalloonClear: air and gas physics, a made-up wind profile, and a balloon
// you can heat, vent and burn. All lengths in the balloon model are metres; callers scale the group.
import { THREE, M, sphere, box, beam, canvasTexture, clamp, lerp, smooth } from './kit.js';

export * from "./kit.js";
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const COL = { hot: 0xff7a59, amber: 0xffb547, cyan: 0x8ef0ff, violet: 0xc49bff, lime: 0xa3e635, blue: 0x7aa2ff, silk: 0xe9eef8 };

// ---------------------------------------------------------------- physics
// Ideal gas law: density = pressure x molar mass / (gas constant x temperature).
export const P0 = 101325;            // sea-level pressure, Pa
export const R_AIR = 287.05;         // specific gas constant of dry air, J/(kg K)
export const R_GAS = 8.314;          // J/(mol K)
export const G = 9.81;
export const MOLAR = { air: 0.028964, hydrogen: 0.002016, helium: 0.004003 };   // kg/mol
export const K = (c) => c + 273.15;
export const rhoAir = (tc, p = P0) => p / (R_AIR * K(tc));
export const rhoGas = (kgmol, tc, p = P0) => (p * kgmol) / (R_GAS * K(tc));
// A simple atmosphere: temperature falls 6.5 degrees per kilometre, pressure follows.
export function atmos(h, t0 = 15) {
  const T = t0 - 0.0065 * h;
  const P = P0 * Math.pow(K(T) / K(t0), 5.2559);
  return { T, P, rho: rhoAir(T, P) };
}
// Lift per cubic metre of envelope, in kg, for air at tIn inside and tOut outside.
export const liftPerM3 = (tIn, tOut = 20) => rhoAir(tOut) - rhoAir(tIn);
export const fmt = (v, d = 0) => v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });

// A made-up but typical wind profile: each layer blows a different way. [east, south] in m/s.
export const LAYERS = [
  { from: 0, to: 100, u: [3, 0.5], col: 0xa3e635 },
  { from: 100, to: 250, u: [2.5, -2.5], col: 0x8ef0ff },
  { from: 250, to: 420, u: [0, -4], col: 0xc49bff },
  { from: 420, to: 700, u: [-4.5, -0.5], col: 0xffb547 },
];
const BLEND = 25;
export function windAt(h) {
  let u0 = LAYERS[0].u[0], u1 = LAYERS[0].u[1];
  for (let i = 1; i < LAYERS.length; i++) {
    const k = smooth((h - (LAYERS[i].from - BLEND / 2)) / BLEND);
    u0 = lerp(u0, LAYERS[i].u[0], k); u1 = lerp(u1, LAYERS[i].u[1], k);
  }
  return [u0, u1];
}
export const layerAt = (h) => Math.max(0, LAYERS.findIndex((l) => h < l.to) < 0 ? LAYERS.length - 1 : LAYERS.findIndex((l) => h < l.to));
const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compass = (u) => POINTS[((Math.round(Math.atan2(u[0], -u[1]) / (Math.PI / 4)) % 8) + 8) % 8];
export const speedOf = (u) => Math.hypot(u[0], u[1]);

// A sport balloon in the 2,000 to 3,000 m3 range, used by the flight chapters.
export const BALLOON = { V: 2800, mEnv: 140, mBasket: 130, mPerson: 80, tMax: 120 };
// Propane use: a burner of about 2.5 MW (burners are roughly 2 to 3 MW) divided by propane energy of roughly 46 MJ per kilogram.
export const BURNER_KG_PER_S = 0.055;

// One balloon flight. Heat in, heat out, lift, a laggy climb, and the wind layers.
export class Flight {
  constructor(o = {}) { this.cfg = { V: BALLOON.V, tAmb: 15, mass: 600, ...o }; this.reset(); }
  reset({ alt = 0, T = 60, vz = 0, fuel = 60, mass } = {}) {
    if (mass) this.cfg.mass = mass;
    Object.assign(this, { alt, T, vz, x: 0, z: 0, vx: 0, vy: 0, t: 0, burnS: 0, fuel0: fuel, touch: null, onGround: alt <= 0, blast: 0, ventT: 0, hist: [] });
    this.hover = this.hoverTemp();
  }
  air() { return atmos(this.alt, this.cfg.tAmb); }
  // Envelope temperature at which lift equals weight at this height.
  hoverTemp(h = this.alt) {
    const a = atmos(h, this.cfg.tAmb), rhoIn = a.rho - this.cfg.mass / this.cfg.V;
    return a.P / (R_AIR * rhoIn) - 273.15;
  }
  netLift() {
    const a = this.air(), rhoIn = a.P / (R_AIR * K(this.T));
    return this.cfg.V * (a.rho - rhoIn) - this.cfg.mass;   // kg
  }
  step(dt, { burn = false, vent = false } = {}) {
    const a = this.air();
    if (this.blast > 0) { burn = true; this.blast -= dt; }
    if (this.ventT > 0) { vent = true; this.ventT -= dt; }
    if (burn && this.fuelLeft() > 0) { this.T += 1.1 * dt; this.burnS += dt; }
    this.T -= (this.T - a.T) * dt / 420;                        // the fabric leaks heat all the time
    if (vent) this.T -= (this.T - a.T) * dt / 55;               // the parachute valve lets hot air out
    this.T = clamp(this.T, a.T, 135);
    const F = this.netLift() * G, vt = Math.sign(F) * Math.sqrt(Math.abs(F) / 70);   // drag balances lift
    this.vz += (clamp(vt, -9, 9) - this.vz) * (1 - Math.exp(-dt / 4));              // the big envelope is slow to respond
    this.alt += this.vz * dt;
    if (this.alt <= 0) {
      if (this.vz < -0.05 && !this.onGround) this.touch = { v: -this.vz, h: Math.hypot(this.vx, this.vy), t: this.t };
      this.alt = 0; if (this.vz < 0) this.vz = 0; this.onGround = true;
    } else this.onGround = false;
    const w = windAt(this.alt), kk = 1 - Math.exp(-dt / 8);
    if (this.onGround) { this.vx *= Math.exp(-dt / 2); this.vy *= Math.exp(-dt / 2); }
    else { this.vx += (w[0] - this.vx) * kk; this.vy += (w[1] - this.vy) * kk; }
    this.x += this.vx * dt; this.z += this.vy * dt;
    this.t += dt;
  }
  fuelLeft() { return Math.max(0, this.fuel0 - this.burnS * BURNER_KG_PER_S); }
}

// ---------------------------------------------------------------- the balloon
// Origin at the mouth of the envelope. Y is up, the basket hangs below.
export function makeBalloon({ colors = ['#ff7a59', '#ffb547', '#f4f1e8', '#7aa2ff'], gores = 16, R = 8.7 } = {}) {
  const g = new THREE.Group();
  const pts = [new THREE.Vector2(0.27 * R, 0)];
  const A0 = -1.22, N = 44;
  for (let i = 0; i <= N; i++) { const a = A0 + (i / N) * (Math.PI / 2 - A0); pts.push(new THREE.Vector2(Math.max(0, R * Math.cos(a)), R * 1.18 + R * 1.08 * Math.sin(a))); }
  const stripes = canvasTexture(512, 64, (c, w, h) => {
    const per = w / gores;
    for (let i = 0; i < gores; i++) { c.fillStyle = colors[i % colors.length]; c.fillRect(i * per, 0, per + 1, h); }
    c.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 0; i < gores; i++) c.fillRect(i * per, 0, 2, h);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(0, h * 0.05, w, 3);
  });
  stripes.tex.wrapS = THREE.RepeatWrapping;
  const envMat = new THREE.MeshStandardMaterial({ map: stripes.tex, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, emissive: 0xff5a1f, emissiveIntensity: 0 });
  const env = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), envMat);
  env.castShadow = true;
  g.add(env);
  const top = R * 2.26;
  // parachute valve at the crown: a disc that lifts at one edge when you pull the line
  const pivot = new THREE.Group(); pivot.position.set(-R * 0.2, top - 0.05 * R, 0);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.2, 0.08, 28), new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.6, side: THREE.DoubleSide }));
  disc.position.x = R * 0.2; pivot.add(disc); g.add(pivot);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(R * 0.18, 24), M.glow(0x07080c, { side: THREE.DoubleSide }));
  hole.rotation.x = -Math.PI / 2; hole.position.set(0, top - 0.06 * R, 0); hole.visible = false; g.add(hole);
  // burner frame, flame, basket, cylinders and cables
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 28), M.metal(0xb9bec8)); frame.rotation.x = Math.PI / 2; frame.position.y = -1.9; g.add(frame);
  const flame = new THREE.Group();
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.34, 2.6, 18), M.glow(0xff8a2a, { transparent: true, opacity: 0.78 })); f1.position.y = 1.3;
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.6, 14), M.glow(0xffe9a0, { transparent: true, opacity: 0.95 })); f2.position.y = 0.8;
  flame.add(f1, f2); flame.position.y = -1.85; flame.visible = false; g.add(flame);
  const basket = box(1.5, 1.15, 1.5, M.matte(0xa9763e, { roughness: 0.9 })); basket.position.y = -5.1; g.add(basket);
  const rim = box(1.62, 0.1, 1.62, M.matte(0x6e4a22)); rim.position.y = -4.55; g.add(rim);
  for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    g.add(beam([x, -4.55, z], [x * 0.5, -1.9, z * 0.5], 0.025, M.metal(0xd7dbe3)));
    g.add(beam([x * 0.5, -1.9, z * 0.5], [x * 1.6, 0.05, z * 1.6], 0.02, M.metal(0xd7dbe3)));
  }
  for (const s of [-1, 1]) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.95, 18), M.metal(0xc8ccd6, { roughness: 0.35 })); cyl.position.set(s * 0.95, -4.95, 0); cyl.castShadow = true; g.add(cyl);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, 7, 0, Math.PI / 2), M.metal(0xc8ccd6)); cap.position.set(s * 0.95, -4.47, 0); g.add(cap);
  }
  g.userData = { top, R, mouth: 0, basketY: -5.1 };
  g.setHeat = (k) => { envMat.emissiveIntensity = clamp(k, 0, 1) * 0.42; };
  g.setFlame = (k, t = 0) => { flame.visible = k > 0.02; const f = 1 + Math.sin(t * 38) * 0.08 + Math.sin(t * 61) * 0.05; flame.scale.set(1, Math.max(0.01, k) * f, 1); };
  g.setVent = (k) => { pivot.rotation.z = clamp(k, 0, 1) * 0.95; hole.visible = k > 0.15; };
  g.envMat = envMat;
  return g;
}
