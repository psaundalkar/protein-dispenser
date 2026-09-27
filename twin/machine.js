'use strict';

/**
 * Digital twin of the observed protein-shake vending machine.
 *
 * Physical model -> electrical model -> control logic -> state machine -> telemetry.
 * No hardware dependency: the I/O layer can later be swapped for MQTT/Modbus
 * (see `io/README` section in PROTOCOL.md) without touching machine.js.
 */

const I = require('./io');

const TICK_MS = 100;                 // simulation step
const AMBIENT_C = 28;                // shop temperature
const WATER_TANK_START_L = 17.5;     // of 20 L
const HOPPER_START_G = 1500;         // of 1500 g usable powder

const RECIPE = {
  powder: [
    { name: 'Whey Isolate', start_g: HOPPER_START_G, dose_g: 30 },
    { name: 'Cocoa', start_g: HOPPER_START_G, dose_g: 12 },
    { name: 'Creatine', start_g: HOPPER_START_G, dose_g: 5 },
    { name: 'Oats Powder', start_g: HOPPER_START_G, dose_g: 20 },
    { name: 'Vitamin Blend', start_g: HOPPER_START_G, dose_g: 8 },
  ],
  // Auger calibration measured by the user: grams delivered per full revolution.
  auger_g_per_rev: 3.1,
  auger_rpm: 42,                     // geared 12 V DC motor driving the auger
  water: { volume_ml: 280, target_c: 65 },  // hot protein shake
  cup_drop_ms: 2200,
  mix_ms: 9000,
  dispense_ms: 3500,                 // turntable rotate + gate open
  rinse_ms: 6000,
};

class Machine {
  constructor(io = new I(AMBIENT_C)) {
    this.io = io;
    this.t = 0;
    this.power = { booted: false, maintenance: false };

    // ---- Electrical / control inventory (mirrors the real cabinet) ----
    // 5 auger DC motors on the blue 8-channel relay board (3 channels spare).
    this.relays = Array.from({ length: 8 }, (_, i) => ({
      id: i, name: i < 5 ? `AU-${i + 1} auger` : `SPARE-${i + 1}`, on: false,
    }));
    this.relays[5].name = 'CUP-DROP solenoid';
    this.relays[6].name = 'WATER-HOT solenoid';
    this.relays[7].name = 'WATER-COLD solenoid';
    // Fotek SSR-25DA on the 240 V heater element.
    this.ssr = { name: 'SSR-25DA heater', on: false };
    // Compressor contactor + fan (refrigeration loop).
    this.contactor = { name: 'Compressor', on: false };
    this.fan = { name: 'Condenser fan', on: false };
    // 8-channel DIP delay module -> top-mounted actuator boxes (mixer, gate, turntable).
    this.actuators = {
      mixer: { name: 'Mixer head', on: false, rpm: 0 },
      turntable: { name: 'Turntable', on: false, angle_deg: 0 },
      gate: { name: 'Cup gate', on: false },
    };
    this.gpio = {
      cup_sensor: false,
      door_switch: true,          // true = door closed
      drip_tray_full: false,
    };
    this.powerRails = {
      psu12: { name: 'LRS-100-12', v: 12, i_max: 8.5, i: 0 },
      psu24: { name: 'LRS-100-24', v: 24, i_max: 4.5, i: 0 },
    };

    // ---- Mechanical / thermal state ----
    this.hoppers = RECIPE.powder.map((p) => ({
      name: p.name, level_g: p.start_g, capacity_g: HOPPER_START_G,
      dose_g: p.dose_g, motor_revs: 0, empty: false,
    }));
    this.waterTank = { level_l: WATER_TANK_START_L, capacity_l: 20 };
    this.cupPresent = false;
    this.wasteTray = { level_pct: 5 };

    // Refrigeration loop (cold-water chiller).
    this.chiller = { water_c: AMBIENT_C, setpoint_c: 4, compressor_since: 0, cycles: 0 };
    this.boiler = { water_c: AMBIENT_C, setpoint_c: RECIPE.water.target_c, ready_c: RECIPE.water.target_c - 2 };

    // Energy + counters.
    this.energy = { wh: 0, kwh_lifetime: 412.6 };
    this.stats = { cups_lifetime: 1284, sales_today: 0, revenue_today: 0, last_error: null };

    // ---- Command / telemetry interface ----
    this.state = 'BOOT';
    this.job = null;
    this.queue = [];
    this.events = [];
    this.history = [];            // telemetry ring (last 600 samples = 60 s)
    this.log('BOOT', 'Twin initialised, waiting for power-on');
  }

