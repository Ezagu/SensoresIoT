from fastapi import FastAPI
from routers import ingesta, usuarios

app = FastAPI()

app.include_router(ingesta.router)
app.include_router(usuarios.router, prefix="/usuarios", tags=["usuario"])