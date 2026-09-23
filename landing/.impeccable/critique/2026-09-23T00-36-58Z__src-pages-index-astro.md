---
target: landing/src/pages/index.astro
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:C:\\Users\\agust\\Desktop\\Proyectos\\SensoresIoT\\landing\\src\\pages\\index.astro"
target_fingerprint: "sha256:aee4340b7af61f3ddd380f772f15053bbc64a22a6d6a385b7f5a7b71ff206c9d"
target_path: "C:\\Users\\agust\\Desktop\\Proyectos\\SensoresIoT\\landing\\src\\pages\\index.astro"
timestamp: 2026-09-23T00-36-58Z
slug: src-pages-index-astro
---
Method: dual-agent. Desviación declarada: A murió por límite de sesión y se relanzó después de que B entregara, así que los hallazgos del detector entraron al contexto del sintetizador antes de que A cerrara. A corrió aislada igual (no vio nada de B). Sin overlay: el CLI no tiene `live-server`.

Segunda corrida sobre el mismo target, después de cuatro pases de trabajo (/adapt, /typeset, /audit, /layout).

## Design Health Score — 25/40 (Aceptable), sin movimiento

| # | Heurística | Pts | Δ | Issue clave |
|---|---|---|---|---|
| 1 | Visibilidad del estado | 4 | +1 | Total, delta y equipo en vivo impecables; sigue sin `role="status"` en el éxito del form. |
| 2 | Sistema ↔ mundo real | 3 | −1 | «cada 15 a 20 segundos» (Guardia/FAQ) contra «hasta cada 5 min» (Planes). |
| 3 | Control y libertad | 2 | = | Form que se autodestruye, carrusel sin pausa visible, `#cierre` callejón. |
| 4 | Consistencia | 3 | = | Nuevas: `.display` 65,6px hero / 76px cierre; puntos cuadrados en mobile, píldora el activo. |
| 5 | Prevención de errores | 2 | −1 | `avisoDe()` es lo único; el textarea (el dato útil) es opcional. |
| 6 | Reconocer > recordar | 2 | = | «Presión · hPa · US$ 12» no dice para qué sirve. |
| 7 | Flexibilidad | 1 | = | 5 presets ya definidos en `datos/ambientes.ts` y el configurador arranca de cero. |
| 8 | Estética y minimalismo | 3 | = | 9,5 pantallas desktop / 11,4 mobile. |
| 9 | Diagnóstico y recuperación | 1 | = | Sigue sin un solo estado de error diseñado. |
| 10 | Ayuda y documentación | 4 | +1 | 9 preguntas reales, bien escritas, con salida a contacto. |

Los cuatro Δ se movieron sobre hechos idénticos: es calibración de revisor, no trabajo hecho ni deshecho. Lo real: las cuatro rondas levantaron el piso técnico (que Nielsen no mide) y no tocaron la deuda de interacción (3, 5, 6, 7, 9), porque ninguno de los cuatro comandos cambiaba qué hace la página — el único que lo habría hecho era el P0, pausado por el usuario.

## Lo que sí se movió, medido

| | antes | ahora |
|---|---|---|
| Fallos de contraste de texto | 5 | 0 en ambos temas, 390 y 1280 |
| Anillo de foco | 1,16 / 1,23:1 en 42 controles | 6,46 / 6,69:1, una sola regla, cero `outline:none` |
| Landmarks | sin `<main>` ni skip link | ambos; skip es el primer tabulable |
| Targets bajo 24×24 @390 | varios | 1 (enlace en línea, exento) |
| Grietas de reduced-motion | 3 | 0 de 28 declaraciones de movimiento |
| Alto del documento @1280 | 10.616px | 8.953px (−16%) |
| Overflow horizontal | 0 | 0 (320/390/768/1024) |

Detector CLI: exit 2, 2 warnings. `layout-transition` en `ambientes.css:42` (real, 5 nodos, cubierto por reduced-motion) y `overused-font` en `Base.astro:41` (falso positivo: Instrument Sans no está en la lista de la regla).

## Design Specificity Verdict — 8/10 (era 6/10)

El lenguaje visual está construido sobre el objeto que venden, no sobre un layout: los módulos entran desde afuera del gabinete (`--ex/--ey`), el gateway LoRa empuja la unidad principal, el tablero de Registro tiene cuatro estados reales con `bt-reading--stale` atenuando el valor y no la unidad, el gráfico deja el hueco honesto, el log compara «9,4 °C > 8 °C».

Faltan 2 puntos por lo mismo de antes: el andamiaje de secciones es SaaS genérico, y el único lugar donde aparecería el mundo del cliente —los ambientes— está a 1,80:1, o sea que no aporta especificidad porque no se ve. La opacidad subió 2,3× y sigue bajo el piso de 3:1: se arregló el síntoma a medias, la causa es que hay demasiados objetos chicos dibujados con hairlines.

## Regresiones introducidas en los cuatro pases

### [P1] Jerarquía tipográfica invertida
`clamp(34px, 12cqi, 76px)` con `container-type` en `.hero-copy` (546px) y en `.close` (823px). Medido por las dos evaluaciones por separado: H1 = 65,6px, cierre = 76,0px. El remate es más grande que el titular. Con `6.4vw` los dos topeaban en 86 y quedaban iguales.

### [P2] Puntos del carrusel cuadrados en mobile
`padding: 18px 13px` sobre 34×44 con `border-radius: 999px`: el radio usado se clampea a 17px y el padding vertical (18) lo supera, así que el radio vertical de la content-box se va a cero. El punto de 8×8 se pinta como bloque. Cuatro cuadrados al lado de una píldora.

### [P3] Trazo perdido en el recorte de Invernadero
Al retunear los `vista`, en `esc-1` un `.ln-45` quedó 158 unidades afuera del borde derecho del viewBox: invisible en todos los anchos.

