#include "reloj/Reloj.h"
#include <Preferences.h>
#include <time.h>
#include <sys/time.h>

namespace reloj {

RTC_DATA_ATTR static uint32_t epochAncla = 0;
RTC_DATA_ATTR static uint32_t localAncla = 0;

// Los POST de un mismo drenaje llegan a segundos y no mueven el ancla previa.
const uint32_t SEG_MIN_TRAMO = 60;
RTC_DATA_ATTR static uint32_t anclaPreviaEpoch = 0;
RTC_DATA_ATTR static uint32_t anclaPreviaLocal = 0;

// Con anclas separadas menos de 1 h, la cuantización de 1 s mete más error que el
// drift que se quiere medir.
const int32_t PPM_MAX_RELOJ = 30000;

RTC_DATA_ATTR static uint32_t calibracionEpoch = 0;
RTC_DATA_ATTR static uint32_t calibracionLocal = 0;
RTC_DATA_ATTR static int32_t  relojPpm         = 0;

// Vale mientras nadie llame a settimeofday(): el RTC mantiene el system time durante
// el deep sleep y los resets, así que incluye el cuarto de segundo del boot.
uint32_t ahora() {
  return (uint32_t) time(nullptr);
}

int64_t microsLocales() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  return (int64_t) tv.tv_sec * 1000000LL + tv.tv_usec;
}

String isoUtc(uint32_t epoch) {
  time_t instante = (time_t) epoch;
  struct tm partes;
  gmtime_r(&instante, &partes);

  char texto[21];
  strftime(texto, sizeof(texto), "%Y-%m-%dT%H:%M:%SZ", &partes);
  return String(texto);
}

bool tieneAncla()         { return epochAncla != 0; }
uint32_t anclaEpoch()     { return epochAncla; }
uint32_t anclaLocal()     { return localAncla; }
int32_t ppm()             { return relojPpm; }

int32_t segDesdeAncla() {
  return (int32_t) (ahora() - localAncla);
}

bool anclaVencida() {
  return epochAncla == 0 || segDesdeAncla() >= (int32_t) SEG_MIN_CALIBRACION;
}

static void guardarPpm() {
  Preferences p;
  p.begin("reloj", false);
  p.putInt("ppm", relojPpm);
  p.end();
}

// Sin esto un reset tira el drift y el equipo pasa la primera hora fechando con el
// cronómetro crudo.
void cargarPpm() {
  Preferences p;
  p.begin("reloj", true);
  relojPpm = p.getInt("ppm", 0);
  p.end();
}

// Compara el tiempo que pasó según el servidor contra el del cronómetro, entre la
// referencia y el ancla recién tomada.
static void calibrar() {
  if (calibracionEpoch == 0) {
    calibracionEpoch = epochAncla;
    calibracionLocal = localAncla;
    return;
  }

  int64_t deltaLocal = (int32_t) (localAncla - calibracionLocal);
  if (deltaLocal < SEG_MIN_CALIBRACION) return;

  int64_t deltaReal = (int64_t) epochAncla - calibracionEpoch;
  int64_t medido    = (deltaReal - deltaLocal) * 1000000LL / deltaLocal;

  calibracionEpoch = epochAncla;
  calibracionLocal = localAncla;

  // Un salto del reloj del servidor o una referencia de otro arranque, no drift.
  if (medido > PPM_MAX_RELOJ || medido < -PPM_MAX_RELOJ) {
    Serial.printf("[RELOJ] Medición descartada: %lld ppm\n", medido);
    return;
  }

  // Promedio con la anterior: amortigua la cuantización sin dejar de seguir la
  // deriva térmica.
  int32_t anterior = relojPpm;
  relojPpm = anterior == 0 ? (int32_t) medido : (int32_t) ((anterior + medido) / 2);

  Serial.printf("[RELOJ] Drift medido %lld ppm en %llds, aplicado %ld ppm\n",
                medido, deltaLocal, (long) relojPpm);

  if (abs(relojPpm - anterior) > 50) guardarPpm();
}

void anclar(uint32_t epoch) {
  if (epoch < EPOCH_MIN) return;

  if (epochAncla != 0 && segDesdeAncla() >= (int32_t) SEG_MIN_TRAMO) {
    anclaPreviaEpoch = epochAncla;
    anclaPreviaLocal = localAncla;
  }
  epochAncla = epoch;
  localAncla = ahora();
  calibrar();
}

int64_t aReal(int64_t segLocales, int32_t ppmAplicado) {
  return segLocales + segLocales * ppmAplicado / 1000000LL;
}

int64_t aReal(int64_t segLocales) {
  return aReal(segLocales, relojPpm);
}

// Con signo a propósito: el ancla llega en la respuesta del POST anterior, así que
// lo normal es que la lectura sea POSTERIOR y haya que extrapolar hacia adelante.
uint32_t epochDeLectura(uint32_t lecturaTime) {
  if (epochAncla == 0) return 0;

  // Resta modular: una lectura anterior al power-on (o al wrap) sigue dando la edad correcta.
  int64_t epoch = (int64_t) epochAncla + aReal((int32_t) (lecturaTime - localAncla));
  return epoch > (int64_t) EPOCH_MIN ? (uint32_t) epoch : 0;
}

// Reparte el drift real del tramo en vez del promedio aprendido, que en un corte
// largo se corre decenas de segundos.
uint32_t epochEntre(uint32_t lecturaTime, uint32_t epoch0, uint32_t local0) {
  int32_t tramo = (int32_t) (localAncla - local0);
  int32_t edad  = (int32_t) (lecturaTime - local0);
  if (epochAncla == 0 || epoch0 == 0 || tramo <= 0 || edad < 0 || edad > tramo) {
    return epochDeLectura(lecturaTime);
  }
  return epoch0 + (uint32_t) (((int64_t) epochAncla - epoch0) * edad / tramo);
}

uint32_t epochDesdeAnclaPrevia(uint32_t lecturaTime) {
  return epochEntre(lecturaTime, anclaPreviaEpoch, anclaPreviaLocal);
}

}
