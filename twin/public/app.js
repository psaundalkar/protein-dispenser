'use strict';
// Operator dashboard: WebSocket telemetry in, REST commands out.
//
// When hosted statically (e.g. on Vercel) there is no twin server behind the
// page, so the WebSocket never opens. In that case we fall back to a demo
// telemetry file generated from the same machine model, and replay it locally
// so the dashboard is still fully explorable.

const $ = (id) => document.getElementById(id);
let PRODUCTS = [];
let maint = false;

const params = new URLSearchParams(location.search);
const DEMO_MODE = params.get('demo') === '1' || location.protocol === 'file:';

// ---------------------------------------------------------------- websocket
let ws;
let live = false;
let demoTimer = null;

function connect() {
  if (DEMO_MODE) { startDemo(); return; }
  try {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  } catch { startDemo(); return; }
  ws.onopen = () => { live = true; $('link').classList.add('live'); $('link').title = 'live twin'; };
  ws.onclose = () => {
    $('link').classList.remove('live');
    if (!live) { startDemo(); } else { setTimeout(connect, 1200); }
  };
  ws.onerror = () => { if (!live) startDemo(); };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'hello') { PRODUCTS = msg.products; renderProducts(); }
    if (msg.type === 'state') { render(msg.data); draw(msg.history); }
  };
}
connect();

// ---------------------------------------------------------------- demo fallback
// Load the machine snapshot produced by scripts/build-site.js and animate the
// few time-varying fields so gauges and the sparkline stay lively offline.
async function startDemo() {
  if (demoTimer) return;
  $('link').title = 'demo mode - run `npm start` for live telemetry';
  $('link').classList.add('demo');
  let snap;
  try {
    const res = await fetch('/demo-state.json', { cache: 'no-store' });
    snap = (await res.json()).data;
  } catch { return; }

  PRODUCTS = (window.__DEMO_PRODUCTS || []).length ? window.__DEMO_PRODUCTS : PRODUCTS;
  renderProducts();

  const hist = [];
  let t = snap.t;
  demoTimer = setInterval(() => {
    t += 0.4;
    // gently oscillate the thermal loop around its resting point
    snap.boiler.water_c = +(snap.boiler.water_c + Math.sin(t / 9) * 0.15).toFixed(2);
    snap.chiller.water_c = +(snap.chiller.water_c + Math.sin(t / 13 + 1) * 0.1).toFixed(2);
    snap.t = +t.toFixed(1);
    hist.push({ t: +t.toFixed(1), boiler: snap.boiler.water_c, chiller: snap.chiller.water_c, watts: snap.energy.watts });
    if (hist.length > 180) hist.shift();
    render(snap); draw(hist);
  }, 400);
}

// ---------------------------------------------------------------- commands
const cmd = (path) => fetch(path).then((r) => r.json()).catch(() => ({}));

$('btn-power').onclick = async () => {
  const r = await cmd('/api/power');
  $('btn-power').textContent = r.booted ? 'Power off' : 'Power on';
};
$('btn-maint').onclick = async () => {
  maint = !maint;
  await cmd(`/api/maintenance?on=${maint ? 1 : 0}`);
  $('btn-maint').classList.toggle('active', maint);
  $('btn-maint').textContent = maint ? 'Maintenance: ON' : 'Maintenance mode';
};
$('btn-refill').onclick = () => cmd('/api/refill');
$('btn-door').onclick = async () => {
  const closed = !(window.__doorClosed !== false);
  await cmd(`/api/door?closed=${closed ? 1 : 0}`);
};
$('btn-fault').onclick = () => cmd('/api/fault?code=E42');
$('btn-clear').onclick = () => cmd('/api/clear');

function renderProducts() {
  $('products').innerHTML = PRODUCTS.map((p) => `
    <div class="prod" data-id="${p.id}">
      <div><div class="nm">${p.name}</div>
      <div class="meta">${p.powder.length} powders &middot; ${p.water_ml} ml ${p.temp}</div></div>
      <div class="pr">&#8377;${p.price}</div>
    </div>`).join('');
  document.querySelectorAll('.prod').forEach((el) => {
    el.onclick = () => cmd(`/api/brew?product=${el.dataset.id}`);
  });
}

