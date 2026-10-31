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
    power: [],
    production: []
  },
  analytics: {
    stoppedSeconds: 0,
    sessionStarted: false
  },
  metrics: {
    totalProduction: 0,
    expectedProductionTotal: 0,
    peakProductionRate: 0,
    sessionEnergyKWh: 0,
    peakPower: 4,
    runningPowerSum: 0,
    runningPowerSamples: 0,
    machineHealth: 100,
    maintenanceLevel: 'normal'
  }
};

const DEFAULT_CONTROLS = {
  machinePower: 65,
  conveyorSetpoint: 1.5,
  coolingIntensity: 60,
  materialFeed: 50,
  pressureSetpoint: 4.0
};

const DEFAULT_SENSOR_VALUES = {
  temperature: { value: 24, target: 24 },
  pressure: { value: 1.8, target: 1.8 },
  speed: { value: 0, target: 0 },
  power: { value: 4, target: 4 }
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
  totalProduction: $('totalProduction'),
  efficiencyValue: $('efficiencyValue'),
  uptimeValue: $('uptimeValue'),
  machineHealthValue: $('machineHealthValue'),
  machineHealthStatus: $('machineHealthStatus'),
  lineBadge: $('lineBadge'),
  factoryPanel: document.querySelector('.factory-panel'),
  startButton: $('startButton'),
  stopButton: $('stopButton'),
  resetButton: $('resetButton'),
  soundToggle: $('soundToggle'),
  clearHistory: $('clearHistory'),
  historyStream: $('historyStream'),
  machinePower: $('machinePower'),
  conveyorSetpoint: $('conveyorSetpoint'),
  coolingIntensity: $('coolingIntensity'),
  materialFeed: $('materialFeed'),
  pressureSetpoint: $('pressureSetpoint'),
  machinePowerLabel: $('machinePowerLabel'),
  conveyorSetpointLabel: $('conveyorSetpointLabel'),
  coolingIntensityLabel: $('coolingIntensityLabel'),
  materialFeedLabel: $('materialFeedLabel'),
  pressureSetpointLabel: $('pressureSetpointLabel'),
  speedSetpointValue: $('speedSetpointValue'),
  peakPowerValue: $('peakPowerValue'),
  avgPowerValue: $('avgPowerValue'),
  energyValue: $('energyValue'),
  productionPeakValue: $('productionPeakValue'),
  totalProductionValue: $('totalProductionValue'),
  actualRateValue: $('actualRateValue'),
  expectedRateValue: $('expectedRateValue'),
  peakRateValue: $('peakRateValue'),
  summaryModal: $('sessionSummaryModal'),
  summaryContent: $('summaryContent'),
  summaryCloseBtn: $('summaryCloseBtn'),
  summaryOpenBtn: $('summaryOpenBtn')
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
  // Only temperature and power are charted. Avoid recording unused pressure/speed series.
  ['temperature', 'power'].forEach((key) => {
    const sensor = sensors[key];
    state.samples[key].push({ time: state.elapsedSeconds, value: sensor.value });
    if (state.samples[key].length > MAX_SAMPLES) state.samples[key].shift();
  });
}

/* ------------------------- Derived metrics ------------------------- */
function currentProductionRate() {
  if (!state.factoryRunning) return 0;
  const feedFactor = state.controls.materialFeed / 100;
  return Math.round(sensors.speed.value * 42 * (0.3 + feedFactor * 0.7));
}

function expectedProductionRate() {
  if (!state.factoryRunning) return 0;
  const feedFactor = state.controls.materialFeed / 100;
  return state.controls.conveyorSetpoint * 42 * (0.3 + feedFactor * 0.7);
}

function productionEfficiency() {
  const expected = expectedProductionRate();
  if (!state.factoryRunning || expected <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((currentProductionRate() / expected) * 100)));
}

