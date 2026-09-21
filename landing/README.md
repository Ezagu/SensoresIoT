# Bitácora — Landing comercial

Port a Astro del mockup diseñado en el Canvas de artifacts (`Bitácora — Landing comercial`).
Proyecto independiente de `frontend/` — comparte identidad (tipografía, curva de animación,
la rampa de color del design system Bitácora) pero no código ni tooling.

**Estado: sólo diseño, sin backend.** El formulario de contacto queda inerte a propósito — ver
el TODO en `src/componentes/secciones/Contacto.astro`. No se publica todavía: el producto no
cumple varias de las promesas que la página muestra (WhatsApp/Telegram, CO₂/UV/suelo,
batería/LoRa, informes PDF), y eso quedó pospuesto a conciencia junto con el resto del roadmap
comercial.

## Comandos

```
npm run dev      # localhost:4321
npm run build    # → dist/
npm run preview  # sirve dist/ para probar el build de producción
npx astro check  # type-check de los .astro/.ts
```

## Qué se portó y qué se corrigió

El mapa completo de decisiones (Tailwind vs CSS plano, reparto de las 20 claves de estado en
islas, los 3 bugs corregidos del mockup, la tabla de verificación) está en
`C:\Users\agust\.claude\plans\comienza-planificando-el-port-polymorphic-bonbon.md`. En breve:

- **CSS plano** (`src/estilos/`), casi verbatim del `<style>` del mockup, partido por sección.
  `respuesta.css` va último a propósito: sus `@media` pisan reglas anteriores.
- **Sin framework de UI.** Diez módulos de JS vanilla (`src/scripts/`) traducen 1:1 la lógica del
  mockup (`this.state`/`setState` → un objeto plano + una función `aplicar()` por isla).
- **La FAQ es `<details name="preguntas">` nativo** — acordeón exclusivo sin una línea de JS,
  funciona con JavaScript deshabilitado.
- **Los 4 componentes del design system** (`TimeSeries`, `StatusPill`, `DeviceRow`, `AlertEvent`)
  se redibujaron a mano en `src/componentes/datos/`, a partir de su fuente en
  `.claude/skills/bitacora-design/components/monitoring/` — sin traer Recharts ni el bundle.
- **Tres bugs del mockup corregidos**: la tabla de precios duplicada e inconsistente (temp/hum
  ahora son gratis en los dos lugares), la animación de entrada del hero que nunca se veía
  (`opacity:1` inline pisando la transición), y el ciclo del hero que corría para siempre aunque
  la sección no estuviera en pantalla (ahora se gatea con `IntersectionObserver` +
  `visibilitychange`).
- **`[hidden]` necesita `display:none !important` global** (`src/estilos/base.css`): sin eso,
  cualquier elemento con un `display` propio (las pastillas de estado, las lecturas del
  configurador, los paneles del informe) ignora el atributo nativo. No aparecía en el mockup
  porque ahí esas ramas ni se montaban en el DOM (`<sc-if>`).

## Estructura

Ver el plan enlazado arriba para el árbol completo y la tabla de equivalencias
`{{interpolación}}` / `<sc-for>` / `<sc-if>` / `onClick` → su forma en Astro.

## Pendiente (no bloqueante para este port)

- Probar los breakpoints mobile en un dispositivo real — `npm run dev -- --host` y abrir por IP
  de red local. El resize de ventana no se pudo automatizar de punta a punta en esta sesión.
- Cuando el producto entre en etapa de venta: conectar el form de contacto, sumar analítica y
  publicar con dominio propio (ver la conversación de arquitectura de hosting: Cloudflare Pages
  para este proyecto, backend aparte en Railway/VPS).
