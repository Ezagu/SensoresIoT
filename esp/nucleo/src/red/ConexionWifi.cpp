#include "red/ConexionWifi.h"
#include "equipo/Equipo.h"
#include "reloj/Reloj.h"
#include <WiFi.h>
#include <WiFiManager.h>
#include <esp_task_wdt.h>
#include <esp_wifi.h>
#include <esp_netif.h>
#include <esp_netif_net_stack.h>
#include <lwip/dhcp.h>

namespace conexionWifi {

const uint32_t TIMEOUT_PORTAL_SEG  = 600;
const uint32_t MS_TIMEOUT_CONEXION = 10000;

// Con canal y BSSID conocidos se asocia en <1 s; si el AP cambió, falla rápido.
const uint32_t MS_TIMEOUT_CONEXION_RAPIDA = 3000;

// Lo que hace falta para saltear el escaneo de canales y el DHCP.
struct RedConocida {
  bool     valida;
  uint8_t  canal;
  uint8_t  bssid[6];
  uint32_t ip, gateway, mascara, dns;
  uint32_t ipVenceLocal;  // 0 = sin IP reutilizable
};

RTC_DATA_ATTR static RedConocida red = {};
RTC_DATA_ATTR static uint16_t conexionesRapidasFallidas = 0;

static uint8_t ultimoMotivoDesconexion = 0;

uint8_t ultimoMotivo()     { return ultimoMotivoDesconexion; }
uint16_t rapidasFallidas() { return conexionesRapidasFallidas; }

void apagar() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}

static ResultadoWifi abrirPortal(WiFiManager& wm) {
  const Equipo& e = equipo::actual();
  wm.setConfigPortalTimeout(TIMEOUT_PORTAL_SEG);

  Serial.printf("[WiFi] Portal abierto. Red: %s | IP: 192.168.4.1\n", e.apNombre);

  // El portal bloquea hasta 10 min: el watchdog reiniciaría en plena configuración.
  esp_task_wdt_delete(NULL);
  bool configurado = wm.startConfigPortal(e.apNombre, e.apPassword);
  esp_task_wdt_add(NULL);

  if (configurado) {
    Serial.printf("[WiFi] Configurado y conectado. IP: %s\n", WiFi.localIP().toString().c_str());
    return WIFI_CONECTADO;
  }

  apagar();
  Serial.println("[WiFi] Portal expirado sin configuracion.");

  return WIFI_PORTAL_EXPIRADO;
}

static void listarRedes() {
  int16_t cantidad = WiFi.scanNetworks();
  Serial.printf("[WiFi] %d redes visibles:\n", cantidad);
  for (int16_t i = 0; i < cantidad; i++) {
    Serial.printf("  %-32s canal %2ld  %4ld dBm  seguridad %d\n",
                  WiFi.SSID(i).c_str(), (long) WiFi.channel(i), (long) WiFi.RSSI(i),
                  (int) WiFi.encryptionType(i));
  }
  WiFi.scanDelete();
}

// La IP se reutiliza hasta la mitad del lease (el T1 del RFC 2131), nunca más allá.
static void recordarIp() {
  red.ipVenceLocal = 0;

  struct netif* n = (struct netif*) esp_netif_get_netif_impl(WiFi.STA.netif());
  struct dhcp*  d = n ? netif_dhcp_data(n) : nullptr;
  if (!d || d->offered_t0_lease == 0) return;

  red.ip           = (uint32_t) WiFi.localIP();
  red.gateway      = (uint32_t) WiFi.gatewayIP();
  red.mascara      = (uint32_t) WiFi.subnetMask();
  red.dns          = (uint32_t) WiFi.dnsIP(0);
  red.ipVenceLocal = reloj::ahora() + d->offered_t0_lease / 2;
}

static void recordarRed() {
  red.canal = WiFi.channel();
  memcpy(red.bssid, WiFi.BSSID(), 6);
  red.valida = true;
  recordarIp();
}