function averagePowerWhileRunning() {
  const { runningPowerSum, runningPowerSamples } = state.metrics;
  return runningPowerSamples > 0 ? runningPowerSum / runningPowerSamples : sensors.power.value;
}

function getMaintenanceLevel(health) {
  if (health >= 90) return 'normal';
  if (health >= 70) return 'monitor';
  if (health >= 40) return 'service';
  return 'critical';
}

function updateMachineHealth() {
  const level = highestLevel();
  let delta = 0.03;

  if (level === 'critical') delta = -0.15;
  else if (level === 'warning') delta = -0.05;

  state.metrics.machineHealth = Math.max(0, Math.min(100, state.metrics.machineHealth + delta));

  const nextLevel = getMaintenanceLevel(state.metrics.machineHealth);
  if (nextLevel !== state.metrics.maintenanceLevel) {
    const previousLevel = state.metrics.maintenanceLevel;
    state.metrics.maintenanceLevel = nextLevel;

    if (nextLevel === 'critical') {
      addEvent('CRITICAL', 'Machine health critical', 'Machine health dropped below 40%', currentFactoryState());
    } else if (nextLevel === 'service') {
      addEvent('WARNING', 'Maintenance required', 'Machine health dropped below 70%', currentFactoryState());
    } else if (nextLevel === 'monitor') {
      addEvent('SYSTEM', 'Machine health monitor', 'Machine health dropped below 90%', currentFactoryState());
    } else if (previousLevel !== 'normal') {
      addEvent('SYSTEM', 'Machine health normal', 'Machine health recovered to 90% or higher', currentFactoryState());
    }
  }
}

function updateDerivedMetrics() {
  if (state.factoryRunning) {
    state.metrics.totalProduction += (currentProductionRate() * TICK_SECONDS) / 60;
    state.metrics.expectedProductionTotal += (expectedProductionRate() * TICK_SECONDS) / 60;
    state.metrics.peakProductionRate = Math.max(state.metrics.peakProductionRate, currentProductionRate());
    state.metrics.sessionEnergyKWh += (sensors.power.value * TICK_SECONDS) / 3600;
    state.metrics.peakPower = Math.max(state.metrics.peakPower, sensors.power.value);
    state.metrics.runningPowerSum += sensors.power.value;
    state.metrics.runningPowerSamples += 1;
  }

  updateMachineHealth();
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
    const emptyItem = document.createElement('li');
    emptyItem.className = 'history-empty';
    emptyItem.textContent = 'No events recorded yet.';
    dom.historyStream.replaceChildren(emptyItem);
    return;
  }

  const fragment = document.createDocumentFragment();
  eventLog.slice(0, 8).forEach((event) => {
    const item = document.createElement('li');
    item.dataset.category = event.category;

    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = event.time;

    const category = document.createElement('span');
    category.className = 'history-category';
    category.textContent = event.category;

    const text = document.createElement('span');
    text.className = 'history-text';
    const type = document.createElement('strong');
    type.textContent = event.eventType;
    const description = document.createElement('small');
    description.textContent = event.description;
    text.append(type, description);

    const stateLabel = document.createElement('span');
    stateLabel.className = 'history-state';
    stateLabel.textContent = event.systemState;

    item.append(time, category, text, stateLabel);
    fragment.append(item);
  });

  dom.historyStream.replaceChildren(fragment);
}

/* ------------------------- Session summary ------------------------- */
let lastSessionSnapshot = null;

function captureSessionSnapshot() {
  const total = state.metrics.totalProduction;
  const runningMinutes = state.elapsedSeconds / 60;
  const expectedTotal = state.metrics.expectedProductionTotal;
  return {
    runningSeconds: state.elapsedSeconds,
    stoppedSeconds: state.analytics.stoppedSeconds,
    totalProduction: Math.floor(total),
    avgRate: state.elapsedSeconds > 0 ? total / runningMinutes : 0,
    peakRate: state.metrics.peakProductionRate,
    avgEfficiency: expectedTotal > 0 ? Math.max(0, Math.min(100, (total / expectedTotal) * 100)) : 0,
    energyKWh: state.metrics.sessionEnergyKWh,
    peakPower: state.metrics.peakPower,
    hasSession: state.analytics.sessionStarted
  };
}

