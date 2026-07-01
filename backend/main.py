from fastapi import FastAPI
from routers import ingesta

app = FastAPI()

app.include_router(ingesta.router)