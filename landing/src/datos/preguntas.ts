// Fuente: Main.dc.html, const defPreguntas ~línea 1997. La FAQ se resuelve
// en build con <details name="preguntas"> nativo: no hace falta la clave
// `abierta` del mockup ni el índice `i`.
export interface Pregunta {
  p: string
  r: string
}

export const PREGUNTAS: Pregunta[] = [
  { p: '¿Cómo se instala?', r: 'Lo enchufás, te conectás desde el celular o la computadora a la red que genera el equipo y le pasás tu wi-fi desde el navegador. No hay que instalar una app ni tocar el router.' },
  { p: '¿Qué pasa si se corta internet?', r: 'El equipo sigue midiendo y guarda las lecturas. Cuando vuelve la conexión las manda todas y se pone al día solo. Mientras tanto lo vas a ver como "con retraso" en la plataforma.' },
  { p: '¿Qué sensores puedo elegir?', r: 'Temperatura, humedad, CO₂, humedad de suelo, radiación UV y presión. Si necesitás medir algo que no está en la lista, escribinos: lo evaluamos y lo integramos al equipo.' },
  { p: '¿Puedo pedir una configuración especial?', r: 'Sí. Cada equipo se arma, se compila y se flashea con la configuración del pedido, así que no hay kits fijos. Si tu ambiente necesita algo distinto, lo definimos antes de armarlo.' },
  { p: '¿Cómo funcionan las alertas?', r: 'Vos definís el rango de cada sensor. El equipo chequea cada 15 a 20 segundos y, si un valor cruza el umbral, te llega el aviso por email, WhatsApp o Telegram.' },
  { p: '¿Qué incluye LoRa?', r: 'La radio en el equipo más el gateway, que es un segundo equipo con su propia antena. Se usa cuando el sitio no tiene wi-fi o cuando el alcance no llega hasta donde está el equipo.' },
  { p: '¿Cuánto historial puedo consultar?', r: 'En Free se muestran los últimos 15 días y en Premium el historial completo. En los dos casos las mediciones se guardan enteras: el plan limita lo que se ve, no lo que se almacena.' },
  { p: '¿Puedo exportar mis datos?', r: 'Sí, en CSV. Free exporta el período visible y Premium todo el historial. Premium además genera informes del período que elijas.' },
  { p: '¿Puedo compartir un equipo con mi gente?', r: 'Con Premium, sí: sumás a las personas de tu equipo y cada una entra con su propia cuenta.' },
]
