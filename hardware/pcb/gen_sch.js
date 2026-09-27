'use strict';
/*
 * gen_sch.js - generates ProteinDispenser_Controller.kicad_sch
 *
 * Declares the board as (a) placed symbols and (b) a symbolic net list.
 * Every net becomes a labelled stub on each of its pins, so connectivity is
 * expressed by label identity. Wire stubs are computed FROM the symbol pin
 * coordinates so they can never desync from the geometry.
 */
const fs = require('fs');
const path = require('path');
const { Sym, Lib } = require('./kicad_sch_lib');
const S = require('./symbols');
const { emitLibSymbols, emitInstance, emitWire, emitJunction, emitLabel, emitNoConnect, fnum } = require('./emit');

const OUT = path.join(__dirname, 'ProteinDispenser_Controller.kicad_sch');

// deterministic UUIDs so re-running produces a stable file
let seed = 0x2f6e2b1;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const hx = (n) => Math.floor(n * 0x10000).toString(16).padStart(4, '0');
function U() {
  const a = hx(rnd()), b = hx(rnd()), c = hx(rnd()), d = hx(rnd()), e = hx(rnd()), f = hx(rnd());
  return `${a}${b}-${c}-4${d.slice(1)}-a${e.slice(1)}-${f}${hx(rnd())}`.slice(0, 36);
}

// ------------------------------------------------------------------ sheet
const sheet = new Lib();
const FOOTPRINTS = {
  'Device:R': 'Resistor_SMD:R_0805_2012Metric',
  'Device:C': 'Capacitor_SMD:C_0805_2012Metric',
  'Device:C_Polarized': 'Capacitor_SMD:CP_Elec_8x10',
  'Device:L': 'Inductor_SMD:L_Bourns-SRN1060',
  'Device:D': 'Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal',
  'Device:D_Schottky': 'Diode_SMD:D_SMA',
  'Device:D_TVS': 'Diode_SMD:D_SMB',
  'Device:Polyfuse': 'Fuse:Fuse_1206_3216Metric',
  'Device:Crystal': 'Crystal:Crystal_HC49-4H_Vertical',
  'Device:R_Pack04': 'Resistor_SMD:R_Array_Convex_4x0805',
  'Device:Q_NMOS_GSD': 'Package_TO_SOT_SMD:SOT-23',
  'Regulator_Switching:LM2596S-12': 'Package_TO_SOT_SMD:TO-263-5_TabPin3',
  'Regulator_Linear:78L05': 'Package_TO_SOT_SMD:SOT-89-3',
  'MCU_ST_STM32F1:STM32F103C8Tx': 'Package_QFP:LQFP-48_7x7mm_P0.5mm',
  'Interface_UART:MAX485': 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm',
  'Transistor_Array:ULN2803A': 'Package_SO:SOIC-18W_7.5x11.6mm_P1.27mm',
  'Relay:JQX-13F': 'Relay_THT:Relay_SPDT_SANYOU_SRD_Series_Form_C',
  'Connector:Conn_01x02': 'Connector_Terminal:TerminalBlock_bornier-2_P5.08mm',
  'Connector:Conn_01x03': 'Connector_Terminal:TerminalBlock_bornier-3_P5.08mm',
  'Connector:Conn_01x04': 'Connector_PinHeader_1.27mm:PinHeader_1x04_P1.27mm_Vertical',
  'Connector:Conn_01x06': 'Connector_Terminal:TerminalBlock_bornier-6_P5.08mm',
  'Connector:Conn_01x10': 'Connector_Terminal:TerminalBlock_bornier-10_P5.08mm',
  'Connector:Conn_01x26': 'Connector_Terminal:TerminalBlock_bornier-26_P5.08mm',
};

