from fastapi import APIRouter, Request, Response
from schemas.usuario import UsuarioCreate, UsuarioOut
from slowapi import Limiter
from slowapi.util import get_remote_address
from schemas.auth import VerifyRequest, ResendVerifyRequest, LoginRequest
from services import auth_service
from core.security import REFRESH_TOKEN_EXPIRE_DAYS

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

@router.post("/register", response_model=UsuarioOut)
@limiter.limit("3/hour")
def register(request: Request, usuario: UsuarioCreate):
    return auth_service.register_usuario(usuario)

@router.post("/verify")
def verify_email(data: VerifyRequest):
    auth_service.verificar_email(data.token)
    return {"message": "Email verificado correctamente"}

@router.post("/resend-verify")
@limiter.limit("3/hour")
def resend_verify_email(request: Request, data: ResendVerifyRequest):
    auth_service.reenviar_verificacion(data.email)
    return {"message": "Si el email existe y no fue verificado, te enviamos un nuevo link"}

@router.post("/login")
def login(response: Response, payload: LoginRequest):
    resultado = auth_service.loguear(payload.email, payload.password)

    response.set_cookie(
        key="refresh_token",
        value=resultado["refresh_token"],
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return {"access_token": resultado["access_token"]}
