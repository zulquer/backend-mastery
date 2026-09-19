# 🐘 PostgreSQL Level 03: Índices, Optimización de Consultas y MVCC

Análisis profundo de planes de ejecución, familias de índices, control de concurrencia multiversión (MVCC) y prevención de hinchazón de tablas (*Table Bloat*).

---

## 🔍 1. Familias de Índices en PostgreSQL

Elegir el tipo de índice adecuado es la diferencia entre una consulta de 5 segundos y una de 2 milisegundos:

### A. B-Tree (Balanced Tree - Por Defecto):
- Árbol balanceado para comparaciones de igualdad (`=`) y rangos (`<`, `<=`, `>`, `>=`, `BETWEEN`).
- Soporta ordenamiento eficiente en consultas con `ORDER BY`.
- Esencial para claves primarias y claves foráneas.

### B. GIN (Generalized Inverted Index):
- Índice invertido: asocia cada valor interno a una lista de filas que lo contienen.
- **Casos de Uso Ideales**:
  - Búsqueda de texto completo (*Full-Text Search* con `to_tsvector`).
  - Columnas de tipo Array (`WHERE tags @> ARRAY['typescript', 'nodejs']`).
  - Documentos `JSONB`:
    ```sql
    CREATE INDEX idx_users_metadata ON users USING GIN (metadata jsonb_path_ops);
    SELECT * FROM users WHERE metadata @> '{"role": "staff"}';
    ```

### C. BRIN (Block Range Index):
- Diseñado para tablas gigantescas (decenas de gigabytes) donde los datos se insertan de forma secuencial y permanecen ordenados físicamente en disco (ej. tablas de logs, auditoría o eventos de IoT).
- En lugar de indexar cada fila individual, indexa el valor mínimo y máximo de cada bloque de páginas (típicamente 128 páginas de disco).
- **Ventaja**: Un índice BRIN ocupa **hasta un 99% menos de espacio en disco y memoria RAM** que un B-Tree equivalente.

---

## 📊 2. Lectura de Planes de Ejecución: `EXPLAIN (ANALYZE, BUFFERS)`

Para diagnosticar el rendimiento de una consulta en producción, nunca uses solo `EXPLAIN`. Usa siempre:

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE)
SELECT id, email, created_at FROM users WHERE email = 'dev@empresa.com';
```

### Tipos de Escaneo de Menor a Mayor Eficiencia:
1. **Sequential Scan (`Seq Scan`)**: Lee secuencialmente todas las páginas de la tabla desde el disco. Óptimo solo para tablas pequeñas (< 1,000 filas). Desastroso para tablas grandes.
2. **Index Scan**: Recorre el índice para encontrar los identificadores de fila (`ctid`), y luego lee cada fila correspondiente en la tabla del disco.
3. **Bitmap Index Scan + Bitmap Heap Scan**: Se activa cuando la consulta coincide con muchas filas. Primero crea un mapa de bits en memoria con las páginas necesarias, y luego lee las páginas secuencialmente, minimizando lecturas aleatorias en disco.
4. **Index Only Scan**: El santo grial. La consulta se responde **íntegramente leyendo el índice**, sin tocar la tabla física en disco. Requiere que todas las columnas seleccionadas estén en el índice y que el Visibility Map esté actualizado por VACUUM.

---

## 🗑️ 3. MVCC, Dead Tuples y la Mecánica de VACUUM

PostgreSQL implementa **Multi-Version Concurrency Control (MVCC)**:
- Los lectores nunca bloquean a los escritores, y los escritores nunca bloquean a los lectores.
- Cada fila (*tuple*) posee cabeceras ocultas del sistema:
  - `xmin`: ID de la transacción que insertó la fila.
  - `xmax`: ID de la transacción que eliminó o actualizó la fila.

### Por qué `UPDATE` genera Tuplas Muertas (*Dead Tuples*):
En PostgreSQL, una sentencia `UPDATE` **nunca modifica la fila en su lugar físico (*in-place*)**:
1. Escribe una fila completamente nueva con los nuevos valores (`xmin = tx_actual`).
2. Marca la fila vieja como muerta (`xmax = tx_actual`).
3. Las filas viejas siguen ocupando espacio en el archivo de disco hasta que una rutina de **VACUUM** limpie las tuplas muertas que ya no son visibles para ninguna transacción activa.

### Hinchazón de Tablas (*Table Bloat*):
Si una tabla sufre millones de `UPDATE` por hora y el proceso en segundo plano `autovacuum` no tiene recursos suficientes para limpiar, el archivo en disco crece indefinidamente, degradando la memoria compartida (*Shared Buffers*) y obligando a escaneos más lentos.
