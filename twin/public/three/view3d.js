/**
 * 3D internal view of the protein-dispenser vending machine.
 *
 * Geometry is laid out to match the user's cabinet photographs:
 *   - top        five rectangular translucent powder bins in a row, each with a
 *                visible auger screw and an outlet that drops into a cup
 *   - upper-left inner LCD screen (the "android" display panel)
 *   - electrical  PSUs + control PCB + blue 8-ch relay board + DIN-rail modules
 *                 on the rear mounting plate, wired with a colour-coded harness
 *   - lower-left  two 20 L water barrels feeding the pump
 *   - lower-right stainless chiller box with the blue condenser coil on top,
 *                 hermetic compressor, copper lines and condenser fan
 *   - lower-mid   mixer head, turntable and cup station
 *
 * Everything is procedurally built (no external models) and subscribes to the
 * twin's WebSocket telemetry so states light up in real time.
 */
import * as THREE from 'three';

const CV = document.getElementById('cv');
const STAGE = document.getElementById('stage');

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ canvas: CV, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b0f);
scene.fog = new THREE.Fog(0x080b0f, 24, 52);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const CAM_HOME = new THREE.Vector3(5.6, 6.6, 12.8);
// The cabinet interior centre is the orbit target.
const TARGET_HOME = new THREE.Vector3(0, 3.0, 0);

// ------------------------------------------------------------------ lights
scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x121820, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.9);
key.position.set(7, 12, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 44;
const sc = 9;
Object.assign(key.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc });
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const fill = new THREE.DirectionalLight(0x86b6ff, 0.65); fill.position.set(-8, 5, -7); scene.add(fill);
const rim = new THREE.PointLight(0x4aa8ff, 55, 26, 2); rim.position.set(0, 3.2, 1.6); scene.add(rim);
// a soft interior work-light so deep bays stay readable
const work = new THREE.PointLight(0xffe6c2, 22, 12, 2); work.position.set(0, 5.4, 1.2); scene.add(work);

// ------------------------------------------------------------------ materials
const MAT = {
  skin:      new THREE.MeshStandardMaterial({ color: 0x2c3238, metalness: 0.65, roughness: 0.42 }),
  skinInner: new THREE.MeshStandardMaterial({ color: 0x1d2227, metalness: 0.6, roughness: 0.55, side: THREE.BackSide }),
  liner:     new THREE.MeshStandardMaterial({ color: 0x23282d, metalness: 0.5, roughness: 0.65, side: THREE.BackSide }),
  panel:     new THREE.MeshStandardMaterial({ color: 0xb9c2cc, metalness: 0.85, roughness: 0.28 }),
  steel:     new THREE.MeshStandardMaterial({ color: 0xa8b0b8, metalness: 0.92, roughness: 0.24 }),
  steelBrushed: new THREE.MeshStandardMaterial({ color: 0x9fa7ae, metalness: 0.85, roughness: 0.4 }),
  board:     new THREE.MeshStandardMaterial({ color: 0x1e6b45, metalness: 0.2, roughness: 0.65 }),
  boardBlue: new THREE.MeshStandardMaterial({ color: 0x1b5fc4, metalness: 0.25, roughness: 0.55 }),
  relay:     new THREE.MeshStandardMaterial({ color: 0x2f74c9, metalness: 0.3, roughness: 0.5 }),
  ssr:       new THREE.MeshStandardMaterial({ color: 0x2f74c9, metalness: 0.35, roughness: 0.45 }),
  metal:     new THREE.MeshStandardMaterial({ color: 0x8b949e, metalness: 0.9, roughness: 0.35 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x3a4046, metalness: 0.8, roughness: 0.5 }),
  black:     new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.5, roughness: 0.6 }),
  rubber:    new THREE.MeshStandardMaterial({ color: 0x0e1114, metalness: 0.1, roughness: 0.95 }),
  copper:    new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1.0, roughness: 0.35 }),
  hx:        new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.95, roughness: 0.3 }),
  glass:     new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, metalness: 0, roughness: 0.1,
               transmission: 0.85, transparent: true, opacity: 0.35, ior: 1.45, thickness: 0.6 }),
  binClear:  new THREE.MeshPhysicalMaterial({ color: 0xe8f0f8, metalness: 0, roughness: 0.18,
               transmission: 0.8, transparent: true, opacity: 0.38, ior: 1.46, thickness: 0.25,
               side: THREE.DoubleSide }),
  petBottle: new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, metalness: 0, roughness: 0.1,
               transmission: 0.9, transparent: true, opacity: 0.32, ior: 1.33, thickness: 0.5 }),
  water:     new THREE.MeshPhysicalMaterial({ color: 0x2b7fd4, metalness: 0, roughness: 0.12,
               transmission: 0.7, transparent: true, opacity: 0.72 }),
  powder:    new THREE.MeshStandardMaterial({ color: 0xd9c9a3, metalness: 0, roughness: 0.95 }),
  powderCocoa: new THREE.MeshStandardMaterial({ color: 0x8a5a34, metalness: 0, roughness: 0.95 }),
  powderOat: new THREE.MeshStandardMaterial({ color: 0xded2b0, metalness: 0, roughness: 0.95 }),
  red:       new THREE.MeshStandardMaterial({ color: 0xcc2b2b, metalness: 0.2, roughness: 0.6 }),
  white:     new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.1, roughness: 0.7 }),
  busbar:    new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.9, roughness: 0.3 }),
  blueCoil:  new THREE.MeshStandardMaterial({ color: 0x2f7fd0, metalness: 0.35, roughness: 0.45 }),
  yellowSticker: new THREE.MeshStandardMaterial({ color: 0xf2d21b, emissive: 0x554700, emissiveIntensity: 0.3, roughness: 0.6 }),
};
// live-state material variants (declared up-front so applyState can never see them undefined)
MAT.relayHot = new THREE.MeshStandardMaterial({ color: 0x2f74c9, metalness: 0.3, roughness: 0.5, emissive: 0x1f6f4a, emissiveIntensity: 0.75 });
MAT.compHot  = new THREE.MeshStandardMaterial({ color: 0x2a2f35, metalness: 0.6, roughness: 0.55, emissive: 0x3a1206, emissiveIntensity: 0.5 });

// wire insulation colours
const WIRE = {
  red:   new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.75 }),
  black: new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.8 }),
  blue:  new THREE.MeshStandardMaterial({ color: 0x2b6cb0, roughness: 0.75 }),
  yellow:new THREE.MeshStandardMaterial({ color: 0xd4ac0d, roughness: 0.75 }),
  green: new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.75 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 }),
};

// ------------------------------------------------------------------ registry
/** All selectable parts. Each entry: { id, name, desc, group, focus, tags, obj, meshes } */
const PARTS = [];
/** Dynamic meshes grouped by behaviour so telemetry can update them cheaply. */
const DYN = {
  relays: [], hoppers: [], leds: [], fans: [],
  boilerLed: null, ssrLed: null, tankWater: null, condFanHousing: null,
  screen: null, augers: [], waterLevels: [],
};

function reg(id, name, desc, group, focus, tags = []) {
  const rec = { id, name, desc, group, focus, tags, obj: new THREE.Group(), meshes: [] };
  rec.obj.name = id;
  scene.add(rec.obj);
  PARTS.push(rec);
  return rec;
}

/** add a mesh to a registered part, remembering it for picking */
function add(rec, geo, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.partId = rec.id;
  (parent || rec.obj).add(m);
  rec.meshes.push(m);
  return m;
}
/** like add(), but also inserts a plain (non-pickable) helper mesh */
function aux(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 20) => new THREE.CylinderGeometry(r, r, h, s);

// ================================================================== CABINET
// Interior is 5.0 wide, 6.1 tall, 2.6 deep. Interior floor at y = 0.
const CW = 5.0, CH = 6.1, CD = 2.6, WALL = 0.06;
const PLINTH = 0.34;              // raised base the whole cabinet sits on

