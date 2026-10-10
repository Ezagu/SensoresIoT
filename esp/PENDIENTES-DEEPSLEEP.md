# prueba_bmp — modo deep sleep

El código vive en la librería `esp/nucleo/` (ver CLAUDE.md, sección Firmware); acá las
funciones se citan por su nombre de antes de la modularización. Dónde quedó cada una:
`reloj/Reloj` (cronómetro, anclas, drift), `almacenamiento/BufferLecturas`, `ColaFlash` y
`Pendientes` (buffer RTC, flash y el orden de drenaje), `sensores/Muestras` (ventana y
mediana), `alertas/Umbrales` (`empuja()`), `enlace/EnlaceWifi` (con `wifi/ConexionWifi`,
`ClienteApi` = todo el JSON y `Secret`), `ciclo/CicloBateria` (`setup()`, `dormir()`,
backoff y bucle de drenaje) y `ciclo/PlanoControl`. Los sketches `prueba_bmp/` y
`prueba_aht10/` sólo componen `Equipo` + `ConfigWifi`.

Estado: **P0 cerrado y corriendo en placa.** Validados en placa: ciclo de sueño,
backoff, conexión rápida, drenaje en lotes, drift (p), volcado a flash (l) y
muestreo condicional (m). Lo que falta está en 2 y 4; lo de hardware, en
`DIAGNOSTICO-HARDWARE.md`.

La arquitectura es la misma de siempre: `setup()` es el ciclo entero, el estado
vive en `RTC_DATA_ATTR`, las cadencias se cuentan en ciclos de muestreo y
`empuja()` espeja `alerta_service._empuja`.

---

## 1. Hecho (P0)

**a. El reloj guarda edad, no fecha.** `ahoraLocal()` es un cronómetro monótono
en segundos desde el power-on; cada `Lectura` guarda su valor. `anclarHora()`
graba el par `anclaEpoch`/`anclaLocal` con el `server_epoch` de cada respuesta, y
`flushBuffer()` data cada punto con `anclaEpoch − (anclaLocal − lectura.time)`.
Sin ancla se omite `time` y el backend estampa la recepción.
- **El cronómetro es `time(nullptr)`, no un contador propio sumado en `dormir()`.**
  El RTC mantiene el system time durante el deep sleep y los resets (sólo el
  power-on lo borra), así que incluye el cuarto de segundo del boot de cada
  ciclo. Acumular `millis()` a mano lo perdía: ~230 ms × 4320 ciclos/día a 20 s
  son **~17 min/día** de atraso, 150× el drift del cristal que esto tolera. El
  error sólo se manifiesta sobre lecturas bufferizadas mucho tiempo, o sea
  exactamente en el corte de conexión que este diseño existe para cubrir.
  Vale mientras nadie llame a `settimeofday()` — por eso el firmware ya no usa
  SNTP para nada (ver abajo).
- **`epochDeLectura()` extrapola con signo, y tiene que ser así.** El ancla llega
  en la respuesta del POST *anterior*, así que en régimen la lectura que se está
  serializando es **posterior** al ancla vigente y hay que proyectar hacia
  adelante. Una guarda `lectura.time <= anclaLocal` rechaza exactamente el caso
  normal: se probó en placa y no fechó ni una medición. Peor, el bug se escondía
  detrás de otro — mientras la placa se reseteaba por brownout, `anclaEpoch`
  volvía a 0 en cada ciclo, entraba el lote vacío y anclaba *antes* de
  serializar, así que la guarda pasaba. Al estabilizar la alimentación dejó de
  fechar. Lo único que hay que descartar es un epoch por debajo de `EPOCH_MIN`.
- **Una lectura sin `time` no es sólo una lectura mal fechada: se come a sus
  compañeras.** El backend fecha todas las del batch que no traen `time` con un
  único `timestamp_batch` (`medicion_service.py:53,95`), y el `ON CONFLICT DO
  NOTHING` contra `idx_mediciones_unico (sensor_id, time)` deja **una sola por
  sensor**. Un buffer de 5 minutos entregó 1 punto en vez de 5, y parecía que el
  buffer no acumulaba cuando en realidad funcionaba perfecto. Cualquier cambio
  que haga caer lecturas al camino de "sin fecha" hay que mirarlo con esto en
  mente.
