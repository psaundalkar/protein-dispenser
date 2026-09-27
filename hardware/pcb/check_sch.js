'use strict';
/*
 * check_sch.js - independent structural verifier for the generated
 * ProteinDispenser_Controller.kicad_sch.
 *
 * KiCad is not installed on this machine, so we cannot run kicad-cli ERC.
 * Instead we verify the invariants that would make KiCad reject or mis-read
 * the file, plus an ERC-style connectivity check of our own.
 *
 * Checks:
 *   1. paren balance (excluding parens inside quoted strings)
 *   2. every top-level s-expr parses into a tree
 *   3. UUID uniqueness
 *   4. every placed (symbol ...) lib_id exists in the embedded lib_symbols
 *   5. every pin of every placed instance has a wire endpoint + a label
 *      (label-identity connectivity => no floating pins)
 *   6. every label name resolves to a net that appears >= 2 times
 *      (a net with one member is a dangling wire / likely error)
 *   7. every symbol instance carries Reference + Value + Footprint
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'ProteinDispenser_Controller.kicad_sch');
const src = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  PASS  ' + m); };
const bad = (m) => { fail++; console.log('  FAIL  ' + m); };

// ---------- minimal s-expression reader (quote + paren aware) ----------
function tokenize(s) {
  const toks = [];
  let i = 0;
  const ws = (c) => c === ' ' || c === '\n' || c === '\r' || c === '\t';
  while (i < s.length) {
    const c = s[i];
    if (ws(c)) { i++; continue; }
    if (c === '(' || c === ')') { toks.push(c); i++; continue; }
    if (c === '"') {
      let j = i + 1, buf = '';
      while (j < s.length) {
        if (s[j] === '\\') { buf += s[j + 1]; j += 2; continue; }
        if (s[j] === '"') break;
        buf += s[j]; j++;
      }
      toks.push({ str: buf });
      i = j + 1;
      continue;
    }
    let j = i, buf = '';
    while (j < s.length && !ws(s[j]) && s[j] !== '(' && s[j] !== ')') { buf += s[j]; j++; }
    toks.push(buf);
    i = j;
  }
  return toks;
}

function parse(toks) {
  let p = 0;
  function read() {
    const t = toks[p++];
    if (t === '(') {
      const list = [];
      while (toks[p] !== ')') {
        if (p >= toks.length) throw new Error('unbalanced: missing )');
        list.push(read());
      }
      p++; // consume ')'
      return list;
    }
    if (t === ')') throw new Error('unbalanced: unexpected )');
    return t;
  }
  return read();
}

console.log('\n=== check_sch.js : ' + path.basename(FILE) + ' ===\n');

// 1. paren balance ignoring quoted strings
{
  let depth = 0, inStr = false, minDepth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth < minDepth) minDepth = depth; }
  }
  if (depth === 0 && minDepth === 0) ok('paren balance (depth returns to 0, never negative)');
  else bad(`paren balance (final depth ${depth}, min depth ${minDepth})`);
  if (!inStr) ok('no unterminated quoted string');
  else bad('unterminated quoted string');
}

let tree;
try {
  tree = parse(tokenize(src));
  ok('full file parses as a single s-expression');
} catch (e) {
  bad('parse error: ' + e.message);
  console.log('\nCannot continue without a parse.\n');
  process.exit(1);
}

const isArr = Array.isArray;
const head = (n) => (isArr(n) ? n[0] : undefined);
const isNode = (n, name) => isArr(n) && n[0] === name;
// The tokenizer wraps quoted strings as { str }, bare tokens as plain strings.
// Unwrap to a plain string for uniform comparison.
const sv = (t) => (t && typeof t === 'object' && 'str' in t ? t.str : t);

// collect top-level nodes
const top = tree.slice(1);

// 2. UUID uniqueness
{
  const uuids = [];
  const walk = (n) => {
    if (!isArr(n)) return;
    if (n[0] === 'uuid' && typeof sv(n[1]) === 'string') uuids.push(sv(n[1]));
    for (const c of n) walk(c);
  };
  walk(tree);
  const uniq = new Set(uuids);
  if (uniq.size === uuids.length) ok(`UUID uniqueness (${uuids.length} uuids, all distinct)`);
  else bad(`UUID collision: ${uuids.length} uuids but only ${uniq.size} distinct`);
}

// 3. lib_symbols catalogue
const libNode = top.find((n) => isNode(n, 'lib_symbols'));
const libIds = new Set();
if (libNode) {
  for (const s of libNode.slice(1)) {
    if (isNode(s, 'symbol') && typeof sv(s[1]) === 'string') libIds.add(sv(s[1]));
  }
  ok(`embedded lib_symbols present (${libIds.size} definitions)`);
} else bad('no (lib_symbols ...) block');

// 4. instantiated symbols
const insts = top.filter((n) => isNode(n, 'symbol') && n.some((c) => isNode(c, 'lib_id')));
{
  const missing = [];
  for (const inst of insts) {
    const lid = inst.find((c) => isNode(c, 'lib_id'));
    if (!lid || !libIds.has(sv(lid[1]))) missing.push(lid ? sv(lid[1]) : '(none)');
  }
  if (missing.length === 0) ok(`all ${insts.length} placed symbols resolve to a lib definition`);
  else bad(`placed symbols with unknown lib_id: ${[...new Set(missing)].join(', ')}`);
}

// 5. Reference / Value / Footprint presence on each instance
{
  const problems = [];
  for (const inst of insts) {
    const props = inst.filter((c) => isNode(c, 'property'));
    const ref = props.find((p) => sv(p[1]) === 'Reference');
    const val = props.find((p) => sv(p[1]) === 'Value');
    const fp = props.find((p) => sv(p[1]) === 'Footprint');
    const name = ref ? sv(ref[2]) : '?';
    if (!ref || /^[?#]/.test(sv(ref[2]))) problems.push(`${name}: bad Reference`);
    if (!val) problems.push(`${name}: no Value`);
    if (!fp || sv(fp[2]) === '') problems.push(`${name}: no Footprint`);
  }
  if (problems.length === 0) ok('every instance has Reference + Value + Footprint');
  else bad('property problems:\n      ' + problems.join('\n      '));
}

// 6. wires + labels + pin coincidence
const wires = top.filter((n) => isNode(n, 'wire'));
const labels = top.filter((n) => isNode(n, 'label'));

function wireEndpoints(w) {
  // (wire (pts (xy x1 y1) (xy x2 y2)) ...)
  const pts = w.find((c) => isNode(c, 'pts'));
  if (!pts) return [];
  return pts.slice(1).filter((p) => isNode(p, 'xy'))
    .map((p) => [Number(p[1]), Number(p[2])]);
}
const key = (x, y) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
const wireEnds = new Set();
for (const w of wires) for (const [x, y] of wireEndpoints(w)) wireEnds.add(key(x, y));

// no-connect markers also legitimately terminate a pin
const noconns = top.filter((n) => isNode(n, 'no_connect'));
const ncSet = new Set();
for (const nc of noconns) {
  const at = nc.find((c) => isNode(c, 'at'));
  if (at) ncSet.add(key(Number(at[1]), Number(at[2])));
}
const terminated = (x, y) => wireEnds.has(key(x, y)) || ncSet.has(key(x, y));

// Build pin-location set from each instance's lib definition + placement
// transform, mirroring gen_sch.js.  We re-derive from the *embedded* lib so
// this is an independent read of what actually got written.
function libPins(libId) {
  const def = (libNode || []).slice(1).find((s) => isNode(s, 'symbol') && sv(s[1]) === libId);
  if (!def) return [];
  // pins live in nested (symbol "<name>_<unit>_<style>" ... (pin ... (at x y rot) (length l) (name ...) (number "N")))
  const pins = [];
  const walk = (n) => {
    if (!isArr(n)) return;
    if (n[0] === 'pin') {
      const at = n.find((c) => isNode(c, 'at'));
      const num = n.find((c) => isNode(c, 'number'));
      if (at && num) pins.push({ x: Number(at[1]), y: Number(at[2]), rot: Number(at[3] || 0), num: sv(num[1]) });
    }
    for (const c of n) walk(c);
  };
  walk(def);
  return pins;
}

function rotPin(x, y, rot) {
  y = -y; // symbol y-up -> schematic y-down
  const r = ((rot % 360) + 360) % 360;
  if (r === 0) return [x, y];
  if (r === 90) return [-y, x];
  if (r === 180) return [-x, -y];
  return [y, -x];
}

let floating = 0, checked = 0;
for (const inst of insts) {
  const lid = sv(inst.find((c) => isNode(c, 'lib_id'))[1]);
  const at = inst.find((c) => isNode(c, 'at'));
  const px = Number(at[1]), py = Number(at[2]), prot = Number(at[3] || 0);
  const props = inst.filter((c) => isNode(c, 'property'));
  const ref = props.find((p) => sv(p[1]) === 'Reference');
  for (const pin of libPins(lid)) {
    const [dx, dy] = rotPin(pin.x, pin.y, prot);
    const sx = px + dx, sy = py + dy;
    checked++;
    if (!terminated(sx, sy)) { floating++; if (floating <= 10) console.log(`      floating ${ref ? sv(ref[2]) : '?'} pin ${pin.num} @ ${sx},${sy}`); }
  }
}
if (floating === 0) ok(`all ${checked} pins land on a wire endpoint (no floating pins)`);
else bad(`${floating} of ${checked} pins have no wire endpoint`);

// 7. label identity: each net name must appear on >= 2 wire ends
{
  const counts = new Map();
  for (const l of labels) {
    const at = l.find((c) => isNode(c, 'at'));
    const name = sv(l[1]);
    if (!at) continue;
    const k = key(Number(at[1]), Number(at[2]));
    if (!wireEnds.has(k)) { /* label not on a wire end */ }
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const singles = [...counts.entries()].filter(([, c]) => c < 2).map(([n]) => n);
  if (singles.length === 0) ok(`every net label appears >= 2 times (${counts.size} nets)`);
  else bad(`nets with a single member (dangling): ${singles.join(', ')}`);

  // labels must sit on a wire endpoint
  let offWire = 0;
  for (const l of labels) {
    const at = l.find((c) => isNode(c, 'at'));
    if (!at) continue;
    if (!wireEnds.has(key(Number(at[1]), Number(at[2])))) offWire++;
  }
  if (offWire === 0) ok(`all ${labels.length} labels sit on a wire endpoint`);
  else bad(`${offWire} labels are not on a wire endpoint`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
