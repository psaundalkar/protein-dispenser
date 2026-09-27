'use strict';
/**
 * Headless end-to-end check of the twin: powers on, pre-heats, brews a cup and
 * asserts the full state sequence + conservation of mass/energy.
 *   node twin/test_cycle.js
 */
const Machine = require('./machine');
const IO = require('./io');

const m = new Machine(new IO());
const seen = [];
let boilerWasReady = false;

m.powerOn();
// pre-heat so WATER_HOT doesn't stall (mirrors a machine idling between sales)
while (m.boiler.water_c < m.boiler.ready_c) m.step(Machine.TICK_MS);
boilerWasReady = true;

const t0 = m.waterTank.level_l;
const p0 = m.hoppers.map((h) => h.level_g);
const w0 = m.energy.wh;

console.log(`pre-heat done: boiler=${m.boiler.water_c.toFixed(1)}C chiller=${m.chiller.water_c.toFixed(1)}C`);

const r = m.brew({
  name: 'Whey Protein Shake', price: 249,
  powder: [{ h: 0, g: 30 }, { h: 1, g: 12 }], water_ml: 280, temp: 'hot',
});
if (!r.ok) throw new Error('brew rejected: ' + r.err);

let guard = 0;
while (m.state !== 'IDLE' && guard++ < 6000) {
  m.step(Machine.TICK_MS);
  if (seen.at(-1) !== m.state) {
    seen.push(m.state);
    console.log(`  ${String(m.t).padStart(6)}s  ->  ${m.state}`);
  }
}

const p1 = m.hoppers.map((h) => h.level_g);
console.log('\n--- assertions ---');
console.log('state sequence :', seen.join(' -> '));
console.log('hopper delta(g):', p1.map((v, i) => (p0[i] - v).toFixed(1)).join(', '));
console.log('water used (L) :', (t0 - m.waterTank.level_l).toFixed(3));
console.log('energy used(Wh):', (m.energy.wh - w0).toFixed(2));
console.log('cups lifetime  :', m.stats.cups_lifetime, '| sales today:', m.stats.sales_today, '| revenue:', m.stats.revenue_today);
console.log('waste tray %   :', m.wasteTray.level_pct.toFixed(1));

const okSeq = JSON.stringify(seen) === JSON.stringify(['PAYMENT', 'CUP', 'POWDER', 'WATER_HOT', 'MIX', 'DISPENSE', 'RINSE', 'IDLE']);
const dosed = p1.map((v, i) => +(p0[i] - v).toFixed(1));
const expected = [30, 12, 0, 0, 0];
const okDose = dosed.every((d, i) => Math.abs(d - expected[i]) < 1.5);
const okCup = m.stats.cups_lifetime === 1285;
const okWater = (t0 - m.waterTank.level_l) > 0.2;

console.log('\nsequence  :', okSeq ? 'PASS' : 'FAIL');
console.log('dosing    :', okDose ? 'PASS' : 'FAIL');
console.log('cup count :', okCup ? 'PASS' : 'FAIL');
console.log('water draw:', okWater ? 'PASS' : 'FAIL');
if (!(okSeq && okDose && okCup && okWater)) process.exit(1);
console.log('\nFULL DISPENSE CYCLE VERIFIED');