- **No corrige el drift del oscilador, y el drift real es mucho peor de lo que
  este doc supuso.** Medido en placa sobre una serie estable de 11 intervalos con
  el preset de 60 s: **59,45 s promedio, o sea 0,91 % rápido ≈ 13 min/día**. La
  estimación anterior («~8 s/día, 1–2 min tras 10 días») era de un ESP32 con
  cristal de 32,768 kHz; éste usa el RC interno de 150 kHz, que anda en 1–3 % y
  además deriva con la temperatura. Ver 3.f, cuya premisa esto desmiente.
  - **Conectado no se nota**: el ancla se refresca en cada respuesta, así que los
    timestamps son correctos y lo único que pasa es que el equipo publica cada
    59,45 s reales en vez de 60. Inocuo para los datos, el consumo y la vigilancia.
  - **Sin conexión sí**: ahí no hay ancla que corrija y el error es lineal. Diez
    días de buffer son **~2,2 horas** de corrimiento en las lecturas más viejas,
    no los 1–2 minutos que decía este doc. Para un cliente de cumplimiento
    (bromatología, ANMAT) eso invalida el dato justo en el corte que quiere
    auditar. Ver P1.p.
- **Sin ancla y con buffer, `enviarMediciones()` manda primero un lote vacío**
  para conseguir la hora: la trae la respuesta, así que sin eso el primer lote de
  un equipo instalado donde todavía no había WiFi saldría sin fechar — justo el
  caso que este diseño existe para cubrir. Pasa una vez en la vida del equipo y
  no escribe ninguna fila (el heartbeat ya es un POST con `mediciones: []`).

**La hora viene del backend, no de SNTP — no volver a NTP sin leer esto.**
`server_epoch` viaja en `MedicionCreateResponse`, junto al resto del plano de
control del equipo. Motivos, en orden:
1. **Términos de uso.** El NTP Pool no prohíbe el uso comercial, pero sí prohíbe
   explícitamente usar los nombres `pool.ntp.org` como configuración por defecto
   en un producto que se distribuye; la vía oficial es tramitar un *vendor zone*
   y cumplir sus obligaciones (KoD, tope de consultas, tiempos aleatorizados).
   De `time.nist.gov` no hay reglas publicadas sobre fabricantes.
2. **Cuesta cero.** El equipo ya habla con el backend en cada contacto; el ancla
   sale de una respuesta que ya llega. Un re-sync SNTP correcto son entre ~0,5 s
   y los 3 s del timeout de radio encendida por conexión.
3. **Se va el UDP 123**, que muchas redes industriales y corporativas filtran.
   Un cliente así tendría el equipo midiendo pero sin fechas; HTTP funciona por
   definición, si no, no hay datos.
4. El system clock del ESP32 sobrevive al deep sleep vía RTC, así que un
   `while (!horaValida())` sale inmediato desde el segundo ciclo y el ancla se
   toma del reloj derivado en vez de una hora fresca: con SNTP hay que
   distinguir "tengo una hora" de "tengo una hora *recién sincronizada*", y con
   `server_epoch` esa distinción no existe.

El firmware enchufado que se reescriba sobre `nucleo/` toma la hora del mismo
`server_epoch`; el viejo (`programa_base.ino`, borrado el 2026-10-10) usaba
`pool.ntp.org`.

**b. Watchdog armado** (`MS_WATCHDOG` = 60 s, `esp_task_wdt_reconfigure` + `add`).
Va como **primera línea de `setup()`**, antes del I2C: el cuelgue está en
`aht.getEvent()`, que corre antes de la red. El portal cautivo se cubre
desuscribiendo la tarea alrededor de `startConfigPortal` (`abrirPortal`).
No hace falta `esp_task_wdt_reset()`: no hay `loop()`.

**Pero hoy dispararlo cuesta el buffer entero** — ver P1.o. El watchdog recupera
un equipo colgado a costa de todas las lecturas guardadas, que a batería pueden
ser días. Hay que resolver eso antes de considerar cerrado el punto b.

