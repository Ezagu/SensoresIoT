// Cada ambiente es una configuración distinta del mismo equipo: el dibujo sale
// de componentes/equipo/ (el mismo del hero y el configurador) y acá queda
// sólo qué módulos lleva puestos, cómo se llama y dónde recortar en angosto.
import type { ClaveModulo } from './precios'

export interface Ambiente {
  nombre: string
  config: string
  alt: string
  /** viewBox en pantallas angostas: el equipo y el lugar, "x y w h". */
  vista: string
  mods: Partial<Record<ClaveModulo, true>>
}

export const AMBIENTES: Ambiente[] = [
  {
    nombre: 'Cámara de frío',
    config: 'Temperatura · Humedad · Batería',
    alt: 'El equipo configurado para una cámara de frío, con temperatura, humedad y batería para los cortes de luz',
    vista: '130 60 790 440',
    mods: { temp: true, hum: true, bat: true },
  },
  {
    nombre: 'Invernadero',
    config: 'Temperatura · Humedad · CO₂ · UV',
    alt: 'El equipo configurado para un invernadero, con temperatura, humedad, CO₂ y radiación UV',
    vista: '110 80 930 460',
    mods: { temp: true, hum: true, co2: true, uv: true },
  },
  {
    nombre: 'Campo',
    config: 'Temperatura · Suelo · UV · Batería · Solar · LoRa',
    alt: 'El equipo configurado para el campo, con humedad de suelo, batería, panel solar, LoRa y su gateway',
    vista: '300 40 790 460',
    mods: { temp: true, suelo: true, uv: true, bat: true, solar: true, lora: true, gw: true },
  },
  {
    nombre: 'Depósito',
    config: 'Temperatura · Humedad',
    alt: 'El equipo configurado para un depósito, con temperatura y humedad',
    vista: '92 55 790 445',
    mods: { temp: true, hum: true },
  },
  {
    nombre: 'Laboratorio',
    config: 'Temperatura · Humedad · Presión',
    alt: 'El equipo configurado para un laboratorio, con temperatura, humedad y presión',
    vista: '92 95 790 405',
    mods: { temp: true, hum: true, pres: true },
  },
]
