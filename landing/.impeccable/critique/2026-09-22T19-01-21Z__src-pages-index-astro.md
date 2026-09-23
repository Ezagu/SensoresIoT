---
target: landing/src/pages/index.astro
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\agust\\Desktop\\Proyectos\\SensoresIoT\\landing\\src\\pages\\index.astro"
target_fingerprint: "sha256:2a058f2ed349b42561b912cd64366ce863ee1bdf8af9606b839c7532e710d842"
target_path: "C:\\Users\\agust\\Desktop\\Proyectos\\SensoresIoT\\landing\\src\\pages\\index.astro"
timestamp: 2026-09-22T19-01-21Z
slug: src-pages-index-astro
---
Method: dual-agent (A: design review · B: detector + mediciones de navegador). B murió por límite de sesión en el primer intento y se relanzó con alcance ajustado. Overlay visual del detector NO disponible: esta versión del CLI no tiene el subcomando `live-server`.

## Design Health Score — 25/40 (Aceptable)

| # | Heurística | Pts | Issue clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Configurador ejemplar; `#form-gracias` sin `role="status"` ni eco de lo enviado. |
| 2 | Correspondencia con el mundo real | 4 | Español argentino concreto; *aviso* vs *alerta* respetado. `B—01` no significa nada para un primerizo. |
| 3 | Control y libertad | 2 | Guardia scroll-jackea 320vh; carrusel autoavanza 4s sin pausa; hero 38s sin control; menú sin Escape. |
| 4 | Consistencia y estándares | 3 | Nav desktop 3 links / mobile 5; 42 controles con anillo propio y 6 links con el nativo; `.segm { display:none }` en `contacto.css:26`. |
| 5 | Prevención de errores | 3 | `avisoDe()` (`datos/equipo.ts:39-48`) advierte sin bloquear. El form no tiene validación ni `:invalid`. |
| 6 | Reconocer antes que recordar | 2 | Mobile: el control Sensores/Energía queda tapado apenas tocás un chip. |
| 7 | Flexibilidad y eficiencia | 1 | No va n/a: el trabajo del configurador (US$ 303) no se transporta a ningún lado. |
| 8 | Estética y minimalismo | 3 | `Registro` muestra 5 mini-productos a la vez. |
| 9 | Diagnóstico y recuperación | 1 | No existe un solo estado de error en la página; el submit siempre "sale bien" y el form desaparece. |
| 10 | Ayuda y documentación | 3 | FAQ bien hecha (9 objeciones, `<details name>` nativo); promete WhatsApp/Telegram que el resto no muestra. |

## Design Specificity Verdict — 6/10

La marca la carga un solo asset, no la composición. El SVG del equipo (`componentes/equipo/`, `ranuras.ts`) es un mismo objeto con un mismo sistema de coordenadas reusado en hero, configurador y carrusel: eso no se levanta y se pega en otro SaaS. Pero sacá el SVG y queda la plantilla dark-SaaS 2024; 8 de 9 secciones usan el mismo ritmo `h2 + contenido` en el mismo `.stage` de 1240px. El producto se llama Bitácora, vende un registro en el tiempo, y ninguna sección está compuesta como una bitácora: la línea de tiempo siempre es contenido adentro de una card, nunca el layout.

Detector CLI: exit 2, 2 warnings. `layout-transition` en `estilos/ambientes.css:42` (real, acotado, cubierto por reduced-motion). `overused-font` en `layouts/Base.astro:41` — falso positivo casi seguro: la regla enumera Inter/Roboto/Fraunces/Geist/Plus Jakarta/Space Grotesk y la fuente es Instrument Sans.

## Impresión general

Percentil alto de artesanía, percentil bajo de conversión. La página termina en un rulo: el visitante de mayor intención no tiene salida y los últimos dos CTA lo mandan para arriba. La oportunidad más grande no es agregar nada, es que el trabajo que el visitante ya hizo llegue a algún lado.

## Lo que funciona

1. El equipo como objeto físico único (hero/configurador/ambientes comparten SVG y sistema de coordenadas; los módulos entran desde afuera hacia su ranura vía `--ex/--ey`). Es el 80% de la identidad.
2. Los dos temas son de verdad: `tokens.css:73-111` re-afina los neutros para papel en vez de invertirlos. La rampa principal de texto sobrevive una auditoría de modo claro. Stamp pre-paint en `Base.astro:19-30`.
3. `avisoDe()` (`datos/equipo.ts:39-48`): advierte LoRa-sin-gateway sin bloquear y explica por qué alguien podría quererlo. Función pura que sirve SSR y cliente.

