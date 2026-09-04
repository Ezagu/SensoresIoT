---
target: critique and audit (app de consumo, flujo del detalle de dispositivo)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\agust\\Desktop\\Proyectos\\SensoresIoT\\frontend\\src\\features\\dispositivo\\DetalleDispositivo.tsx"
target_fingerprint: "sha256:05937c17cc336dcd1512a5d47da5f4c872502e174a02dff4490869ff2bd5a271"
target_path: "C:\\Users\\agust\\Desktop\\Proyectos\\SensoresIoT\\frontend\\src\\features\\dispositivo\\DetalleDispositivo.tsx"
timestamp: 2026-09-04T06-10-20Z
slug: nd-src-features-dispositivo-detalledispositivo-tsx
---
Method: dual-agent (A: revisión de diseño · B: detector + navegador)

Objetivo: `frontend/src/features/dispositivo/DetalleDispositivo.tsx` y el flujo Panel → dispositivo → sensor. Modo: Operate.

## Design Health Score

| # | Heurística | Score | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | `BloqueExport.tsx:47-50` arma el mensaje de recorte en `partes` y nunca lo renderiza; el export baja sin ninguna señal. `DetalleDispositivo` nunca expone `graficos.refrescando`. |
| 2 | Correspondencia con el mundo real | 3 | "Alertas activas" en el panel cuenta *disparadas*, pero `alerta.activa` significa *habilitada* (`FilaAlerta.tsx:50` pinta un pill "Inactiva"). Una palabra, dos sentidos. |
| 3 | Control y libertad | 2 | El zoom es sólo mouse (`usarZoomGrafico.ts`: mousedown/move/up + ctrl-wheel). En celular el gráfico es inerte. |
| 4 | Consistencia y estándares | 2 | `sin-reportar` es `danger` en `Pill.tsx:28` y `warn` en el KPI de `Panel.tsx:131`, para la misma condición. |
| 5 | Prevención de errores | 2 | `esquemaIntervalo` (`formularios.ts:52`) valida sólo entero > 0; el form es `noValidate`, así que un free que escribe 15 s recibe un 400 del backend en vez de la explicación del plan. |
| 6 | Reconocer antes que recordar | 3 | El zoom es indescubrible: "Restablecer zoom" recién aparece después de descubrirlo por accidente. |
| 7 | Flexibilidad y eficiencia | 2 | Rango y zoom viven en `useState`, nunca en la URL. No se puede mandar un link a lo que uno está viendo. |
| 8 | Estética y minimalismo | 2 | Eje Y anclado en 0: una serie de 19,9–20,4 °C ocupa el 15% superior de 384px y el resto es degradado naranja. |
| 9 | Recuperación de errores | 3 | La escalera 404/403/genérico de `ErrorDeCarga` es buena, pero `usarDetalleDispositivo.ts:49` traga el fallo de fetch por sensor a `null` y se renderiza como "El dispositivo no reportó nada en el rango seleccionado" — un error de red presentado como afirmación sobre los datos. |
| 10 | Ayuda y documentación | 1 | Nada explica los tres estados, ni qué abarca "En tiempo real" (1 h), ni que **nadie va a avisar** si un equipo deja de reportar. Los cuatro caminos de "saber más" (`/plan`, `/alertas`, `/dispositivos`, `/vincular`) son stubs vacíos. |
| **Total** | | **22/40** | **Aceptable — trabajo significativo pendiente** |

## Veredicto de especificidad

**La lógica está autorada para este producto. La superficie no.**

Evidencia de autoría real: `lib/tiempo.ts:estadoDispositivo` deriva tres estados con umbrales de 3× y 12× el intervalo *propio del equipo*, no un timeout fijo, y `TarjetaDispositivo.tsx:14` excluye `retraso` de `ESTADOS_APAGADOS` para que un equipo bufferizando no parpadee. `lib/series.ts` corta el trazo con `FACTOR_HUECO = 1.8` contra el paso declarado por el backend, y `Grafico.tsx:renderPunto` dibuja un círculo para una lectura huérfana entre dos huecos. `lib/sensores.ts` mapea tipo→hue por nombre normalizado con `desconocido` como caso de primera clase. `Panel.tsx:15` se niega a mostrar deltas porcentuales "porque el cero de la escala es arbitrario". Nada de eso lo escribe alguien que no miró series reales.

