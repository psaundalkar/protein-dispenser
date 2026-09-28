/**
 * 3D internal view of the protein-dispenser vending machine.
 *
 * Geometry is laid out from the user's cabinet photographs:
 *   - top-left  PSU (LRS-100-12), top-centre control PCB, top-right PSU (LRS-100-24)
 *   - centre    blue 8-channel relay board (BESTEP JQX-13F)
 *   - below     DIN rail, then 6 blue SSR / delay boxes
 *   - bottom    chiller condenser + compressor (right), boiler (left),
 *               water tank, auger hoppers, dispense head
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
scene.fog = new THREE.Fog(0x080b0f, 22, 48);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const CAM_HOME = new THREE.Vector3(5.2, 6.4, 12.6);
// The cabinet interior centre is the orbit target.
const TARGET_HOME = new THREE.Vector3(0, 3.05, 0);

// ------------------------------------------------------------------ lights
scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x121820, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(7, 12, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 40;
const sc = 9;
Object.assign(key.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc });
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const fill = new THREE.DirectionalLight(0x86b6ff, 0.7); fill.position.set(-8, 5, -7); scene.add(fill);
const rim = new THREE.PointLight(0x4aa8ff, 60, 26, 2); rim.position.set(0, 3.2, 1.4); scene.add(rim);

// ------------------------------------------------------------------ materials
const MAT = {
  skin:      new THREE.MeshStandardMaterial({ color: 0x2c3238, metalness: 0.65, roughness: 0.42 }),
  skinInner: new THREE.MeshStandardMaterial({ color: 0x1d2227, metalness: 0.6, roughness: 0.55, side: THREE.BackSide }),
  panel:     new THREE.MeshStandardMaterial({ color: 0xb9c2cc, metalness: 0.85, roughness: 0.28 }),
  board:     new THREE.MeshStandardMaterial({ color: 0x1e6b45, metalness: 0.2, roughness: 0.65 }),
  boardBlue: new THREE.MeshStandardMaterial({ color: 0x1b5fc4, metalness: 0.25, roughness: 0.55 }),
  relay:     new THREE.MeshStandardMaterial({ color: 0x2f74c9, metalness: 0.3, roughness: 0.5 }),
  ssr:       new THREE.MeshStandardMaterial({ color: 0x2f74c9, metalness: 0.35, roughness: 0.45 }),
  metal:     new THREE.MeshStandardMaterial({ color: 0x8b949e, metalness: 0.9, roughness: 0.35 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x3a4046, metalness: 0.8, roughness: 0.5 }),
  black:     new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.5, roughness: 0.6 }),
  copper:    new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1.0, roughness: 0.35 }),
  hx:        new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.95, roughness: 0.3 }),
  glass:     new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, metalness: 0, roughness: 0.1,
               transmission: 0.85, transparent: true, opacity: 0.45, ior: 1.45, thickness: 0.6 }),
  water:     new THREE.MeshPhysicalMaterial({ color: 0x2b7fd4, metalness: 0, roughness: 0.12,
               transmission: 0.7, transparent: true, opacity: 0.7 }),
  powder:    new THREE.MeshStandardMaterial({ color: 0xd9c9a3, metalness: 0, roughness: 0.95 }),
  red:       new THREE.MeshStandardMaterial({ color: 0xcc2b2b, metalness: 0.2, roughness: 0.6 }),
  white:     new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.1, roughness: 0.7 }),
  busbar:    new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.9, roughness: 0.3 }),
};

// ------------------------------------------------------------------ registry
/** All selectable parts. Each entry: { id, name, desc, group, tags, obj, home, focus } */
const PARTS = [];
/** Dynamic meshes grouped by behaviour so telemetry can update them cheaply. */
const DYN = { relays: [], hoppers: [], leds: [], fans: [], boilerLed: null, ssrLed: null, tankWater: null, condFanHousing: null };

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
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 20) => new THREE.CylinderGeometry(r, r, h, s);

// ================================================================== CABINET
// Interior is 5.0 wide, 6.1 tall, 2.6 deep. Floor at y=0.
const CW = 5.0, CH = 6.1, CD = 2.6, WALL = 0.06;

