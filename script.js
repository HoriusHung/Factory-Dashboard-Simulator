/* ============================================================
   SCADA Factory Dashboard Simulator
   Fictional browser-only educational simulation.
   ============================================================ */

/* ------------------------- Simulation state ------------------------- */
const TICK_SECONDS = 0.5;
const HISTORY_WINDOW = 60;
const MAX_SAMPLES = Math.ceil(HISTORY_WINDOW / TICK_SECONDS);

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

const sensors = {
  temperature: { label: 'Temperature', unit: '°C', value: 24, target: 24, min: 0, max: 120, warning: 70, critical: 85, decimals: 1, color: '#38bdf8' },
  pressure: { label: 'Pressure', unit: 'bar', value: 1.8, target: 1.8, min: 0, max: 12, warning: 6, critical: 8, decimals: 1, color: '#60a5fa' },
  speed: { label: 'Conveyor Speed', unit: 'm/s', value: 0, target: 0, min: 0, max: 3, warning: 2.0, critical: 2.5, decimals: 2, color: '#34d399' },
  power: { label: 'Power Consumption', unit: 'kW', value: 4, target: 4, min: 0, max: 130, warning: 80, critical: 100, decimals: 1, color: '#fbbf24' }
};

const sensorLevel = {
  temperature: 'normal',
  pressure: 'normal',
  speed: 'normal',
  power: 'normal'
};

const sensorAlarmMeta = {
  temperature: null,
  pressure: null,
  speed: null,
  power: null
};

const eventLog = [];
let audioContext = null;

const $ = (id) => document.getElementById(id);

const dom = {
  factoryStatusPill: $('factoryStatusPill'),
  simulationClock: $('simulationClock'),
  alarmStrip: $('alarmStrip'),
  alarmMark: $('alarmMark'),
  alarmHeadline: $('alarmHeadline'),
  alarmDetail: $('alarmDetail'),
  alarmValue: $('alarmValue'),
  alarmTime: $('alarmTime'),
  summaryFactory: $('summaryFactory'),
  summaryAlerts: $('summaryAlerts'),
  productionRate: $('productionRate'),
  summaryPower: $('summaryPower'),
  lineBadge: $('lineBadge'),
  factoryPanel: document.querySelector('.factory-panel'),
  startButton: $('startButton'),
  stopButton: $('stopButton'),
  resetButton: $('resetButton'),
  soundToggle: $('soundToggle'),
  clearHistory: $('clearHistory'),
  historyBody: $('historyBody'),
  machinePower: $('machinePower'),
  conveyorSetpoint: $('conveyorSetpoint'),
  coolingIntensity: $('coolingIntensity'),
  materialFeed: $('materialFeed'),
  pressureSetpoint: $('pressureSetpoint'),
  machinePowerLabel: $('machinePowerLabel'),
  conveyorSetpointLabel: $('conveyorSetpointLabel'),
  coolingIntensityLabel: $('coolingIntensityLabel'),
  materialFeedLabel: $('materialFeedLabel'),
  pressureSetpointLabel: $('pressureSetpointLabel')
};

/* ------------------------- Sensor simulation ------------------------- */
function noise(scale) {
  return (Math.random() - 0.5) * 2 * scale;
}

function calculateTargets() {
  const powerFactor = state.controls.machinePower / 100;
  const feedFactor = state.controls.materialFeed / 100;
  const coolingFactor = state.controls.coolingIntensity / 100;
  const speedSetpoint = state.controls.conveyorSetpoint;
  const speedFraction = speedSetpoint / 2.8;

  if (state.factoryRunning) {
    sensors.temperature.target = 42 + powerFactor * 20 + feedFactor * 15 + speedFraction * 8 - coolingFactor * 18 + noise(0.7);
    sensors.pressure.target = state.controls.pressureSetpoint + powerFactor * 0.5 + feedFactor * 0.9 + noise(0.08);
    sensors.speed.target = Math.max(0, speedSetpoint * (0.92 + feedFactor * 0.12) + noise(0.03));
    sensors.power.target = Math.max(0, 4 + powerFactor * 65 + feedFactor * 30 + speedFraction * 15 + noise(1.0));
  } else {
    sensors.temperature.target = 22 + noise(0.3);
    sensors.pressure.target = 1.8 + noise(0.05);
    sensors.speed.target = 0;
    sensors.power.target = 4 + noise(0.3);
  }
}