Evidencia genérica: el sistema visual de `index.css` es el dark-SaaS default de 2024 — fondo `#0b0d12`, superficies `#12151d`, acento azul `#6c93ff`, cards de 12px, `shadow-sm`, franja de tres KPIs, áreas con degradado. Cambiando "Temperatura/Humedad" por "MRR/Churn" no se rompe un solo componente. Nada en pantalla sabe que esto es equipamiento físico en un campo, una cámara o una oficina: `ubicacion` —el dato operativamente más importante de un sensor— es una línea gris de 11px con un pin. La única decisión con voz propia es el pareo tipográfico: Space Grotesk sobre IBM Plex Mono con `tabular-nums` en `.num`, y ahí sí las lecturas se leen como instrumental.

La ironía es que la cáscara daña el razonamiento: el eje Y anclado en cero destruye exactamente la señal que toda la lógica de huecos existe para preservar.

## Scan determinístico

CLI (`detect.mjs --json frontend/src`): **0 hallazgos en 67 archivos, exit 0**. No es un aprobado: el motor CLI matchea literales en el fuente y este código no tiene ninguno — es justo lo que garantiza la regla "nunca un color literal en un componente". Se verificó con un archivo de control que el motor sí dispara sobre `.tsx`.

En navegador, sobre estilos computados: **10 hallazgos en el panel, 23 en el detalle de dispositivo**. 19 verificados de 23 en el detalle; 9 de 10 en el panel.

- `undersized-ui-text` ×12 verificados — `--text-tag: 10.5px` (`index.css:69`) en pills de estado, etiquetas prom/mín/máx (`Stat.tsx:4`) y encabezados de grupo de la sidebar (`Layout.tsx:125`). Decisión de escala deliberada, pero la medición es correcta.
- `low-contrast` — el hallazgo sistémico: `--color-text-faint` da **3.11:1 en oscuro y 3.10:1 en claro** contra `surface`, y se usa como texto normal en ~17 archivos. Falla AA en los dos temas.
- `low-contrast` — avatar "AC": blanco sobre `--color-avatar-from` = **3.7:1**, y peor contra el extremo `to` del degradado (`Layout.tsx:160`).
- `tiny-text` ×2 verificados — `--text-note: 11px` en copy de ayuda (`Campo.tsx:41`) y en el KPI "Dispositivos con problemas" (`Panel.tsx:34`).
- `nested-cards` ×2 verificados — `ResumenStats` pinta card dentro de la card de sensor.
- `cramped-padding` — `Segmentado.tsx:25` es `p-0.5` (2px): los segmentos quedan pegados al borde del grupo.
- Falsos positivos: `overused-font` (Space Grotesk es display acotado, no default perezoso) y 4 `undersized-ui-text` del bottom nav `lg:hidden`, ocultos a 1568px — **pero visibles y a 10.5px en mobile, donde no se corrió la pasada**.

Contraste por token, calculado (no medido sobre elementos en transición):

| Par | Oscuro | Claro |
|---|---|---|
| text / surface | 15.27 | 17.93 |
| text-muted / surface | 6.14 | 5.88 |
| **text-faint / surface** | **3.11** | **3.10** |
| accent / surface | 6.30 | 5.56 |
| danger / surface | 5.34 | **4.57** |
| **ok / surface** | 7.75 | **3.51** |
| **warn / surface** | 8.86 | **3.74** |

El tema claro es el que está peor: `ok` y `warn` caen a ~3.5 y son justamente los colores de los pills de estado del equipo, a 10.5px.

## Overlays