  // ---------------------------------------------------------------- logging
  log(tag, msg) {
    this.events.push({ t: this.t, tag, msg });
    if (this.events.length > 200) this.events.shift();
  }

  // ---------------------------------------------------------------- lifecycle
  powerOn() {
    if (this.power.booted) return;
    this.power.booted = true;
    this.state = 'IDLE';
    this.log('PWR', 'PSU rails up, controller booted');
    this.io.beep(1);
  }

  powerOff() {
    this.power.booted = false;
    this.state = 'BOOT';
    this.job = null;
    Object.values(this.actuators).forEach((a) => (a.on = false));
    this.relays.forEach((r) => (r.on = false));
    this.ssr.on = false;
    this.contactor.on = false;
    this.fan.on = false;
    this.log('PWR', 'Shutdown requested');
  }

  setMaintenance(on) {
    this.power.maintenance = !!on;
    this.log('MAINT', on ? 'Maintenance mode ON' : 'Maintenance mode OFF');
  }

  // ---------------------------------------------------------------- public API
  brew(product) {
    if (!this.power.booted) return { ok: false, err: 'machine not powered' };
    if (this.power.maintenance) return { ok: false, err: 'maintenance mode' };
    if (this.state !== 'IDLE') return { ok: false, err: `busy (${this.state})` };
    if (!this.io.doorClosed()) return { ok: false, err: 'door open' };
    const price = product && product.price != null ? product.price : 249;
    const name = product && product.name ? product.name : 'Whey Protein Shake';
    // Per-product recipe: which hoppers, how much, and water temp/volume.
    const doses = product && product.powder
      ? product.powder.map((p) => ({ hopper: p.h, grams: p.g }))
      : this.hoppers.map((h) => ({ hopper: this.hoppers.indexOf(h), grams: h.dose_g }));
    const water = {
      volume_ml: (product && product.water_ml) || RECIPE.water.volume_ml,
      hot: !product || product.temp !== 'cold',
    };
    this.queue.push({ name, price, doses, water, cup_id: `CU${(this.stats.cups_lifetime + 1).toString().padStart(5, '0')}` });
    this.state = 'PAYMENT';
    this.log('SALE', `Order received: ${name} (Rs ${price})`);
    return { ok: true, queued: this.queue.length };
  }

  refill() {
    if (!this.power.maintenance) return { ok: false, err: 'refill requires maintenance mode' };
    this.hoppers.forEach((h) => {
      h.level_g = h.capacity_g;
      h.empty = false;
    });
    this.waterTank.level_l = this.waterTank.capacity_l;
    this.wasteTray.level_pct = 0;
    this.log('MAINT', 'Refilled hoppers, water tank and emptied waste tray');
    return { ok: true };
  }

  fault(code) {
    this.stats.last_error = code || 'E99';
    this.state = 'ERROR';
    this.actuators.mixer.on = false;
    this.relays.forEach((r) => (r.on = false));
    this.log('FAULT', `Injected fault ${this.stats.last_error}`);
  }

  clearFault() {
    this.stats.last_error = null;
    this.state = this.power.booted ? 'IDLE' : 'BOOT';
    this.log('FAULT', 'Fault cleared');
  }

