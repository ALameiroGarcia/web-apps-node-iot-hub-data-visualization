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
      this.timeData = new Array(this.maxLen);
      this.temperatureData = new Array(this.maxLen);
      this.coolingOn = false;
      this.doorOpen = false;
    }

    addData(time, temperature, coolingOn, doorOpen) {
      this.timeData.push(time);
      this.temperatureData.push(temperature);
      this.coolingOn = coolingOn;
      this.doorOpen = doorOpen;

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
      for (let i = 0; i < this.devices.length; ++i) {
        if (this.devices[i].deviceId === deviceId) {
          return this.devices[i];
        }
      }
      return undefined;
    }

    getDevicesCount() {
      return this.devices.length;
    }
  }

  const trackedDevices = new TrackedDevices();

  const chartData = {
    datasets: [
      {
        fill: true,
        label: 'Temperatura (°C)',
        yAxisID: 'Temperature',
        borderColor: 'rgba(24, 120, 240, 1)',
        pointBoarderColor: 'rgba(24, 120, 240, 1)',
        backgroundColor: 'rgba(24, 120, 240, 0.15)',
        pointHoverBackgroundColor: 'rgba(24, 120, 240, 1)',
        pointHoverBorderColor: 'rgba(24, 120, 240, 1)',
        spanGaps: true,
      }
    ]
  };

  const chartOptions = {
    scales: {
      yAxes: [
        {
          id: 'Temperature',
          type: 'linear',
          scaleLabel: {
            labelString: 'Temperatura (°C)',
            display: true,
          },
          position: 'left',
          ticks: {
            suggestedMin: 0,
            suggestedMax: 10,
            beginAtZero: true
          }
        }
      ]
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

  function OnSelectionChange() {
    if (listOfDevices.selectedIndex === -1) return;
    const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
    if (!device) return;

    chartData.labels = device.timeData;
    chartData.datasets[0].data = device.temperatureData;
    myLineChart.update();
  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  function processReading(rawItem, fallbackDeviceId, fallbackDate) {
    // Desempaquetar si viene envuelto en { event: { payload: ... } } o { payload: ... }
    const eventObj = rawItem.event ? rawItem.event : rawItem;
    const reading = eventObj.payload ? eventObj.payload : eventObj;

    // Priorizar fridgeId del payload, luego origin del evento, luego el DeviceId de IoT Hub
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
    device.addData(shortTime, temp, reading.coolingOn, reading.doorOpen);
  }

  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      console.log(messageData);

      // Obtener el cuerpo enviado desde server.js (IotData) o el mensaje directo
      const rootData = messageData.IotData ? messageData.IotData : messageData;

      if (Array.isArray(rootData)) {
        rootData.forEach((item) => {
          processReading(item, messageData.DeviceId, messageData.MessageDate);
        });
      } else {
        processReading(rootData, messageData.DeviceId, messageData.MessageDate);
      }

      myLineChart.update();
    } catch (err) {
      console.error(err);
    }
  };
});
