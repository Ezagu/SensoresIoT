# Diseño de la app de cliente — referencia de implementación

Rediseño aprobado de `app.dominio`. Esta carpeta es la fuente de verdad para implementarlo: el canvas de origen sigue vivo y puede cambiar, esta copia no.

- `capturas/*.png` — cómo se tiene que ver cada pantalla (tema oscuro).
- `pantallas/*.html` — la misma pantalla en HTML+CSS estático. Sirve para leer medidas, espaciados y colores exactos, y se abre directo en el navegador (los links entre pantallas funcionan). Para ver el tema claro, cambiar `data-theme="oscuro"` por `data-theme="claro"` en el elemento raíz.

**El HTML es referencia, no código para copiar.** Se porta a los componentes React + Tailwind que ya existen (`components/ui`, `components/layout`), con los tokens de `src/index.css`. Los datos de las pantallas son de ejemplo.

## Pantallas

| Captura | Qué es | Ruta / feature actual |
|---|---|---|
| `Panel-calma` | Panel, todo en orden | `/` · `features/panel` |
| `Main` | Panel con un crítico y un equipo sin reportar | `/` |
| `Panel-variado` | Panel con equipos de configuraciones distintas (1 a 7 sensores) | `/` |
| `Dispositivo` | Detalle de equipo (2 sensores) | `/dispositivos/:id` |
| `Equipo-complejo` | Detalle de equipo con 7 sensores, batería y alerta | `/dispositivos/:id` |
| `Sensores-sistema` | Detalle con 1, 2, 3, 4 y 6 sensores, con y sin batería | `/dispositivos/:id` |
| `Energia` | Estados de batería | componente del detalle |
| `Sensor` | Detalle de sensor: gráfico, métricas, eventos, lecturas | `/dispositivos/:id/sensores/:sensorId` |
| `Registro` | Registro global de eventos | `/avisos` · `features/alertas` (ver conflicto 1) |
| `Reglas` | Pestaña de reglas del registro | ver conflicto 1 |
| `Vincular` | Vincular equipo | `/vincular` |
| `Informe` | Modal "Generar informe" (PDF) | no existe (conflicto 2) |
| `Ajustes-equipo` | Ajustes del equipo | `/dispositivos/:id/ajustes` |
| `Ajustes-cuenta` | Tu cuenta | `/ajustes` |
| `Login`, `Registro-cuenta` | Ingresar y crear cuenta | `/login`, `/registro` |
| `Recuperar`, `Recuperar-enviado`, `Nueva-clave` | Recuperación de contraseña | no existe (conflicto 4) |
| `No-encontrada` | 404 | hoy `*` redirige a `/`; hay que cambiarlo por esta página |
| `Movil-*`, `Login-movil` | Versiones mobile (390 px) | mismas rutas |
| `Tablet-equipo`, `Login-tablet` | Versiones tablet (834 px) | mismas rutas |

## Sistema visual

**Tipografía:** Instrument Sans (400/500/600/700) para todo, e IBM Plex Mono (400/500) sólo para micro-etiquetas en mayúsculas (`HOY 19:08`, `ÚLTIMAS 2 H`, ejes). Los números van con `font-variant-numeric: tabular-nums`, peso 600 y `letter-spacing: -.015em`.

**Paleta.** Las variables de la columna "Diseño" se declaran en cada HTML y hay que mapearlas a los tokens de `index.css`. **El oscuro es el tema por defecto.**

| Diseño | Oscuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0E1618` | `#F3F0E9` | fondo de página |
| `--rail` | `#111A1C` | `#ECE8DF` | barra lateral de equipos |
| `--raise` / `--panel` | `#1B2628` / `#131C1E` | `#FFFFFF` / `#FBFAF6` | superficies elevadas, modales, panel de login |
| `--line` | `rgba(232,238,236,.13)` | `rgba(20,32,31,.14)` | bordes de controles y tarjetas |
| `--soft` | `rgba(232,238,236,.065)` | `rgba(20,32,31,.07)` | separadores |
| `--text` / `--dim` / `--faint` | `#E8EEEC` / `#A3AFB0` / `#7C898C` | `#14201F` / `#4C5A5C` / `#66737A` | tres escalones de texto |
| `--accent` | `#4BA6B4` | `#0A5C6B` | relleno primario, foco |
| `--accent-2` | `#86C5CE` | `#146272` | links y texto de acento |
| `--accent-ink` | `#04181D` | `#FFFFFF` | texto sobre `--accent` |
| `--ok` | `#6FB491` | `#268056` | en línea |
| `--amber` | `#DCAD52` | `#8C5A06` | con retraso / atención / batería baja |
| `--warn` / `--warn-mark` | `#F09189` / `#E89A92` | `#8F2C24` / `#9E332B` | crítico (texto / glifo) |

Antes de reemplazar los valores de `index.css` hay que re-verificar el contraste: los tokens actuales están calibrados a AAA y los del diseño no se midieron con ese criterio.

**Glifos de estado.** La forma lleva el significado; el color lo refuerza.

| Estado | Glifo | Clase en el HTML |
|---|---|---|
| En línea | círculo lleno `--ok` | `.g-ok` |
| Crítico (alerta disparada) | cuadrado `--warn-mark`, pulso de opacidad 2,4 s (sin pulso con `prefers-reduced-motion`) | `.g-crit` |
| Con retraso / atención | rombo `--amber` | `.g-late` |
| Sin reportar | anillo `--dim` | `.g-off` |

