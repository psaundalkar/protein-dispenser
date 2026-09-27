'use strict';
/*
 * products.js - the vending menu, shared by the twin server (live REST/WS) and
 * the static build (offline demo). Single source of truth so the hosted demo
 * never drifts from the simulator.
 */

module.exports = [
  { id: 'whey', name: 'Whey Protein Shake', price: 249, powder: [{ h: 0, g: 30 }, { h: 1, g: 12 }], water_ml: 280, temp: 'hot' },
  { id: 'lean', name: 'Lean Mass Shake', price: 299, powder: [{ h: 0, g: 35 }, { h: 3, g: 25 }], water_ml: 300, temp: 'cold' },
  { id: 'crea', name: 'Creatine Fuel', price: 199, powder: [{ h: 2, g: 5 }, { h: 4, g: 8 }], water_ml: 250, temp: 'cold' },
  { id: 'oats', name: 'Oats Recovery', price: 229, powder: [{ h: 3, g: 30 }, { h: 1, g: 10 }], water_ml: 300, temp: 'hot' },
];
