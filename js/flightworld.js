// A small landscape and a flying balloon, shared by the flight chapters. 1 world unit = 20 m.
// The world slides past a balloon that stays near the origin, so lights and shadows stay put.
import { THREE, M, canvasTexture, clamp, lerp, makeBalloon, Flight, LAYERS, windAt, rng, compass, speedOf, atmos, rhoAir } from './balloon.js';

export const U = 0.05;             // world units per metre
const SHOW = 3;                    // the balloon is drawn three times larger than life so it reads from far away
const SIZE = 600;                  // ground plane size in units
const SKY = 0x0f1a2e;

export function flightWorld({ stage, s, cfg = {}, start = {}, layers = true }) {
  stage.floor.visible = false;
  stage.scene.background = new THREE.Color(SKY);
  stage.scene.fog = new THREE.Fog(SKY, 60, 240);
  const world = new THREE.Group(); stage.root.add(world);
  const flight = new Flight(cfg); flight.reset(start);
  // ground: patchwork fields, a river and a road, tiled
  const rand = rng(7);
  const ground = canvasTexture(1024, 1024, (c, w, h) => {
    c.fillStyle = '#243b2f'; c.fillRect(0, 0, w, h);
    const tones = ['#2b4a36', '#35553a', '#3f5e3d', '#4c5f3a', '#5a6b3c', '#2f4a3f', '#6a6a44'];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const jx = (rand() - 0.5) * 28, jy = (rand() - 0.5) * 28;
      c.fillStyle = tones[Math.floor(rand() * tones.length)];
      c.fillRect(x * 128 + 4 + jx * 0.2, y * 128 + 4 + jy * 0.2, 120, 120);
      c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2;
      for (let l = 0; l < 6; l++) { const yy = y * 128 + 14 + l * 20; c.beginPath(); c.moveTo(x * 128 + 6, yy); c.lineTo(x * 128 + 122, yy); c.stroke(); }
    }
    c.strokeStyle = '#2d5a7a'; c.lineWidth = 22; c.lineCap = 'round'; c.beginPath(); c.moveTo(-20, 800); c.bezierCurveTo(300, 700, 500, 980, 1060, 840); c.stroke();
    c.strokeStyle = '#6b5a45'; c.lineWidth = 8; c.beginPath(); c.moveTo(0, 256); c.lineTo(1024, 256); c.moveTo(512, 0); c.lineTo(512, 1024); c.stroke();
  });
  ground.tex.wrapS = ground.tex.wrapT = THREE.RepeatWrapping; ground.tex.repeat.set(SIZE / 20, SIZE / 20); ground.tex.anisotropy = 8;
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshStandardMaterial({ map: ground.tex, roughness: 1 }));
  gm.rotation.x = -Math.PI / 2; gm.receiveShadow = false; world.add(gm);
  // launch field marker: a post with a flag
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), M.metal(0xffffff)); post.position.y = 0.8; world.add(post);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), M.glow(0xffb547, { side: THREE.DoubleSide })); flag.position.set(0.32, 1.4, 0); post.add(flag); flag.position.y = 0.6;
  stage.label('Launch field', [0, 2.1, 0], world);
  // the balloon
  const balloon = makeBalloon(); balloon.scale.setScalar(U * SHOW); world.add(balloon);
  // wind layers: faint streaks that travel with the wind
  const N = 90, pos = new Float32Array(N * 6), col = new Float32Array(N * 6);
  const sd = [];
  for (let i = 0; i < N; i++) {
    const L = i % LAYERS.length, l = LAYERS[L];
    sd.push({ L, x: (rand() - 0.5) * 70, z: (rand() - 0.5) * 70, y: lerp(l.from + 12, l.to - 12, rand()) * U });
    const c = new THREE.Color(l.col);
    for (let k = 0; k < 2; k++) { col.set([c.r, c.g, c.b], i * 6 + k * 3); }
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }));
  streaks.frustumCulled = false; streaks.visible = layers; world.add(streaks);
  const labels = [];
  const lblGroup = new THREE.Group(); world.add(lblGroup);
  LAYERS.forEach((l, i) => {
    const c = '#' + new THREE.Color(l.col).getHexString();
    labels.push(stage.label(`<span style="color:${c}">${l.from}–${l.to} m</span> · drifts ${compass(l.u)}, ${speedOf(l.u).toFixed(1)} m/s`, [0, (l.from + l.to) / 2 * U, 0], lblGroup));
    labels[i].element.style.display = layers ? '' : 'none';
    // a thin line at the boundary above each layer
  });
  const bounds = LAYERS.slice(1).map((l) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M.ghost(l.col, 0.045)); m.rotation.x = -Math.PI / 2; m.position.y = l.from * U; m.visible = layers; world.add(m); return m; });
  // trail
  const TN = 1400, tp = new Float32Array(TN * 3), tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setDrawRange(0, 0);
  const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xa3e635, transparent: true, opacity: 0.9 })); trail.frustumCulled = false; world.add(trail);
  let tc = 0, lastT = -9;
  const addTrail = () => { if (tc >= TN) { tp.copyWithin(0, 3); tc = TN - 1; } tp.set([flight.x * U, flight.alt * U + 1, flight.z * U], tc * 3); tc++; tg.setDrawRange(0, tc); tg.attributes.position.needsUpdate = true; };
  const clearTrail = () => { tc = 0; lastT = -9; tg.setDrawRange(0, 0); };

  const api = {
    flight, balloon, world, clearTrail,
    reset(o = {}) { flight.reset({ T: 60, ...start, ...o }); clearTrail(); },
    // advance the flight by real time dt (seconds); s.speed is the time-lapse factor
    update(dt, st, time) {
      const sim = dt * (st.speed || 1), n = Math.max(1, Math.ceil(sim / 0.1));
      flight.cfg.tAmb = st.tAmb ?? flight.cfg.tAmb;
      if (st.mass !== undefined) flight.cfg.mass = st.mass;
      for (let i = 0; i < n; i++) {
        flight.step(sim / n, { burn: !!st.burner, vent: !!st.vent });
        if (flight.t - lastT > 2) { lastT = flight.t; addTrail(); }
      }
      const by = flight.alt * U;
      world.position.set(-flight.x * U, -by - 2.3, -flight.z * U);
      gm.position.set(flight.x * U, 0, flight.z * U);
      ground.tex.offset.set((flight.x * U) / 20 - 0.0, (-flight.z * U) / 20);
      balloon.position.set(flight.x * U, by + 0.85, flight.z * U);   // the basket floor touches the ground at altitude 0
      const burning = !!st.burner || flight.blast > 0;
      balloon.setFlame(burning && flight.fuelLeft() > 0 ? 1 : 0, time || 0);
      balloon.setVent(st.vent || flight.ventT > 0 ? 1 : 0);
      balloon.setHeat(clamp((flight.T - 40) / 80, 0, 1));
      // wind streaks
      const dts = sim;
      for (let i = 0; i < N; i++) {
        const d = sd[i], u = LAYERS[d.L].u;
        d.x += u[0] * U * dts; d.z += u[1] * U * dts;
        const px = flight.x * U, pz = flight.z * U;
        if (d.x - px > 35) d.x -= 70; if (d.x - px < -35) d.x += 70;
        if (d.z - pz > 35) d.z -= 70; if (d.z - pz < -35) d.z += 70;
        const len = Math.max(0.6, speedOf(u) * 0.35) / Math.max(0.01, speedOf(u)), a = i * 6;
        pos[a] = d.x; pos[a + 1] = d.y; pos[a + 2] = d.z;
        pos[a + 3] = d.x - u[0] * len; pos[a + 4] = d.y; pos[a + 5] = d.z - u[1] * len;
      }
      sg.attributes.position.needsUpdate = true;
      lblGroup.position.set(flight.x * U + 5.5, 0, flight.z * U);
    },
  };
  return api;
}