const cab = reg('cabinet', 'Cabinet shell', 'Powder-coated sheet-steel vending enclosure on a raised plinth. 5.0 × 6.1 × 2.6 m interior (model units).', 'mech', 'all');
{
  // raised plinth / kick base
  add(cab, box(CW + 0.16, PLINTH, CD + 0.16), MAT.darkMetal, 0, -PLINTH / 2, 0);
  add(cab, box(CW + 0.24, 0.05, CD + 0.24), MAT.black, 0, 0, 0); // foot trim
  // back + sides + top + bottom as thin plates (front is the door)
  add(cab, box(CW, CH, WALL), MAT.skin, 0, CH / 2, -CD / 2);
  add(cab, box(WALL, CH, CD), MAT.skin, -CW / 2 - WALL / 2, CH / 2, 0);
  add(cab, box(WALL, CH, CD), MAT.skin, CW / 2 + WALL / 2, CH / 2, 0);
  add(cab, box(CW + WALL * 2, WALL, CD), MAT.skin, 0, CH + WALL / 2, 0);
  add(cab, box(CW + WALL * 2, WALL, CD), MAT.skin, 0, -WALL / 2, 0);
  // inner liner (visible interior walls, slightly frosty)
  add(cab, box(CW - 0.02, CH - 0.02, 0.01), MAT.liner, 0, CH / 2, -CD / 2 + 0.04);
  // corner extrusions for a rigid look
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(cab, box(0.1, CH, 0.1), MAT.darkMetal, sx * (CW / 2 - 0.05), CH / 2, sz * (CD / 2 - 0.05));
  }
  // horizontal stiffener rails on the back wall
  for (const y of [1.55, 3.15, 4.9]) add(cab, box(CW - 0.1, 0.05, 0.05), MAT.darkMetal, 0, y, -CD / 2 + 0.08);
}
const INTERIOR_BOX = new THREE.Box3(
  new THREE.Vector3(-CW / 2, 0, -CD / 2),
  new THREE.Vector3(CW / 2, CH, CD / 2));

// ------------------------------------------------------------------ backplate
const bp = reg('backplate', 'Back mounting plate', 'Galvanised steel sub-panel; all electrical gear bolts to this with M4 screws.', 'mech', 'all');
{
  const y = CH / 2, z = -CD / 2 + 0.06;
  add(bp, box(CW - 0.1, CH - 0.4, 0.03), MAT.steelBrushed, 0, y, z);
  // M4 fasteners at the corners
  for (const sx of [-1, 1]) for (const sy of [-1, 1])
    add(bp, cyl(0.045, 0.03, 8), MAT.metal, sx * (CW / 2 - 0.28), y + sy * (CH / 2 - 0.34), z + 0.03);
}

// ------------------------------------------------------------------ door
const door = reg('door', 'Front door', 'Hinged service door with the customer pickup window, delivery flap and the inner LCD panel.', 'mech', 'all');
{
  // hinge at +x edge; group pivots about the right edge
  const hx = CW / 2;
  door.obj.position.set(hx, 0, CD / 2 + 0.04);
  const d = add(door, box(CW, CH, 0.06), MAT.skin, -CW / 2, CH / 2, 0);
  d.name = 'doorSkin';
  add(door, box(CW - 0.14, CH - 0.14, 0.02), MAT.skinInner, -CW / 2, CH / 2, -0.03);
  // inner sheet-metal liner with a folded edge
  add(door, box(CW - 0.2, 0.04, 0.04), MAT.steelBrushed, -CW / 2, 1.35, -0.05);
  add(door, box(CW - 0.2, 0.04, 0.04), MAT.steelBrushed, -CW / 2, 4.85, -0.05);
  // dark pickup window with a bezel
  add(door, box(1.62, 1.2, 0.03), MAT.darkMetal, -CW / 2 - 0.5, 2.0, 0.015);
  add(door, box(1.5, 1.08, 0.04), MAT.black, -CW / 2 - 0.5, 2.0, 0.03);
  // delivery flap (hinged at top)
  const flap = aux(door.obj, box(1.4, 0.5, 0.02), MAT.skin, -CW / 2 - 0.5, 1.45, 0.05);
  flap.name = 'flap';
  // ---- inner LCD panel (the "android" display) ----
  const bezel = add(door, box(2.0, 1.5, 0.04), MAT.black, -CW / 2 + 0.35, 4.0, 0.02);
  bezel.name = 'lcdBezel';
  const scrMat = new THREE.MeshStandardMaterial({
    color: 0x05080a, emissive: 0x0d2430, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1 });
  const scr = add(door, box(1.84, 1.34, 0.02), scrMat, -CW / 2 + 0.35, 4.0, 0.045);
  scr.name = 'lcd';
  DYN.screen = scr;
  DYN.screenCanvas = document.createElement('canvas');
  DYN.screenCanvas.width = 512; DYN.screenCanvas.height = 384;
  DYN.screenTex = new THREE.CanvasTexture(DYN.screenCanvas);
  DYN.screenTex.colorSpace = THREE.SRGBColorSpace;
  scrMat.map = DYN.screenTex;
  scrMat.emissiveMap = DYN.screenTex;
  scrMat.emissive.setHex(0xffffff);
  // thin bezel highlight
  add(door, box(1.9, 0.02, 0.05), MAT.metal, -CW / 2 + 0.35, 3.31, 0.05);
  // hinges
  for (const y of [0.9, 3.1, 5.3]) {
    add(door, cyl(0.055, 0.2, 10), MAT.metal, 0.02, y, 0.0);
    add(door, box(0.12, 0.16, 0.12), MAT.metal, 0.03, y, 0.0);
  }
  // latch / lock boss on the free edge
  add(door, box(0.1, 0.34, 0.1), MAT.metal, -CW + 0.12, 3.0, 0.02);
  add(door, cyl(0.05, 0.06, 12), MAT.black, -CW + 0.12, 3.0, 0.09).rotation.x = Math.PI / 2;
}

// ================================================================== PSUs
function ventTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9aa4ad'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2b3138';
  for (let i = 0; i < 12; i++) for (let j = 0; j < 14; j++) {
    g.beginPath(); g.arc(10 + i * 10, 8 + j * 8.5, 2.4, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makePSU(id, name, desc, x, y, z, w, h, d) {
  const r = reg(id, name, desc, 'electrical', 'electrical', ['mains', 'lv']);
  const body = add(r, box(w, h, d), MAT.panel, x, y, z);
  body.name = 'psuBody';
  // perforated vent look: rows of dark dots via a canvas texture
  const tex = ventTexture();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, h * 0.78),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 }));
  face.position.set(x, y, z + d / 2 + 0.002);
  face.userData.partId = id;
  r.obj.add(face); r.meshes.push(face);
  // yellow "OK" sticker seen in the photo
  add(r, box(0.16, 0.1, 0.005), MAT.yellowSticker,
    x - w / 2 + 0.2, y + h / 2 - 0.16, z + d / 2 + 0.004);
  // screw terminal strip with 5 positions + wires
  const tb = add(r, box(w * 0.72, 0.1, 0.14), MAT.black, x, y - h / 2 + 0.07, z + d / 2 + 0.04);
  tb.name = 'psuTerminal';
  for (let i = 0; i < 5; i++) {
    const tx = x - w * 0.28 + i * (w * 0.14);
    add(r, cyl(0.014, 0.13, 6), MAT.metal, tx, y - h / 2 + 0.07, z + d / 2 + 0.11).rotation.x = Math.PI / 2;
  }
  // green LED
  const led = add(r, new THREE.SphereGeometry(0.028, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x39d0a2, emissiveIntensity: 1.2 }),
    x + w / 2 - 0.14, y - h / 2 + 0.2, z + d / 2 + 0.005);
  DYN.leds.push({ m: led, kind: 'psu' });
  r.model = { x, y, z, w, h, d };
  return r;
}