function renderSessionSummary(snapshot) {
  const rows = [
    ['Running Time', formatClock(snapshot.runningSeconds)],
    ['Stopped Time', formatClock(snapshot.stoppedSeconds)],
    ['Total Production', `${snapshot.totalProduction.toLocaleString('en-US')} units`],
    ['Average Production Rate', `${snapshot.avgRate.toFixed(1)} units/min`],
    ['Peak Production Rate', `${snapshot.peakRate} units/min`],
    ['Average Production Efficiency', `${snapshot.avgEfficiency.toFixed(1)}%`],
    ['Energy Used', `${snapshot.energyKWh.toFixed(3)} kWh`],
    ['Peak Power', `${snapshot.peakPower.toFixed(1)} kW`]
  ];

  const contentNodes = [];

  if (!snapshot.hasSession) {
    const note = document.createElement('p');
    note.className = 'summary-note';
    note.textContent = 'Start the simulation to begin a production session.';
    contentNodes.push(note);
  }

  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'summary-rows';

  rows.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'summary-row';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;

    const valueStrong = document.createElement('strong');
    valueStrong.textContent = value;

    row.append(labelSpan, valueStrong);
    rowsContainer.append(row);
  });

  contentNodes.push(rowsContainer);
  dom.summaryContent.replaceChildren(...contentNodes);
}

function showSessionSummary() {
  lastSessionSnapshot = captureSessionSnapshot();
  renderSessionSummary(lastSessionSnapshot);
  dom.summaryModal.hidden = false;
}

function hideSessionSummary() {
  lastSessionSnapshot = null;
  dom.summaryModal.hidden = true;
}

/* ------------------------- Visual updates ------------------------- */
function updateSensorMonitors() {
  const temperatureFraction = sensors.temperature.value / sensors.temperature.max;
  $('temperatureMeter').style.height = `${Math.max(0, Math.min(100, temperatureFraction * 100))}%`;
  $('temperatureValue').textContent = sensors.temperature.value.toFixed(sensors.temperature.decimals);
  $('temperatureLevel').textContent = sensorLevel.temperature.toUpperCase();
  $('temperatureLevel').className = `level ${sensorLevel.temperature}`;
  $('temperatureCard').dataset.level = sensorLevel.temperature;

  const pressureFraction = sensors.pressure.value / sensors.pressure.max;
  $('pressureDial').style.strokeDashoffset = String(220 * (1 - Math.max(0, Math.min(1, pressureFraction))));
  $('pressureValue').textContent = sensors.pressure.value.toFixed(sensors.pressure.decimals);
  $('pressureLevel').textContent = sensorLevel.pressure.toUpperCase();
  $('pressureLevel').className = `level ${sensorLevel.pressure}`;
  $('pressureCard').dataset.level = sensorLevel.pressure;

  $('speedMeter').style.width = `${Math.max(0, Math.min(100, (sensors.speed.value / sensors.speed.max) * 100))}%`;
  $('speedValue').textContent = sensors.speed.value.toFixed(sensors.speed.decimals);
  $('speedLevel').textContent = sensorLevel.speed.toUpperCase();
  $('speedLevel').className = `level ${sensorLevel.speed}`;
  $('speedCard').dataset.level = sensorLevel.speed;

  $('powerMeter').style.width = `${Math.max(0, Math.min(100, (sensors.power.value / sensors.power.max) * 100))}%`;
  $('powerValue').textContent = sensors.power.value.toFixed(sensors.power.decimals);
  $('powerLevel').textContent = sensorLevel.power.toUpperCase();
  $('powerLevel').className = `level ${sensorLevel.power}`;
  $('powerCard').dataset.level = sensorLevel.power;

  const speed = Math.max(0.2, sensors.speed.value);
  const productDuration = Math.max(3, Math.min(12, 10 / (0.5 + speed * 1.5)));
  dom.factoryPanel.style.setProperty('--product-duration', `${productDuration}s`);
  dom.factoryPanel.style.setProperty('--belt-duration', `${Math.max(0.7, productDuration / 5)}s`);
}

