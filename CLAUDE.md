# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

SensoresIoT is an IoT sensor-monitoring platform: ESP32 boards running Arduino firmware POST sensor readings to a FastAPI backend, which stores them in TimescaleDB (Postgres). The data is meant to be consumed from a web app that has not been started yet. The repo has two parts: `backend/` (FastAPI + Postgres/Timescale) and `esp/` (Arduino/C++ firmware).

## Commands

### Backend (from `backend/`)
- Run locally (needs `venv` activated and a reachable DB): `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- Install deps: `pip install -r requirements.txt`
- No test suite or linter is currently configured for the backend.

### Full stack via Docker
- `docker-compose.yml` is the base (production-like: API built from image, DB port not exposed to host).
- `docker-compose.override.yml` is auto-merged in dev: exposes Postgres on host port `5433`, bind-mounts `./backend` into the container, and runs uvicorn with `--reload`.
- `docker compose up` from the repo root brings up `timescaledb` + `api` together.
- Requires a `.env` at the repo root (see `.env.example`): `POSTGRES_PASSWORD`, `CORS_ORIGINS`, `RESEND_API_KEY`, `FRONTEND_URL`, `JWT_SECRET_KEY`.
- `db/init.sql` runs automatically only on first container creation (mounted as a Postgres init script). To re-apply schema changes, drop the `postgres_data` volume or run the SQL manually against the running container.

## Backend architecture

Layered structure, one module per entity, wired together in `main.py`:

```
routers/    -> FastAPI endpoints, request/response wiring, auth dependencies, rate limits
services/   -> business logic, authorization checks, orchestrates repo calls inside a transaction
repositories/ -> raw SQL (psycopg2), no business logic, takes a cursor as first arg
schemas/    -> Pydantic request/response models
core/       -> cross-cutting: config (env vars), security (JWT/hashing), deps (FastAPI Depends), limiter, email
```

- Every service function opens its own `with get_connection() as conn: with conn.cursor(...) as cur:` block (see `db.py`); the connection context manager auto-commits on success and rolls back on exception. Multi-step operations (e.g. validate device, check ownership, insert) share one cursor/transaction inside a single service function — don't split them across connections.
- Repos are plain functions `fn(cur, ...)` that execute SQL and return rows; they never raise `HTTPException` or contain authorization logic. Services own error handling (`raise HTTPException(status, "mensaje")`) and permission checks.
- Naming and error messages throughout the backend are in Spanish (`usuario`, `dispositivo`, `medicion`, `crear_`, `obtener_`, `buscar_`); keep new code consistent with this convention rather than mixing English.
- Authorization pattern: a resource (`dispositivo`, `sensor`) is accessible if the requesting user owns it (via `usuario_dispositivo` link table) or has `rol == "admin"`. This check lives in the service layer (e.g. `dispositivo_service.tiene_acceso_a_dispositivo`), not in routers or repos.

### Auth model
Two separate credential systems, both defined in `core/security.py` / `core/deps.py`:
- **Users**: bcrypt password hash + short-lived JWT access token (`ACCESS_TOKEN_EXPIRE_MINUTES = 30`) returned in the response body, plus a long-lived refresh token (`REFRESH_TOKEN_EXPIRE_DAYS = 7`) stored as an `httponly`/`secure`/`samesite=strict` cookie and persisted hashed in `refresh_token` table. `get_usuario_actual` / `get_usuario_admin` (in `core/deps.py`) gate user-facing endpoints.
- **Devices** (ESP32 boards): a per-device secret (random token, only its SHA-256 hash stored as `secret_hash` in `dispositivos`), sent as `Authorization: Bearer <secret>` plus an `X-Dispositivo-Id` header. Verified via constant-time comparison (`hmac.compare_digest`) in `get_dispositivo_autenticado`.
- **Device secret rotation** (`POST /dispositivos/rotate-secret`): device-initiated — the board authenticates with its current secret and gets a new one back once. During a rotation two secrets are valid at the same time: the new one in `secret_hash` and the previous one in `secret_hash_anterior`. `get_dispositivo_autenticado` accepts either, and clears `secret_hash_anterior` the first time the device authenticates with the new one (implicit commit). This is deliberate: invalidating the old secret immediately would brick any device that never received the response. An admin forces a rotation with `POST /dispositivos/{id}/marcar-rotacion`, which raises `rotacion_pendiente`; the flag then rides back to the device as `rotar_secret` in the `POST /mediciones/` response. `POST /dispositivos/{id}/regenerate-secret` still exists but requires reflashing, so it is bench/factory-only.
- Rate limiting (`slowapi`, per-IP) is applied per-route via `@limiter.limit(...)` decorators on sensitive endpoints (login, register, resend-verify, device vinculation).

### Time-series data (`mediciones`)
This is the core domain concept and the most nuanced part of the backend:
- `mediciones` is a TimescaleDB hypertable (raw readings, `time`/`sensor_id`/`value`), with two continuous aggregates (`mediciones_por_hora`, `mediciones_por_dia`) refreshed on a schedule and each with their own retention policy — all defined in `db/init.sql`. Raw data is dropped after 90 days, hourly aggregates after 1 year, daily aggregates kept forever.
- `medicion_repo.py` implements a **tiered query strategy** (`FUENTES` list, finest-to-coarsest): given a requested time range, it picks the cheapest table that (a) still meets the requested resolution and (b) actually retains data that far back, falling back to a coarser table rather than returning nothing. `buscar_puntos` (chart data, targets ~200 points) and `buscar_resumen` (single aggregate stat) each choose independently since their bucket-size math differs — read the comments in that file before changing the selection logic, the reasoning is non-obvious.
- Device writes go through `medicion_service.crear_medicion`, which enforces a minimum interval between readings per sensor (from the owner's plan — `planes.intervalo_minimo_seg`, resolved in `_obtener_intervalo_minimo`, with a small jitter tolerance) and echoes back that same value as `intervalo_sugerido` in the response so firmware can throttle itself. Invalid sensor IDs, out-of-range timestamps and readings that arrive too soon are silently rejected (reported back in the response, not as HTTP errors) rather than failing the whole batch.
- **Readings can arrive late and out of band.** The firmware buffers what it could not send and flushes it later with each reading's original `time`, so a batch may hold dozens of points per sensor spanning hours. Consequences baked into the service: each candidate is checked against its real *neighbours* (`medicion_repo.mediciones_en_ventana`, not the sensor's latest row), a point whose timestamp already exists is reported as `duplicadas` rather than as an interval violation, the whole batch goes in with one `execute_values` + `ON CONFLICT DO NOTHING`, and `last_seen_at` is set to `now()` — never to the reading's time, or a flush of old data would mark a device that just reported as stale.
- The `(sensor_id, time)` unique index is what makes a retry safe: the board re-sends a chunk whenever it does not get a 2xx, including when the insert actually succeeded and only the response was lost.
- The continuous-aggregate policies deliberately use a much wider `start_offset` (3 days / 30 days) than their `schedule_interval`. A backfilled row outside that window gets marked as invalidated but never re-materialized, so it would vanish from any chart wide enough to be served from an aggregate. The window must stay above the firmware's maximum buffer horizon.

### Planes y suscripciones
Foundation of the freemium model. Two limits are enforced today (query retention and sampling interval, see "Enforced gates" below); the remaining catalog columns have no consumer yet.
- `planes` is a small fixed catalog (`free`, `premium`). Its `id` is `TEXT`, not SERIAL/UUID: the code references `'free'` as a stable literal (it is the fail-closed fallback), and a numeric id meaning free breaks on any reseed. `NULL` means *unlimited* in `dispositivos_incluidos`, `retencion_dias` and `max_alertas`.
- **A subscription is current on dates alone**: `inicio_at <= now() AND (fin_at IS NULL OR fin_at > now())`. `estado` (`activa`/`cancelada`/`revocada`) records intent and **never** takes part in that predicate — that is what makes "cancelled on day 3 but paid through day 30" free of special cases: cancelling does not touch `fin_at`. There is deliberately no `vencida` state; expiry is derived, so no job can leave the state lying about the dates.
- **Free is the absence of a current subscription**, not a row: nothing is inserted on signup.
- `suscripciones` carries an `EXCLUDE USING gist (usuario_id WITH =, tstzrange(inicio_at, fin_at) WITH &&)` (hence `btree_gist`). The service's 409 is a check-then-act that two concurrent requests both pass, which would leave a user with two current subscriptions — revoking one would not downgrade them. `tstzrange` is half-open `[)`, so revoking with `fin_at = now()` and reassigning with `inicio_at = now()` do not collide.
- **`services/plan_service.py` is the single point of truth for limits.** Every gate (retention clamp, per-plan sampling interval, and later alerts, sharing, export) reads `limites_de_usuario(cur, ...)`, `limites_de_dispositivo(cur, ...)` or `ventana_de_consulta(cur, ...)` and nothing else touches `planes`/`suscripciones`. They take a cursor rather than opening a connection, because gates run inside transactions that are already open (`medicion_service.crear_medicion`); the first two return the `planes` row as-is, so adding a catalog column does not require touching the service.
- Which helper: **device data limits come from the plan of the device's owner** (a free user with shared access sees exactly what the owner sees); **account limits** (creating alerts, sharing one's own devices) come from the requesting user's own plan.
- Fail-closed means *indeterminate data*, not swallowed errors: no current subscription, or a missing catalog row, yields free (`LIMITES_FREE` is the hard floor). Do **not** wrap these in `try/except` to return free on a psycopg2 error — after an error the transaction is aborted and every later query on that cursor fails anyway.
- Downgrades only ever stop reading more; nothing is deleted. Revoking sets `fin_at = now()` and keeps the row.

**Enforced gates.** Only two of the catalog columns have a consumer today:
- **`retencion_dias` — query clamp.** `plan_service.ventana_de_consulta(cur, dispositivo_id, rol)` turns it into a `piso` (oldest queryable instant, `None` = unlimited) and is applied in `sensor_service.obtener_grafico` / `obtener_historial`. The clamp **raises `desde`, it never errors**: the graph response carries `desde_efectivo` / `recortado` / `retencion_dias` so the frontend can render what it got and offer the upgrade, and a range that falls entirely outside the window returns empty rather than a 400. For `/historial` the piso goes down to `medicion_repo.buscar_historial` as a lower bound, which ends pagination on its own.
  - Raising `desde` only *lowers* the range's age, so `medicion_repo._elegir_fuente` picks an equal-or-finer source — the tiered `FUENTES` strategy needs no changes and can never be starved by the clamp.
  - **Admins are exempt** (`rol == "admin"` short-circuits before any query): support has to be able to see what a customer reports from weeks ago. This is a commercial limit, not an access control — that is still `dispositivo_service.tiene_acceso_a_dispositivo`.
- **`intervalo_minimo_seg` — write gate.** Both the hard rejection and the `intervalo_sugerido` echoed to the firmware. Note `crear_medicion` opens a **second, dict cursor on the same connection** just to read the plan: its main cursor yields tuples because `sensor_repo.ids_por_dispositivo` and `medicion_repo.mediciones_en_ventana` unpack positionally, so it cannot be switched to `RealDictCursor`.
- **Writes are never clamped by retention.** `ANTIGUEDAD_MAXIMA` (90 days) tracks the raw retention policy, not the plan: a free user writes just as deep as a premium one and merely sees less. That is deliberate — the full history is already there the day they upgrade.


## Database
- Postgres + TimescaleDB extension. Schema and seed data live in `db/init.sql` (only applied on fresh volume) and `db/seed.sql`.
- There is no migration tool. Schema changes go in **two** places: folded into `db/init.sql` for fresh installs, and as a numbered script under `db/migrations/` to apply by hand to running databases (`docker compose exec -T timescaledb psql -U postgres -f - < db/migrations/NNN_x.sql`).
- IDs are UUIDs (`gen_random_uuid()`) except `tipos_sensor.id` (SERIAL, small fixed catalog).
- `mediciones.sensor_id` intentionally has no FK constraint — a Timescale recommendation for hypertables at this scale.

## ESP32 firmware (`esp/`)
- `programa_base.ino` is the template holding all the common logic (WiFi provisioning, secret in NVS, rotation, sending readings), marked with `// Replace ->` comments. The sketches under `programas/` are **generated** from it by `python esp/generar_sketches.py` — never hand-edit them, the next run overwrites the file. Common-logic changes go in the template; a new order means a new entry in that script's `SKETCHES` dict (device/sensor UUIDs, secret, sensor include/init/read function). `modulos/*.ino` are reference snippets, not compiled.
- Compile check without hardware: `arduino-cli compile --fqbn esp32:esp32:esp32 esp/programas/<sketch>` (the Arduino IDE ships the binary under `resources/app/lib/backend/resources/`).
- Firmware sends `POST {API_URL}` with `X-Dispositivo-Id` and `Authorization: Bearer <secret>` headers and a `{"mediciones": [{"sensor_id", "value", "time"}, ...]}` body, matching `schemas/medicion.py` / `get_dispositivo_autenticado`. `time` is ISO-8601 UTC (`...Z`) and optional: omitted, the backend stamps the reading with its arrival time. It reads back `intervalo_sugerido` from the response to adjust its own read interval at runtime.
- **Readings are buffered, not sent inline.** `leerYBufferizar()` pushes each reading into a static RAM ring buffer (`CAPACIDAD_BUFFER` entries, ~12 h at 60 s with 2 sensors) and `flushBuffer()` drains it oldest-first in chunks of `MAX_POR_ENVIO`, one chunk per `loop()` pass so the BOOT button stays responsive while draining. The queue only advances on a 2xx; a failed POST is simply retried, which is safe thanks to the unique index. When the buffer fills, the oldest entry is overwritten and counted in `descartadasPorOverflow` — fresh data wins. RAM only, on purpose: with no power there is nothing to save, and flushing to NVS every 60 s wears the flash.
- Because of this, `loop()` reads the sensors **before** the WiFi check — the old early `return` meant an outage produced no data at all, not just no upload.
- Each entry stores a `uint8_t` index into `SENSOR_IDS`, not the UUID string (12 bytes vs ~48 per reading). The generator emits that enum + array per sketch.
- The clock comes from SNTP (`configTime(0, 0, ...)`, UTC) right after the WiFi connects. Readings taken before the first sync are buffered with `epoch = 0` and sent without `time`; only the first few readings of a cold boot without internet are affected.
- WiFi is **not** hardcoded: the sketches use `WiFiManager` (SoftAP + captive portal). With no saved network the board raises the `SensoresIoT-Setup` AP and the customer loads their WiFi from a phone; credentials persist in flash. Holding the BOOT button (GPIO0) for 5 s **while the board is already running** wipes them and reopens the portal; the check lives in `loop()` (`chequearResetWifi`), and the whole loop is kept free of blocking delays so the press can actually be timed. It deliberately does **not** run at startup: GPIO0 is a bootstrap pin, so holding it during reset puts the ESP32 in bootloader mode and the sketch never runs.
- The device secret lives in NVS (`Preferences`, namespace `dispositivo`). `SECRET_DISPOSITIVO_INICIAL` is only the factory value copied to NVS on first boot; after a rotation the NVS copy is what gets sent.
- `API_BASE`, `DISPOSITIVO_ID`, `SECRET_DISPOSITIVO_INICIAL` and the sensor UUIDs are still hardcoded per-sketch and set at compile time, one build per order.
- **Compile with the `huge_app` partition scheme**: `arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app esp/programas/<sketch>` (or Tools → Partition Scheme → "Huge APP (3MB No OTA/1MB SPIFFS)" in the IDE). The default scheme splits flash into two ~1.25 MB app partitions for OTA rollback safety — a feature this project doesn't use (OTA is explicitly deferred; each order is compiled and flashed by hand). `huge_app` gives one 3 MB app partition instead (~38% used today vs. ~92% under `default`), which is the actual per-order headroom for adding sensor libraries. The NVS partition (where the device secret lives) sits at the same offset/size under both schemes, so this doesn't affect anything already flashed. The only real cost is giving up OTA-with-rollback, which isn't built anyway; revisit if OTA ever gets implemented.
- **The measurement buffer is capped at `CAPACIDAD_BUFFER = 6000` entries by a linker limit, not a design choice.** The ESP32 linker reserves a fixed, much-smaller-than-total region (`dram0_0_seg`, ~124 KB measured on this build) for global/static arrays like `Lectura buffer[N]`; `WiFiManager` + `HTTPClient` + `ArduinoJson` alone already use ~50 KB of it, so ~6150 entries is roughly the hard ceiling regardless of the chip's 320 KB of RAM — independent of the flash partition scheme above. 6000 was chosen deliberately understaying that ceiling rather than heap-allocating the buffer (`malloc` in `setup()` would lift the cap, since the heap is a separate, larger pool) — heap allocation moves a compile-time-verified limit to a runtime one (a failed `malloc` has to be handled explicitly, and a successful compile no longer proves the buffer fits), which was judged not worth it for the capacity gain. If a future order needs more autonomy than `CAPACIDAD_BUFFER` allows at its reading interval, that's a real trade-off to bring back for a decision, not something to just bump.


