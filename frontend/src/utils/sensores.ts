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

/* El sistema Bitácora eliminó los seis hues por tipo de sensor: el color queda
   reservado para significado de estado, no para identidad de tipo. Todos los
   tipos comparten la línea de datos hasta que exista una paleta categórica
   propia (ver handoff/MAPEO.md — "Series categóricas": no improvisarla). */
const META: Record<ClaveSensor, MetaSensor> = {
  temperatura: { etiqueta: 'Temperatura', color: 'var(--color-chart-line)' },
  humedad: { etiqueta: 'Humedad', color: 'var(--color-chart-line)' },
  presion: { etiqueta: 'Presión', color: 'var(--color-chart-line)' },
  co2: { etiqueta: 'CO₂', color: 'var(--color-chart-line)' },
  luz: { etiqueta: 'Luz', color: 'var(--color-chart-line)' },
  ruido: { etiqueta: 'Ruido', color: 'var(--color-chart-line)' },
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

function claveDeTipo(nombre: string): ClaveSensor {
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

function metaDeTipo(nombre: string): MetaSensor {
  return META[claveDeTipo(nombre)]
}

/* Tipos cuyas lecturas llegan de verdad al cero. En temperatura o presión el
   cero es arbitrario y anclar aplasta la serie contra el borde superior. */
const DESDE_CERO: ClaveSensor[] = ['luz', 'ruido']

export function anclaEnCero(nombre: string): boolean {
  return DESDE_CERO.includes(claveDeTipo(nombre))
}

export type SensorEtiquetado = { etiqueta: string; unidad: string; color: string; tipo: string }

/* El sensor no tiene nombre propio: se lo identifica por tipo, con índice cuando
   el equipo repite tipo. Mismo criterio que el export CSV del backend. */
export function etiquetarSensores(
  sensores: { id: string; tipo_sensor_id: number; tipo_nombre: string; unidad: string }[],
): Map<string, SensorEtiquetado> {
  const total = new Map<number, number>()
  for (const s of sensores) {
    total.set(s.tipo_sensor_id, (total.get(s.tipo_sensor_id) ?? 0) + 1)
  }

  const vistos = new Map<number, number>()
  const salida = new Map<string, SensorEtiquetado>()
  for (const s of sensores) {
    const meta = metaDeTipo(s.tipo_nombre)
    let etiqueta = meta.etiqueta
    if ((total.get(s.tipo_sensor_id) ?? 0) > 1) {
      const n = (vistos.get(s.tipo_sensor_id) ?? 0) + 1
      vistos.set(s.tipo_sensor_id, n)
      etiqueta = `${meta.etiqueta} ${n}`
    }
    salida.set(s.id, { etiqueta, unidad: s.unidad, color: meta.color, tipo: s.tipo_nombre })
  }
  return salida
}
