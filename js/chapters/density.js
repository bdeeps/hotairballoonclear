// Chapter 1: hot air is lighter air. Two open-bottomed cubes at the same pressure. Heat the air in one and its
// molecules move faster, push each other apart, and some leave through the open bottom, so fewer remain.
// Ideal gas law, density = P / (R T), with P = 101,325 Pa and R = 287.05 J/(kg K) for dry air:
// 20 C gives 1.204 kg/m3, 100 C gives 0.946 kg/m3, a difference of about 0.26 kg per cubic metre.
import { THREE, M, swarm, clamp, lerp, rhoAir, K, fmt, liftPerM3, COL } from '../balloon.js';

const N = 300, HALF = 1.5;

export default {
  id: 'density',
  short: 'Hot air is lighter',
  title: 'Hot air is lighter air',
  subtitle: 'Heat spreads the molecules out, so a cubic metre holds less air.',
  view: { pos: [0, 2.6, 13.5], target: [-1.2, 1.7, 0] },
  learn: `<p>Air is a gas: a crowd of molecules (mostly nitrogen and oxygen) flying about and bumping into each other. In a room at <b>20 °C</b> a cubic metre of it weighs about <b>1.2 kilograms</b>. Heat that air and the molecules move faster. They push each other further apart, and if the container is open at the bottom, the extra ones simply drift out.</p>
    <p>So the same cubic metre now holds <b>fewer molecules</b>, and weighs less. The ideal gas law puts a number on it: at the same pressure, density is proportional to <b>1 ÷ temperature</b>, measured from absolute zero (the kelvin scale). Air at 100 °C weighs about <b>0.95 kg per m³</b>, roughly a quarter of a kilogram less than cool air.</p>
    <p class="tip"><b>Try it:</b> drag <b>Temperature inside</b> up and watch molecules leave the right cube and speed up. The readout does the sum live.</p>
    <p class="note">The drawing shows a few hundred molecules to stand for the trillions in a real cube. Counts are scaled, not literal.</p>`,
  terms: [
    { t: 'Density', d: 'Mass per volume. Air near the ground is about 1.2 kg per cubic metre at 20 °C.' },
    { t: 'Ideal gas law', d: 'For a gas at steady pressure, density falls as absolute temperature rises: ρ = P ÷ (R × T).' },
    { t: 'Kelvin', d: 'Temperature counted from absolute zero. Add 273.15 to a Celsius reading.' },
    { t: 'Open envelope', d: 'A balloon whose mouth is open at the bottom, so its air stays at the same pressure as the air outside.' },
  ],
  defaults: { tIn: 20, tOut: 20 },
  controls: [
    { key: 'tIn', type: 'range', label: 'Temperature inside (right cube)', min: 20, max: 120, step: 1, fmt: (v) => `${v.toFixed(0)} °C` },
    { key: 'tOut', type: 'range', label: 'Outside air (left cube)', min: -10, max: 35, step: 1, fmt: (v) => `${v.toFixed(0)} °C` },
  ],
  quiz: [
    { q: 'Why does a cube of hot air weigh less than a cube of cool air at the same pressure?', options: ['The molecules get lighter', 'Fewer molecules fit inside', 'Heat has negative weight', 'Hot air is mostly helium'], answer: 1, why: 'Hot molecules move faster and spread out. In an open container some leave, so fewer remain in the same volume.' },
    { q: 'About how much does a cubic metre of air at 20 °C weigh?', options: ['0.012 kg', '1.2 kg', '12 kg', '120 kg'], answer: 1, why: 'Dry air at sea level and 20 °C is about 1.2 kg per cubic metre, from the ideal gas law.' },
    { q: 'Roughly how much lift does each cubic metre of 100 °C air give in 20 °C surroundings?', options: ['0.26 kg (about a quarter of a kilo)', '2.6 kg', '26 kg', 'None'], answer: 0, why: 'About 1.20 minus 0.95 kg per cubic metre. That is why a balloon has to be so huge.' },
  ],
  reel: [
    { ms: 5000, caption: 'Air is a crowd of molecules. Heat them and they spread out.', set: { tIn: 20, tOut: 20 }, anim: { tIn: [20, 100] }, view: { pos: [0, 2.2, 9.5], target: [0, 1.6, 0] }, spin: 0 },
    { ms: 4600, caption: 'The same cubic metre now holds about a quarter-kilo less air.', set: { tIn: 100, tOut: 20 }, view: { pos: [0, 2.2, 8], target: [0, 1.6, 0] }, spin: 0 },
  ],
  build({ stage, s }) {
    stage.floor.visible = false;
    const root = new THREE.Group(); stage.root.add(root);
    const make = (cx, open) => {
      const g = new THREE.Group(); g.position.set(cx, HALF + 0.2, 0); root.add(g);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)), new THREE.LineBasicMaterial({ color: open ? 0xff7a59 : 0x8ef0ff, transparent: true, opacity: 0.8 }));
      g.add(edges);
      const faces = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2), M.ghost(open ? 0xff7a59 : 0x8ef0ff, 0.05));
      g.add(faces);
      const sw = swarm(N, new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      sw.castShadow = false; sw.frustumCulled = false; g.add(sw);
      const P = Array.from({ length: N }, (_, i) => ({ p: [(Math.random() * 2 - 1) * (HALF - 0.1), (Math.random() * 2 - 1) * (HALF - 0.1), (Math.random() * 2 - 1) * (HALF - 0.1)], d: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), sc: 1 }));
      return { g, sw, P, open };
    };
    const A = make(-2.6, false), B = make(2.6, true);
    // open-bottom marker for the right cube
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), M.ghost(0x07080c, 0.0)); mouth.visible = false;
    stage.label('Outside air', [-2.6, HALF * 2 + 0.6, 0], root);
    stage.label('Air inside · open at the bottom', [2.6, HALF * 2 + 0.6, 0], root);
    stage.label('1 m³ · same pressure', [0, 0.05, 0], root);
    const cold = new THREE.Color(0x8ef0ff), hot = new THREE.Color(0xff7a59), tmp = new THREE.Color();
    const frac = (t) => clamp((t - 0) / 120, 0, 1);

    return {
      update(dt, st) {
        const dens0 = rhoAir(st.tOut), dens1 = rhoAir(st.tIn);
        for (const box of [A, B]) {
          const t = box === A ? st.tOut : st.tIn;
          const want = Math.round(N * (rhoAir(t) / rhoAir(-10)) * 0.62 + 0);   // scale so -10 C is a full-ish cube
          const speed = 1.6 * Math.sqrt(K(t) / K(20));
          tmp.copy(cold).lerp(hot, frac(t));
          box.sw.material.color.setScalar(1);
          for (let i = 0; i < N; i++) {
            const q = box.P[i], on = i < want;
            q.sc = lerp(q.sc, on ? 1 : 0, 1 - Math.exp(-6 * dt));
            if (on) {
              for (let k = 0; k < 3; k++) { q.p[k] += q.d.getComponent(k) * speed * dt; if (q.p[k] > HALF - 0.08) { q.p[k] = HALF - 0.08; q.d.setComponent(k, -Math.abs(q.d.getComponent(k))); } if (q.p[k] < -HALF + 0.08) { q.p[k] = -HALF + 0.08; q.d.setComponent(k, Math.abs(q.d.getComponent(k))); } }
            } else if (box.open) q.p[1] -= dt * 1.4 * (q.sc > 0.02 ? 1 : 0);
            else q.p[1] = clamp(q.p[1], -HALF + 0.08, HALF - 0.08);
            if (box.open && !on && q.p[1] < -HALF - 1.1) q.sc = 0;
            box.sw.place(i, q.p, null, q.sc * (box.open && !on ? 0.8 : 1));
            box.sw.setColorAt(i, tmp);
          }
          box.sw.instanceColor.needsUpdate = true; box.sw.done();
          // molecules that have just been pushed out re-enter at the top once they are hidden
          for (let i = 0; i < N; i++) if (box.open && i < want && box.P[i].p[1] < -HALF) box.P[i].p[1] = HALF - 0.1;
        }
        void dens0; void dens1;
      },
      readout(st) {
        const a = rhoAir(st.tOut), b = rhoAir(st.tIn), d = a - b;
        return `<div class="big">${fmt(d, 3)} kg of lift per m³</div><p class="r-say">${d < 0.005 ? 'Same temperature in and out: nothing to lift.' : `Each cubic metre of the hot air is ${(d / a * 100).toFixed(0)}% lighter than the outside air.`}</p>
          <div class="row"><span>Outside air, ${st.tOut.toFixed(0)} °C</span><b>${fmt(a, 3)} kg/m³</b></div>
          <div class="row"><span>Air inside, ${st.tIn.toFixed(0)} °C</span><b>${fmt(b, 3)} kg/m³</b></div>
          <div class="row"><span>Molecules per m³, inside vs outside</span><b>${(b / a * 100).toFixed(0)}%</b></div>
          <div class="row"><span>Lift from a 2,800 m³ envelope</span><b>${fmt(d * 2800)} kg</b></div>`;
      },
    };
  },
};
