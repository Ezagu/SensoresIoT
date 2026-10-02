#include "api/ClienteApi.h"
#include "equipo/Equipo.h"
#include "equipo/Secret.h"
#include "reloj/Reloj.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>

namespace api {

static bool configurarCliente(HTTPClient& http, const String& endpoint) {
  const Equipo& e = equipo::actual();

  http.setConnectTimeout(10000);
  http.setTimeout(10000);
  http.setReuse(false);

  if (!http.begin(String(e.apiBase) + endpoint)) {
    Serial.println("[ERROR] Error al iniciar cliente HTTP");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Dispositivo-Id", e.dispositivoId);
  http.addHeader("Authorization", String("Bearer ") + secret::actual());

  return true;
}

static bool leerJson(HTTPClient& http, JsonDocument& respuesta) {
  String texto = http.getString();
  if (deserializeJson(respuesta, texto)) {
    Serial.println("[SECRET] Respuesta ilegible, se reintenta en el próximo ciclo.");
    return false;
  }
  return true;
}

static void agregarPunto(JsonArray& mediciones, const PuntoFechado& p) {
  JsonObject punto = mediciones.add<JsonObject>();
  punto["sensor_id"] = equipo::actual().sensorIds[p.sensorIdx];
  punto["value"]     = p.value;

  // Sin ancla se omite el campo y el backend le pone la de recepción.
  if (p.epoch != 0) punto["time"] = reloj::isoUtc(p.epoch);
}

static void agregarDiagnostico(JsonDocument& doc, const Diagnostico& d) {
  JsonObject diag = doc["diag"].to<JsonObject>();
  diag["reinicio"]             = d.reinicio;
  diag["cronometro"]           = d.cronometro;
  diag["seg_desde_lectura_ok"] = d.segDesdeLecturaOk;
  diag["fallos_inicio_sensor"] = d.fallosInicioSensor;
  diag["lecturas_fallidas"]    = d.lecturasFallidas;
  diag["en_rtc"]               = d.enRtc;
  diag["segmentos_flash"]      = d.segmentosFlash;
  diag["fallos_contacto"]      = d.fallosContacto;
  diag["rapidas_fallidas"]     = d.rapidasFallidas;
  if (d.fallosContacto > 0) {
    // 0 = no aplica: un fallo es de WiFi (motivo 802.11) o de HTTP (status, o <0 del cliente).
    diag["motivo_fallo_wifi"] = d.motivoFalloWifi;
    diag["codigo_fallo_http"] = d.codigoFalloHttp;
    diag["alerta_pendiente"]  = d.alertaPendiente;
  }
  diag["reglas"]               = d.reglas;
  diag["reloj_ppm"]            = d.relojPpm;
}

static void leerRespuesta(JsonDocument& json, RespuestaApi& r) {
  r.serverEpoch          = json["server_epoch"] | 0;
  r.intervaloEnvioSeg    = json["intervalo_sugerido_seg"] | 0;
  r.intervaloContactoSeg = json["intervalo_contacto_seg"] | 0;
  r.rotarSecret          = json["rotar_secret"] | false;

  r.cantReglas = 0;
  for (JsonObject item : json["umbrales"].as<JsonArray>()) {
    if (r.cantReglas == MAX_UMBRALES) break;

    int idx = equipo::indiceDeSensorId(item["sensor_id"] | "");
    if (idx < 0) continue;

    ReglaRecibida& regla = r.reglas[r.cantReglas++];
    regla.sensorIdx    = (uint8_t) idx;
    regla.mayor        = strcmp(item["condicion"] | "", "mayor") == 0;
    regla.umbral       = item["umbral"] | 0.0f;
    regla.histeresis   = item["histeresis"] | 0.0f;
    regla.cantMuestras = item["muestras"] | 3;
    regla.disparada    = item["disparada"] | false;
  }
}

bool postear(const PuntoFechado* puntos, uint16_t cantidad, const Diagnostico& diag,
             RespuestaApi& respuesta, int16_t& codigoFallo) {
  codigoFallo = 0;
  respuesta.valida = false;

  JsonDocument doc;
  JsonArray mediciones = doc["mediciones"].to<JsonArray>();
  for (uint16_t i = 0; i < cantidad; i++) agregarPunto(mediciones, puntos[i]);
  agregarDiagnostico(doc, diag);

  String payload;
  serializeJson(doc, payload);
  HTTPClient http;

  if (!configurarCliente(http, "/mediciones/")) return false;

  Serial.printf("[HTTP] POST con %u mediciones\n", cantidad);

  int httpCode = http.POST(payload);
  bool ok = false;

  if (httpCode <= 0) {
    Serial.printf("[HTTP] Fallo de conexión: %s\n", http.errorToString(httpCode).c_str());
    codigoFallo = httpCode;
  } else if (httpCode != 200 && httpCode != 201) {
    Serial.printf("[HTTP] El backend respondió %d\n", httpCode);
    codigoFallo = httpCode;
  } else {
    ok = true;

    JsonDocument json;
    if (leerJson(http, json)) {
      leerRespuesta(json, respuesta);
      respuesta.valida = true;
    }
  }

  http.end();
  return ok;
}

bool rotarSecret() {
  HTTPClient http;
  if (!configurarCliente(http, "/dispositivos/rotate-secret")) return false;

  Serial.println("[CONFIG] Rotando secret...");

  int httpCode = http.POST("");
  bool ok = false;

  if (httpCode == 200) {
    JsonDocument respuesta;

    if (leerJson(http, respuesta)) {
      const char* nuevo = respuesta["secret"] | "";

      if (strlen(nuevo) == 0) {
        Serial.println("[CONFIG] La respuesta no trajo secret.");
      } else if (secret::guardar(String(nuevo))) {
        secret::rotacionHecha();
        ok = true;
        Serial.println("[CONFIG] Secret rotado y guardado en NVS.");
      }
    }
  } else {
    Serial.print("[CONFIG] Falló la rotación, se reintenta luego.\n");
  }

  return ok;
}

}
