'use strict';
/*
 * kicad_sch_lib.js
 *
 * Minimal, self-contained KiCad symbol definitions used by gen_sch.js.
 * Each symbol declares its pins with coordinates in SYMBOL space (y-up),
 * so the generator can compute absolute pin positions and wire to them.
 *
 * Everything here is emitted inline into lib_symbols of the .kicad_sch,
 * so the schematic opens without any external library dependency.
 */

// A pin: { num, name, x, y, len, orient ('L','R','U','D' = direction pin points) }
// Body drawn as a rectangle unless custom graphics given.
class Sym {
  constructor(libId, opts = {}) {
    this.libId = libId;
    const [lib, name] = libId.split(':');
    this.lib = lib;
    this.name = name;
    this.pins = opts.pins || [];
    this.refPrefix = opts.refPrefix || 'U';
    this.pinNameOffset = opts.pinNameOffset ?? 0.508;
    this.pinNamesVisible = opts.pinNamesVisible !== false;
    this.pinNumbersVisible = opts.pinNumbersVisible !== false;
    this.body = opts.body || null;        // [x1,y1,x2,y2] rectangle in symbol space
    this.graphics = opts.graphics || [];  // raw kicad graphic s-expr strings
    this.power = !!opts.power;
    this.hidePinNames = !!opts.hidePinNames;
    this.nc = opts.nc || [];              // pin numbers to mark "no connect"
  }
  get(libId) { return this; }
}

class Lib {
  constructor() { this.map = new Map(); }
  add(sym) { this.map.set(sym.libId, sym); return sym; }
  get(libId) { return this.map.get(libId); }
  list() { return this.map.values(); }
}

// ---------- helper to build a generic rectangular IC ----------
function ic(libId, opts) {
  const n = opts.pins;
  // two columns
  const left = n.filter((p) => p.side === 'L');
  const right = n.filter((p) => p.side === 'R');
  const rows = Math.max(left.length, right.length);
  const pitch = opts.pitch || 2.54;
  const halfH = ((rows - 1) * pitch) / 2;
  const w = opts.width || 20.32;
  const pins = [];
  left.forEach((p, i) => {
    pins.push({ num: p.num, name: p.name, x: -w / 2 - 2.54, y: halfH - i * pitch, len: 2.54, orient: 'R' });
  });
  right.forEach((p, i) => {
    pins.push({ num: p.num, name: p.name, x: w / 2 + 2.54, y: halfH - i * pitch, len: 2.54, orient: 'L' });
  });
  return { pins, body: [-w / 2, -halfH - 2.54, w / 2, halfH + 2.54] };
}

// ---------- passive two-terminal (vertical) ----------
function twoTerm(libId, refPrefix, drawFn, extra = {}) {
  return new Sym(libId, {
    refPrefix,
    pinNameOffset: 0,
    pinNamesVisible: false,
    body: null,
    graphics: drawFn(),
    pins: [
      { num: '1', name: '~', x: 0, y: 3.81, len: 1.27, orient: 'D' },
      { num: '2', name: '~', x: 0, y: -3.81, len: 1.27, orient: 'U' },
    ],
    ...extra,
  });
}

module.exports = { Sym, Lib, ic, twoTerm };