function updateSensors() {
  Object.values(sensors).forEach((sensor) => {
    sensor.value += (sensor.target - sensor.value) * 0.14;
    sensor.value = Math.max(sensor.min, Math.min(sensor.max, sensor.value));
  });
}

function recordSamples() {
  Object.entries(sensors).forEach(([key, sensor]) => {
    state.samples[key].push({ time: state.elapsedSeconds, value: sensor.value });
    if (state.samples[key].length > MAX_SAMPLES) state.samples[key].shift();
  });
}

/* ------------------------- Alarm levels ------------------------- */
function evaluateAlarms() {
  Object.entries(sensors).forEach(([key, sensor]) => {
    const previous = sensorLevel[key];
    let next = 'normal';

    if (sensor.value > sensor.critical) next = 'critical';
    else if (sensor.value > sensor.warning) next = 'warning';

    if (next !== previous) {
      sensorLevel[key] = next;

      if (next === 'normal') {
        sensorAlarmMeta[key] = null;
        addEvent('SYSTEM', 'Alarm cleared', `${sensor.label} returned to normal range`, currentFactoryState());
      } else {
        const valueText = `${sensor.value.toFixed(sensor.decimals)} ${sensor.unit}`;
        sensorAlarmMeta[key] = {
          parameter: sensor.label,
          value: valueText,
          level: next,
          time: new Date().toLocaleTimeString(),
          message: next === 'critical'
            ? `${sensor.label} exceeded critical simulation threshold`
            : `${sensor.label} entered warning range`
        };

        addEvent(next === 'critical' ? 'CRITICAL' : 'WARNING', next === 'critical' ? 'Critical alarm' : 'Warning triggered', sensorAlarmMeta[key].message, currentFactoryState());

        if (next === 'critical') playCriticalSiren();
        else playWarningTone();
      }
    }
  });
}

function highestLevel() {
  const levels = Object.values(sensorLevel);
  if (levels.includes('critical')) return 'critical';
  if (levels.includes('warning')) return 'warning';
  return 'normal';
}

function activeMeta() {
  return Object.values(sensorAlarmMeta).find((meta) => meta && meta.level === 'critical')
    || Object.values(sensorAlarmMeta).find((meta) => meta && meta.level === 'warning')
    || null;
}

function activeAlertCount() {
  return Object.values(sensorLevel).filter((level) => level !== 'normal').length;
}

function currentFactoryState() {
  return state.factoryRunning ? 'RUNNING' : 'STOPPED';
}

/* ------------------------- History ------------------------- */
function addEvent(category, eventType, description, systemState) {
  eventLog.unshift({
    time: new Date().toLocaleTimeString(),
    category,
    eventType,
    description,
    systemState
  });
  if (eventLog.length > 120) eventLog.pop();
  renderHistory();
}

function renderHistory() {
  if (eventLog.length === 0) {
    dom.historyBody.innerHTML = '<tr><td colspan="5">No events recorded yet.</td></tr>';
    return;
  }

  dom.historyBody.innerHTML = eventLog.map((event) => `
    <tr data-category="${event.category}">
      <td>${event.time}</td>
      <td>${event.category}</td>
      <td>${event.eventType}</td>
      <td>${event.description}</td>
      <td>${event.systemState}</td>
    </tr>
  `).join('');
}

