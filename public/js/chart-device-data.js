/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  // if deployed to a site supporting SSL, use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  // Clase para almacenar el historial en memoria por cada dispositivo
  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
      this.timeData = new Array(this.maxLen);
      this.avgTempData = new Array(this.maxLen);
      this.maxTempData = new Array(this.maxLen);
      this.humidityData = new Array(this.maxLen);
      this.powerKwData = new Array(this.maxLen);
    }

    addData(time, avgTemp, maxTemp, humidity, powerKw) {
      this.timeData.push(time);
      this.avgTempData.push(avgTemp);
      this.maxTempData.push(maxTemp);
      this.humidityData.push(humidity);
      this.powerKwData.push(powerKw);

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.avgTempData.shift();
        this.maxTempData.shift();
        this.humidityData.shift();
        this.powerKwData.shift();
      }
    }
  }

  // Lista de dispositivos detectados
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

  // Definición de las 4 líneas de la gráfica
  const chartData = {
    datasets: [
      {
        fill: false,
        label: 'Temp. Media (°C)',
        yAxisID: 'TempPower',
        borderColor: 'rgba(24, 120, 240, 1)',
        pointBoarderColor: 'rgba(24, 120, 240, 1)',
        backgroundColor: 'rgba(24, 120, 240, 0.4)',
        pointHoverBackgroundColor: 'rgba(24, 120, 240, 1)',
        pointHoverBorderColor: 'rgba(24, 120, 240, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Temp. Máxima (°C)',
        yAxisID: 'TempPower',
        borderColor: 'rgba(255, 65, 54, 1)',
        pointBoarderColor: 'rgba(255, 65, 54, 1)',
        backgroundColor: 'rgba(255, 65, 54, 0.4)',
        pointHoverBackgroundColor: 'rgba(255, 65, 54, 1)',
        pointHoverBorderColor: 'rgba(255, 65, 54, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Potencia Media (kW)',
        yAxisID: 'TempPower',
        borderColor: 'rgba(46, 204, 64, 1)',
        pointBoarderColor: 'rgba(46, 204, 64, 1)',
        backgroundColor: 'rgba(46, 204, 64, 0.4)',
        pointHoverBackgroundColor: 'rgba(46, 204, 64, 1)',
        pointHoverBorderColor: 'rgba(46, 204, 64, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Humedad Media (%)',
        yAxisID: 'Humidity',
        borderColor: 'rgba(255, 204, 0, 1)',
        pointBoarderColor: 'rgba(255, 204, 0, 1)',
        backgroundColor: 'rgba(255, 204, 0, 0.4)',
        pointHoverBackgroundColor: 'rgba(255, 204, 0, 1)',
        pointHoverBorderColor: 'rgba(255, 204, 0, 1)',
        spanGaps: true,
      }
    ]
  };

  const chartOptions = {
    scales: {
      yAxes: [
        {
          id: 'TempPower',
          type: 'linear',
          scaleLabel: {
            labelString: 'Temperatura (°C) / Potencia (kW)',
            display: true,
          },
          position: 'left',
          ticks: {
            suggestedMin: 0,
            suggestedMax: 10,
            beginAtZero: true
          }
        },
        {
          id: 'Humidity',
          type: 'linear',
          scaleLabel: {
            labelString: 'Humedad (%)',
            display: true,
          },
          position: 'right',
          ticks: {
            suggestedMin: 0,
            suggestedMax: 100,
            beginAtZero: true
          }
        }
      ]
    }
  };

  // Inicializar contexto de Chart.js
  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(
    ctx,
    {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });

  // Manejo del selector de dispositivos
  let needsAutoSelect = true;
  const deviceCount = document.getElementById('deviceCount');
  const listOfDevices = document.getElementById('listOfDevices');

  function OnSelectionChange() {
    const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
    chartData.labels = device.timeData;
    chartData.datasets[0].data = device.avgTempData;
    chartData.datasets[1].data = device.maxTempData;
    chartData.datasets[2].data = device.powerKwData;
    chartData.datasets[3].data = device.humidityData;
    myLineChart.update();
  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  // Recepción de mensajes desde el backend vía WebSocket
  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      console.log(messageData);

      // Validar que viene fecha y al menos una de tus métricas
      if (!messageData.MessageDate || (!messageData.IotData.avgTemperature && !messageData.IotData.avgHumidity)) {
        return;
      }

      // Buscar o registrar el dispositivo (ej. "nevera-local-dev")
      let device = trackedDevices.findDevice(messageData.DeviceId);
      if (!device) {
        device = new DeviceData(messageData.DeviceId);
        trackedDevices.devices.push(device);
        const numDevices = trackedDevices.getDevicesCount();
        deviceCount.innerText = numDevices === 1 ? `${numDevices} device` : `${numDevices} devices`;

        const node = document.createElement('option');
        const nodeText = document.createTextNode(messageData.DeviceId);
        node.appendChild(nodeText);
        listOfDevices.appendChild(node);

        if (needsAutoSelect) {
          needsAutoSelect = false;
          listOfDevices.selectedIndex = 0;
          OnSelectionChange();
        }
      }

      // Extraer tus campos exactos del JSON y actualizar la gráfica
      device.addData(
        messageData.MessageDate,
        messageData.IotData.avgTemperature,
        messageData.IotData.maxTemperature,
        messageData.IotData.avgHumidity,
        messageData.IotData.avgPowerKw
      );

      myLineChart.update();
    } catch (err) {
      console.error(err);
    }
  };
});
