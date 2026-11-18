/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
      this.timeData = [];
      this.temperatureData = [];
      this.lastTemp = null;
      this.lastUpdate = '--';
      this.coolingOn = false;
      this.doorOpen = false;
      this.appVersion = '--';
      this.moduleName = 'FridgeMonitorModule';
    }

    addData(time, temperature, coolingOn, doorOpen, appVersion, moduleName) {
      this.timeData.push(time);
      this.temperatureData.push(temperature);
      this.lastTemp = temperature;
      this.lastUpdate = time;
      this.coolingOn = Boolean(coolingOn);
      this.doorOpen = Boolean(doorOpen);
      if (appVersion) this.appVersion = appVersion;
      if (moduleName) this.moduleName = moduleName;

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.temperatureData.shift();
      }
    }
  }

  class TrackedDevices {
    constructor() {
      this.devices = [];
    }

    findDevice(deviceId) {
      return this.devices.find((d) => d.deviceId === deviceId);
    }

    getDevicesCount() {
      return this.devices.length;
    }
  }

  const trackedDevices = new TrackedDevices();

  // Configuración estética de Chart.js para Dark Mode
  const chartData = {
    datasets: [
      {
        fill: true,
        label: 'Temperatura (°C)',
        yAxisID: 'Temperature',
        borderColor: '#38bdf8',
        borderWidth: 2.5,
        pointRadius: 3.5,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#0f172a',
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        tension: 0.3, // Curva suave
        spanGaps: true,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    legend: {
      labels: { fontColor: '#cbd5e1' }
    },
    scales: {
      xAxes: [{
        gridLines: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { fontColor: '#94a3b8', maxTicksLimit: 12 }
      }],
      yAxes: [{
        id: 'Temperature',
        type: 'linear',
        position: 'left',
        gridLines: { color: 'rgba(148, 163, 184, 0.1)' },
        scaleLabel: {
          labelString: 'Temperatura (°C)',
          display: true,
          fontColor: '#94a3b8'
        },
        ticks: {
          fontColor: '#94a3b8',
          suggestedMin: 0,
          suggestedMax: 8
        }
      }]
    }
  };

  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: chartOptions,
  });

  let needsAutoSelect = true;
  const deviceCount = document.getElementById('deviceCount');
  const listOfDevices = document.getElementById('listOfDevices');

  // Actualiza todas las tarjetas KPI y alertas del dispositivo activo
  function updateDashboardUI(device) {
    if (!device || device.lastTemp === null) return;

    // 1. Subtítulo de módulo y versión
    document.getElementById('moduleLabel').innerText = `Módulo: ${device.moduleName} • Conectado a Azure IoT Hub`;
    document.getElementById('kpiAppVersion').innerText = `App: ${device.appVersion}`;

    // 2. KPI Temperatura
    const tempEl = document.getElementById('kpiTemp');
    const iconTempBox = document.getElementById('iconTempBox');
    tempEl.innerText = `${device.lastTemp.toFixed(2)} °C`;
    document.getElementById('kpiLastUpdate').innerText = `Última lectura: ${device.lastUpdate}`;

    const isHighTemp = device.lastTemp > 5.0; // Umbral de aviso (> 5°C)
    if (isHighTemp) {
      tempEl.className = 'kpi-value mb-0 mt-1 text-danger';
      iconTempBox.className = 'kpi-icon bg-danger-subtle text-danger';
    } else {
      tempEl.className = 'kpi-value mb-0 mt-1 text-info';
      iconTempBox.className = 'kpi-icon bg-info-subtle text-info';
    }

    // 3. KPI Compresor (coolingOn)
    const coolingEl = document.getElementById('kpiCooling');
    const iconCoolingBox = document.getElementById('iconCoolingBox');
    if (device.coolingOn) {
      coolingEl.innerText = 'ACTIVO';
      coolingEl.className = 'kpi-value mb-0 mt-1 text-primary';
      iconCoolingBox.className = 'kpi-icon bg-primary-subtle text-primary';
      iconCoolingBox.innerHTML = '<i class="bi bi-fan fan-spinning"></i>';
    } else {
      coolingEl.innerText = 'EN REPOSO';
      coolingEl.className = 'kpi-value mb-0 mt-1 text-secondary';
      iconCoolingBox.className = 'kpi-icon bg-secondary-subtle text-secondary';
      iconCoolingBox.innerHTML = '<i class="bi bi-fan"></i>';
    }

    // 4. KPI Puerta (doorOpen)
    const doorEl = document.getElementById('kpiDoor');
    const iconDoorBox = document.getElementById('iconDoorBox');
    if (device.doorOpen) {
      doorEl.innerText = 'ABIERTA';
      doorEl.className = 'kpi-value mb-0 mt-1 text-warning';
      iconDoorBox.className = 'kpi-icon bg-warning-subtle text-warning';
      iconDoorBox.innerHTML = '<i class="bi bi-door-open-fill"></i>';
    } else {
      doorEl.innerText = 'CERRADA';
      doorEl.className = 'kpi-value mb-0 mt-1 text-success';
      iconDoorBox.className = 'kpi-icon bg-success-subtle text-success';
      iconDoorBox.innerHTML = '<i class="bi bi-door-closed-fill"></i>';
    }

    // 5. KPI Mínimo / Máximo en la ventana actual
    const validTemps = device.temperatureData.filter((v) => typeof v === 'number');
    if (validTemps.length > 0) {
      const minT = Math.min(...validTemps).toFixed(1);
      const maxT = Math.max(...validTemps).toFixed(1);
      document.getElementById('kpiMinMax').innerText = `${minT}° / ${maxT}°`;
    }

    // 6. Banner de Alerta Crítica
    const alertBanner = document.getElementById('alertBanner');
    const alertMessage = document.getElementById('alertMessage');
    if (isHighTemp && device.doorOpen) {
      alertBanner.classList.remove('d-none');
      alertBanner.classList.add('d-flex');
      alertMessage.innerText = `Temperatura elevada (${device.lastTemp}°C) con la puerta abierta en ${device.deviceId}.`;
    } else if (isHighTemp) {
      alertBanner.classList.remove('d-none');
      alertBanner.classList.add('d-flex');
      alertMessage.innerText = `Temperatura por encima del umbral óptimo (${device.lastTemp}°C) en ${device.deviceId}.`;
    } else {
      alertBanner.classList.add('d-none');
      alertBanner.classList.remove('d-flex');
    }
  }

  function OnSelectionChange() {
    if (listOfDevices.selectedIndex === -1) return;
    const selectedText = listOfDevices[listOfDevices.selectedIndex].text;
    const device = trackedDevices.findDevice(selectedText);
    if (!device) return;

    chartData.labels = device.timeData;
    chartData.datasets[0].data = device.temperatureData;
    myLineChart.update();
    updateDashboardUI(device);
  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  function processReading(rawItem, fallbackDeviceId, fallbackDate) {
    const eventObj = rawItem.event ? rawItem.event : rawItem;
    const reading = eventObj.payload ? eventObj.payload : eventObj;

    const deviceId = reading.fridgeId || eventObj.origin || fallbackDeviceId;
    const timestamp = reading.timestamp || fallbackDate;
    const temp = reading.temperature;

    if (!deviceId || !timestamp || temp === undefined) {
      return;
    }

    let device = trackedDevices.findDevice(deviceId);
    if (!device) {
      device = new DeviceData(deviceId);
      trackedDevices.devices.push(device);
      const numDevices = trackedDevices.getDevicesCount();
      deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;

      // Limpiar la opción por defecto ("Esperando dispositivos...") al llegar el primero
      if (needsAutoSelect) {
        listOfDevices.innerHTML = '';
      }

      const node = document.createElement('option');
      const nodeText = document.createTextNode(deviceId);
      node.appendChild(nodeText);
      listOfDevices.appendChild(node);

      if (needsAutoSelect) {
        needsAutoSelect = false;
        listOfDevices.selectedIndex = 0;
        OnSelectionChange();
      }
    }

    const shortTime = new Date(timestamp).toLocaleTimeString();
    device.addData(
      shortTime,
      temp,
      reading.coolingOn,
      reading.doorOpen,
      reading.appVersion,
      eventObj.module
    );

    // Si el mensaje pertenece al dispositivo actualmente seleccionado en pantalla, refrescar UI
    const currentSelected = listOfDevices[listOfDevices.selectedIndex]?.text;
    if (currentSelected === deviceId) {
      chartData.labels = device.timeData;
      chartData.datasets[0].data = device.temperatureData;
      myLineChart.update();
      updateDashboardUI(device);
    }
  }

  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      const rootData = messageData.IotData ? messageData.IotData : messageData;

      if (Array.isArray(rootData)) {
        rootData.forEach((item) => {
          processReading(item, messageData.DeviceId, messageData.MessageDate);
        });
      } else {
        processReading(rootData, messageData.DeviceId, messageData.MessageDate);
      }
    } catch (err) {
      console.error(err);
    }
  };
});