/* ------------------------- Visual updates ------------------------- */
function updateSensorMonitors() {
  // Temperature uses a compact vertical meter.
  const temperatureFraction = sensors.temperature.value / sensors.temperature.max;
  $('temperatureMeter').style.height = `${Math.max(0, Math.min(100, temperatureFraction * 100))}%`;
  $('temperatureValue').textContent = sensors.temperature.value.toFixed(sensors.temperature.decimals);
  $('temperatureLevel').textContent = sensorLevel.temperature.toUpperCase();
  $('temperatureLevel').className = `level ${sensorLevel.temperature}`;
  $('temperatureCard').dataset.level = sensorLevel.temperature;

  // Pressure uses a compact semi-circular gauge.
  const pressureFraction = sensors.pressure.value / sensors.pressure.max;
  $('pressureDial').style.strokeDashoffset = String(220 * (1 - Math.max(0, Math.min(1, pressureFraction))));
  $('pressureValue').textContent = sensors.pressure.value.toFixed(sensors.pressure.decimals);
  $('pressureLevel').textContent = sensorLevel.pressure.toUpperCase();
  $('pressureLevel').className = `level ${sensorLevel.pressure}`;
  $('pressureCard').dataset.level = sensorLevel.pressure;

  // Conveyor speed uses a horizontal load meter.
  $('speedMeter').style.width = `${Math.max(0, Math.min(100, (sensors.speed.value / sensors.speed.max) * 100))}%`;
  $('speedValue').textContent = sensors.speed.value.toFixed(sensors.speed.decimals);
  $('speedLevel').textContent = sensorLevel.speed.toUpperCase();
  $('speedLevel').className = `level ${sensorLevel.speed}`;
  $('speedCard').dataset.level = sensorLevel.speed;

  // Power uses a horizontal load meter.
  $('powerMeter').style.width = `${Math.max(0, Math.min(100, (sensors.power.value / sensors.power.max) * 100))}%`;
  $('powerValue').textContent = sensors.power.value.toFixed(sensors.power.decimals);
  $('powerLevel').textContent = sensorLevel.power.toUpperCase();
  $('powerLevel').className = `level ${sensorLevel.power}`;
  $('powerCard').dataset.level = sensorLevel.power;
}

function updateSummary() {
  dom.summaryFactory.textContent = state.factoryRunning ? 'Running' : 'Stopped';
  dom.summaryFactory.className = state.factoryRunning ? 'running' : 'stopped';
  dom.factoryStatusPill.innerHTML = `<span class="dot"></span> FACTORY ${state.factoryRunning ? 'RUNNING' : 'STOPPED'}`;
  dom.factoryStatusPill.className = `status-pill ${state.factoryRunning ? 'running' : 'stopped'}`;
  dom.lineBadge.textContent = state.factoryRunning ? 'RUNNING' : 'STOPPED';
  dom.lineBadge.className = `badge ${state.factoryRunning ? 'running' : 'stopped'}`;
  dom.factoryPanel.classList.toggle('factory-running', state.factoryRunning);

  const alerts = activeAlertCount();
  dom.summaryAlerts.textContent = String(alerts);
  dom.productionRate.textContent = state.factoryRunning
    ? String(Math.round(sensors.speed.value * 42 * (0.3 + state.controls.materialFeed / 100 * 0.7)))
    : '0';
  dom.summaryPower.textContent = `${state.controls.machinePower}%`;
}

function updateAlarmStrip() {
  const level = highestLevel();
  const meta = activeMeta();

  dom.alarmStrip.className = `status-strip ${level}`;

  if (level === 'normal') {
    dom.alarmMark.textContent = '✓';
    dom.alarmHeadline.textContent = 'No active alarms';
    dom.alarmDetail.textContent = 'All simulated parameters are within their configured ranges.';
    dom.alarmValue.textContent = '—';
    dom.alarmTime.textContent = '—';
    return;
  }

  dom.alarmMark.textContent = level === 'critical' ? '!' : '!';
  dom.alarmHeadline.textContent = level === 'critical' ? 'Critical alert' : 'Warning alert';
  dom.alarmDetail.textContent = meta ? meta.message : 'A simulated threshold has been crossed.';
  dom.alarmValue.textContent = meta ? `${meta.parameter}: ${meta.value}` : '—';
  dom.alarmTime.textContent = meta ? meta.time : '—';
}