const psu12 = makePSU('psu12', 'PSU-12V · LRS-100-12', 'Mean-Well style switch-mode supply, 12 V / 8.5 A. Feeds the control PCB, relay coils and DC auger motors.', -1.62, 5.05, -1.16, 1.15, 2.0, 0.9);
const psu24 = makePSU('psu24', 'PSU-24V · LRS-100-24', 'Second supply, 24 V / 4.5 A. Feeds the SSR trigger and the compressor contactor coil.', 1.62, 5.05, -1.16, 1.15, 2.0, 0.9);

// ================================================================== CONTROL PCB
const pcb = reg('pcb', 'Control PCB (custom)', 'STM32F103 controller board: 8 relay drivers via ULN2803, MAX485 Modbus, RS485 + SSR gate, NTC inputs. This is the board in hardware/pcb.', 'electrical', 'electrical', ['mcu', 'modbus']);
{
  const w = 1.75, h = 0.95, y = 5.55, z = -1.15;
  add(pcb, box(w, h, 0.05), MAT.board, 0, y, z);
  // mounting stand-offs
  for (const sx of [-1, 1]) for (const sy of [-1, 1])
    add(pcb, cyl(0.05, 0.1, 8), MAT.metal, sx * (w / 2 - 0.12), y + sy * (h / 2 - 0.12), z - 0.05);
  // MCU (LQFP with visible pins)
  add(pcb, box(0.3, 0.3, 0.06), MAT.black, 0.15, y + 0.07, z + 0.04);
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
    add(pcb, box(0.02, 0.012, 0.16), MAT.metal, 0.15 + s * (0.15 + 0.02), y + 0.07 - 0.15 + i * 0.05, z + 0.04);
    add(pcb, box(0.16, 0.012, 0.02), MAT.metal, 0.15 - 0.15 + i * 0.05, y + 0.07 + s * (0.15 + 0.02), z + 0.04);
  }
  // ULN2803 driver + passives
  add(pcb, box(0.22, 0.12, 0.05), MAT.black, -0.45, y - 0.12, z + 0.04);
  for (let i = 0; i < 6; i++)
    add(pcb, box(0.03, 0.03, 0.02), MAT.darkMetal, -0.2 + i * 0.08, y + 0.22, z + 0.035);
  // green screw-terminal blocks along both edges
  const term = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.6 });
  add(pcb, box(w, 0.12, 0.14), term, 0, y - 0.5, z + 0.04);
  add(pcb, box(w, 0.12, 0.14), term, 0, y + 0.5, z + 0.04);
  for (let i = 0; i < 7; i++) {
    const tx = -w / 2 + 0.18 + i * (w - 0.36) / 6;
    add(pcb, cyl(0.015, 0.15, 6), MAT.metal, tx, y - 0.5, z + 0.1).rotation.x = Math.PI / 2;
    add(pcb, cyl(0.015, 0.15, 6), MAT.metal, tx, y + 0.5, z + 0.1).rotation.x = Math.PI / 2;
  }
  // status LEDs
  for (let i = 0; i < 4; i++) {
    const led = add(pcb, new THREE.SphereGeometry(0.035, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x39d0a2, emissiveIntensity: 0.15 }),
      -0.7 + i * 0.16, y - 0.24, z + 0.05);
    DYN.leds.push({ m: led, kind: 'pcb', i });
  }
}

// ================================================================== RELAY BOARD
const relays = reg('relays', 'Relay board · 8 ch (JQX-13F)', 'Eight 12 V SPDT relays in sockets. Channels 1-5 = auger motors, 6 = cup-drop solenoid, 7 = hot-water solenoid, 8 = cold-water solenoid.', 'electrical', 'electrical', ['relay']);
{
  const w = 1.9, h = 0.8, y = 4.35, z = -1.18;
  add(relays, box(w, h, 0.06), MAT.boardBlue, 0, y, z);
  // terminal strips top + bottom
  add(relays, box(w, 0.16, 0.16), MAT.black, 0, y - 0.33, z + 0.05);
  add(relays, box(w, 0.16, 0.16), MAT.black, 0, y + 0.33, z + 0.05);
  const bw = 0.19, bh = 0.26, bd = 0.22;
  for (let i = 0; i < 8; i++) {
    const x = -w / 2 + 0.16 + i * 0.225;
    // socket
    add(relays, box(bw + 0.02, bh + 0.02, 0.04), MAT.darkMetal, x, y, z + 0.05);
    // relay body
    const b = add(relays, box(bw, bh, bd), MAT.relay, x, y, z + 0.09);
    b.userData.channel = i;
    // transparent cover hint
    add(relays, box(bw * 0.9, bh * 0.55, bd * 0.4), new THREE.MeshPhysicalMaterial({
      color: 0xdfe8f2, transparent: true, opacity: 0.25, roughness: 0.15, transmission: 0.6 }),
      x, y + 0.04, z + 0.16);
    // status LED
    const led = add(relays, new THREE.SphereGeometry(0.032, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x221111, emissive: 0xff3b30, emissiveIntensity: 0.1 }),
      x, y + 0.19, z + 0.2);
    DYN.relays.push({ body: b, led });
    // channel number
    add(relays, box(0.06, 0.02, 0.005), MAT.white, x, y - 0.16, z + 0.2);
  }
}

// ================================================================== DIN RAIL + SSR BOXES
const din = reg('din', 'DIN rail · TS35', 'TS35 rail carrying the solid-state relay and the timer / delay modules.', 'electrical', 'electrical');
{
  const y = 3.55, z = -1.1;
  add(din, box(CW - 0.3, 0.07, 0.35), MAT.metal, 0, y, z);
  add(din, box(CW - 0.3, 0.04, 0.05), MAT.darkMetal, 0, y, z - 0.18);
  // end stops
  add(din, box(0.05, 0.14, 0.4), MAT.darkMetal, -CW / 2 + 0.16, y, z);
  add(din, box(0.05, 0.14, 0.4), MAT.darkMetal, CW / 2 - 0.16, y, z);
}

const ssr = reg('ssr', 'SSR-25DA heater relay', 'Fotek-style 25 A solid-state relay. Switches the 240 V boiler element. The only mains-switching device in the machine.', 'thermal', 'thermal', ['mains', 'heater']);
const delayPart = reg('delay', 'Actuator drivers · 5 × timer', 'Delay / timer modules that sequence the mixer head, turntable, cup gate and rinse valve.', 'mech', 'powder');
{
  const x0 = -CW / 2 + 0.55, pitch = 0.62, y = 3.5, z = -1.05;
  // 6 blue boxes on the rail (SSR + delay modules, as photographed)
  for (let i = 0; i < 6; i++) {
    const x = x0 + i * pitch;
    const target = i === 0 ? ssr : delayPart;
    add(target, box(0.42, 0.5, 0.42), MAT.ssr, x, y, z);
    // front label
    add(target, box(0.3, 0.16, 0.01), MAT.white, x, y + 0.12, z + 0.215);
    // red rating strip
    add(target, box(0.26, 0.1, 0.02), MAT.red, x, y - 0.08, z + 0.215);
    // terminal screws top + bottom
    for (const s of [-1, 1]) for (let k = -1; k <= 1; k++)
      add(target, cyl(0.022, 0.05, 8), MAT.metal, x + k * 0.11, y + s * 0.27, z + 0.15);
    // status LED
    const led = add(target, new THREE.SphereGeometry(0.035, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x221111, emissive: 0xff3b30, emissiveIntensity: 0.12 }),
      x + 0.16, y - 0.22, z + 0.215);
    if (i === 0) DYN.ssrLed = led;
  }
}