const cab = reg('cabinet', 'Cabinet shell', 'Powder-coated sheet-steel vending enclosure. 5.0 × 6.1 × 2.6 (interior).', 'mech', 'all');
{
  // back + sides + top + bottom as thin plates (front is the door)
  add(cab, box(CW, CH, WALL), MAT.skin, 0, CH / 2, -CD / 2);
  add(cab, box(WALL, CH, CD), MAT.skin, -CW / 2 - WALL / 2, CH / 2, 0);
  add(cab, box(WALL, CH, CD), MAT.skin, CW / 2 + WALL / 2, CH / 2, 0);
  add(cab, box(CW + WALL * 2, WALL, CD), MAT.skin, 0, CH + WALL / 2, 0);
  add(cab, box(CW + WALL * 2, WALL, CD), MAT.skin, 0, -WALL / 2, 0);
  // corner posts for a rigid look
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(cab, box(0.1, CH, 0.1), MAT.darkMetal, sx * (CW / 2 - 0.05), CH / 2, sz * (CD / 2 - 0.05));
  }
}
const INTERIOR_BOX = new THREE.Box3(
  new THREE.Vector3(-CW / 2, 0, -CD / 2),
  new THREE.Vector3(CW / 2, CH, CD / 2));

// ------------------------------------------------------------------ backplate
const bp = reg('backplate', 'Back mounting plate', 'Galvanised steel sub-panel; all electrical gear bolts to this.', 'mech', 'all');
add(bp, box(CW - 0.1, CH - 0.4, 0.03), new THREE.MeshStandardMaterial({
  color: 0x8e979e, metalness: 0.85, roughness: 0.5 }), 0, CH / 2, -CD / 2 + 0.06);

// ------------------------------------------------------------------ door
const door = reg('door', 'Front door', 'Hinged service door with the customer pickup window and payment panel.', 'mech', 'all');
{
  // hinge at +x edge; group pivots about the right edge
  const hx = CW / 2;
  door.obj.position.set(hx, 0, CD / 2 + 0.04);
  const d = add(door, box(CW, CH, 0.06), MAT.skin, -CW / 2, CH / 2, 0);
  d.name = 'doorSkin';
  add(door, box(CW - 0.14, CH - 0.14, 0.02), MAT.skinInner, -CW / 2, CH / 2, -0.03);
  // dark pickup window
  add(door, box(1.5, 1.1, 0.04), MAT.black, -CW / 2 - 0.5, 2.0, 0.02);
  // payment / HMI bezel
  add(door, box(0.9, 1.3, 0.05), MAT.black, -CW / 2 + 1.5, 4.0, 0.02);
  const scr = add(door, box(0.74, 0.56, 0.01), new THREE.MeshStandardMaterial({
    color: 0x0b2b3a, emissive: 0x1f7ea8, emissiveIntensity: 0.9, roughness: 0.25 }),
    -CW / 2 + 1.5, 4.28, 0.05);
  door.screen = scr;
  // coin / card slot
  add(door, box(0.3, 0.06, 0.03), MAT.metal, -CW / 2 + 1.5, 3.6, 0.05);
  // hinges
  for (const y of [0.9, 3.1, 5.3]) add(door, box(0.1, 0.16, 0.12), MAT.metal, 0, y, 0);
}

// ================================================================== PSUs
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
  add(r, box(0.16, 0.1, 0.005), new THREE.MeshStandardMaterial({ color: 0xf2d21b, emissive: 0x554700, emissiveIntensity: 0.3 }),
    x - w / 2 + 0.2, y + h / 2 - 0.16, z + d / 2 + 0.004);
  // terminal block
  add(r, box(w * 0.5, 0.09, 0.12), MAT.black, x, y - h / 2 + 0.06, z + d / 2 + 0.03);
  r.model = { x, y, z, w, h, d };
  return r;
}

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

const psu12 = makePSU('psu12', 'PSU-12V · LRS-100-12', 'Mean-Well style switch-mode supply, 12 V / 8.5 A. Feeds the control PCB, relay coils and DC auger motors.', -1.62, 5.05, -1.16, 1.15, 2.0, 0.9);
const psu24 = makePSU('psu24', 'PSU-24V · LRS-100-24', 'Second supply, 24 V / 4.5 A. Feeds the SSR trigger and the compressor contactor coil.', 1.62, 5.05, -1.16, 1.15, 2.0, 0.9);
void psu12; void psu24;

