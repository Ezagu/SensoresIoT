from fastapi import APIRouter, Request, Response, HTTPException, Depends
from schemas.usuario import UsuarioCreate, UsuarioOut
from schemas.auth import VerifyRequest, ResendVerifyRequest, LoginRequest
from services import auth_service
from core.security import REFRESH_TOKEN_EXPIRE_DAYS
from core.deps import get_usuario_actual
from core.limiter import limiter

router = APIRouter()

def _create_refresh_token_cookie(response, refresh_token) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

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
@limiter.limit("5/minute")
@limiter.limit("20/hour")
def login(request: Request, response: Response, payload: LoginRequest):
    tokens = auth_service.loguear(payload.email, payload.password)
    _create_refresh_token_cookie(response, tokens["refresh_token"])
    return {"access_token": tokens["access_token"]}

@router.post("/refresh")
def refresh(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token is None:
        raise HTTPException(401, "No hay sesión")
    
    tokens = auth_service.refrescar_sesion(refresh_token)
    _create_refresh_token_cookie(response, tokens["refresh_token"])
    return {"access_token": tokens["access_token"]}

@router.post("/logout")
def logout(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token is not None:
        auth_service.cerrar_sesion(refresh_token)

    response.delete_cookie("refresh_token")
    return {"detail": "Sesión cerrada"}

@router.get("/me")
def me(usuario_actual: dict = Depends(get_usuario_actual)):
    return {
        "usuario_id": usuario_actual["sub"],
        "rol": usuario_actual["rol"],
    }