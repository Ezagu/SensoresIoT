#include "enlace/wifi/ClienteApi.h"
#include "enlace/wifi/Secret.h"
#include "equipo/Equipo.h"
#include "reloj/Reloj.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>

namespace clienteApi {

static bool configurarCliente(HTTPClient& http, const char* apiBase, const String& endpoint) {
  http.setConnectTimeout(10000);
  http.setTimeout(10000);
  http.setReuse(false);

  if (!http.begin(String(apiBase) + endpoint)) {
    Serial.println("[ERROR] Error al iniciar cliente HTTP");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Dispositivo-Id", equipo::actual().dispositivoId);
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

static void agregarDiagnostico(JsonDocument& doc, const Diagnostico& d, const DiagWifi& w) {
  JsonObject diag = doc["diag"].to<JsonObject>();
  diag["reinicio"]             = d.reinicio;
  diag["cronometro"]           = d.cronometro;
  diag["seg_desde_lectura_ok"] = d.segDesdeLecturaOk;
  diag["fallos_inicio_sensor"] = d.fallosInicioSensor;
  diag["lecturas_fallidas"]    = d.lecturasFallidas;
  diag["en_rtc"]               = d.enRtc;
  diag["segmentos_flash"]      = d.segmentosFlash;
  diag["fallos_contacto"]      = d.fallosContacto;
  diag["rapidas_fallidas"]     = w.rapidasFallidas;
  if (d.fallosContacto > 0) {
    // 0 = no aplica: un fallo es de WiFi (motivo 802.11) o de HTTP (status, o <0 del cliente).
    diag["motivo_fallo_wifi"] = w.motivoFalloWifi;
    diag["codigo_fallo_http"] = w.codigoFalloHttp;
    diag["alerta_pendiente"]  = d.alertaPendiente;
  }
  diag["reglas"]               = d.reglas;
  diag["reloj_ppm"]            = d.relojPpm;
}

static void leerRespuesta(JsonDocument& json, Respuesta& r, bool& pideRotar) {
  r.serverEpoch          = json["server_epoch"] | 0;
  r.intervaloEnvioSeg    = json["intervalo_sugerido_seg"] | 0;
  r.intervaloContactoSeg = json["intervalo_contacto_seg"] | 0;
  pideRotar              = json["rotar_secret"] | false;

  // El backend manda siempre la lista de umbrales, vacía incluida.
  r.hayReglas  = true;
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

bool postear(const char* apiBase, const Lote& lote, const Estado& estado, const DiagWifi& wifi,
             Respuesta& respuesta, bool& pideRotar, int16_t& codigoFallo) {
  codigoFallo = 0;
  pideRotar   = false;
  respuesta   = Respuesta();

  JsonDocument doc;
  JsonArray mediciones = doc["mediciones"].to<JsonArray>();
  for (uint16_t i = 0; i < lote.cantidad; i++) agregarPunto(mediciones, lote.puntos[i]);
  if (estado.bateriaPct >= 0) doc["bateria_pct"] = estado.bateriaPct;
  agregarDiagnostico(doc, estado.diag, wifi);

  String payload;
  serializeJson(doc, payload);
  HTTPClient http;

  if (!configurarCliente(http, apiBase, "/mediciones/")) return false;

  Serial.printf("[HTTP] POST con %u mediciones\n", lote.cantidad);

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
      leerRespuesta(json, respuesta, pideRotar);
      respuesta.valida = true;
    }
  }

  http.end();
  return ok;
}

bool rotarSecret(const char* apiBase) {
  HTTPClient http;
  if (!configurarCliente(http, apiBase, "/dispositivos/rotate-secret")) return false;

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
