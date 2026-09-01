import type { TipoSensor } from './tipos'

export type ClaveSensor =
  | 'temperatura'
  | 'humedad'
  | 'presion'
  | 'co2'
  | 'luz'
  | 'ruido'
  | 'desconocido'

type MetaSensor = {
  etiqueta: string
  /* var() del token de color. El mismo tipo lleva siempre el mismo hue. */
  color: string
}

const META: Record<ClaveSensor, MetaSensor> = {
  temperatura: { etiqueta: 'Temperatura', color: 'var(--color-sensor-temperatura)' },
  humedad: { etiqueta: 'Humedad', color: 'var(--color-sensor-humedad)' },
  presion: { etiqueta: 'Presión', color: 'var(--color-sensor-presion)' },
  co2: { etiqueta: 'CO₂', color: 'var(--color-sensor-co2)' },
  luz: { etiqueta: 'Luz', color: 'var(--color-sensor-luz)' },
  ruido: { etiqueta: 'Ruido', color: 'var(--color-sensor-ruido)' },
  desconocido: { etiqueta: 'Sensor', color: 'var(--color-text-muted)' },
}

/* El casing no es confiable: el seed guarda "temperatura" y el alta por API
   hace .capitalize() -> "Temperatura". Se normaliza antes de mapear. */
const SIN_TILDE: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ü: 'u',
}

export function claveDeTipo(nombre: string): ClaveSensor {
  const limpio = nombre
    .trim()
    .toLowerCase()
    .replace(/[áéíóúü]/g, (c) => SIN_TILDE[c] ?? c)

  if (limpio.includes('temperatura')) return 'temperatura'
  if (limpio.includes('humedad')) return 'humedad'
  if (limpio.includes('presion')) return 'presion'
  if (limpio.includes('co2') || limpio.includes('dioxido')) return 'co2'
  if (limpio.includes('luz') || limpio.includes('lumin')) return 'luz'
  if (limpio.includes('ruido') || limpio.includes('sonido')) return 'ruido'
  return 'desconocido'
}

export function metaDeTipo(nombre: string): MetaSensor {
  return META[claveDeTipo(nombre)]
}

export function colorDeTipo(nombre: string): string {
  return metaDeTipo(nombre).color
}

/* El sensor no tiene nombre propio en el modelo: se lo identifica por tipo +
   unidad, desambiguando con índice cuando el dispositivo repite tipo. Mismo criterio
   que ya usa el export CSV del backend. */
export function etiquetarSensores(
  sensores: { id: string; tipo_sensor_id: number }[],
  tipos: TipoSensor[],
): Map<string, { etiqueta: string; unidad: string; color: string; tipo: string }> {
  const porId = new Map(tipos.map((t) => [t.id, t]))
  const vistos = new Map<number, number>()
  const total = new Map<number, number>()

  for (const s of sensores) {
    total.set(s.tipo_sensor_id, (total.get(s.tipo_sensor_id) ?? 0) + 1)
  }

  const salida = new Map<string, { etiqueta: string; unidad: string; color: string; tipo: string }>()
  for (const s of sensores) {
    const tipo = porId.get(s.tipo_sensor_id)
    const nombre = tipo?.nombre ?? 'Sensor'
    const meta = metaDeTipo(nombre)
    const repetido = (total.get(s.tipo_sensor_id) ?? 0) > 1

    let etiqueta = meta.etiqueta
    if (repetido) {
      const n = (vistos.get(s.tipo_sensor_id) ?? 0) + 1
      vistos.set(s.tipo_sensor_id, n)
      etiqueta = `${meta.etiqueta} ${n}`
    }

    salida.set(s.id, {
      etiqueta,
      unidad: tipo?.unidad ?? '',
      color: meta.color,
      tipo: nombre,
    })
  }
  return salida
}
