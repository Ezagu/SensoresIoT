# Diagnóstico de hardware: el sensor I2C deja de responder

Documento autocontenido para quien haga las pruebas con instrumental. No hace falta
saber nada del firmware.

## Estado

- **22/09/2026 — resuelto: un pad medio desoldado del módulo del sensor.** Explicaba
  todo lo de abajo (lecturas perfectas, NACK permanente, dos sensores fallando igual,
  sólo revivía cortando la alimentación). La lista de descartes sigue valiendo.
- **29/09/2026 — reapareció 3 h, sin reproducir todavía.** Minutos después de mover
  el equipo de lugar (20:23 UTC) una misma lectura trajo temperatura buena y presión
  fuera de rango; desde ahí, NACK en los 549 despertares siguientes (uno cada 20 s)
  hasta que **volvió solo a las 23:24, sin cortar la alimentación**. El ESP no se
  reinició: el cronómetro y el buffer siguieron corridos. Un sensor trabado no se
  recupera solo; un contacto que se abre y se vuelve a cerrar sí, así que apunta de
  nuevo al camino mecánico. Siguiente paso: la prueba 5 sobre el pad ya resoldado y
  la bornera.

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
I2C-SCL=IO23` por un cable de 4 hilos de **7 cm como mucho** que termina en un
conector. Con ese largo la capacitancia del cable no es sospechosa: el eslabón débil
es mecánico (bornera, conector, soldaduras).

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
unos 45 kΩ — flojos para I2C incluso con cable corto. **Agregar 2,2 a 4,7 kΩ a 3,3 V en
SDA y en SCL, lo más cerca posible del sensor.**

### 4. Desacople en el sensor

Verificar que haya **100 nF entre VCC y GND pegados al módulo del sensor**, y de ser
posible sumar 10 µF. Un sensor al final de un cable sin desacople local se hunde
con su propio pico de corriente al convertir, que es compatible con "anda dos
lecturas y se cae".

### 5. Movimiento con el equipo corriendo (la prueba que zanja)

Con `esp/diagnostico_bmp` corriendo y el monitor serie abierto, mover el cable,
apretar el módulo, tocar los tornillos de la bornera y repetir el traslado que se
hace al dejarlo midiendo. Un solo `NACK` mientras se mueve algo ubica el punto.
Si no aparece, conectar el sensor soldado directo a los pines, sin bornera ni
conector: si así aguanta indefinidamente, el problema está en ese camino.

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