## Frontend
There is none in this repo. A throwaway Vite/React scaffold used to eyeball the chart endpoints was deleted once it had served its purpose (recoverable from git history if ever needed). The real frontends are Tier 5 of the roadmap and have not been started — do not assume any client code exists.


# Contexto del proyecto — Plataforma IoT (sensores ambientales)

## Rol esperado del asistente

Socio técnico y de negocio, no ejecutor pasivo. Cuestionar decisiones cuando hay riesgo, inconsistencia o mejor alternativa, con motivo explícito. No inventar objeciones si la idea es sólida. Priorizar señalar: deuda técnica, decisiones que no escalan, riesgos legales/regulatorios de hardware IoT, errores de arquitectura. Si falta info clave, preguntar antes de asumir. Responder siempre en español argentino, tono directo, sin introducciones de cortesía, sin agregar contexto no solicitado.

## Negocio

Vendemos un dispositivo de hardware: ESP32 con sensores ambientales integrados, que envía datos a una API propia (FastAPI + TimescaleDB). Los datos se consumen desde una aplicación web. Se planea un modelo freemium con features premium.

## Stack (cerrado, no cuestionar salvo problema real)

ESP32 (firmware en C++/Arduino), FastAPI (Python), TimescaleDB (Postgres + extensión time-series), psycopg2 (sin ORM).

