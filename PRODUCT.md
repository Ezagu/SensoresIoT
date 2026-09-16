# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tres segmentos confirmados, todos B2B o semi-profesionales. El que compra el equipo es el mismo que después mira los datos:

- **Agro / productor** — campos, invernaderos, silos. Es el caso base del que salió el proyecto (`db/seed.sql` habla de "Placa Lote Norte", "Campo A").
- **Comercio / industria** — cadena de frío, depósitos, cámaras, salas de servidores. Acá el dato tiene consecuencia económica inmediata: si la cámara se va de temperatura, se pierde mercadería.
- **Edificios / oficinas** — confort y calidad de aire en espacios de trabajo, consorcios, escuelas.

**Doméstico / hobby quedó explícitamente fuera** del público objetivo por ahora.

Un segundo rol existe pero no tiene interfaz todavía: el **operador interno** de la empresa, que da de alta el pedido en la base a mano, compila el firmware y despacha el equipo. Es el usuario del futuro `admin.dominio`.

**Indefinido, no asumir:** dónde y con qué dispositivo se consultan los datos en la práctica (celular parado en el campo vs. puesto de monitoreo en escritorio). No hay usuarios reales todavía para saberlo. Cualquier decisión de diseño que dependa de esto tiene que declararlo como supuesto, no darlo por sabido.

## Product Purpose

Vendemos un equipo de hardware —ESP32 con sensores ambientales integrados— que mide y manda sus lecturas a una API propia. La aplicación web (`app.dominio`) es donde el cliente consume eso: estado de sus equipos, gráficos por sensor, historial, export a CSV y alertas por umbral que le llegan por mail.

El producto que se cobra es el equipo; la app es lo que hace que el equipo valga algo. Modelo freemium encima: la app gratis alcanza para mirar, el plan premium extiende retención y frecuencia.

Éxito es que el cliente instale el equipo una vez, no vuelva a tocarlo, y cuando abra la app confíe en lo que ve sin tener que preguntarse si el dato está completo.

## Positioning

**Llave en mano, local, y armado por pedido.** No es una plataforma genérica donde el cliente trae su propio hardware y lo configura: llega un equipo con la combinación exacta de sensores que pidió, ya compilado y flasheado, que se conecta al WiFi de la casa desde el celular y empieza a reportar. La app está en castellano, la factura y el soporte son argentinos.

Eso es lo que un ThingSpeak o un Ubidots no puede copiar: no es software, es que alguien arma el equipo, lo compila y atiende el teléfono.

Dos diferencias reales que **existen pero no fueron elegidas como argumento de venta** (usarlas como refuerzo, no como titular): la autonomía sin internet (el equipo bufferea ~12 h en RAM y se pone al día solo, no se pierde una lectura por un corte de WiFi) y el precio de entrada del freemium.

## Operating Context

- El equipo se instala **fuera del control físico de la empresa** — en el campo, el local o la oficina del cliente. Una vez ahí, todo lo que se pueda arreglar hay que poder arreglarlo remoto, o el equipo vuelve.
- **El alta de WiFi la hace el cliente**: el equipo levanta su propio AP (`SensoresIoT-Setup`) y un portal cautivo; el cliente carga su red desde el celular. Se resetea manteniendo el botón BOOT 5 s con el equipo andando.
- **La conectividad intermitente es la norma, no la excepción.** El equipo bufferea y sincroniza después: un equipo "con retraso" casi nunca es una falla, y la app tiene que decir eso en vez de gritar error.
- **Un pedido = una combinación de sensores = un binario compilado a mano.** No hay dos equipos iguales garantizados. El alta del dispositivo y sus sensores se hace a mano en la base.
- Tres superficies planeadas: **landing** (venta, no arrancada), **`app.dominio`** (consumo, la única con código), **`admin.dominio`** (gestión interna, no arrancada).

## Capabilities and Constraints

**Andando hoy en la app:** auth completo (login, registro, verificación por mail), panel con tarjetas de dispositivo y su estado, detalle de dispositivo, detalle de sensor con gráfico y zoom, historial paginado, export CSV, alertas por dispositivo (alta, edición, eventos), configuración del intervalo de muestreo, tema claro/oscuro.

**Pantallas que existen como ruta pero están vacías:** `/dispositivos` (listado completo), `/vincular`, `/alertas` (log global), `/plan`, y la tarjeta de sesiones en `/cuenta`.