// ================================================================== CONTROL PCB
const pcb = reg('pcb', 'Control PCB (custom)', 'STM32F103 controller board: 8 relay drivers via ULN2803, MAX485 Modbus, RS485 + SSR gate, NTC inputs. This is the board in hardware/pcb.', 'electrical', 'electrical', ['mcu', 'modbus']);
{
  const w = 1.75, h = 0.95;
  add(pcb, box(w, h, 0.05), MAT.board, 0, 5.55, -1.15);
  // mounting stand-offs
  for (const sx of [-1, 1]) for (const sy of [-1, 1])
    add(pcb, cyl(0.05, 0.1, 8), MAT.metal, sx * (w / 2 - 0.12), 5.55 + sy * (h / 2 - 0.12), -1.2);
  // MCU
  add(pcb, box(0.3, 0.3, 0.06), MAT.black, 0.15, 5.62, -1.11);
  // green terminal blocks along the edges
  add(pcb, box(w, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.6 }), 0, 5.2, -1.11);
  add(pcb, box(w, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.6 }), 0, 5.9, -1.11);
  // status LEDs
  for (let i = 0; i < 4; i++) {
    const led = add(pcb, new THREE.SphereGeometry(0.035, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x39d0a2, emissiveIntensity: 0.15 }),
      -0.7 + i * 0.16, 5.28, -1.08);
    DYN.leds.push({ m: led, kind: 'pcb', i });
  }
}

// ================================================================== RELAY BOARD
const relays = reg('relays', 'Relay board · 8 ch (JQX-13F)', 'Eight 12 V SPDT relays. Channels 1-5 = auger motors, 6 = cup-drop solenoid, 7 = hot-water solenoid, 8 = cold-water solenoid.', 'electrical', 'electrical', ['relay']);
{
  const w = 1.9, h = 0.8;
  add(relays, box(w, h, 0.06), MAT.boardBlue, 0, 4.35, -1.18);
  add(relays, box(w, 0.16, 0.16), MAT.black, 0, 4.02, -1.13);
  add(relays, box(w, 0.16, 0.16), MAT.black, 0, 4.68, -1.13);
  const bw = 0.19, bh = 0.26, bd = 0.22;
  for (let i = 0; i < 8; i++) {
    const x = -w / 2 + 0.16 + i * 0.225;
    const b = add(relays, box(bw, bh, bd), MAT.relay, x, 4.35, -1.09);
    b.userData.channel = i;
    const led = add(relays, new THREE.SphereGeometry(0.032, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x221111, emissive: 0xff3b30, emissiveIntensity: 0.1 }),
      x, 4.54, -1.02);
    DYN.relays.push({ body: b, led });
  }
}

// ================================================================== DIN RAIL + SSR BOXES
const din = reg('din', 'DIN rail', 'TS35 rail carrying the solid-state relays and timer modules.', 'electrical', 'electrical');
add(din, box(CW - 0.3, 0.07, 0.35), MAT.metal, 0, 3.55, -1.1);
add(din, box(CW - 0.3, 0.04, 0.05), MAT.darkMetal, 0, 3.55, -1.28);

const ssr = reg('ssr', 'SSR-25DA heater relay', 'Fotek-style 25 A solid-state relay. Switches the 240 V boiler element. The only mains-switching device in the machine.', 'thermal', 'thermal', ['mains', 'heater']);
const delayPart = reg('delay', 'Actuator drivers · 5 × timer', 'Delay/timer modules that sequence the mixer head, turntable, cup gate and rinse valve.', 'mech', 'powder');
{
  const x0 = -CW / 2 + 0.55, pitch = 0.62;
  // 6 blue boxes on the rail (SSR + delay modules, as photographed)
  for (let i = 0; i < 6; i++) {
    const x = x0 + i * pitch;
    const target = i === 0 ? ssr : delayPart;
    add(target, box(0.42, 0.5, 0.42), MAT.ssr, x, 3.5, -1.05);
    add(target, box(0.3, 0.16, 0.01), MAT.white, x, 3.62, -0.84);
    add(target, box(0.26, 0.1, 0.02), MAT.red, x, 3.42, -0.84);
    const led = add(target, new THREE.SphereGeometry(0.035, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x221111, emissive: 0xff3b30, emissiveIntensity: 0.12 }),
      x + 0.16, 3.28, -0.84);
    if (i === 0) DYN.ssrLed = led;
  }
}

