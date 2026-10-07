# Simulation Methodology

This document describes the current implementation of the Factory Dashboard Simulator. It reflects the actual code in `script.js`, not an aspirational design.

All thresholds and behaviors are fictional simulation values and are not real industrial safety standards.

## State Model

The application keeps a central `state` object:

```js
const state = {
  factoryRunning: false,
  elapsedSeconds: 0,
  soundEnabled: true,
  lastWarningSoundAt: 0,
  lastCriticalSoundAt: 0,
  controls: {
    machinePower: 65,
    conveyorSetpoint: 1.5,
    coolingIntensity: 60,
    materialFeed: 50,
    pressureSetpoint: 4.0
  },
  samples: {
    temperature: [],
    pressure: [],
    speed: [],
    power: []
  }
};
```

Control factors are derived as:

```js
powerFactor = state.controls.machinePower / 100;
feedFactor = state.controls.materialFeed / 100;
coolingFactor = state.controls.coolingIntensity / 100;
speedSetpoint = state.controls.conveyorSetpoint;
speedFraction = speedSetpoint / 2.8;
```

## Timing

The main simulation interval is:

```js
TICK_SECONDS = 0.5;
setInterval(simulationTick, 500);
```

Every tick:

1. `elapsedSeconds` increases by `0.5` only when `factoryRunning` is true.
2. Targets are recalculated.
3. Sensor values move toward targets.
4. Samples are recorded.
5. Alarm levels are evaluated.
6. UI and charts are refreshed.

## Sensor Model

Each sensor stores:

- `label`
- `unit`
- `value`: current displayed value
- `target`: next target value
- `min` / `max`: display clamp range
- `warning` / `critical`: fictional alarm thresholds
- `decimals`: display precision
- `color`: trend chart color

Current value updates with exponential smoothing:

```js
sensor.value += (sensor.target - sensor.value) * 0.14;
sensor.value = Math.max(sensor.min, Math.min(sensor.max, sensor.value));
```

Noise is random and bounded:

```js
function noise(scale) {
  return (Math.random() - 0.5) * 2 * scale;
}
```

### Temperature

Unit: `°C`

Running target:

```js
temperature.target =
  42 +
  powerFactor * 20 +
  feedFactor * 15 +
  speedFraction * 8 -
  coolingFactor * 18 +
  noise(0.7);
```

Stopped target:

```js
temperature.target = 22 + noise(0.3);
```

### Pressure

Unit: `bar`

Running target:

```js
pressure.target =
  pressureSetpoint +
  powerFactor * 0.5 +
  feedFactor * 0.9 +
  noise(0.08);
```

Stopped target:

```js
pressure.target = 1.8 + noise(0.05);
```

### Conveyor Speed

Unit: `m/s`

Running target:

```js
speed.target = Math.max(
  0,
  speedSetpoint * (0.92 + feedFactor * 0.12) + noise(0.03)
);
```

Stopped target:

```js
speed.target = 0;
```

Note: machine power does not directly enter the speed target. It affects production indirectly only through the estimated production formula.

### Power Consumption

Unit: `kW`

Running target:

```js
power.target = Math.max(
  0,
  4 +
    powerFactor * 65 +
    feedFactor * 30 +
    speedFraction * 15 +
    noise(1.0)
);
```

Stopped target:

```js
power.target = 4 + noise(0.3);
```

## Control Relationships

These relationships are implemented in `calculateTargets()`:

- Higher **Machine Power** increases temperature, pressure, and power target. It does not directly change conveyor speed.
- Higher **Material Feed Rate** increases temperature, pressure, speed target, and power target.
- Higher **Cooling Intensity** decreases the temperature target.
- Higher **Conveyor Speed Setpoint** increases conveyor speed target, slightly increases temperature target, and increases power target through `speedFraction`.
- Higher **Pressure Setpoint** directly raises the pressure target.

Production estimate:

```js
productionRate = Math.round(speedValue * 42 * (0.3 + materialFeedFactor * 0.7));
```

When stopped, production rate is displayed as `0`.

Derived metrics:

```js
totalProduction += productionRate * TICK_SECONDS / 60;
sessionEnergyKWh += powerValue * TICK_SECONDS / 3600;
peakPower = Math.max(peakPower, powerValue);
averagePower = runningPowerSum / runningPowerSamples;
```

Machine health starts at `100`. Each tick adds a small delta based on the highest active alarm level: critical `-0.15`, warning `-0.05`, normal `+0.03`, clamped from `0` to `100`. Maintenance status is derived as: `>=90` Normal, `>=70` Monitor, `>=40` Service Soon, below that Critical Service.

## Alarm Thresholds

