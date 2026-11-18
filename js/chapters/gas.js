// Chapter 6: three ways to fill a balloon. Hot air (Montgolfier 1783), hydrogen (Charles 1783) and helium, plus the
// Rozière, which pairs a gas cell with a hot-air cell. Lift per cubic metre from the ideal gas law at 101,325 Pa and
// 20 C outside: air 1.204, hydrogen 0.084, helium 0.167 kg/m3, so lift is about 1.12 (hydrogen), 1.04 (helium) and
// 0.26 (air at 100 C) kg per m3. The Rozière split below (helium for 70% of the load) is an illustration, not a design.
import { THREE, M, box, clamp, lerp, makeBalloon, rhoAir, rhoGas, MOLAR, fmt } from '../balloon.js';

const vol = (load, per) => load / per;
const radius = (V) => Math.cbrt((3 * V) / (4 * Math.PI));

const KINDS = {
  hot: { n: 'Hot air', who: 'Montgolfier, 1783', col: '#ff7a59' },
  hydrogen: { n: 'Hydrogen', who: 'Charles, 1783', col: '#8ef0ff' },
  helium: { n: 'Helium', who: 'Since the 1900s', col: '#c49bff' },
  roziere: { n: 'Rozière', who: 'Pilâtre de Rozier, 1785', col: '#ffb547' },
};

const lifts = (st) => {
  const a = rhoAir(20), hot = a - rhoAir(st.tHot), h2 = a - rhoGas(MOLAR.hydrogen, 20), he = a - rhoGas(MOLAR.helium, 20);
  return { hot, h2, he };
};
const volumes = (st) => {
  const L = lifts(st), load = st.load;
  const rozHe = (load * 0.7) / L.he, rozHot = (load * 0.3) / L.hot;
  return { hot: vol(load, L.hot), hydrogen: vol(load, L.h2), helium: vol(load, L.he), rozHe, rozHot };
};

