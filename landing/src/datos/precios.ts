// Fuente: Main.dc.html (mockup Canvas), función renderVals() ~línea 1897 y
// precioDe() ~línea 1868. El mockup tenía DOS tablas de precio distintas:
// precioDe() cobraba temp:18/hum:16, la tabla P (la que arma el total) los
// daba en 0 ("GRATIS", como dicen los chips). Se unifica en esta única
// tabla — temperatura y humedad van incluidas en el equipo base.
export const BASE_USD = 79
export const GATEWAY_USD = 65

export type ClaveSensor = 'temp' | 'hum' | 'co2' | 'suelo' | 'uv' | 'pres'
export type ClaveEnergia = 'bat' | 'solar' | 'lora' | 'cel'
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
  cel: 30,
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
  cel: 'celular',
}

export const SENSORES: ClaveSensor[] = ['temp', 'hum', 'co2', 'suelo', 'uv', 'pres']
export const ENERGIA: ClaveEnergia[] = ['bat', 'solar', 'lora', 'cel']

/** El precio de tocar un módulo, gateway incluido cuando corresponde (LoRa). */
export function precioDe(clave: ClaveModulo): number {
  const extra = clave === 'lora' ? GATEWAY_USD : 0
  return PRECIOS[clave] + extra
}

export const UNIDAD_MEDIDA: Record<ClaveSensor, { valor: string; unidad: string }> = {
  temp: { valor: '23,4', unidad: '°C' },
  hum: { valor: '61', unidad: '% HR' },
  co2: { valor: '512', unidad: 'ppm' },
  suelo: { valor: '38', unidad: '% suelo' },
  uv: { valor: '7,2', unidad: 'UV' },
  pres: { valor: '1.013', unidad: 'hPa' },
}
