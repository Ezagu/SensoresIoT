import re
from pathlib import Path

INIT_SQL = (Path(__file__).resolve().parents[2] / "db" / "init.sql").read_text(encoding="utf-8")


def columnas_de(tabla):
    bloque = re.search(rf"CREATE TABLE {tabla} \((.*?)\n\);", INIT_SQL, re.S).group(1)
    return {linea.split()[0] for linea in bloque.strip().splitlines() if linea.strip()}


def test_init_sql_declara_la_columna_de_intentos_que_usa_el_backend():
    # auth_service lee usuario["intentos_fallidos"]; init.sql crea la columna en
    # singular, así que una instalación nueva devuelve 500 en cualquier login.
    assert "intentos_fallidos" in columnas_de("usuarios")