Hay overlays visibles ahora mismo en la pestaña **[Human]** de Chrome, sobre `/dispositivos/5e97ef75-…` en tema oscuro: 23 marcadores dorados sobre los nodos detectados. Sobrevivieron al apagado del server auxiliar. La consola de la app está limpia: 3 mensajes, cero errores.

## Impresión general

Esto es un producto con muy buen criterio de datos y una capa de presentación que todavía no se puso a la altura. El backend y los helpers razonan sobre lecturas reales con una precisión que casi no se ve en la industria a esta escala; la pantalla, en cambio, contesta tarde y a veces se contradice: el panel pinta un sensor en rojo con campana y el detalle del mismo sensor lo muestra en blanco bajo un pill verde "En línea". La oportunidad más grande no es estética, es de jerarquía: **la página del dispositivo nunca contesta en un solo lugar la única pregunta por la que alguien la abre** — "¿está bien mi equipo?".

## Lo que funciona

1. **`estadoDispositivo` y la regla de no apagar `retraso`.** Tres estados derivados del intervalo propio del equipo, con `TarjetaDispositivo.tsx:14` impidiendo que un equipo bufferizando se grisee. El principio "silencio no es falla" está codificado en dos archivos, no declarado en un doc, y los comentarios explican el porqué.
2. **El tratamiento del hueco.** `connectNulls={false}`, un null intercalado al medio de todo hueco mayor a 1.8× el paso declarado, y un círculo explícito para la lectura sin vecinos — porque un tramo de un punto no dibuja nada. Eso lo escribe alguien que vio una serie renderizar mal.
3. **Los dos tonos de acento y el campo deshabilitado.** `--color-accent` para texto/foco y `--color-accent-strong` para relleno, documentado con la justificación de 4.5:1; y `Campo.tsx` hunde la superficie en vez de bajar opacidad, para que el valor informativo del piso del plan siga legible. Razonamiento de contraste aplicado a una situación concreta, no una regla de lint.

## Problemas prioritarios

### [P1] El eje Y anclado en cero borra la señal en todos los gráficos
`Grafico.tsx:94-100` no fija `domain` en `<YAxis>`, así que Recharts usa `[0, dataMax]`. Medido: una serie de 19,9–20,4 °C queda como una línea plana en el 15% superior de 384px, con el 85% restante en degradado naranja. La línea de umbral punteada queda pegada al trazo y se lee como ruido.
**Por qué importa**: es el artefacto central del producto y hoy no puede mostrar lo que el cliente compra el sensor para ver — una deriva de 2 °C en una cámara, una rampa de humedad en un silo. El propio código ya argumenta esta posición en `Panel.tsx:15` ("el cero de la escala es arbitrario") y después ancla todos los gráficos en ese cero. Todo el trabajo de huecos de `series.ts` es invisible a esa escala.
**Fix**: dominio derivado de los datos con ~10% de aire, unido con `umbral ± histeresis` cuando hay regla activa. Mantener el anclaje en cero sólo para tipos de escala de razón (luz, ruido, CO₂), usando `claveDeTipo` que ya existe.
**Comando**: `/impeccable polish`

### [P1] La señal de alarma se pierde al bajar del panel al detalle
`TarjetaDispositivo.tsx:19-40` pinta el valor en `text-danger` con `IconoAlerta` cuando `sensor.disparada`. `BloqueSensor.tsx`, un click más adentro, recibe `alertas` pero usa `reglaDestacada` **sólo** para la línea de umbral: el valor queda en `text-text`, sin pill ni ícono. `DetalleSensor.tsx` no muestra estado de alerta en absoluto. Observado: el panel mostraba 73,6 % y 19,9 °C en rojo con campanas; el detalle mostraba las mismas lecturas en blanco bajo un pill verde "En línea", con dos reglas disparadas más abajo en la misma página.
**Por qué importa**: el drill-down tiene que *explicar* la vista general, no contradecirla. Alguien que clickeó *porque* el panel estaba rojo llega a una página cuyo elemento más fuerte dice que está todo bien. Para cadena de frío eso es la diferencia entre actuar y no actuar.
**Fix**: (a) aplicar en `BloqueSensor` el mismo `tonoValor` que ya usa el panel cuando `reglaDestacada(...)?.estado === 'disparada'`, más un `<Pill tono="danger">` al lado del nombre; (b) un pill a nivel dispositivo junto al de conectividad, derivado de `alertas` que ya está en scope en `DetalleDispositivo.tsx:78`; (c) espejar ambos en `DetalleSensor`.
**Comando**: `/impeccable polish`

