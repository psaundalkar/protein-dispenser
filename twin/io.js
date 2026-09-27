'use strict';

/**
 * I/O abstraction between the twin model and the "hardware".
 *
 * Today this is a synthetic stand-in for:
 *   - 8-ch relay board (Hefronics RS485/Modbus + BESTEP JQX-13F)  -> augers, water solenoids, cup drop
 *   - Fotek SSR-25DA on the 240 V boiler element
 *   - 8-ch DIP delay module -> mixer / turntable / gate actuators
 *   - DS18B20/NTC probes on boiler, chiller bath and cabinet
 *   - float switch in the water tank, cup-present microswitch, door reed switch
 *   - MDB / UPI payment peripheral
 *
 * To go live, replace the methods below with Modbus RTU reads/writes (or an
 * MQTT bridge). Nothing else in the twin needs to change.
 */
class IO {
  constructor(ambientC = 28) {
    this.ambientC = ambientC;
    this._cup = false;
    this._doorClosed = true;
    this._beep = 0;
    // persisted calibration (measured by the operator)
    this.calibration = { auger_g_per_rev: 3.1, flow_ml_per_s: 55 };
  }

  // --- digital inputs (sensors) ---
  // Cup-present microswitch under the dispense station. In simulation the twin
  // drives this itself when the cup-drop solenoid fires; on real hardware it is
  // a GPIO read from the microswitch.
  cupSensor() { return this._cup; }
  setCup(v) { this._cup = !!v; }
  doorClosed() { return this._doorClosed; }
  setDoor(v) { this._doorClosed = !!v; }
  tankLevel() { return 100; }          // % from float switch (fake)
  digitalDelay(channel, ms) { return ms; }

  // --- digital outputs (actuators) ---
  setRelay(channel, on) { /* Modbus FC05 coil write would go here */ void channel; void on; }
  setSSR(on) { /* GPIO / Modbus coil */ void on; }
  setActuator(name, on) { void name; void on; }

  // --- analog inputs (probes) ---
  readProbe(name) { void name; return this.ambientC; }

  // --- user feedback ---
  beep(n) { this._beep = n; }
  buzzer() { return this._beep; }
}

module.exports = IO;