## Objetivo de frontend (pendiente, no arrancado)

3 frontends: Landing Page (venta), Página de Consumo (`app.dominio`, dashboard del cliente), Panel de Administración (`admin.dominio`, gestión interna). Los CRUDs del panel de admin se van a delegar más adelante a Claude Code — no priorizar su diseño ahora.

## Roadmap priorizado

### Tier 3 — Crítico para poder fabricar y vender en escala (bloqueante de negocio, no solo técnico)

**Nota de alcance**: no se está planeando producción en volumen por ahora. El punto 3.2 originalmente contemplaba un mecanismo de claim_code para fabricación en serie con firmware idéntico — se descartó esa parte porque el flujo real de la empresa es: cada pedido tiene una combinación de sensores distinta (librerías distintas por sensor), y el firmware se compila a mano por pedido de todas formas. El claim_code resolvía un problema de escala que no existe en este momento. Si en el futuro se decide fabricar en volumen con firmware único, retomar esa idea junto con auto-detección de sensores por dirección I2C (evita tener que saber de antemano qué sensores lleva cada unidad).

**3.1 — Provisioning de WiFi**
Hoy el SSID/password están hardcodeados en el `.ino` — inviable para vender a clientes reales. Patrón: **SoftAP + portal cautivo** (librería `WiFiManager` para ESP32). Al primer boot o si no hay red guardada, el dispositivo se convierte en su propio AP, el cliente se conecta desde el celular, carga su WiFi en un portal, el ESP32 guarda las credenciales en flash (NVS) y reinicia conectado. SoftAP preferido sobre BLE por compatibilidad (Web Bluetooth no anda en iOS Safari).

