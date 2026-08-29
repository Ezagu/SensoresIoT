# ESP32 + BMP085 → Setup

## Bibliotecas necesarias (Arduino IDE / PlatformIO)

| Biblioteca | Autor | Cómo instalar |
|---|---|---|
| Adafruit BMP085 Unified | Adafruit | Library Manager: `Adafruit BMP085` |
| Adafruit Unified Sensor | Adafruit | Library Manager: `Adafruit Unified Sensor` |
| ArduinoJson | Benoit Blanchon | Library Manager: `ArduinoJson` (v7+) |
| WiFiManager | tzapu | Library Manager: `WiFiManager` |
| WiFi + HTTPClient + Preferences | Incluidas en ESP32 core | No requiere instalación |

> El binario queda en ~91% del espacio de programa con el esquema de particiones por
> defecto. Si más adelante se suman sensores u OTA, hay que pasar a un particionado con
> más espacio de app (ej. "Minimal SPIFFS") antes de que deje de entrar.

## Conexión del BMP085 al ESP32

```
BMP085        ESP32
───────       ──────────
VCC      →    3.3V (¡NO 5V!)
GND      →    GND
SDA      →    GPIO 21
SCL      →    GPIO 22
```

## Configuración antes de flashear

El WiFi **ya no se configura acá** — lo carga el cliente desde el portal cautivo (ver
abajo). Antes de compilar sólo hay que tocar:

```cpp
const char* API_BASE   = "http://192.168.1.XXX:8000";  // IP del backend

const char* DISPOSITIVO_ID             = "...";  // UUID del alta en la DB
const char* SECRET_DISPOSITIVO_INICIAL = "...";  // secret en texto plano del alta

const char* SENSOR_TEMP_ID  = "...";   // UUID de cada sensor dado de alta
const char* SENSOR_PRESS_ID = "...";
```

### Obtener la IP de tu PC (donde corre Docker)

En Windows, abrí una terminal y ejecutá `ipconfig`. Buscá "Dirección IPv4" del adaptador
WiFi activo (ej. `192.168.1.105`).

**No uses `localhost` ni `127.0.0.1`** — el ESP32 no puede resolver esa IP.

### Verificar que Docker expone el puerto

En `docker-compose.yml` la API debe tener `ports: - "8000:8000"`. Probá desde tu PC antes
de flashear, con el `dispositivo_id` y el `secret` que te devolvió el alta:

```cmd
curl -X POST http://localhost:8000/mediciones/ ^
  -H "Content-Type: application/json" ^
  -H "X-Dispositivo-Id: <DISPOSITIVO_ID>" ^
  -H "Authorization: Bearer <SECRET>" ^
  -d "{\"mediciones\":[]}"
```

## Provisioning de WiFi (portal cautivo)

En el primer arranque, o después de un reset, el equipo no tiene red guardada y levanta
su propio access point:

1. Desde el celular, conectarse a la red **`SensoresIoT-Setup`** (clave `sensores2024`).
2. Se abre solo el portal cautivo (si no, entrar a `http://192.168.4.1`).
3. Elegir la red WiFi del lugar y cargar la contraseña.
4. El equipo guarda las credenciales en flash, reinicia y queda conectado.

Si nadie configura nada en 3 minutos, el portal se cierra y el equipo reintenta solo.

Una vez configurado, en los arranques siguientes conecta directo sin mostrar el portal.

### Borrar el WiFi guardado

Para reconfigurar el equipo (cambio de router, mudanza) **sin USB**: con el equipo **ya
encendido y funcionando**, mantener presionado el botón **BOOT (GPIO0)** durante 5
segundos. Por el Monitor Serie se ve la cuenta (`...1`, `...2`, ...); al confirmarse borra
las credenciales, reinicia y vuelve a levantar el portal.

> **No sirve mantenerlo presionado mientras arranca.** GPIO0 es pin de bootstrap del
> ESP32: tenerlo presionado durante el reset mete al chip en modo bootloader y el sketch
> nunca corre. Tiene que estar arrancado primero.

Si el equipo ya tenía una red guardada de un firmware anterior (el ESP32 persiste las
credenciales de `WiFi.begin()` por su cuenta), va a conectarse directo sin mostrar el
portal. Para forzar el portal la primera vez, usá el botón como arriba, o flasheá con
**Tools → Erase All Flash Before Sketch Upload → Enabled**.

## Secret y rotación

El `SECRET_DISPOSITIVO_INICIAL` se usa una sola vez: en el primer arranque el firmware lo
copia a NVS y a partir de ahí siempre manda el que tiene guardado en flash.

Cuando el backend marca el dispositivo para rotación, la respuesta de una medición trae
`"rotar_secret": true`. El firmware entonces llama a `POST /dispositivos/rotate-secret`
con su secret actual, recibe el nuevo y lo reescribe en NVS.

El secret viejo sigue siendo válido hasta que el equipo use el nuevo, así que si se corta
la conexión en el medio no pasa nada: reintenta en el próximo ciclo.

## Monitoreo

Abrí el Monitor Serie a **115200 baudios**. Deberías ver:

```
=== ESP32 ===
[NVS] Secret cargado desde flash.
[OK] BMP085 inicializado.
[WiFi] Conectado a MiRed. IP: 192.168.1.45
[Sensor] Temp: 24.30 °C | Presión: 1012.45 hPa
[HTTP] Enviando medición...
[HTTP] OK (200): {"status":"ok","intervalo_sugerido":60,"rotar_secret":false}
```

## Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "BMP085 no detectado" | Cableado I2C incorrecto | Verificar SDA/SCL y alimentación 3.3V |
| No aparece la red `SensoresIoT-Setup` | Ya tiene WiFi guardado (incluso de un firmware anterior) | Con el equipo andando, mantener BOOT 5 s |
| "Fallo de conexión" al POST | IP incorrecta o Docker caído | Verificar IP con `ipconfig`, reiniciar Docker |
| HTTP 401 | `DISPOSITIVO_ID` / secret mal, o dispositivo inactivo | Verificar el alta en la DB y `activo = true` |
| HTTP 422 | JSON no coincide con el schema de FastAPI | Revisar que cada medición tenga `sensor_id` y `value` |
| Mediciones rechazadas por intervalo | Envíos más seguidos que el mínimo del backend | Ver `intervalo_sugerido` en la respuesta |
| El botón BOOT no hace nada | Se presionó durante el arranque | Esperar a que arranque y recién ahí mantenerlo 5 s |
| HTTP 500 | Error en TimescaleDB | Ver logs: `docker compose logs api` |

## Ajuste del intervalo

El backend manda `intervalo_sugerido` en cada respuesta y el firmware se ajusta solo, así
que el valor del sketch es sólo el punto de partida hasta el primer envío:

```cpp
unsigned long sendIntervalMs = 30000; // 30 segundos (en milisegundos)
```