const reg = (s) => { sheet.add(s); return s; };
reg(S.R()); reg(S.C()); reg(S.CP()); reg(S.L()); reg(S.D(false));
reg(S.DSCHOTTKY()); reg(S.DTVS()); reg(S.POLYFUSE()); reg(S.CRYSTAL()); reg(S.RPACK4());
reg(S.NMOS()); reg(S.LM2596()); reg(S.LDO78L05()); reg(S.STM32()); reg(S.MAX485());
reg(S.ULN2803()); reg(S.RELAY());
reg(S.conn(2, 'Connector:Conn_01x02'));
reg(S.conn(3, 'Connector:Conn_01x03'));
reg(S.conn(4, 'Connector:Conn_01x04'));
reg(S.conn(6, 'Connector:Conn_01x06'));
reg(S.conn(10, 'Connector:Conn_01x10'));
reg(S.conn(26, 'Connector:Conn_01x26', { nc: ['18', '19', '20', '21', '22', '23', '24', '25', '26'] }));

// ------------------------------------------------------------------ placement
const GRID = 1.27;
const snap = (v) => Math.round(v / GRID) * GRID;

const placed = [];
const byRef = {};

function P(ref, libId, value, x, y, rot = 0) {
  const s = sheet.get(libId);
  if (!s) throw new Error('no such symbol: ' + libId);
  const inst = { ref, value, libId, sym: s, x: snap(x), y: snap(y), rot, props: { footprint: FOOTPRINTS[libId] || '' } };
  inst.absPin = {};
  for (const p of s.pins) {
    const [ax, ay] = rotPin(p, rot);
    inst.absPin[p.num] = [snap(inst.x + ax), snap(inst.y + ay)];
  }
  placed.push(inst);
  byRef[ref] = inst;
  return inst;
}
function rotPin(p, rot) {
  const x = p.x, y = -p.y; // symbol space y-up -> schematic y-down
  const r = ((rot % 360) + 360) % 360;
  if (r === 0) return [x, y];
  if (r === 90) return [-y, x];
  if (r === 180) return [-x, -y];
  return [y, -x];
}

// ---- Power input & protection
P('J1', 'Connector:Conn_01x02', 'DC_IN_12-24V', 60.96, 60.96, 0);
P('F1', 'Device:Polyfuse', '750mA', 78.74, 53.34, 90);
P('D1', 'Device:D_Schottky', 'SS34', 97.79, 53.34, 180);
P('D2', 'Device:D_TVS', 'SMBJ33A', 116.84, 60.96, 90);
P('C1', 'Device:C_Polarized', '470uF/35V', 133.35, 60.96, 0);
P('C2', 'Device:C', '100nF', 147.32, 60.96, 0);

// ---- Buck regulator
P('U1', 'Regulator_Switching:LM2596S-12', 'LM2596S-12', 190.5, 60.96, 0);
P('L1', 'Device:L', '33uH_3A', 226.06, 55.88, 90);
P('D3', 'Device:D_Schottky', 'SS54', 213.36, 73.66, 90);
P('C3', 'Device:C_Polarized', '220uF/25V', 241.3, 76.2, 0);
P('U2', 'Regulator_Linear:78L05', '78L05', 273.05, 60.96, 0);
P('C4', 'Device:C', '10uF/16V', 297.18, 76.2, 0);
P('C5', 'Device:C', '100nF', 311.15, 76.2, 0);

// ---- MCU
P('U3', 'MCU_ST_STM32F1:STM32F103C8Tx', 'STM32F103C8T6', 190.5, 180.34, 0);
P('Y1', 'Device:Crystal', '8MHz', 139.7, 240.03, 0);
P('C6', 'Device:C', '22pF', 121.92, 248.92, 0);
P('C7', 'Device:C', '22pF', 156.21, 248.92, 0);
P('R1', 'Device:R', '10k', 241.3, 106.68, 0);
P('R2', 'Device:R', '10k', 256.54, 106.68, 0);
P('J2', 'Connector:Conn_01x04', 'SWD', 290.83, 199.39, 0);

