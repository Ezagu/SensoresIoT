from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import mediciones, usuarios, tipos_sensor, sensores, dispositivos, auth, planes, alertas
from core.config import get_cors_origins
from core.limiter import limiter
from core.tareas import ciclo_de_vida
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

# El barrido de "dejó de reportar" corre acá adentro y no en un worker aparte.
# Si algún día esto levanta con --workers N o con réplicas, cada proceso arranca
# su propio bucle: lo único que evita mails duplicados es el advisory lock de
# dispositivo_repo.tomar_lock_vigilancia.
app = FastAPI(lifespan=ciclo_de_vida)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(), #Página de vite,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Resolucion", "X-Fuente", "X-Intervalo-Seg",
                    "X-Desde-Efectivo", "X-Recortado", "X-Retencion-Dias"],
)

app.include_router(mediciones.router, prefix="/mediciones", tags=["mediciones"])
app.include_router(usuarios.router, prefix="/usuarios", tags=["usuario"])
app.include_router(dispositivos.router, prefix="/dispositivos", tags=["dispositivos"])
app.include_router(sensores.router, prefix="/sensores", tags=["sensores"])
app.include_router(tipos_sensor.router, prefix="/tipos-sensor", tags=["tipos_sensor"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(planes.router, prefix="/planes", tags=["planes"])
app.include_router(alertas.router, prefix="/alertas", tags=["alertas"])