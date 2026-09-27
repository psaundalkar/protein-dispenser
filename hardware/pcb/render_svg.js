'use strict';
/*
 * render_svg.js - renders the fabricable KiCad schematic to a standalone SVG.
 *
 * Reads ProteinDispenser_Controller.kicad_sch (the real fabrication source) and
 * emits ProteinDispenser_Controller.schematic.svg plus an index.html wrapper so
 * the schematic can be previewed in any browser without installing KiCad.
 *
 * Supported primitives: placed symbols (rectangle/polyline/circle/arc graphics +
 * pins, with KiCad placement rotation), wires, junctions, local labels and
 * no-connect markers. Coordinates use KiCad's schematic space (mm, y-down).
 *
 * Run:  node hardware/pcb/render_svg.js
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'ProteinDispenser_Controller.kicad_sch');
const OUT_SVG = path.join(__dirname, 'ProteinDispenser_Controller.schematic.svg');
const OUT_HTML = path.join(__dirname, 'schematic_preview.html');

// ------------------------------------------------------------------ s-expr parser
/** Tokenize + parse an s-expression file into nested arrays. Quoted atoms => {str}. */
function parse(text) {
  let i = 0;
  const n = text.length;
  function ws() { while (i < n && /\s/.test(text[i])) i++; }
  function atom() {
    if (text[i] === '"') {
      i++; let s = '';
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\') { i++; s += text[i]; } else s += text[i];
        i++;
      }
      i++; return { str: s };
    }
    let s = '';
    while (i < n && !/[\s()]/.test(text[i])) { s += text[i]; i++; }
    const num = Number(s);
    return s !== '' && !Number.isNaN(num) ? num : s;
  }
  function list() {
    i++; // consume '('
    const out = [];
    for (;;) {
      ws();
      if (i >= n) throw new Error('unexpected EOF');
      if (text[i] === ')') { i++; return out; }
      if (text[i] === '(') out.push(list());
      else out.push(atom());
    }
  }
  ws();
  return list();
}

const V = (t) => (t && typeof t === 'object' && 'str' in t ? t.str : t);
/** find first child list whose head equals `head` */
const child = (node, head) => (Array.isArray(node) ? node.find((c) => Array.isArray(c) && c[0] === head) : undefined);
/** find all child lists whose head equals `head` */
const children = (node, head) => (Array.isArray(node) ? node.filter((c) => Array.isArray(c) && c[0] === head) : []);
const num = (x) => (typeof x === 'number' ? x : parseFloat(x));

// ------------------------------------------------------------------ model
const root = parse(fs.readFileSync(SRC, 'utf8'));

// paper size (mm)
const paperName = V(child(root, 'paper')) || 'A3';
const PAPER = { A4: [297, 210], A3: [420, 297], A2: [594, 420] }[paperName] || [420, 297];
// KiCad A3 is 420x297; drawing area starts at 0. A small margin keeps things tidy.
const MARGIN = 8;
const VB = { x: -MARGIN, y: -MARGIN, w: PAPER[0] + MARGIN * 2, h: PAPER[1] + MARGIN * 2 };

