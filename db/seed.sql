-- 1. Un tipo de sensor
INSERT INTO tipos_sensor (nombre, unidad, valor_min, valor_max)
VALUES ('temperatura', '°C', -10, 50);

-- 2. Un usuario dueño
INSERT INTO usuarios (nombre, email, password)
VALUES ('Test User', 'test@test.com', 'hasheado_dummy')
RETURNING id;
-- copiá el id que te devuelve y pegalo abajo en \gset o a mano

-- 3. Un dispositivo (reemplazá el UUID del usuario)
INSERT INTO dispositivos (usuario_id, codigo, nombre, ubicacion)
VALUES ('67cb4055-5ca5-4718-8819-d5be28572fe1', 'ESP32-001', 'Placa Lote Norte', 'Campo A')
RETURNING id;

-- 4. Un sensor en ese dispositivo (reemplazá el UUID del dispositivo)
INSERT INTO sensores (dispositivo_id, tipo_sensor_id, nombre)
VALUES ('9907a9d6-4378-48ac-85ce-99f34a03d106', 1, 'Sensor Temp 1')
RETURNING id;

-- 5. Mediciones de prueba (reemplazá el UUID del sensor)
INSERT INTO mediciones (time, sensor_id, value)
SELECT
  now() - (i || ' minutes')::interval,
  '838de415-964b-41be-86bc-ffff51f7f070',
  20 + 5 * sin(i / 10.0)  -- valores que oscilan, simulando temperatura real
FROM generate_series(0, 500) AS i;