| Parameter | Unit | Warning | Critical |
|---|---:|---:|---:|
| Temperature | °C | `> 70` | `> 85` |
| Pressure | bar | `> 6` | `> 8` |
| Conveyor Speed | m/s | `> 2.0` | `> 2.5` |
| Power Consumption | kW | `> 80` | `> 100` |

These are fictional simulation thresholds only.

## Alarm Logic

For each sensor, every tick computes a level:

```js
if (value > critical) level = 'critical';
else if (value > warning) level = 'warning';
else level = 'normal';
```

Alarm events are edge-triggered:

- If level changes from `normal` to `warning`, log a warning.
- If level changes from `normal` to `critical`, log a critical alarm.
- If level changes from `warning` to `critical`, log a critical alarm.
- If level returns to `normal`, log `Alarm cleared`.
- If the level remains the same, no duplicate event is added.

The highest active level controls the alarm strip:

- Any critical active sensor makes the strip critical.
- Otherwise, any warning active sensor makes the strip warning.
- Otherwise the strip shows normal.

## Alarm Audio

Audio only plays when `state.soundEnabled` is true and the browser allows audio playback.

### Warning / Amber

- Visual: status strip and sensor card border/level color become amber.
- Audio: two short 620 Hz sine tones, 0.09 s each, separated by 0.16 s, gain 0.035.
- Cooldown: at most one warning tone every 4 s.

### Critical / Red

- Visual: status strip and sensor card border/level color become red; critical level badge pulses.
- Audio: six short alternating triangle tones between 880 Hz and 660 Hz, 0.18 s each, spaced 0.22 s apart, gain 0.045.
- Cooldown: at most one critical siren every 3.5 s.

Browser restrictions are respected by creating or resuming `AudioContext` only after user interaction such as START or SOUND ON.

## Factory Visualization

The SVG diagram contains:

- Conveyor belt with moving stripe pattern
- Motor block
- Processing machine
- Sensor station
- Output/packing area
- Three moving product rectangles
- Machine LEDs
- Scanner line
- Text noting no real equipment is connected

When running, `.factory-running` is applied to `.factory-panel`, enabling:

- Belt stripe translation animation
- Product movement across the belt
- Scanner line vertical movement
- Processing wave opacity animation
- Green machine LED pulsing

When stopped, the `.factory-running` class is removed, which stops the conveyor/product/scanner animations and returns LEDs to the neutral stopped color.

Warning/critical alarms primarily affect the sensor cards, status strip, and some meter colors. They do not change the SVG factory animation state directly.

## History

`System Activity History` is broader than an alarm-only log.

Each entry contains:

- Local browser timestamp
- Category: `SYSTEM`, `CONTROL`, `WARNING`, or `CRITICAL`
- Event type
- Description
- Factory state: `RUNNING` or `STOPPED`

Examples:

- Dashboard initialized
- System started
- System stopped
- Simulation reset
- Machine power changed
- Cooling intensity changed
- Warning triggered
- Critical alarm
- Alarm cleared

History keeps at most 120 entries. `CLEAR HISTORY` empties the in-memory `eventLog`; it does not persist data.

## Charts / Trends

The dashboard displays two live charts:

- Temperature
- Power Consumption

The sample model currently records temperature and power every tick. The `state.samples` object also contains pressure and speed arrays for future use, but they are not populated or charted in the current build.

Window size:

```js
HISTORY_WINDOW = 60 seconds
MAX_SAMPLES = 120
```

Each sample stores:

```js
{ time: state.elapsedSeconds, value: sensor.value }
```

Old samples are removed with `Array.prototype.shift()` once the window exceeds 120 samples.

## Reset Behavior

RESET performs all of the following:

- Sets `factoryRunning = false`
- Sets `elapsedSeconds = 0`
- Restores controls to:
  - Machine Power: `65`
  - Conveyor Speed Setpoint: `1.5`
  - Cooling Intensity: `60`
  - Material Feed Rate: `50`
  - Pressure Setpoint: `4.0`
- Resets sensor targets and values:
  - Temperature: `24 / 24`
  - Pressure: `1.8 / 1.8`
  - Speed: `0 / 0`
  - Power: `4 / 4`
- Clears all sensor alarm levels to `normal`
- Clears sensor alarm metadata
- Empties chart sample arrays
- Clears history log and adds one `Simulation reset` event
- Restores slider DOM values
- Redraws charts
- Preserves `soundEnabled`; it does not toggle alarm audio

## Scope and Safety

The project is a browser-based fictional simulation only. It does not:

- connect to real industrial equipment
- control PLCs or machines
- use real sensor data
- control power systems
- use a backend server
