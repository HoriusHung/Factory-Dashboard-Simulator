# Factory Dashboard Simulator

> A browser-based SCADA-inspired factory monitoring and simulation dashboard.

## Project Overview

Factory Dashboard Simulator is a lightweight educational web application that simulates a simplified factory production line in real time. It displays fictional sensor values, production status, trends, alarms, and operator controls directly in the browser.

The simulation runs locally on the client side. It does not connect to real industrial equipment, PLCs, sensors, SCADA systems, or power networks.

## Features

- Real-time simulated sensor data
- Factory production-line visualization using SVG
- Temperature monitoring with a vertical meter
- Pressure monitoring with a compact semi-circular dial
- Conveyor speed monitoring with a horizontal meter
- Power consumption monitoring with a horizontal meter
- Rolling trend charts for temperature and power consumption
- Start, stop, and reset simulation controls
- Adjustable machine operating parameters
- Warning and critical alarm states
- Distinct warning and critical sounds using the Web Audio API
- System activity history with event categories
- Responsive dashboard layout for desktop, tablet, and mobile

## Controls

### Machine State

- **START** — Starts the factory simulation, runs the conveyor animation, and updates sensor/production values.
- **STOP** — Stops the factory simulation. Values gradually return toward idle conditions.
- **RESET** — Restores default controls and safe initial values, clears alarms/history, and stops the simulation.

### Simulation Parameters

- **Machine Power** — Higher power generally increases temperature, pressure, speed, and power consumption.
- **Conveyor Speed Setpoint** — Sets the target conveyor speed while the factory is running.
- **Cooling Intensity** — Higher cooling lowers target temperature; lower cooling allows temperature to rise.
- **Material Feed Rate** — Higher load increases temperature, pressure, power consumption, and production activity.
- **Pressure Setpoint** — Shifts the target pressure around which the simulated pressure fluctuates.

### Audio

- **SOUND ON / SOUND OFF** — Enables or mutes alarm sounds.

## Alarm System

The dashboard uses two simulated alarm levels.

### Warning

- Amber/yellow visual state
- Indicates a moderate simulated abnormal condition
- Plays a short, soft double tone

### Critical

- Red visual state
- Indicates a severe simulated condition
- Plays a short alternating two-tone siren

Thresholds are fictional simulation thresholds only, not real industrial safety standards:

- Temperature: warning above `70 °C`, critical above `85 °C`
- Pressure: warning above `6 bar`, critical above `8 bar`
- Conveyor speed: warning above `2.0 m/s`, critical above `2.5 m/s`
- Power: warning above `80 kW`, critical above `100 kW`

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- SVG
- Canvas
- Web Audio API

## Project Structure

```text
Factory-Dashboard-Simulator/
├── index.html
├── styles.css
├── script.js
└── README.md
```

## How to Run Locally

Because this is a static website, no backend server is required.

1. Download or clone the repository.
2. Open `index.html` in a modern web browser.

Alternatively, serve the folder with any simple local static file server.

## Live Demo

No verified GitHub Pages URL is currently present in the project files. A live demo link can be added here after deployment.

## Preview

Screenshot coming soon.

## Design

The interface follows a restrained industrial dashboard style:

- Dark navy/charcoal background
- Cyan, green, amber, and red status colors
- Thin technical borders
- Data-focused cards and panels
- Subtle grid background
- Clean typography and digital-style values

The design prioritizes clarity over decoration.

## Educational Purpose

This project demonstrates practical front-end concepts, including:

- Real-time simulation with `setInterval`
- JavaScript state management
- Dynamic DOM updates
- SVG animation and factory diagrams
- Canvas trend charts
- Web Audio API sound generation
- Event-driven UI controls
- Responsive dashboard layout

## Limitations

- All data is simulated.
- No real sensors are connected.
- No PLC or real SCADA integration exists.
- No backend or database is used.
- The simulation is not physically accurate.
- Alarm sounds depend on browser audio permissions and only play after user interaction.

## Future Improvements

- Add more simulated sensors
- Add more trend charts
- Export event history to CSV
- Add custom alarm thresholds
- Add more factory modules
- Persist settings with `localStorage`
- Add theme options

## License

No `LICENSE` file is currently included in this project.
