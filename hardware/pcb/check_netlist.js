'use strict';
// Sanity-check the KiCad netlist: balanced parens, unique refs, footprints, values.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'controller.net'), 'utf8');

// ---- 1. paren balance ----
let depth = 0, inStr = false;
for (const ch of src) {
  if (ch === '"') inStr = !inStr;
  if (inStr) continue;
  if (ch === '(') depth++;
  if (ch === ')') depth--;
  if (depth < 0) { console.log('paren balance : FAIL'); process.exit(1); }
}
console.log('paren balance :', depth === 0 ? 'PASS' : 'FAIL(' + depth + ')');

// ---- 2. s-expression parse ----
function parse(s) {
  let i = 0;
  const ws = (ch) => ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
  const walk = () => {
    while (ws(s[i])) i++;
    if (s[i] === '(') {
      i++; const list = [];
      for (;;) {
        while (ws(s[i])) i++;
        if (s[i] === ')') { i++; return list; }
        if (s[i] === '(') list.push(walk());
        else if (s[i] === '"') { i++; let str = ''; while (s[i] !== '"') str += s[i++]; i++; list.push(str); }
        else { let tk = ''; while (s[i] && !ws(s[i]) && s[i] !== '(' && s[i] !== ')') tk += s[i++]; list.push(tk); }
      }
    }
    return null;
  };
  return walk();
}
const ast = parse(src);

// recursive find of the first node whose head matches a tag
function find(node, tag) {
  if (!Array.isArray(node)) return null;
  if (node[0] === tag) return node;
  for (const c of node) {
    if (!Array.isArray(c)) continue;
    const r = find(c, tag);
    if (r) return r;
  }
  return null;
}

const compNode = find(ast, 'components');
if (!compNode) { console.log('components    : FAIL (not found)'); process.exit(1); }
const comps = compNode.filter((x) => Array.isArray(x) && x[0] === 'comp');
const get = (c, tag) => { const n = find(c, tag); return n ? n[1] : null; };

const refs = comps.map((c) => get(c, 'ref'));
const dups = refs.filter((r, i) => refs.indexOf(r) !== i);
const noFp = refs.filter((r, i) => !get(comps[i], 'footprint'));
const noVal = refs.filter((r, i) => !get(comps[i], 'value'));

console.log('components    :', comps.length);
console.log('refs unique   :', dups.length === 0 ? 'PASS' : 'FAIL dup=' + dups.join(','));
console.log('footprints    :', noFp.length === 0 ? 'PASS' : 'FAIL missing on ' + noFp.join(','));
console.log('values        :', noVal.length === 0 ? 'PASS' : 'FAIL missing on ' + noVal.join(','));
console.log('all refs      :', refs.join(' '));

// ---- 3. HTML deliverables ----
for (const rel of ['../wiring-diagram.html', 'schematic.html']) {
  const p = path.join(__dirname, rel);
  const t = fs.readFileSync(p, 'utf8');
  const o = (t.match(/<svg/g) || []).length;
  const c = (t.match(/<\/svg>/g) || []).length;
  const tbl = (t.match(/<table>/g) || []).length;
  console.log(path.basename(p).padEnd(22), 'svg', o + '/' + c, o === c ? 'PASS' : 'FAIL', '| tables:', tbl, '| bytes:', t.length);
}
