from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import mediciones, usuarios, tipos_sensor, sensores, dispositivos, auth
from dotenv import load_dotenv
from utils import get_cors_origins

# Cargar variables de entorno
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(), #Pàgina de vite,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mediciones.router)
app.include_router(usuarios.router, prefix="/usuarios", tags=["usuario"])
app.include_router(dispositivos.router, prefix="/dispositivos", tags=["dispositivos"])
app.include_router(sensores.router, prefix="/sensores", tags=["sensores"])
app.include_router(tipos_sensor.router, prefix="/tipos-sensor", tags=["tipos_sensor"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])