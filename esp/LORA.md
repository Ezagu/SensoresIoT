# Enlace LoRa

Nodos a batería con la lógica de `prueba_bmp` que, en vez de WiFi, le hablan por LoRa a
un **gateway** enchufado. El gateway es un pasamanos: recibe la trama, la manda tal cual al
backend y transmite al nodo la respuesta que el backend armó y firmó. No tiene claves, no
sabe qué nodos existen, no decodifica nada ni guarda tramas: es el patrón de LoRaWAN
(packet forwarder / Basics Station), sin su pila. Cualquier gateway nuestro que oiga a un
nodo lo atiende; no hay emparejamiento.

Por qué de punta a punta y no un ACK local del gateway: la respuesta la arma quien conoce
las reglas, la hora y los intervalos, así que el nodo recibe reglas (adelanta envíos ante
un cruce) igual que por WiFi. Y si no hay internet, los datos esperan en la cola en flash
del nodo, que ya existe, en vez de duplicarla en el gateway.

## Estado

**Fase 1, hecha:** nodo + receptor de banco con tramas v2, sin backend. Probado en placa.

**Protocolo v3, definido (este documento), falta implementarlo** en el nodo, el gateway y
el backend. Reemplaza a v2 entero: no hay nodos en campo.

| Pieza | Dónde |
|---|---|
| Protocolo de aire (tramas, firma) | `nucleo/src/enlace/lora/Trama` |
| Interfaz de radio y driver SX127x (header-only) | `enlace/lora/Radio.h`, `RadioSx127x.h` |
| Nodo: implementa `Enlace` | `enlace/EnlaceLora` |
| Extremo receptor (base del gateway) | `enlace/lora/ReceptorLora` |
| Sketch del nodo (placa del prototipo: AHT10, batería, humedad de suelo) | `esp/prueba_lora/` |
| Receptor de banco | `esp/receptor_lora/` |
| Contrato gateway ↔ API | `CONTRATO.md` |

**Fase 2, pendiente: backend.** Endpoint del gateway, verificación y decodificación, armado
y firma del ACK, deduplicación entre gateways, liveness de nodo y gateway.

**Fase 3, pendiente: gateway real.** Recibe por interrupción (DIO0), marca el instante de
cada trama, hace el POST con la conexión abierta y transmite en la ventana que corresponda.

## Radio

| Parámetro | Subida (nodo → gateway) | Bajada (gateway → nodo) |
|---|---|---|
| Frecuencia | 919,9 MHz | 921,9 MHz |
| Ancho de banda | 500 kHz | 500 kHz |
| Spreading factor | SF9 | SF9 |
| Coding rate | 4/5 | 4/5 |
| Preámbulo | 8 símbolos | 16 símbolos |
| IQ | normal | **invertida** |
| Potencia | 17 dBm | 17 dBm |

CRC encendido, header explícito, sync word `0xB1` (el `0x12` es el de toda red privada y el
`0x34` el de LoRaWAN: uno propio filtra lo ajeno).

- **500 kHz es requisito legal, no preferencia.** La Res. ENACOM 4653/2019 (anexo) admite
  en 915–928 MHz: modulación digital de banda ancha (ancho a 6 dB ≥ 500 kHz, hasta 1 W
  conducido / 4 W PIRE, ≤ 8 dBm en 3 kHz), salto de frecuencia (≥ 25 canales) u "otros
  sistemas" con **200 µW PIRE**. Un canal fijo de 125 kHz cae en "otros" y 17 dBm son
  50 mW. Saltar entre 25 canales no es posible con un gateway de un solo SX1276. A 17 dBm
  la densidad queda en −5 dBm/3 kHz. **Falta confirmarlo con un laboratorio de
  homologación antes de vender.**
