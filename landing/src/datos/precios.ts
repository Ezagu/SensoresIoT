// Fuente: Main.dc.html (mockup Canvas), función renderVals() ~línea 1897.
// El mockup tenía DOS tablas de precio distintas y acá van unificadas en
// una: temperatura y humedad van incluidas en el equipo base.
export const BASE_USD = 79

export type ClaveSensor = 'temp' | 'hum' | 'co2' | 'suelo' | 'uv' | 'pres'
export type ClaveEnergia = 'bat' | 'solar' | 'lora' | 'gw'
export type ClaveModulo = ClaveSensor | ClaveEnergia

export const PRECIOS: Record<ClaveModulo, number> = {
  temp: 0,
  hum: 0,
  co2: 45,
  suelo: 18,
  uv: 14,
  pres: 12,
  bat: 10,
  solar: 25,
  lora: 35,
  gw: 65,
}

export const NOMBRES: Record<ClaveModulo, string> = {
  temp: 'temperatura',
  hum: 'humedad',
  co2: 'CO₂',
  suelo: 'humedad de suelo',
  uv: 'UV',
  pres: 'presión',
  bat: 'batería',
  solar: 'panel solar',
  lora: 'LoRa',
  gw: 'gateway LoRa',
}

export const SENSORES: ClaveSensor[] = ['temp', 'hum', 'co2', 'suelo', 'uv', 'pres']
export const ENERGIA: ClaveEnergia[] = ['bat', 'solar', 'lora', 'gw']