// ---------------------------------------------------------------- render
function render(s) {
  $('h-state').textContent = s.state;
  $('h-state').style.color =
    s.state === 'ERROR' ? 'var(--danger)' :
    s.state === 'IDLE' ? 'var(--ok)' :
    s.state === 'BOOT' ? 'var(--dim)' : 'var(--accent)';
  $('h-watts').textContent = s.energy.watts + ' W';
  $('h-cups').textContent = s.stats.sales_today;
  $('h-rev').textContent = '\u20B9' + s.stats.revenue_today;
  window.__doorClosed = s.gpio.door_switch;

  // hoppers
  s.hoppers.forEach((h, i) => {
    const el = document.querySelector(`.hopper[data-h="${i}"]`);
    el.querySelector('.fill').style.height = h.pct + '%';
    el.classList.toggle('low', h.pct < 20);
    const relayNames = ['AU-1 auger', 'AU-2 auger', 'AU-3 auger', 'AU-4 auger', 'AU-5 auger'];
    const on = s.relays[i] && s.relays[i].on;
    el.classList.toggle('on', !!on);
    el.title = `${h.name}: ${h.level_g} g (dose ${h.dose_g} g)`;
  });

  // cup station
  $('cup').classList.toggle('present', s.gpio.cup_sensor);
  $('mixer').classList.toggle('on', s.actuators.mixer.on);
  $('turntable').classList.toggle('on', s.actuators.turntable.on);
  $('turntable').style.transform = `rotate(${s.actuators.turntable.angle_deg / 4}deg)`;
  $('gate').classList.toggle('on', s.actuators.gate.on);

  // fluids
  $('boiler-t').innerHTML = s.boiler.water_c.toFixed(1) + ' &deg;C';
  $('boiler-bar').style.width = Math.min(100, (s.boiler.water_c / 92) * 100) + '%';
  $('heater').classList.toggle('on-heat', s.boiler.heater);
  $('v-hot').classList.toggle('on-heat', s.relays[6] && s.relays[6].on);

  $('chiller-t').innerHTML = s.chiller.water_c.toFixed(1) + ' &deg;C';
  const cpct = Math.min(100, Math.max(0, ((28 - s.chiller.water_c) / 24) * 100));
  $('chiller-bar').style.width = cpct + '%';
  $('comp').classList.toggle('on-cold', s.chiller.compressor);
  $('fan').classList.toggle('on-cold', s.fan.on);
  $('v-cold').classList.toggle('on-cold', s.relays[7] && s.relays[7].on);

  $('tank-fill').style.height = (s.waterTank.level_l / s.waterTank.capacity_l * 100) + '%';
  $('tank-l').textContent = s.waterTank.level_l.toFixed(1) + ' L';
  $('waste-fill').style.height = s.gpio.waste_pct + '%';
  $('waste-l').textContent = s.gpio.waste_pct + '%';

  // relays
  $('relays').innerHTML = s.relays.map((r) =>
    `<div class="rl ${r.on ? 'on' : ''}"><span class="led"></span>${r.name}</div>`).join('');

  // rails
  $('rail12-i').textContent = s.powerRails.psu12.i.toFixed(2) + ' A';
  $('rail12-b').style.width = (s.powerRails.psu12.i / s.powerRails.psu12.i_max * 100) + '%';
  $('rail24-i').textContent = s.powerRails.psu24.i.toFixed(2) + ' A';
  $('rail24-b').style.width = (s.powerRails.psu24.i / s.powerRails.psu24.i_max * 100) + '%';

  $('g-cup').classList.toggle('ok', s.gpio.cup_sensor);
  $('g-door').classList.toggle('ok', s.gpio.door_switch);

  // hopper levels
  $('levels').innerHTML = s.hoppers.map((h) => `
    <div class="lv ${h.pct < 20 ? 'low' : ''}">
      <div class="top"><span>${h.name}</span><b>${h.level_g} / 1500 g</b></div>
      <div class="track"><i style="width:${h.pct}%"></i></div>
    </div>`).join('');

  // event log
  $('log').innerHTML = s.events.slice().reverse().map((e) => `
    <div class="${e.tag}"><span class="tm">${e.t.toFixed(1)}s</span><span class="tag">${e.tag}</span><span>${e.msg}</span></div>`).join('');
}

// ---------------------------------------------------------------- charts
const hist = { boiler: [], chiller: [], watts: [] };
function draw(h) {
  if (!h) return;
  hist.boiler = h.map((x) => x.boiler);
  hist.chiller = h.map((x) => x.chiller);
  hist.watts = h.map((x) => x.watts);
  line($('chart-temp'), [
    { data: hist.boiler, color: '#fb923c', max: 95, min: 0 },
    { data: hist.chiller, color: '#60a5fa', max: 95, min: 0 },
  ]);
  line($('chart-power'), [{ data: hist.watts, color: '#34d399', max: 1500, min: 0 }]);
}
function line(cv, series) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#1e2530'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = (H / 4) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (const s of series) {
    if (s.data.length < 2) continue;
    ctx.strokeStyle = s.color; ctx.lineWidth = 1.6; ctx.beginPath();
    s.data.forEach((v, i) => {
      const x = (i / (s.data.length - 1)) * W;
      const y = H - ((v - s.min) / (s.max - s.min)) * H;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  ctx.fillStyle = '#8b98a8'; ctx.font = '9px monospace';
  ctx.fillText(series.map((s) => `${Math.round(s.data.at(-1) || 0)}`).join(' / '), 6, 11);
}
