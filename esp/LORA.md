# Enlace LoRa

Nodos a batería con la lógica de `prueba_bmp` que, en vez de WiFi, le hablan por LoRa a
un **gateway** enchufado que hace los POST. Topología y decisiones de fondo: nodos sin
WiFi ni portal; el gateway lo instala el cliente y su configuración (qué nodos escucha,
radio) va a vivir en el backend; la firma de cada nodo la verifica el backend con una
clave de enlace por dispositivo, porque el backend sólo guarda el hash del secret.

## Estado

**Fase 1, hecha: nodo + receptor de banco, sin backend.** Compila; falta probar en placa.

| Pieza | Dónde |
|---|---|
| Protocolo de aire (tramas, firma, ACK) | `nucleo/src/enlace/lora/Trama` |
| Interfaz de radio y driver SX127x (header-only) | `enlace/lora/Radio.h`, `RadioSx127x.h` |
| Nodo: implementa `Enlace` | `enlace/EnlaceLora` |
| Extremo receptor (lo reusa el gateway) | `enlace/lora/ReceptorLora` |
| Sketch del nodo (placa del prototipo: AHT10, batería, humedad de suelo) | `esp/prueba_lora/` |
| Receptor de banco (imprime y contesta) | `esp/receptor_lora/` |

El nodo usa `cicloBateria` sin cambios: sólo cambia el enlace. Lo único que tocó el núcleo
es que cada `Enlace` declara su `politicaReintento()`: el backoff de 10 min a 1 h existe
porque un intento WiFi fallido son ~10 s de radio; en LoRa son ~2 s, así que reintenta en
cada contacto.

**Fase 2, pendiente: backend.** Tabla de gateways, qué dispositivos cuelgan de cada uno,
id corto y clave de enlace por dispositivo, y un endpoint donde el gateway manda las tramas
tal cual para que el backend verifique la firma de cada nodo.

**Fase 3, pendiente: gateway real.** `ReceptorLora` + `EnlaceWifi` en un ciclo enchufado.
Tiene que escuchar por interrupción (DIO0) y no por sondeo: mientras hace un POST no oye, y
el SX127x guarda un solo paquete. Además contesta el ACK antes de que el backend confirme,
así que tiene que guardar las tramas en flash hasta que el backend las acepte, o el nodo
borra datos que nunca llegaron.

## Radio

915 MHz, SF7, 125 kHz, CR 4/5, 17 dBm, CRC encendido, sync word `0xB1`. Los dos extremos
tienen que coincidir en todo; viven en `ConfigSx127x` del sketch. El sync word propio
filtra las redes privadas por default (`0x12`) y LoRaWAN (`0x34`). Pines de la placa del
prototipo: SCK 18, MISO 21, MOSI 19, CS 17, RST 33, DIO0 15 (no chocan con el I2C 22/23).

Librería `LoRa` de Sandeep Mistry (0.8.0), la del prototipo. Instalarla una vez:
`arduino-cli lib install LoRa` con el sketchbook como directorio de usuario.

**Falta verificar con ENACOM** potencia y ocupación permitidas en 915 MHz antes de vender.

## Tramas (v2)

Todo little-endian. Cada trama termina en un MAC: HMAC-SHA256 con la clave de enlace del
nodo (16 B) sobre todos los bytes anteriores, truncado a 8 B.

**Datos** (nodo → receptor), 17 + 9 × n bytes, n ≤ 16:

| Offset | Largo | Campo |
|---|---|---|
| 0 | 1 | magic `0xB2` (Bitácora, versión 2) |
| 1 | 1 | tipo `0x01` |
| 2 | 2 | id del nodo |
| 4 | 2 | contador |
| 6 | 2 | batería en mV; `0xFFFF` = sin batería o sin lectura |
| 8 | 1 | n, cantidad de puntos |
| 9 | 9 × n | punto: índice de sensor (1), valor float32 (4), epoch (4; 0 = sin fecha) |
| 9 + 9n | 8 | MAC |

**ACK** (receptor → nodo), 23 bytes:

| Offset | Largo | Campo |
|---|---|---|
| 0 | 1 | magic `0xB2` |
| 1 | 1 | tipo `0x02` |
| 2 | 2 | id del nodo |
| 4 | 2 | contador de la trama que confirma |
| 6 | 1 | flags: bit 0 = trae hora, bit 1 = trae intervalos |
| 7 | 4 | `server_epoch` |
| 11 | 2 | `intervalo_sugerido_seg` |
| 13 | 2 | `intervalo_contacto_seg` |
| 15 | 8 | MAC |

Tiempo en el aire a SF7: trama vacía (heartbeat) ~51 ms, trama llena (16 puntos, 161 B)
~261 ms, ACK ~62 ms.

La batería va en el encabezado y no como punto: es un dato del dispositivo, no una
medición (ver CLAUDE.md). Se lee una vez por contacto y viaja igual en todos sus lotes.
Viaja en mV y no en %: la curva vive en el backend (v1 mandaba 1 byte de %).

## Cómo se usa

- El nodo transmite y escucha el ACK 1,5 s. Sin ACK reintenta hasta 3 veces, con una espera
  al azar de 100–800 ms para no volver a chocar con otro nodo. Peor caso por lote: ~7 s.
- El ACK trae la hora: es el mismo mecanismo que `server_epoch` en WiFi. El ciclo ya manda
  un lote vacío para anclar antes de drenar, así que en el primer contacto el nodo pide
  la hora y recién después manda datos fechados.
- **El contador no es anti-replay**, sólo empareja cada ACK con su trama. Arranca al azar
  en cada power-on. Una trama repetida no hace daño: el backend descarta lecturas con el
  mismo `(sensor_id, time)`. Los reintentos repiten trama y contador a propósito.
- El receptor descarta en silencio lo que no reconoce (otra red, otro nodo, firma
  inválida) y lo cuenta en `rechazadas()`.

## Limitaciones de la fase 1

- **Sin diag:** no entra en la trama. Hay que definir un subconjunto compacto o una trama
  de diag aparte cada tanto.
- **Sin reglas en el ACK:** el nodo LoRa no adelanta el envío ante un cruce. Las alertas
  igual se evalúan en el backend con cada lote, pero con la latencia del intervalo de
  envío (5 min por default) en vez de la del muestreo. Hacen falta tramas de configuración
  (8 reglas no entran en un ACK).
- **El receptor de banco no tiene hora real:** contesta con la de compilación, local y
  tomada como UTC, así que las fechas salen corridas unas 3 h. Alcanza para probar el aire.
- **Claves de banco:** la misma clave de prueba está en los dos sketches. Las reales van a
  salir del backend en la fase 2.

## Prueba en banco

1. Flashear `esp/receptor_lora` en una placa y abrir el monitor serie.
2. Flashear `esp/prueba_lora` en la otra (la del AHT10).
3. En el nodo: `[LORA] Trama ... intento 1` seguido de `[LORA] ACK ..., RSSI ...`. El primer
   contacto manda un lote vacío y después los datos.
4. En el receptor: `[RX] Nodo 1, trama ..., ACK enviado` y las mediciones con su epoch.
5. Apagar el receptor unos minutos: el nodo tiene que mostrar `Sin ACK del receptor`,
   seguir midiendo y, al volver el receptor, drenar todo lo acumulado.