### [P1] `--color-text-faint` falla AA en los dos temas, y los pills de estado fallan en el claro
3.11:1 en oscuro, 3.10:1 en claro contra `surface`, usado como texto normal en ~17 archivos (`Layout.tsx:125,170`, `Campo.tsx:41`, `Stat.tsx:20`, `BloqueSensor.tsx:68`, `DetalleSensor.tsx:108`, `DetalleDispositivo.tsx:110`, `BloqueHistorial.tsx:119,152`, `FilaAlerta.tsx:52`, `Panel.tsx:214`, `TooltipGrafico.tsx:19`, `Vacio.tsx:16`, `Cuenta.tsx:12`, `Ajustes.tsx:21,29`). Aparte, en tema claro `ok` cae a 3.51:1 y `warn` a 3.74:1 — y son los colores de los pills "En línea" / "Con retraso", renderizados a 10.5px.
**Por qué importa**: es incumplimiento WCAG AA (1.4.3) sistémico, en el token, no en un componente. Y toca justo el segmento agro, que mira el celular con sol directo.
**Fix**: subir `--color-text-faint` hasta ≥4.5:1 en ambos temas (en oscuro implica ~`#7d879b`), y oscurecer `ok`/`warn` del tema claro. Es una edición en `index.css` que arregla 17 archivos de una.
**Comando**: `/impeccable colorize`

### [P2] El recorte del plan y el inicio del historial son invisibles
Tres instancias de la misma omisión. (i) `DetalleDispositivo` pasa la ventana *pedida* a cada `Grafico`, nunca `datos.desde_efectivo`, y nunca lee `datos.recortado`. (ii) `BloqueExport.tsx:47-50` arma el mensaje de recorte en un `partes` que no se usa nunca. (iii) `usarZoomGrafico.ts:92` comenta que el recorte hacia atrás "ya lo hace el backend", así que el zoom es una puerta trasera documentada al candado de `SelectorVentana`, con recorte silencioso. Observado en una cuenta **premium**: el mismo gráfico con la mitad izquierda vacía, simplemente porque el historial arranca hace dos días.
**Por qué importa**: el Principio 3 dice que el límite es una puerta cerrada con la llave a la vista; hoy es un agujero sin marcar. Y el Principio 1 se cae: una región vacía significa indistintamente "el equipo estuvo mudo", "recién lo instalé", "mi plan no llega" o "todavía carga".
**Fix**: un componente compartido bajo `BarraVentana` alimentado por campos que ya llegan — cuando `recortado`, "Mostramos desde el {desde_efectivo} — tu plan retiene {retencion_dias} días" + "Ver planes"; cuando no está recortado pero `first_connected_at` es posterior al `desde` pedido, un marcador vertical "Instalado el {fecha}". Y renderizar el resultado del export, o borrar la variable.
**Comando**: `/impeccable clarify`

### [P2] Cambiar el rango pinta datos viejos sobre el eje nuevo, sin señal de carga
`desdeMs/hastaMs` salen de `ventana` y se actualizan sincrónicamente al click, mientras `graficos.porSensor` todavía tiene los puntos de la ventana anterior. `useCarga` mantiene los datos viejos a propósito, pero `DetalleDispositivo` nunca expone `graficos.refrescando` — a diferencia de `Panel.tsx:149`, que sí muestra "actualizando…".
**Por qué importa**: entre el click y la respuesta, una hora de lecturas se dibuja apretada en el 0,1% derecho de un eje de 30 días. Se ve exactamente igual que un equipo muerto durante un mes: una mentira temporal pero perfectamente convincente sobre los datos, en un producto cuyo primer principio es la credibilidad.
**Fix**: exponer `refrescando` en `BarraVentana` como hace `Panel`, y atenuar el área del gráfico (`opacity-60`, como ya hace `BloqueHistorial.tsx:124` con la tabla) mientras la ventana pedida y la renderizada no coinciden.
**Comando**: `/impeccable harden`