- **SF9/500 kHz rinde como el SF7/125 kHz anterior**: mismo símbolo (1,024 ms), −122 dBm
  de sensibilidad contra −123 (datasheet), tramas un 20 % más cortas y más tolerancia al
  error del cristal. Si hace falta más alcance, SF10 da −125 dBm a costa de duplicar el
  tiempo en el aire.
- **Frecuencias**: dentro de 915–928 con margen de los bordes (915,0 dejaba media emisión
  en 902–915, con otra regulación) y fuera de la subbanda 2 de AU915 (916,8–918,2) y de
  las bajadas de AU915 (923,3–927,5), que usan las redes LoRaWAN. Confirmar con un barrido
  en el lugar.
- **Bajada en otra frecuencia y con IQ invertida**, como LoRaWAN: un nodo que espera su ACK
  no demodula la subida de otro nodo (que lo dejaría sordo justo cuando llega su
  respuesta), y una bajada no pisa subidas en el aire. Preámbulo largo para tolerar una
  ventana que abre tarde; el receptor del nodo se configura con 16.
- La radio queda compilada en nodo y gateway y el nodo no se actualiza por LoRa: cambiar
  cualquiera de estos valores es reflashear.

Pines de la placa del prototipo: SCK 18, MISO 21, MOSI 19, CS 17, RST 33, DIO0 15. Librería
`LoRa` de Sandeep Mistry (0.8.0): `arduino-cli lib install LoRa`. No trae CAD: se escribe en
el driver por registros.

## Contacto: ventanas de respuesta

```
Nodo     [TX]──light sleep──[ventana 1]──light sleep──[ventana 2]
              t0 = fin de la subida
Gateway  [RX, marca t0]──POST──▶     transmite en t0+RX1 o en t0+5 s
Backend           verifica, guarda, arma y firma el ACK
```

- **Ventana 1 (RX1)**: a `t0 + RX1`. El nodo informa su RX1 en cada trama (default 1 s);
  el backend lo ajusta en el ACK según la latencia real que reporta el gateway.
- **Ventana 2 (RX2)**: a `t0 + 5 s`, **fija**. Es la red de seguridad: si un RX1 mal
  ajustado hace perder la ventana 1, la corrección llega igual por la 2.
- LoRaWAN usa 1 y 2 s de fábrica; TTN usa 5 y 6 porque su backhaul pasa por Packet Broker.
  1 y 5: rápido con internet bueno, el margen de TTN con internet malo.
- **El nodo duerme entre medio** (light sleep): la espera cuesta ~1 mA, no los ~40 mA de
  la radio escuchando con el ESP32 despierto. Abre cada ventana antes de tiempo por un
  margen de `2 % de la espera + 5 ms` (el RC del ESP32 anda en ~1 %; el drift aprendido
  lo corrige) y escucha en RX single hasta detectar un preámbulo o agotar `2 × margen +
  preámbulo`.
- **El gateway nunca transmite fuera de ventana.** Con la respuesta en mano: si llega a
  la ventana 1 transmite ahí, si no a la 2, y si tampoco la descarta y la cuenta como
  ventana perdida en su diag. `t0` lo marca en la interrupción de fin de recepción con el
  reloj de cristal; no necesita hora real.
- **Una ventana perdida cuesta energía, nunca datos**: el backend ya guardó el lote, el
  nodo lo reenvía y vuelve como duplicado `(sensor_id, time)`.

## Política del nodo

Lo que sigue es política del ciclo y del enlace, no formato de trama: se puede ajustar sin
tocar el gateway ni el backend.

- **Antes de cada contacto**: espera al azar de 0–3 s. El ciclo duerme en una grilla
  absoluta corregida por drift: dos nodos encendidos a la vez quedarían en fase y
  chocarían en cada contacto, para siempre.
- **Antes de cada transmisión, escuchar** (CAD, ~2 ms): si el canal está ocupado, esperar
  50–500 ms al azar y volver a escuchar, hasta 5 veces; después transmitir igual. Ayuda
  cuando los nodos se oyen entre sí (varios en el mismo lugar); no con nodos que oyen al
  gateway pero no entre ellos, por eso no reemplaza a los reintentos.
