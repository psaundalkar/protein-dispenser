'use strict';
/*
 * emit.js - turns the placed symbol list + net list into KiCad 7/8 s-expressions.
 *
 * Wiring strategy: rather than routing point-to-point across 56 symbols (which
 * is brittle), every net is realised as a short labeled stub on each of its
 * pins. Two pins share a net iff they carry the same label. This is standard
 * KiCad practice for dense boards and produces a schematic that is electrically
 * complete and ERC-clean.
 */

const FONT = '(effects (font (size 1.27 1.27)))';
const FONT_H = '(effects (font (size 1.27 1.27)) hide)';
const FONT_L = '(effects (font (size 1.27 1.27)) (justify left))';

function fnum(n) {
  const s = (Math.round(n * 10000) / 10000).toString();
  return s === '-0' ? '0' : s;
}

// ---------- lib_symbols ----------
function emitLibSymbols(sheet) {
  const out = [];
  out.push('  (lib_symbols');
  for (const s of sheet.list()) {
    const [lib, name] = s.libId.split(':');
    const isPower = s.power;
    out.push(`    (symbol "${lib}:${name}"`);
    if (isPower) out.push('      (power)');
    if (s.pinNumbersVisible === false) out.push('      (pin_numbers hide)');
    const nameOff = s.pinNameOffset ?? 0.508;
    if (s.pinNamesVisible === false) out.push(`      (pin_names (offset ${fnum(nameOff)}) hide)`);
    else out.push(`      (pin_names (offset ${fnum(nameOff)}))`);
    out.push('      (exclude_from_sim no)');
    out.push('      (in_bom yes)');
    out.push('      (on_board yes)');

    // properties of the library symbol
    out.push(`      (property "Reference" "${s.refPrefix}" (at 0 0 0) ${FONT})`);
    out.push(`      (property "Value" "${name}" (at 0 0 0) ${FONT})`);
    out.push(`      (property "Footprint" "" (at 0 0 0) ${FONT_H})`);
    out.push(`      (property "Datasheet" "" (at 0 0 0) ${FONT_H})`);

    // graphics in a sub-symbol body
    out.push(`      (symbol "${name}_0_1"`);
    for (const g of s.graphics) out.push(g);
    if (s.body) {
      const [x1, y1, x2, y2] = s.body;
      out.push(`        (rectangle (start ${fnum(x1)} ${fnum(y1)}) (end ${fnum(x2)} ${fnum(y2)})`);
      out.push('          (stroke (width 0.254) (type default)) (fill (type background)))');
    }
    out.push('      )');

    // pins in a second sub-symbol
    out.push(`      (symbol "${name}_1_1"`);
    for (const p of s.pins) {
      const o = { R: 0, L: 180, U: 90, D: 270 }[p.orient];
      const visible = p.name === '~' ? '' : '';
      out.push(`        (pin passive line (at ${fnum(p.x)} ${fnum(p.y)} ${o}) (length ${fnum(p.len)})`);
      const neff = p.name === '~' ? '(effects (font (size 1.27 1.27)))' : '(effects (font (size 1.27 1.27)))';
      out.push(`          (name "${p.name}" ${neff})`);
      out.push(`          (number "${p.num}" ${neff})`);
      out.push('        )');
    }
    out.push('      )');
    out.push('    )');
  }
  out.push('  )');
  return out.join('\n');
}

// ---------- placed symbol instance ----------
function emitInstance(inst, uuid) {
  const s = inst.sym;
  const [lib, name] = s.libId.split(':');
  const out = [];
  out.push(`  (symbol (lib_id "${s.libId}") (at ${fnum(inst.x)} ${fnum(inst.y)} ${inst.rot}) (unit 1)`);
  out.push('    (exclude_from_sim no) (in_bom yes) (on_board yes) (dnp no)');
  out.push(`    (uuid "${uuid}")`);

  const fp = inst.props.footprint || '';
  // Reference / Value placed above the symbol
  out.push(`    (property "Reference" "${inst.ref}" (at ${fnum(inst.x)} ${fnum(inst.y - 12)} 0)`);
  out.push(`      (effects (font (size 1.27 1.27)) (justify left))`);
  out.push('    )');
  out.push(`    (property "Value" "${inst.value}" (at ${fnum(inst.x)} ${fnum(inst.y - 10)} 0)`);
  out.push(`      (effects (font (size 1.27 1.27)) (justify left))`);
  out.push('    )');
  out.push(`    (property "Footprint" "${fp}" (at ${fnum(inst.x)} ${fnum(inst.y)} 0)`);
  out.push(`      (effects (font (size 1.27 1.27)) hide)`);
  out.push('    )');
  out.push(`    (property "Datasheet" "" (at ${fnum(inst.x)} ${fnum(inst.y)} 0)`);
  out.push(`      (effects (font (size 1.27 1.27)) hide)`);
  out.push('    )');

  // pin uuid entries
  for (const p of s.pins) {
    out.push(`    (pin "${p.num}" (uuid "${uuid}${p.num}"))`);
  }
  out.push(`    (instances`);
  out.push(`      (project "ProteinDispenser_Controller"`);
  out.push(`        (path "/" (reference "${inst.ref}") (unit 1))`);
  out.push(`      )`);
  out.push(`    )`);
  out.push('  )');
  return out.join('\n');
}

// ---------- wire ----------
function emitWire(a, b, uuid) {
  return [
    `  (wire (pts (xy ${fnum(a[0])} ${fnum(a[1])}) (xy ${fnum(b[0])} ${fnum(b[1])}))`,
    `    (stroke (width 0) (type default))`,
    `    (uuid "${uuid}")`,
    `  )`,
  ].join('\n');
}

function emitJunction(a, uuid) {
  return [
    `  (junction (at ${fnum(a[0])} ${fnum(a[1])}) (diameter 0) (color 0 0 0 0)`,
    `    (uuid "${uuid}")`,
    `  )`,
  ].join('\n');
}

function emitLabel(text, at, rot, uuid) {
  const just = rot === 180 ? '(justify right bottom)' : rot === 90 ? '(justify left bottom)' : '(justify left bottom)';
  return [
    `  (label "${text}" (at ${fnum(at[0])} ${fnum(at[1])} ${rot})`,
    `    (effects (font (size 1.27 1.27)) ${just})`,
    `    (uuid "${uuid}")`,
    `  )`,
  ].join('\n');
}

// ---------- no-connect marker ----------
function emitNoConnect(xy, uuid) {
  return `  (no_connect (at ${fnum(xy[0])} ${fnum(xy[1])}) (uuid "${uuid}"))`;
}

module.exports = { emitLibSymbols, emitInstance, emitWire, emitJunction, emitLabel, emitNoConnect, fnum };
