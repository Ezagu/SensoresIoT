// Fuente: Main.dc.html, const escenas ~línea 1919. Cada ambiente es una
// configuración distinta del mismo equipo, dibujada aparte en
// componentes/dibujos/escenas/.
import type { ClaveModulo } from './precios'

export interface LecturaAmbiente {
  v: string
  u: string
  /** Puntos del sparkline SVG, "x,y x,y ..." tal como los usa el mockup. */
  p: string
}

export interface Ambiente {
  nombre: string
  config: string
  alt: string
  /** viewBox del recorte del equipo para este ambiente: "x y w h". */
  vista: string
  mods: Partial<Record<ClaveModulo | 'gw', 1>>
  datos: LecturaAmbiente[]
}

export const AMBIENTES: Ambiente[] = [
  {
    nombre: 'Cámara de frío',
    config: 'Temperatura · Humedad',
    alt: 'El equipo configurado para una cámara de frío, con sensores de temperatura y humedad',
    vista: '446 70 330 330',
    mods: { temp: 1, hum: 1 },
    datos: [
      { v: '4,2', u: '°C', p: '0,13 14,11 28,14 42,10 56,13 70,9 84,12' },
      { v: '87', u: '% HR', p: '0,9 14,12 28,8 42,11 56,7 70,10 84,9' },
    ],
  },
  {
    nombre: 'Invernadero',
    config: 'Temperatura · Humedad · CO₂',
    alt: 'El equipo configurado para un invernadero, con temperatura, humedad y CO₂',
    vista: '440 96 340 320',
    mods: { temp: 1, hum: 1, co2: 1 },
    datos: [
      { v: '23,8', u: '°C', p: '0,16 14,14 28,12 42,11 56,8 70,7 84,5' },
      { v: '62', u: '% HR', p: '0,7 14,9 28,8 42,11 56,10 70,13 84,11' },
      { v: '512', u: 'ppm', p: '0,12 14,8 28,13 42,7 56,12 70,9 84,11' },
    ],
  },
  {
    nombre: 'Campo',
    config: 'Temperatura · Suelo · UV · Batería · Panel solar · LoRa',
    alt: 'El equipo configurado para el campo, con batería, panel solar, LoRa y su gateway',
    vista: '444 74 620 356',
    mods: { temp: 1, suelo: 1, uv: 1, bat: 1, solar: 1, lora: 1, gw: 1 },
    datos: [
      { v: '18,4', u: '°C', p: '0,15 14,12 28,13 42,9 56,10 70,7 84,9' },
      { v: '38', u: '% suelo', p: '0,5 14,7 28,8 42,10 56,12 70,13 84,15' },
      { v: '7,2', u: 'UV', p: '0,17 14,13 28,9 42,5 56,7 70,11 84,14' },
    ],
  },
  {
    nombre: 'Depósito',
    config: 'Temperatura · Humedad · Celular',
    alt: 'El equipo configurado para un depósito, con conectividad celular',
    vista: '450 92 310 300',
    mods: { temp: 1, hum: 1, cel: 1 },
    datos: [
      { v: '21,4', u: '°C', p: '0,11 14,12 28,10 42,12 56,9 70,11 84,10' },
      { v: '48', u: '% HR', p: '0,12 14,10 28,11 42,9 56,11 70,10 84,12' },
    ],
  },
  {
    nombre: 'Laboratorio',
    config: 'Temperatura · Humedad · Presión',
    alt: 'El equipo configurado para un laboratorio, con temperatura, humedad y presión',
    vista: '446 92 320 300',
    mods: { temp: 1, hum: 1, pres: 1 },
    datos: [
      { v: '20,1', u: '°C', p: '0,11 14,10 28,11 42,10 56,11 70,10 84,10' },
      { v: '54', u: '% HR', p: '0,10 14,11 28,9 42,10 56,10 70,9 84,10' },
      { v: '1.013', u: 'hPa', p: '0,9 14,10 28,9 42,11 56,10 70,10 84,9' },
    ],
  },
]
