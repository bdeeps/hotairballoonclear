// Chapter 2: Archimedes in air. The air a balloon pushes aside weighs V x (outside density). The hot air inside,
// the fabric, basket, burner, fuel and people weigh less than that, and the difference is the lift.
// Masses are typical, not exact: a sport envelope of 2,000 to 3,000 m3 has fabric of very roughly 100 to 200 kg;
// the basket, frame, burners and empty cylinders about 100 to 200 kg; people about 80 kg each.
import { THREE, M, box, arrow, clamp, lerp, makeBalloon, rhoAir, fmt, COL } from '../balloon.js';

const PER = 700;   // kilograms per unit of column height
const SLABS = [
  ['air', 'Hot air inside', 0xff7a59],
  ['env', 'Envelope fabric', 0xffb547],
  ['gear', 'Basket, burner, cylinders', 0x8f9bb5],
  ['fuel', 'Propane', 0xc49bff],
  ['crew', 'Pilot and passengers', 0x7aa2ff],
];

const budget = (s) => {
  const a = rhoAir(s.tOut), b = rhoAir(s.tIn), V = s.V;
  const m = { air: b * V, env: 0.05 * V, gear: 130, fuel: s.fuel, crew: s.people * 80 };
  const sum = Object.values(m).reduce((x, y) => x + y, 0);
  return { a, b, V, push: a * V, lift: (a - b) * V, m, sum, net: a * V - sum, load: sum - m.air };
};