## Priority Issues

### [P0] El camino de conversión es un circuito cerrado
`Configurador.astro:143` → `#cierre`; `Cierre.astro:12-13` → `#equipo` y `#contacto`; `Contacto.astro:15-19` dice "Armá la configuración, mandala" y su único control es `<a href="#equipo">`. El form no arrastra nada de la selección (`scripts/contacto.ts` no lee `sel`). Para contactar, el visitante de máxima intención debe auto-degradarse a "No sé qué configuración me sirve".
Fix: que "Pedir este equipo" ancle a un `<form>` real bajo "Ya sé qué necesito", con resumen readonly alimentado por `resumenDe(sel)`/`totalDe(sel)` (`configurador.ts:88-89`, el cableado ya existe). Comando: /impeccable shape

### [P1] El foco de teclado es invisible en toda la página
42 de 48 controles usan `outline: none; box-shadow: 0 0 0 3px var(--lp-accent-wash)` en 9 reglas (`botones.css:8`, `nav.css:24,37`, `configurador.css:12`, `preguntas.css:27`, `ambientes.css:36,44`, `contacto.css:13`, `respuesta.css:98`). Medido: 1,16:1 claro / 1,23:1 oscuro contra 3:1 de WCAG 1.4.11. Los 6 links sin regla conservan el nativo → inconsistencia además.
Fix: `outline: 2px solid var(--lp-accent); outline-offset: 2px` (6,69:1 claro / 6,46:1 oscuro). Comando: /impeccable audit

### [P1] Mobile: el control de rieles es inalcanzable, 4 de 10 módulos desaparecen
`respuesta.css:80` `.build-stage { position: sticky; top: 60px; z-index: 8 }` contra `respuesta.css:89-92` (`segm` order 2, después del stage) y `respuesta.css:93` (`.rail.oculto { display:none }`). Medido a 390x844: `.segm` visible sólo entre scroll 3100-3250 de 10694. Batería, solar, LoRa y gateway dejan de existir en mobile. Los dos primeros chips quedan cortados detrás del panel.
Fix: mover `.segm` adentro de `.build-stage`, o `top: calc(60px + var(--alto-stage))`. Comando: /impeccable adapt

### [P1] El headline del hero se parte en 5 renglones
`tipografia.css:1` `clamp(38px, 6.4vw, 86px)` dimensionado contra el viewport mientras el elemento vive en una columna `minmax(0, 0.92fr)` (`hero.css:10`). Medido: 86px en 546px = 5 renglones, 430px de alto. En mobile el `<br>` de `Hero.astro:30` deja `día.` huérfano. Transversal: todos los headlines grisan su segunda mitad con `--lp-faint` y esa mitad es siempre la diferenciadora.
Fix: `container-type: inline-size` + `clamp(38px, 11cqi, 72px)`, o tope 64px y grilla 1fr/1fr. Sacar el `<br>`. Comando: /impeccable typeset

### [P2] Guardia gasta un tercio del scroll; Ambientes no prueba nada en mobile
`guardia.css:5` `--watch-recorrido: 320vh` ≈ 3.200px de 10.862, y `guardia.ts:8-9` recorta el uso útil a 0.10-0.85. El pico emocional (cruce de umbral) está a ~2.400px. Con `prefers-reduced-motion` se recibe el estado final pero la pista sigue midiendo 260-320vh. `scripts/ambientes.ts:42` recorta el viewBox ≤720px encuadrando sólo el equipo: 5 slides idénticas sin ambiente. En desktop las escenas van a 0.62 x 0.14 = 0,087 efectivo.
Fix: pista a ~180vh + colapsar bajo reduced-motion; escenas a ~0.30/0.8; en mobile no recortar. Comando: /impeccable layout

## Persona Red Flags

**Jordan (primerizo)**: headline de 5 renglones leído como textura; Guardia leída como "no cargó"; 10 chips cuya línea secundaria es una unidad, no un uso (`Presión / hPa`, `Radiación UV / índice`). Elemento exacto: `Configurador.astro:58-67`.

**Riley (bordes)**: desde el segundo Tab no ve el foco; Escape no cierra el menú (`scripts/nav.ts` no escucha keydown); manda el form vacío, sale "Listo", y el form ya no existe (`form.hidden = true` irreversible, `#form-gracias` sin `role="status"`). Elementos: `botones.css:8`, `scripts/nav.ts`, `Contacto.astro:39-42` + `scripts/contacto.ts:9-11`.