// ================================================================== CHILLER LOOP
const cond = reg('condenser', 'Condenser coil', 'Finned copper condenser for the cold-water bath. Rejects heat taken out of the chiller tank.', 'thermal', 'thermal', ['cold']);
{
  const x = -1.35, y = 2.15, z = -0.95;
  add(cond, box(0.95, 1.55, 0.45), MAT.hx, x, y, z);
  // copper serpentine on the front face
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const yy = y + 0.62 - i * 0.21;
    pts.push(new THREE.Vector3(x - 0.4, yy, z + 0.24), new THREE.Vector3(x + 0.4, yy, z + 0.24));
  }
  for (let i = 0; i < 6; i++) {
    const yy = y + 0.62 - i * 0.21 - 0.21;
    const dir = i % 2 ? 1 : -1;
    pts.push(new THREE.Vector3(x + dir * 0.4, y + 0.62 - i * 0.21, z + 0.24),
      new THREE.Vector3(x + dir * 0.4, yy, z + 0.24));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.028, 8), MAT.copper);
  tube.userData.partId = cond.id;
  cond.obj.add(tube); cond.meshes.push(tube);
}

const comp = reg('compressor', 'Compressor', 'Hermetic reciprocating compressor for the chiller. Runs off the 24 V contactor when the cold bath needs cooling.', 'thermal', 'thermal', ['cold']);
{
  const x = 0.98, y = 2.1, z = -0.9;
  const b = add(comp, cyl(0.42, 0.85, 24), MAT.black, x, y, z);
  b.rotation.z = Math.PI / 2;
  add(comp, new THREE.SphereGeometry(0.4, 20, 16), MAT.black, x + 0.32, y, z);
  // terminal box
  add(comp, box(0.22, 0.18, 0.18), MAT.darkMetal, x - 0.2, y + 0.34, z + 0.3);
  // copper suction line up to the condenser
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(x - 0.05, y + 0.42, z),
    new THREE.Vector3(x - 0.6, y + 0.9, z),
    new THREE.Vector3(-1.35, y + 0.95, z),
  ]), 40, 0.03, 8), MAT.copper);
  line.userData.partId = comp.id; comp.obj.add(line); comp.meshes.push(line);
}

const condFanReg = reg('fan', 'Condenser fan', 'Axial fan that pulls air across the condenser coil.', 'thermal', 'thermal', ['cold']);
const condFan = add(condFanReg, cyl(0.34, 0.12, 20), MAT.darkMetal, -1.35, 3.15, -0.9);
condFan.rotation.x = Math.PI / 2;
const condBlade = new THREE.Group();
for (let i = 0; i < 5; i++) {
  const bl = new THREE.Mesh(box(0.3, 0.02, 0.14), MAT.black);
  bl.position.set(Math.cos(i / 5 * 6.283) * 0.16, 0, Math.sin(i / 5 * 6.283) * 0.16);
  bl.rotation.y = i / 5 * 6.283;
  bl.castShadow = true; bl.userData.partId = condFanReg.id;
  condBlade.add(bl);
}
condBlade.position.set(-1.35, 3.05, -0.9);
condBlade.rotation.x = Math.PI / 2;
condFanReg.obj.add(condBlade);
DYN.fans.push(condBlade);
DYN.condFanHousing = condFan;