**Backend andando:** mediciones con ingreso tardío, planes y suscripciones, export por streaming, alertas evaluadas inline con mail por Resend.

**No implementado (no prometerlo en la UI):** cobro (Mercado Pago), panel de admin, landing y Google OAuth.

**Restricciones que el diseño tiene que respetar:**

- **El freemium gatea sólo dos cosas**: hasta dónde atrás se puede consultar (`retencion_dias`) y cada cuánto puede muestrear el equipo (`intervalo_minimo_seg`). El **export no es premium**. Escribir se escribe siempre completo: un plan free guarda igual que un premium y sólo ve menos, así que el día que actualiza el historial ya está entero.
- **Un equipo tiene tres estados, no dos**: en línea / con retraso / sin reportar. Colapsarlos en "online/offline" convierte el comportamiento normal en falla.
- **El aviso de "dejó de reportar" existe y no lo configura nadie.** El equipo habla cada 5 minutos aunque no le toque publicar; a los 15 minutos de silencio se lo da por caído y sale el mail, y sale otro cuando vuelve. Es el mismo umbral que muestra la pantalla: cuando el panel dice "sin reportar", el mail ya salió. Lo único que lo apaga es silenciar el equipo, y no lo limita ningún plan. Un equipo *con retraso* no avisa nada: bufferea y se pone al día solo.
- **Terminología del producto, en castellano rioplatense, tal cual**: dispositivo, sensor, medición, lectura, alerta, evento, plan, vinculación. Los mensajes del backend ya vienen así.
- **Un solo idioma (es-AR) y un solo mercado (Argentina).** Sin i18n, y el medio de pago es Mercado Pago porque Stripe no toma cuentas argentinas.
- Cada equipo trae los sensores que trae: nada de UI que asuma un kit fijo o un set conocido de tipos.

**Indefinido:** precio de los planes, y si el free tiene tope de dispositivos. El catálogo `planes` tiene columnas para eso sin valor comercial cerrado.

## Brand Commitments

- **"Bitácora" es un placeholder, no un compromiso.** Está en el `<title>`, en el wordmark y en la clave de `localStorage`, y puede cambiar. No construir nada cuyo sentido dependa del nombre.
- No hay identidad visual aprobada por nadie fuera del código: el look actual (dark-first, Space Grotesk + IBM Plex) salió de un mockup interno, no de una guía de marca.
- **Sí es compromiso el idioma y el tono**: castellano rioplatense en toda la interfaz y en los errores, directo, sin relleno de marketing.

## Evidence on Hand

- **Mediciones reales** de equipos propios andando contra la API. El producto se puede mostrar con datos verdaderos, no hace falta mockear series.
- Assets existentes: `frontend/public/favicon.svg` y el logo inline en `frontend/src/components/layout/Logo.tsx`. **No hay fotos ni renders del hardware.**
- **No existe y no se inventa:** testimonios, clientes con nombre, casos de éxito, número de equipos vendidos o instalados, benchmarks de precisión, certificaciones, SLA, precios de plan, uptime. Nada de eso está definido; si una pantalla lo necesita, se pide, no se completa.

## Product Principles

1. **El dato tiene que ser creíble antes que lindo.** Un hueco en la serie se muestra como hueco; nunca se interpola para que el gráfico quede prolijo.
2. **El equipo se opera solo.** El cliente compró un sensor, no un sistema para administrar: cada pantalla asume a alguien que quiere mirar y cerrar.
3. **El plan limita lo que se ve, nunca lo que se guarda.** El límite se comunica como una puerta cerrada con la llave a la vista, no como un error.
4. **Cada pedido es distinto.** Ninguna pantalla puede asumir un kit fijo de sensores ni un tipo conocido de antemano.
5. **Silencio no es falla.** El estado de un equipo se cuenta con la precisión que la conectividad real justifica.

## Accessibility & Inclusion

No hay un estándar comprometido con ningún cliente todavía, y sin saber el contexto de uso real (ver Users) no se puede fijar uno con fundamento. Lo que sí está asumido como piso en el código y no se negocia: contraste de texto sobre relleno ≥ 4.5:1 —de ahí que el sistema tenga dos tonos de acento separados, el claro para texto y el sólido para relleno— y tema claro además del oscuro. Revisar este apartado cuando se defina si la app se usa mayormente en celular a la intemperie.
