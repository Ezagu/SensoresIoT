#pragma once

#include <Arduino.h>

// Las lecturas guardan su edad y no su fecha: un equipo que arranca sin WiFi mide
// durante días antes de conocer la hora. El ancla (par epoch del servidor / cronómetro)
// las data recién al enviarlas.
namespace reloj {

constexpr uint32_t EPOCH_MIN           = 1700000000;
constexpr uint32_t SEG_MIN_CALIBRACION = 3600;

// Cronómetro monótono desde el power-on (segundos).
uint32_t ahora();
// El mismo cronómetro con la resolución que necesita la grilla de despertares.
int64_t microsLocales();
String isoUtc(uint32_t epoch);

// La hora sale de la respuesta del backend, no de SNTP.
void anclar(uint32_t epoch);
bool tieneAncla();
uint32_t anclaEpoch();
uint32_t anclaLocal();
int32_t segDesdeAncla();

// Drift del oscilador: persiste en NVS porque es de la placa, no del arranque.
int32_t ppm();
void cargarPpm();

// Segundos locales a segundos reales.
int64_t aReal(int64_t segLocales);
int64_t aReal(int64_t segLocales, int32_t ppm);

// 0 = no se puede datar.
uint32_t epochDeLectura(uint32_t lecturaTime);
// Entre un ancla anterior y la actual se interpola.
uint32_t epochEntre(uint32_t lecturaTime, uint32_t epoch0, uint32_t local0);
// Para el buffer RTC: interpola contra el ancla de antes del último tramo sin contacto.
uint32_t epochDesdeAnclaPrevia(uint32_t lecturaTime);

}