  // ---------------------------------------------------------------- step
  step(dtMs) {
    const dt = dtMs / 1000;
    this.t += dt;

    // --- thermal model (always live) ---
    this._thermo(dt);

    // --- electrical load accounting ---
    this._electrical(dt);

    if (!this.power.booted) {
      this._record();
      return;
    }

    const s = this._transition(this.state, dt);
    if (s && s !== this.state) {
      this.log('STATE', `${this.state} -> ${s}`);
      this.state = s;
    }
    this._record();
  }

  // ---------------------------------------------------------------- physics
  _thermo(dt) {
    const load12 = this.relays.filter((r) => r.on).length * 0.45
      + (this.actuators.mixer.on ? 1.8 : 0)
      + (this.actuators.turntable.on ? 0.6 : 0);
    // 12 V rail feeding control + DC motors (approximate, for telemetry only).
    this.powerRails.psu12.i = +load12.toFixed(2);

    // Compressor chiller: pulls a 6 L cold-water bath toward setpoint.
    if (this.contactor.on) {
      this.chiller.water_c -= (this.chiller.water_c - this.chiller.setpoint_c) * 0.06 * dt;
      this.powerRails.psu24.i = 3.6;
    } else {
      this.chiller.water_c += (AMBIENT_C - this.chiller.water_c) * 0.004 * dt;
      this.powerRails.psu24.i = 0.05;
    }
    if (this.chiller.water_c < this.chiller.setpoint_c - 1.5) {
      // thermostat cut-out
      this.contactor.on = false; this.fan.on = false;
    }

    // Boiler: SSR-25DA bang-bang + thermal mass.
    if (this.ssr.on) {
      this.boiler.water_c += (92 - this.boiler.water_c) * 0.035 * dt;
    } else {
      this.boiler.water_c += (AMBIENT_C - this.boiler.water_c) * 0.006 * dt;
    }
    if (this.boiler.water_c >= this.boiler.setpoint_c) {
      this.ssr.on = false;
    }

    if (this.fan.on) this.fan.rpm = 1450; else this.fan.rpm = 0;
  }

  _electrical(dt) {
    let w = 0;
    w += this.powerRails.psu12.i * this.powerRails.psu12.v;
    w += this.powerRails.psu24.i * this.powerRails.psu24.v;
    if (this.ssr.on) w += 1200;            // 240 V heater element
    if (this.fan.on) w += 45;
    this.energy.wh += (w * dt) / 3600;
    this.energy.kwh_lifetime += (w * dt) / 3600 / 1000;
  }

