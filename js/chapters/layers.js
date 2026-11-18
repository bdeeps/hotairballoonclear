// Chapter 4: steering by layers. A top-down map of where a balloon ends up. The winds are an invented example in
// which the lowest and highest layers blow roughly opposite ways, so a pilot can fly out in one and back in the
// other. Real winds rarely line up this neatly. Distances are straight-line drift at the layer's wind speed.
import { THREE, M, arrow, clamp, lerp, smooth, makeBalloon, LAYERS, windAt, layerAt, compass, speedOf, fmt, COL } from '../balloon.js';

const KM = 1;               // 1 unit = 1 km on the map
const hY = (h) => 0.5 + h / 100 * 0.9;   // slab height in units for altitude h (metres)
const layerOf = (h) => layerAt(h);

// where the balloon is after minutes at A then minutes at B (positions in km east/south)
function track(st) {
  const a = LAYERS[layerOf(st.altA)].u, b = LAYERS[layerOf(st.altB)].u;
  const p1 = [a[0] * st.minA * 60 / 1000, a[1] * st.minA * 60 / 1000];
  const p2 = [p1[0] + b[0] * st.minB * 60 / 1000, p1[1] + b[1] * st.minB * 60 / 1000];
  return [[0, 0], p1, p2];
}

export default {
  id: 'layers',
  short: 'Steering by layers',
  title: 'No steering wheel: pick a layer',
  subtitle: 'A balloon goes where the air goes, so the pilot chooses a height and takes what the wind gives.',
  view: { pos: [9, 9, 17], target: [0, 3.5, 0] },
  learn: `<p>A balloon cannot steer. It floats in the wind, so it drifts at <b>exactly the speed and direction of the air around it</b>, which means the pilot feels no wind at all. All the control it has is up and down.</p>
    <p>That is enough to matter, because wind often changes with height: the <b>layers</b> above can blow a different way. A pilot climbs until the map shows the right direction, and later descends into another layer to turn. In the invented example here, the top layer drifts roughly west and the bottom layer roughly east, so a flight <b>out in one and back in the other</b> comes close to where it started. Real winds are messier, so pilots study forecasts and often cannot go where they want.</p>
    <p class="tip"><b>Try it:</b> press <b>Out and back</b>, then slide <b>Flight progress</b> from start to finish. Move the two altitudes around and see which layers give you a loop.</p>
    <p class="note">The wind layers are a made-up example for teaching. Drift is the layer’s wind speed times the time spent in it.</p>`,
  terms: [
    { t: 'Wind layer', d: 'A band of air moving in its own direction. Winds often turn and strengthen with height.' },
    { t: 'Wind shear', d: 'A change in wind speed or direction with height. It is what gives a balloon pilot choices.' },
    { t: 'Drift', d: 'The balloon’s path over the ground: it moves with the air, so its speed over the ground is the wind speed.' },
    { t: 'Box pattern', d: 'A flight that climbs into one layer, returns through another, and ends near its start.' },
  ],
  defaults: { altA: 550, altB: 50, minA: 20, minB: 20, p: 0.5 },
  controls: [
    { type: 'buttons', label: 'Quick plans', items: [
      { label: 'Out and back', act: (s) => Object.assign(s, { altA: 550, altB: 50, minA: 20, minB: 20 }) },
      { label: 'Stay low', act: (s) => Object.assign(s, { altA: 50, altB: 50, minA: 20, minB: 20 }) },
      { label: 'Go north', act: (s) => Object.assign(s, { altA: 330, altB: 330, minA: 20, minB: 20 }) },
    ] },
    { key: 'altA', type: 'range', label: 'First altitude', min: 20, max: 680, step: 10, fmt: (v) => `${v.toFixed(0)} m` },
    { key: 'minA', type: 'range', label: 'Minutes there', min: 0, max: 45, step: 1, fmt: (v) => `${v.toFixed(0)} min` },
    { key: 'altB', type: 'range', label: 'Second altitude', min: 20, max: 680, step: 10, fmt: (v) => `${v.toFixed(0)} m` },
    { key: 'minB', type: 'range', label: 'Minutes there', min: 0, max: 45, step: 1, fmt: (v) => `${v.toFixed(0)} min` },
    { key: 'p', type: 'range', label: 'Flight progress', min: 0, max: 1, step: 0.005, fmt: (v) => `${Math.round(v * 100)}%` },
  ],
  quiz: [
    { q: 'A balloon floats at 10 m/s with the wind. How much wind does the pilot feel?', options: ['10 m/s', 'A gale', 'Almost none', 'Wind from behind'], answer: 2, why: 'The balloon moves with the air, so there is no relative wind. Flames stay upright and a candle would not flicker.' },
    { q: 'How can a balloon change direction?', options: ['Turn the basket', 'Move to a layer with different wind', 'Use the burner as a jet', 'It cannot'], answer: 1, why: 'Winds often differ with height. Climbing or descending into another layer is the pilot’s only steering.' },
    { q: 'Why can a pilot not simply fly anywhere?', options: ['The law forbids it', 'The wind layers may not blow the wanted way', 'The balloon is too heavy', 'The burner is too weak'], answer: 1, why: 'Pilots can only choose among the winds that exist. On a day when every layer blows the same way, they go that way.' },
  ],
  reel: [
    { ms: 6000, caption: 'A balloon cannot steer. Climb into another layer and you drift another way: out in one, back in the other.', set: { altA: 550, altB: 50, minA: 20, minB: 20, p: 0 }, anim: { p: [0, 1] }, view: { pos: [-7, 9, 15], target: [0, 3, 0] }, spin: 0.3 },
  ],
  build({ stage, s }) {
    stage.floor.visible = false;
    const root = new THREE.Group(); stage.root.add(root);
    // ground map: a square with a grid, 14 km on a side
    const S = 14;
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(S, S), M.plastic(0x1d2d27, { roughness: 1 })); gm.rotation.x = -Math.PI / 2; gm.receiveShadow = true; root.add(gm);
    const grid = new THREE.GridHelper(S, S, 0x3b5a4a, 0x2a3f35); grid.position.y = 0.01; root.add(grid);
    stage.label('Launch', [0, 0.35, 0], root);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 10), M.glow(0xffb547)); pin.position.y = 0.3; root.add(pin);
    // layer slabs with arrows
    const slabs = LAYERS.map((l, i) => {
      const y0 = hY(l.from) + 0.5, y1 = hY(l.to) + 0.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(S, y1 - y0 - 0.08, S), M.ghost(l.col, 0.06)); m.position.y = (y0 + y1) / 2; root.add(m);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: l.col, transparent: true, opacity: 0.35 })); m.add(edge);
      const ar = arrow(l.col, speedOf(l.u) * 0.8, 0.4, 0.05);
      ar.rotation.z = -Math.PI / 2; ar.rotation.y = 0;
      const pivot = new THREE.Group(); pivot.add(ar); pivot.position.set(-S / 2 + 1.0, m.position.y, -S / 2 + 1.0);
      pivot.rotation.y = Math.atan2(-l.u[1], l.u[0]);
      root.add(pivot);
      const c = '#' + new THREE.Color(l.col).getHexString();
      stage.label(`<span style="color:${c}">${l.from}–${l.to} m</span> · ${compass(l.u)}, ${speedOf(l.u).toFixed(1)} m/s`, [-S / 2 + 1.0, m.position.y + 0.55, -S / 2 + 1.0], root);
      return { m, ar };
    });
    // the balloon token and the track
    const bal = makeBalloon(); bal.scale.setScalar(0.045); root.add(bal);
    const tp = new Float32Array(3 * 3 * 60), tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    const tr = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xa3e635 })); tr.frustumCulled = false; root.add(tr);
    const sh = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xa3e635, transparent: true, opacity: 0.35 })); sh.frustumCulled = false; root.add(sh);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), M.glow(0xa3e635)); root.add(dot);
    const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); root.add(drop);
    const endLbl = stage.label('Lands about here', [0, 0.3, 0], root, 'lbl-hot');
    let cur = { p: [0, 0], h: 50 };
    const pathAt = (st, q) => {
      const T = track(st), tot = st.minA + st.minB || 1, f = q * tot;
      const fa = Math.min(f, st.minA), fb = Math.max(0, f - st.minA);
      const a = LAYERS[layerOf(st.altA)].u, b = LAYERS[layerOf(st.altB)].u;
      const x = (a[0] * fa + b[0] * fb) * 60 / 1000, z = (a[1] * fa + b[1] * fb) * 60 / 1000;
      const h = f <= st.minA ? st.altA : st.altB;
      return { x, z, h };
    };
    return {
      update(dt, st) {
        const T = track(st), pts = [];
        // ground track in 3 segments, sampled by drawing the polyline in the plane
        const arr = [[0, 0.04, 0], [T[1][0], 0.04, T[1][1]], [T[2][0], 0.04, T[2][1]]];
        arr.forEach((p, i) => tp.set(p, i * 3)); tg.setDrawRange(0, 3); tg.attributes.position.needsUpdate = true;
        const at = pathAt(st, st.p);
        cur.h = lerp(cur.h, at.h, 1 - Math.exp(-4 * dt));
        const y = hY(cur.h) + 0.5;
        bal.position.set(at.x, y + 0.04 * 5.6, at.z);
        dot.position.set(at.x, 0.12, at.z);
        drop.geometry.setFromPoints([new THREE.Vector3(at.x, 0.12, at.z), new THREE.Vector3(at.x, y, at.z)]);
        endLbl.position.set(T[2][0], 0.35, T[2][1]);
        const here = layerOf(cur.h);
        slabs.forEach((sl, i) => { sl.m.material.opacity = i === here ? 0.2 : 0.06; });
        bal.setHeat(0.6); bal.setFlame(0);
      },
      readout(st) {
        const T = track(st), d = Math.hypot(T[2][0], T[2][1]);
        const at = pathAt(st, st.p), L = layerOf(at.h), u = LAYERS[L].u;
        const back = d < 1.2 && st.minA + st.minB > 10;
        return `<div class="big">Ends ${d.toFixed(1)} km from launch</div><p class="r-say">${back ? 'A box pattern: it comes back close to where it began.' : `Now in the ${LAYERS[L].from}–${LAYERS[L].to} m layer, going ${compass(u)}.`}</p>
          <div class="row"><span>Now at</span><b>${fmt(at.h)} m, ${compass(u)}</b></div>
          <div class="row"><span>Speed over the ground</span><b>${speedOf(u).toFixed(1)} m/s (${(speedOf(u) * 3.6).toFixed(0)} km/h)</b></div>
          <div class="row"><span>Flight time</span><b>${st.minA + st.minB} min</b></div>
          <div class="row"><span>Straight-line distance so far</span><b>${Math.hypot(at.x, at.z).toFixed(1)} km</b></div>`;
      },
    };
  },
};