## Banderas rojas por persona

**Productor agropecuario, 55, celular parado al lado del silo.** `SelectorVentana` son **7 opciones** en un `Segmentado` que es `inline-flex shrink-0` sin contenedor de scroll: por medición de anchos, ~380–400px contra ~328px útiles en un viewport de 360px, así que "6m · 1a · Máx" se van de pantalla o fuerzan scroll horizontal de la página (derivado del código, no verificado en vivo). El gráfico es inerte al touch: no hay pinch ni drag. El valor grande actual desaparece apenas toca "7d" (`BloqueSensor.tsx:60`). Y el header sticky, lo único en pantalla tras dos scrolls, dice "Dispositivos", no el nombre del silo que tiene al lado.

**Operador de cadena de frío, turno noche.** El usuario de mayor riesgo del producto. Abre a las 03:00 porque algo no cierra: el pill del header dice "En línea" en verde mientras dos reglas están disparadas. Tiene que scrollear más allá de los dos gráficos para enterarse. Y no hay *cuándo* se disparó ni por cuánto tiempo: `FilaAlerta` muestra sólo "Último: 19,9 °C", y el historial de eventos existe en el backend (`GET /dispositivos/{id}/alertas/eventos`) sin renderizarse en ningún lado. Si en cambio el equipo se quedó mudo, recibe un pill rojo, N cajas idénticas de "El dispositivo no reportó nada…", ninguna causa, ningún próximo paso, y ninguna mención de que **nadie lo iba a llamar**.

**Responsable de mantenimiento de un edificio, 12 equipos en varios pisos.** `Panel` le da una grilla `xl:grid-cols-3` sin búsqueda, sin filtro y sin orden, y la única señal de "cuál está roto" es un KPI que dice "Dispositivos con problemas: 2" y no es clickeable ni dice cuáles. `ubicacion` —el piso, la sala, lo único por lo que él navega— es 11px `text-faint` debajo del nombre. `/dispositivos`, el ítem del nav que promete la lista completa, es un stub.

**Usuario de lector de pantalla / teclado.** `Segmentado` es un `role="radiogroup"` de botones sin `tabIndex` rotativo ni manejo de flechas: se anuncia como radios y no se comporta como tal. Los valores se actualizan por polling sin ninguna región `aria-live` (los `role="alert"` que hay son sólo para errores de formulario), así que nada se anuncia nunca. El gráfico es un SVG de Recharts con `role="application"` y sin alternativa textual: la carga entera de la página de sensor es inaccesible. Y hay información crítica que vive sólo en `title`: `BloqueAlertas.tsx:50` pone el "alcanzaste el límite de alertas" en el `title` de un botón `disabled`, que en la mayoría de los navegadores nunca dispara el hover — es inalcanzable para todo el mundo, no sólo para lectores de pantalla.

**Free evaluando si paga.** Toca un rango violeta bloqueado, llega a `/plan` y encuentra `<Vacio titulo="Plan" detalle="Tu plan actual y la comparación con Premium." />`. Intenta bajar el intervalo: `BloqueIntervalo` acepta cualquier entero positivo y le devuelve un 400 crudo. Exporta esperando su historial completo y recibe un CSV truncado en silencio. Tres momentos de upgrade, tres callejones sin salida.

## Observaciones menores