  // ---------------------------------------------------------------- state machine
  _transition(state, dt) {
    const io = this.io;

    switch (state) {
      case 'PAYMENT': {
        // MDB-style: card/UPI payment authorises, then cup drop.
        this._payTimer = (this._payTimer || 0) + dt;
        if (this._payTimer > 1.2) {
          this._payTimer = 0;
          this.job = this.queue.shift();
          this.job.t = 0;
          this.job.phase = 'CUP';
          this.log('PAY', `Authorised Rs ${this.job.price} for ${this.job.cup_id}`);
          return 'CUP';
        }
        return 'PAYMENT';
      }

      case 'CUP': {
        this.job.t += dt;
        this.relays[5].on = true;                       // cup-drop solenoid
        this.actuators.turntable.on = true;
        if (this.job.t > RECIPE.cup_drop_ms / 1000) {
          this.relays[5].on = false;
          this.actuators.turntable.on = false;
          // physical cup now sits in the station -> microswitch closes
          this.io.setCup(true);
          this.cupPresent = io.cupSensor();
          if (!this.cupPresent) { this.fault('E01'); return 'ERROR'; }
          this.job.t = 0; this.job.h = 0;
          this.log('CUP', `${this.job.cup_id} dropped and indexed under dispenser`);
          return 'POWDER';
        }
        return 'CUP';
      }

      case 'POWDER': {
        this.job.t += dt;
        const dose = this.job.doses[this.job.h];
        const h = this.hoppers[dose.hopper];
        if (h.empty || h.level_g <= 0) { this.fault('E03'); return 'ERROR'; }
        h.empty = h.level_g < 20;
        const relay = this.relays[dose.hopper];
        relay.on = true;
        // mass flow = g/rev * rpm / 60
        const gps = (RECIPE.auger_g_per_rev * RECIPE.auger_rpm) / 60;
        const delivered = gps * dt;
        h.level_g = Math.max(0, h.level_g - delivered);
        h.motor_revs += (RECIPE.auger_rpm / 60) * dt;
        this.job.dosed = (this.job.dosed || 0) + delivered;
        this.job.target = dose.grams;

        if (this.job.dosed >= dose.grams) {
          relay.on = false;
          this.log('DOSE', `${h.name}: ${dose.grams} g dispensed (${h.motor_revs.toFixed(1)} rev)`);
          this.job.h += 1;
          this.job.dosed = 0;
          this.job.t = 0;
          if (this.job.h >= this.job.doses.length) {
            if (!this.job.water.hot) { this._ensureChiller(); return 'WATER_COLD'; }
            return 'WATER_HOT';
          }
        }
        return 'POWDER';
      }

      case 'WATER_HOT': {
        this.job.t += dt;
        if (this.boiler.water_c < this.boiler.ready_c) {
          this.ssr.on = true;
          this.log('HEAT', `Heater on, boiler ${this.boiler.water_c.toFixed(1)} C -> ${this.boiler.setpoint_c} C`);
          return 'WATER_HOT';
        }
        return this._fill(dt, 'hot');
      }

      case 'WATER_COLD': {
        this.job.t += dt;
        if (this.chiller.water_c > this.chiller.setpoint_c + 2) {
          this.contactor.on = true; this.fan.on = true;
          return 'WATER_COLD';
        }
        return this._fill(dt, 'cold');
      }

      case 'MIX': {
        this.job.t += dt;
        this.actuators.mixer.on = true;
        this.actuators.mixer.rpm = 9000;
        if (this.job.t > RECIPE.mix_ms / 1000) {
          this.actuators.mixer.on = false;
          this.actuators.mixer.rpm = 0;
          this.job.t = 0;
          this.log('MIX', 'Powder + water homogenised in-cup');
          return 'DISPENSE';
        }
        return 'MIX';
      }

      case 'DISPENSE': {
        this.job.t += dt;
        this.actuators.turntable.on = true;
        this.actuators.turntable.angle_deg = Math.min(90, (this.job.t / (RECIPE.dispense_ms / 1000)) * 90);
        if (this.job.t > RECIPE.dispense_ms / 1000) {
          this.actuators.turntable.on = false;
          this.actuators.gate.on = true;
          this.io.setCup(false);                        // cup leaves the station
          this.cupPresent = false;
          this.job.t = 0;
          this.log('DISPENSE', `${this.job.cup_id} delivered to pickup window`);
          return 'RINSE';
        }
        return 'DISPENSE';
      }

      case 'RINSE': {
        this.job.t += dt;
        this.actuators.gate.on = false;
        this.relays[6].on = true;                        // hot water flush of mix head
        if (this.job.t > RECIPE.rinse_ms / 1000) {
          this.relays[6].on = false;
          this.waterTank.level_l = Math.max(0, this.waterTank.level_l - 0.08);
          this.wasteTray.level_pct = Math.min(100, this.wasteTray.level_pct + 0.6);
          this.stats.sales_today += 1;
          this.stats.cups_lifetime += 1;
          this.stats.revenue_today += this.job.price;
          this.job.t = 0;
          this.log('DONE', `Job ${this.job.cup_id} complete, head rinsed`);
          if (this.queue.length === 0) {
            this.job = null;
            return 'IDLE';
          }
          this.job = this.queue.shift();
          this.job.t = 0; this.job.phase = 'CUP';
          return 'CUP';
        }
        return 'RINSE';
      }

      case 'IDLE':
      case 'BOOT':
      case 'ERROR':
      default:
        // idle housekeeping: keep the boilers at temperature
        if (state === 'IDLE') {
          if (this.boiler.water_c < this.boiler.setpoint_c - 3) this.ssr.on = true;
          if (this.chiller.water_c > this.chiller.setpoint_c + 1.5) {
            this.contactor.on = true; this.fan.on = true;
          }
        }
        return state;
    }
  }