// ---- library symbols: graphics + pin definitions keyed by lib_id
const libs = new Map();
const libBlock = child(root, 'lib_symbols');
for (const sym of children(libBlock, 'symbol')) {
  const libId = V(sym[1]);
  const graphics = [];
  const pins = [];
  for (const sub of children(sym, 'symbol')) {          // e.g. "R_0_1", "R_1_1"
    for (const g of sub) {
      if (!Array.isArray(g)) continue;
      const head = g[0];
      if (head === 'rectangle') {
        const s = child(g, 'start'), e = child(g, 'end');
        graphics.push({ kind: 'rect', x1: num(s[1]), y1: num(s[2]), x2: num(e[1]), y2: num(e[2]),
          fill: FILL(child(g, 'fill')) });
      } else if (head === 'polyline') {
        const pts = child(g, 'pts');
        graphics.push({ kind: 'poly', pts: children(pts, 'xy').map((p) => [num(p[1]), num(p[2])]) });
      } else if (head === 'circle') {
        const c = child(g, 'center'), r = child(g, 'radius');
        graphics.push({ kind: 'circle', cx: num(c[1]), cy: num(c[2]), r: num(r[1]) });
      } else if (head === 'arc') {
        const s = child(g, 'start'), m = child(g, 'mid'), e = child(g, 'end');
        graphics.push({ kind: 'arc', s: [num(s[1]), num(s[2])], m: [num(m[1]), num(m[2])], e: [num(e[1]), num(e[2])] });
      } else if (head === 'pin') {
        const at = child(g, 'at');
        const lenN = child(g, 'length');
        const numSlot = child(g, 'number');
        const nameSlot = child(g, 'name');
        pins.push({
          x: num(at[1]), y: num(at[2]), rot: num(at[3]),
          len: lenN ? num(lenN[1]) : 0,
          number: V(numSlot && numSlot[1]) || '',
          name: V(nameSlot && nameSlot[1]) || '~',
        });
      }
    }
  }
  const refProp = children(sym, 'property').find((p) => V(p[1]) === 'Reference');
  const power = !!child(sym, 'power');
  libs.set(libId, {
    graphics, pins, power,
    refPrefix: refProp ? V(refProp[2]) : 'U',
    pinNamesHide: !!(child(sym, 'pin_names') && child(sym, 'pin_names').some((t) => t === 'hide')),
  });
}
function FILL(f) { return f && child(f, 'type') && V(child(f, 'type')[1]) === 'background'; }

// ---- placed instances
const instances = [];
for (const sym of children(root, 'symbol')) {
  if (!child(sym, 'lib_id')) continue;
  const libId = V(child(sym, 'lib_id')[1]);
  const at = child(sym, 'at');
  const props = {};
  for (const p of children(sym, 'property')) {
    props[V(p[1])] = { value: V(p[2]), at: child(p, 'at'), hidden: !!child(p, 'effects') && child(p, 'effects').some((t) => t === 'hide') };
  }
  instances.push({
    libId, x: num(at[1]), y: num(at[2]), rot: num(at[3]),
    ref: props.Reference ? props.Reference.value : '?',
    value: props.Value ? props.Value.value : '',
    refAt: props.Reference && props.Reference.at ? [num(props.Reference.at[1]), num(props.Reference.at[2])] : null,
    valAt: props.Value && props.Value.at ? [num(props.Value.at[1]), num(props.Value.at[2])] : null,
    refHidden: props.Reference ? props.Reference.hidden : false,
    valHidden: props.Value ? props.Value.hidden : false,
  });
}

const wires = children(root, 'wire').map((w) => {
  const pts = child(w, 'pts');
  const xy = children(pts, 'xy').map((p) => [num(p[1]), num(p[2])]);
  return { a: xy[0], b: xy[1] };
});
const junctions = children(root, 'junction').map((j) => {
  const at = child(j, 'at'); return [num(at[1]), num(at[2])];
});
const labels = children(root, 'label').map((l) => {
  const at = child(l, 'at');
  return { text: V(l[1]), x: num(at[1]), y: num(at[2]), rot: num(at[3]) };
});
const noConnects = children(root, 'no_connect').map((n) => {
  const at = child(n, 'at'); return [num(at[1]), num(at[2])];
});

// ------------------------------------------------------------------ geometry helpers
/** Rotate a lib-symbol point by the instance rotation (KiCad: +rot is CCW in y-up,
 *  but schematic y is down, so we apply the transform accordingly). */
