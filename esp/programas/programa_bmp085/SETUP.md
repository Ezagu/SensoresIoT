# ESP32 + BMP085 → Setup

## Bibliotecas necesarias (Arduino IDE / PlatformIO)

| Biblioteca | Autor | Cómo instalar |
|---|---|---|
| Adafruit BMP085 Unified | Adafruit | Library Manager: `Adafruit BMP085` |
| Adafruit Unified Sensor | Adafruit | Library Manager: `Adafruit Unified Sensor` |
| ArduinoJson | Benoit Blanchon | Library Manager: `ArduinoJson` (v6+) |
| WiFi + HTTPClient | Incluidas en ESP32 core | No requiere instalación |

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

### 1. Obtener la IP de tu PC (donde corre Docker)

En Windows, abrí una terminal y ejecutá:
```cmd
ipconfig
```
Buscá "Dirección IPv4" del adaptador WiFi activo.
Ejemplo: `192.168.1.105`

**No uses `localhost` ni `127.0.0.1`** — el ESP32 no puede resolver esa IP.

### 2. Editar el sketch

```cpp
const char* WIFI_SSID     = "TU_SSID";       // Nombre de tu red WiFi
const char* WIFI_PASSWORD = "TU_PASSWORD";    // Contraseña
const char* API_URL       = "http://192.168.1.XXX:8000/api/sensors";  // Tu IP
const char* DEVICE_ID     = "esp32-sala-01"; // ID único (cualquier string)
```

### 3. Verificar que Docker expone el puerto

En `docker-compose.yml` la API debe tener:
```yaml
ports:
  - "8000:8000"
```

Probá desde tu PC antes de flashear el ESP32:
```cmd
curl -X POST http://localhost:8000/api/sensors ^
  -H "Content-Type: application/json" ^
  -d "{\"device_id\":\"test\",\"temperature\":25.5,\"pressure\":1013.2}"
```

## Monitoreo

Abrí el Monitor Serie a **115200 baudios**. Deberías ver:

```
=== ESP32 + BMP085 ===
[OK] BMP085 inicializado.
[WiFi] Conectando a MiRed.....
[WiFi] Conectado. IP: 192.168.1.45
[Sensor] Temp: 24.30 °C | Presión: 1012.45 hPa
[HTTP] OK (201): {"status":"ok"}
```

## Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "BMP085 no detectado" | Cableado I2C incorrecto | Verificar SDA/SCL y alimentación 3.3V |
| "Fallo de conexión" al POST | IP incorrecta o Docker caído | Verificar IP con `ipconfig`, reiniciar Docker |
| HTTP 422 | JSON no coincide con el schema de FastAPI | Revisar que `device_id`, `temperature`, `pressure` existan |
| HTTP 500 | Error en TimescaleDB | Ver logs: `docker compose logs api` |

## Ajuste del intervalo

```cpp
const int SEND_INTERVAL = 30000; // 30 segundos (en milisegundos)
// Para pruebas rápidas, usá 5000 (5s)
// Para producción, 60000 (1min) o más es suficiente para temperatura/presión
```