// ================================================================== BOILER (hot water)
const boiler = reg('boiler', 'Hot-water boiler', 'Stainless tank with a 1.2 kW 240 V element run through the SSR. Feeds the hot-water solenoid.', 'thermal', 'thermal', ['mains', 'heater', 'hot']);
{
  const x = -1.05, y = 2.05, z = 0.25;
  add(boiler, cyl(0.5, 1.5, 24), new THREE.MeshStandardMaterial({ color: 0xc0c6cc, metalness: 0.9, roughness: 0.35 }), x, y, z);
  add(boiler, cyl(0.52, 0.18, 24), MAT.metal, x, y + 0.8, z);
  add(boiler, cyl(0.52, 0.18, 24), MAT.metal, x, y - 0.8, z);
  // heating element boss
  add(boiler, box(0.24, 0.24, 0.24), MAT.copper, x + 0.5, y - 0.3, z);
  // red element indicator (colour driven by telemetry)
  const heat = add(boiler, new THREE.SphereGeometry(0.05, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x332020, emissive: 0xff5f56, emissiveIntensity: 0 }), x + 0.52, y + 0.1, z + 0.5);
  DYN.boilerLed = heat;
  // insulated feed pipe to the mix head
  const p = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(x + 0.5, y + 0.75, z), new THREE.Vector3(0.15, 2.6, 0.6),
    new THREE.Vector3(0.75, 1.35, 0.9)]), 50, 0.045, 8),
    new THREE.MeshStandardMaterial({ color: 0x9aa6b2, metalness: 0.3, roughness: 0.7 }));
  p.userData.partId = boiler.id; boiler.obj.add(p); boiler.meshes.push(p);
}

// ================================================================== WATER TANK
const tank = reg('tank', 'Water tank', '20 L feed tank with a float switch. Distilled water only.', 'powder', 'powder', ['water']);
{
  const x = 0.75, y = 0.75, z = 0.35;
  add(tank, box(1.5, 1.2, 1.1), MAT.glass, x, y, z);
  const w = add(tank, box(1.44, 1.0, 1.04), MAT.water, x, y - 0.06, z);
  DYN.tankWater = w;
  // float switch
  add(tank, cyl(0.05, 0.3, 8), MAT.white, x - 0.5, y + 0.5, z);
}

// ================================================================== HOPPERS + AUGERS
const hoppers = reg('hoppers', 'Powder hoppers · 5', 'Five 1.5 kg hoppers, each with a 12 V geared auger motor and a 3.1 g/rev screw. Doses are metered by revolution count.', 'powder', 'powder', ['powder', 'auger']);
{
  const y0 = 3.15, pitch = 0.98, x0 = -CW / 2 + 0.62;
  for (let i = 0; i < 5; i++) {
    const x = x0 + i * pitch;
    // funnel
    add(hoppers, new THREE.ConeGeometry(0.36, 0.62, 22, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xd7dde3, metalness: 0.1, roughness: 0.45, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
      x, y0, -0.3);
    // powder cone (scaled by level)
    const pw = add(hoppers, new THREE.ConeGeometry(0.34, 0.62, 20, 1, true), MAT.powder, x, y0, -0.3);
    // auger tube
    add(hoppers, cyl(0.09, 0.5, 14), MAT.metal, x, y0 - 0.5, -0.05).rotation.z = Math.PI / 2;
    // motor
    const mo = add(hoppers, box(0.2, 0.2, 0.26), MAT.darkMetal, x, y0 - 0.5, 0.24);
    mo.userData.hopper = i;
    // motor LED
    const led = add(hoppers, new THREE.SphereGeometry(0.03, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x39d0a2, emissiveIntensity: 0.1 }),
      x, y0 - 0.36, 0.24);
    DYN.hoppers.push({ i, cone: pw, led, x, y0 });
    // hopper chrome rim
    add(hoppers, cyl(0.375, 0.03, 22), MAT.metal, x, y0 + 0.29, -0.3);
  }
}

// ================================================================== MIX HEAD
const mix = reg('mix', 'Mixer head', 'High-speed mixing head lowered into the cup. Rinsed with hot water after every drink.', 'powder', 'powder', ['mixer']);
{
  const x = 0.75, y = 2.25, z = 0.9;
  add(mix, cyl(0.2, 0.5, 18), MAT.metal, x, y, z);
  const shaft = add(mix, cyl(0.045, 0.7, 12), MAT.metal, x, y - 0.55, z);
  const bell = add(mix, new THREE.ConeGeometry(0.22, 0.28, 20), MAT.black, x, y - 0.95, z);
  bell.rotation.x = Math.PI; bell.rotation.z = 0;
  mix.shaft = shaft;
}

// ================================================================== TURNTABLE + CUP
const turn = reg('turntable', 'Turntable & cup station', 'Indexes the dropped cup under the dispenser, then to the mixer, then to the pickup window.', 'powder', 'powder', ['cup']);
const tt = add(turn, cyl(0.62, 0.06, 26), MAT.darkMetal, 0.75, 1.32, 0.9);
const cup = add(turn, cyl(0.2, 0.34, 20), MAT.white, 0.75, 1.52, 1.25);
const cupLid = add(turn, cyl(0.205, 0.03, 20), MAT.metal, 0.75, 1.70, 1.25);