**c. El portal sólo en arranque en frío.** `esp_sleep_get_wakeup_cause() !=
ESP_SLEEP_WAKEUP_TIMER` (un power-on devuelve `UNDEFINED`, así que la desigualdad
cubre power-on, reset y el futuro botón por `ext0`). `conectarWifi(permitirPortal)`.

**d. No se implementó, a propósito.** Ver 3.c.

**`dormir()` duerme hasta un instante, no una duración.** `proximoDespertarUs`
(RTC) lleva la grilla y el sueño es `objetivo − ahora`; si el objetivo ya pasó
—portal cautivo, reset, intervalo nuevo— se re-basa, porque recuperar ciclos
perdidos no le sirve a nadie.
- Sin esto el ciclo dura el intervalo **más** lo que tarde la red. Medido en placa:
  64–65 s con red rápida y 73–74 s mientras el backend no respondía, o sea el
  timeout de los POST fallidos se sumaba directo a la cadencia. Con el preset de
  60 s son 10–25 % de error, y encima roza el 1,5 × de `last_data_at`: el panel
  puede marcar «con retraso» un equipo sano.
- Descontar `millis()` arregla la mayor parte pero deja ~300 ms por ciclo, que es
  el boot corriendo antes de que `millis()` empiece a contar. **La grilla absoluta
  no necesita conocer ese número**, y por eso se prefiere a un `MS_BOOT`
  hardcodeado: el costo del boot cambia entre placas, versiones del core y config
  de flash, y sería justo el tipo de constante que no se puede corregir en un
  equipo ya entregado. Se corrige sola, y con ella cualquier atraso futuro.
- Requiere microsegundos, así que usa `gettimeofday()` (`microsLocales()`) y no el
  `time(nullptr)` de `ahoraLocal()`, que da segundos. Es el mismo cronómetro.

**e. Primer envío forzado.** En arranque frío `tocaEnvio` y `tocaContacto` salen
en true, y `primarVentana()` toma 3 lecturas separadas 1 s para que el primer
punto ya sea una mediana y no una muestra suelta.

**f. Rotación de secret.** `rotacionPendiente` es `RTC_DATA_ATTR` y `rotarSecret()`
se llama desde `enviarMediciones()` tras conectar y antes del POST — no desde
`conectarWifi()`, que no tiene por qué saber de secrets. El backend acepta los dos
secrets durante una rotación, así que el orden es seguro.

**Bug de contrato, ya corregido en los dos firmwares:** `guardarUmbrales()` leía
`item["cantMuestras"]`; el backend manda `muestras`
(`backend/schemas/medicion.py:16`). Y el firmware enchufado viejo leía
`respuesta["intervalo_sugerido"]` en vez de `intervalo_sugerido_seg`, con lo cual
**ningún equipo enchufado aplicaba nunca la cadencia del backend** y
`PATCH /dispositivos/{id}/intervalo` no hacía nada en el equipo real.

---

## 2. Falta implementar

### P1 — autonomía y robustez

**g. Backoff exponencial en el reintento de WiFi.** ✅ en `prueba_bmp.ino`.
`waitForConnectResult(10000)` son 10 s de radio a ~120 mA sin traer un dato: un
equipo fuera de cobertura consume más que uno conectado y se vacía en días. Si
falla: 10 → 20 → 40 min, tope 1 h. El muestreo y el buffer **no** se espacian — el
corte es justo lo que el cliente va a querer reconstruir.
- **No escala con la cadencia de envío, a propósito.** El costo de un intento
  fallido es fijo (~1200 mA·s) y sin red los datos se bufferizan igual. Sin backoff
  un equipo de 1 min duraría ~4 días sin red; con tope 1 h, ~77 días
  cualquiera sea su cadencia.
- **El primer fallo reintenta en la cadencia normal**: casi siempre es
  transitorio y 10 min de hueco por un reinicio del router no se justifican. El
  backoff arranca en el segundo fallo seguido.
- El tope es la palanca contra la ventana de 15 min de «sin reportar»: con 1 h, el
  mail de recuperación puede llegar hasta 1 h tarde. Con 30 min, ~58 días sin red.
