#include "ciclo/PlanoControl.h"
#include "equipo/Cadencia.h"
#include "reloj/Reloj.h"
#include "alertas/Umbrales.h"

namespace planoControl {

void aplicar(const Respuesta& r) {
  if (!r.valida) return;

  reloj::anclar(r.serverEpoch);
  cadencia::aplicar(r.intervaloEnvioSeg, r.intervaloContactoSeg);
  if (r.hayReglas) umbrales::reemplazar(r.reglas, r.cantReglas);
}

}
