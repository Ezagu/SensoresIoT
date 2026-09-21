# prueba.ino — pendientes del modo deep sleep

Estado: WIP, no compila. Sólo software; lo de hardware va aparte.

La arquitectura está bien: `setup()` es el ciclo entero, el estado vive en
`RTC_DATA_ATTR`, las cadencias se cuentan en ciclos de muestreo y `empuja()`
sigue espejando `alerta_service._empuja`. Lo que falta es lo de abajo.

---

## 1. No compila

| Dónde | Qué |
|---|---|
| includes | `<algorithm.h>` → `<algorithm>` |
| `dormir()` | `muestreoSeg` no existe → `intervaloMuestreoSeg` |
| `enviarMediciones()` | `cantMediciones` sin declarar |
| `enviarMediciones()` | llama `aplicarConfiguracionesRespuestaApi`, la función se llama `aplicarCofiguraciones...` (falta la `n`) |
| `enviarMediciones()` | llama `deserializarRespuestaApi(http, respuestas)` → `deserializarRespuestaHttp(http, respuesta)` |
| `bufferizar()` | `buffer[posicion].time` quedó sin asignar (ver 3.a) |
| `guardarUmbrales()` | asigna `u.muestras`; el struct declara `cantMuestras` |
| `guardarUmbrales()` | llama `indiceDeSensor()` → `indiceDeSensorId()` |
| `indiceDeSensorId()` | declarada `uint_8` y devuelve `-1` → `int8_t` |
| `calcularMediana()` | usa `n` y `tmp`, las variables son `cantidad` y `temp` |
| `eliminarDelBuffer()` | declarada `uint16_t`, no retorna → `void` |
| `aplicarModificacionIntervalo()` | declarada `float`, no retorna → `void` |
| `setearClienteHttp()` | falta `return true` |
| `deserializarRespuestaHttp()` | falta `return true` |
| `rotarSecret()` | `Serial.print("...\n", )` coma colgante; falta `return` |
| `flushBuffer()` | el comentario usa `lectura.epoch`, el campo es `lectura.time` |

## 2. Bug de contrato con el backend (silencioso, compila igual)

`guardarUmbrales()` lee `item["cantMuestras"]`. El backend manda **`muestras`**
(`backend/schemas/medicion.py:Umbral`, que sale de `muestras_confirmacion`).
Hoy toda regla queda con el default 3, incluso una configurada en 8.

`intervalo_sugerido_seg` y `intervalo_contacto_seg` sí coinciden.

---

## 3. Falta implementar

### P0 — sin esto no se puede probar en campo

**a. El reloj: guardar edad, no fecha.**
Cada `Lectura` guarda un contador monótono de segundos desde el primer arranque
(persistido en RTC), no un epoch. Al enviar, con SNTP recién sincronizado:

```
time_real = epoch_sntp − (contador_ahora − contador_de_la_lectura)
```

Resuelve el caso "arrancó sin WiFi y midió tres días antes de conocer la hora":
con epoch absoluto esas lecturas se pierden (quedan en 1970 o las rechaza
`ANTIGUEDAD_MAXIMA`). Además garantiza que nunca se manda una fecha futura.
**No arregla el drift** — es el mismo reloj contando.

Drift medido por terceros con despertares frecuentes + calibración: ~8 s/día
(≈1–2 min tras 10 días sin conexión). Irrelevante para lecturas cada 5 min.
Sincronizar SNTP en cada conexión exitosa.

**b. Armar el watchdog.** Se importa `esp_task_wdt.h` y no se usa.
`aht.getEvent()` puede colgarse esperando el bit BUSY para siempre. Enchufado eso
es un equipo mudo; a batería es la batería entera en ~36 h. Va como primera línea
de `setup()`, antes del I2C.

**c. No abrir el portal cautivo en un despertar por timer.** Hoy `conectarWifi()`
abre el portal si no hay credenciales → 10 min de AP encendido en cada ciclo de
20 s. Ramificar con `esp_sleep_get_wakeup_cause()`: portal sólo si el arranque
fue power-on/reset o el botón, nunca `TIMER`.

**d. Piso propio para el intervalo sugerido.** Durante los primeros 30 min
(`VENTANA_ARRANQUE`) el backend responde `intervalo_sugerido_seg: 15` a cualquier
equipo (fast start). A batería son ~120 ciclos de WiFi en media hora.
`aplicarModificacionIntervalo()` tiene que clampear contra un piso propio del
modo batería. Ver decisión 4.c.

**e. Forzar el primer envío.** En el primer arranque los contadores RTC valen 0,
así que el primer POST sale recién a los 5 min. El firmware enchufado publica a
los 5 s a propósito (primera impresión del producto). Mismo `wakeup_cause` del
punto c.

**f. La rotación de secret no ocurre.** `rotacionPendiente` se setea y
`rotarSecret()` nunca se llama. Además la variable no es `RTC_DATA_ATTR`: se
pierde al dormir. Debe ser RTC y evaluarse tras cada envío exitoso.

### P1 — autonomía y robustez

