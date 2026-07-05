import type { SubmitEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import { CartesianGrid, Legend, Line, LineChart, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area } from "recharts"

const GraficaSensor = ({sensorId}: {sensorId: string}) => {
  const [data, setData] = useState(null)
  const [desde, setDesde] = useState()
  const [hasta, setHasta] = useState()
  const [showMin, setShowMin] = useState(false)
  const [showMax, setShowMax] = useState(false)
  const [tipoSensor, setTipoSensor] = useState({})

  const obtenerDataGrafico = async ({ sensorId } : { sensorId: string }) => {
    const intervalo = (desde || hasta) ? `?${desde ? `desde=${desde}`: ""}${hasta ? (desde ? `&`: "") + `hasta=${hasta}`:""}` : ""
    const req = await fetch(`http://192.168.1.14:8000/sensores/${sensorId}/mediciones/grafico${intervalo}`)
    setData(await req.json())
  }

  const obtenerTipoSensor = async ({ sensorId } : { sensorId: string }) => {
    const req = await fetch(`http://192.168.1.14:8000/sensores/${sensorId}/tipo-sensor`)
    setTipoSensor(await req.json())
  }

  useEffect(() => {
    obtenerDataGrafico({ sensorId })
  }, [sensorId, desde, hasta])

  useEffect(() => {
    obtenerTipoSensor({ sensorId })
  }, [sensorId])

  const dataCharts = useMemo(() => {
    if(!data) return
    const newData = data.puntos.map(p => ({
      ...p,
      bucketTs: new Date(p.bucket).getTime(),
      minimo: [p.minimo, p.promedio],
      maximo: [p.promedio, p.maximo]
    }))
    console.log(newData)
    return newData
  }, [data])

  const dominioX = useMemo(() => {
    const hastaMs = hasta ? new Date(hasta).getTime() : Date.now()
    const desdeMs = desde ? new Date(desde).getTime() : hastaMs - 24*60*60*1000
    return [desdeMs, hastaMs]
  }, [desde, hasta])

  if(!data) return

  return (
    <div>
      <ResponsiveContainer width="100%" height={300} >
        <ComposedChart data={dataCharts} margin={{right: 60, bottom: 40}}>
          <CartesianGrid
            vertical={false}
            stroke="#c4c4c5"
            strokeDasharray="3"
          />
          <XAxis
            dataKey="bucketTs"
            type="number"
            domain={dominioX}
            scale="time"
            tickFormatter={(value) =>
              new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
            }
            stroke="#71717a"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            stroke="#71717a"
            tickFormatter={(valor) => `${valor} ${tipoSensor.unidad}`}
            tick={{fontSize: 12}}
            domain={[Math.round(data.resumen.minimo - 1), Math.round(data.resumen.maximo + 1)]}
          />
          <Tooltip
            formatter={(value, name) => {
              if (Array.isArray(value)) {
                  if (name === "minimo") {
                      return [`${value[0].toFixed(2)} ${tipoSensor.unidad}`, "Mínimo"];
                  }

                  if (name === "maximo") {
                      return [`${value[1].toFixed(2)} ${tipoSensor.unidad}`, "Máximo"];
                  }
              }

              return [`${Number(value).toFixed(2)} ${tipoSensor.unidad}`, "Promedio"];
          }}
            labelFormatter={(value) =>
              new Date(value).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            }
          />
          {/* <Legend 
            formatter={(value: string) => `${value.slice(0, 1).toUpperCase() + value.slice(1)}`}
          /> */}
          <Line
            dataKey="promedio"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={false}
            type="monotone"
          />
          {showMin &&
            <Area dataKey="minimo" fill="#00ff37" type="monotone"/>
          }
          {showMax &&
            <Area dataKey="maximo" fill="#fd0606" type="monotone"/>
          }

        </ComposedChart>
      </ResponsiveContainer>
      <button onClick={() => setDesde(new Date(Date.now() - 60 * 60 * 1000).toISOString())}>1h</button>
      <button onClick={() => setDesde(new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())}>6h</button>
      <button onClick={() => setDesde(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())}>24h</button>
      <button onClick={() => setDesde(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())}>7d</button>
      <button onClick={() => setDesde(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())}>1m</button>
      <button onClick={() => setShowMin(p => !p)}>{showMin ? "Ocultar mínimos" : "Mostrar mínimos"}</button>
      <button onClick={() => setShowMax(p => !p)}>{showMin ? "Ocultar máximos" : "Mostrar máximos"}</button>
    </div>
    
  )
}

export const Home = () => {
  const [usuarioId, setUsuarioId] = useState(null)
  const [dispositivos, setDispositivos] = useState([])
  const [sensores, setSensores] = useState([])
  const [dispositivoSeleccionado, setDispositivoSeleccionado] = useState()

  const buscarDispositivos = async ({ usuarioId }: { usuarioId : string }) => {
    const request = await fetch(`http://192.168.1.14:8000/usuarios/${usuarioId}/dispositivos`)
    const res = await request.json()
    setDispositivos(res)
    setDispositivoSeleccionado(res[0].id)
  }

  const buscarSensores = async ({dispositivoId}: {dispositivoId: string}) => {
    const request = await fetch(`http://192.168.1.14:8000/dispositivos/${dispositivoId}/sensores`)
    setSensores(await request.json())
  }

  useEffect(() => {
    if(usuarioId) {
      buscarDispositivos({ usuarioId })
    }
  }, [usuarioId])

  useEffect(() => {
    if(dispositivoSeleccionado) {
      buscarSensores({ dispositivoId: dispositivoSeleccionado })
    }
  }, [dispositivoSeleccionado])

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUsuarioId(e.target.usuarioId.value)
  }

  const handleSelect = (e: SubmitEvent<HTMLFormElement>) => {
    setDispositivoSeleccionado(e.target.value)
  }

  return (
    <main>
      <form onSubmit={handleSubmit}>
        <p>Ingrese un usuario ID</p>
        <input type="text" name="usuarioId"/>
        <input type="submit"/>
      </form>
      <p>
        Usuario ID: {usuarioId}
      </p>
      <select onChange={handleSelect}>
        {dispositivos && dispositivos.length > 0 &&
          dispositivos.map(d => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))
        }
      </select>
      <p>
        Sensores:
      </p>
      <ul>
        {sensores && sensores.length > 0 &&
          sensores.map((sensor) => (
            <li key={sensor.id}>{sensor.nombre}</li>
          ))
        }
      </ul>
      {
        sensores && sensores.length > 0 &&
          sensores.map((sensor) => (
            <GraficaSensor key={sensor.id} sensorId={sensor.id}/>
          ))
      }
    </main>
  )
}