// ================================================================== FLOW PATHS
// Three translucent routes drawn as tubes: powder, hot water, cold loop.
const flowGroup = new THREE.Group();
scene.add(flowGroup);
flowGroup.visible = false;

function route(pts, color) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, 90, 0.035, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }));
  flowGroup.add(m);
  return m;
}
// powder: each hopper funnel -> dispense head
for (let i = 0; i < 5; i++) {
  const x = -CW / 2 + 0.62 + i * 0.98;
  route([[x, 2.83, -0.3], [x, 2.6, 0.1], [0.75, 2.45, 0.7], [0.75, 1.75, 1.1]], 0xd9c9a3);
}
// hot water: boiler -> cup
route([[-0.55, 2.8, 0.25], [0.1, 2.7, 0.65], [0.75, 2.05, 0.95], [0.75, 1.8, 1.15]], 0xff5f56);
// cold loop: compressor -> condenser -> tank
route([[0.95, 2.5, -0.9], [-0.4, 3.1, -0.9], [-1.35, 2.9, -0.9], [-1.35, 1.4, -0.5], [0.75, 1.3, 0.35]], 0x2b7fd4);

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
    // anchor above the part's bounding box
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
        if (dim) { m.transparent = true; m.opacity = Math.min(m.userData._baseOpacity, 0.12); }
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
      rec.obj.position.copy(h).addScaledVector(dir, 0.85);
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
  animateDoor();
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
      electrical: [[0, 5.0, 0.4], [0.2, 5.1, 6.4]],
      thermal: [[0, 2.4, 0.1], [0.4, 3.2, 7.2]],
      powder: [[0, 2.6, 0.3], [3.6, 4.2, 6.4]],
      all: [TARGET_HOME.toArray(), CAM_HOME.toArray()],
    }[focus];
    orbit.fly(new THREE.Vector3(...cams[0]), new THREE.Vector3(...cams[1]));
  };
}

// door animation state
let doorA = 0;
function animateDoor() { /* eased in the render loop */ }

// ================================================================== MOSAIC ticker
const clock = new THREE.Clock();

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

  // fans spin with telemetry state
  for (const f of DYN.fans) f.rotation.y += (f.userData.spin || 0) * dt;

  // mixer shaft spin
  if (mix.shaft) mix.shaft.rotation.y += (mix.spin || 0) * dt;

  // auger LEDs already handled in telemetry; pulse idle LEDs gently
  updateLabels();
  orbit.update();
  renderer.render(scene, camera);
}
animate();

// ================================================================== TELEMETRY
// Live WebSocket when the twin server is running; otherwise (static hosting,
// e.g. Vercel) fall back to the demo snapshot generated at build time so the
// 3D view still animates with realistic values.
const S = { power: null };
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
  // keep a light animation: spin the fan and pulse the flow every frame
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
  const e = color || C.on;
  mesh.material.color.copy(e).multiplyScalar(0.25);
  mesh.material.emissive.copy(e);
  mesh.material.emissiveIntensity = intensity;
}

