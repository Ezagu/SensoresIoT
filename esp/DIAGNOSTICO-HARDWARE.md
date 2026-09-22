# Diagnóstico de hardware: el sensor I2C deja de responder

Documento autocontenido para quien haga las pruebas con instrumental. No hace falta
saber nada del firmware.

## El síntoma, medido

El sensor (primero un AHT10, después un BMP180 — **los dos hacen lo mismo**) entrega
2 o 3 lecturas perfectas después de conectar la alimentación y luego deja de
responder **para siempre**. Sólo revive cortando y reponiendo la alimentación.

Lo que ya está descartado por medición, para no repetirlo:

- **No es el chip.** Cuando contesta, los datos son exactos: 9 de los 11
  coeficientes de calibración de fábrica del BMP180 volvieron bit a bit idénticos a
  los conocidos buenos. Dos sensores distintos, de fabricantes distintos y con
  protocolos distintos, fallan igual.
- **No es ruido ni integridad de señal.** No hay valores intermedios ni corruptos:
  o contesta impecable, o no contesta.
- **No es la velocidad del bus.** Probado a 100, 50 y 25 kHz: idéntico.
- **No es el bus colgado.** Con el sensor mudo, SDA y SCL están en reposo **altas**,
  o sea libres. Se probó además una rutina de destrabe (9 pulsos de SCL) y nunca lo
  revivió.
- **No es el firmware.** Falla igual con tres programas distintos y con acceso I2C
  directo sin librería.

Queda: **la alimentación o el contacto del módulo del sensor.**

## El montaje

PCB propia de AC Electrónica con módulo ESP32-WROOM. El sensor **no está sobre la
placa**: cuelga de la bornera a tornillo rotulada `I2C-SDA=IO22 / 3.3V / GND /
I2C-SCL=IO23` por un cable de 4 hilos de unos 20-30 cm que termina en un conector.

## Pruebas, en orden

### 1. Tensión en el extremo del cable, con el equipo corriendo

Medir **3,3 V entre VCC y GND del módulo del sensor**, en el extremo del cable, no
en la placa. Dos veces:

- **Recién conectada la alimentación**, mientras el sensor todavía responde.
- **Después de que dejó de responder** (unos 10-20 segundos).

| Resultado | Conclusión |
|---|---|
| Cae por debajo de ~3,0 V | Camino de alimentación. Seguir por 2 y 4. |
| Se mantiene en 3,3 V | La alimentación llega: seguir por 2 (contacto) y 5 |

Si hay osciloscopio, mirar el riel durante los primeros segundos: lo que interesa
son hundimientos breves, no el valor promedio.

### 2. Continuidad de los 4 hilos, punta a punta

Con el equipo **desconectado**, medir resistencia de cada hilo entre la bornera y el
conector del sensor. Tiene que dar prácticamente 0 Ω.

Hacerlo **moviendo el cable y tocando los tornillos de la bornera**. Cualquier valor
que salte o que no sea casi cero es un contacto flojo o un hilo prensado sobre el
aislante en vez del cobre. Es la causa más probable de todo esto.

### 3. Resistencias de pull-up del bus

Verificar si el módulo del sensor trae las suyas (dos resistencias chicas al lado de
los pines I2C) y de cuánto son. Con el equipo desconectado, medir de SDA a VCC y de
SCL a VCC.

Si **no tiene**, el bus funciona sólo con los pull-ups internos del ESP32, que son de
unos 45 kΩ — insuficientes para 20-30 cm de cable. **Agregar 2,2 a 4,7 kΩ a 3,3 V en
SDA y en SCL, lo más cerca posible del sensor.**

### 4. Desacople en el sensor

Verificar que haya **100 nF entre VCC y GND pegados al módulo del sensor**, y de ser
posible sumar 10 µF. Un sensor al final de un cable largo sin desacople local se
hunde con su propio pico de corriente al convertir, que es compatible con "anda dos
lecturas y se cae".

### 5. Cable corto (la prueba que zanja)

Conectar el sensor con **5-10 cm** directo a los pines, sin la bornera ni el cable
largo. Si así aguanta indefinidamente, el problema está en ese camino y no en el
sensor.

### 6. De dónde sale el riel de 3,3 V del sensor

Verificar si el sensor cuelga del mismo regulador que alimenta la radio del ESP32.
Si es así, cada arranque de WiFi le mete un pico al riel del sensor.

Relacionado y ya documentado aparte: **el equipo hace brownout al encender la
radio** (`E BOD: Brownout detector was triggered`, siempre justo antes de conectar).
El arreglo pendiente es cable corto a un puerto directo y un electrolítico de
**470-1000 µF entre 3V3 y GND lo más cerca posible del módulo**. Conviene resolver
las dos cosas juntas: son la misma familia de problema.

## Cómo verificar que quedó arreglado

Flashear `esp/diagnostico_bmp` y abrir el monitor serie a 115200. Tiene que dar
`plausible` indefinidamente:

```
vuelta | dir  | UT     | UP     | temp cruda
     1 | ACK  | 0x7BD7 | 0xAE8E | plausible
     2 | ACK  | 0x7BD9 | 0xAE8B | plausible
```

Cien vueltas seguidas sin un `NACK` cierra el tema.
