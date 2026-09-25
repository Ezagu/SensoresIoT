// Fuente: Main.dc.html, const defPreguntas ~línea 1997. La FAQ se resuelve
// en build con <details name="preguntas"> nativo: no hace falta la clave
// `abierta` del mockup ni el índice `i`.
export interface Pregunta {
  p: string
  r: string
}

export const PREGUNTAS: Pregunta[] = [
  { p: '¿Qué necesito para instalarlo?', r: 'Un enchufe y wi-fi. Lo enchufás, te conectás desde el celular a la red que genera el equipo y le pasás tu wi-fi. En unos minutos ya ves las primeras mediciones en la app.' },
  { p: 'Si el registro es cada 5 minutos, ¿me entero tarde de un problema?', r: 'No. El equipo mide cada 15 segundos aunque guarde un punto cada 5 minutos, y si un valor se sale de rango lo manda en el momento. Para no avisarte por una lectura suelta lo confirmamos con tres seguidas, así que el aviso te llega en alrededor de un minuto.' },
  { p: '¿Qué pasa si se corta internet o la luz?', r: 'Si se corta internet, el equipo sigue midiendo, guarda las lecturas y las manda cuando vuelve la conexión. Si se corta la luz y no tiene batería, se apaga y no mide mientras dure el corte. En los dos casos, a los 15 minutos te avisamos que dejó de reportar.' },
  { p: '¿Cuándo me conviene LoRa?', r: 'Cuando donde va el equipo no llega el wi-fi. El equipo manda las mediciones por radio a un gateway, un segundo equipo que ponés donde sí hay internet.' },
  { p: '¿Tiene un costo mensual?', r: 'El equipo se paga una sola vez y con el plan Free lo usás sin costo. Premium se paga por equipo y por mes, y si lo dejás no se borra nada: volvés a ver los últimos 15 días, pero el historial completo sigue guardado.' },
  { p: '¿Pueden agregar un sensor que no está en el configurador?', r: 'Escribinos por WhatsApp contando qué necesitás medir y lo charlamos.' },
]