- Cuenta como fallo cualquier contacto sin un 2xx, WiFi o backend: los dos gastan
  radio sin traer nada. Un cruce de umbral saltea el backoff.
- **Un cruce que no pudo salir queda pendiente** (`alertaPendiente`) y se reintenta
  en el despertar siguiente (20 s), no en la próxima publicación: visto el 29/9, un
  POST adelantado fallido hizo esperar 5 min a la alerta. Como tras el primer fallo
  el backoff es 0, el segundo fallo ya lo frena sin lógica aparte.
- El `diag` lleva la causa del último fallo (`motivo_fallo_wifi` 802.11 o
  `codigo_fallo_http`) y `rapidas_fallidas`, el contador de conexiones rápidas que
  cayeron a la normal.
- `fallosContacto` es `RTC_DATA_ATTR`, así que un arranque en frío lo resetea y
  reintenta ya (ver o).

**h. Conexión rápida.** ✅ en `prueba_bmp.ino`. **Medido en placa: 3406 ms la
normal, 206 ms la rápida con IP fija** — 16×, mucho mejor que el ~1,5 s estimado.
Un despertar con contacto bajó de ~3,8 s a **630 ms** (POST incluido). Con eso el
contacto deja de ser el 71 % del consumo de 3.b y el despertar de muestreo
(116 ms cada 20 s) pasa a ser lo más caro: ver m. El equilibrio de 3.a cae a ~4 s,
así que dormir gana con más margen todavía.
- Canal, BSSID e IP en `RTC_DATA_ATTR` (`RedConocida`), grabados tras una conexión
  normal exitosa.
- **La config con canal/BSSID va sólo a RAM** (`esp_wifi_set_storage(WIFI_STORAGE_RAM)`),
  no vía `WiFi.begin(ssid, pass, canal, bssid)`: ése la escribe en NVS en cada
  despertar, 4320 veces por día a 20 s. La credencial de WiFiManager queda intacta.
- **La IP fija se reutiliza hasta la mitad del lease** (T1 del RFC 2131, leído de
  lwIP), nunca más: pasado el vencimiento el router puede habérsela dado a otro
  equipo, y un conflicto de IP rompe la red del cliente, no sólo la nuestra. Pasado
  T1 se hace DHCP con canal/BSSID igual, y eso renueva la IP recordada.
- Si la rápida falla, se cae a la normal **en el mismo despertar** y se olvida la
  red, en vez de esperar dos fallos: la causa típica (el router cambió de canal)
  se resuelve con la normal, y esperar costaba contactos perdidos con el backoff.

**i. Drenar varios chunks con la radio ya encendida.** ✅ en `prueba_bmp.ino`:
lotes de 100 hasta vaciar o hasta el primer fallo. Medido en placa: 500 lecturas
en 1,2 s, así que no hace falta tope por ciclo — la grilla de `dormir()` lo absorbe.

**j. Medición de batería.** ADC sobre divisor (ver hoja de hardware). Habilita el
aviso de "batería baja" *mientras todavía hay energía para mandarlo*, el modo
conservación y el volcado del punto l. Decidido: campo `bateria_mv` del POST, no
sensor; el % lo calcula el backend.

**p. Corregir el drift del oscilador por software, midiéndolo contra el servidor.**
✅ en `prueba_bmp.ino` (`calibrarReloj()`), **validado en placa el 29–30/9**: 21 h sin
API (20:13 → 17:37 UTC), 219 puntos a 299–302 s, sin salto en la costura flash/RTC
ni en la reconexión (último punto 17:37:38, POST 17:37:39). El ppm pasó de −9872 a
−8436 en el corte (deriva térmica, ~0,14 %): sólo corrió el despertar ~1,4 s cada
5 min, las fechas no, porque se interpolan entre anclas. En la base se
ve 297,8 s por cada 300 configurados, o sea −7300 ppm en esta unidad. El factor se
guarda como ppm entero, se aplica al fechar (`aReal()`) **y** al sueño (`dormir()`,
así 5 min son 5 min reales), y persiste en NVS (namespace `reloj`), sólo cuando
cambia más de 50 ppm: es propiedad de la placa y un reset no tiene por qué tirarlo.
- **Visto en la base**: durante el corte de la API del 25/9 (04:17–17:26 ART) los
  puntos quedaron a 300 s exactos, contra 297–298 s conectado. Esa regularidad es
  el síntoma: son segundos del cronómetro, no reales (~5,7 min de error en 13 h).
