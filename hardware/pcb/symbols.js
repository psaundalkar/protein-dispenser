'use strict';
/*
 * symbols.js - the symbol catalogue for the controller board.
 * Coordinates are in symbol space (y-up, mm). Pin `orient` is the direction
 * the pin stub points AWAY from the body, which is what determines where the
 * electrical connection point sits.
 */
const { Sym } = require('./kicad_sch_lib');

// ---------------------------------------------------------------- passives
const R = () => new Sym('Device:R', {
  refPrefix: 'R', pinNameOffset: 0, pinNamesVisible: false,
  graphics: [
    '    (rectangle (start -1.016 2.54) (end 1.016 -2.54)',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: '~', x: 0, y: 3.81, len: 1.27, orient: 'D' },
    { num: '2', name: '~', x: 0, y: -3.81, len: 1.27, orient: 'U' },
  ],
});

const C = () => new Sym('Device:C', {
  refPrefix: 'C', pinNameOffset: 0, pinNamesVisible: false,
  graphics: [
    '    (polyline (pts (xy -1.778 0.508) (xy 1.778 0.508))',
    '      (stroke (width 0.3048) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -1.778 -0.508) (xy 1.778 -0.508))',
    '      (stroke (width 0.3048) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: '~', x: 0, y: 3.81, len: 3.302, orient: 'D' },
    { num: '2', name: '~', x: 0, y: -3.81, len: 3.302, orient: 'U' },
  ],
});

const CP = () => new Sym('Device:C_Polarized', {
  refPrefix: 'C', pinNameOffset: 0, pinNamesVisible: false,
  graphics: [
    '    (polyline (pts (xy -1.778 0.508) (xy 1.778 0.508))',
    '      (stroke (width 0.3048) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -1.778 -0.508) (xy 1.778 -0.508))',
    '      (stroke (width 0.3048) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -2.286 1.778) (xy -1.27 1.778))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -1.778 1.27) (xy -1.778 2.286))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: '~', x: 0, y: 3.81, len: 3.302, orient: 'D' },
    { num: '2', name: '~', x: 0, y: -3.81, len: 3.302, orient: 'U' },
  ],
});

const L = () => new Sym('Device:L', {
  refPrefix: 'L', pinNameOffset: 0, pinNamesVisible: false,
  graphics: [
    '    (arc (start 0 -2.54) (mid 1.27 -1.27) (end 0 0)',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (arc (start 0 0) (mid 1.27 1.27) (end 0 2.54)',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: '~', x: 0, y: 3.81, len: 1.27, orient: 'D' },
    { num: '2', name: '~', x: 0, y: -3.81, len: 1.27, orient: 'U' },
  ],
});

const D = (filled) => new Sym('Device:D', {
  refPrefix: 'D', pinNameOffset: 0, pinNamesVisible: false,
  graphics: [
    '    (polyline (pts (xy -1.27 1.27) (xy -1.27 -1.27))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    `    (polyline (pts (xy 1.27 1.27) (xy 1.27 -1.27) (xy -1.27 0) (xy 1.27 1.27))`,
    `      (stroke (width 0.254) (type default)) (fill (type ${filled ? 'outline' : 'none'})))`,
  ],
  pins: [
    { num: '1', name: 'K', x: 3.81, y: 0, len: 2.54, orient: 'L' },
    { num: '2', name: 'A', x: -3.81, y: 0, len: 2.54, orient: 'R' },
  ],
});

const DSCHOTTKY = () => {
  const s = D(false);
  s.libId = 'Device:D_Schottky';
  s.graphics[1] = '    (polyline (pts (xy 1.27 1.27) (xy 1.27 -1.27) (xy -1.27 0) (xy 1.27 1.27))';
  s.graphics.push('      (stroke (width 0.254) (type default)) (fill (type outline)))');
  // replace closing of last polyline that we just pushed
  s.graphics = s.graphics.filter((g, i) => i !== 2);
  s.graphics = [
    '    (polyline (pts (xy -1.27 1.27) (xy -1.27 -1.27))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy 1.27 1.27) (xy 1.27 -1.27) (xy -1.27 0) (xy 1.27 1.27))',
    '      (stroke (width 0.254) (type default)) (fill (type outline)))',
    '    (polyline (pts (xy -1.905 1.27) (xy -1.27 1.27) (xy -1.27 1.905))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
  ];
  return s;
};

const DTVS = () => new Sym('Device:D_TVS', {
  refPrefix: 'D', pinNameOffset: 0, pinNamesVisible: false,
  graphics: [
    '    (polyline (pts (xy -2.54 1.016) (xy -1.27 1.016) (xy -1.27 -1.016) (xy 0 -1.016))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy 2.54 -1.016) (xy 1.27 -1.016) (xy 1.27 1.016) (xy 0 1.016))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -1.27 0) (xy 1.27 0))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: 'A1', x: 3.81, y: 0, len: 1.27, orient: 'L' },
    { num: '2', name: 'A2', x: -3.81, y: 0, len: 1.27, orient: 'R' },
  ],
});

const POLYFUSE = () => new Sym('Device:Polyfuse', {
  refPrefix: 'F', pinNameOffset: 0, pinNamesVisible: false,
  graphics: [
    '    (rectangle (start -1.016 3.81) (end 1.016 -3.81)',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -1.778 2.54) (xy 1.778 -2.54))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: '~', x: 0, y: 5.08, len: 1.27, orient: 'D' },
    { num: '2', name: '~', x: 0, y: -5.08, len: 1.27, orient: 'U' },
  ],
});