/* ------------------------- Trends ------------------------- */
const charts = {
  temperature: { canvas: $('temperatureTrend'), color: sensors.temperature.color, max: 100 },
  power: { canvas: $('powerTrend'), color: sensors.power.color, max: 130 }
};

function resizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function drawChart(key) {
  const config = charts[key];
  const ctx = resizeCanvas(config.canvas);
  const rect = config.canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const samples = state.samples[key];

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;

  for (let i = 1; i < 4; i += 1) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (samples.length < 2) return;

  ctx.beginPath();
  samples.forEach((sample, index) => {
    const x = (index / (MAX_SAMPLES - 1)) * width;
    const y = height - (Math.max(0, Math.min(config.max, sample.value)) / config.max) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = config.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = `${config.color}22`;
  ctx.fill();

  ctx.fillStyle = '#829bad';
  ctx.font = '11px Consolas, monospace';
  ctx.fillText(`${sensors[key].value.toFixed(sensors[key].decimals)} ${sensors[key].unit}`, 8, 16);
}

function drawCharts() {
  drawChart('temperature');
  drawChart('power');
}

/* ------------------------- Audio ------------------------- */
function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === 'suspended') audioContext.resume();
}

function makeTone(frequency, start, duration, gainValue = 0.045, type = 'sine') {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.setValueAtTime(gainValue, audioContext.currentTime + start);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + start + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(audioContext.currentTime + start);
  oscillator.stop(audioContext.currentTime + start + duration + 0.02);
}

function playWarningTone() {
  if (!state.soundEnabled) return;
  const now = Date.now();
  if (now - state.lastWarningSoundAt < 4000) return;
  state.lastWarningSoundAt = now;
  ensureAudio();
  if (!audioContext) return;
  makeTone(620, 0, 0.09, 0.035, 'sine');
  makeTone(620, 0.16, 0.09, 0.035, 'sine');
}

function playCriticalSiren() {
  if (!state.soundEnabled) return;
  const now = Date.now();
  if (now - state.lastCriticalSoundAt < 3500) return;
  state.lastCriticalSoundAt = now;
  ensureAudio();
  if (!audioContext) return;

  // Short two-tone siren: alternating low/high, never a continuous loop.
  for (let i = 0; i < 6; i += 1) {
    makeTone(i % 2 === 0 ? 880 : 660, i * 0.22, 0.18, 0.045, 'triangle');
  }
}

/* ------------------------- Controls ------------------------- */
function setControlLabels() {
  dom.machinePowerLabel.textContent = `${state.controls.machinePower}%`;
  dom.conveyorSetpointLabel.textContent = `${Number(state.controls.conveyorSetpoint).toFixed(1)} m/s`;
  dom.coolingIntensityLabel.textContent = `${state.controls.coolingIntensity}%`;
  dom.materialFeedLabel.textContent = `${state.controls.materialFeed}%`;
  dom.pressureSetpointLabel.textContent = `${Number(state.controls.pressureSetpoint).toFixed(1)} bar`;
}