function buildDotSpan() {
  const dot = document.createElement('span');
  dot.className = 'dot';
  return dot;
}

function updateSummary() {
  const alerts = activeAlertCount();
  const level = highestLevel();

  dom.summaryFactory.textContent = state.factoryRunning ? 'Running' : 'Stopped';
  dom.summaryFactory.className = state.factoryRunning ? 'running' : 'stopped';
  dom.factoryStatusPill.replaceChildren(buildDotSpan(), document.createTextNode(` FACTORY ${state.factoryRunning ? 'RUNNING' : 'STOPPED'}`));
  dom.factoryStatusPill.className = `status-pill ${state.factoryRunning ? 'running' : 'stopped'}`;
  dom.lineBadge.textContent = state.factoryRunning ? 'RUNNING' : 'STOPPED';
  dom.lineBadge.className = `badge ${state.factoryRunning ? 'running' : 'stopped'}`;

  dom.factoryPanel.classList.remove('state-running', 'state-stopped', 'state-warning', 'state-critical');
  if (level === 'critical') dom.factoryPanel.classList.add('state-critical');
  else if (level === 'warning') dom.factoryPanel.classList.add('state-warning');
  else if (state.factoryRunning) dom.factoryPanel.classList.add('state-running');
  else dom.factoryPanel.classList.add('state-stopped');

  dom.summaryAlerts.textContent = String(alerts);
  dom.productionRate.textContent = String(currentProductionRate());
  dom.totalProduction.textContent = Math.floor(state.metrics.totalProduction).toLocaleString('en-US');
  dom.productionPeakValue.textContent = String(state.metrics.peakProductionRate);
  dom.efficiencyValue.textContent = `${productionEfficiency()}%`;
  dom.uptimeValue.textContent = formatClock(state.elapsedSeconds);
  dom.totalProductionValue.textContent = Math.floor(state.metrics.totalProduction).toLocaleString('en-US');
  dom.actualRateValue.textContent = String(currentProductionRate());
  dom.expectedRateValue.textContent = String(Math.round(expectedProductionRate()));
  dom.peakRateValue.textContent = String(state.metrics.peakProductionRate);

  dom.machineHealthValue.textContent = `${Math.round(state.metrics.machineHealth)}%`;
  const maintenanceText = {
    normal: 'Normal',
    monitor: 'Monitor',
    service: 'Service Soon',
    critical: 'Critical Service'
  };
  dom.machineHealthStatus.textContent = maintenanceText[state.metrics.maintenanceLevel];

  dom.peakPowerValue.textContent = `${state.metrics.peakPower.toFixed(1)} kW`;
  dom.avgPowerValue.textContent = `${averagePowerWhileRunning().toFixed(1)} kW`;
  dom.energyValue.textContent = `${state.metrics.sessionEnergyKWh.toFixed(3)} kWh`;
  dom.speedSetpointValue.textContent = `${Number(state.controls.conveyorSetpoint).toFixed(1)} m/s`;
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

  dom.alarmMark.textContent = level === 'critical' ? '×' : '!';
  dom.alarmHeadline.textContent = level === 'critical' ? 'Critical alert' : 'Warning alert';
  dom.alarmDetail.textContent = meta ? meta.message : 'A simulated threshold has been crossed.';
  dom.alarmValue.textContent = meta ? `${meta.parameter}: ${meta.value}` : '—';
  dom.alarmTime.textContent = meta ? meta.time : '—';
}

