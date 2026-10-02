#pragma once

#include <Arduino.h>

// Despierta y lee los módulos que declara el equipo. Los drivers (sensores/BMP085.h,
// AHT10.h) registran sus lecturas en `muestras` y reportan fallas acá.
namespace sensores {

// Abre el bus y arranca cada módulo; true si al menos uno contestó.
bool iniciar();
bool leer();

// Varias lecturas seguidas para que el primer punto ya sea una mediana y no una
// muestra suelta: basta para descartar un frame corrupto aislado.
void primar();

// Rango = "frame corrupto", no "valor raro": eso lo filtra la mediana.
bool enRango(float valor, float minimo, float maximo);

// Lecturas que el sensor no entregó o que salieron fuera del rango del datasheet.
// En RTC memory: contarlas por ciclo no dice nada, lo que interesa es la tendencia.
void registrarLecturaFallida();
void registrarFalloInicio();
uint32_t lecturasFallidas();
uint32_t fallosInicio();

}