- **Reintentos**: hasta 3 intentos por lote, misma trama y mismo contador, con 1–3 s al
  azar entre el cierre de la ventana 2 y el siguiente (como LoRaWAN).
- **Aviso del gateway** (tipo `0x03`): corta el contacto sin más intentos y cuenta como
  contacto fallido. Los datos quedan en la cola.
- **Drenaje por tandas**: hasta 20 lotes por contacto; lo que queda sale en los contactos
  siguientes. Diez días de atraso son ~540 lotes: sin tope, un nodo ocuparía el canal
  ~12 min seguidos.
- **Primer contacto sin hora**: un lote vacío para anclar antes de mandar datos fechados
  (igual que WiFi).

## Tramas (v3)

Todo little-endian; floats IEEE 754 de 32 bits. Las tramas firmadas terminan en un MAC:
HMAC-SHA256 con la clave de enlace del nodo (16 B) sobre todos los bytes anteriores,
truncado a 8 B. La clave la genera el backend en el alta, se compila en el nodo y sólo la
conocen los dos: el gateway no la necesita.

| Tipo | Dirección | Firma |
|---|---|---|
| `0x01` Datos | nodo → gateway → backend | clave del nodo |
| `0x02` ACK | backend → gateway → nodo | clave del nodo |
| `0x03` Aviso | gateway → nodo | sin firma (el gateway no tiene claves) |

### Datos (`0x01`), 20 + 9 × n bytes más secciones

| Offset | Largo | Campo |
|---|---|---|
| 0 | 1 | magic `0xB3` (Bitácora, versión 3) |
| 1 | 1 | tipo `0x01` |
| 2 | 2 | id del nodo (único global, lo asigna el backend en el alta) |
| 4 | 2 | contador |
| 6 | 1 | RX1 que va a usar el nodo, en décimas de segundo (5–40) |
| 7 | 2 | versión de reglas que tiene el nodo; `0` = ninguna |
| 9 | 2 | batería en mV; `0xFFFF` = sin batería o sin lectura |
| 11 | 1 | n, cantidad de puntos (≤ 16) |
| 12 | 9 × n | punto: índice de sensor (1), valor float (4), epoch (4; `0` = sin fecha) |
| 12 + 9n | — | secciones opcionales |
| fin − 8 | 8 | MAC |

**Secciones opcionales**: cero o más `tipo (1) | largo (1) | datos`. Quien no conoce un tipo
lo saltea por el largo: así se agregan cosas sin cambiar de versión.

| Tipo | Contenido |
|---|---|
| `0x01` Diag | motivo de reinicio (1), cronómetro s (4), seg desde la última lectura ok (2, `0xFFFF` = ninguna), lecturas fallidas (2), fallos de inicio de sensor (2), lecturas en RTC (2), segmentos en flash (2), fallos de contacto (1), reloj ppm (int16), bits: alerta pendiente (bit 0) (1). 19 B |

El diag viaja en el primer contacto tras un arranque y una vez por día, no en cada lote.

### ACK (`0x02`), 27 bytes + 10 por regla

| Offset | Largo | Campo |
|---|---|---|
| 0 | 1 | magic `0xB3` |
| 1 | 1 | tipo `0x02` |
| 2 | 2 | id del nodo |
| 4 | 2 | contador de la trama que confirma |
| 6 | 1 | flags: bit 0 hora, bit 1 intervalos, bit 2 RX1, bit 3 reglas |
| 7 | 4 | epoch UTC del **fin de la subida** |
| 11 | 2 | intervalo de envío, s |
| 13 | 2 | intervalo de contacto, s |
| 15 | 1 | RX1 a usar desde el próximo contacto, décimas de s |
| 16 | 2 | versión de las reglas que siguen |
| 18 | 1 | m, cantidad de reglas (≤ 8) |
| 19 | 10 × m | regla: índice de sensor (1), bits (1), umbral float (4), histéresis float (4) |
| fin − 8 | 8 | MAC |