- **Tras un corte de más de 1 h, o con algo en flash, se re-ancla antes de
  drenar** (lote vacío). Sin esto, el primer lote salía fechado con el ancla de
  antes del corte.
- **Lo medido durante un corte se interpola entre el ancla de antes y la de
  después** (`epochEntre`), no se extrapola con el ppm promedio. Visto el 29/9: en
  11 h sin API el drift real se apartó ~0,26 % del aprendido y lo de flash, fechado
  al volcar, quedó 75 s corrido (salto de 375 s en la costura con la RTC).
- **Calibrar en banco antes de entregar**: la NVS sobrevive al reflasheo, así que
  una hora conectado deja el drift guardado. Si no, un equipo que arranca en
  campo sin WiFi fecha su primer corte sin corrección.
El equipo puede aprender su propio error sin hardware nuevo: dos anclas separadas
dan `factor = Δepoch_servidor / Δlocal`, y datar pasa a ser
`anclaEpoch + (lectura − anclaLocal) × factor`. Con el 0,91 % medido, eso baja el
error de 10 días de buffer de ~2,2 h a segundos.
- **La separación entre las dos anclas es el punto.** Con anclas consecutivas
  (60 s) la cuantización de 1 s mete ±1,7 % de error, peor que el drift que se
  quiere corregir. Hace falta un ancla de referencia vieja, guardada en RTC y
  refrescada cada varias horas: con 1 h de separación el error de medición cae a
  ±0,03 %, de sobra para corregir un 0,9 %.
- Alternativa de hardware: cristal de 32,768 kHz (3.f), que lleva el drift a
  ~20 ppm ≈ 1,7 s/día. Cuesta GPIO32/33 y el componente por unidad. Esta opción en
  software es gratis y además se adapta a la deriva térmica, que un cristal
  también tiene aunque mucho menor.

**o. `RTC_NOINIT_ATTR` en vez de `RTC_DATA_ATTR` para el estado que no se puede
perder.** Verificado en placa: `RTC_DATA_ATTR` sobrevive el deep sleep, pero el
bootloader la re-inicializa desde flash en **cualquier otro boot**. Tras un
brownout el log mostró `ancla NO` y `intervaloEnvioSeg` de vuelta en su valor de
compilación — o sea el buffer entero, el ancla, los contadores y los umbrales se
fueron. Consecuencia: el watchdog del punto b, que existe para recuperar un
equipo colgado, hoy paga esa recuperación con todas las lecturas guardadas.
- `RTC_NOINIT_ATTR` no se inicializa nunca, así que hay que validar el estado a
  mano: un magic number más una whitelist de `esp_reset_reason()`.
- **El brownout no va en la whitelist**: si la tensión cayó lo bastante como para
  disparar el BOD, la SRAM de RTC pudo corromperse y el magic number sólo detecta
  una parte. Ahí conviene descartar y arrancar limpio, igual que en un power-on.
  O sea esto arregla el caso watchdog, no el caso brownout.
- Las guardas del reloj ya cubren el estado mixto: si el cronómetro se reinicia
  pero el ancla no, las lecturas quedan con `time > anclaLocal` y salen sin fecha
  en vez de con una fecha inventada.

**k. Botón de AP por `esp_sleep_enable_ext0_wakeup`.** Pin del dominio RTC, no
GPIO0 (es bootstrap). No consume nada mientras duerme. El firmware ya está listo
de este lado: `arranqueFrio` lo cubre por ser `!= ESP_SLEEP_WAKEUP_TIMER`.

### P2 — cuando lo anterior ande

