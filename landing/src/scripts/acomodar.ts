// Modo de acomodado para diseñar: `?acomodar` en dev. Arrastrás cada módulo
// sobre el dibujo y el panel te va dando el par x/y que hay que pegar en el
// default del componente. Todo el bloque cae en el build de producción porque
// import.meta.env.DEV es una constante que Vite reemplaza.
const PASO = 2
const NOMBRES: Record<string, string> = {
  temp: 'Temperatura', hum: 'Humedad', co2: 'Co2', suelo: 'Suelo', uv: 'Uv',
  pres: 'Presion', bat: 'Bateria', solar: 'Solar', lora: 'Lora',
}

if (import.meta.env.DEV && new URLSearchParams(location.search).has('acomodar')) {
  const svg = document.getElementById('equipo-svg') as SVGSVGElement | null
  const unidad = svg?.querySelector<SVGGElement>('.unit-main')

  if (svg && unidad) {
    const NS = 'http://www.w3.org/2000/svg'
    const capa = document.createElementNS(NS, 'g')
    capa.setAttribute('id', 'acomodar-capa')
    unidad.appendChild(capa)

    const panel = document.createElement('div')
    panel.id = 'acomodar-panel'
    document.body.appendChild(panel)

    const estilo = document.createElement('style')
    estilo.textContent = `
      #acomodar-capa rect { fill: transparent; stroke: var(--lp-accent); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.25; cursor: move; }
      #acomodar-capa rect:hover { opacity: 0.7; }
      #acomodar-capa rect.sel { opacity: 1; stroke-dasharray: none; }
      #acomodar-panel { position: fixed; bottom: 12px; left: 12px; z-index: 99; background: var(--lp-surface); border: 1px solid var(--lp-line); border-radius: 10px; padding: 10px 12px; font-family: var(--font-mono); font-size: 11px; line-height: 1.8; color: var(--lp-dim); box-shadow: 0 8px 24px #0006; }
      #acomodar-panel b { color: var(--lp-accent); font-weight: 400; }
      #acomodar-panel .sel { color: var(--lp-text); }
      #acomodar-panel .pie { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--lp-line-soft); color: var(--lp-faint); font-size: 10px; }
    `
    document.head.appendChild(estilo)

    let seleccion: string | null = null

    const destino = (clave: string) =>
      document.querySelector<SVGGElement>(`#mod-${clave} [data-pos]`)

    const leer = (clave: string): [number, number] => {
      const t = destino(clave)?.getAttribute('transform') ?? ''
      const m = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(t)
      return m ? [+m[1], +m[2]] : [0, 0]
    }

    const escribir = (clave: string, x: number, y: number) => {
      destino(clave)?.setAttribute('transform', `translate(${x} ${y})`)
      dibujar()
    }

    const activos = () =>
      Object.keys(NOMBRES).filter((k) => document.getElementById(`mod-${k}`)?.classList.contains('on'))

    function texto(): string {
      return activos()
        .map((k) => {
          const [x, y] = leer(k)
          return `<div class="${k === seleccion ? 'sel' : ''}">${NOMBRES[k]}.astro <b>x = ${x}</b> <b>y = ${y}</b></div>`
        })
        .join('')
    }

    function dibujar() {
      capa.replaceChildren()
      activos().forEach((k) => {
        const g = document.getElementById(`mod-${k}`) as unknown as SVGGraphicsElement | null
        if (!g) return
        const b = g.getBBox()
        const r = document.createElementNS(NS, 'rect')
        r.setAttribute('x', String(b.x - 3))
        r.setAttribute('y', String(b.y - 3))
        r.setAttribute('width', String(b.width + 6))
        r.setAttribute('height', String(b.height + 6))
        r.dataset.clave = k
        if (k === seleccion) r.classList.add('sel')
        capa.appendChild(r)
      })
      panel.innerHTML = texto() + '<div class="pie">arrastrar · flechas 1px · shift 10px · C copia</div>'
    }

    capa.addEventListener('pointerdown', (e) => {
      const r = e.target as SVGRectElement
      const clave = r.dataset?.clave
      if (!clave) return
      e.preventDefault()
      seleccion = clave

      const base = (r.parentNode as SVGGraphicsElement).getScreenCTM()
      if (!base) return
      const inv = base.inverse()
      const aLocal = (ev: PointerEvent) => new DOMPoint(ev.clientX, ev.clientY).matrixTransform(inv)
      const desde = aLocal(e)
      const [x0, y0] = leer(clave)

      const pos = destino(clave)
      if (pos) pos.style.transition = 'none'

      const mover = (ev: PointerEvent) => {
        const p = aLocal(ev)
        const paso = ev.altKey ? 1 : PASO
        const x = Math.round((x0 + p.x - desde.x) / paso) * paso
        const y = Math.round((y0 + p.y - desde.y) / paso) * paso
        escribir(clave, x, y)
      }
      const soltar = () => {
        if (pos) pos.style.transition = ''
        window.removeEventListener('pointermove', mover)
        window.removeEventListener('pointerup', soltar)
      }
      window.addEventListener('pointermove', mover)
      window.addEventListener('pointerup', soltar)
      dibujar()
    })

    window.addEventListener('keydown', (e) => {
      if (!seleccion) return
      if (e.key === 'c' || e.key === 'C') {
        const lineas = activos().map((k) => {
          const [x, y] = leer(k)
          return `${NOMBRES[k]}.astro  x = ${x}, y = ${y}`
        })
        navigator.clipboard?.writeText(lineas.join('\n'))
        return
      }
      const d: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      }
      const paso = d[e.key]
      if (!paso) return
      e.preventDefault()
      const k = e.shiftKey ? 10 : 1
      const [x, y] = leer(seleccion)
      escribir(seleccion, x + paso[0] * k, y + paso[1] * k)
    })

    new MutationObserver(dibujar).observe(unidad, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })
    dibujar()
  }
}