const CRYSTAL = () => new Sym('Device:Crystal', {
  refPrefix: 'Y', pinNameOffset: 0, pinNamesVisible: false,
  graphics: [
    '    (rectangle (start -1.143 2.54) (end 1.143 -2.54)',
    '      (stroke (width 0.3048) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -2.032 1.778) (xy -2.032 -1.778))',
    '      (stroke (width 0.4064) (type default)) (fill (type none)))',
    '    (polyline (pts (xy 2.032 1.778) (xy 2.032 -1.778))',
    '      (stroke (width 0.4064) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: '1', x: -3.81, y: 0, len: 1.778, orient: 'R' },
    { num: '2', name: '2', x: 3.81, y: 0, len: 1.778, orient: 'L' },
  ],
});

const RPACK4 = () => new Sym('Device:R_Pack04', {
  refPrefix: 'RN', pinNameOffset: 0, pinNamesVisible: false,
  graphics: [
    '    (rectangle (start -2.54 5.08) (end 2.54 -5.08)',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: 'R1.1', x: -7.62, y: 3.81, len: 5.08, orient: 'R' },
    { num: '2', name: 'R1.2', x: 7.62, y: 3.81, len: 5.08, orient: 'L' },
    { num: '3', name: 'R2.1', x: -7.62, y: 1.27, len: 5.08, orient: 'R' },
    { num: '4', name: 'R2.2', x: 7.62, y: 1.27, len: 5.08, orient: 'L' },
    { num: '5', name: 'R3.1', x: -7.62, y: -1.27, len: 5.08, orient: 'R' },
    { num: '6', name: 'R3.2', x: 7.62, y: -1.27, len: 5.08, orient: 'L' },
    { num: '7', name: 'R4.1', x: -7.62, y: -3.81, len: 5.08, orient: 'R' },
    { num: '8', name: 'R4.2', x: 7.62, y: -3.81, len: 5.08, orient: 'L' },
  ],
});

// ---------------------------------------------------------------- actives
const NMOS = () => new Sym('Device:Q_NMOS_GSD', {
  refPrefix: 'Q',
  graphics: [
    '    (polyline (pts (xy 0.254 1.778) (xy 0.254 -1.778))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -1.27 1.27) (xy -1.27 -1.27))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -1.27 0) (xy 0.254 0))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (circle (center 1.27 0) (radius 3.302)',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: 'G', x: -5.08, y: 0, len: 2.54, orient: 'R' },
    { num: '2', name: 'S', x: 2.54, y: -5.08, len: 2.54, orient: 'U' },
    { num: '3', name: 'D', x: 2.54, y: 5.08, len: 2.54, orient: 'D' },
  ],
});