// ================================================================== WIRE HARNESS
// A tidy colour-coded loom from the PSUs / relay board down to the loads, so the
// electrical bay reads like a real cabinet instead of a bare back plate.
const harness = reg('harness', 'Wiring harness', 'Colour-coded loom: 12 V aux (red/black), 24 V control (blue/white), 240 V mains (brown/blue) and signal pairs, bundled with spiral wrap.', 'electrical', 'electrical', ['mains', 'lv', 'signal']);
{
  const tube = (pts, mat, r = 0.018) => {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 60, r, 6), mat);
    m.userData.partId = harness.id;
    harness.obj.add(m); harness.meshes.push(m);
    return m;
  };
  // 12 V rail: PSU-12 terminal -> relay board ->
  const p12 = psu12.model, p24 = psu24.model;
  tube([[p12.x, p12.y - 1.0, p12.z + 0.5], [p12.x + 0.3, 4.9, 0.2], [-0.6, 4.5, 0.1], [-0.6, 4.35, -0.9]], WIRE.red);
  tube([[p12.x - 0.2, p12.y - 1.0, p12.z + 0.5], [p12.x + 0.1, 4.7, 0.2], [-0.9, 4.3, 0.1], [-0.9, 4.35, -0.9]], WIRE.black);
  // 24 V rail to the SSR / DIN row
  tube([[p24.x, p24.y - 1.0, p24.z + 0.5], [p24.x - 0.3, 4.4, 0.2], [1.0, 3.9, 0.1], [0.7, 3.55, -0.85]], WIRE.blue);
  tube([[p24.x + 0.2, p24.y - 1.0, p24.z + 0.5], [p24.x, 4.2, 0.2], [1.2, 3.8, 0.1], [0.9, 3.55, -0.85]], WIRE.white);
  // mains feed (brown / blue) from the gland down to the SSR
  tube([[-CW / 2 + 0.25, 2.6, -1.0], [-CW / 2 + 0.55, 3.0, -0.95], [-CW / 2 + 0.55, 3.5, -0.82]], WIRE.yellow, 0.022);
  tube([[-CW / 2 + 0.18, 2.55, -1.0], [-CW / 2 + 0.62, 2.95, -0.95], [-CW / 2 + 0.62, 3.5, -0.82]], WIRE.black, 0.022);
  // signal pair from the control PCB down to the relay board inputs
  tube([[0.6, 5.2, -1.05], [0.9, 4.8, -0.2], [1.15, 4.35, -0.9]], WIRE.green, 0.014);
  // spiral-wrap bundle running down the back between the bays
  tube([[-0.2, 4.9, -1.05], [-0.1, 4.0, -1.0], [0.1, 3.0, -0.95], [0.4, 2.0, -0.9]], MAT.rubber, 0.05);
}

// ================================================================== CHILLER LOOP
// Stainless chiller box on the right with the blue condenser coil stacked on top,
// hermetic compressor beside it and copper refrigerant lines.
const chiller = reg('chiller', 'Chiller box (stainless)', 'Insulated stainless bath that holds the cold water. The blue finned condenser coil sits on top of it.', 'thermal', 'thermal', ['cold']);
{
  const x = 0.9, y = 1.35, z = -0.55, w = 1.25, h = 1.5, d = 1.15;
  add(chiller, box(w, h, d), MAT.steelBrushed, x, y, z);
  // brushed panel seams
  add(chiller, box(0.02, h - 0.08, d - 0.08), MAT.steel, x - w / 2 - 0.005, y, z);
  add(chiller, box(w - 0.08, 0.02, d - 0.08), MAT.steel, x, y + h / 2 - 0.2, z);
  // carry handle
  add(chiller, box(0.24, 0.05, 0.05), MAT.metal, x, y + h / 2 + 0.05, z + d / 2 - 0.15);
  // fill port + cap
  add(chiller, cyl(0.09, 0.08, 14), MAT.blueCoil, x + 0.35, y + h / 2 + 0.03, z + d / 2 - 0.2);
}
const cond = reg('condenser', 'Condenser coil (blue)', 'Blue epoxy-coated finned coil on top of the chiller box. Rejects the heat pulled out of the cold bath.', 'thermal', 'thermal', ['cold']);
{
  const x = 0.9, y = 2.32, z = -0.55;
  // stacked coil rings, like the photo's blue pancake
  for (let i = 0; i < 4; i++) {
    const ring = add(cond, new THREE.TorusGeometry(0.46 - i * 0.02, 0.045, 8, 28), MAT.blueCoil, x, y + i * 0.075, z);
    ring.rotation.x = Math.PI / 2;
  }
  add(cond, cyl(0.14, 0.34, 16), MAT.blueCoil, x, y + 0.12, z);
  // aluminium end plates
  add(cond, box(0.06, 0.34, 0.9), MAT.hx, x - 0.46, y + 0.11, z);
  add(cond, box(0.06, 0.34, 0.9), MAT.hx, x + 0.46, y + 0.11, z);
}

const comp = reg('compressor', 'Hermetic compressor', 'Reciprocating hermetic compressor for the chiller. Runs off the 24 V contactor when the cold bath needs cooling.', 'thermal', 'thermal', ['cold']);
{
  const x = -0.55, y = 0.62, z = -0.75;
  // domed shell
  add(comp, cyl(0.34, 0.9, 24), MAT.black, x, y, z);
  add(comp, new THREE.SphereGeometry(0.34, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), MAT.black, x, y + 0.45, z);
  add(comp, new THREE.SphereGeometry(0.34, 20, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), MAT.black, x, y - 0.45, z);
  // terminal box + relay
  add(comp, box(0.22, 0.16, 0.18), MAT.darkMetal, x + 0.2, y + 0.4, z + 0.24);
  // suction + discharge service valves
  add(comp, cyl(0.05, 0.24, 10), MAT.copper, x - 0.28, y + 0.45, z + 0.1);
  add(comp, cyl(0.05, 0.24, 10), MAT.copper, x + 0.3, y - 0.3, z - 0.2);
  // copper lines up to the condenser
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(x + 0.3, y - 0.1, z - 0.25),
    new THREE.Vector3(0.2, y + 0.9, z - 0.5),
    new THREE.Vector3(0.9, y + 1.5, z - 0.55),
  ]), 50, 0.03, 8), MAT.copper);
  line.userData.partId = comp.id; comp.obj.add(line); comp.meshes.push(line);
  const line2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(x - 0.25, y + 0.55, z + 0.12),
    new THREE.Vector3(0.0, y + 1.0, z - 0.4),
    new THREE.Vector3(0.6, y + 1.4, z - 0.55),
  ]), 50, 0.025, 8), MAT.copper);
  line2.userData.partId = comp.id; comp.obj.add(line2); comp.meshes.push(line2);
  // rubber feet
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    add(comp, box(0.1, 0.06, 0.1), MAT.rubber, x + sx * 0.24, y - 0.5, z + sz * 0.24);
}

const condFanReg = reg('fan', 'Condenser fan', 'Axial fan beside the condenser that pulls shop air across the coil.', 'thermal', 'thermal', ['cold']);
{
  const x = 0.9, y = 2.32, z = -0.75;
  const housing = add(condFanReg, cyl(0.42, 0.14, 22), MAT.darkMetal, x, y, z);
  housing.rotation.x = Math.PI / 2;
  // finger guard ring
  add(condFanReg, new THREE.TorusGeometry(0.42, 0.02, 6, 24), MAT.metal, x, y, z + 0.08);
  const blade = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const bl = new THREE.Mesh(box(0.34, 0.02, 0.16), MAT.black);
    bl.position.set(Math.cos(i / 5 * 6.283) * 0.18, 0, Math.sin(i / 5 * 6.283) * 0.18);
    bl.rotation.y = i / 5 * 6.283;
    bl.castShadow = true; bl.userData.partId = condFanReg.id;
    blade.add(bl);
  }
  blade.position.set(x, y, z);
  blade.rotation.x = Math.PI / 2;
  condFanReg.obj.add(blade);
  DYN.fans.push(blade);
  DYN.condFanHousing = housing;
}

