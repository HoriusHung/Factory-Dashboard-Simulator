# Factory Dashboard Simulator

> A browser-based SCADA-inspired factory monitoring and simulation dashboard.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![MIT License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Overview

Factory Dashboard Simulator is an educational, fully client-side dashboard that simulates a simplified production line. It presents fictional sensor values, machine status, production output, trend charts, alarms, and operator controls in a SCADA-inspired interface.

This project does not connect to real industrial equipment, PLCs, sensors, SCADA systems, or power networks.

---

## How to Use

1. Press **START** to begin the simulated factory run.
2. Monitor sensors, factory status, active alarms, production rate, and trend charts.
3. Adjust controls such as Machine Power, Cooling Intensity, Material Feed Rate, Conveyor Speed Setpoint, and Pressure Setpoint to observe the simulated response.

---

## System Overview

The dashboard simulates a simplified production line with four monitored parameters:

- **Temperature**: thermal load of the simulated line.
- **Pressure**: operating pressure around the selected setpoint.
- **Conveyor Speed**: simulated movement speed of the production line.
- **Power Consumption**: estimated electrical load of the simulated equipment.

The control system does not command real machines. It changes local simulation targets for the next sensor update cycle. Temperature, pressure, conveyor speed, and power then move smoothly toward those targets instead of jumping instantly.

At a high level, the simulation loop is:

```text
User Controls
      ↓
Simulation State
      ↓
Sensor Models
      ↓
Visualization Layer
      ↓
Alarm Evaluation
      ↓
System Activity History
```

---

## Example

Example operating state:

- Factory: **RUNNING**
- Machine Power: **65%**
- Conveyor Speed Setpoint: **1.5 m/s**
- Cooling Intensity: **60%**
- Material Feed Rate: **50%**
- Pressure Setpoint: **4.0 bar**

With these defaults, the dashboard usually trends toward approximate values like:

- Temperature: around `55–57 °C`
- Pressure: around `4.7–4.9 bar`
- Conveyor Speed: around `1.4–1.5 m/s`
- Power: around `66–70 kW`

If the operator lowers cooling and raises material feed, temperature and power should trend upward. If pressure setpoint is raised toward `8 bar`, pressure and active alerts may cross warning/critical thresholds.

---

## Features

- Real-time simulated sensor values
- SVG production-line visualization
- Temperature monitoring with a vertical meter
- Pressure monitoring with a compact semi-circular dial
- Conveyor speed monitoring with a horizontal meter
- Power consumption monitoring with a horizontal meter
- Rolling Canvas trend charts for temperature and power
- Production rate, efficiency, uptime, and total production estimate
- Session energy consumption, peak power, and average running power
- Machine health score and maintenance status
- Two-level warning/critical alarm system
- Warning and critical audio alerts via Web Audio API
- System activity history with categories
- Adjustable simulation controls
- Responsive layout for desktop, tablet, and mobile

---

## Parameters

| Parameter | Unit | Role in Simulation | Main Influences |
|---|---|---:|---|
| Temperature | °C | Simulated thermal state of the line | Machine power, material feed, conveyor speed, cooling intensity |
| Pressure | bar | Simulated operating pressure | Pressure setpoint, machine power, material feed |
| Conveyor Speed | m/s | Simulated transport speed | Conveyor speed setpoint, material feed |
| Power Consumption | kW | Simulated electrical load | Machine power, material feed, conveyor speed |
| Cooling Intensity | % | Operator control that reduces thermal load | Temperature target |
| Material Feed Rate | % | Operator-set production load | Temperature, pressure, power, production estimate |
| Machine Power | % | Primary simulated drive level | Temperature, pressure, power |

---

## Alarm System

| Level | Indicator | Meaning | Audio |
|---|---|---|---|
| Warning | Amber / yellow | Moderate simulated abnormal condition | Short soft double tone |
| Critical | Red | Severe simulated condition | Short alternating two-tone siren |

Alarm thresholds are fictional simulation thresholds and are **not** real industrial safety standards.

| Parameter | Warning | Critical |
|---|---:|---:|
| Temperature | `> 70 °C` | `> 85 °C` |
| Pressure | `> 6 bar` | `> 8 bar` |
| Conveyor Speed | `> 2.0 m/s` | `> 2.5 m/s` |
| Power Consumption | `> 80 kW` | `> 100 kW` |

---

## Controls

| Control | Purpose |
|---|---|
| START | Starts the factory simulation and conveyor animation |
| STOP | Stops the simulation; values gradually return toward idle |
| RESET | Restores default parameters, safe sensor values, clears local history/alarm state, stops the simulation, and preserves the current sound on/off setting |
| Machine Power | Raises or lowers the primary simulated drive level |
| Conveyor Speed Setpoint | Sets the target conveyor speed |
| Cooling Intensity | Increases cooling to reduce temperature, or reduces cooling |
| Material Feed Rate | Simulates production load on the line |
| Pressure Setpoint | Adjusts the target operating pressure |
| SOUND ON / SOUND OFF | Enables or mutes alarm audio |
| CLEAR HISTORY | Clears the browser-local event list |

---

## Technologies

| Technology | Use |
|---|---|
| HTML5 | Page structure, SVG factory diagram, controls |
| CSS3 | Industrial dashboard styling, responsive layout, animations |
| Vanilla JavaScript | Simulation engine, UI updates, event handling |
| SVG | Factory visualization and pressure dial |
| Canvas | Temperature and power trend charts |
| Web Audio API | Warning tone and critical siren generation |

---

## Project Structure

```text
Factory-Dashboard-Simulator/
├── index.html
├── styles.css
├── script.js
├── README.md
├── LICENSE
└── docs/
    └── methodology.md
```

---

## How It Works

1. The simulation initializes in a stopped state.
2. Sliders update the local control model.
3. `calculateTargets()` converts controls into target sensor values.
4. `updateSensors()` smoothly interpolates current values toward targets.
5. `evaluateAlarms()` compares values against warning and critical thresholds.
6. The UI refreshes summary cards, alarm strip, sensor monitors, history, and charts.

Simplified loop:

```js
setInterval(() => {
  calculateTargets();
  updateSensors();
  recordSamples();
  evaluateAlarms();
  updateSummary();
  updateAlarmStrip();
  updateSensorMonitors();
  drawCharts();
}, 500);
```

---

## Installation / Usage

This is a static web project and does not require a backend server.

```bash
git clone https://github.com/HoriusHung/Factory-Dashboard-Simulator.git
cd Factory-Dashboard-Simulator
```

Open `index.html` directly in a modern browser, or serve the folder with a simple static file server.

---

## Live Demo

No verified GitHub Pages URL is currently present in the project files. Add the deployment URL here after publishing.

---

## Preview

Screenshot placeholder: add your actual dashboard screenshot file later and reference it here.

---

## Design

The interface uses a clean industrial control-room aesthetic:

- Dark navy/charcoal base
- Cyan/green normal state
- Amber warning state
- Red critical state
- Thin technical borders
- Compact sensor cards
- Subtle grid background

The design prioritizes data readability and hierarchy over decoration.

---

## Educational Value

This project demonstrates:

- Real-time simulation with `setInterval`
- JavaScript state management
- Event-driven UI controls
- SVG factory visualization
- Canvas trend charts
- CSS transitions and animation
- Web Audio API sound generation
- Responsive dashboard design
- Dynamic DOM updates

---

## Limitations

- This is a browser-based simulation only.
- All sensor values are fictional and generated locally.
- No real sensors are connected.
- No PLC or real SCADA integration exists.
- No backend or database is used.
- The simulation is not physically accurate.
- Alarm sounds require browser audio permissions and only work after user interaction.

---

## Future Improvements

- Add more simulated sensors
- Add more trend charts
- Export event history to CSV
- Add custom alarm thresholds
- Add additional factory modules
- Persist settings with `localStorage`
- Add alternative color themes

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