const LM2596 = () => new Sym('Regulator_Switching:LM2596S-12', {
  refPrefix: 'U',
  graphics: [
    '    (rectangle (start -10.16 7.62) (end 10.16 -7.62)',
    '      (stroke (width 0.254) (type default)) (fill (type background)))',
  ],
  pins: [
    { num: '1', name: 'VIN', x: -15.24, y: 2.54, len: 5.08, orient: 'R' },
    { num: '2', name: 'OUT', x: 15.24, y: 2.54, len: 5.08, orient: 'L' },
    { num: '3', name: 'GND', x: 0, y: -12.7, len: 5.08, orient: 'U' },
    { num: '4', name: 'FB', x: 15.24, y: -2.54, len: 5.08, orient: 'L' },
    { num: '5', name: 'ON/OFF', x: -15.24, y: -2.54, len: 5.08, orient: 'R' },
  ],
  nc: ['5'],
});

const LDO78L05 = () => new Sym('Regulator_Linear:78L05', {
  refPrefix: 'U',
  graphics: [
    '    (rectangle (start -7.62 5.08) (end 7.62 -5.08)',
    '      (stroke (width 0.254) (type default)) (fill (type background)))',
  ],
  pins: [
    { num: '1', name: 'IN', x: -12.7, y: 0, len: 5.08, orient: 'R' },
    { num: '3', name: 'OUT', x: 12.7, y: 0, len: 5.08, orient: 'L' },
    { num: '2', name: 'GND', x: 0, y: -10.16, len: 5.08, orient: 'U' },
  ],
});