**3.2 — Secret del dispositivo: alta y rotación**

*Alta (flujo actual, se mantiene sin cambios):* al crear un pedido, se generan a mano en la DB el registro de `dispositivo` y sus `sensores` correspondientes según lo que pidió el cliente. El alta devuelve `dispositivo_id` (no sensible, se hardcodea en el `.ino`) y `secret` en texto plano (se hardcodea también, se compila junto con las librerías del/los sensor/es de ese pedido específico). El backend guarda solo el hash SHA256 del secret. Este flujo es aceptable porque no hay producción en volumen — no hace falta desacoplar la generación del secret del compile-time.

*Rotación — problema detectado y a resolver:* existe hoy un endpoint de regeneración de secret, pero requiere acceso físico al dispositivo para reflashear con el secret nuevo devuelto. Sirve para banco de pruebas/fábrica, pero no sirve una vez que el equipo está instalado en la casa de un cliente — si un secret se filtra en producción, hoy no hay forma de rotarlo sin recuperar el equipo.

**A implementar**: endpoint de rotación **device-initiated**, coherente con el principio de que el ESP32 siempre inicia la conexión, nunca escucha:
- El dispositivo llama al endpoint autenticado con su `X-Dispositivo-Id` + `Authorization: Bearer <secret_actual>` (mismo mecanismo que ya usa para mandar mediciones).
- El secret viejo sigue siendo válido hasta el momento exacto de la rotación (no se invalida de entrada).
- El backend genera un secret nuevo, lo devuelve una única vez en esa respuesta, guarda el hash nuevo e invalida el viejo.
- El firmware recibe el secret nuevo y lo reescribe en NVS.
- Disparador de la rotación: reusar el mismo mecanismo pensado para `intervalo_sugerido` (Tier 2.3) — el backend puede devolver un flag en cualquier response normal indicando "rotá tu secret la próxima vez que te conectes" — o un timer propio del firmware (rotación cada X meses). A definir cuál.

