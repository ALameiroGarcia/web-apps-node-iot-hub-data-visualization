# FridgeMonitor IoT — Visualización en Tiempo Real (Grupo 5 ISS)

Aplicación web desarrollada en **Node.js**, **Express** y **WebSockets** para monitorizar en tiempo real la telemetría de las unidades de refrigeración del **Sistema Distribuido de Refrigeración con Azure IoT Hub** (Práctica Grupo 5 - ISS).

## Origen y Adaptación del Proyecto

Este repositorio parte de un *fork* del ejemplo oficial de Microsoft Azure ([`Azure-Samples/web-apps-node-iot-hub-data-visualization`](https://github.com/Azure-Samples/web-apps-node-iot-hub-data-visualization)).

El código base ha sido modificado para integrarse con la arquitectura del proyecto principal (`codigo2` — simulador térmico con estado y módulo IoT Edge) y cumplir con los requisitos de visualización de la práctica:

* **Compatibilidad con el contrato de telemetría (`FridgeMonitorModule`):** Desempaquetado de eventos procedentes de IoT Hub / IoT Edge (`event.payload`) para extraer `fridgeId`, `temperature`, `coolingOn` (estado del compresor), `doorOpen`, `timestamp` y `appVersion`.
* **Panel de control en tiempo real (Dark Mode):** Sustitución de la vista genérica por un dashboard con tarjetas KPI por unidad, estado dinámico del compresor y del sensor magnético de puerta, cálculo de rango térmico (mín/máx en ventana de 50 muestras) y alertas visuales ante picos de temperatura o aperturas prolongadas.

## Configuración en Azure App Service

Para que la aplicación web lea del endpoint compatible con Event Hubs de Azure IoT Hub sin interferir con el controlador (`iss-local-controller`) ni otros consumidores, debe desplegarse con **WebSockets activados** y las siguientes variables de entorno:

* `IotHubConnectionString`: Cadena de conexión de Azure IoT Hub (política `service`).
* `EventHubConsumerGroup`: Nombre del *Consumer Group* exclusivo asignado a esta webapp (ej. `webapp-consumer-group`).