## Priority Issues

### [P0] «Pedir este equipo» sigue sin pedir nada
Pausado por decisión del usuario (la funcionalidad no existe todavía). Se registra porque es la causa de las tres heurísticas más bajas (3, 7, 9).

### [P0] La demo del hero muestra la falla 22 de sus 38 segundos
`datos/config.ts:4-11` + `hero.ts`: normal 8s → espera 8s → descarga 6s → calma 8s → alerta en el segundo 30 de un loop de 38, con la tarjeta atrasando 2,3s más. Un visitante de 10-25 segundos ve «Con retraso» y «Sincronizando». Fix: normal 5s → alerta 8s → normal 4s → espera 5s → descarga 4s (26s), pico en el segundo 5. Comando: /impeccable animate

### [P1] Planes no tiene un solo botón
Dos cards sin CTA, Premium en «A confirmar», disclaimer de cierre. El nav manda gente ahí. Fix: CTA por card y reescribir el disclaimer como hecho positivo. Comando: /impeccable clarify

### [P1] El pago de Guardia vive en los últimos 120px del pulgar
La pista bajó de 320vh a 200vh (150 mobile) sin rebalancear `ENTRADA`/`SALIDA` ni la forma de `SERIE`: las 30 muestras planas siguen costando el 61% del recorrido. En mobile el rango fijado es 422px y la alerta ocupa los últimos 120px. Fix: re-mapear el avance, no devolver alto. Comando: /impeccable layout

### [P2] Targets táctiles en desktop, nunca medidos
A 1280: 15 bajo 44×44 y 9 bajo 24×24 — tres `.top-link` a 16px de alto, `#btn-tema` 34×34, flechas del carrusel 38×38, puntos del carrusel 7×7. WCAG 2.5.8 aplica a cualquier puntero. Los puntos tienen la excepción «Equivalent»; los `.top-link` no. Comando: /impeccable audit

### [P2] La sección de cierre es la única sin gutter
`.close { padding: clamp(60px,9vw,130px) 0 }` (`contacto.css:18`) pisa el `padding-left/right: var(--gut)` de `.stage`. A 390px el titular arranca en x=0 y los dos CTA miden 389,6px pegados a ambos bordes. Comando: /impeccable layout

## Carga cognitiva — 5 de 8 fallan

Foco único (9 CTAs, 5 apuntan a `#equipo`), jerarquía visual (el cierre es más grande que el H1; `.narra` y `.flow` a 11-13px faint), una cosa a la vez (configurador desktop con los dos rieles + equipo + resumen + precio + delta + aviso), opciones ≤4 (configurador desktop 10 botones, carrusel 12 controles, FAQ 9 ítems), memoria de trabajo (Ambientes viene después del configurador). Parciales: agrupación (`.flow` huérfano), revelación progresiva (mobile sí, desktop no).

## Recorrido emocional

Pico intencionado del hero: nunca llega (la alerta está en el segundo 30 de 38). Valle 1: Guardia, un flick se saltea la alerta. Pico real 1: el configurador. Valle 2: Ambientes, cinco dibujos que no se distinguen. Pico real 2: el tablero de Registro y la hoja del informe. Valle 3: Planes. Peak-end roto: `#cierre` usa 100dvh para mandar al lector hacia atrás. Sin tranquilidad en el momento de máximo compromiso: sin privacidad, sin plazo, sin canal alternativo, sin eco del mail.

## Persona Red Flags

**Jordan**: el chip «Presión · hPa · US$ 12» no dice para qué sirve; la respuesta está una sección después y a 1,8:1. Segundo: «cada 15 a 20 segundos» vs «hasta cada 5 min».

**Riley**: manda el form con textarea vacío y recibe éxito sin vuelta atrás. Arma US$ 244, aprieta «Pedir este equipo» y aterriza en botones «Armá tu equipo» / «Necesito ayuda». Tabula al carrusel: el foco frena el avance pero los puntos no exponen `aria-current` ni `aria-pressed`.

**Casey**: un flick cruza los 422px de Guardia sin ver la alerta. El configurador le deja 304px (panel 378 + sumbar 102): ve 2,5 de 6 chips sin señal de que sigue. `car-nav.prev` fuera del arco del pulgar derecho.

## Minor Observations

Los nueve `box-shadow: 0 0 0 3px var(--lp-accent-wash)` son aditivos y no rompen nada (ninguno declara `outline`), pero a 1,2:1 no aportan: ruido decorativo borrable. `Pie.astro:9` «nombre de marca provisorio» visible. `Base.astro:36` en `noindex`, sin OG ni canonical. Pastilla `attention` a 4,46:1 sobre su wash ámbar en claro (0,04 bajo AA a 13px). `ambientes.css:19` `max-width: 15ch` parte «Cámara de / frío» en desktop. `Registro.astro:64` la cuenta no cierra con la lista. `medios.ts:4` snapshot sin listener. `.narra` y `.flow` a 11-13px faint son los únicos que contestan «¿qué pasa después de que compro?».

## Questions to Consider

1. Ya hay cinco presets en `datos/ambientes.ts`. ¿Por qué el configurador arranca desde cero en vez de «Empezá desde: Cámara de frío / Invernadero / Campo»? Mata tres fallas de carga cognitiva y la heurística 7.
2. Si el configurador es lo mejor de la página, ¿por qué está en la posición 3, después de 200vh de un gráfico de líneas? ¿Y si el hero es el configurador?
3. La demo del hero enseña que el equipo se desconecta. ¿Es la historia que querés contar antes de decir para qué sirve la caja?
4. ¿Cuánto cuesta que `#cierre` sea el pedido en vez del epitafio?