El endpoint manual existente se mantiene, pero se limita a uso de banco de pruebas/fábrica (equipo con acceso físico), no como mecanismo de producción.

**Pendiente de definir, no resuelto (bloqueante antes de mandar la primera tanda real a clientes)**:
- **Flash encryption del ESP32**: hoy se desconoce si está habilitada — probablemente no (viene deshabilitada por default en el framework). Es configuración por software pero graba la clave en eFuses de hardware: **irreversible y de una sola vez** por unidad, no se puede activar retroactivamente en equipos ya fabricados/entregados. Sin esto, el secret hardcodeado en el binario es extraíble por cualquiera con acceso físico al dispositivo (dump de flash por USB/serial), independientemente de que exista rotación o no. Verificar estado actual y decidir antes de la primera tanda que salga de fábrica hacia un cliente real — no antes de seguir desarrollando/probando.

**Este tier (3.1 + 3.2) sigue siendo bloqueante real antes de vender a clientes reales** — no por volumen de fabricación (eso ya no aplica), sino porque sin WiFi provisioning no se puede configurar un equipo sin conocer la red del cliente al fabricar, y sin rotación de secret + definición de flash encryption no hay forma segura de operar el dispositivo una vez instalado fuera de tu control físico.

### Tier 4 — Monetización (prerequisito de las features premium)

