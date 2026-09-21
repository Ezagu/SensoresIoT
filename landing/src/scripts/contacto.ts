// Fuente: Main.dc.html — enviarConsulta() (~línea 2188). Inerte a propósito
// (ver el TODO en Contacto.astro): sólo cambia al estado "enviado", no
// manda nada a ningún lado.
const form = document.getElementById('form-contacto')
const gracias = document.getElementById('form-gracias')

if (form && gracias) {
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    form.hidden = true
    gracias.hidden = false
  })
}

export {}