## Reglas de producto que el diseño ya resolvió

1. **La barra lateral de equipos reemplaza al sidebar.** Primero "Todos los equipos" con el resumen, después un renglón por equipo con su glifo y su estado en una línea.
2. **El panel es un resumen.** Arriba va una frase de estado ("2 equipos requieren atención. Los otros 6, en orden."). Después, un bloque por cada equipo crítico, con valor, límite y un gráfico rotulado con sensor, unidad y período. Por último, una grilla de tarjetas.
3. **Cada tarjeta de equipo es autónoma** y muestra sólo los sensores que el equipo tiene. No hay columnas globales ni huecos por sensores que falten.
   - Hasta 4 sensores se ven todos, en una grilla interna de 2 columnas. Con 1 sensor, el valor ocupa todo el ancho.
   - Con más de 4 se muestran 4 y un pie "3 sensores más: UV, Humedad del suelo y Batería".
   - Orden: primero el sensor con problema y después el orden del equipo. **Los sensores fijados no influyen en el panel.**
   - Cada sensor lleva el ícono de la landing (los paths están en el HTML), el nombre y el valor con su unidad.
4. **Grilla del panel:** 3 columnas en escritorio y 1 en mobile. Las tarjetas de una misma fila tienen la misma altura. Van primero las que necesitan atención.
5. **No hay gráficos en el panel** salvo el del bloque crítico, y ese siempre dice sensor, unidad y período.
6. **Los sensores no tienen categorías** (nada de Aire, Suelo o Luz).
7. **Detalle de equipo:**
   - Si hay un sensor en alerta, sube arriba con su gráfico.
   - Después van los "Fijados" (sin límite de cantidad).
   - Después "Otros sensores" en lista: nombre, estado, gráfico chico de 24 h, valor y botón para fijar.
   - Fijar lo pueden hacer dueño y editor. El viewer ve los fijados pero no puede cambiarlos.
8. **Batería:** sólo porcentaje más estado (Descargando / Estable / Cargando / Cargando con solar).
   - Por debajo del 20 % pasa a ámbar; por debajo del 10 %, a rojo con la acción a tomar.
   - Sin autonomía estimada ni historial de carga.
   - Si el equipo no tiene batería, no se muestra nada.
9. **Ajustes del equipo:** sólo configuración real: identificación con ubicación y descripción opcionales, muestreo, notificaciones y accesos. No tiene sección de sensores. En la cuenta, la foto y el email no se pueden editar.
10. **Acceso:** formulario centrado, sin ilustración, sólo la marca arriba a la izquierda.
11. **404:** un "404" grande más una barra de direcciones. `/equipos/` baja a una página que existe; el segmento mal escrito baja con línea punteada a una página vacía. No usar metáforas de señal, conexión ni batería.

## Conflictos con el repo — decidir antes de implementar

1. **"Registro" y la pestaña "Reglas" chocan con `CLAUDE.md`.** Ahí la pantalla global se llama **Avisos** (`/avisos`), es de sólo lectura, y las reglas se administran únicamente en el detalle del equipo. Recomendación: implementar `Registro` como `/avisos`, con el nombre "Avisos" y sin la pestaña `Reglas`, que queda descartada.
2. **Informe PDF (`Informe`).** Es el Tier 4.6: no hay backend (ni render ni scheduler). La pantalla queda lista para cuando se construya; no conectar botones a algo que no existe.
3. **"Continuar con Google".** OAuth está diferido explícitamente en `CLAUDE.md`. No implementar el botón hasta que se retome.
4. **Recuperar contraseña.** No hay endpoint. Esas tres pantallas dependen de construirlo en el backend: token de un solo uso con vencimiento y mail por Resend.
5. **Sensores fijados.** Necesitan persistencia en el backend: un campo por sensor o una lista por equipo, editable por dueño y editor. Es un cambio de schema, no una entidad nueva.
6. **Batería.** El estado se deriva comparando la lectura actual con la anterior, con tolerancia. "Con panel solar" requiere saber que el equipo lo tiene. Ninguna de las dos cosas existe hoy.
7. **Estado "Atención"** (ámbar, `Panel-variado`). No es uno de los tres estados del equipo. Está representado como "un sensor sin lecturas recientes" (`lecturaDesactualizada`), que ya se calcula en el front. Hay que confirmar que ese es el criterio.
8. **Cuenta.** "Eliminar cuenta", "Sesiones abiertas" y "Google: sin vincular" no tienen backend. Eliminar cuenta además toca el pendiente legal de borrado de datos.
9. **Ubicación y descripción** ya existen en `dispositivos` (`db/init.sql`), así que eso no requiere migración.

## Orden sugerido

1. Tokens y tipografía en `index.css`, con verificación de contraste.
2. Layout: barra lateral de equipos más la barra superior, y el selector de equipos en mobile (`Movil-equipos`).
3. Panel: frase de estado, bloque crítico y tarjetas.
4. Detalle de equipo y detalle de sensor.
5. Avisos, vincular y ajustes de equipo y de cuenta.
6. Login, crear cuenta y 404.
7. Lo que depende de backend nuevo (conflictos 2 a 6 y 8), sólo cuando exista.
