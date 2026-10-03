# CLAUDE.md

## Proyecto

Plataforma IoT de sensores ambientales (marca **Bitácora**): placas ESP32 con firmware Arduino hacen POST de lecturas a un backend FastAPI que guarda en TimescaleDB. Partes: `backend/` (FastAPI + psycopg2, sin ORM), `db/` (schema y migraciones), `esp/` (firmware), `frontend/` (app de cliente, React) y `landing/` (Astro, venta).

## Rol esperado del asistente

Socio técnico y de negocio, no ejecutor pasivo. Cuestionar decisiones con riesgo, inconsistencia o mejor alternativa, con motivo explícito; no inventar objeciones si la idea es sólida. Priorizar: deuda técnica, decisiones que no escalan, riesgos legales/regulatorios de hardware IoT, errores de arquitectura. Si falta info clave, preguntar antes de asumir. Español argentino, directo, sin cortesías ni contexto no pedido.

Stack cerrado (no cuestionar salvo problema real): ESP32 (C++/Arduino), FastAPI, TimescaleDB, psycopg2.

## Comandos

- **Backend** (desde `backend/`, con `venv`): `uvicorn main:app --reload --host 0.0.0.0 --port 8000`. Sin tests ni linter.
- **Docker** (raíz): `docker compose up` levanta `timescaledb` + `api`. `docker-compose.yml` es la base tipo producción; `docker-compose.override.yml` se mergea en dev (Postgres en host `5433`, `./backend` montado, `--reload`). Requiere `.env` en la raíz (ver `.env.example`).
- **Frontend** (desde `frontend/`): `npm run dev` (:5173), `npm run build`, `npm run lint` (oxlint), `npx tsc --noEmit -p tsconfig.app.json`. Sin tests.
- **Firmware enchufado**: `python esp/generar_sketches.py`; compilar con `arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app esp/programas/<sketch>`.
- **Firmware a batería** (`prueba_*`): la librería `esp/nucleo/` tiene que estar en el sketchbook, una sola vez: `mklink /J "%USERPROFILE%\OneDrive\Documentos\Arduino\libraries\Nucleo" <repo>\esp\nucleo` (junction, sin admin). Compilar con `arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app --library esp/nucleo esp/prueba_bmp`. Los sketches LoRa necesitan además la librería `LoRa` (Sandeep Mistry).

## Base de datos

- Schema en `db/init.sql`, que **sólo corre con volumen nuevo**. No hay herramienta de migraciones: todo cambio va en **dos** lugares, plegado en `init.sql` y como script numerado en `db/migrations/` que se aplica a mano (`docker compose exec -T timescaledb psql -U postgres -f - < db/migrations/NNN_x.sql`).
- IDs UUID (`gen_random_uuid()`), salvo `tipos_sensor.id` (SERIAL) y `planes.id` (TEXT, ver Planes).
- `mediciones.sensor_id` no tiene FK a propósito (recomendación de Timescale para hypertables).

## Backend

### Capas

```
routers/      endpoints, auth dependencies, rate limits
services/     lógica de negocio y autorización; orquesta repos en una transacción
repositories/ SQL crudo, cursor como primer argumento, sin lógica de negocio
schemas/      modelos Pydantic
core/         config, security, deps, limiter, email, tareas (background)
```

- **Un módulo por entidad, no por prefijo de URL.** `dispositivo_*` es sólo la tabla `dispositivos`; `usuario_dispositivo` es `acceso_*` e `invitacion_dispositivo` es `invitacion_*`, aunque sus URLs cuelguen de `/dispositivos/{id}/...`. Para eso `routers/accesos.py` e `invitaciones.py` son subrouters `include_router`'d desde `dispositivos.py` (sin `prefix`, paths completos), igual que `suscripciones.py` desde `usuarios.py`. Es el patrón para cuando un router junte endpoints de una segunda entidad; el chequeo de que un movimiento así no rompió nada es un diff byte a byte de `app.openapi()`.
- Cada función de servicio abre su `get_cursor()` / `get_connection()` (`db.py`): commit al salir, rollback ante excepción. Una operación de varios pasos comparte un cursor/transacción, nunca se parte en conexiones.
- Los repos nunca lanzan `HTTPException` ni chequean permisos; los servicios sí.
- Nombres y mensajes en español (`crear_`, `obtener_`, `buscar_`).
- **La autorización vive sólo en servicios**, vía `dispositivo_service.rol_en_dispositivo(cur, dispositivo_id, usuario_id, rol)` → `'admin' | 'owner' | 'editor' | 'viewer' | None` y tres wrappers: `validar_acceso_al_dispositivo` (cualquier rol), `validar_edicion_en_dispositivo` (`ROLES_EDICION`: admin/owner/editor) y `validar_owner_en_dispositivo` (`ROLES_OWNER`: admin/owner). Resuelven primero el equipo: inexistente = 404, prohibido = 403. Nunca consultar `usuario_dispositivo` a mano.

### Auth

