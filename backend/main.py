from fastapi import FastAPI
from routers import medicion, usuarios, tipo_sensor

app = FastAPI()

app.include_router(medicion.router)
app.include_router(usuarios.router, prefix="/usuarios", tags=["usuario"])
app.include_router(tipo_sensor.router, prefix="/tipo-sensor", tags=["tipos_sensor"])