const STM32 = () => new Sym('MCU_ST_STM32F1:STM32F103C8Tx', {
  refPrefix: 'U',
  graphics: [
    '    (rectangle (start -17.78 45.72) (end 17.78 -45.72)',
    '      (stroke (width 0.254) (type default)) (fill (type background)))',
  ],
  pins: [
    // left column
    { num: '7', name: 'NRST', x: -22.86, y: 40.64, len: 5.08, orient: 'R' },
    { num: '5', name: 'PD0', x: -22.86, y: 35.56, len: 5.08, orient: 'R' },
    { num: '6', name: 'PD1', x: -22.86, y: 33.02, len: 5.08, orient: 'R' },
    { num: '44', name: 'BOOT0', x: -22.86, y: 27.94, len: 5.08, orient: 'R' },
    { num: '13', name: 'PA0', x: -22.86, y: 20.32, len: 5.08, orient: 'R' },
    { num: '14', name: 'PA1', x: -22.86, y: 17.78, len: 5.08, orient: 'R' },
    { num: '15', name: 'PA2', x: -22.86, y: 15.24, len: 5.08, orient: 'R' },
    { num: '16', name: 'PA3', x: -22.86, y: 12.7, len: 5.08, orient: 'R' },
    { num: '29', name: 'PA4', x: -22.86, y: 10.16, len: 5.08, orient: 'R' },
    { num: '30', name: 'PA5', x: -22.86, y: 7.62, len: 5.08, orient: 'R' },
    { num: '31', name: 'PA6', x: -22.86, y: 5.08, len: 5.08, orient: 'R' },
    { num: '32', name: 'PA7', x: -22.86, y: 2.54, len: 5.08, orient: 'R' },
    { num: '33', name: 'PB0', x: -22.86, y: -2.54, len: 5.08, orient: 'R' },
    { num: '34', name: 'PB1', x: -22.86, y: -5.08, len: 5.08, orient: 'R' },
    { num: '35', name: 'PB2', x: -22.86, y: -7.62, len: 5.08, orient: 'R' },
    { num: '36', name: 'PB3', x: -22.86, y: -10.16, len: 5.08, orient: 'R' },
    { num: '37', name: 'PB4', x: -22.86, y: -12.7, len: 5.08, orient: 'R' },
    { num: '38', name: 'PB5', x: -22.86, y: -15.24, len: 5.08, orient: 'R' },
    { num: '39', name: 'PB6', x: -22.86, y: -17.78, len: 5.08, orient: 'R' },
    { num: '40', name: 'PB7', x: -22.86, y: -20.32, len: 5.08, orient: 'R' },
    { num: '41', name: 'PB8', x: -22.86, y: -22.86, len: 5.08, orient: 'R' },
    { num: '42', name: 'PB9', x: -22.86, y: -25.4, len: 5.08, orient: 'R' },
    { num: '45', name: 'PB10', x: -22.86, y: -27.94, len: 5.08, orient: 'R' },
    { num: '46', name: 'PB11', x: -22.86, y: -30.48, len: 5.08, orient: 'R' },
    { num: '21', name: 'PB12', x: -22.86, y: -33.02, len: 5.08, orient: 'R' },
    { num: '22', name: 'PB13', x: -22.86, y: -35.56, len: 5.08, orient: 'R' },
    { num: '25', name: 'PB14', x: -22.86, y: -38.1, len: 5.08, orient: 'R' },
    { num: '26', name: 'PB15', x: -22.86, y: -40.64, len: 5.08, orient: 'R' },
    // right column
    { num: '1', name: 'VBAT', x: 22.86, y: 40.64, len: 5.08, orient: 'L' },
    { num: '24', name: 'VDD', x: 22.86, y: 35.56, len: 5.08, orient: 'L' },
    { num: '36b', name: 'VDD2', x: 22.86, y: 33.02, len: 5.08, orient: 'L' },
    { num: '23', name: 'VSS', x: 22.86, y: 27.94, len: 5.08, orient: 'L' },
    { num: '35b', name: 'VSS2', x: 22.86, y: 25.4, len: 5.08, orient: 'L' },
    { num: '43', name: 'VDDA', x: 22.86, y: 20.32, len: 5.08, orient: 'L' },
    { num: '9', name: 'PA8', x: 22.86, y: 15.24, len: 5.08, orient: 'L' },
    { num: '10', name: 'PA9', x: 22.86, y: 12.7, len: 5.08, orient: 'L' },
    { num: '11', name: 'PA10', x: 22.86, y: 10.16, len: 5.08, orient: 'L' },
    { num: '12', name: 'PA11', x: 22.86, y: 7.62, len: 5.08, orient: 'L' },
    { num: '2', name: 'PC13', x: 22.86, y: -2.54, len: 5.08, orient: 'L' },
    { num: '3', name: 'PC14', x: 22.86, y: -5.08, len: 5.08, orient: 'L' },
    { num: '4', name: 'PC15', x: 22.86, y: -7.62, len: 5.08, orient: 'L' },
    { num: '24b', name: 'VDD3', x: 22.86, y: -12.7, len: 5.08, orient: 'L' },
    { num: '36c', name: 'VSS3', x: 22.86, y: -15.24, len: 5.08, orient: 'L' },
  ],
  // unused MCU pins -> marked no-connect so ERC reports "not connected" as
  // intentional rather than as an error (keeps the PCB DRC/ERC clean).
  nc: ['5', '6', '39', '40', '41', '42', '45', '46', '21', '22', '25', '26',
    '1', '2', '3', '4', '9', '12', '24b', '36c'],
});

const MAX485 = () => new Sym('Interface_UART:MAX485', {
  refPrefix: 'U',
  graphics: [
    '    (rectangle (start -10.16 10.16) (end 10.16 -10.16)',
    '      (stroke (width 0.254) (type default)) (fill (type background)))',
  ],
  pins: [
    { num: '1', name: 'RO', x: -15.24, y: 7.62, len: 5.08, orient: 'R' },
    { num: '2', name: '~RE', x: -15.24, y: 5.08, len: 5.08, orient: 'R' },
    { num: '3', name: 'DE', x: -15.24, y: 2.54, len: 5.08, orient: 'R' },
    { num: '4', name: 'DI', x: -15.24, y: 0, len: 5.08, orient: 'R' },
    { num: '5', name: 'GND', x: -2.54, y: -15.24, len: 5.08, orient: 'U' },
    { num: '8', name: 'VCC', x: -2.54, y: 15.24, len: 5.08, orient: 'D' },
    { num: '6', name: 'A', x: 15.24, y: 5.08, len: 5.08, orient: 'L' },
    { num: '7', name: 'B', x: 15.24, y: 2.54, len: 5.08, orient: 'L' },
  ],
});