function applyState(s) {
  S.power = s;

  // --- relay bank: light each relay + its LED ---
  s.relays.forEach((r, i) => {
    const d = DYN.relays[i]; if (!d) return;
    d.body.material = r.on ? MAT.relayHot : MAT.relay;
    setEmissive(d.led, r.on ? C.on : C.off, r.on ? 2.2 : 0.1);
  });

  // --- powder hoppers ---
  s.hoppers.forEach((h, i) => {
    const d = DYN.hoppers[i]; if (!d) return;
    const pct = Math.max(0.02, h.pct / 100);
    // cone shrinks with level; keep the tip anchored
    d.cone.scale.set(1, pct, 1);
    d.cone.position.y = d.y0 - 0.31 * (1 - pct);
    d.cone.visible = pct > 0.02;
    setEmissive(d.led, h.empty ? C.heat : (s.relays[i] && s.relays[i].on ? C.on : C.off),
      s.relays[i] && s.relays[i].on ? 2 : (h.empty ? 1.2 : 0.1));
  });

  // --- boiler / SSR / heater ---
  const heating = s.boiler.heater;
  setEmissive(DYN.boilerLed, heating ? C.heat : C.off, heating ? 2.4 : 0.05);
  setEmissive(DYN.ssrLed, heating ? C.heat : C.off, heating ? 2.2 : 0.08);

  // --- chiller / compressor / fan ---
  const cooling = s.chiller.compressor;
  comp.meshes[0].material = cooling ? MAT.compHot : MAT.black;
  DYN.condFanHousing.material = cooling ? MAT.compHot : MAT.darkMetal;
  DYN.fans.forEach((f) => { f.userData.spin = s.fan.on ? 14 : 0; });

  // --- mixer ---
  mix.spin = s.actuators.mixer.rpm > 0 ? s.actuators.mixer.rpm / 600 : 0;

  // --- turntable: rotate the cup station around its own axis ---
  const rot = THREE.MathUtils.degToRad(s.actuators.turntable.angle_deg);
  tt.rotation.y = rot;
  cup.position.set(0.75 + Math.sin(rot) * 0.38, 1.52, 0.9 + Math.cos(rot) * 0.38);
  cupLid.position.copy(cup.position); cupLid.position.y += 0.18;

  // --- PSU / door screen ---
  if (door.screen) {
    const live = s.power && s.power.booted;
    door.screen.material.emissiveIntensity = live ? 1.1 : 0.12;
    door.screen.material.emissive.setHex(s.state === 'ERROR' ? 0xff3b30 : (live ? 0x1f7ea8 : 0x113344));
  }

  // --- side panel render ---
  renderPanel(s);
}

MAT.relayHot = new THREE.MeshStandardMaterial({ color: 0x2f74c9, metalness: 0.3, roughness: 0.5, emissive: 0x1f6f4a, emissiveIntensity: 0.75 });
MAT.compHot = new THREE.MeshStandardMaterial({ color: 0x2a2f35, metalness: 0.6, roughness: 0.55, emissive: 0x3a1206, emissiveIntensity: 0.5 });

// ================================================================== SIDE PANEL
function bar(pct) { return `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`; }

function renderPanel(s) {
  document.getElementById('hoppers').innerHTML = s.hoppers.map((h) => `
    <div class="card">
      <div class="row"><span>${h.name}</span><span>${h.level_g} g · ${h.pct}%</span></div>
      ${bar(h.pct)}
    </div>`).join('');

  document.getElementById('relays').innerHTML = s.relays.map((r) => `
    <div class="row"><span><i class="dot ${r.on ? 'on' : ''}"></i>${r.name}</span>
    <span>${r.on ? 'ON' : 'off'}</span></div>`).join('');

  document.getElementById('thermal').innerHTML = `
    <div class="row"><span><i class="dot ${s.boiler.heater ? 'heat' : ''}"></i>Boiler water</span><span>${s.boiler.water_c} °C → ${s.boiler.setpoint_c} °C</span></div>
    <div class="row"><span><i class="dot ${s.chiller.compressor ? 'on' : ''}"></i>Chiller bath</span><span>${s.chiller.water_c} °C → ${s.chiller.setpoint_c} °C</span></div>
    <div class="row"><span><i class="dot ${s.ssr ? 'heat' : ''}"></i>SSR heater</span><span>${s.ssr ? 'ON (240 V)' : 'off'}</span></div>
    <div class="row"><span><i class="dot ${s.fan.on ? 'on' : ''}"></i>Condenser fan</span><span>${s.fan.rpm} rpm</span></div>`;

  document.getElementById('power').innerHTML = `
    <div class="row"><span>12 V rail</span><span>${s.powerRails.psu12.i} / ${s.powerRails.psu12.i_max} A</span></div>
    <div class="row"><span>24 V rail</span><span>${s.powerRails.psu24.i} / ${s.powerRails.psu24.i_max} A</span></div>
    <div class="row"><span>Draw now</span><span>${s.energy.watts} W</span></div>
    <div class="row"><span>State</span><span>${s.state}</span></div>`;

  document.getElementById('events').innerHTML = s.events.slice().reverse().slice(0, 14)
    .map((e) => `<div class="evt"><b>${e.tag}</b> ${e.msg}</div>`).join('');
}