function place(inst, px, py) {
  // KiCad symbol-local coords are y-up; schematic is y-down => flip y when placing.
  let x = px, y = -py;
  const r = ((inst.rot % 360) + 360) % 360;
  // rotate (x,y) by -r in screen space (KiCad rotates the symbol CCW visually)
  const a = (-r) * Math.PI / 180;
  const rx = x * Math.cos(a) - y * Math.sin(a);
  const ry = x * Math.sin(a) + y * Math.cos(a);
  return [inst.x + rx, inst.y + ry];
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => (Math.round(n * 100) / 100).toString();

// ------------------------------------------------------------------ SVG emit
const parts = [];
const WIRE = '#2f9e6e';
const SYM = '#8a2be2';
const SYMFILL = '#3a2a55';
const LABEL = '#d08a2c';
const NC = '#e0503c';
const TXT = '#cfd8e3';

parts.push(`<rect x="${fmt(VB.x)}" y="${fmt(VB.y)}" width="${fmt(VB.w)}" height="${fmt(VB.h)}" fill="#0b0f14"/>`);

// sheet border
parts.push(`<rect x="0" y="0" width="${PAPER[0]}" height="${PAPER[1]}" fill="none" stroke="#2a3542" stroke-width="1"/>`);

// ---- wires
for (const w of wires) {
  parts.push(`<line x1="${fmt(w.a[0])}" y1="${fmt(w.a[1])}" x2="${fmt(w.b[0])}" y2="${fmt(w.b[1])}" stroke="${WIRE}" stroke-width="1.1"/>`);
}
// ---- junctions
for (const j of junctions) {
  parts.push(`<circle cx="${fmt(j[0])}" cy="${fmt(j[1])}" r="1.4" fill="${WIRE}"/>`);
}

// ---- symbols
for (const inst of instances) {
  const lib = libs.get(inst.libId);
  if (!lib) continue;
  const g = [];
  for (const gi of lib.graphics) {
    if (gi.kind === 'rect') {
      const [x1, y1] = place(inst, gi.x1, gi.y1);
      const [x2, y2] = place(inst, gi.x2, gi.y2);
      g.push(`<rect x="${fmt(Math.min(x1, x2))}" y="${fmt(Math.min(y1, y2))}" width="${fmt(Math.abs(x2 - x1))}" height="${fmt(Math.abs(y2 - y1))}" fill="${gi.fill ? SYMFILL : 'none'}" stroke="${SYM}" stroke-width="0.9"/>`);
    } else if (gi.kind === 'poly') {
      const d = gi.pts.map((p, k) => { const [x, y] = place(inst, p[0], p[1]); return `${k ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`; }).join(' ');
      g.push(`<path d="${d}" fill="none" stroke="${SYM}" stroke-width="0.9"/>`);
    } else if (gi.kind === 'circle') {
      const [cx, cy] = place(inst, gi.cx, gi.cy);
      g.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(gi.r)}" fill="none" stroke="${SYM}" stroke-width="0.9"/>`);
    } else if (gi.kind === 'arc') {
      const [sx, sy] = place(inst, gi.s[0], gi.s[1]);
      const [mx, my] = place(inst, gi.m[0], gi.m[1]);
      const [ex, ey] = place(inst, gi.e[0], gi.e[1]);
      // approximate arc with a quadratic through the mid point
      g.push(`<path d="M${fmt(sx)} ${fmt(sy)} Q${fmt(2 * mx - (sx + ex) / 2)} ${fmt(2 * my - (sy + ey) / 2)} ${fmt(ex)} ${fmt(ey)}" fill="none" stroke="${SYM}" stroke-width="0.9"/>`);
    }
  }
  // pins
  for (const p of lib.pins) {
    const [px, py] = place(inst, p.x, p.y);
    const a = (-p.rot) * Math.PI / 180;
    // pin extends toward its body from the endpoint
    const dx = Math.cos(a), dy = Math.sin(a);
    const ex = px + dx * p.len, ey = py + dy * p.len;
    g.push(`<line x1="${fmt(px)}" y1="${fmt(py)}" x2="${fmt(ex)}" y2="${fmt(ey)}" stroke="${SYM}" stroke-width="0.9"/>`);
    if (!lib.pinNamesHide && p.name && p.name !== '~') {
      g.push(`<text x="${fmt(ex + dx * 1)}" y="${fmt(ey + dy * 1)}" fill="${TXT}" font-size="2.2" text-anchor="middle">${esc(p.name)}</text>`);
    }
  }
  parts.push(`<g>${g.join('')}</g>`);

  // reference + value
  if (!inst.refHidden) {
    const [rx, ry] = inst.refAt || [inst.x, inst.y - 3];
    parts.push(`<text x="${fmt(rx)}" y="${fmt(ry)}" fill="#e8eef6" font-size="2.6" font-weight="700">${esc(inst.ref)}</text>`);
  }
  if (!inst.valHidden && inst.value) {
    const [vx, vy] = inst.valAt || [inst.x, inst.y + 3];
    parts.push(`<text x="${fmt(vx)}" y="${fmt(vy)}" fill="#9fb0c2" font-size="2.2">${esc(inst.value)}</text>`);
  }
}