**l. Volcado a flash.** ✅ en `prueba_bmp.ino`, **validado en placa el 29–30/9**: el
corte de 21 h de p volcó y entregó todo (tandas de 100 al reconectar, detrás de
un re-anclado). Falta ejercitarlo cerca de la capacidad y a través de un power-on
(ver 4). Lo que lleva
más de 30 min sin enviarse en RTC pasa a LittleFS (partición `spiffs`, 896 KB,
~97 000 lecturas); conectado nunca se escribe. Cola de archivos `/cola/NNNNNNNN`
de 450 lecturas (un bloque), se drena primero la flash y después la RTC — el orden
es obligatorio por `ultima_evaluacion_at`. Se guarda tiempo del cronómetro, nunca
epoch, y la cabecera del segmento lleva la corrida (`RTC_NOINIT` + contador en NVS,
una escritura por power-on con volcado) y el ancla + ppm vigentes al volcar. Misma
corrida al enviar: se interpola entre esa ancla y la actual. Otra corrida: se
extrapola desde el ancla de la cabecera, y si se volcó sin hora se descarta: tras
un power-on no hay forma de saber cuánto duró el apagón. Llena, se
borra el segmento más viejo. Backend: migración 016 lleva la ventana de los CAGG a
85 días (no 90: pasarse de la retención del raw borra agregados).
Nota original: el disparador útil **no** es "se llenó el buffer" (eso son
10 días sin conexión) sino **batería baja**: si la celda se agota, la RTC memory
se borra entera y se pierden los últimos días justo en el evento que el cliente
quiere entender. Ojo con el reloj: al volver la energía el cronómetro arranca de
cero (el power-on es lo único que borra el system time), así que hay que guardar
el ancla **y** convertir las lecturas a epoch absoluto antes de volcarlas — su
edad no significa nada contra el cronómetro nuevo. LittleFS en partición propia,
no NVS (partición chica y no es para esto).

**m. Muestreo condicional.** ✅ en `prueba_bmp.ino`, validado en placa (29/9, sin
reglas: un despertar cada ~300 s). Sin reglas, el paso entre despertares es el MCD
de envío y contacto (300 s con los presets) en vez de 20 s. **El primado volvió a
`delay()`**: con light sleep entre lecturas el sensor dejaba de responder en los
despertares. Se acortó a 100 ms entre lecturas (`MS_ENTRE_PRIMADO`) en vez de 1 s,
así el costo de estar despierto queda chico sin light sleep; medir el ahorro real
con 4. Los contadores pasaron de ciclos a segundos. Un cambio de
reglas en la respuesta cambia el modo solo, desde el sueño siguiente.
Diseño original: sin umbrales configurados, no despertar cada 20 s:
al publicar, tomar 3 lecturas separadas 1 s y mandar la mediana — que es
exactamente lo que ya hace `primarVentana()`. Mantiene el filtro contra frames
corruptos (el −9,66 °C entre dos 20,6 °C) y elimina 14 de cada 15 despertares.
Según el desglose de 3.b vale ~27 % del consumo. Trade-off aceptado: 3 lecturas
en 3 s no filtran un sensor colgado 3 s, sí el frame aislado.

**n. Detección de alimentación externa** por pin → modo enchufado (LEDs fijos,
cadencia normal) vs modo batería. Más confiable que inferirlo del voltaje.

---

## 3. Decisiones

**a. ¿Quedarse despierto en vez de dormir? No, con los presets actuales.**
Números de datasheet (ESP32-WROOM, hardware final con regulador de bajo
quiescent), sin medir todavía:
- Un ciclo con WiFi (despertar + asociar + POST) ≈ 5 s × ~120 mA ≈ **600 mA·s**.
  Con el punto h, ~240 mA·s.
- Quedarse asociado en modem sleep ≈ **20 mA** sostenido.
- Equilibrio: 600 / 20 = **30 s**; con el punto h, 12 s.

`PRESETS_INTERVALO_SEG` arranca en 60 s (`dispositivo_service.py:11`), o sea que
**para todo intervalo que un usuario puede elegir, dormir gana**. El único caso
por debajo del equilibrio es el fast start, y ahí el ahorro total sería ~7 mA·h
una sola vez en la vida del equipo (0,35 % de una celda de 2000 mA·h): no paga
las dos rutas de código ni que `loop()` deje de estar vacío.

Hay un caso donde empata: WiFi malo, conexión que se va a los 10 s de timeout →
el ciclo cuesta 1200 mA·s y el equilibrio se corre a 60 s. Eso lo arregla el
punto h, no quedarse despierto. **Revisar esta decisión sólo si aparece un preset
por debajo de 30 s** (un modo live, por ejemplo).