// ================================================================== BOILER (hot water)
const boiler = reg('boiler', 'Hot-water boiler', 'Stainless tank with a 1.2 kW 240 V element run through the SSR. Feeds the hot-water solenoid.', 'thermal', 'thermal', ['mains', 'heater', 'hot']);
{
  const x = -1.55, y = 4.35, z = 0.35;
  add(boiler, cyl(0.34, 1.1, 24), MAT.steel, x, y, z);
  add(boiler, cyl(0.36, 0.1, 24), MAT.metal, x, y + 0.6, z);
  add(boiler, cyl(0.36, 0.1, 24), MAT.metal, x, y - 0.6, z);
  // heating element boss + terminal cover
  add(boiler, box(0.2, 0.2, 0.2), MAT.copper, x + 0.34, y - 0.2, z);
  add(boiler, box(0.14, 0.1, 0.14), MAT.black, x + 0.44, y - 0.2, z);
  // element indicator (colour driven by telemetry)
  const heat = add(boiler, new THREE.SphereGeometry(0.05, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x332020, emissive: 0xff5f56, emissiveIntensity: 0 }), x + 0.36, y + 0.1, z + 0.34);
  DYN.boilerLed = heat;
  // pressure-relief + outlet fittings
  add(boiler, cyl(0.05, 0.2, 10), MAT.copper, x - 0.3, y + 0.62, z);
  // insulated feed pipe to the mix head
  const p = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(x + 0.34, y + 0.4, z), new THREE.Vector3(-0.4, 2.9, 0.8),
    new THREE.Vector3(0.15, 1.9, 1.0)]), 50, 0.04, 8),
    new THREE.MeshStandardMaterial({ color: 0x9aa6b2, metalness: 0.3, roughness: 0.7 }));
  p.userData.partId = boiler.id; boiler.obj.add(p); boiler.meshes.push(p);
}

// ================================================================== WATER BARRELS
const tank = reg('tank', 'Water barrels · 2 × 20 L', 'Two stacked 20 L PET barrels with screw caps and a dip tube. Feed the cold-water pump; distilled water only.', 'powder', 'powder', ['water']);
{
  const barrel = (x, y, z, rot) => {
    const r = 0.42, h = 1.35;
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.z = rot;
    // body
    const body = aux(g, cyl(r, h, 26), MAT.petBottle, 0, 0, 0);
    body.name = 'barrel';
    body.userData.partId = tank.id; tank.meshes.push(body);
    // ribbed shoulders + neck
    aux(g, cyl(r * 0.62, 0.22, 20), MAT.petBottle, 0, h / 2 + 0.1, 0);
    aux(g, cyl(r * 0.28, 0.18, 16), MAT.petBottle, 0, h / 2 + 0.26, 0);
    const cap = aux(g, cyl(r * 0.3, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x2fae5e, roughness: 0.5 }), 0, h / 2 + 0.37, 0);
    cap.name = 'cap';
    // ribs
    for (let i = 0; i < 4; i++) aux(g, new THREE.TorusGeometry(r + 0.005, 0.012, 6, 24), MAT.petBottle, 0, -0.45 + i * 0.3, 0).rotation.x = Math.PI / 2;
    return g;
  };
  const b1 = barrel(-1.55, 0.72, 0.55, 0);
  tank.obj.add(b1);
  const b2 = barrel(-1.5, 0.72, -0.15, 0.06);
  tank.obj.add(b2);
  // water volume inside each barrel (level driven by telemetry)
  const mk = (x, y, z) => {
    const w = add(tank, cyl(0.4, 1.0, 22), MAT.water, x, y - 0.1, z);
    DYN.waterLevels.push(w);
    return w;
  };
  mk(-1.55, 0.72, 0.55); mk(-1.5, 0.72, -0.15);
  DYN.tankWater = DYN.waterLevels[0];
  // dip tube / hose to the pump
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.5, 1.45, -0.15), new THREE.Vector3(-0.9, 1.0, 0.2),
    new THREE.Vector3(-0.3, 1.3, 0.1), new THREE.Vector3(0.2, 0.9, -0.5)]), 60, 0.03, 8),
    new THREE.MeshStandardMaterial({ color: 0xcfd8e0, metalness: 0.1, roughness: 0.7 }));
  hose.userData.partId = tank.id; tank.obj.add(hose); tank.meshes.push(hose);
}

// ================================================================== HOPPERS + AUGERS
// Five rectangular translucent bins in a row at the top, each with a visible
// auger screw in an outlet that drops powder into the cup below.
const hoppers = reg('hoppers', 'Powder bins · 5', 'Five 1.5 kg translucent bins, each with a 12 V geared auger motor and a 3.1 g/rev screw. Doses are metered by revolution count.', 'powder', 'powder', ['powder', 'auger']);
{
  const y0 = 4.05;                 // bin centre
  const bw = 0.8, bh = 1.5, bd = 0.7;  // bin body
  const pitch = 0.92, x0 = -CW / 2 + 0.75;
  const powderMats = [MAT.powder, MAT.powderCocoa, MAT.white, MAT.powderOat, MAT.powderCocoa];

  for (let i = 0; i < 5; i++) {
    const x = x0 + i * pitch, z = -0.35;
    // translucent bin walls
    add(hoppers, box(bw, bh, bd), MAT.binClear, x, y0, z);
    // metal lid
    add(hoppers, box(bw + 0.04, 0.06, bd + 0.04), MAT.steelBrushed, x, y0 + bh / 2 + 0.03, z);
    // lid catch clasp
    add(hoppers, box(0.12, 0.04, 0.04), MAT.metal, x, y0 + bh / 2 + 0.07, z + bd / 2);
    // powder fill volume (scaled by level)
    const pmat = powderMats[i].clone();
    const pw = add(hoppers, box(bw - 0.08, bh - 0.1, bd - 0.08), pmat, x, y0, z);
    // tapering hopper bottom (wedge) into the outlet
    add(hoppers, new THREE.CylinderGeometry(bw * 0.5, 0.14, 0.4, 4), MAT.binClear, x, y0 - bh / 2 - 0.2, z)
      .rotation.y = Math.PI / 4;
    // auger outlet tube running forward to the drop point
    const auger = add(hoppers, cyl(0.11, 0.9, 16), MAT.metal, x, y0 - bh / 2 - 0.34, z + 0.45);
    auger.rotation.x = Math.PI / 2;
    // ---- visible auger screw (helix) inside a clear tube ----
    const screw = new THREE.Group();
    const turns = 7, seg = 40;
    const pts = [];
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, a = t * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075));
    }
    const helix = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, 0.022, 6),
      matBrass());
    helix.userData.partId = hoppers.id;
    // orient helix along local +Z (the outlet direction)
    helix.rotation.x = Math.PI / 2;
    helix.position.x = 0;
    screw.add(helix);
    screw.position.set(x, y0 - bh / 2 - 0.34, z + 0.45);
    hoppers.obj.add(screw);
    DYN.augers.push(screw);
    // clear auger cover (open-ended tube)
    add(hoppers, new THREE.CylinderGeometry(0.13, 0.13, 0.86, 16, 1, true), new THREE.MeshPhysicalMaterial({
      color: 0xdfe8f2, transparent: true, opacity: 0.22, roughness: 0.15, transmission: 0.6, side: THREE.DoubleSide }),
      x, y0 - bh / 2 - 0.34, z + 0.45).rotation.x = Math.PI / 2;
    // geared motor + gearbox
    const mo = add(hoppers, cyl(0.1, 0.26, 14), MAT.darkMetal, x, y0 - bh / 2 - 0.34, z - 0.05);
    mo.rotation.x = Math.PI / 2;
    add(hoppers, box(0.26, 0.24, 0.26), MAT.black, x, y0 - bh / 2 - 0.34, z - 0.32);
    // motor LED
    const led = add(hoppers, new THREE.SphereGeometry(0.03, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x39d0a2, emissiveIntensity: 0.1 }),
      x, y0 - bh / 2 - 0.2, z - 0.46);
    DYN.hoppers.push({ i, bin: pw, bh, y0, led });
    // product nameplate slot
    add(hoppers, box(0.5, 0.08, 0.01), MAT.white, x, y0 + bh / 2 - 0.1, z + bd / 2 + 0.005);
  }
}
function matBrass() {
  return new THREE.MeshStandardMaterial({ color: 0xd8b44a, metalness: 0.95, roughness: 0.3 });
}

