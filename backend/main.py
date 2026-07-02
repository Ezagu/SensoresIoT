from fastapi import FastAPI
from routers import mediciones, usuarios, tipos_sensor, sensores, dispositivos

app = FastAPI()

app.include_router(mediciones.router)
app.include_router(usuarios.router, prefix="/usuarios", tags=["usuario"])
app.include_router(dispositivos.router, prefix="/dispositivos", tags=["dispositivos"])
app.include_router(sensores.router, prefix="/sensores", tags=["sensores"])
app.include_router(tipos_sensor.router, prefix="/tipos-sensor", tags=["tipos_sensor"])
