'use strict';
/*
 * build-site.js - assembles the static site that Vercel serves.
 *
 * Vercel (and any static host) gets a self-contained `public/` folder:
 *
 *   public/index.html            operator dashboard
 *   public/app.js  style.css
 *   public/three/index.html      3D internal view
 *   public/three/view3d.js
 *   public/wiring.html           machine wiring diagram
 *   public/schematic.html        custom control-PCB schematic (block + SVG)
 *   public/schematic.svg         rendered KiCad schematic
 *   public/demo-state.json       fallback telemetry so the pages render offline
 *
 * The live twin server (twin/server.js) is NOT part of this bundle: it is a
 * long-lived WebSocket process and cannot run on serverless hosting. Run it
 * locally for live telemetry; the hosted pages fall back to demo-state.json.
 *
 * Run:  node scripts/build-site.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');

const TV = require(path.join(ROOT, 'twin/machine'));
const IO = require(path.join(ROOT, 'twin/io'));

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(ROOT, src), dest);
  return path.relative(ROOT, dest);
}

// -- clean output
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// -- twin dashboard (served at /)
copy('twin/public/index.html', path.join(OUT, 'index.html'));
copy('twin/public/app.js', path.join(OUT, 'app.js'));
copy('twin/public/style.css', path.join(OUT, 'style.css'));

// -- 3D internal view (served at /three/)
copy('twin/public/three/index.html', path.join(OUT, 'three/index.html'));
copy('twin/public/three/view3d.js', path.join(OUT, 'three/view3d.js'));

// -- engineering docs
copy('hardware/wiring-diagram.html', path.join(OUT, 'wiring.html'));
copy('hardware/pcb/schematic.html', path.join(OUT, 'schematic.html'));
copy('hardware/pcb/ProteinDispenser_Controller.schematic.svg', path.join(OUT, 'schematic.svg'));

// -- demo telemetry: run the real machine model headlessly and snapshot it.
//    This is generated from twin/machine.js, so it is never fabricated.
function demoState() {
  const machine = new TV(new IO());
  machine.powerOn();
  // advance ~20 s so temperatures/rails settle to realistic resting values
  const steps = Math.round(20000 / TV.TICK_MS);
  for (let i = 0; i < steps; i++) machine.step(TV.TICK_MS);
  return machine.snapshot();
}
const state = demoState();
fs.writeFileSync(
  path.join(OUT, 'demo-state.json'),
  JSON.stringify({ generatedFrom: 'twin/machine.js', data: state }, null, 2),
);

// -- the menu, shared verbatim with the live server
const PRODUCTS = require(path.join(ROOT, 'twin/products'));
fs.writeFileSync(
  path.join(OUT, 'demo-products.js'),
  `window.__DEMO_PRODUCTS = ${JSON.stringify(PRODUCTS)};\n`,
);

// -- a redirect so /dashboard is a friendly alias
fs.writeFileSync(
  path.join(OUT, '_redirects'),
  '/dashboard /index.html 302\n/view3d   /three/index.html 302\n/wiring   /wiring.html 200\n/schematic /schematic.html 200\n',
);

// -- list
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push([path.relative(OUT, p), fs.statSync(p).size]);
  }
})(OUT);

console.log(`built static site -> ${path.relative(ROOT, OUT)}/`);
for (const [f, size] of files.sort()) console.log(`  ${f.padEnd(28)} ${(size / 1024).toFixed(1)} KB`);
console.log(`\ndemo state: ${state.state}, ${state.relays.length} relays, ${state.hoppers.length} hoppers`);