/* ------------------------- Trends ------------------------- */
const charts = {
  temperature: { canvas: $('temperatureTrend'), color: sensors.temperature.color, max: 100, sensor: 'temperature' },
  power: { canvas: $('powerTrend'), color: sensors.power.color, max: 130, sensor: 'power' },
  productionTotal: { canvas: $('productionTotalTrend'), color: '#34d399', kind: 'total' },
  productionRate: { canvas: $('productionRateTrend'), color: '#38bdf8', kind: 'rate' }
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
  const sensor = sensors[config.sensor];

  ctx.clearRect(0, 0, width, height);

  // Draw background grid and threshold lines
  drawGridAndThresholds(ctx, width, height, config, sensor);

  if (samples.length < 2) {
    drawNoDataLabel(ctx, width, height, config.color);
    return;
  }

  // Draw area fill
  ctx.beginPath();
  samples.forEach((sample, index) => {
    const x = (index / (MAX_SAMPLES - 1)) * width;
    const y = height - (Math.max(0, Math.min(config.max, sample.value)) / config.max) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = `${config.color}22`;
  ctx.fill();

  // Draw line
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

  // Draw current value label
  ctx.fillStyle = '#829bad';
  ctx.font = '11px Consolas, monospace';
  ctx.fillText(`${sensor.value.toFixed(sensor.decimals)} ${sensor.unit}`, 8, 16);
}

function drawGridAndThresholds(ctx, width, height, config, sensor) {
  const gridColor = 'rgba(148, 163, 184, 0.1)';
  const labelColor = '#64748b';
  const font = '10px Consolas, monospace';
  ctx.font = font;

  // Horizontal grid lines (4 lines = 5 zones)
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Vertical grid lines (time markers: -60s, -45s, -30s, -15s, now)
  for (let i = 0; i <= 4; i += 1) {
    const x = (width / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Time labels at bottom
    const timeLabels = ['-60s', '-45s', '-30s', '-15s', 'now'];
    ctx.fillStyle = labelColor;
    ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
    ctx.fillText(timeLabels[i], x + (i === 0 ? 4 : i === 4 ? -4 : 0), height - 4);
  }

  // Y-axis labels (min, mid, max)
  const yLabels = [config.max, Math.round(config.max / 2), 0];
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'right';
  for (let i = 0; i < 3; i += 1) {
    const y = (height / 2) * i;
    ctx.fillText(String(yLabels[i]), 4, y + (i === 0 ? 12 : i === 2 ? 4 : 4));
  }

  // Threshold lines (warning and critical)
  const drawThreshold = (value, color, label) => {
    if (value <= 0 || value > config.max) return;
    const y = height - (value / config.max) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Threshold label
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(`${label} ${value}${sensor.unit}`, 6, y - 4);
  };

  drawThreshold(sensor.warning, '#fbbf24', 'WARN');
  drawThreshold(sensor.critical, '#ef4444', 'CRIT');
}

function drawNoDataLabel(ctx, width, height, color) {
  ctx.fillStyle = '#64748b';
  ctx.font = '12px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Waiting for data...', width / 2, height / 2);
}

/* ------------------------- Production charts ------------------------- */
function recordProductionSample() {
  if (!state.analytics.sessionStarted) return;
  const samples = state.samples.production;
  samples.push({
    t: state.elapsedSeconds,
    total: state.metrics.totalProduction,
    actual: currentProductionRate(),
    expected: expectedProductionRate()
  });
  if (samples.length > MAX_SAMPLES) samples.shift();
}

function niceCeil(value) {
  if (value <= 10) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return f * pow;
}

function drawProductionAxes(ctx, width, height) {
  const gridColor = 'rgba(148, 163, 184, 0.1)';
  const labelColor = '#64748b';
  ctx.font = '10px Consolas, monospace';

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const timeLabels = ['-60s', '-45s', '-30s', '-15s', 'now'];
  for (let i = 0; i <= 4; i += 1) {
    const x = (width / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.fillStyle = labelColor;
    ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
    ctx.fillText(timeLabels[i], x + (i === 0 ? 4 : i === 4 ? -4 : 0), height - 4);
  }
}

function drawProductionChart(key) {
  const config = charts[key];
  const ctx = resizeCanvas(config.canvas);
  const rect = config.canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const samples = state.samples.production;

  ctx.clearRect(0, 0, width, height);
  drawProductionAxes(ctx, width, height);

  if (samples.length < 2) return;

  const padTop = 14;
  const padBottom = 4;
  const plotH = height - padTop - padBottom;

  if (config.kind === 'total') {
    const maxValue = niceCeil(Math.max(...samples.map((s) => s.total), 0));
    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = (i / (MAX_SAMPLES - 1)) * width;
      const y = padTop + plotH - (Math.max(0, s.total) / maxValue) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(((samples.length - 1) / (MAX_SAMPLES - 1)) * width, padTop + plotH);
    ctx.lineTo(0, padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = `${config.color}22`;
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(maxValue), 4, padTop + 4);
    ctx.fillText(String(Math.round(maxValue / 2)), 4, padTop + plotH / 2 + 4);
    ctx.fillText('0', 4, padTop + plotH + 4);
  } else {
    const maxValue = niceCeil(Math.max(...samples.flatMap((s) => [s.actual, s.expected]), 0));
    const drawLine = (field, color, dashed) => {
      ctx.beginPath();
      samples.forEach((s, i) => {
        const x = (i / (MAX_SAMPLES - 1)) * width;
        const y = padTop + plotH - (s[field] / maxValue) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (dashed) ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    drawLine('expected', '#829bad', true);
    drawLine('actual', '#38bdf8', false);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(maxValue), 4, padTop + 4);
    ctx.fillText(String(Math.round(maxValue / 2)), 4, padTop + plotH / 2 + 4);
    ctx.fillText('0', 4, padTop + plotH + 4);
  }
}

function drawProductionCharts() {
  drawProductionChart('productionTotal');
  drawProductionChart('productionRate');
}

function drawCharts() {
  drawChart('temperature');
  drawChart('power');
  drawProductionCharts();
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
  dom.speedSetpointValue.textContent = `${Number(state.controls.conveyorSetpoint).toFixed(1)} m/s`;
}

function bindControls() {
  dom.startButton.addEventListener('click', () => {
    if (!state.analytics.sessionStarted) state.analytics.sessionStarted = true;
    state.factoryRunning = true;
    ensureAudio();
    addEvent('SYSTEM', 'System started', 'Factory simulation started', 'RUNNING');
    refreshUi();
  });

  dom.stopButton.addEventListener('click', () => {
    if (!state.factoryRunning) return;
    state.factoryRunning = false;
    addEvent('SYSTEM', 'System stopped', 'Factory simulation stopped', 'STOPPED');
    refreshUi();
    if (state.elapsedSeconds > 0) showSessionSummary();
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
  const hadSessionActivity = state.analytics.sessionStarted && (state.elapsedSeconds > 0 || state.metrics.totalProduction > 0);
  if (hadSessionActivity) lastSessionSnapshot = captureSessionSnapshot();

  state.factoryRunning = false;
  state.elapsedSeconds = 0;
  state.controls = { ...DEFAULT_CONTROLS };

  Object.entries(DEFAULT_SENSOR_VALUES).forEach(([key, defaults]) => {
    sensors[key].value = defaults.value;
    sensors[key].target = defaults.target;
  });

  Object.keys(sensorLevel).forEach((key) => {
    sensorLevel[key] = 'normal';
    sensorAlarmMeta[key] = null;
  });

  Object.keys(state.samples).forEach((key) => {
    state.samples[key] = [];
  });

  state.analytics = { stoppedSeconds: 0, sessionStarted: false };

  state.metrics = {
    totalProduction: 0,
    expectedProductionTotal: 0,
    peakProductionRate: 0,
    sessionEnergyKWh: 0,
    peakPower: DEFAULT_SENSOR_VALUES.power.value,
    runningPowerSum: 0,
    runningPowerSamples: 0,
    machineHealth: 100,
    maintenanceLevel: 'normal'
  };

  eventLog.length = 0;
  dom.machinePower.value = String(DEFAULT_CONTROLS.machinePower);
  dom.conveyorSetpoint.value = String(DEFAULT_CONTROLS.conveyorSetpoint);
  dom.coolingIntensity.value = String(DEFAULT_CONTROLS.coolingIntensity);
  dom.materialFeed.value = String(DEFAULT_CONTROLS.materialFeed);
  dom.pressureSetpoint.value = String(DEFAULT_CONTROLS.pressureSetpoint);

  setControlLabels();
  addEvent('SYSTEM', 'Simulation reset', 'Dashboard returned to safe initial conditions', 'STOPPED');
  refreshUi();
  drawCharts();

  if (hadSessionActivity) {
    renderSessionSummary(lastSessionSnapshot);
    dom.summaryModal.hidden = false;
  }
}

/* ------------------------- Layout helpers ------------------------- */
function positionThresholdMarkers() {
  $('speedWarningMarker').style.left = `${(sensors.speed.warning / sensors.speed.max) * 100}%`;
  $('speedCriticalMarker').style.left = `${(sensors.speed.critical / sensors.speed.max) * 100}%`;
  $('powerWarningMarker').style.left = `${(sensors.power.warning / sensors.power.max) * 100}%`;
  $('powerCriticalMarker').style.left = `${(sensors.power.critical / sensors.power.max) * 100}%`;

  $('temperatureThresholdNote').textContent = `Warn >${sensors.temperature.warning} · Critical >${sensors.temperature.critical}`;
  $('pressureThresholdNote').textContent = `Warn >${sensors.pressure.warning} · Critical >${sensors.pressure.critical}`;
}

function positionPressureTick(element, value) {
  const cx = 90;
  const cy = 88;
  const outer = 68;
  const inner = 60;
  const fraction = Math.max(0, Math.min(1, value / sensors.pressure.max));
  const angle = Math.PI - fraction * Math.PI;

  element.setAttribute('x1', String(cx + inner * Math.cos(angle)));
  element.setAttribute('y1', String(cy - inner * Math.sin(angle)));
  element.setAttribute('x2', String(cx + outer * Math.cos(angle)));
  element.setAttribute('y2', String(cy - outer * Math.sin(angle)));
}

/* ------------------------- Main loop / refresh ------------------------- */
function refreshUi() {
  dom.simulationClock.textContent = formatClock(state.elapsedSeconds);
  updateSummary();
  updateAlarmStrip();
  updateSensorMonitors();
}

function simulationTick() {
  if (state.factoryRunning) state.elapsedSeconds += TICK_SECONDS;
  else if (state.analytics.sessionStarted) state.analytics.stoppedSeconds += TICK_SECONDS;

  calculateTargets();
  updateSensors();
  recordSamples();
  evaluateAlarms();
  updateDerivedMetrics();
  recordProductionSample();

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
  positionThresholdMarkers();
  positionPressureTick($('pressureWarningTick'), sensors.pressure.warning);
  positionPressureTick($('pressureCriticalTick'), sensors.pressure.critical);
  addEvent('SYSTEM', 'Dashboard initialized', 'Local simulation ready', 'STOPPED');
  refreshUi();
  drawCharts();
  window.addEventListener('resize', drawCharts);
  window.setInterval(simulationTick, TICK_SECONDS * 1000);

  dom.summaryOpenBtn.addEventListener('click', showSessionSummary);
  dom.summaryCloseBtn.addEventListener('click', hideSessionSummary);
}

initialize();