**g. Backoff exponencial en el reintento de WiFi.** `waitForConnectResult(10000)`
son 10 s de radio a ~120 mA sin traer un dato: un equipo fuera de cobertura
consume más que uno conectado y se vacía en días. Si falla: 10 → 20 → 40 min,
tope 1 h. El muestreo y el buffer **no** se espacian — el corte es justo lo que
el cliente va a querer reconstruir.

**h. Conexión rápida.** Guardar canal, BSSID e IP en RTC y usar
`WiFi.begin(ssid, pass, canal, bssid)` + `WiFi.config(...)`. Baja la conexión de
~5 s a ~1,5 s: la mejor relación esfuerzo/autonomía del firmware (~+40 %).
Fallback a la conexión normal tras dos fallos seguidos.

**i. Drenar varios chunks con la radio ya encendida.** Hoy es un `MAX_POR_ENVIO`
por ciclo: vaciar 500 lecturas toma 10 ciclos ≈ 50 min. Lo caro es encender el
WiFi, no el POST — mandar chunks hasta vaciar o hasta un tope por ciclo.

**j. Medición de batería.** ADC sobre divisor (ver hoja de hardware). Habilita el
aviso de "batería baja" *mientras todavía hay energía para mandarlo*, el modo
conservación y el volcado del punto l. Definir si el % viaja como un sensor más
o como campo del POST (esto último toca el backend).

**k. Botón de AP por `esp_sleep_enable_ext0_wakeup`.** Pin del dominio RTC, no
GPIO0 (es bootstrap). No consume nada mientras duerme.

### P2 — cuando lo anterior ande

**l. Volcado a flash.** El disparador útil **no** es "se llenó el buffer" (eso son
10 días sin conexión) sino **batería baja**: si la celda se agota, la RTC memory
se borra entera y se pierden los últimos días justo en el evento que el cliente
quiere entender. Guardar también el contador de edad y la última ancla SNTP, o al
rearrancar hay lecturas sin fecha posible. LittleFS en partición propia, no NVS
(partición chica y no es para esto).

**m. Muestreo condicional.** Sin umbrales configurados, no despertar cada 20 s:
al publicar, tomar 3 lecturas separadas 1 s y mandar la mediana. Mantiene el
filtro contra frames corruptos (el −9,66 °C entre dos 20,6 °C) y elimina 14 de
cada 15 despertares (~+30 % de autonomía). Trade-off aceptado: 3 lecturas en 3 s
no filtran un sensor colgado 3 s, sí el frame aislado.

**n. Detección de alimentación externa** por pin → modo enchufado (LEDs fijos,
cadencia normal) vs modo batería. Más confiable que inferirlo del voltaje.

---

## 4. Decisiones pendientes

**a. ¿Un firmware con dos modos o dos firmwares?** `programa_base.ino` (enchufado)
y éste comparten ~70 %: WiFi, secret, umbrales, buffer, contrato con la API.
Mantener dos copias garantiza que `empuja()` se desincronice del backend. Un solo
template con `#ifdef MODO_BATERIA` y una entrada nueva en el dict de
`generar_sketches.py` es lo coherente con cómo ya se generan los sketches.

**b. `intervalo_contacto_seg` por equipo (toca backend).** Hoy son 300 s fijos
para todos y `VENTANA_SIN_REPORTAR_SEG` son 15 min planos. A batería el heartbeat
es ~70 % del consumo: se paga la mayor parte de la autonomía para detectar una
caída en 15 min en vez de en 1 h, y un equipo a batería tiene además un aviso que
el enchufado no tiene (batería baja). Propuesta: columna en el equipo, y que la
ventana de silencio se derive de ella (×3). Toca `dispositivo_service.esta_online()`,
`vigilancia_service` y la pastilla del front — los tres leen de una sola función,
así que es contenido, no arquitectura. **Decidirlo antes de construir el modo
batería con 300 s hardcodeados.**

**c. El fast start del backend para equipos a batería.** El punto 3.d se puede
resolver en el firmware (piso propio) o en el backend (no aplicar
`VENTANA_ARRANQUE` a equipos a batería). Si se hace 4.b, conviene que salga del
mismo lado.

**d. Cristal de 32,768 kHz: sí o no.** Ver hoja de hardware. Cuesta GPIO32/33. Con
el oscilador interno calibrado el drift ya es aceptable, así que es una decisión
de "dejar la puerta abierta", no una necesidad.

**e. Capacidad del buffer.** `Lectura` empaquetada = 9 B; 500 entradas = 4,5 KB.
Con ventana y umbrales ≈ **4,9 KB de los ~6 KB útiles de RTC slow memory**. Entra
con poco aire: verificar en el mapa del linker antes de agrandarlo o de sumar
sensores.

---

## 5. Verificar antes de dar por cerrado

- Mapa del linker: que todo lo `RTC_DATA_ATTR` entre en RTC slow memory.
- Cross-check de `empuja()` contra `alerta_service._empuja`: traducir el C a
  Python y comparar transiciones sobre series aleatorias. Si divergen, el equipo
  adelanta envíos que el servidor después no confirma.
- Un ciclo real de varios días sin WiFi, verificando que al reconectar las fechas
  del buffer sean correctas (punto 3.a).