// ================================================================== MIX HEAD
const mix = reg('mix', 'Mixer head', 'High-speed mixing head lowered into the cup. Rinsed with hot water after every drink.', 'powder', 'powder', ['mixer']);
{
  const x = 0.75, y = 2.35, z = 0.9;
  // linear actuator column
  add(mix, box(0.24, 0.5, 0.24), MAT.darkMetal, x, y + 0.55, z);
  add(mix, box(0.1, 0.34, 0.1), MAT.metal, x, y + 1.05, z);
  // motor body
  add(mix, cyl(0.2, 0.5, 18), MAT.metal, x, y, z);
  add(mix, cyl(0.21, 0.06, 18), MAT.darkMetal, x, y + 0.25, z);
  // shaft + bell
  const shaft = add(mix, cyl(0.045, 0.7, 12), MAT.metal, x, y - 0.55, z);
  const bell = add(mix, new THREE.ConeGeometry(0.22, 0.28, 20), MAT.black, x, y - 0.95, z);
  bell.rotation.x = Math.PI;
  mix.shaft = shaft;
  // rinse nozzle
  add(mix, cyl(0.03, 0.18, 8), MAT.copper, x + 0.2, y - 0.7, z);
}

// ================================================================== TURNTABLE + CUP
const turn = reg('turntable', 'Turntable & cup station', 'Indexes the dropped cup under the dispenser, then to the mixer, then to the pickup window.', 'powder', 'powder', ['cup']);
const tt = add(turn, cyl(0.7, 0.07, 30), MAT.darkMetal, 0.75, 1.32, 0.9);
{
  // drive hub + stepper
  add(turn, cyl(0.12, 0.2, 14), MAT.metal, 0.75, 1.22, 0.9);
  add(turn, box(0.22, 0.22, 0.3), MAT.black, 0.75, 1.1, 0.9);
  // cup nest positions (3 stations)
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    add(turn, cyl(0.22, 0.04, 18), MAT.rubber, 0.75 + Math.sin(a) * 0.38, 1.37, 0.9 + Math.cos(a) * 0.38);
  }
}
const cup = add(turn, cyl(0.2, 0.34, 20), MAT.white, 0.75, 1.52, 1.28);
add(turn, cyl(0.205, 0.03, 20), MAT.metal, 0.75, 1.7, 1.28);
// cup-drop chute from the top
{
  const chute = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-CW / 2 + 0.5, 4.6, 1.4), new THREE.Vector3(0.2, 3.4, 1.5),
    new THREE.Vector3(0.75, 2.0, 1.35)]), 50, 0.13, 10), MAT.panel);
  chute.userData.partId = turn.id; turn.obj.add(chute); turn.meshes.push(chute);
}

// ================================================================== WASTE / DRIP
const waste = reg('waste', 'Drip tray & waste bin', 'Catches spillage under the cup station. A float sensor flags when it needs emptying.', 'mech', 'all');
{
  add(waste, box(1.5, 0.06, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a2f35, metalness: 0.6, roughness: 0.5 }), 0.2, 0.05, 0.4);
  add(waste, box(0.9, 0.5, 0.5), MAT.darkMetal, 1.7, 0.27, 0.6);
  add(waste, box(0.86, 0.02, 0.46), MAT.black, 1.7, 0.53, 0.6);
}

// ================================================================== FLOW PATHS
// Translucent routes: powder, hot water, cold loop.
const flowGroup = new THREE.Group();
scene.add(flowGroup);
flowGroup.visible = false;

function route(pts, color, r = 0.035) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, 90, r, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
  flowGroup.add(m);
  return m;
}
// powder: each bin outlet -> dispense head
for (let i = 0; i < 5; i++) {
  const x = -CW / 2 + 0.75 + i * 0.92;
  route([[x, 3.2, 0.1], [x, 2.6, 0.7], [0.75, 2.2, 1.0], [0.75, 1.75, 1.15]], 0xd9c9a3);
}
// hot water: boiler -> cup
route([[-1.3, 4.0, 0.5], [-0.4, 3.0, 0.9], [0.3, 2.2, 1.1], [0.75, 1.8, 1.2]], 0xff5f56);
// cold loop: compressor -> condenser -> barrels
route([[-0.55, 1.1, -0.6], [0.2, 1.6, -0.6], [0.9, 1.9, -0.55], [0.4, 1.4, 0.0], [-1.3, 1.2, 0.2]], 0x2b7fd4);

// ================================================================== PICK + LABELS
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// HTML label overlay
const labelLayer = document.createElement('div');
labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4';
STAGE.appendChild(labelLayer);
const labelEls = new Map();

function labelFor(rec) {
  let el = labelEls.get(rec.id);
  if (!el) {
    el = document.createElement('div');
    el.textContent = rec.name.split('·')[0].trim();
    el.style.cssText = 'position:absolute;transform:translate(-50%,-50%);font:11px ui-sans-serif;' +
      'color:#dbe6f2;background:rgba(9,13,18,.72);border:1px solid #2b3a4a;border-radius:5px;' +
      'padding:2px 6px;white-space:nowrap;transition:opacity .2s';
    labelLayer.appendChild(el);
    labelEls.set(rec.id, el);
  }
  return el;
}
const _v = new THREE.Vector3();
function updateLabels() {
  for (const rec of PARTS) {
    const el = labelFor(rec);
    if (!labelsOn || !rec.obj.visible) { el.style.opacity = '0'; continue; }
    const bb = new THREE.Box3().setFromObject(rec.obj);
    if (bb.isEmpty()) { el.style.opacity = '0'; continue; }
    bb.getCenter(_v);
    _v.y = bb.max.y + 0.12;
    const p = _v.clone().project(camera);
    if (p.z > 1 || p.x < -1.15 || p.x > 1.15 || p.y < -1.15 || p.y > 1.15) { el.style.opacity = '0'; continue; }
    el.style.opacity = focusFilter(rec) ? '0.95' : '0.18';
    el.style.left = ((p.x * 0.5 + 0.5) * STAGE.clientWidth) + 'px';
    el.style.top = ((-p.y * 0.5 + 0.5) * STAGE.clientHeight) + 'px';
  }
}

// ------------------------------------------------------------------ picking
const dragInfo = { down: false, moved: false, x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragInfo.down = true; dragInfo.moved = false;
  dragInfo.x = e.clientX; dragInfo.y = e.clientY;
});
renderer.domElement.addEventListener('pointerup', (e) => {
  dragInfo.down = false;
  if (dragInfo.moved) return;
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(PARTS.map((p) => p.obj), true);
  const hit = hits.find((h) => h.object.visible && h.object.userData.partId);
  select(hit ? hit.object.userData.partId : null);
});

// ------------------------------------------------------------------ selection
let selectedId = null;
const selOutline = new THREE.BoxHelper(new THREE.Object3D(), 0x39d0a2);
selOutline.material.linewidth = 2;
selOutline.visible = false;
scene.add(selOutline);

function select(id) {
  selectedId = id;
  const rec = PARTS.find((p) => p.id === id);
  const panel = document.getElementById('sel');
  if (!rec) {
    selOutline.visible = false;
    panel.innerHTML = '<div class="empty">Click any component in the 3D view to identify it.</div>';
    return;
  }
  selOutline.setFromObject(rec.obj);
  selOutline.visible = true;
  panel.innerHTML =
    `<div class="name">${rec.name}</div>` +
    `<div class="desc">${rec.desc}</div>` +
    (rec.tags.length ? rec.tags.map((t) => `<span class="tagline">${t}</span>`).join('') : '');
}

// ------------------------------------------------------------------ focus modes
let focus = 'all';
function focusFilter(rec) {
  return focus === 'all' || rec.focus === focus || rec.focus === 'all';
}
function applyFocus() {
  for (const rec of PARTS) {
    if (rec.id === 'cabinet') continue;
    const dim = !focusFilter(rec);
    rec.obj.traverse((o) => {
      if (!o.isMesh) return;
      o.userData._mats = o.userData._mats || (Array.isArray(o.material) ? o.material : [o.material]);
      for (const m of o.userData._mats) {
        if (m.userData._baseTransparent === undefined) {
          m.userData._baseTransparent = m.transparent;
          m.userData._baseOpacity = m.opacity;
        }
        if (dim) { m.transparent = true; m.opacity = Math.min(m.userData._baseOpacity, 0.1); }
        else { m.transparent = m.userData._baseTransparent; m.opacity = m.userData._baseOpacity; }
        m.needsUpdate = true;
      }
    });
  }
}