export default {
  id: 'gas',
  short: 'Gas balloons',
  title: 'Hot air or a lighter gas',
  subtitle: 'Hydrogen and helium lift four times more per cubic metre. Hot air needs no gas bottle.',
  view: { pos: [0, 10, 52], target: [0, 9, 0] },
  learn: `<p>In 1783 two kinds of balloon flew within months of each other. The Montgolfier brothers filled theirs with <b>hot air</b>. Jacques Charles filled his with <b>hydrogen</b>, a gas about fourteen times lighter than air, and the gas does not cool. Today the same idea uses <b>helium</b>, which does not burn.</p>
    <p>Per cubic metre, hydrogen lifts about <b>1.1 kg</b> and helium about <b>1.0 kg</b>, against about <b>0.26 kg</b> for 100 °C air. So to carry the same load, a hot air balloon needs a bag around <b>four times bigger</b>. The price of a gas balloon is that its gas is sealed in and cannot be topped up like a flame. The pilot drops ballast to climb and vents gas to descend, so a flight lasts only as long as there is ballast.</p>
    <p>In 1785 Pilâtre de Rozier joined the two: a gas cell above for most of the lift, a small fire below to trim it. The idea, the <b>Rozière balloon</b>, was used again in the 1990s round-the-world flights.</p>
    <p class="tip"><b>Try it:</b> raise the <b>load</b> and compare how big each balloon must be to lift it. Pick a kind to highlight it.</p>
    <p class="note">Hydrogen burns. In 1785 de Rozier and Romain died in a balloon that combined hydrogen and fire.</p>`,
  terms: [
    { t: 'Hydrogen', d: 'The lightest gas, about 0.084 kg per cubic metre at 20 °C. It lifts about 1.1 kg per cubic metre, but it burns.' },
    { t: 'Helium', d: 'The second-lightest gas, about 0.167 kg per cubic metre. It lifts about 1.0 kg per cubic metre and does not burn.' },
    { t: 'Ballast', d: 'Sand or water dropped from a gas balloon to climb. Venting gas to descend uses it up, so it limits the flight.' },
    { t: 'Rozière balloon', d: 'A balloon with a gas cell above and a hot-air cell below, invented by Pilâtre de Rozier.' },
  ],
  defaults: { kind: 'hot', load: 650, tHot: 100 },
  controls: [
    { key: 'kind', type: 'seg', label: 'Highlight', options: Object.entries(KINDS).map(([v, k]) => ({ v, label: k.n })) },
    { key: 'load', type: 'range', label: 'Load to lift (fabric, basket, people)', min: 200, max: 1500, step: 10, fmt: (v) => `${v.toFixed(0)} kg` },
    { key: 'tHot', type: 'range', label: 'Hot-air temperature', min: 60, max: 120, step: 1, fmt: (v) => `${v.toFixed(0)} °C` },
  ],
  quiz: [
    { q: 'Which lifts more per cubic metre?', options: ['Hot air at 100 °C', 'Helium', 'They are equal', 'Cold air'], answer: 1, why: 'Helium lifts about 1.0 kg per cubic metre, hot air only about 0.26 kg.' },
    { q: 'What did the Rozière balloon combine?', options: ['Two burners', 'A gas cell and a hot-air cell', 'A sail and a balloon', 'Two baskets'], answer: 1, why: 'A gas cell supplied most of the lift and a small fire trimmed it, to climb and sink without throwing away so much ballast.' },
    { q: 'Why can a hot-air balloon stay up only as long as it has fuel?', options: ['The air inside cools and must be reheated', 'It leaks gas', 'The basket is heavy', 'It uses ballast'], answer: 0, why: 'Hot air is not sealed in, so it keeps cooling. A gas balloon stays buoyant but only as long as it has ballast.' },
  ],
  reel: [
    { ms: 5000, caption: 'In 1783 a hot air balloon and a hydrogen balloon rose within months of each other.', set: { kind: 'hot', load: 650, tHot: 100 }, anim: { load: [400, 900] }, spin: 0.4 },
  ],
  build({ stage, s }) {
    stage.floor.visible = false;
    const root = new THREE.Group(); stage.root.add(root);
    const items = {};
    const sphereBal = (col) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col, emissiveIntensity: 0.12, transparent: true, opacity: 1 })); m.castShadow = true; g.add(m); g.env = m; g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.1), M.matte(0xa9763e))); return g; };
    const mk = (id, x, build) => { const g = build(); g.position.x = x; root.add(g); const b = box(1.4, 1.0, 1.4, M.matte(0xa9763e)); b.position.set(x, 0.5, 0); root.add(b); const l = stage.label('', [x, -0.7, 0], root); items[id] = { g, l, x }; };
    mk('hot', -13, () => { const g = makeBalloon(); g.setHeat(0.6); return g; });
    mk('hydrogen', -4, () => sphereBal(0x8ef0ff));
    mk('helium', 4, () => sphereBal(0xc49bff));
    mk('roziere', 13, () => { const g = new THREE.Group(); const top = sphereBal(0xffb547), bot = makeBalloon(); g.add(top, bot); g.top = top; g.bot = bot; return g; });
    const ground = box(40, 0.08, 4, M.plastic(0x1d2a26)); ground.position.set(0, 0, 0); root.add(ground);
    return {
      update(dt, st) {
        const V = volumes(st);
        for (const [id, it] of Object.entries(items)) {
          const on = st.kind === id, k = on ? 1 : 0.42;
          let r, y;
          if (id === 'hot') { const R = radius(V.hot), sc = R / 8.7; it.g.scale.setScalar(sc * 0.98); it.g.position.y = 5.7 * sc + 1.0; r = R; }
          else if (id === 'roziere') {
            const Rg = radius(V.rozHe), Rh = radius(V.rozHot), sc = Rh / 8.7;
            it.g.bot.scale.setScalar(sc * 0.98); it.g.bot.position.y = 5.7 * sc + 1.0;
            it.g.top.scale.setScalar(Rg); it.g.top.position.y = 5.7 * sc + 1.0 + Rh * 2.3 + Rg * 0.6;
            it.g.top.env.material.opacity = on ? 1 : 0.4;
          } else { const R = radius(V[id]); it.g.scale.setScalar(R); it.g.position.y = R + 1.9; }
          const mats = []; it.g.traverse((o) => { if (o.material && o.material.transparent !== undefined && o.geometry?.type !== 'BoxGeometry') mats.push(o.material); });
          mats.forEach((m) => { if ('opacity' in m && m.transparent) m.opacity = on ? 1 : 0.55; });
          if (id === 'hot') it.g.envMat.transparent = true, it.g.envMat.opacity = on ? 1 : 0.6;
          it.g.visible = true;
          const info = id === 'roziere' ? `${KINDS[id].n}<br><small>${fmt(V.rozHe)} m³ helium + ${fmt(V.rozHot)} m³ hot air</small>` : `${KINDS[id].n}<br><small>${fmt(V[id])} m³</small>`;
          if (it.l.element.dataset.i !== info) { it.l.element.innerHTML = `<b>${info}</b><br><small>${KINDS[id].who}</small>`; it.l.element.dataset.i = info; }
          it.l.element.style.opacity = on ? 1 : 0.6;
        }
      },
      readout(st) {
        const L = lifts(st), V = volumes(st);
        return `<div class="big">${fmt(V.hot / V.helium, 1)}× bigger for hot air</div><p class="r-say">For ${fmt(st.load)} kg of load, hot air at ${st.tHot.toFixed(0)} °C needs ${fmt(V.hot)} m³, helium only ${fmt(V.helium)} m³.</p>
          <div class="row"><span>Lift per m³: hot air</span><b>${fmt(L.hot, 2)} kg</b></div>
          <div class="row"><span>Lift per m³: hydrogen</span><b>${fmt(L.h2, 2)} kg</b></div>
          <div class="row"><span>Lift per m³: helium</span><b>${fmt(L.he, 2)} kg</b></div>
          <div class="row"><span>Rozière (example split)</span><b>${fmt(V.rozHe + V.rozHot)} m³ total</b></div>`;
      },
    };
  },
};