- `BloqueHistorial` muestra `fechaHora` con precisión de minuto para lecturas cada ~15–30 s: se observaron dos filas consecutivas con la misma fecha y el mismo valor, como si la tabla duplicara una fila. Falta el segundo.
- "Nunca conectado" (`ETIQUETA_ESTADO.nunca`) convive a centímetros de "Nunca reportó" (`DetalleDispositivo.tsx:121`) describiendo el mismo hecho con distintas palabras.
- `EsqueletoDetalle` renderiza siempre 2 cards aunque `sensoresBase.length` ya se conoce (`DetalleDispositivo.tsx:58`): salto de layout garantizado en equipos de 1, 3 o 5 sensores.
- La etiqueta del `ReferenceLine` de umbral usa `insideTopLeft` y colisiona con los ticks del eje y con el trazo. Además omite la unidad ("> 20", no "> 20 °C").
- No hay unidad en el eje Y en ningún gráfico.
- Las acciones de la fila de alerta (`Notificándome` / `Editar` / `Borrar`) son `<button>` pelados con clases ad-hoc en vez de variantes de `Boton`, y la destructiva tiene el mismo peso visual que las otras. El borrado confirma con `window.confirm`, el único diálogo de la app que no es el `Modal` basado en `<dialog>`.
- `Modal` es `w-[min(92vw,420px)]` sin `max-h` ni `overflow-y`: un formulario más alto que el viewport (la alta de alerta en un celular apaisado) se corta.
- `Panel` con `xl:grid-cols-3` y un solo dispositivo —el caso realista— deja dos tercios de 1360px vacíos, con tres KPIs a todo el ancho arriba. La jerarquía queda invertida: el chrome pesa más que el producto.
- `IconoAlerta` significa a la vez "la función alertas" en el nav y "está sonando" en el panel.
- No se actualiza el `<title>` por ruta: todas las páginas son "Bitácora", así que las pestañas y el historial del navegador son indistinguibles.
- `Vacio` hace cinco trabajos: estado vacío, error, 404, 403 y **placeholder de pantalla sin construir**. El usuario no puede distinguir "todavía no hay nada" de "esto no lo construimos".

## Preguntas para pensar

1. **¿Y si la página del dispositivo abriera con un veredicto en vez de un gráfico?** Una línea — "Todo normal" / "2 alertas disparadas desde las 14:32" / "Sin reportar hace 3 h" — calculada con datos que ya están en scope en `DetalleDispositivo.tsx:78`. La pregunta real de todos los usuarios, contestada antes de que cargue un solo pixel de Recharts. ¿Qué sacarías para hacerle lugar?
2. **¿El selector de rango no debería separar las dos cosas que hoy mezcla?** "En tiempo real" es un *modo*; 24h/7d/30d/6m/1a/Máx son *lapsos*. Partirlo en un toggle vivo/histórico más un control de lapso arregla la fila de 7 opciones, arregla el desborde en mobile, y deja que la lectura actual sobreviva a un cambio de rango.
3. **La app conoce `first_connected_at`, `desde_efectivo`, `recortado`, `retencion_dias` y `bucket_seg`, y no dibuja ninguno. ¿Y si las regiones vacías del gráfico estuvieran anotadas en vez de en blanco?** El Principio 1 dice mostrar el hueco — pero un hueco sin explicar no es honestidad, es ambigüedad.
4. **Dado que no existe la alerta de "dejó de reportar" y no está en alcance, ¿la app no debería decirlo en voz alta?** Una línea honesta en la página del dispositivo es incómoda, diferencial, y consistente con el compromiso de "directo, sin relleno de marketing".
5. **¿Por qué la URL no lleva la vista?** Toda conversación de soporte de este negocio va a ser alguien describiendo un gráfico por teléfono. `?rango=30d` cuesta un `useSearchParams` y convierte "mandame una captura" en "mandame el link", en una empresa cuyo posicionamiento es que atiende un humano.
6. **`ubicacion` es el único campo que conecta un UUID con un lugar físico al que una persona camina. ¿Por qué es gris de 11px?** Para cadena de frío y edificios, "Cámara 2 – Depósito Sur" es la identidad y "Placa Nueva 00" es el ruido.
