-- 1. Un tipo de sensor
INSERT INTO tipos_sensor (nombre, unidad)
VALUES ('temperatura', '°C');

-- 2. Un usuario dueño
INSERT INTO usuarios (nombre, email, password)
VALUES ('Test User', 'test@test.com', 'hasheado_dummy')
RETURNING id;
-- copiá el id que te devuelve y pegalo abajo en \gset o a mano

-- 3. Un dispositivo (reemplazá el UUID del usuario)
INSERT INTO dispositivos (usuario_id, nombre, ubicacion)
VALUES ('eb055521-5403-452f-aaac-727aad6fcc8b', 'Placa Lote Norte', 'Campo A')
RETURNING id;

-- 4. Un sensor en ese dispositivo (reemplazá el UUID del dispositivo)
INSERT INTO sensores (dispositivo_id, tipo_sensor_id, nombre)
VALUES ('21f23549-6f5f-41fb-848d-6bf17f97e414', 1, 'Sensor Temp 1')
RETURNING id;

-- 5. Mediciones de prueba (reemplazá el UUID del sensor)
INSERT INTO mediciones (time, sensor_id, value)
SELECT
  now() - (i || ' minutes')::interval,
  'ee873687-be96-4add-93c4-5e37fb1d079b',
  20 + 5 * sin(i / 10.0)  -- valores que oscilan, simulando temperatura real
FROM generate_series(0, 500) AS i;