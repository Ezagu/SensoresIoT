from fastapi import APIRouter, Depends
from schemas.plan import PlanOut, MiPlanOut
from services import plan_service
from core.deps import get_usuario_actual

router = APIRouter()

@router.get("/", response_model=list[PlanOut])
def get_planes():
    # Sin autenticación a propósito: es información de pricing, la landing la
    # consume sin login
    return plan_service.listar_planes()

@router.get("/mi-plan", response_model=MiPlanOut)
def get_mi_plan(usuario_actual: dict = Depends(get_usuario_actual)):
    return plan_service.obtener_mi_plan(usuario_actual["sub"])