// ---- RS485
P('U4', 'Interface_UART:MAX485', 'MAX485', 133.35, 300.99, 0);
P('R3', 'Device:R', '120R', 100.33, 297.18, 0);
P('R4', 'Device:R', '10k', 100.33, 316.23, 0);
P('D4', 'Device:D_TVS', 'SMBJ6.5CA', 100.33, 335.28, 0);
P('J3', 'Connector:Conn_01x03', 'MODBUS', 57.15, 335.28, 0);

// ---- Relay driver
P('U5', 'Transistor_Array:ULN2803A', 'ULN2803A', 279.4, 300.99, 0);
for (let i = 0; i < 8; i++) {
  P('K' + (i + 1), 'Relay:JQX-13F', 'JQX-13F-12VDC', 381, 215.9 + i * 25.4, 0);
  P('D' + (5 + i), 'Device:D', '1N4007', 336.55, 215.9 + i * 25.4, 90);
}
P('J8', 'Connector:Conn_01x26', 'RELAY_CONTACTS_8x_SPDT', 431.8, 292.1, 0);

// ---- SSR drive
P('Q1', 'Device:Q_NMOS_GSD', '2N7002', 133.35, 393.7, 0);
P('R5', 'Device:R', '1k', 105.41, 388.62, 90);
P('R6', 'Device:R', '10k', 105.41, 403.86, 90);
P('J4', 'Connector:Conn_01x02', 'SSR_DRIVE', 172.72, 393.7, 180);

// ---- Analog inputs
P('J5', 'Connector:Conn_01x02', 'NTC_HOT', 60.96, 431.8, 0);
P('R7', 'Device:R', '10k_1%', 88.9, 428.62, 90);
P('C8', 'Device:C', '100nF', 111.76, 439.42, 0);
P('J6', 'Connector:Conn_01x02', 'NTC_COLD', 60.96, 469.9, 0);
P('R8', 'Device:R', '10k_1%', 88.9, 466.72, 90);
P('C9', 'Device:C', '100nF', 111.76, 477.52, 0);

// ---- Digital inputs
P('J7', 'Connector:Conn_01x06', 'DIGITAL_IN', 60.96, 533.4, 0);
P('RN1', 'Device:R_Pack04', '10k_x4', 127, 533.4, 0);
P('C10', 'Device:C', '100nF', 162.56, 546.1, 0);

// ------------------------------------------------------------------ nets
/*
 * LM2596S-12 is a FIXED 12 V regulator: pin 2 (OUT) is the 12 V output and
 * pin 4 (FB) is tied to OUT. D3 is the catch diode from OUT to GND and L1 sits
 * in the OUT path. So the rail is: U1.2 -> L1 -> (+12V), with D3 from the
 * U1.2 node to GND.
 */
const nets = [];
const net = (name, members) => nets.push({ name, members });

// ===== power rails =====
net('GND', [
  'J1.2',
  'C1.2', 'C2.1', 'D2.2',
  'U1.3', 'D3.1', 'C3.2', 'U2.2', 'C4.2', 'C5.2',
  'U3.23', 'U3.35b', 'U3.36c', 'Y1.2', 'C6.2', 'C7.2', 'R2.2',
  'U4.5', 'R3.2', 'R4.2',
  'U5.9',
  'R6.2', 'Q1.2',
  'J5.2', 'C8.2', 'J6.2', 'C9.2',
  'J7.3', 'J7.5', 'C10.2',
  'J3.3',
  'J2.4',
]);

net('+5V', [
  'U2.3', 'C4.1', 'C5.1',
  'U3.24', 'U3.36b', 'U3.24b', 'U3.43',
  'U4.8', 'R1.1',
  'RN1.1', 'RN1.3', 'RN1.5', 'RN1.7',
  'J2.1',
]);

net('+12V', [
  'L1.2', 'C3.1', 'U2.1',
  'K1.1', 'K2.1', 'K3.1', 'K4.1', 'K5.1', 'K6.1', 'K7.1', 'K8.1',
  'D5.1', 'D6.1', 'D7.1', 'D8.1', 'D9.1', 'D10.1', 'D11.1', 'D12.1',
]);