// ------------------------------------------------------------------ view modes
let exploded = false, doorOpen = false, labelsOn = true, xray = false;
const homePos = new Map();
for (const rec of PARTS) homePos.set(rec.id, rec.obj.position.clone());

function setExplode(on) {
  exploded = on;
  for (const rec of PARTS) {
    const h = homePos.get(rec.id);
    if (rec.id === 'cabinet' || rec.id === 'backplate' || rec.id === 'door') continue;
    if (on) {
      const dir = new THREE.Vector3();
      const bb = new THREE.Box3().setFromObject(rec.obj);
      bb.getCenter(dir);
      dir.sub(INTERIOR_BOX.getCenter(new THREE.Vector3())).normalize();
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      rec.obj.position.copy(h).addScaledVector(dir, 0.9);
    } else rec.obj.position.copy(h);
  }
  if (selectedId) select(selectedId);
}

// ------------------------------------------------------------------ orbit controls (inline)
class Orbit {
  constructor(cam, dom) {
    this.cam = cam; this.dom = dom;
    this.target = TARGET_HOME.clone();
    this.sph = new THREE.Spherical().setFromVector3(CAM_HOME.clone().sub(this.target));
    this.dragging = null; this.px = 0; this.py = 0;
    dom.addEventListener('pointerdown', (e) => { this.dragging = e.button; this.px = e.clientX; this.py = e.clientY; });
    window.addEventListener('pointerup', () => { this.dragging = null; });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointermove', (e) => {
      if (this.dragging === null) return;
      const dx = e.clientX - this.px, dy = e.clientY - this.py;
      if (Math.hypot(dx, dy) > 3) dragInfo.moved = true;
      this.px = e.clientX; this.py = e.clientY;
      if (this.dragging === 0) {
        this.sph.theta -= dx * 0.005;
        this.sph.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.sph.phi - dy * 0.005));
      } else {
        const pan = new THREE.Vector3();
        const right = new THREE.Vector3().setFromMatrixColumn(this.cam.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.cam.matrix, 1);
        pan.addScaledVector(right, -dx * 0.006).addScaledVector(up, dy * 0.006);
        this.target.add(pan);
      }
      this.update();
    });
    this.tween = null;
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.sph.radius = Math.max(3, Math.min(30, this.sph.radius * (1 + Math.sign(e.deltaY) * 0.09)));
      this.update();
    }, { passive: false });
    this.update();
  }
  fly(target, camPos) {
    this.tween = {
      t: 0, dur: 0.7,
      tgt0: this.target.clone(), tgt1: target.clone(),
      cam0: this.cam.position.clone(), cam1: camPos.clone(),
    };
  }
  update() {
    if (this.tween) {
      const k = this.tween;
      k.t = Math.min(1, k.t + 0.045);
      const e = k.t < 0.5 ? 2 * k.t * k.t : 1 - Math.pow(-2 * k.t + 2, 2) / 2;
      this.target.lerpVectors(k.tgt0, k.tgt1, e);
      this.cam.position.lerpVectors(k.cam0, k.cam1, e);
      this.cam.lookAt(this.target);
      if (k.t >= 1) this.tween = null;
      return;
    }
    const p = new THREE.Vector3().setFromSpherical(this.sph).add(this.target);
    this.cam.position.copy(p);
    this.cam.lookAt(this.target);
  }
}
const orbit = new Orbit(camera, renderer.domElement);

// ------------------------------------------------------------------ UI wiring
const $ = (id) => document.getElementById(id);
$('v-explode').onclick = (e) => { setExplode(!exploded); e.target.classList.toggle('on', exploded); };
$('v-door').onclick = (e) => {
  doorOpen = !doorOpen;
  e.target.classList.toggle('on', doorOpen);
  orbit.fly(TARGET_HOME, CAM_HOME);
};
$('v-flow').onclick = (e) => { flowGroup.visible = !flowGroup.visible; e.target.classList.toggle('on', flowGroup.visible); };
$('v-labels').onclick = (e) => { labelsOn = !labelsOn; e.target.classList.toggle('on', labelsOn); };
$('v-xray').onclick = (e) => {
  xray = !xray;
  e.target.classList.toggle('on', xray);
  MAT.skin.transparent = true;
  MAT.skin.opacity = xray ? 0.1 : 1;
  MAT.skin.needsUpdate = true;
};
for (const b of document.querySelectorAll('[data-focus]')) {
  b.onclick = () => {
    document.querySelectorAll('[data-focus]').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    focus = b.dataset.focus;
    applyFocus();
    const cams = {
      electrical: [[0, 4.6, 0.2], [0.3, 4.7, 6.6]],
      thermal: [[0.2, 2.2, 0.0], [0.6, 3.0, 7.0]],
      powder: [[0, 3.6, 0.4], [3.4, 5.2, 6.6]],
      all: [TARGET_HOME.toArray(), CAM_HOME.toArray()],
    }[focus];
    orbit.fly(new THREE.Vector3(...cams[0]), new THREE.Vector3(...cams[1]));
  };
}

// ================================================================== RENDER LOOP
const clock = new THREE.Clock();
let doorA = 0;

function resize() {
  const w = STAGE.clientWidth, h = STAGE.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(STAGE);
resize();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // door swing
  const targetA = doorOpen ? -2.15 : 0;
  doorA += (targetA - doorA) * Math.min(1, dt * 6);
  door.obj.rotation.y = doorA;

  // condenser fan spin
  for (const f of DYN.fans) f.rotation.y += (f.userData.spin || 0) * dt;

  // mixer shaft spin
  if (mix.shaft) mix.shaft.rotation.y += (mix.spin || 0) * dt;

  // auger screws spin while their motor runs
  for (const a of DYN.augers) a.rotation.z += (a.userData.spin || 0) * dt;

  updateLabels();
  orbit.update();
  renderer.render(scene, camera);
}
animate();

// ================================================================== TELEMETRY
// Live WebSocket when the twin server is running; otherwise (static hosting,
// e.g. Vercel) fall back to the demo snapshot generated at build time so the
// 3D view still animates with realistic values.
const DEMO_MODE = new URLSearchParams(location.search).get('demo') === '1' || location.protocol === 'file:';
let live = false;

function connect() {
  if (DEMO_MODE) { startDemo(); return; }
  let ws;
  try {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  } catch { startDemo(); return; }
  ws.onopen = () => { live = true; };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state') applyState(msg.data);
  };
  ws.onerror = () => { if (!live) startDemo(); };
  ws.onclose = () => { if (live) setTimeout(connect, 1500); else startDemo(); };
}

let demoStarted = false;
async function startDemo() {
  if (demoStarted) return;
  demoStarted = true;
  let snap;
  try {
    const res = await fetch('/demo-state.json', { cache: 'no-store' });
    snap = (await res.json()).data;
  } catch { return; }
  applyState(snap);
  // keep a light animation so temperatures drift realistically
  let t = snap.t || 0;
  setInterval(() => {
    t += 0.4;
    snap.boiler.water_c = +(snap.boiler.water_c + Math.sin(t / 9) * 0.15).toFixed(2);
    snap.chiller.water_c = +(snap.chiller.water_c + Math.sin(t / 13 + 1) * 0.1).toFixed(2);
    applyState(snap);
  }, 400);
}

connect();

const C = {
  on: new THREE.Color(0x39d0a2), off: new THREE.Color(0x37475a),
  heat: new THREE.Color(0xff5f56), cold: new THREE.Color(0x2b7fd4),
};
function setEmissive(mesh, color, intensity) {
  if (!mesh) return;
  const e = color || C.on;
  mesh.material.color.copy(e).multiplyScalar(0.25);
  mesh.material.emissive.copy(e);
  mesh.material.emissiveIntensity = intensity;
}

