// Chapter 5: why every flight ends. The air inside cools all the time, the propane runs out, and the balloon has
// to come down. A landing simulator: start at 200 m with the air at hover temperature. Heat loss here is tuned for
// play (the envelope loses about a sixtieth of its excess temperature each 25 seconds). Landing grades are our own
// rough scale, not a standard. Propane use comes from a burner of about 2.5 MW and about 46 MJ per kilogram.
import { THREE, canvasTexture, clamp, fmt, LAYERS, windAt, compass, speedOf, atmos, BURNER_KG_PER_S } from '../balloon.js';
import { flightWorld } from '../flightworld.js';

const grade = (v) => (v < 0.8 ? ['Feather-soft', '#a3e635'] : v < 1.8 ? ['Gentle', '#a3e635'] : v < 3 ? ['Firm', '#ffb547'] : ['Hard', '#ff7a59']);

export default {
  id: 'landing',
  short: 'Cooling and landing',
  title: 'Cooling, fuel and landing',
  subtitle: 'The air inside never stops cooling and the propane runs out, so every flight is borrowed time.',
  view: { pos: [0, -1, 27], target: [-2.5, -2.4, 0] },
  learn: `<p>Left alone, the air inside a balloon <b>cools</b>. The fabric is not sealed, and heat leaks out through it and through the open mouth. So the pilot has to <b>keep topping up the heat</b> with the burner, and the burner burns <b>propane</b> from cylinders in the basket. When the fuel runs low, the flight is over. That is the second reason a balloon cannot go anywhere you choose: it can only stay up for as long as it carries fuel.</p>
    <p>Landing is the same controls played gently. The pilot vents or lets the balloon cool to descend, then adds a short burn just above the ground to <b>slow the sink</b>. The basket meets the ground moving at the speed of the wind, so landings are often a short, gentle slide, sometimes onto a field the pilot chose long before.</p>
    <p class="tip"><b>Try it:</b> press <b>Replay approach</b>, let it cool and watch the chart cross the hover line. Then try to touch down softly with short burns near the ground.</p>
    <p class="note">Heat loss and the grades are tuned for play. Real balloons also vary with fabric, wind and weather.</p>`,
  terms: [
    { t: 'Hover temperature', d: 'The air temperature inside at which lift equals weight. Hotter climbs, cooler sinks.' },
    { t: 'Heat loss', d: 'Heat leaks out of the envelope all the time, so the air inside cools unless the burner tops it up.' },
    { t: 'Flare', d: 'A short burn just above the ground to slow the descent before touching down.' },
    { t: 'Propane', d: 'The fuel. It is stored as liquid in cylinders in the basket, and turned to gas on its way to the burner.' },
  ],
  defaults: { burner: false, vent: false, speed: 4, fuel: 40, tAmb: 15 },
  controls: [
    { key: 'burner', type: 'toggle', label: 'Burner on' },
    { key: 'vent', type: 'toggle', label: 'Parachute valve open' },
    { type: 'buttons', label: 'Quick actions', items: [
      { label: 'Blast 3 s', act: (s, inst) => { inst.flight.blast = 3; } },
      { label: 'Vent 3 s', act: (s, inst) => { inst.flight.ventT = 3; } },
      { label: 'Replay approach', act: (s, inst) => { inst.reset(s); } },
    ] },
    { key: 'speed', type: 'seg', label: 'Time-lapse', options: [{ v: 1, label: '1×' }, { v: 4, label: '4×' }, { v: 10, label: '10×' }] },
    { key: 'fuel', type: 'range', label: 'Propane at the start', min: 0, max: 100, step: 5, fmt: (v) => `${v.toFixed(0)} kg`, hint: 'Takes effect when you replay the approach.' },
  ],
  quiz: [
    { q: 'Why must a pilot keep firing the burner?', options: ['The flame is for show', 'Heat leaks out of the envelope, so the air cools', 'The balloon needs the noise', 'To keep the fabric wet'], answer: 1, why: 'The fabric and the open mouth lose heat all the time. Without topping up, the air cools and the balloon sinks.' },
    { q: 'What limits how long a balloon can stay up?', options: ['The pilot’s patience', 'The fuel it carries', 'The colour of the fabric', 'Gravity changes'], answer: 1, why: 'Propane in the cylinders. When it runs low, the pilot has to land.' },
    { q: 'Why fire the burner just above the ground?', options: ['To start a fire', 'To slow the sink so the basket touches down gently', 'To climb again', 'To cool the air'], answer: 1, why: 'A short burn adds lift and slows the descent. It is called a flare, like the one a plane makes.' },
  ],
  reel: [
    { ms: 5200, caption: 'The air inside never stops cooling. A pilot lets it sink, then a short burn softens the touchdown.', set: { burner: false, vent: false, speed: 10, fuel: 40 }, act: (s, inst) => { inst.reset(s); }, view: { pos: [3, 0, 24], target: [3, -1.5, 0] }, spin: 0 },
  ],
  build({ stage, s }) {
    const w = flightWorld({ stage, s, start: { alt: 200 } });
    const f = w.flight;
    const start = (st) => { f.reset({ alt: 200, T: f.hoverTemp(200), fuel: st.fuel }); w.clearTrail(); hist.length = 0; };
    const hist = [];
    // chart: temperature against time, with the hover line
    const W = 900, H = 520;
    const chart = canvasTexture(W, H, (g) => {
      g.fillStyle = 'rgba(13,15,22,.88)'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
      g.font = '500 24px Geist, system-ui, sans-serif'; g.fillStyle = '#a8aebf'; g.fillText('Air inside the envelope (°C) against time', 30, 44);
      const x0 = 70, x1 = W - 30, y0 = 90, y1 = H - 60;
      const lo = 20, hi = 120, tmax = Math.max(300, hist.length ? hist[hist.length - 1].t : 0);
      const X = (t) => x0 + (t / tmax) * (x1 - x0), Y = (v) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
      g.font = '400 20px Geist, system-ui, sans-serif';
      for (const v of [20, 40, 60, 80, 100, 120]) { g.fillStyle = '#737a8e'; g.fillText(String(v), 24, Y(v) + 7); g.strokeStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(x0, Y(v)); g.lineTo(x1, Y(v)); g.stroke(); }
      g.fillStyle = '#737a8e'; for (let m = 0; m * 60 <= tmax; m++) g.fillText(m + ' min', X(m * 60) - 18, y1 + 30);
      const line = (key, col, wid, dash) => { g.strokeStyle = col; g.lineWidth = wid; g.setLineDash(dash || []); g.beginPath(); hist.forEach((p, i) => { const x = X(p.t), y = Y(clamp(p[key], lo, hi)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); };
      line('hover', '#8ef0ff', 3, [10, 8]); line('T', '#ff7a59', 5);
      g.font = '500 21px Geist, system-ui, sans-serif'; g.fillStyle = '#8ef0ff'; g.fillText('Hover temperature: lift = weight', x0 + 12, y0 + 6); g.fillStyle = '#ff7a59'; g.fillText('Air temperature', x0 + 12, y0 + 34);
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(7, 7 * H / W), new THREE.MeshBasicMaterial({ map: chart.tex, transparent: true, toneMapped: false }));
    plane.position.set(8.5, 3.6, 0); stage.root.add(plane);
    let acc = 0, key = 0;
    const inst = {
      flight: f, reset: start,
      update(dt, st, t) {
        const before = f.t; w.update(dt, st, t);
        acc += f.t - before;
        if (acc > 2) { acc = 0; hist.push({ t: f.t, T: f.T, hover: f.hoverTemp() }); if (hist.length > 400) hist.shift(); key++; chart.redraw(); }
      },
      readout(st) {
        const a = f.touch, wind = windAt(f.alt);
        const fuel = f.fuelLeft();
        const head = f.touch ? (() => { const [g] = grade(f.touch.v); return `Touchdown: ${g}`; })() : f.onGround ? 'On the ground' : f.vz < -0.4 ? 'Descending' : f.vz > 0.4 ? 'Climbing' : 'Hovering';
        return `<div class="big">${head} · ${fmt(f.alt)} m</div><p class="r-say">${a ? `You touched down at ${a.v.toFixed(1)} m/s downward and ${a.h.toFixed(1)} m/s sideways. Press Replay approach to try again.` : `Sinking at ${(-f.vz).toFixed(1)} m/s. ${f.alt < 40 && f.vz < -2 ? 'Too fast. Fire the burner now.' : 'Aim to arrive under 1 m/s.'}`}</p>
          <div class="row"><span>Air inside</span><b>${f.T.toFixed(0)} °C</b></div>
          <div class="row"><span>Hover temperature</span><b>${fmt(f.hoverTemp())} °C</b></div>
          <div class="row"><span>Sink rate</span><b>${f.vz >= 0 ? '+' : ''}${f.vz.toFixed(1)} m/s</b></div>
          <div class="row"><span>Propane left</span><b>${fmt(fuel, 1)} kg${fuel <= 0.01 ? ' · empty' : ''}</b></div>
          <div class="row"><span>Wind here</span><b>${compass(wind)} ${speedOf(wind).toFixed(1)} m/s</b></div>
          <div class="row"><span>Burner on for</span><b>${fmt(f.burnS)} s</b></div>`;
      },
    };
    start(s);
    return inst;
  },
};