const ULN2803 = () => new Sym('Transistor_Array:ULN2803A', {
  refPrefix: 'U',
  graphics: [
    '    (rectangle (start -12.7 15.24) (end 12.7 -15.24)',
    '      (stroke (width 0.254) (type default)) (fill (type background)))',
  ],
  pins: (() => {
    const p = [];
    for (let i = 1; i <= 8; i++) p.push({ num: String(i), name: 'IN' + i, x: -17.78, y: 12.7 - (i - 1) * 2.54, len: 5.08, orient: 'R' });
    for (let i = 1; i <= 8; i++) p.push({ num: String(i + 9), name: 'OUT' + i, x: 17.78, y: 12.7 - (i - 1) * 2.54, len: 5.08, orient: 'L' });
    p.push({ num: '9', name: 'GND', x: 0, y: -20.32, len: 5.08, orient: 'U' });
    return p;
  })(),
});

const RELAY = () => new Sym('Relay:JQX-13F', {
  refPrefix: 'K',
  graphics: [
    '    (rectangle (start -10.16 10.16) (end 10.16 -10.16)',
    '      (stroke (width 0.254) (type default)) (fill (type background)))',
    '    (rectangle (start -8.128 -5.334) (end -5.334 -7.874)',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -8.382 -2.286) (xy -5.08 -2.286))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy -8.128 -7.874) (xy -8.128 -5.334) (xy -4.064 -3.556))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (polyline (pts (xy 2.54 -3.81) (xy 2.54 -7.62))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
    '    (circle (center 2.54 1.016) (radius 0.508)',
    '      (stroke (width 0.254) (type default)) (fill (type outline)))',
    '    (circle (center 2.54 -6.096) (radius 0.508)',
    '      (stroke (width 0.254) (type default)) (fill (type outline)))',
    '    (polyline (pts (xy 2.54 -1.778) (xy 5.842 -4.318))',
    '      (stroke (width 0.254) (type default)) (fill (type none)))',
  ],
  pins: [
    { num: '1', name: 'COIL+', x: -15.24, y: 7.62, len: 5.08, orient: 'R' },
    { num: '2', name: 'COIL-', x: -15.24, y: 5.08, len: 5.08, orient: 'R' },
    { num: '3', name: 'COM', x: 15.24, y: -5.08, len: 5.08, orient: 'L' },
    { num: '4', name: 'NO', x: 15.24, y: 0, len: 5.08, orient: 'L' },
    { num: '5', name: 'NC', x: 15.24, y: 5.08, len: 5.08, orient: 'L' },
  ],
});

// ---------------------------------------------------------------- connectors
function conn(nPins, libId, opts = {}) {
  const pitch = 2.54;
  const pins = [];
  for (let i = 0; i < nPins; i++) {
    pins.push({ num: String(i + 1), name: 'Pin_' + (i + 1), x: -7.62, y: (nPins - 1) * pitch / 2 - i * pitch, len: 5.08, orient: 'R' });
  }
  return new Sym(libId, {
    refPrefix: 'J',
    body: null,
    graphics: [
      '    (rectangle (start -2.54 ' + ((nPins - 1) * pitch / 2 + 1.27) + ') (end 2.54 ' + (-(nPins - 1) * pitch / 2 - 1.27) + ')',
      '      (stroke (width 0.254) (type default)) (fill (type background)))',
    ],
    pins,
    nc: opts.nc || [],
  });
}

module.exports = {
  R, C, CP, L, D, DSCHOTTKY, DTVS, POLYFUSE, CRYSTAL, RPACK4,
  NMOS, LM2596, LDO78L05, STM32, MAX485, ULN2803, RELAY, conn,
};