**4.1 — Modelo de planes + integración de pago**
Ninguna feature premium (alertas, multi-usuario, resolución de muestreo, retención extendida) se puede gatear sin que exista antes el concepto de plan/suscripción en el modelo de usuario (qué plan tiene, vigencia, qué habilita) y el cobro asociado. Hacer esto antes que cualquier feature premium puntual, para no reescribir el gate de acceso después.

*Medio de pago*: **Mercado Pago**, no Stripe. Stripe no soporta cuentas argentinas y el público objetivo es sólo Argentina. Para suscripciones recurrentes en ARS la API es `preapproval`, que notifica cada cobro autorizado por webhook. Los webhooks de MP se reintentan y pueden llegar duplicados o fuera de orden, así que el alta tiene que ser idempotente.

*Estado*: el modelo de datos ya está implementado (tablas `planes` y `suscripciones`, `db/migrations/003_planes_suscripciones.sql`); falta sólo la integración de cobro. Ver "Planes y suscripciones" en Backend architecture.

**4.2 — Exportar historial a CSV, XLSX (Premium?)**
Permite exportar el historial de un sensor a un archivo csv o xlsx, resta definir si es una feature premium.

**4.3 — Alertas (premium)**
La feature funcional más barata de implementar y la que mejor aprovecha lo ya construido: evaluar `value` contra un umbral en el mismo flujo de `crear_medicion` (o job separado si se prefiere desacoplar), notificar por mail (ya hay Resend integrado). Push/SMS quedaría para más adelante con otro proveedor.