export default {
  id: 'buoyancy',
  short: 'The lift budget',
  title: 'The lift budget',
  subtitle: 'Archimedes in air: the balloon floats when the air it pushes aside outweighs everything inside it.',
  view: { pos: [4, 3.4, 14.5], target: [0.2, 2.8, 0] },
  learn: `<p>A balloon floats for the same reason a cork does. It pushes aside a volume of the fluid around it, and the fluid pushes back with a force equal to the <b>weight of what was pushed aside</b>. That is <b>Archimedes’ principle</b>, and in air it works exactly as in water.</p>
    <p>A 2,800 m³ envelope pushes aside about <b>3,400 kg</b> of 20 °C air. But the air inside it, heated to around 100 °C, weighs about 2,650 kg. The difference, roughly <b>700 kg</b>, is the <b>gross lift</b>. Everything else the balloon carries has to fit inside that: the fabric, the basket and burners, the fuel, and the people.</p>
    <p class="tip"><b>Try it:</b> raise the temperature inside until the two columns balance. Then add passengers or fuel and see how little spare lift is left. A hotter envelope lifts more, but the fabric has a temperature limit.</p>
    <p class="note">Sport balloons are typically 2,000 to 3,000 m³, and the masses here are typical round numbers, not a particular make.</p>`,
  terms: [
    { t: 'Archimedes’ principle', d: 'The upward force on an object in a fluid equals the weight of the fluid it displaces.' },
    { t: 'Gross lift', d: 'The weight of the cool air pushed aside, minus the weight of the hot air that replaces it.' },
    { t: 'Payload', d: 'Everything the lift has to carry besides the hot air: fabric, basket, burners, fuel and people.' },
    { t: 'Spare lift', d: 'Gross lift minus payload. Positive, the balloon rises; negative, it stays on the ground.' },
  ],
  defaults: { V: 2800, tIn: 100, tOut: 20, people: 4, fuel: 60 },
  controls: [
    { key: 'V', type: 'range', label: 'Envelope volume', min: 1000, max: 4500, step: 50, fmt: (v) => `${fmt(v)} m³` },
    { key: 'tIn', type: 'range', label: 'Average temperature inside', min: 20, max: 120, step: 1, fmt: (v) => `${v.toFixed(0)} °C` },
    { key: 'tOut', type: 'range', label: 'Outside air', min: -10, max: 35, step: 1, fmt: (v) => `${v.toFixed(0)} °C` },
    { key: 'people', type: 'range', label: 'People aboard (pilot included)', min: 1, max: 10, step: 1, fmt: (v) => `${v.toFixed(0)}` },
    { key: 'fuel', type: 'range', label: 'Propane on board', min: 0, max: 150, step: 5, fmt: (v) => `${v.toFixed(0)} kg` },
  ],
  quiz: [
    { q: 'What is the upward force on a balloon equal to?', options: ['The weight of the hot air inside it', 'The weight of the cool air it pushes aside', 'The weight of the passengers', 'The heat from the burner'], answer: 1, why: 'Archimedes: the buoyant force equals the weight of the fluid displaced. For a balloon, that is the cool outside air.' },
    { q: 'You add four more passengers and the balloon stays on the ground. What helps most?', options: ['Heat the air hotter (within the fabric’s limit)', 'Paint it a lighter colour', 'Open the vent', 'Take off at noon'], answer: 0, why: 'Hotter air is lighter, so gross lift rises. Cold mornings help too, since the outside air is denser.' },
    { q: 'Why are balloons so big?', options: ['For show', 'Hot air is only a little lighter than cool air, so lots is needed', 'Large balloons are cheaper', 'To fit the burner'], answer: 1, why: 'Each cubic metre of 100 °C air lifts only about a quarter of a kilogram, so carrying 600 kg takes more than 2,000 cubic metres.' },
  ],
  reel: [
    { ms: 5200, caption: 'A balloon pushes aside about 3,400 kg of air. Hot air inside weighs less.', set: { V: 2800, tIn: 20, tOut: 20, people: 4, fuel: 60 }, anim: { tIn: [20, 100] }, view: { pos: [2.5, 3.6, 11], target: [-0.3, 3, 0] }, spin: 0 },
  ],
  build({ stage, s }) {
    stage.floor.visible = false;
    const root = new THREE.Group(); stage.root.add(root);
    // the balloon, drawn at 0.11 scale
    const bal = makeBalloon(); bal.scale.setScalar(0.12); bal.position.set(-4.5, 1.6, 0); root.add(bal);
    const up = arrow(0x8ef0ff, 2, 0.35, 0.07); up.position.set(-4.5, 4.3, 0); root.add(up);
    const dn = arrow(0xff7a59, 2, 0.35, 0.07); dn.rotation.z = Math.PI; dn.position.set(-4.5, 4.3, 0); root.add(dn);
    stage.label('Push of the cool air', [-3.2, 6.5, 0], root, 'lbl-hot');
    stage.label('Weight of balloon and load', [-3.2, 2.3, 0], root);
    // two columns
    const colA = box(1.5, 1, 1.5, M.plastic(0x8ef0ff, { transparent: true, opacity: 0.55 })); root.add(colA);
    const colB = new THREE.Group(); root.add(colB);
    const slabs = SLABS.map(([k, , c]) => { const m = box(1.5, 1, 1.5, M.plastic(c, { roughness: 0.4 })); colB.add(m); return m; });
    const spare = box(1.5, 1, 1.5, M.plastic(0xa3e635, { transparent: true, opacity: 0.4, emissive: 0x4a6a10, emissiveIntensity: 0.4 })); colB.add(spare);
    colA.position.x = 1.3; colB.position.x = 3.7;
    stage.label('Weight of air pushed aside', [1.3, 0, 0], root);
    stage.label('What the balloon weighs', [3.7, 0, 0], root);
    const tags = SLABS.map(([, n]) => { const l = stage.label(n, [5.1, 0, 0], root); l.element.style.whiteSpace = 'nowrap'; return l; });
    const spareLbl = stage.label('Spare lift', [5.1, 0, 0], root);
    const base = box(8.6, 0.06, 2.4, M.plastic(0x2a2f3c)); base.position.set(2.5, -0.03, 0); root.add(base);
    let bob = 0;
    return {
      update(dt, st, time) {
        const b = budget(st);
        const hA = b.push / PER;
        colA.scale.y = hA; colA.position.y = hA / 2;
        let y = 0;
        SLABS.forEach(([k], i) => { const h = Math.max(0.001, b.m[k] / PER); slabs[i].scale.y = h; slabs[i].position.set(0, y + h / 2, 0); tags[i].position.y = y + h / 2; tags[i].element.style.opacity = h > 0.12 ? 1 : 0; y += h; });
        const sp = Math.max(0.001, b.net / PER);
        spare.visible = b.net > 0.5; spare.scale.y = sp; spare.position.y = y + sp / 2; spareLbl.position.y = y + sp / 2; spareLbl.element.style.opacity = b.net > 0.5 ? 1 : 0;
        // when overweight, the column pokes above the push column
        // the balloon bobs more the more lift it has to spare
        const net = clamp(b.net / 400, -1, 1);
        bob = lerp(bob, net, 1 - Math.exp(-3 * dt));
        bal.position.y = 1.6 + Math.max(0, bob) * 0.9 + Math.sin(time * 1.4) * 0.05 * Math.max(0, bob);
        const sc = 0.12 * Math.cbrt(b.V / 2800);
        bal.scale.setScalar(sc); bal.setHeat(clamp((st.tIn - 40) / 80, 0, 1)); bal.setFlame(0);
        up.set(Math.max(0.2, b.push / PER * 0.45)); dn.set(Math.max(0.2, b.sum / PER * 0.45));
        up.position.y = 4.3 + bal.position.y - 1.6; dn.position.y = up.position.y;
      },
      readout(st) {
        const b = budget(st);
        const ok = b.net >= 0;
        return `<div class="big">${ok ? 'Spare lift' : 'Too heavy by'} ${fmt(Math.abs(b.net))} kg</div><p class="r-say">${ok ? 'It can climb. A bit more heat will make it rise faster.' : 'It stays on the ground. Heat the air, shed weight or wait for a colder morning.'}</p>
          <div class="row"><span>Cool air pushed aside</span><b>${fmt(b.push)} kg</b></div>
          <div class="row"><span>Hot air inside</span><b>${fmt(b.m.air)} kg</b></div>
          <div class="row"><span>Gross lift</span><b>${fmt(b.lift)} kg</b></div>
          <div class="row"><span>Fabric, basket, burners</span><b>${fmt(b.m.env + b.m.gear)} kg</b></div>
          <div class="row"><span>Propane and people</span><b>${fmt(b.m.fuel + b.m.crew)} kg</b></div>
          <div class="row"><span>Lift per m³ of envelope</span><b>${fmt(b.a - b.b, 3)} kg</b></div>
          ${st.tIn > 120 ? '<p class="note">Above about 120 °C the fabric starts to weaken.</p>' : ''}`;
      },
    };
  },
};