**b. `intervalo_contacto_seg` por equipo (toca backend). Abierta, medir primero.**
Desglose estimado con muestreo cada 20 s y contacto cada 300 s:

| Fuente | Promedio | Peso |
|---|---|---|
| Deep sleep | ~0,01 mA | ~0 % |
| Despertar a muestrear cada 20 s (sin WiFi) | ~0,75 mA | 27 % |
| Conectar cada 300 s | ~2 mA | 71 % |
| **Total** | **~2,8 mA** | ~29 días con 2000 mA·h |

Con el preset de 1800 s el envío serían 2 conexiones/hora, pero el heartbeat de
300 s fuerza 12 igual: la autonomía cae de **~75 a ~29 días**. Ese 2,5× es lo que
compraría esta decisión, y es la de mayor impacto que queda.

Propuesta: columna en el equipo, y que la ventana de silencio se derive de ella
(×3). Toca `dispositivo_service.esta_online()`, `vigilancia_service` y la pastilla
del front — los tres leen de una sola función, así que es contenido, no
arquitectura. **Confirmar el 71 % con una medición real antes de construirlo**:
hoy es estimación de datasheet.

**c. El fast start del backend: se obedece, sin piso propio en la placa.**
`aplicarModificacionIntervalo()` clampea **sólo** contra `intervaloMuestreoSeg`, y
ese clamp es físico, no de negocio (publicar más seguido que lo que se mide sólo
repite la misma mediana). Con eso, los 15 s de `INTERVALO_ARRANQUE_SEG` ya quedan
en 20 s solos: 90 ciclos en media hora ≈ 15 mA·h ≈ **0,75 % de una celda, una vez
por arranque en frío**. No justifica nada.

La razón de fondo es que el firmware no lleva parámetros de negocio: una vez el
equipo está en producción, un número en la placa no se puede cambiar y el backend
es el único lugar donde sí. Si al medir el fast start resulta caro, se resuelve
ahí (no aplicar `VENTANA_ARRANQUE` a un equipo a batería), junto con 3.b.

> El otro número de negocio que **sí** vive todavía en la placa es
> `intervaloMuestreoSeg` (20 s): vale ~27 % del consumo y fija la latencia de
> confirmación de alertas (3 muestras × 20 s = 60 s). Hoy es deliberado: el muestreo
> no es configurable por nadie. Candidato al mismo tratamiento si hace falta.

**d. ¿Un firmware con dos modos o dos firmwares? Decidida: un núcleo, varios ciclos.**
El enchufado se reescribe como otro ciclo sobre `nucleo/`, con el mismo `Enlace` y
`Pendientes`. El viejo (`programa_base.ino` + `generar_sketches.py`) se borró el
2026-10-10 y queda en el historial de git. Mientras tanto, un equipo enchufado corre el
firmware a batería.

**e. Capacidad del buffer: hay más aire del que se creía.** Medido en el mapa del
linker con 500 entradas: `.rtc.data` = **4765 B**, de `0x50000200` a `0x5000149d`,
y el reservado del sistema arranca en `0x50001fe8` → **2891 B libres**, o sea
~320 entradas más de `Lectura` (9 B) sin tocar nada. La estimación vieja de
"4,9 KB de ~6 KB útiles" era pesimista. Verificar de nuevo al sumar sensores.

**f. Cristal de 32,768 kHz: sí o no.** Ver hoja de hardware. Cuesta GPIO32/33 más
el componente por unidad, y llevaría el drift a ~20 ppm (≈1,7 s/día).

Esta entrada decía que "con el oscilador interno calibrado el drift ya es
aceptable", y **la medición en placa lo desmiente**: el RC interno de esta unidad
corre 0,91 % rápido, ~13 min/día (ver 1.a). Deja de ser una decisión de "dejar la
puerta abierta" y pasa a ser un problema con dos soluciones posibles.

