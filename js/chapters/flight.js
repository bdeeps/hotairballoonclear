// Chapter 3: the burner and the vent. A flight simulator. Heat goes in when the burner fires (about 1 degree per
// second of burn here), leaks out all the time through the fabric, and leaves faster when the parachute valve
// opens. The climb lags behind the heat because the envelope is huge. Rates are tuned for play, not measured
// from one balloon. Burners are roughly 2-3 MW; propane about 46 MJ/kg. Winds are a made-up profile.
import { THREE, clamp, fmt, LAYERS, windAt, compass, speedOf, layerAt, atmos } from '../balloon.js';
import { flightWorld } from '../flightworld.js';

export default {
  id: 'flight',
  short: 'Burner and vent',
  title: 'The burner and the vent',
  subtitle: 'Your only controls are heat and a hole. Everything else is the wind.',
  view: { pos: [0, -1, 27], target: [-2.5, -2.2, 0] },
  learn: `<p>A hot air balloon has two controls. The <b>burner</b> burns propane in a roaring flame under the mouth of the envelope and heats the air inside, which makes the balloon lighter. The <b>parachute valve</b> (the vent) is a round flap in the crown that the pilot opens with a rope to let hot air out, which makes it sink.</p>
    <p>There is no throttle, only <b>delay</b>. The air inside is a huge, slowly cooling mass, so a blast of flame takes many seconds to show up as a climb, and a vent takes as long to bring you down. Pilots fly gently, with short burns, and think ahead.</p>
    <p>The only way to move sideways is to change height. Each layer of air blows its own way, and the balloon simply goes along with the wind it is in.</p>
    <p class="tip"><b>Try it:</b> hold <b>Burner</b> to lift off, then switch it off and watch the balloon keep climbing. Find a height where the wind carries you the way you want. Raise the <b>time-lapse</b> to save waiting.</p>
    <p class="note">Rates are tuned for play. The wind layers are a made-up example: real ones change day to day.</p>`,
  terms: [
    { t: 'Burner', d: 'A propane burner of roughly 2 to 3 megawatts that heats the air inside the envelope.' },
    { t: 'Parachute valve', d: 'A flap in the top of the envelope, opened by a rope, that lets hot air out so the balloon descends.' },
    { t: 'Wind layer', d: 'A band of air that moves in its own direction and speed. A balloon drifts at the speed of the layer it is in.' },
    { t: 'Equilibrium', d: 'The temperature at which lift just equals weight. Hotter climbs, cooler sinks.' },
  ],
  defaults: { burner: false, vent: false, speed: 4, tAmb: 15 },
  controls: [
    { key: 'burner', type: 'toggle', label: 'Burner (hold the flame on)', hint: 'Heats the air about 1 °C per second of burn.' },
    { key: 'vent', type: 'toggle', label: 'Parachute valve open' },
    { type: 'buttons', label: 'Quick actions', items: [
      { label: 'Blast 5 s', act: (s, inst) => { inst.flight.blast = 5; } },
      { label: 'Vent 3 s', act: (s, inst) => { inst.flight.ventT = 3; } },
      { label: 'Reset flight', act: (s, inst) => { inst.reset(); } },
    ] },
    { key: 'speed', type: 'seg', label: 'Time-lapse', options: [{ v: 1, label: '1×' }, { v: 4, label: '4×' }, { v: 10, label: '10×' }] },
    { key: 'tAmb', type: 'range', label: 'Ground temperature', min: -5, max: 30, step: 1, fmt: (v) => `${v.toFixed(0)} °C` },
  ],
  quiz: [
    { q: 'You blast the burner and then stop. What does the balloon do?', options: ['Stops climbing at once', 'Keeps climbing for a while as the heat takes effect', 'Falls at once', 'Turns round'], answer: 1, why: 'The huge envelope is slow to respond, so the climb lags behind the heat. Pilots burn in short bursts and wait to see the effect.' },
    { q: 'What does the parachute valve do?', options: ['Steers the balloon', 'Slows a crash', 'Lets hot air out so the balloon sinks', 'Cools the burner'], answer: 2, why: 'Opening the flap in the crown lets hot air escape and cooler air replace it, so the balloon loses lift.' },
    { q: 'How does a pilot choose a direction?', options: ['With a rudder', 'By changing height to find a layer blowing the right way', 'By tilting the basket', 'With the burner angle'], answer: 1, why: 'A balloon moves with the air around it. Different heights often blow in different directions, so the pilot climbs or descends to pick one.' },
  ],
  reel: [
    { ms: 5200, caption: 'A burner heats the air. Hotter air is lighter, so up it goes.', set: { burner: true, vent: false, speed: 16, tAmb: 15 }, act: (s, inst) => { inst.reset({ T: 70 }); }, view: { pos: [0, 0, 19], target: [0, -1, 0] }, spin: 0 },
    { ms: 5000, caption: 'Open the vent at the top and hot air escapes, so down it comes.', set: { burner: false, vent: false, speed: 12 }, anim: { vent: [false, true] }, view: { pos: [0, 1, 19], target: [0, 0, 0] }, spin: 0 },
  ],
  build({ stage, s }) {
    const w = flightWorld({ stage, s, start: { T: 60 } });
    s.speed = s.speed || 4;
    const inst = {
      flight: w.flight, reset: (o) => w.reset(o),
      update: (dt, st, t) => w.update(dt, st, t),
      readout(st) {
        const f = w.flight, a = atmos(f.alt, f.cfg.tAmb), wind = windAt(f.alt), L = layerAt(f.alt), net = f.netLift();
        const state = f.onGround ? 'On the ground' : f.vz > 0.4 ? 'Climbing' : f.vz < -0.4 ? 'Descending' : 'Level';
        const hot = f.T > 120 ? ' <span style="color:#ff7a59">over the fabric limit</span>' : '';
        return `<div class="big">${state} · ${fmt(f.alt)} m</div><p class="r-say">${f.onGround ? 'Hold the burner on until the air inside reaches about ' + fmt(f.hoverTemp(0)) + ' °C.' : `In the ${LAYERS[L].from}–${LAYERS[L].to} m layer, drifting ${compass(wind)} at ${speedOf(wind).toFixed(1)} m/s.`}</p>
          <div class="row"><span>Air inside the envelope</span><b>${f.T.toFixed(0)} °C${hot}</b></div>
          <div class="row"><span>Needed to hover here</span><b>${fmt(f.hoverTemp())} °C</b></div>
          <div class="row"><span>Climb rate</span><b>${f.vz >= 0 ? '+' : ''}${f.vz.toFixed(1)} m/s</b></div>
          <div class="row"><span>Lift minus weight</span><b>${net >= 0 ? '+' : ''}${fmt(net)} kg</b></div>
          <div class="row"><span>Drift speed</span><b>${Math.hypot(f.vx, f.vy).toFixed(1)} m/s</b></div>
          <div class="row"><span>Distance from launch</span><b>${fmt(Math.hypot(f.x, f.z))} m</b></div>
          <div class="row"><span>Propane used (est.)</span><b>${fmt(f.cfg.mass ? f.fuel0 - f.fuelLeft() : 0, 1)} kg</b></div>`;
      },
    };
    return inst;
  },
};
