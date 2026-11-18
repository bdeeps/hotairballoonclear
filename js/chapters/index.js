// The box and its chapters, in reading order.
import density from './density.js';
import buoyancy from './buoyancy.js';
import flight from './flight.js';
import layers from './layers.js';
import landing from './landing.js';
import gas from './gas.js';

export const BOX = { slug: 'hotairballoonclear', title: "HotAirBalloonClear" };
export const CHAPTERS = [density, buoyancy, flight, layers, landing, gas];