Ahora compite contra **P1.p**, que corrige el mismo error por software midiéndolo
contra el servidor, sin costo por unidad ni pines. Salvo que aparezca un caso donde
el equipo necesite hora precisa *sin haber hablado nunca* con el backend, P1.p
domina: es gratis, se adapta a la deriva térmica y no compromete hardware. Medir el
drift en dos o tres unidades más antes de cerrarla, para saber si el 0,91 % es
típico o es esta placa.

---

## 4. Verificar antes de dar por cerrado

- [x] **Compila**: `arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app --library esp/nucleo esp/prueba_bmp`
      → 38 % de flash, 15 % de RAM.
- [x] **Mapa del linker**: todo lo `RTC_DATA_ATTR` entra en RTC slow memory con
      2891 B de sobra (ver 3.e).
- [x] **Cross-check de `empuja()`** contra `alerta_service._empuja`, traduciendo el
      C a Python sobre la máquina de estados completa (incluye
      `muestras_confirmacion`): 20 000 series aleatorias, 0 divergencias.
- [x] **El ciclo de deep sleep, en placa.** El log confirma lo que no se podía
      verificar de otra forma: `DEEPSLEEP_RESET` da `arranqueFrio` en false, el
      ancla y los contadores sobreviven el sueño, el ciclo hace una sola lectura
      en vez del primado, el intervalo que manda el backend se aplica (15 → 3
      ciclos con 60 s) y una alerta dispara recién al tercer cruce consecutivo.
- [ ] **Alimentación: el equipo hace brownout al encender la radio.** Dos veces en
      el log, siempre justo antes de conectar (`E BOD: Brownout detector was
      triggered` → `SW_RESET`). Es hardware, no firmware, pero bloquea cualquier
      prueba larga y hay que resolverlo antes de medir consumo. Si pasa con USB,
      a batería con un regulador mediocre va a pasar siempre. El arreglo es cable
      corto a un puerto directo y un electrolítico de 470–1000 µF entre 3V3 y GND
      lo más cerca posible del módulo.
      - **No hay mitigación de software, y se probó.** El BOD salta *antes* de
        `[WiFi] Conectado`: el pico es el arranque del PHY y su calibración RF, que
        ocurre entero antes del primer paquete. Por eso `WiFi.setTxPower()` no
        cambió nada — actúa sobre una etapa a la que el equipo nunca llega — y se
        sacó. `setCpuFrequencyMhz(80)` quedó, pero por consumo, no por esto: el
        firmware lee un I2C y arma un JSON, nada justifica 240 MHz.
- [x] **Buffer y fechas, prueba corta.** Backend caído 4 min con el equipo
      midiendo: al volver entregó las cuatro mediciones con su hora real, sin hueco
      y sin apilarse en el instante de recepción. Los `time` entran con fracción
      `.000000`, que es la marca de que los fechó el equipo y no el servidor.
- [ ] **Un ciclo real de varios días sin WiFi** (la versión larga de lo anterior),
      que es lo que ejercita el buffer cerca de su capacidad y el drift acumulado
      del cristal sobre un período largo sin re-anclar.
      - **21 h hechas el 29–30/9** (PC apagada, el equipo con WiFi y backend
        caído: `codigo_fallo_http` −1): fechas, flash y drenaje bien (ver p y l).
        Faltan días, no horas, y un power-on en medio.
- [ ] **El sensor dejó de contestar 3 h** (29/9, 20:23–23:24 UTC) tras mover el
      equipo, y volvió solo. Hardware, ver `DIAGNOSTICO-HARDWARE.md`. Del lado del
      firmware se portó bien —no bufferizó basura, siguió despertando y
      contactando— pero no dejó la causa: al fallar `begin()` convendría mandar en
      `diag` el código de `endTransmission()` y el nivel de SDA/SCL, para
      distinguir contacto abierto de bus colgado sin tener que reproducirlo.
- [ ] **Portal**: con credenciales borradas y despertar por timer, que no levante
      el AP. Con power-on, que sí lo levante y que el watchdog no lo reinicie
      durante los 10 min.
- [ ] **Watchdog**: desconectar el AHT10 en caliente y confirmar que reinicia a los
      60 s en vez de quedar mudo.
- [ ] **Medir el consumo real** y contrastar con el desglose de 3.b, que es lo que
      destraba esa decisión.
