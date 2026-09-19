# 🌐 REST APIs: Rendimiento, Caching y Paginación a Gran Escala

Optimización de transferencia de datos en APIs de alto rendimiento: validación condicional con ETags, streaming de payloads masivos y paginación indexada por cursor.

---

## ⚡ 1. Caching HTTP y Validación Condicional

### A. Directivas de `Cache-Control`:
- `max-age=300`: Caché válida por 300 segundos en navegadores y proxies intermedios.
- `s-maxage=86400`: Caché válida por 24 horas solo en proxies compartidos o CDNs (Cloudflare, Fastly).
- `stale-while-revalidate=60`: Si la caché expiró, sirve la versión obsoleta inmediatamente al usuario mientras descarga en segundo plano la nueva versión.
- `no-cache`: Fuerza al cliente a validar con el servidor (`ETag`) antes de usar la copia en caché (no significa "no almacenar", sino "revalidar siempre").
- `no-store`: Prohíbe terminantemente almacenar la respuesta en cualquier disco o memoria (imprescindible para datos bancarios o médicos).

### B. Validación Condicional con `ETag` y Respuestas 304:
1. El servidor calcula un hash criptográfico o numérico del recurso:
   ```http
   HTTP/1.1 200 OK
   ETag: "68ab8-12345"
   Cache-Control: public, no-cache
   ```
2. Cuando el cliente vuelve a pedir el recurso, envía:
   ```http
   GET /api/v1/products HTTP/1.1
   If-None-Match: "68ab8-12345"
   ```
3. Si el hash coincide, el servidor **no envía el cuerpo JSON** (0 bytes de body transferidos), respondiendo de inmediato con:
   ```http
   HTTP/1.1 304 Not Modified
   ```

### C. Concurrencia Optimista con `If-Match` (Evitar Lost Updates):
Para evitar que dos usuarios sobreescriban simultáneamente el mismo recurso:
1. El cliente obtiene el usuario con `ETag: "v1"`.
2. Para modificarlo envía: `PUT /users/123` con cabecera `If-Match: "v1"`.
3. Si otro usuario ya lo modificó (la versión actual es "v2"), el servidor rechaza la petición con **`412 Precondition Failed`**, impidiendo sobreescrituras silenciosas.

---

## 📄 2. Paginación: El Desastre de `OFFSET` vs Paginación por `CURSOR`

### El Antipatrón de `OFFSET / LIMIT`:
```sql
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 20 OFFSET 1000000;
```
- **El Coste O(N)**: El motor de base de datos (PostgreSQL / MySQL) debe **escanear físicamente 1,000,020 filas** del índice o disco, descartar el primer millón en memoria, y retornar las últimas 20.
- **Anomalía de Saltos y Duplicados**: Si mientras un usuario pasa de página se inserta un nuevo registro, todos los elementos se desplazan una posición. El usuario verá un registro repetido o se saltará un registro sin saberlo.

### La Solución Senior: Paginación por Cursor (Keyset Pagination):
Utiliza un índice compuesto ordenado `(created_at, id)`:
```sql
SELECT * FROM transactions
WHERE (created_at, id) < (:cursor_created_at, :cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```
- **Rendimiento O(1)**: El motor realiza un *Index Seek* directo mediante el árbol B-Tree saltando directamente a la posición exacta, sin importar si estás en la página 1 o en la página 500,000.
- **Cursor Opaco en Base64**: El cliente recibe un token codificado que no expone la estructura interna de la base de datos:
  ```json
  {
    "data": [...],
    "pagination": {
      "next_cursor": "ZXlKamRHOXJaVzVoZEdFaU9qRXdNREV3TnpJeU1RPT0="
    }
  }
  ```

---

## 🌊 3. Streaming de Grandes Volúmenes: NDJSON

Cuando un endpoint debe exportar 100,000 registros:
- **Enfoque Junior**: Consultar todas las filas a memoria, crear un array JSON gigante de 80MB con `JSON.stringify()`, y enviarlo todo junto. Causa bloqueos del Event Loop y picos de memoria RAM.
- **Enfoque Senior**: Usar un Readable Stream de base de datos y transferirlo línea a línea con **NDJSON (Newline Delimited JSON)** o `Transfer-Encoding: chunked`:
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/x-ndjson
  Transfer-Encoding: chunked

  {"id": 1, "name": "Item 1"}\n
  {"id": 2, "name": "Item 2"}\n
  {"id": 3, "name": "Item 3"}\n
  ```
  La memoria del servidor se mantiene en unos pocos kilobytes constantes con cero buffering.