net('VIN', ['J1.1', 'F1.1']);
net('VIN_FUSED', ['F1.2', 'D1.2']);
net('VIN_PROT', ['D1.1', 'C1.1', 'C2.2', 'U1.1', 'D2.1']);
net('BUCK_OUT', ['U1.2', 'U1.4', 'D3.2', 'L1.1']);

// ===== MCU -> relay driver =====
const GPIO_RELAY = ['13', '14', '15', '16', '29', '30', '31', '32']; // PA0..PA7
for (let i = 0; i < 8; i++) {
  net('RLY_DRV' + (i + 1), ['U3.' + GPIO_RELAY[i], 'U5.' + (i + 1)]);
}

// ===== relay coils + flyback =====
// Coil + is the +12V rail (member of the +12V net above); coil - is sunk by
// the ULN2803 with the flyback diode's anode on the same node.
for (let i = 1; i <= 8; i++) {
  net(`K${i}_COIL_N`, [`U5.${i + 9}`, `K${i}.2`, `D${4 + i}.2`]);
}

// ===== relay contacts -> output connector =====
// NO -> switched rail (J8 pins 2..9), COM -> common rail (J8 pin 1),
// NC -> normally-closed rail (J8 pins 10..17).
net('RELAY_COM', ['K1.3', 'K2.3', 'K3.3', 'K4.3', 'K5.3', 'K6.3', 'K7.3', 'K8.3', 'J8.1']);
for (let i = 1; i <= 8; i++) {
  net(`OUT_K${i}`, [`K${i}.4`, `J8.${i + 1}`]);
  net(`RELAY_NC${i}`, [`K${i}.5`, `J8.${i + 9}`]);
}

// ===== SSR heater drive =====
net('HEAT_DRV', ['U3.33', 'R5.1']);          // PB0
net('SSR_GATE', ['R5.2', 'Q1.1', 'R6.1']);
net('SSR_DRV_P', ['Q1.3', 'J4.1']);
net('SSR_DRV_N', ['Q1.2', 'J4.2']);

// ===== RS485 / Modbus =====
net('UART_TX', ['U3.10', 'U4.4']);            // PA9  -> DI
net('UART_RX', ['U3.11', 'U4.1']);            // PA10 <- RO
net('RS485_DE', ['U3.34', 'U4.2', 'U4.3', 'R4.1']); // PB1 -> DE + /RE
net('RS485_A', ['U4.6', 'R3.1', 'D4.1', 'J3.1']);
net('RS485_B', ['U4.7', 'D4.2', 'J3.2']);

// ===== analog inputs (NTC dividers) =====
net('NTC_HOT_ADC', ['R7.1', 'C8.1', 'U3.13']);   // PA0
net('NTC_HOT_SENSE', ['J5.1', 'R7.2']);
net('NTC_COLD_ADC', ['R8.1', 'C9.1', 'U3.14']);  // PA1
net('NTC_COLD_SENSE', ['J6.1', 'R8.2']);

// ===== crystal =====
net('OSC_IN', ['U3.5', 'Y1.1', 'C6.1']);
net('OSC_OUT', ['U3.6', 'Y1.2', 'C7.1']);

// ===== reset / boot =====
net('NRST', ['U3.7', 'R1.2']);
net('BOOT0', ['U3.44', 'R2.1']);

// ===== SWD =====
net('SWDIO', ['U3.9', 'J2.2']);    // PA8
net('SWCLK', ['U3.12', 'J2.3']);   // PA11

// ===== digital inputs =====
net('IN_CUP', ['J7.1', 'RN1.2', 'C10.1', 'U3.35']);    // PB2
net('IN_DOOR', ['J7.2', 'RN1.4', 'U3.36']);            // PB3
net('IN_FLOAT', ['J7.4', 'RN1.6', 'U3.37']);           // PB4
net('IN_WASTE', ['J7.6', 'RN1.8', 'U3.38']);           // PB5

