# Contrato equipo ↔ API

Lo que el firmware y el backend tienen que acordar. **Está congelado: un cambio se hace en
los dos lados a la vez y se anota acá.** Del lado del firmware vive entero en
`nucleo/src/enlace/wifi/ClienteApi.cpp` (WiFi) y `nucleo/src/enlace/lora/Trama.cpp`
(LoRa); del backend, en `schemas/medicion.py`, `medicion_service.crear_medicion` y
`core/deps.get_dispositivo_autenticado`.

**Compatibilidad**: agregar un campo opcional es compatible en los dos sentidos (Pydantic
ignora lo que no conoce y el firmware lee sólo lo suyo). Quitar, renombrar o cambiar el
tipo o la unidad de un campo no lo es: el firmware no tiene OTA, así que un equipo en
campo habla la versión con la que se compiló durante años.

## Autenticación

Toda request lleva:

| Header | Valor |
|---|---|
| `X-Dispositivo-Id` | UUID del equipo |
| `Authorization` | `Bearer <secret>` |
| `Content-Type` | `application/json` |

Equipo inexistente o secret que no coincide → `401`. Durante una rotación valen el
secret nuevo y el anterior (ver `rotate-secret`).

## `POST /mediciones/`

Un solo endpoint para datos y heartbeat: la respuesta es el plano de control del equipo.

### Request

```json
{
  "mediciones": [
    {"sensor_id": "6f1c…", "value": 23.41, "time": "2026-10-09T14:05:00Z"}
  ],
  "bateria_mv": 3987,
  "diag": {"reinicio": 5, "cronometro": 86400, "…": "…"}
}
```

| Campo | Tipo | Obligatorio | Significado |
|---|---|---|---|
| `mediciones` | lista | sí (puede ir vacía) | Lote a escribir. Vacía = heartbeat, o pedido de hora antes de drenar. Hasta `MAX_PUNTOS_LOTE` (100) por request. |
| `mediciones[].sensor_id` | UUID | sí | Sensor del equipo. Uno ajeno se descarta. |
| `mediciones[].value` | número | sí | Valor en la unidad del tipo de sensor. |
| `mediciones[].time` | ISO-8601 UTC, `YYYY-MM-DDTHH:MM:SSZ` | sí en la práctica | Instante de la lectura, no del envío: el equipo bufferea y manda tarde. **Sin `time` la lectura se descarta.** |
| `bateria_mv` | entero ≥ 0 | no | Tensión de la batería en mV, leída al empezar el contacto. Ausente = el equipo no tiene batería o no se pudo leer. Viaja cruda: el % lo calcula el backend. |
| `diag` | objeto | no | Estado interno del firmware. Sólo se loguea; las claves pueden cambiar sin tocar el contrato. |

Lo que el backend descarta **sin fallar el request** (se loguea, no se le informa al
equipo): sensor ajeno, lectura sin `time`, `time` en el futuro (+30 s de tolerancia) o
más vieja que 90 días, timestamp ya guardado (`duplicada`), lectura a menos de 12 s de
otra del mismo sensor, `bateria_mv` ilegible, fuera de `0..6000` o de un equipo sin
batería declarada.

### Respuesta (`200`)

```json
{
  "status": "ok",
  "server_epoch": 1791727500,
  "intervalo_sugerido_seg": 300,
  "intervalo_contacto_seg": 300,
  "umbrales": [
    {"sensor_id": "6f1c…", "condicion": "mayor", "umbral": 8.0,
     "histeresis": 0.5, "muestras": 3, "disparada": false}
  ],
  "rotar_secret": false
}
```

| Campo | Qué hace el equipo |
|---|---|
| `status` | Nada. |
| `server_epoch` | Ancla el reloj (no hay NTP) y mide el drift del oscilador. |
| `intervalo_sugerido_seg` | Cadencia de publicación. |
| `intervalo_contacto_seg` | Cada cuánto hablar aunque no haya nada para publicar (heartbeat). |
| `umbrales` | Reemplaza sus reglas. Siempre viene, vacía si el plan no tiene alertas. `condicion` es `mayor` o `menor`; `disparada` es el estado inicial. Un cruce adelanta el envío de las últimas `muestras` lecturas crudas; no decide nada, la alerta la evalúa el backend. El firmware guarda las primeras `MAX_UMBRALES` (8) e ignora las de sensores que no conoce. |
| `rotar_secret` | `true` → llama a `rotate-secret` en este contacto. |

### Errores y reintento

El equipo avanza su cola **sólo con un 2xx**. Cualquier otra cosa (sin conexión, `401`,
`422`, `5xx`) deja el lote pendiente y se reenvía entero más tarde. Por eso:

- Reenviar es seguro: `(sensor_id, time)` es único y lo ya guardado vuelve como `duplicada`.
- **El backend no puede devolver un no-2xx por el contenido de un lote bien formado**: lo
  trabaría para siempre. Lo inválido se descarta, nunca rechaza el request. El único `422`
  posible es un JSON que no respeta los tipos de arriba, y eso es un bug del firmware.

## `POST /dispositivos/rotate-secret`

Sin body. Se autentica con el secret actual y responde `200` con `{"secret": "<nuevo>"}`,
una sola vez. El equipo lo guarda en NVS y lo usa desde el próximo request. El viejo sigue
valiendo hasta que el backend ve llegar el nuevo: si la respuesta se pierde, el equipo no
queda afuera. Llegar con el viejo durante la rotación vuelve con `rotar_secret: true`.
Límite: 10 por hora por IP.

## LoRa

El nodo no habla HTTP: manda tramas binarias firmadas al receptor, que en la fase 2 las
reenvía al backend. Formato en `LORA.md` (tramas v2). Equivalencias:

| Trama | HTTP |
|---|---|
| Datos: puntos (índice de sensor, valor, epoch) | `mediciones` (`sensor_id` sale del índice; epoch 0 = sin `time`) |
| Datos: batería en mV, `0xFFFF` = sin dato | `bateria_mv` |
| ACK: hora | `server_epoch` |
| ACK: intervalos | `intervalo_sugerido_seg`, `intervalo_contacto_seg` |

Hoy no viajan por LoRa: `umbrales`, `rotar_secret` ni `diag`.

## Historial

- **2026-10-09**: congelado. `bateria_pct` (%) pasa a `bateria_mv` (mV) y la trama LoRa a
  v2 (batería en 2 bytes).