  // Shared water-injection step for both hot and cold paths.
  _fill(dt, kind) {
    const relayIdx = kind === 'hot' ? 6 : 7;
    this.relays[relayIdx].on = true;
    const mlps = 55;                                   // flow rate at the mix head
    const vol = this.job.water.volume_ml;
    this.job.filled = (this.job.filled || 0) + mlps * dt;
    if (this.job.filled >= vol) {
      this.relays[relayIdx].on = false;
      this.waterTank.level_l = Math.max(0, this.waterTank.level_l - vol / 1000);
      if (kind === 'hot') this.boiler.water_c -= 4;    // cold inlet drawdown
      else this.chiller.water_c += 1.5;
      this.job.t = 0;
      this.job.filled = 0;
      this.log('WATER', `${vol} ml ${kind} water injected`);
      return 'MIX';
    }
    return kind === 'hot' ? 'WATER_HOT' : 'WATER_COLD';
  }

  _ensureChiller() {
    if (this.chiller.water_c > this.chiller.setpoint_c + 2) {
      this.contactor.on = true;
      this.fan.on = true;
      this.chiller.cycles += 1;
      this.log('CHILL', `Compressor start (bath ${this.chiller.water_c.toFixed(1)} C)`);
    }
  }

  // ---------------------------------------------------------------- telemetry
  snapshot() {
    return {
      t: +this.t.toFixed(1),
      state: this.state,
      job: this.job ? { ...this.job, name: this.job.name } : null,
      power: this.power,
      hoppers: this.hoppers.map((h) => ({ name: h.name, level_g: +h.level_g.toFixed(1), pct: +(100 * h.level_g / h.capacity_g).toFixed(1), dose_g: h.dose_g, empty: h.empty })),
      waterTank: this.waterTank,
      chiller: { water_c: +this.chiller.water_c.toFixed(2), setpoint_c: this.chiller.setpoint_c, compressor: this.contactor.on, cycles: this.chiller.cycles },
      boiler: { water_c: +this.boiler.water_c.toFixed(2), setpoint_c: this.boiler.setpoint_c, heater: this.ssr.on },
      relays: this.relays.map((r) => ({ name: r.name, on: r.on })),
      ssr: this.ssr.on,
      fan: { on: this.fan.on, rpm: this.fan.rpm },
      actuators: {
        mixer: { on: this.actuators.mixer.on, rpm: this.actuators.mixer.rpm },
        turntable: { on: this.actuators.turntable.on, angle_deg: +this.actuators.turntable.angle_deg.toFixed(0) },
        gate: { on: this.actuators.gate.on },
      },
      gpio: { cup_sensor: this.cupPresent, door_switch: this.gpio.door_switch, waste_pct: +this.wasteTray.level_pct.toFixed(1) },
      powerRails: this.powerRails,
      energy: { wh: +this.energy.wh.toFixed(2), kwh_lifetime: +this.energy.kwh_lifetime.toFixed(2), watts: +(this.powerRails.psu12.i * 12 + this.powerRails.psu24.i * 24 + (this.ssr.on ? 1200 : 0) + (this.fan.on ? 45 : 0)).toFixed(0) },
      stats: this.stats,
      events: this.events.slice(-18),
    };
  }

  _record() {
    this.history.push({ t: +this.t.toFixed(1), boiler: +this.boiler.water_c.toFixed(2), chiller: +this.chiller.water_c.toFixed(2), watts: +(this.powerRails.psu12.i * 12 + this.powerRails.psu24.i * 24 + (this.ssr.on ? 1200 : 0) + (this.fan.on ? 45 : 0)).toFixed(0) });
    if (this.history.length > 600) this.history.shift();
  }
}

Machine.TICK_MS = TICK_MS;
Machine.RECIPE = RECIPE;
module.exports = Machine;