**4.4 — Multi-usuario (viewer/editor) — premium**
Requiere rediseñar el patrón central de ownership (`_tiene_acceso_a_dispositivo`), hoy binario (dueño o admin). Pasar a roles intermedios implica tocar el patrón de autorización replicado en varios endpoints — no es agregar una tabla y ya. Dejar para después de que el pricing y el patrón de ownership actual estén asentados en producción, para no tocar dos piezas grandes a la vez.

**4.5 — Chat de IA — en duda, no priorizar sin validación**
Es la feature más cara de forma recurrente (costo de tokens por request) y la más compleja de armar bien (dar contexto real de mediciones al modelo sin alucinar, manejar rangos de fechas). No queda claro qué dolor real resuelve para un comprador de sensor ambiental (que típicamente quiere ver un gráfico y recibir alertas, no chatear). Sacar del roadmap cercano salvo que aparezca demanda concreta de usuarios reales con un caso de uso específico.

### Tier 5 — Frontend (después de cerrar Tier 1-3 del backend como mínimo)

**5.1 — Interceptor de refresh automático (axios)**
Pieza de infraestructura a armar antes de las pantallas de dashboard — maneja la renovación silenciosa del access token cuando expira (30 min).

**5.2 — Arranque de los 3 frontends**
Landing → Página de consumo (`app.dominio`, dashboard + gráficos + historial) → Panel de admin (`admin.dominio`, CRUDs a delegar más adelante a Claude Code).

### Diferido explícitamente (no tocar salvo que cambien las condiciones)

- **Google OAuth**: after Tier 5 (post-frontend), salvo compromiso externo (demo, cliente puntual) que lo adelante. Motivo: el login por password ya funciona end-to-end, OAuth reduce fricción de registro pero no es bloqueante; además obliga a definir modelo de datos de usuario (password_hash nullable, tabla de providers, account linking) justo antes de diseñar pantallas de perfil que dependen de ese mismo modelo — mejor definirlo una sola vez con todo el contexto.
- **Riesgo legal/regulatorio** (derecho al borrado/exportación de datos personales al eliminar cuenta): usuario pidió explícitamente verlo más adelante. Queda como pendiente de definición, no resuelto — retomar antes de operar en jurisdicciones con protección de datos personal (ej. Europa) o antes de escalar la base de usuarios.

Cada vez que hagas modificaciones en un código y dejes comentarios, no comentes la modificación en sí y que hacía el código anteriormente, solo comenta la funcionalidad actual.
No agregues comentarios de cosas que se sobreentienden, solo en partes donde el codigo o la implementación es compleja o da lugar a ambiguedades.