static bool conectarRapido() {
  wifi_config_t conf;
  esp_wifi_get_config(WIFI_IF_STA, &conf);
  conf.sta.channel   = red.canal;
  conf.sta.bssid_set = 1;
  memcpy(conf.sta.bssid, red.bssid, 6);
  esp_wifi_set_config(WIFI_IF_STA, &conf);

  // Pasado el vencimiento la IP puede estar asignada a otro equipo de la red.
  bool ipVigente = red.ipVenceLocal && (int32_t) (red.ipVenceLocal - reloj::ahora()) > 0;
  if (ipVigente) {
    WiFi.config(IPAddress(red.ip), IPAddress(red.gateway), IPAddress(red.mascara), IPAddress(red.dns));
  } else {
    red.ipVenceLocal = 0;
  }

  WiFi.begin();
  if (WiFi.waitForConnectResult(MS_TIMEOUT_CONEXION_RAPIDA) != WL_CONNECTED) return false;

  if (!ipVigente) recordarIp();
  return true;
}

static void prepararConexionNormal() {
  WiFi.config(INADDR_NONE, INADDR_NONE, INADDR_NONE);

  wifi_config_t conf;
  esp_wifi_get_config(WIFI_IF_STA, &conf);
  conf.sta.channel   = 0;
  conf.sta.bssid_set = 0;
  esp_wifi_set_config(WIFI_IF_STA, &conf);
}

ResultadoWifi conectar(bool permitirPortal) {
  WiFi.mode(WIFI_STA);
  WiFiManager wm;

  if (!wm.getWiFiIsSaved()) {
    if (!permitirPortal) {
      Serial.println("[WiFi] Sin credenciales; el portal sólo se abre en un arranque en frío.");
      apagar();
      return WIFI_SIN_CREDENCIALES;
    }
    return abrirPortal(wm);
  }

  // Sólo RAM: la config con canal/BSSID es de este despertar y no tiene que
  // pisar en NVS la credencial que guardó WiFiManager.
  esp_wifi_set_storage(WIFI_STORAGE_RAM);

  WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t info) {
    ultimoMotivoDesconexion = info.wifi_sta_disconnected.reason;
  }, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);

  uint32_t inicioMs = millis();

  if (red.valida) {
    if (conectarRapido()) {
      Serial.printf("[WiFi] Conectado (rápida%s) en %lums. IP: %s\n",
                    red.ipVenceLocal ? ", IP fija" : "", (unsigned long) (millis() - inicioMs),
                    WiFi.localIP().toString().c_str());
      return WIFI_CONECTADO;
    }
    // Canal o AP cambiados (reinicio del router, mesh): se olvida y va la normal.
    Serial.printf("[WiFi] Falló la conexión rápida (motivo %u), se intenta la normal.\n",
                  ultimoMotivoDesconexion);
    conexionesRapidasFallidas++;
    red.valida = false;
    WiFi.disconnect(false, false);
    prepararConexionNormal();
  }

  WiFi.begin();
  if (WiFi.waitForConnectResult(MS_TIMEOUT_CONEXION) == WL_CONNECTED) {
    Serial.printf("[WiFi] Conectado (normal) en %lums. IP: %s\n",
                  (unsigned long) (millis() - inicioMs), WiFi.localIP().toString().c_str());
    recordarRed();
    return WIFI_CONECTADO;
  }

  // WiFi.SSID() sólo devuelve la red conectada; la guardada está en la config.
  wifi_config_t conf;
  esp_wifi_get_config(WIFI_IF_STA, &conf);
  Serial.printf("[WiFi] No se pudo conectar a \"%s\": estado %d, motivo %u (%s)\n",
                (const char*) conf.sta.ssid, (int) WiFi.status(), ultimoMotivoDesconexion,
                WiFi.disconnectReasonName((wifi_err_reason_t) ultimoMotivoDesconexion));

  // Escanear cuesta ~2 s de radio: sólo en frío, que es cuando alguien mira el serial.
  // Sin cortar el intento en curso y la reconexión automática, el escaneo aborta vacío.
  if (permitirPortal) {
    WiFi.setAutoReconnect(false);
    WiFi.disconnect(false, false);
    listarRedes();
  }

  apagar();
  return WIFI_FALLO;
}

}