**Casey (mobile)**: `día.` huérfano; panel sticky 378 de 844px (45%) + barra de precio 102px; nunca descubre solar/batería/LoRa/gateway; puntitos del carrusel 36x26 con 2px de separación; filas de Registro rotas. Elementos: `respuesta.css:80` contra `respuesta.css:90`, `registro.css:16`.

## Carga cognitiva — 5 fallos de 8 (alta)

Fallan: foco único (Registro = 5 mini-productos), jerarquía visual (hero), una cosa a la vez, opciones mínimas (10 chips simultáneos en desktop: `.segm` es `display:none` arriba de 720px por `contacto.css:26` y `.rail.oculto` sólo aplica abajo), memoria de trabajo (mobile). Parciales: agrupación (`umbral 8,0 °C` lejos de la línea que rotula, `Guardia.astro:35`), revelación progresiva (el `.segm` es el patrón correcto y sólo existe en mobile, roto).

## Recorrido emocional

Picos: LED respirando en el hero; cruce de umbral en Guardia (el producto se explica sin venta); el total subiendo con `+ US$ 100`. Valles: 3.200px de Guardia leídos como "no cargó"; Planes con "A confirmar" en el casillero del precio. Peak-end: los dos últimos CTA son anclas hacia arriba — la última emoción es "no pude terminar". Sin tranquilidad en el punto de máximo compromiso: mail sin privacidad, sin plazo, sin WhatsApp, y la confirmación borra lo escrito.

## Minor Observations

Contraste de texto — 5 fallos reales que la revisión de diseño no vio: `.bt-row__sep` 1,44 (ambos temas, decorativo: `aria-hidden` lo exime), `.un` 4,01 claro / 3,90 oscuro, `.hora` 3,87 oscuro. Más 7 casi-fallos entre 4,6 y 5,1, todos alrededor de `--lp-faint`: ese token no tiene margen.

Contraste no textual: ningún token de línea llega a 3:1. `--lp-line` 1,40/1,44; `--lp-accent-line` 2,14 oscuro / 1,61 claro — en claro el estado "on" de un chip se sostiene casi sólo por el color del precio.

Semántica: falta `<main>`, falta skip-link, 6 SVG (`.bt-row__chev`) sin `aria-hidden`. Limpio: 1 `h1`, cero saltos de nivel, cero controles sin nombre accesible, cero inputs sin label, `lang="es-AR"`.

Overflow horizontal: cero a 320/390/768.

Reduced-motion: 17/17 animaciones CSS cubiertas. Grietas: `.mod [data-pos]` (`equipo.css:26`, `transition:none` no hereda), `.faq-signo::before/::after` y `.faq-a` (`preguntas.css:30,34`). `medios.ts:4`: `quieto` es snapshot al cargar, `observarMedia()` existe pero no se usa ahí.

Otras: `Pie.astro:9` "nombre de marca provisorio" visible; nav cubre 3 de 9 secciones (Ambientes y Registro sin `id`); "Empezar" apunta al mismo `#equipo` que el link 60px a su izquierda; ciclo del hero 38s con la alerta a los ~22s; `.sumbar` se esconde con `rootMargin: '-20% 0px -30% 0px'` mientras seguís eligiendo; el carrusel captura `pointerdown` en todo `#carrusel` (tap con 40px de deriva cambia slide); `.log-h` a 9,5px y 7 clases a 10px mayúsculas con tracking; estilos inline fuera del sistema en `Pie.astro:7`, `Cierre.astro:10,15`, `Configurador.astro:132`, `Guardia.astro:35,49`, `Contacto.astro:26`. Fuera de alcance: `Base.astro:36` tiene `noindex, nofollow` y no hay og:image.

## Questions to Consider

1. El producto se llama Bitácora y vende un registro en el tiempo. ¿Por qué ninguna sección está compuesta como una bitácora?
2. El mejor momento de la página está a 2.400px de scroll detrás de una pista de 320vh. ¿Qué pasa si ese momento es el hero?
3. El configurador ofrece 10 opciones sin decir para qué sirve ninguna; Ambientes lo dice y está después, y vacío en mobile. ¿No está el orden invertido?
4. Todos los headlines grisan su segunda mitad y esa mitad es siempre la diferenciadora. ¿El recurso pelea contra el mensaje?
5. ¿Un wizard de 3 preguntas que termine en un pedido pre-llenado no convertiría más que 10 chips que terminan en un ancla?