function applyState(s) {
  // --- relay bank: light each relay + its LED ---
  s.relays.forEach((r, i) => {
    const d = DYN.relays[i]; if (!d) return;
    d.body.material = r.on ? MAT.relayHot : MAT.relay;
    setEmissive(d.led, r.on ? C.on : C.off, r.on ? 2.2 : 0.1);
  });

  // --- powder bins: fill level + auger spin + LED ---
  s.hoppers.forEach((h, i) => {
    const d = DYN.hoppers[i]; if (!d) return;
    const pct = Math.max(0.03, h.pct / 100);
    // powder block shrinks from the top; keep the base anchored
    d.bin.scale.set(1, pct, 1);
    d.bin.position.y = d.y0 - (d.bh - 0.1) / 2 * (1 - pct);
    d.bin.visible = pct > 0.03;
    const running = s.relays[i] && s.relays[i].on;
    const auger = DYN.augers[i];
    if (auger) auger.userData.spin = running ? 16 : 0;
    setEmissive(d.led, h.empty ? C.heat : (running ? C.on : C.off),
      running ? 2 : (h.empty ? 1.2 : 0.1));
  });

  // --- boiler / SSR / heater ---
  const heating = s.boiler.heater;
  setEmissive(DYN.boilerLed, heating ? C.heat : C.off, heating ? 2.4 : 0.05);
  setEmissive(DYN.ssrLed, heating ? C.heat : C.off, heating ? 2.2 : 0.08);

  // --- chiller / compressor / fan ---
  const cooling = s.chiller.compressor;
  if (comp.meshes[0]) comp.meshes[0].material = cooling ? MAT.compHot : MAT.black;
  if (DYN.condFanHousing) DYN.condFanHousing.material = cooling ? MAT.compHot : MAT.darkMetal;
  DYN.fans.forEach((f) => { f.userData.spin = s.fan.on ? 14 : 0; });

  // --- water barrels level ---
  const wl = Math.max(0.05, Math.min(1, (s.waterTank ? s.waterTank.level_l : 17.5) / 20));
  DYN.waterLevels.forEach((w) => {
    w.scale.set(1, wl, 1);
    w.position.y = 0.72 - 0.1 - 0.5 * (1 - wl);
  });

  // --- mixer ---
  mix.spin = s.actuators.mixer.rpm > 0 ? s.actuators.mixer.rpm / 600 : 0;

  // --- turntable: rotate the cup station around its own axis ---
  const rot = THREE.MathUtils.degToRad(s.actuators.turntable.angle_deg);
  tt.rotation.y = rot;
  cup.position.set(0.75 + Math.sin(rot) * 0.38, 1.52, 0.9 + Math.cos(rot) * 0.38);

  // --- LCD screen: draw the live HMI ---
  drawScreen(s);

  // --- side panel render ---
  renderPanel(s);
}

// ------------------------------------------------------------------ LCD HMI
let lastScreen = 0;
function drawScreen(s) {
  if (!DYN.screenCanvas) return;
  const now = performance.now();
  if (now - lastScreen < 200) return;   // ~5 Hz is plenty
  lastScreen = now;
  const g = DYN.screenCanvas.getContext('2d');
  const W = 512, H = 384;
  g.fillStyle = '#05080a'; g.fillRect(0, 0, W, H);
  // header
  g.fillStyle = s.state === 'ERROR' ? '#3a0d0d' : '#0a2230';
  g.fillRect(0, 0, W, 64);
  g.fillStyle = '#dbe6f2'; g.font = 'bold 30px ui-sans-serif, system-ui';
  g.fillText('PROTEIN DISPENSER', 20, 44);
  // state
  const st = s.state || 'BOOT';
  g.fillStyle = st === 'ERROR' ? '#ff5f56' : (s.power && s.power.booted ? '#39d0a2' : '#f2d21b');
  g.font = 'bold 26px ui-sans-serif, system-ui';
  g.textAlign = 'right'; g.fillText(st, W - 20, 44); g.textAlign = 'left';
  // body rows
  g.font = '22px ui-sans-serif, system-ui';
  const rows = [
    ['Boiler', `${s.boiler.water_c.toFixed(1)} / ${s.boiler.setpoint_c} \u00b0C`],
    ['Chiller', `${s.chiller.water_c.toFixed(1)} / ${s.chiller.setpoint_c} \u00b0C`],
    ['Current draw', `${s.energy.watts} W`],
    ['12 V rail', `${s.powerRails.psu12.i.toFixed(2)} A`],
    ['24 V rail', `${s.powerRails.psu24.i.toFixed(2)} A`],
  ];
  rows.forEach((r, i) => {
    const y = 116 + i * 44;
    g.fillStyle = '#8fa3b8'; g.fillText(r[0], 24, y);
    g.fillStyle = '#dbe6f2'; g.textAlign = 'right'; g.fillText(r[1], W - 24, y); g.textAlign = 'left';
  });
  // footer: fill levels as a mini bar chart
  g.fillStyle = '#0a2230'; g.fillRect(0, H - 52, W, 52);
  const bw = (W - 40) / s.hoppers.length;
  s.hoppers.forEach((h, i) => {
    const x = 20 + i * bw;
    g.fillStyle = '#22303c'; g.fillRect(x, H - 44, bw - 10, 30);
    g.fillStyle = '#39d0a2'; g.fillRect(x, H - 44 + 30 * (1 - h.pct / 100), bw - 10, 30 * (h.pct / 100));
  });
  DYN.screenTex.needsUpdate = true;
}

// ================================================================== SIDE PANEL
function bar(pct) { return `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`; }

function renderPanel(s) {
  document.getElementById('hoppers').innerHTML = s.hoppers.map((h) => `
    <div class="card">
      <div class="row"><span>${h.name}</span><span>${h.level_g} g \u00b7 ${h.pct}%</span></div>
      ${bar(h.pct)}
    </div>`).join('');

  document.getElementById('relays').innerHTML = s.relays.map((r) => `
    <div class="row"><span><i class="dot ${r.on ? 'on' : ''}"></i>${r.name}</span>
    <span>${r.on ? 'ON' : 'off'}</span></div>`).join('');

  document.getElementById('thermal').innerHTML = `
    <div class="row"><span><i class="dot ${s.boiler.heater ? 'heat' : ''}"></i>Boiler water</span><span>${s.boiler.water_c} \u00b0C \u2192 ${s.boiler.setpoint_c} \u00b0C</span></div>
    <div class="row"><span><i class="dot ${s.chiller.compressor ? 'on' : ''}"></i>Chiller bath</span><span>${s.chiller.water_c} \u00b0C \u2192 ${s.chiller.setpoint_c} \u00b0C</span></div>
    <div class="row"><span><i class="dot ${s.ssr ? 'heat' : ''}"></i>SSR heater</span><span>${s.ssr ? 'ON (240 V)' : 'off'}</span></div>
    <div class="row"><span><i class="dot ${s.fan.on ? 'on' : ''}"></i>Condenser fan</span><span>${s.fan.rpm} rpm</span></div>`;

  document.getElementById('power').innerHTML = `
    <div class="row"><span>12 V rail</span><span>${s.powerRails.psu12.i} / ${s.powerRails.psu12.i_max} A</span></div>
    <div class="row"><span>24 V rail</span><span>${s.powerRails.psu24.i} / ${s.powerRails.psu24.i_max} A</span></div>
    <div class="row"><span>Draw now</span><span>${s.energy.watts} W</span></div>
    <div class="row"><span>Water tank</span><span>${s.waterTank ? s.waterTank.level_l : '-'} L</span></div>
    <div class="row"><span>State</span><span>${s.state}</span></div>`;

  document.getElementById('events').innerHTML = s.events.slice().reverse().slice(0, 14)
    .map((e) => `<div class="evt"><b>${e.tag}</b> ${e.msg}</div>`).join('');
}