- **Usuarios**: bcrypt + JWT de acceso (30 min, en el body) + refresh (7 días) en cookie `httponly`, guardado hasheado en `refresh_token`. Fuera de dev la cookie es `secure` + `samesite=strict`; con `ENTORNO=dev` va sin `secure` y `samesite=lax` (http://localhost). Dependencias: `get_usuario_actual`, `get_usuario_admin`, `get_usuario_propio_o_admin`.
- **Equipos**: secret por equipo, sólo su SHA-256 en `dispositivos.secret_hash`. Viaja como `Authorization: Bearer <secret>` + `X-Dispositivo-Id`, comparado con `hmac.compare_digest` en `get_dispositivo_autenticado` (que hace `SELECT *`: `intervalo_configurado_seg`, `first_connected_at` y `rotacion_pendiente` llegan gratis).
- **Rotación iniciada por el equipo** (`POST /dispositivos/rotate-secret`): se autentica con el secret actual y recibe uno nuevo una vez. Durante la rotación valen dos (`secret_hash` + `secret_hash_anterior`); el viejo se borra la primera vez que el equipo llega con el nuevo. Invalidarlo antes brickearía un equipo que no recibió la respuesta. Un admin la fuerza con `POST /dispositivos/{id}/marcar-rotacion`, que vuelve como `rotar_secret` en la respuesta de `/mediciones/`. `POST /dispositivos/{id}/regenerate-secret` exige reflashear: sólo banco/fábrica.
- Rate limit `slowapi` por IP, por ruta: login, register, resend-verify-email, vinculate, rotate-secret y exportar.

### Mediciones (`POST /mediciones/`)

La respuesta es **el plano de control del equipo**: `server_epoch`, `intervalo_sugerido_seg`, `intervalo_contacto_seg`, `umbrales`, `rotar_secret`. Por eso el heartbeat usa este mismo endpoint y no uno propio.

- **Dos números separados a propósito.** `UMBRAL_THROTTLE` (10 s) es lo que el servidor *acepta escribir*: sólo frena firmware roto. `intervalo_sugerido_seg` es lo que el equipo *debería hacer*: `max(intervalo_configurado_seg, piso del plan)`, salvo en el **arranque rápido** (`first_connected_at` más joven que `VENTANA_ARRANQUE` = 30 min, o `None`, que el mismo POST sella) donde devuelve `INTERVALO_ARRANQUE_SEG` (15 s) sin importar el plan. Estuvieron acoplados y eso descartaba todo lo que llega antes a propósito (flush de alerta, arranque rápido). No volver a acoplarlos.
- **Las lecturas llegan tarde y fuera de orden**: el firmware bufferea y manda cada una con su `time` original. Por eso cada candidata se compara contra sus *vecinas* reales (`medicion_repo.mediciones_en_ventana`); un timestamp existente es `duplicada`, no una violación de intervalo; todo entra con un `execute_values` + `ON CONFLICT DO NOTHING`; y `last_seen_at` es `now()`, nunca el `time` de la lectura.
- El índice único `(sensor_id, time)` es lo que hace seguros los reintentos: el equipo reenvía todo chunk sin 2xx, incluso los ya insertados.
- Sensor inválido, timestamp fuera de rango (futuro o más viejo que `ANTIGUEDAD_MAXIMA`, 90 días) o lectura demasiado pegada se cuentan, nunca fallan el batch entero.
- `crear_medicion` abre un **segundo cursor, dict, sobre la misma conexión** para plan y alertas: el principal devuelve tuplas porque `sensor_repo.ids_por_dispositivo` y `mediciones_en_ventana` desempaquetan por posición.
- **La escritura nunca se recorta por retención**: `ANTIGUEDAD_MAXIMA` sigue la retención del raw, no el plan. Un free escribe igual de profundo y sólo ve menos; el día que sube de plan el historial ya está.

### Series temporales

- `mediciones` es hypertable (`time`/`sensor_id`/`value`) con dos continuous aggregates (`mediciones_por_hora`, `mediciones_por_dia`). Retención: raw 90 días, horario 1 año, diario indefinido.
- **Estrategia por niveles** (`medicion_repo.FUENTES`, de fino a grueso): para un rango se elige la tabla más barata que cumple la resolución *y* todavía retiene datos tan atrás, cayendo a una más gruesa antes que devolver vacío. `resolucion_grafico` es el único punto de decisión: devuelve `(fuente, bucket)` y tanto `buscar_puntos` como `buscar_resumen` reciben ese mismo par, lo que les impide discrepar.
- `bucket` es `None` si el conteo real de lecturas del rango entra en `TOPE_CRUDO` (1000): vuelven crudas, porque un bucket más fino que el muestreo sólo crea huecos y uno más grueso tira resolución. Encima del tope el objetivo son ~200 buckets (`TARGET_PUNTO`), con piso en `plan_service.intervalo_efectivo_seg`. Leer los comentarios del archivo antes de tocar la selección.
- **Ventana de refresh de los CAGG: 85 días** (`start_offset` de las dos policies). Una fila backfilleada fuera de esa ventana nunca se rematerializa y desaparece de cualquier gráfico servido desde un agregado, así que tiene que cubrir el horizonte máximo de buffer del firmware (90 d con la cola en flash del firmware a batería). Y tiene que quedar **debajo** de la retención raw (90 d): refrescar un tramo cuyo raw ya se borró lo recalcula vacío y borra el agregado. Lo que llega con 85–90 días de atraso vive sólo en raw.

### Planes y suscripciones

- `planes` es un catálogo fijo (`free`, `premium`). `id` es TEXT porque `'free'` se referencia como literal estable (fallback de falla cerrada). `NULL` = ilimitado en `dispositivos_incluidos`, `retencion_dias` y `max_alertas`.
- **Semilla actual** (`init.sql` y `plan_service.LIMITES_FREE`, que la espeja): free = 7 días de retención, piso 60 s, sin alertas (`max_alertas` 0), sin compartir; premium = sin límite de retención, piso 15 s, alertas sin tope, compartir. Ambos exportan (migración 005). Ningún plan limita cantidad de equipos.
- **Una suscripción está vigente sólo por fechas**: `inicio_at <= now() AND (fin_at IS NULL OR fin_at > now())`. `estado` (`activa`/`cancelada`/`revocada`) registra intención y **nunca** entra al predicado: cancelar no toca `fin_at`. No existe `vencida`; el vencimiento se deriva.
- **Free es la ausencia de suscripción vigente**, no una fila.
- `EXCLUDE USING gist (usuario_id WITH =, tstzrange(inicio_at, fin_at) WITH &&)` (de ahí `btree_gist`) cierra la carrera del 409 check-then-act. El rango es `[)`, así que revocar con `fin_at = now()` y reasignar con `inicio_at = now()` no chocan.
- **`services/plan_service.py` es la única fuente de límites**: `limites_de_usuario`, `limites_de_dispositivo`, `limites_de_dispositivos` (lote, para el panel) y `ventana_de_consulta`. Reciben cursor porque corren dentro de transacciones abiertas y devuelven la fila de `planes` tal cual. **No lanza nada**: el CRUD de suscripciones (`asignar_plan`, `revocar_plan`, `listar_suscripciones`, admin, bajo `/usuarios/{id}/suscripcion*`) y sus `HTTPException` viven en `suscripcion_service.py`.
- **Todo lo de un equipo sale del plan de su *owner*** (retención, intervalo, alertas): un free con acceso compartido ve exactamente lo que ve el dueño. Sólo los **límites de cuenta** (compartir los equipos propios) leen el plan de quien pide.
- Falla cerrada = *dato indeterminado* → free, no errores tragados. No envolver en `try/except`: tras un error de psycopg2 la transacción queda abortada igual.
- Los downgrades sólo dejan de leer más; nada se borra. Revocar pone `fin_at = now()` y conserva la fila.

**Gates con consumidor**: `retencion_dias`, `intervalo_minimo_seg`, `puede_alertas`/`max_alertas` y `puede_compartir`. `puede_exportar` es `true` en ambos y queda como palanca.
- **`retencion_dias` — recorte de consulta.** `ventana_de_consulta` lo convierte en un `piso` (instante más viejo consultable, `None` = sin límite) aplicado en `obtener_grafico`, `obtener_historial` y el export. **Sube `desde`, nunca da error**: `/grafico` devuelve `desde_efectivo` / `recortado` / `retencion_dias`, y un rango entero fuera de la ventana vuelve vacío con 200. En `/historial` el piso baja a `buscar_historial` y corta la paginación solo. Subir `desde` sólo achica la antigüedad, así que el nivel elegido nunca empeora. **Admin exento** (límite comercial, no control de acceso: soporte tiene que ver lo que reporta un cliente).
- **`intervalo_minimo_seg` — piso de publicación, no de muestreo** (el muestreo es 15 s fijo en el firmware). Se calcula por request, nunca se guarda recortado: un downgrade no pisa el valor elegido por el owner, que puede pedir uno *más lento* con `PATCH /dispositivos/{id}/intervalo` (`intervalo_seg: null` = automático). **Lista cerrada de presets** (`PRESETS_INTERVALO_SEG` = 1/5/15/30 min) filtrada por el piso en `intervalos_disponibles(piso)`, que también alimenta `limites.intervalos_disponibles` de `GET /dispositivos/{id}`: una sola fuente para el control.

### Export (`GET /dispositivos/{id}/exportar`)

CSV del equipo completo con los sensores pivoteados en columnas sobre un eje de tiempo común. `services/exportacion_service.py` es el único streaming: leerlo antes de agregar otro.

- El único límite es `ventana_de_consulta`, igual que `/grafico`. Un rango totalmente recortado da 200 con CSV sólo con encabezado.
- **Por default: todo el rango y sin bajar resolución.** Sin `desde`, arranca en `medicion_repo.inicio_historial` (`LEAST` del `min()` del diario y del raw: el raw sólo tiene 90 días y un equipo recién instalado todavía no tiene nada materializado en el diario; `LEAST` ignora NULLs). Sin `intervalo_seg`, `iterar_pivot` agrupa por el timestamp guardado tal cual; agrupar por `intervalo_configurado_seg` estaría mal porque es la config de hoy, no una propiedad de los datos. El `avg()` ahí es un passthrough para que el pivot con `FILTER` tipe.
- **`intervalo_seg` es agregación opt-in e invierte la selección de fuente** (`fuente_para_export`): sin intervalo recorre `FUENTES` de fino a grueso (máxima fidelidad); con intervalo usa `_elegir_fuente` (1 h sobre dos meses sale del horario). No unificar: los objetivos se contradicen.
- **Agregar cambia la forma del CSV** (prom/min/max por sensor): `export_con_stats(fuente, bucket)` es el único predicado, true si la fuente es pre-agregada o se pidió intervalo. Un intervalo más fino que la fuente sobreviviente se sube a su granularidad; `X-Intervalo-Seg` informa el bucket efectivo y `X-Fuente` la tabla.
- **`GROUP BY 1`, no `GROUP BY bucket`**: en los agregados la columna ya se llama `bucket` y Postgres resuelve el nombre ambiguo contra la columna de entrada, ignorando el intervalo pedido.
- Pivot por instante: el firmware estampa cada sensor por separado (segundos enteros), así que una pasada partida en dos segundos da dos filas medio vacías. Trade-off aceptado: la alineación es cosmética, la completitud no.
- **Dos fases, porque la conexión tiene que sobrevivir al handler.** `preparar_export_dispositivo` valida en un `get_cursor()` corto —**todo `HTTPException` posible se lanza ahí**— y devuelve un generador que abre su conexión con `db.get_cursor_streaming` (cursor server-side, el único del código) cuando Starlette empieza a iterar. **Nunca lanzar `HTTPException` en el generador**: el 200 ya salió y sólo trunca la descarga.
- `main.py` expone `Content-Disposition` y los `X-*` en `expose_headers` del CORS: sin eso el `fetch` no lee nombre de archivo ni metadata del recorte (y un `<a href>` no puede llevar el JWT).

### Alertas

Reglas de umbral sobre un sensor (`mayor`/`menor` + `histeresis`), evaluadas inline en `crear_medicion` justo después de `insertar_muchas`, en la misma transacción. `alerta_service.py` tiene la máquina de estados; `alerta_repo.py` es SQL plano.

- **La alerta es del equipo, no de quien la creó** (`creado_por` es informativo, `ON DELETE SET NULL`). CRUD en `/alertas/` y `/alertas/{id}`; listados por equipo en `GET /dispositivos/{id}/alertas` y `/alertas/eventos`, y log global en `GET /alertas/eventos`. Owner/editor crean, editan y borran; viewer lee.
- **Gate: `puede_alertas` del plan del owner del equipo**, y `max_alertas` se cuenta **por equipo** (`contar_por_dispositivo`).
- `tipos_sensor` no tiene rango físico (migración 008): el umbral se acepta como viene.
- **El estado (`normal`/`disparada`) se persiste**: cada request sólo ve su batch y sin estado no se distingue "acaba de cruzar" de "ya estaba". La histéresis es la vuelta: `mayor` necesita `valor < umbral - histeresis` para volver a `normal`.
- **La transición exige `muestras_confirmacion` lecturas seguidas** (default 3, máx 8 = `VENTANA_MUESTRAS` del firmware). `cruces_consecutivos` se persiste porque un batch puede cortar la racha; cualquier lectura que no empuja la resetea, y también una transición. Simétrico en ambas piernas. Es lo que impide que una lectura corrupta aislada mande un mail.
- `_empuja(estado, condicion, umbral, histeresis, valor)` es un predicado puro y **el firmware lo espeja literal** (`empuja()` en `programa_base.ino`). Si divergen, el equipo adelanta envíos que el servidor no confirma. Tras tocar cualquiera de los dos: traducir el C a Python y comparar transiciones sobre series aleatorias.
- **El equipo puede adelantar un cruce, pero es un disparador de envío, no un motor de alertas.** La respuesta trae `umbrales` (copia plana de las reglas activas con su `disparada` como estado inicial, gateada por `puede_alertas`, reconstruida en cada respuesta). En una **transición** —no un estado— el firmware manda ya las últimas `muestras` lecturas crudas. No notifica ni decide nada: `evaluar_batch` sigue siendo la única verdad, y disparar por transición es lo que cierra el abuso (una regla `temp > 0` en una sala a 20 °C dispara una vez y nunca más).
- **`ultima_evaluacion_at` es el `time` de la última lectura evaluada**, no `now()`: lo `<=` se saltea, así un chunk reenviado no redispara y un batch fuera de orden no camina la máquina hacia atrás.
- **Los datos tardíos se evalúan.** Toda transición va a `alerta_eventos` (`tardio = true` si la lectura tiene más de `FRESCURA`, 5 min), pero **sólo se manda mail por la última transición de cada regla en el batch**: un flush de 12 h que oscila 50 veces manda un mail.
- La recuperación (disparada → normal) también notifica.
- **Destinatarios: todos los que tienen acceso al equipo; se silencia por equipo, no por regla.** La preferencia es `usuario_dispositivo.notificar`, y `acceso_repo.destinatarios(cur, dispositivo_id)` es un `SELECT` sobre esa tabla: sirve igual para umbrales y conectividad (`evaluar_batch` lo memoiza por equipo). `PUT /dispositivos/{id}/notificaciones` (cualquier rol) es el único escritor, y el `UPDATE` acotado a `(dispositivo_id, usuario_id)` *es* la autorización.
- `evaluar_batch` pone `destinatarios` en la transición que se va a mandar; `notificar_eventos` llena `notificados` después de enviar, con try/except por dirección. Es el único escritor de `notificados` y elige plantilla por `notificacion["tipo"]`: no duplicar ese loop.
- **El mail sale por `BackgroundTasks`**, después de responder: `resend.Emails.send` es HTTP bloqueante y el ESP32 no puede esperarlo. Patrón fire-and-log (`try/except` + `print`).

**`alerta_eventos` es el log de avisos del equipo, con dos formas** distinguidas por `tipo` (`disparada`/`normalizada` vs `sin_reportar`/`reconectado`) y forzadas por un `CHECK`. `dispositivo_id` (NOT NULL) es el ancla de scope y autorización.
- **La regla se guarda como snapshot en el evento, nunca por JOIN** (`alerta_nombre`/`condicion`/`umbral`/`tipo_sensor_*`): las reglas se editan y un JOIN mostraba un evento viejo contra el umbral de hoy. Los listados sólo joinean `dispositivos` para `d.nombre`.
- **`alerta_id` es `ON DELETE SET NULL`**: borrar una regla no borra el historial. Por eso el discriminador no puede ser `alerta_id IS NULL`: la rama de regla del `CHECK` no exige `alerta_id IS NOT NULL` y la de conectividad sí exige `IS NULL`. `idx_alerta_eventos_alerta` es parcial (`WHERE alerta_id IS NOT NULL`).

### Liveness: heartbeat y "dejó de reportar"

- **El equipo habla cada 5 min publique o no** (`POST /mediciones/` con `mediciones: []`, no escribe filas). Publicar cuenta como hablar, así que el heartbeat sólo rellena huecos. `dispositivo_service.INTERVALO_CONTACTO_SEG` (300) viaja como `intervalo_contacto_seg`: con compilación por pedido, una constante en la placa es una decisión que se arrastra años.
- **`esta_online(last_seen_at)` es el único predicado de liveness**: `VENTANA_SIN_REPORTAR_SEG` = 3 × contacto = **15 min, igual para todo equipo**, y lo usan la pantalla (`online` en `/estado`, panel y `/usuarios/{id}/dispositivos`) y el mail. Cuando la pantalla dice "sin reportar", el mail ya salió. Antes colgaba de 3 × la cadencia de publicación (3 a 90 min según preset).

| Columna | Se escribe | Contesta | Umbral |
|---|---|---|---|
| `last_seen_at` | todo POST aceptado | ¿está vivo? | 15 min fijos |
| `last_data_at` | sólo si el batch trae filas | ¿llegan sus lecturas? | 1,5 × intervalo de publicación |

Sin la separación, un equipo con el bus I2C muerto (una lectura fallida no bufferea nada) heartbeatea para siempre y figura "En línea". Limitación conocida: ese caso se ve como `con-retraso`. `intervalo_modificado_at` existe porque el equipo se entera del intervalo nuevo recién en su próximo contacto: la gracia es `contacto + 1,5 × nuevo`, sin guardar el anterior.

**Vigilancia** (`vigilancia_service.barrer()`): el único aviso que no se evalúa inline, porque lo dispara la *ausencia* de un POST. Corre cada 60 s en una tarea asyncio del lifespan (`core/tareas.py`), vía `asyncio.to_thread`. **No lo gatea ningún plan**: un producto de monitoreo cuyo cliente cree estar cubierto y no lo está falló de la peor forma. El opt-out es `notificar`.
- `dispositivos.sin_reportar_desde` guarda el `last_seen_at` congelado al detectar (no el instante): es el latch (NULL = sin caída abierta, sin mail por minuto) y lo único que sabe cuánto duró el corte cuando el equipo vuelve.
- `candidatos_de_vigilancia` es el predicado completo en una query; el barrido no resuelve planes.
- Las dos piernas en un barrido, una transacción y mails después del commit: un commit por equipo dejaría caídas latcheadas sin mail. El `RETURNING` de `abrir_sin_reportar` (con `AND last_seen_at = %s`, concurrencia optimista) es lo que habilita el mail, no el `SELECT`.
- `pg_try_advisory_xact_lock` evita dos barredores (réplicas, `--reload` en dev); es lo único que lo impide si algún día hay varios workers.
- `medicion_at` de una apertura es `clock_timestamp()`: fechar por `last_seen_at` entierra el evento páginas atrás, y `now()` es fijo por transacción, con lo que dos equipos del mismo barrido compartirían timestamp y el cursor estricto (`medicion_at < %s`) perdería uno. Una reconexión usa el `last_seen_at` nuevo.
- Excluidos: `activo = false` (`actualizar_datos` limpia el latch al desactivar), `last_seen_at IS NULL` (estado `nunca`) y la `VENTANA_ARRANQUE` tras `first_connected_at` (importada de `medicion_service`, no copiada).
- Trade-off conocido: un equipo que oscila alrededor del umbral genera pares abrir/reconectar. Si el volumen molesta, la palanca es una columna de cooldown.

### Compartir: accesos e invitaciones

`invitacion_dispositivo` tiene dos formas según `email IS NULL`: **link global** (7 días, usos ilimitados, uno por rol por equipo) e **invitación dirigida** (30 días, un uso, sin tope). `invitacion_service.py` es dueño de las invitaciones, `acceso_service.py` de `usuario_dispositivo` (`/accesos`, `/vinculate`); ambos importan `dispositivo_service` sólo por el trío `validar_*`.
- **El token se guarda en texto plano a propósito, no "arreglarlo" con hash**: es una capacidad que el owner tiene que poder releer y recopiar (`GET /dispositivos/{id}/invitaciones` lo devuelve), y el mismo dump que filtra la fila ya tiene las lecturas que concede. El punto débil pasa a ser lo que loguea URLs: por eso aceptar lleva el token en el body; revocar y regenerar van por el `id` de la invitación.
- `idx_un_solo_link_por_rol` es parcial (`WHERE email IS NULL`). Como no sabe de vencimiento, `invitacion_dispositivo_repo.crear` usa `ON CONFLICT ... DO UPDATE ... WHERE expires_at <= now()`: pisa un link vencido y deja uno vivo sin devolver fila, que el servicio convierte en 409.
- Regenerar tiene cooldown de 5 min tras la primera vez (`regenerado_at`).
- **Toda query del repo va acotada por `dispositivo_id`**, incluso las que van por `id`: el par *es* la autorización.
- **Crear lee el plan de quien invita (`puede_compartir`), aceptar el del owner**: re-chequear al aceptar mata links ya repartidos tras un downgrade.
- **Aceptar no exige acceso previo**: el token es la autorización (el único camino sin `validar_*`). Crear, listar, regenerar y revocar son `ROLES_OWNER`.
- Aceptar nunca sube el rol: un segundo acceso choca con la PK de `usuario_dispositivo` → 409; el rol se cambia desde `/accesos`.
- Sólo la dirigida se consume al usarse. Revocar el link global **no echa a quien ya entró** (se quita con `DELETE /dispositivos/{id}/accesos/{usuario_id}`); la UI tiene que decirlo.
- Los emails se guardan en minúscula (usuarios e invitaciones). Filas previas no se normalizaron.
- **Resend no está cableado para invitaciones**: se devuelve el token y el front arma el link.

## Firmware (`esp/`)

- `programa_base.ino` es el template con la lógica común, marcado con `// Replace ->`. **`programas/*` y `modulos/*.ino` son generados** por `generar_sketches.py` desde su dict `SKETCHES`: nunca editarlos a mano. Pedido nuevo = entrada nueva en `SKETCHES`. `modulos/` sólo sirve para leer el bloque de un sensor aislado; no compila.
- **`nucleo/` es el firmware a batería (deep sleep, cola en flash), partido en módulos**; `prueba_bmp/` y `prueba_aht10/` son sketches finos que sólo componen, sin lógica: un `Equipo` (UUID, sensores, pines), un `ConfigWifi` (API, secret de fábrica, AP) y `cicloBateria(EQUIPO, enlace)`. Su estado y pendientes están en `esp/PENDIENTES-DEEPSLEEP.md`. `diagnostico_*` son herramientas de banco.
  - Una carpeta por dominio en `nucleo/src/`: `equipo/` (config, cadencias), `sensores/` (interfaz `Modulo`, muestras, drivers), `almacenamiento/` (buffer RTC, cola en flash y `Pendientes`, la fachada que esconde cuál), `reloj/`, `alertas/`, `enlace/` (interfaz `Enlace` + `EnlaceWifi`; `wifi/` = conexión, `ClienteApi` y secret), `comun/` (tipos neutrales: `Lote`, `Respuesta`, `Diagnostico`), `ciclo/`.
  - **Tres ejes separados**: `Enlace` (cómo llega un lote al backend: `abrir`/`enviar`/`cerrar`), `Pendientes` (qué hay para mandar, RTC y flash, con su orden y su fechado) y el ciclo (cuándo y con qué política de energía). Sólo el ciclo los junta: pide el siguiente lote a `Pendientes`, lo manda por el `Enlace`, confirma y aplica la respuesta (`PlanoControl`). Un enlace nuevo (LoRa) o un ciclo nuevo (red) no tocan los otros dos; `enlace/` y `almacenamiento/` no se conocen entre sí.
  - **El enlace no sabe de dónde salen los puntos**: recibe un `Lote` ya fechado. La conexión, el secret, su rotación y la causa del último fallo son privados de `EnlaceWifi`; `abrir`/`cerrar` van separados de `enviar` porque un drenaje manda decenas de lotes con la radio ya encendida. El backoff, la alerta pendiente y el watchdog del drenaje son política del ciclo.
  - **Estado privado por módulo**: las variables (incluidas las `RTC_DATA_ATTR`) son `static` en su `.cpp` y se tocan sólo por la API del `namespace`. Dependencias en un sentido: `reloj`/`equipo`/`comun` abajo, `ciclo` arriba.
  - **ArduinoJson vive sólo en `enlace/wifi/ClienteApi.cpp`**: el contrato con `/mediciones/` está en un archivo (el bug `cantMuestras` vs `muestras` fue por tenerlo disperso).
  - **Los drivers de sensor son header-only a propósito**: Arduino compila todos los `.cpp` de una librería, y uno en `.cpp` exigiría tener instaladas las librerías de todos los sensores. Sensor nuevo = un `.h` con una subclase de `Modulo`. `MAX_SENSORES` (6) dimensiona la ventana en RTC.
  - **Drivers analógicos** (`HumedadSuelo.h`, `BateriaDivisor.h`): promedian `analogReadMilliVolts()`, que corrige con la calibración de fábrica del chip (`analogRead() * 3.3 / 4095` no es lineal ni llega a 3,3 V). Una lectura muy lejos de la calibración (sensor desconectado) se descarta en vez de recortarse a 0/100 %.
  - **La batería no es un sensor**: es un atributo del dispositivo. Guardarla como sensor tapaba la detección de sensor muerto (`last_data_at` se renovaría siempre), ataba el aviso de batería baja a `puede_alertas` y la metía en el export y los gráficos del cliente. `Equipo.bateria` es un `MedidorBateria` opcional (`nullptr` = sin batería); el ciclo la lee una vez por contacto, antes de abrir el enlace, y viaja en `Estado` junto al diag: `bateria_pct` top-level en el POST (Pydantic lo ignora hasta que exista la columna) y un byte en la trama LoRa. El porcentaje sale de la curva de descarga de una celda Li-ion (no lineal: casi todo está entre 3,7 y 3,9 V); la tensión queda en el log para calibrar el divisor. **Falta el backend**: columnas en `dispositivos` y el aviso de batería baja como tipo propio de `alerta_eventos`, sin plan, igual que "dejó de reportar". Los pines del ADC2 (GPIO 2 y 4 del prototipo, entre otros) no leen con WiFi encendido: el ciclo a batería mide antes de conectar, un ciclo con WiFi siempre prendido necesita ADC1 (GPIO 32–39).
  - **LoRa** (estado, protocolo y pendientes en `esp/LORA.md`): `EnlaceLora` (nodo) y `ReceptorLora` (receptor, base del gateway) comparten `enlace/lora/Trama`, un protocolo binario firmado con HMAC truncado. La radio es una interfaz (`Radio`) con driver header-only (`RadioSx127x.h`), por lo mismo que los sensores. Cada enlace declara su `politicaReintento()`: el backoff de 10 min a 1 h es del WiFi, donde un intento fallido son ~10 s de radio.
- **Particiones `huge_app`**: la default parte la flash en dos apps de ~1,25 MB para rollback OTA, que no usamos (cada pedido se flashea a mano); `huge_app` da 3 MB (~38 % usado vs ~92 %). NVS queda en el mismo offset. Revisar si algún día hay OTA.
- Envía `{"mediciones": [{"sensor_id", "value", "time"}]}` con `X-Dispositivo-Id` + `Authorization: Bearer`. `time` es ISO-8601 UTC y opcional (sin él el backend estampa la llegada).
- **Muestreo y publicación son dos timers.** `leerSensores()` corre cada `MS_MUESTREO` (15 s fijos, no configurables ni feature de plan) y empuja a `ventana[sensor][VENTANA_MUESTRAS]`, un anillo por sensor que **no** es el buffer de envío. `publicar()` corre cada `intervaloMedicionMs` y bufferea **un** punto por sensor: `medianaDe()`, la mediana de las últimas `MUESTRAS_MEDIANA` (3). La mediana es un filtro de ruido, no un resumen del intervalo: el punto sigue significando "el valor en T", así que nada aguas abajo cambia.
- **Un cruce de umbral manda crudas**: `bufferizarCrudas()` pone las últimas N muestras sin mediana, así el servidor confirma `muestras_confirmacion` con datos reales de 15 s en ese mismo lote. Datos rutinarios gruesos y limpios; anomalías finas e inmediatas.
- **Watchdog** (`esp_task_wdt`, `MS_WATCHDOG` = 60 s): `Adafruit_AHT10::getEvent()` espera el bit BUSY sin timeout y un sensor muerto cuelga el sketch. Se arma **después** de `conectarWiFi()` porque el portal bloquea hasta 10 min.
- **Cada bloque de sensor verifica que la lectura salió**: valor de retorno, bit CALIBRATED donde exista, reintento y rango del datasheet vía `enRango()` (rango = "frame corrupto", no "valor raro": eso lo filtra la mediana). Una lectura fallida no bufferea nada —un hueco es honesto, un −9,66 °C no— y suma a `lecturasFallidas`.
- `flushBuffer()` drena el buffer del más viejo al más nuevo en chunks de `MAX_POR_ENVIO` (50), uno por pasada de `loop()` para que BOOT siga respondiendo. Avanza sólo con 2xx. En overflow se pisa el más viejo (`descartadasPorOverflow`). Sólo RAM, a propósito: sin energía no hay nada que guardar y volcar a NVS gasta la flash.
- `loop()` muestrea **antes** del chequeo de WiFi: un corte de red no puede cortar la generación de datos.
- **Primera publicación a los 5 s del boot** (`MS_PRIMERA_PUBLICACION`): `setup()` ceba la ventana con `MUESTRAS_MEDIANA` lecturas tras sincronizar el reloj. Va de la mano del arranque rápido del servidor.
- Cada entrada del buffer guarda un índice `uint8_t` a `SENSOR_IDS`, no el UUID (12 B vs ~48).
- **`CAPACIDAD_BUFFER = 6000` es un límite del linker**: `dram0_0_seg` reserva ~124 KB para globales y WiFiManager + HTTPClient + ArduinoJson ya usan ~50 KB. Da ~10 días a 5 min con dos sensores. Pasarlo al heap mueve un límite verificado en compilación a uno en runtime; si un pedido necesita más autonomía, es una decisión a traer, no un número a subir.
- **Reloj**: el template usa SNTP (`configTime(0, 0, ...)`, UTC) tras conectar; lo leído antes del sync va sin `time`. El firmware a batería ya no usa NTP: toma `server_epoch` de la respuesta (el NTP Pool prohíbe `pool.ntp.org` como default en un producto distribuido, y así no depende de UDP 123). El enchufado debería seguirlo; ver `PENDIENTES-DEEPSLEEP.md` antes de reintroducir NTP.
- **WiFi por `WiFiManager`** (SoftAP `SensoresIoT-Setup` + portal cautivo; SoftAP y no BLE porque Web Bluetooth no anda en iOS Safari). Mantener BOOT (GPIO0) 5 s **con la placa ya corriendo** borra las credenciales y reabre el portal (`chequearResetWifi()`, por eso `loop()` no tiene delays bloqueantes). No en el arranque: GPIO0 es pin de bootstrap. Ante una caída de red se reconecta, nunca levanta el portal.
- El secret vive en NVS (`Preferences`, namespace `dispositivo`); `SECRET_DISPOSITIVO_INICIAL` es sólo el valor de fábrica. `API_BASE`, `DISPOSITIVO_ID`, el secret inicial y los UUID de sensores se hardcodean por sketch: una compilación por pedido.

## Frontend (`frontend/`)

React 19 + Vite + TypeScript (`strict`) + Tailwind v4. Sólo la app de cliente (`app.dominio`). **El diseño es `frontend/diseno/`**: capturas (mandan en lo visual), HTML estático por pantalla (se porta, no se copia) y un README con reglas de producto. Ante una duda de cómo se ve algo, se mira ahí antes que en el código.

- **El proxy de Vite (`/api` → `:8000`) es requisito, no comodidad**: la cookie de refresh es `httponly` + `samesite` y no viaja cross-origin. `VITE_API_URL` lo reemplaza en otros entornos.
- **Tokens de color en `src/index.css` dentro de `@theme`** (no hay `tailwind.config.js`). **Light-first**: `@theme` tiene la paleta clara y `:root[data-theme='dark']` reasigna tokens. El atributo siempre tiene un tema concreto: un script en `index.html` resuelve "sistema" antes de pintar, así que no hay `@media` duplicando la paleta. **Nunca un color literal en un componente**; si falta un tono, se agrega el token. Única excepción: los colores de marca de `IconoGoogle`.
  - **Contraste AA, no AAA**: todo texto ≥ 4.5:1 contra toda superficie, hover y fondos de estado incluidos (AAA colapsaba `text-faint` con `text-muted`). Si se toca un tono, re-medir.
  - Bordes translúcidos (`border`, `border-control`, `border-strong`); fondos de estado (`*-soft`) opacos, ya compuestos sobre `bg`, para que el contraste de su texto no dependa de lo de abajo.
  - Escala tipográfica del diseño (`text-micro` 10.5 … `text-display` 76); `text-[Npx]` sólo para un tamaño único (el 404). `micro` es la versalita en IBM Plex Mono y el único uso de la mono además de ids. `plan-mark` (violeta) marca lo que el plan no cubre; `paper-*` es la hoja impresa del informe, clara en los dos temas.
- **`--color-accent` vs `--color-accent-strong`**: el primero es texto/íconos/foco, el segundo relleno sólido con texto encima. No son intercambiables por contraste.
- **Los sensores no tienen color por tipo**: todos usan `--color-chart-line`; el color queda para estado. `utils/sensores.ts:claveDeTipo` mapea por nombre normalizado (casing y tildes no confiables); al tipo lo identifica el ícono (`components/ui/IconoSensor.tsx`, el mismo glifo que la landing). No improvisar una paleta categórica.
- **`src/tipos.ts` espeja `backend/schemas/`** con los nombres tal cual (español, snake_case), para que un cambio de contrato salte en el type-check.
- **`hooks/usarCarga.ts` es el único mecanismo de fetching** (sin SWR/TanStack, a propósito). Dos efectos: uno carga (se reinicia con la identidad de `cargar` o `refrescar()`), otro programa el poll, así cambiar la cadencia reprograma sin recargar. `cargar` tiene que venir memoizado.
- **`services/api.ts`**: interceptor de refresh con un solo POST en vuelo compartido, para no rotar el token N veces invalidándose entre sí.
- **Estructura**: `components/{ui,layout,graficos}`, `features/*` (una carpeta por pantalla con sus hooks), `hooks/` transversales (`usarCarga`, `usarAhora`, `usarTema`, `usarMedios`, `usarCabecera`, `usarFormulario`, `usarDispositivos`), `services/` (`api.ts`, `consultas.ts`), `utils/` (puras). Si para entender una pantalla hay que saltar entre capas, la capa sobra.
- **Lo que no tiene backend se ve igual, deshabilitado y marcado con `components/ui/AvisoPendiente.tsx`**, en vez de omitirse: verlo en pantalla es el recordatorio. **Buscar `AvisoPendiente` da la lista de lo que falta** (hoy: sensores fijados, batería/energía con datos de ejemplo, conectividad, informe PDF, Google OAuth, recuperar contraseña, sesiones, eliminar cuenta y preferencias de mail).

### Pantallas

- **Layout**: la barra lateral (≥ 1024 px) **es la lista de equipos y nada más**, en orden alfabético (es navegación: una lista que se reordena sola obliga a buscar de nuevo). Avisos y la cuenta van en la barra superior. Debajo de 1024 px, `SelectorEquipos` abre la misma lista en una hoja inferior (`<dialog>` nativo: foco y Escape vienen del navegador). `Layout` pone un `h1` con el título de la ruta salvo `sinTitulo`.
- **`utils/dispositivos.ts:situacionDeEquipo` es la única respuesta a "¿qué le pasa a este equipo?"**: glifo, una línea y si **requiere atención** (regla disparada, sin reportar, nunca reportó, o un sensor sin lecturas recientes en un equipo en línea; "con retraso" no, se pone al día solo). La consumen la barra, el selector, el conteo de Avisos y el panel, que por eso no pueden discutir.
- **Panel**: frase de estado, un bloque por incidente (regla disparada o sin reportar) y una grilla de tarjetas autónomas, cada una con sus sensores (el del problema primero, hasta 4). **El panel no carga Recharts**: la curva del incidente es SVG propio (`GraficoIncidente`).
- **Detalle de equipo**: la regla sonando gana sobre la conectividad en la cabecera; el sensor en alerta sube arriba (`SensorEnAlerta`) **y además** sigue en la lista. "Qué pasó" (`LineaDeTiempo`) va al lado de las reglas.
- **Detalle de sensor**: rangos 1 h a 30 d y "Personalizado". **Hasta 24 h pollea; 3 d y más se refrescan a mano** (`utils/ventana.ts:esTiempoReal`). Las métricas del período (`utils/series.ts:estadisticasDeGrafico`) salen de los mismos tramos que dibuja el gráfico.
- **Ajustes** (equipo y cuenta): `IndiceAjustes`, `SeccionAjustes`, renglones `FilaAjuste` y lo irreversible en `ZonaPeligro`. Una opción cerrada se guarda al elegirla; un campo de texto muestra "Guardar" recién cuando hay algo que guardar.
- **Vincular** (`/vincular`): el código de la etiqueta es el id del equipo, y la pantalla lo sigue hasta su primera conexión y su primera lectura. Una ruta desconocida muestra `features/NoEncontrada.tsx` en vez de redirigir.

### Gráfico

`components/graficos/Grafico.tsx`: área degradada sobre Recharts. **Un hueco corta el trazo** en vez de interpolar (el silencio de un equipo tiene que verse) y una lectura aislada entre huecos se marca con un círculo.
- **`utils/series.ts:tramosDe` decide los huecos por el ritmo de la propia serie, no por `intervalo_seg`**: con agregación el paso es `bucket_seg`; con crudas, la referencia de cada separación es **el mayor de sus dos deltas vecinos** (un escalón entre cadencias tiene un vecino grande y no se marca; un corte real tiene vecinos chicos a ambos lados). Usar la config de hoy contra datos grabados con la de entonces fallaba en las dos direcciones, y la peor era esconder silencio. En los extremos `intervalo_seg` vuelve como piso, porque falta medio contexto.
- `huecosDeGrafico` cuenta sobre esos mismos tramos: se cuenta lo que se ve cortado.
- **El límite del plan se marca, no se bloquea.** `utils/retencion.ts` lo deriva de `retencion_dias` de `/grafico` (plan del owner; admin exento). `BarraVentana` marca con un punto `plan-mark` los presets que exceden la retención (`rangoExcedeRetencion`) pero se pueden elegir, igual que un "Personalizado": el backend recorta y `AvisoVentana` dice desde cuándo se muestra, con link a `/plan`.
  - `limiteDeVentana` es el único lugar que lo resuelve, para el eje X, la franja del corte (`corteDePlanMs`) y el aviso. **El eje arranca en `desde_efectivo`**: dibujar el rango pedido deja el tramo recortado en blanco, indistinguible de un equipo mudo.
  - `AvisoVentana` no confía en `recortado` a secas: el `now()` del servidor es posterior al del cliente, así que sólo cuenta si movió el borde más que el margen de reloj (`recorteEsMaterial`). Si el equipo empezó a reportar después del piso, gana el aviso de "primera vez": ofrecer más retención ahí sería mentir.

### Estado y cadencia

- **La conectividad la resuelve el backend** (`online`, ver Liveness). `utils/tiempo.ts:estadoDispositivo` sólo reparte en `nunca` / `en-linea` / `con-retraso` (por `last_data_at`, con la gracia de `intervalo_modificado_at`) / `sin-reportar`. `lecturaDesactualizada` es otra pregunta (una lectura, no el equipo) y se deriva en el front porque el backend no expone frescura por sensor.
- **Hooks del detalle partidos por cadencia**, no por pantalla (`features/dispositivo/usarDispositivo.ts`): `useDispositivo` y `useSensoresConMeta` no pollean; `useEstadoDispositivo` sí. `useAlertasDispositivo` corre a la cadencia del equipo y no a `pollDeVentana`: los gráficos dejan de pollear con un rango histórico, pero una alerta dispara *ahora*.
- **La cadencia del poll sale de `siguiente_medicion` y se deriva en el render** (nunca `useEffect` + `setState`): así el pedido cae justo después del dato nuevo. Gráficos y alertas comparten ese número y por eso quedan alineados.
- **`GET /dispositivos/{id}` trae `limites` del plan del OWNER** (`puede_alertas`, `max_alertas`, `intervalo_minimo_seg`, `intervalos_disponibles`): todo lo del equipo sale de ahí. `useSesion().plan` es el plan de la cuenta y sólo gobierna lo de la cuenta (compartir). `retencion_dias` viaja sólo en `/grafico`. La misma respuesta trae `notificar`, la preferencia de quien consulta (`null` = admin sin vínculo).
- El gate de edición en la UI espeja `ROLES_EDICION` vía `utils/dispositivos.ts:puedeEditar(rol)`: no es control de acceso, es no ofrecer un botón que va a dar 403.
- **Silenciar es del equipo** (`usuario_dispositivo.notificar`) y se toca en dos lados que escriben lo mismo: Ajustes del equipo (`ajustes/SeccionNotificaciones.tsx`) y Tu cuenta → Avisos → "Elegir equipos". Guardado inmediato y optimista, habilitado para todo rol (viewer incluido) y **sin gatear por `puede_alertas`**, porque el aviso de "dejó de reportar" sale en todos los planes. Con `notificar === null` no se muestra. El panel no trae `notificar`: "Elegir equipos" lo lee del detalle de cada equipo.

### Reglas y avisos

**La regla es del equipo; el evento es de la cuenta.** Las reglas se crean, editan, pausan y borran **sólo en el detalle del equipo** (`BloqueAlertas`): un umbral no significa nada sin el gráfico de su sensor. `/avisos` es un **registro global de sólo lectura**. Hubo una versión con el CRUD duplicado ahí y se sacó (dos administradores del mismo objeto). Si hace falta algo global sobre reglas, la pregunta real es de **cobertura** ("¿qué sensores no tienen regla?"), otra pantalla.
- Vocabulario: *alerta* = regla (por eso `components/ui/Banner.tsx` no se llama `Alert`), *aviso* = evento. Ruta `/avisos`: "Registro" (el nombre del diseño) choca con `/registro`, "Notificaciones" sugiere leído/no leído e "Historial" es el de lecturas. `/alertas` es `<Navigate replace>`. El endpoint sigue siendo `GET /alertas/eventos`.
- **Filtros de Avisos**: el de equipo va al backend (`GET /dispositivos/{id}/alertas/eventos`), porque filtrar tramos ya traídos deja páginas casi vacías; tipo y período se aplican sobre lo cargado, y el período corta la paginación.
- La banda de arriba contesta qué pasa *ahora* (`situacionDeEquipo`), no con el log. Como no trae umbral ni nombre de regla, muestra el valor y manda al equipo.
- El registro pollea sólo en el presente (`cursores.length === 1`), a la cadencia del equipo más rápido; Actualizar vuelve al presente.
- `destinatarios`/`notificados`: la UI sólo dice a cuántos **les llegó** el mail; si a nadie, "Sin aviso por email". **Un envío fallido nunca se muestra como falla**: el usuario no puede resolverlo, se corrige en el backend.
- **Con el equipo mudo, una regla en `normal` se muestra "Sin evaluar"**; una `disparada` no se degrada (último estado conocido); `con-retraso` no cambia nada; una pausada sólo muestra `Pausada`. Vive en `utils/alertas.ts:estadoDeRegla`, para que dos pantallas no contesten distinto; recibe la conectividad ya resuelta.
- `AlertaEvento` en `tipos.ts` es una union discriminada por `tipo`; `FilaEvento` ramifica arriba de todo. Un corte se juzga por cuánto duró (`utils/tiempo.ts:duracion`, no `haceCuanto`) y usa el mismo glifo `sin-reportar` que la pastilla del equipo.
- **Grupos de equipos: no todavía.** Lo que resolverían es templating ("no escribir la misma regla doce veces"), y el 80 % sale con "copiar esta regla a otros equipos" en el modal existente. Un grupo recién se gana su tabla cuando sea dueño de destinatarios y silencio.

### Estado actual

Rediseño de `frontend/diseno/` implementado entero (pasos 1 a 6 de su README). Funcionando: auth, panel, detalle de equipo y de sensor, historial, alertas del equipo, registro de avisos, export, vinculación y ajustes del equipo (identificación, muestreo, notificaciones, accesos e invitaciones). Lo que depende de backend nuevo está a la vista con `AvisoPendiente`. `/plan` muestra el catálogo leído de `/planes/` (sin cobro). **Ajustes de cuenta tiene UI sin backend**: `PATCH /auth/me`, `PUT /auth/me/password` y `/auth/me/preferencias` no existen todavía. La pantalla de inventario se eliminó (`/dispositivos` redirige a `/`).

## Roadmap

No hay producción en volumen: cada pedido tiene sensores (y librerías) distintos y se compila a mano. Por eso se descartó el `claim_code` con firmware idéntico; retomarlo sólo si se fabrica en volumen, junto con autodetección de sensores por I2C.

**Tier 3 — bloqueante antes de vender**
- 3.1 Provisioning WiFi ✅.
- 3.2 Secret: alta y rotación ✅. El alta sigue siendo a mano en la DB (equipo + sensores → `dispositivo_id` y `secret` hardcodeados en el `.ino`).
- **Pendiente antes de la primera unidad a un cliente: flash encryption del ESP32.** Hoy se desconoce si está habilitada (por default no). Graba la clave en eFuses: **irreversible, una sola vez por unidad, no retroactiva**. Sin ella el secret se extrae con un dump de flash por USB, haya rotación o no.

**Tier 4 — monetización**
- 4.1 Planes: modelo ✅, **falta el cobro**. Mercado Pago (Stripe no soporta cuentas argentinas), `preapproval` para recurrentes en ARS; los webhooks se reintentan y llegan duplicados o fuera de orden, así que el alta tiene que ser idempotente.
- 4.2 Export CSV ✅, para todos los planes. XLSX cuando alguien lo pida.
- 4.3 Alertas ✅ (con confirmación por persistencia y disparo adelantado). **Decisión de producto**: que el free tenga 2 alertas por equipo y 15 días de retención (un free con 0 alertas nunca prueba la feature, y el primer mail es cuando el cliente entiende para qué compró la caja). **No está aplicada**: la semilla todavía dice free sin alertas y 7 días; falta una migración sobre `planes` + `init.sql` + `LIMITES_FREE`. Push/SMS más adelante como pasamanos por consumo, nunca dentro de un plan plano.
- 4.3.b "Dejó de reportar" ✅ y 4.3.c heartbeat ✅, sin plan.
- 4.4 Multi-usuario ✅. Pendiente: mail de invitación por Resend (no bloqueante).
- **4.6 Reportes programados en PDF — pendiente, la feature más vendible que falta.** Resumen semanal/mensual por mail (gráfico, mín/máx/promedio, log de avisos) para cumplimiento (bromatología, ANMAT, auditoría). UbiBot lo capea en todos sus planes, señal de que convierte. Se apoya en `exportacion_service`: el trabajo es render + scheduler.
- 4.5 Chat de IA — en duda, no priorizar sin demanda concreta: es el costo recurrente más alto y el dolor que resuelve no está claro.

**Tier 5 — frontends**: interceptor de refresh ✅; app de cliente con el rediseño implementado (falta backend, marcado con `AvisoPendiente`); landing en `landing/` (Astro, sin funcionalidad todavía); panel de admin (`admin.dominio`) sin arrancar y no prioritario.

**Diferido explícitamente**
- **Google OAuth**: después de Tier 5 salvo compromiso externo. Obliga a definir el modelo de usuario (password nullable, providers, account linking) justo antes de las pantallas de perfil que dependen de él: mejor definirlo una vez.
- **Riesgo legal** (borrado/exportación de datos personales al eliminar cuenta): retomar antes de operar en jurisdicciones con protección de datos o de escalar usuarios.

## Comentarios en el código

Extremadamente concisos, casi siempre una línea, sólo cuando el código no puede comunicar la intención. Preferir mejores nombres. No: explicar lo obvio, narrar la implementación, historia de refactors, código eliminado, repetir nombres o tipos. Ante la duda, omitir.