function bindControls() {
  dom.startButton.addEventListener('click', () => {
    state.factoryRunning = true;
    ensureAudio();
    addEvent('SYSTEM', 'System started', 'Factory simulation started', 'RUNNING');
    refreshStatic();
  });

  dom.stopButton.addEventListener('click', () => {
    state.factoryRunning = false;
    addEvent('SYSTEM', 'System stopped', 'Factory simulation stopped', 'STOPPED');
    refreshStatic();
  });

  dom.resetButton.addEventListener('click', resetSimulation);

  dom.soundToggle.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    dom.soundToggle.textContent = state.soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    addEvent('SYSTEM', 'Alarm sound changed', state.soundEnabled ? 'Alarm sound enabled' : 'Alarm sound muted', currentFactoryState());
    if (state.soundEnabled) ensureAudio();
  });

  dom.clearHistory.addEventListener('click', () => {
    eventLog.length = 0;
    renderHistory();
  });

  bindSlider(dom.machinePower, 'machinePower', 'Machine power changed', (value) => `${value}%`);
  bindSlider(dom.conveyorSetpoint, 'conveyorSetpoint', 'Conveyor speed setpoint changed', (value) => `${Number(value).toFixed(1)} m/s`);
  bindSlider(dom.coolingIntensity, 'coolingIntensity', 'Cooling intensity changed', (value) => `${value}%`);
  bindSlider(dom.materialFeed, 'materialFeed', 'Material feed rate changed', (value) => `${value}%`);
  bindSlider(dom.pressureSetpoint, 'pressureSetpoint', 'Pressure setpoint changed', (value) => `${Number(value).toFixed(1)} bar`);
}

function bindSlider(input, key, eventName, formatter) {
  input.addEventListener('input', () => {
    state.controls[key] = Number(input.value);
    setControlLabels();
    updateSummary();
  });

  input.addEventListener('change', () => {
    addEvent('CONTROL', eventName, `${eventName.replace(' changed', '')}: ${formatter(input.value)}`, currentFactoryState());
  });
}

function resetSimulation() {
  state.factoryRunning = false;
  state.elapsedSeconds = 0;
  state.controls = {
    machinePower: 65,
    conveyorSetpoint: 1.5,
    coolingIntensity: 60,
    materialFeed: 50,
    pressureSetpoint: 4.0
  };

  sensors.temperature.value = 24; sensors.temperature.target = 24;
  sensors.pressure.value = 1.8; sensors.pressure.target = 1.8;
  sensors.speed.value = 0; sensors.speed.target = 0;
  sensors.power.value = 4; sensors.power.target = 4;

  Object.keys(sensorLevel).forEach((key) => {
    sensorLevel[key] = 'normal';
    sensorAlarmMeta[key] = null;
  });

  Object.keys(state.samples).forEach((key) => {
    state.samples[key] = [];
  });

  eventLog.length = 0;
  dom.machinePower.value = '65';
  dom.conveyorSetpoint.value = '1.5';
  dom.coolingIntensity.value = '60';
  dom.materialFeed.value = '50';
  dom.pressureSetpoint.value = '4.0';

  setControlLabels();
  addEvent('SYSTEM', 'Simulation reset', 'Dashboard returned to safe initial conditions', 'STOPPED');
  refreshStatic();
  drawCharts();
}

/* ------------------------- Main loop / refresh ------------------------- */
function refreshStatic() {
  dom.simulationClock.textContent = formatClock(state.elapsedSeconds);
  updateSummary();
  updateAlarmStrip();
  updateSensorMonitors();
}

function simulationTick() {
  if (state.factoryRunning) state.elapsedSeconds += TICK_SECONDS;

  calculateTargets();
  updateSensors();
  recordSamples();
  evaluateAlarms();

  dom.simulationClock.textContent = formatClock(state.elapsedSeconds);
  updateSummary();
  updateAlarmStrip();
  updateSensorMonitors();
  drawCharts();
}

function formatClock(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(Math.floor(totalSeconds % 60)).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function initialize() {
  bindControls();
  setControlLabels();
  addEvent('SYSTEM', 'Dashboard initialized', 'Local simulation ready', 'STOPPED');
  refreshStatic();
  drawCharts();
  window.addEventListener('resize', drawCharts);
  window.setInterval(simulationTick, TICK_SECONDS * 1000);
}

initialize();