// ---- no-connect markers (an X)
for (const [x, y] of noConnects) {
  const s = 1.1;
  parts.push(`<path d="M${fmt(x - s)} ${fmt(y - s)} L${fmt(x + s)} ${fmt(y + s)} M${fmt(x - s)} ${fmt(y + s)} L${fmt(x + s)} ${fmt(y - s)}" stroke="${NC}" stroke-width="1"/>`);
}

// ---- labels
for (const l of labels) {
  const rot = l.rot === 90 ? -90 : l.rot === 180 ? 180 : 0;
  parts.push(`<text x="${fmt(l.x)}" y="${fmt(l.y)}" fill="${LABEL}" font-size="2.4" font-family="ui-monospace,monospace" transform="rotate(${rot} ${fmt(l.x)} ${fmt(l.y)})">${esc(l.text)}</text>`);
}

// ------------------------------------------------------------------ assemble
const svg =
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(VB.x)} ${fmt(VB.y)} ${fmt(VB.w)} ${fmt(VB.h)}" font-family="ui-monospace,Menlo,Consolas,monospace">
${parts.join('\n')}
</svg>
`;
fs.writeFileSync(OUT_SVG, svg);

const title = (() => { const tb = child(root, 'title_block'); return tb ? V(child(tb, 'title')[1]) : 'Schematic'; })();
const html =
`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} &mdash; SVG preview</title>
<style>
  body{margin:0;background:#0b0f14;color:#cfd8e3;font:13px ui-monospace,Menlo,Consolas,monospace}
  header{padding:12px 18px;border-bottom:1px solid #26313d;position:sticky;top:0;background:#11161d;z-index:5}
  h1{margin:0;font-size:15px} h1 span{color:#7f93a8;font-weight:400;font-size:12px}
  .lg{display:flex;gap:16px;margin-top:6px;font-size:11px;color:#7f93a8;flex-wrap:wrap}
  .lg i{display:inline-block;width:11px;height:2px;vertical-align:middle;margin-right:5px}
  .wrap{padding:14px 18px;overflow:auto}
  svg{width:1800px;height:auto;background:#0b0f14;border:1px solid #26313d;border-radius:10px}
  .hint{color:#7f93a8;font-size:11px;margin:0 0 10px}
</style></head>
<body>
<header>
  <h1>${esc(title)} <span>&middot; rendered from ProteinDispenser_Controller.kicad_sch</span></h1>
  <div class="lg">
    <span><i style="background:#2f9e6e"></i>wire</span>
    <span><i style="background:#8a2be2"></i>symbol / pin</span>
    <span><i style="background:#d08a2c"></i>net label</span>
    <span><i style="background:#e0503c"></i>no-connect</span>
    <span>&#9679; junction</span>
  </div>
</header>
<div class="wrap">
  <p class="hint">${instances.length} symbols &middot; ${wires.length} wires &middot; ${labels.length} labels &middot; ${noConnects.length} no-connects &middot; ${junctions.length} junctions &middot; ${new Set(labels.map(l=>l.text)).size} named nets</p>
  ${svg}
</div>
</body></html>
`;
fs.writeFileSync(OUT_HTML, html);

console.log(`rendered ${instances.length} symbols, ${wires.length} wires, ${labels.length} labels, ${noConnects.length} no-connects`);
console.log(`  -> ${path.relative(process.cwd(), OUT_SVG)}`);
console.log(`  -> ${path.relative(process.cwd(), OUT_HTML)}`);
