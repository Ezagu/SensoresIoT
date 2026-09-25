// Cada ambiente es una configuración distinta del mismo equipo: el dibujo sale
// de componentes/equipo/ (el mismo del hero y el configurador) y acá queda
// sólo qué módulos lleva puestos, cómo se llama y dónde recortar en angosto.
import type { ClaveModulo } from './precios'

export interface Ambiente {
  nombre: string
  config: string
  alt: string
  mods: Partial<Record<ClaveModulo, true>>
}

export const AMBIENTES: Ambiente[] = [
  {
    nombre: 'Cámara de frío',
    config: 'Temperatura · Humedad · Batería',
    alt: 'El equipo configurado para una cámara de frío, con temperatura, humedad y batería para los cortes de luz',
    mods: { temp: true, hum: true, bat: true },
  },
  {
    nombre: 'Invernadero',
    config: 'Temperatura · Humedad · CO₂ · UV',
    alt: 'El equipo configurado para un invernadero, con temperatura, humedad, CO₂ y radiación UV',
    mods: { temp: true, hum: true, co2: true, uv: true },
  },
  {
    nombre: 'Campo',
    config: 'Temperatura · Suelo · UV · Batería · Solar · LoRa',
    alt: 'El equipo configurado para el campo, con humedad de suelo, batería, panel solar, LoRa y su gateway',
    mods: { temp: true, suelo: true, uv: true, bat: true, solar: true, lora: true, gw: true },
  },
  {
    nombre: 'Depósito',
    config: 'Temperatura · Humedad',
    alt: 'El equipo configurado para un depósito, con temperatura y humedad',
    mods: { temp: true, hum: true },
  },
  {
    nombre: 'Laboratorio',
    config: 'Temperatura · Humedad · Presión',
    alt: 'El equipo configurado para un laboratorio, con temperatura, humedad y presión',
    mods: { temp: true, hum: true, pres: true },
  },
]

// Pantallas angostas: el lienzo de 1240x500 se recorta alrededor del equipo.
// Sin gateway el gabinete (x≈524–754) ocupa la mitad del ancho; con gateway
// el recorte se aleja lo necesario para que entren los dos cuerpos
// (x≈361–943: sin gateway el gabinete va corrido 110, ver .unit-main en
// equipo.css). Las dos cajas tienen la misma proporción (644/462 = 460/330),
// así que a igual ancho de pantalla dan el mismo alto y el carrusel no salta.
// Coordenadas del <svg>, no de Cuerpo.astro: el equipo entra con
// "translate(252 -20) scale(0.9)".
export interface Vista { x: number; y: number; ancho: number; alto: number }
export const VISTA_MOVIL: Vista = { x: 409, y: 116, ancho: 460, alto: 330 }
export const VISTA_MOVIL_GW: Vista = { x: 330, y: 21, ancho: 644, alto: 462 }