Byte de bits de la regla: bit 0 = condición `mayor` (si no, `menor`), bit 1 = disparada,
bits 2–5 = muestras de confirmación − 1 (1–8).

- **Los campos van siempre**; los flags dicen cuáles aplicar. Un campo sin su flag se
  ignora.
- **La hora es la del fin de la subida**, no la de envío del ACK (como `DeviceTimeAns` de
  LoRaWAN): el nodo la ancla contra el instante en que terminó de transmitir ese intento.
  Anclar al recibir el ACK correría la hora todo lo que duró la espera. El backend la
  calcula como su hora de recepción menos la edad de la trama que informa el gateway.
- **Reglas sólo cuando cambian**: el backend compara la versión que informó el nodo con la
  suya y las manda (con el bit 3) sólo si difieren. La versión es un CRC-16/CCITT sobre
  los bytes de las reglas con el bit de disparada en 0, y nunca vale `0`: el estado
  `disparada` cambia seguido y el nodo conserva su estado local para las reglas que ya
  conoce (`umbrales::reemplazar`), así que reenviarlas por eso sólo gastaría aire.
  Lista vacía con el bit 3 = el nodo borra sus reglas.

### Aviso del gateway (`0x03`), 7 bytes

| Offset | Largo | Campo |
|---|---|---|
| 0 | 1 | magic `0xB3` |
| 1 | 1 | tipo `0x03` |
| 2 | 2 | id del nodo |
| 4 | 2 | contador de la trama a la que responde |
| 6 | 1 | motivo: `1` = sin conexión al backend, `2` = el backend respondió con error |

Sale en la ventana 1. Sin firma: un aviso falso sólo demora la entrega, que es lo mismo
que logra cualquiera interfiriendo la frecuencia.

### Tiempo en el aire (SF9, 500 kHz)

| Trama | Bytes | Tiempo |
|---|---|---|
| Datos vacía (heartbeat) | 20 | ~46 ms |
| Datos llena (16 puntos) | 164 | ~210 ms |
| ACK sin reglas | 27 | ~65 ms |
| ACK con 8 reglas | 107 | ~150 ms |
| Aviso | 7 | ~39 ms |

## Gateway y backend

- **Varios gateways oyen la misma trama** (dos del mismo cliente que se solapan, el de un
  vecino que también es cliente, uno de reemplazo prendido junto al viejo): el backend
  procesa cada copia (los datos son idempotentes) pero devuelve el ACK a **uno solo**, el
  de mejor SNR entre las copias que llegaron dentro de 200 ms de la primera (ventana de
  deduplicación de ChirpStack); a los demás, nada. Dos ACK simultáneos chocarían en el
  nodo.
- **Trama inválida** (firma, id desconocido, mal formada): el backend no devuelve ACK y lo
  loguea con límite. Un id que falla siempre es una clave mal compilada.
- **El contador no es anti-replay**: empareja cada ACK con su intento. Arranca al azar en
  cada power-on y los reintentos lo repiten. Lo repetido se descarta por `(sensor_id, time)`.
- **Liveness**: el nodo está vivo si alguna trama suya llegó en los últimos 15 min (lo
  mismo que WiFi). El gateway informa en cada POST y heartbeatea; si se cae, sus nodos no
  generan "sin reportar" y sale un solo aviso, el del gateway.

## Pendientes

- **Diag del gateway**: tramas recibidas, CRC inválidos, ventanas perdidas, RSSI del WiFi.
- **Medir en placa**: consumo en light sleep, precisión de las ventanas y latencia real
  gateway ↔ backend antes de fijar el RX1 por defecto en producción.
- **ENACOM**: homologación del nodo y del gateway con el perfil de 500 kHz.