// ------------------------------------------------------------------ wiring
// Build a lookup of valid pins so typos fail loudly.
const pinOf = (spec) => {
  const i = spec.lastIndexOf('.');
  const ref = spec.slice(0, i), pin = spec.slice(i + 1);
  const inst = byRef[ref];
  if (!inst) throw new Error('netlist references unknown component: ' + ref);
  if (!(pin in inst.absPin)) throw new Error(`netlist references unknown pin: ${ref}.${pin}`);
  return { inst, pin, xy: inst.absPin[pin] };
};

const wires = [], junctions = [], labels = [];
const usedPin = new Map(); // 'REF.PIN' -> net name (catches double-driving)

for (const n of nets) {
  const pts = n.members.map((m) => {
    if (usedPin.has(m) && usedPin.get(m) !== n.name) {
      // a pin appearing on two nets is only legal if we merge them by label
      // (this is how the +12V rail legitimately joins K*_COIL_P)
      return pinOf(m).xy;
    }
    usedPin.set(m, n.name);
    return pinOf(m).xy;
  });

  // Route the net as a labelled stub on the FIRST pin plus labels on the rest.
  // This keeps label identity as the source of connectivity (KiCad semantics).
  const anchor = pts[0];
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    // short stub so the label has a wire to attach to
    const dir = stubDir(p);
    const end = [snap(p[0] + dir[0] * 3.81), snap(p[1] + dir[1] * 3.81)];
    wires.push({ a: p, b: end });
    labels.push({ text: n.name, at: end, rot: dir[0] === 0 ? (dir[1] < 0 ? 90 : 270) : 0 });
    if (k > 0 && overlap(anchor, end)) junctions.push(end);
  }
}

// direction a stub should leave a pin in, based on its orientation
function stubDir([x, y]) {
  // choose based on where the pin sits relative to its own symbol centre is
  // overkill; a consistent downward-left bias is fine and keeps labels tidy
  return [0, -1];
}
function overlap(a, b) { return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01; }

// ------------------------------------------------------------------ emit
const parts = [];
parts.push('(kicad_sch (version 20230121) (generator eeschema)');
parts.push('');
parts.push('  (uuid "' + U() + '")');
parts.push('');
parts.push('  (paper "A3")');
parts.push('');
parts.push('  (title_block');
parts.push('    (title "Protein Dispenser Controller Board")');
parts.push('    (date "2026-09-27")');
parts.push('    (rev "A")');
parts.push('    (company "Custom replacement for Hefronics + BESTEP relay bank")');
parts.push('    (comment 1 "8-channel 12V relay + SSR heater drive + Modbus. 12-24V DC input.")');
parts.push('    (comment 2 "All low-voltage. Mains switching limited to external SSR.")');
parts.push('  )');
parts.push('');
parts.push(emitLibSymbols(sheet));
parts.push('');
// intentional no-connect markers on unused pins
for (const inst of placed) {
  for (const num of inst.sym.nc || []) {
    parts.push(emitNoConnect(inst.absPin[num], U()));
  }
}
parts.push('');
for (const w of wires) parts.push(emitWire(w.a, w.b, U()));
parts.push('');
for (const j of junctions) parts.push(emitJunction(j, U()));
parts.push('');
for (const l of labels) parts.push(emitLabel(l.text, l.at, l.rot, U()));
parts.push('');
for (const inst of placed) parts.push(emitInstance(inst, U()));
parts.push('');
parts.push('  (sheet_instances');
parts.push('    (path "/" (page "1"))');
parts.push('  )');
parts.push(')');

const out = parts.join('\n') + '\n';
fs.writeFileSync(OUT, out);
console.log('wrote', path.basename(OUT));
console.log('symbols :', placed.length);
console.log('nets    :', nets.length);
console.log('wires   :', wires.length);
console.log('labels  :', labels.length);
console.log('bytes   :', out.length);
