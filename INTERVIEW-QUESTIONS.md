# 🌐 Backend & Distributed Systems Architecture Mastery: Las 100 Preguntas Más Comunes en Entrevistas Técnicas

Guía de referencia técnica profunda para preparación de entrevistas en roles de **Senior Backend Engineer, Distributed Systems Engineer, Staff Software Engineer y Software Architect**.

---

## 📑 Tabla de Contenidos

1. [Diseño de APIs RESTful, RFCs Oficiales y Protocolos (Preguntas 1-12)](#1-diseño-de-apis-restful-rfcs-oficiales-y-protocolos)
2. [Persistencia Relacional (SQL & PostgreSQL Internals) (Preguntas 13-25)](#2-persistencia-relacional-sql--postgresql-internals)
3. [Almacenamiento NoSQL, Modelos de Datos y Caching (Preguntas 26-37)](#3-almacenamiento-nosql-modelos-de-datos-y-caching)
4. [Sistemas Distribuidos, Consistencia y Patrones Enterprise (Preguntas 38-50)](#4-sistemas-distribuidos-consistencia-y-patrones-enterprise)
5. [Persistencia Relacional Avanzada, Sharding y Optimización SQL (Preguntas 51-60)](#5-persistencia-relacional-avanzada-sharding-y-optimización-sql)
6. [Sistemas NoSQL, Modelos Distribuidos y Consistencia (Preguntas 61-70)](#6-sistemas-nosql-modelos-distribuidos-y-consistencia)
7. [Arquitectura de Mensajería, Brokers y Event-Driven Streaming (Preguntas 71-80)](#7-arquitectura-de-mensajería-brokers-y-event-driven-streaming)
8. [Patrones de Resiliencia, Concurrencia y Gobernanza (Preguntas 81-90)](#8-patrones-de-resiliencia-concurrencia-y-gobernanza)
9. [Seguridad de APIs, Protocolos y Estándares Empresariales (Preguntas 91-100)](#9-seguridad-de-apis-protocolos-y-estándares-empresariales)

---

## 1. Diseño de APIs REST y Estándares RFC

### 1. ¿Cuál es la diferencia formal entre un método HTTP Seguro (Safe) y un método Idempotente según el RFC 9110?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  Según el **RFC 9110 (HTTP Semantics)**:
  - **Safe (Seguro)**: El método no altera el estado del servidor ni causa efectos secundarios observables en el recurso solicitado. Solo lectura. Métodos: `GET`, `HEAD`, `OPTIONS`. (Todo método seguro es automáticamente idempotente).
  - **Idempotent (Idempotente)**: La ejecución repetida de $N$ peticiones idénticas produce exactamente el mismo efecto secundario en el estado del servidor que una única ejecución ($f(f(x)) = f(x)$). Métodos: `GET`, `HEAD`, `PUT`, `DELETE`, `OPTIONS`.
  - **No Idempotente**: `POST` (cada llamada crea un nuevo recurso o muta el estado de forma acumulativa) y `PATCH` (cuando usa transformaciones relativas, ej. JSON Patch con operaciones como `add` a un array).
- **Ejemplo**:
  ```http
  # Idempotente: Establece el correo exactamente a ese valor
  PUT /api/v1/users/42 HTTP/1.1
  {"email": "alex@corp.com"}

  # No idempotente: Incrementa el contador cada vez que se llama
  POST /api/v1/users/42/increment-logins HTTP/1.1
  ```
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Creer que `DELETE` no es idempotente porque la segunda llamada puede retornar un código HTTP `404 Not Found`.
  - 🟢 **Green Flag**: Aclarar que la idempotencia se refiere al **estado resultante del servidor** (el recurso sigue eliminado) y no necesariamente al código de estado de la respuesta.

---

### 2. ¿Cómo se diseña un motor de Idempotencia para peticiones POST (ej. pagos) usando la cabecera `Idempotency-Key` (IETF Draft 9608)?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Un motor de idempotencia robusto requiere almacenamiento atómico y distribuido (ej. Redis o tabla SQL dedicada con lock):
  1. El cliente envía `Idempotency-Key: <UUIDv4>` y el payload con un hash SHA-256 del cuerpo.
  2. El servidor intenta adquirir un lock atómico en Redis (`SET idempotency:<key> PENDING NX EX 120`).
     - **Si la clave ya existe y está en estado `RESOLVED`**: Retorna inmediatamente la respuesta HTTP serializada original almacenada en caché sin volver a ejecutar la lógica de cobro.
     - **Si la clave existe y está en estado `PENDING`**: Significa que otra petición concurrente idéntica está en vuelo. Debe retornar `HTTP 409 Conflict` o `HTTP 425 Too Early`.
     - **Si el lock se adquiere exitosamente**: Se procesa la transacción de negocio, se almacena el resultado final (`RESOLVED`) con su código HTTP y body en Redis con un TTL (ej. 24-48 horas), y se responde al cliente.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Proponer solo guardar el ID sin verificar si el body de la petición cambió (riesgo de reutilizar la clave para pagos distintos).
  - 🟢 **Green Flag**: Detallar la validación del hash del payload (`Payload Fingerprinting`) y el manejo de concurrencia con estados `PENDING` vs `RESOLVED`.

---

### 3. ¿Por qué el estándar RFC 7807 / RFC 9457 (Problem Details for HTTP APIs) reemplaza a los payloads de error caseros (`{ error: "message" }`)?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  En APIs enterprise, los formatos caseros crean acoplamiento e inconsistencia. El **RFC 7807** (actualizado por **RFC 9457**) establece un contrato unificado estándar bajo el MIME type `application/problem+json`:
  - `type` (URI): Identificador canónico del tipo de error con documentación de soporte.
  - `title` (string): Resumen breve y legible para humanos del tipo de problema (no varía entre ocurrencias).
  - `status` (number): Código de estado HTTP coincidente con la cabecera.
  - `detail` (string): Explicación legible y contextual de esta ocurrencia específica.
  - `instance` (URI): Identificador del recurso o URI que originó el problema.
  - Extensiones personalizadas: `invalidParams`, `traceId`, etc.
- **Ejemplo**:
  ```json
  {
    "type": "https://api.empresa.com/errors/insufficient-funds",
    "title": "Saldo Insuficiente",
    "status": 403,
    "detail": "La cuenta 10928 tiene un saldo disponible de 12.50 USD y la transacción requiere 50.00 USD.",
    "instance": "/v1/accounts/10928/transfers",
    "traceId": "c4b3a1d9-7e28-4f81-9653-37b01d3a19b8"
  }
  ```
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Retornar siempre `HTTP 200` con `{ success: false, error: "..." }`.
  - 🟢 **Green Flag**: Citar la cabecera `Content-Type: application/problem+json` y el uso de `traceId` enlazado a OpenTelemetry.

---

### 4. ¿Por qué la paginación por `OFFSET` es un antipatrón catastrófico en Big Data y cómo la Paginación por Cursor Keyset logra $O(1)$?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  - **Antipatrón OFFSET ($O(N)$)**: En una consulta `SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 1000000;`, el motor de base de datos debe escanear, ordenar en memoria y descartar **1,000,000 de filas** antes de retornar las 20 deseadas. A medida que la página crece, el tiempo de respuesta y el I/O en disco crecen linealmente hasta degradar el servidor. Además, si se insertan nuevas filas mientras el usuario navega, se producen duplicados o saltos de registros (*Data Drift*).
  - **Cursor Keyset Pagination ($O(1)$)**: Utiliza un cursor codificado (típicamente Base64 del último valor ordenado, ej. `(created_at, id)`). La consulta se traduce en una búsqueda directa por índice:
    ```sql
    SELECT id, created_at, total 
    FROM orders 
    WHERE (created_at, id) < ($last_created_at, $last_id) 
    ORDER BY created_at DESC, id DESC 
    LIMIT 20;
    ```
    El motor navega el árbol B-Tree en tiempo logarítmico directo al punto exacto, sin importar si estamos en la fila 20 o en la fila 10,000,000.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Afirmar que `OFFSET` es adecuado siempre que la tabla tenga un índice simple en la clave primaria.
  - 🟢 **Green Flag**: Explicar la tupla compuesta `(created_at, id)` para desempatar marcas de tiempo idénticas (Tie-breaking determinista).

---

### 5. ¿Cuáles son los 4 niveles del Modelo de Madurez de Richardson para APIs REST?
- **Nivel**: Junior / Mid-Level
- **Respuesta Técnica**:
  1. **Nivel 0 (The Swamp of POX)**: Un solo endpoint y un solo método (típicamente `POST /api` pasando el nombre de la acción en el XML/JSON; arquitectura RPC / SOAP).
  2. **Nivel 1 (Recursos)**: Múltiples URIs que representan recursos (`/users`, `/orders`), pero aún usan un único método HTTP como `POST` para todo.
  3. **Nivel 2 (Verbos HTTP y Códigos de Estado)**: Uso correcto de la semántica HTTP (`GET` para leer, `POST` para crear con `201 Created`, `DELETE` con `204 No Content`, `PUT`/`PATCH` para actualizar, y códigos `4xx`/`5xx`).
  4. **Nivel 3 (Controles Hipermedia / HATEOAS)**: La respuesta contiene hiperenlaces (`_links`) que informan al cliente qué transiciones de estado son válidas a continuación de forma dinámica.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Decir que una API con solo URLs bonitas es una API "REST pura".
  - 🟢 **Green Flag**: Analizar los pros y contras reales de HATEOAS en el mundo moderno (alto sobrecoste de payload vs desacoplamiento dinámico de navegación).

---

### 6. ¿Cómo se implementa un Rate Limiting de Ventana Deslizante (Sliding Window Counter) con Redis y qué cabeceras estándar deben emitirse?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  El algoritmo de ventana deslizante combina la precisión de una ventana de tiempo real con el bajo consumo de memoria de Redis Sorted Sets (`ZSET`):
  1. Clave en Redis: `ratelimit:<user_id>`.
  2. Cada petición ejecuta una transacción multi-ejecución (`MULTI` / `EXEC` o script Lua atómico):
     - `ZREMRANGEBYSCORE key 0 (now - window_size)` ➔ Elimina marcas de tiempo fuera de la ventana actual.
     - `ZCARD key` ➔ Cuenta cuántas peticiones existen dentro de la ventana.
     - Si `count < limit`:
       - `ZADD key now uuid` ➔ Agrega la petición actual.
       - `EXPIRE key window_size` ➔ Renueva TTL.
     - Si `count >= limit`:
       - Retorna error `HTTP 429 Too Many Requests`.
  3. Cabeceras IETF (Draft RFC):
     - `RateLimit-Limit: 100`
     - `RateLimit-Remaining: 0`
     - `RateLimit-Reset: 12` (segundos restantes para el reset)
     - `Retry-After: 12`
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Proponer Fixed Window con `INCR` simple (vulnerable a ráfagas de tráfico 2x en los límites de la ventana).
  - 🟢 **Green Flag**: Utilizar un script Lua para ejecutar los comandos en Redis de forma atómica y sin roundtrips de red intermedios.

---

### 7. ¿Cuál es la diferencia estricta entre `PUT` y `PATCH` según los RFCs?
- **Nivel**: Junior / Mid-Level
- **Respuesta Técnica**:
  - **`PUT` (RFC 9110, sección 9.3.4)**: Reemplazo completo del recurso objetivo. El payload enviado es una representación sustituta completa. Cualquier campo no incluido en el payload debe interpretarse como eliminado o restablecido a su valor por defecto.
  - **`PATCH` (RFC 5789)**: Modificación parcial. El payload describe un conjunto de instrucciones de cambio o un subconjunto de propiedades a aplicar sobre el recurso existente sin tocar los campos omitidos.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Usar `PUT` enviando únicamente `{ "status": "active" }` y esperar que el resto de atributos del usuario permanezcan intactos.
  - 🟢 **Green Flag**: Mencionar estándares formales de parcheado como **JSON Patch (RFC 6902)** y **JSON Merge Patch (RFC 7396)**.

---

### 8. ¿Qué cabeceras HTTP gobiernan la negociación de contenido y el almacenamiento en caché condicional?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  - **Negociación de Contenido**: `Accept`, `Accept-Encoding`, `Accept-Language`.
  - **Caché Condicional y Validación**:
    - `ETag` (identificador único del estado de la representación) y `Last-Modified`.
    - Petición del cliente: `If-None-Match: "e3b0c442"` o `If-Modified-Since`.
    - Si el contenido no ha cambiado, el backend responde **`304 Not Modified`** con payload vacío, ahorrando ancho de banda e I/O de red.
  - **Directivas de Caché**: `Cache-Control: public, max-age=3600, stale-while-revalidate=60`.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: No conocer el código `304 Not Modified` ni el concepto de Weak vs Strong ETags.
  - 🟢 **Green Flag**: Explicar la directiva `stale-while-revalidate` para servir contenido instantáneo mientras el backend se refresca asíncronamente.

---

### 9. ¿Cómo se mitiga el problema de la Concurrencia Perdida (Lost Update Problem) en APIs REST mediante ETags?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Ocurre cuando el Usuario A y el Usuario B leen el mismo recurso simultáneamente y ambos envían un `PUT` o `PATCH` con modificaciones diferentes; la última actualización sobrescribe silenciosamente la primera.
  **Mitigación con Optimistic Locking HTTP**:
  1. En la lectura (`GET /resource/1`), el backend emite una cabecera `ETag: "version-1"`.
  2. Al actualizar (`PUT /resource/1`), el cliente está obligado a enviar la cabecera condicional: `If-Match: "version-1"`.
  3. Si otro usuario ya modificó el recurso, el ETag actual en el servidor será `"version-2"`.
  4. El servidor detecta la discrepancia y aborta inmediatamente respondiendo con **`HTTP 412 Precondition Failed`**, forzando al cliente a recargar los datos actualizados antes de reintentar.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Recomendar bloquear la base de datos con locks pesados de lectura durante minutos mientras el usuario llena un formulario en frontend.
  - 🟢 **Green Flag**: Utilizar `If-Match` y HTTP 412 como el estándar web nativo para control de concurrencia optimista.

---

### 10. ¿Por qué exponer IDs secuenciales auto-incrementales en endpoints públicos es una vulnerabilidad crítica de seguridad y qué alternativas existen?
- **Nivel**: Junior / Mid-Level
- **Respuesta Técnica**:
  Exponer `/api/orders/1054` permite ataques de **Insecure Direct Object Reference (IDOR)** y enumeración competitiva:
  - Un competidor puede calcular el volumen de ventas diario de la empresa restando los IDs generados.
  - Facilita el scrapeo automático mediante bucles iterativos simples.
  **Alternativas de nivel enterprise**:
  1. **UUIDv7**: Mantiene ordenamiento temporal cronológico (útil para índices B-Tree de BD sin fragmentación) y garantiza aleatoriedad y colisiones despreciables.
  2. **ULID**: Universally Unique Lexicographically Sortable Identifier (128 bits, codificado en Crockford Base32).
  3. **NanoID / Sqids / Hashids**: Obfuscación determinista de IDs internos para la capa externa de presentación.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Recomendar UUIDv4 ciegamente como clave primaria en tablas de PostgreSQL/MySQL de millones de registros sin advertir sobre la degradación de índices B-Tree por inserciones aleatorias.
  - 🟢 **Green Flag**: Comparar UUIDv4 vs UUIDv7/ULID destacando la localidad temporal para el rendimiento de índices en disco.

---

### 11. ¿Cuándo se debe utilizar gRPC / Protocol Buffers frente a REST / JSON en la arquitectura backend?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  - **REST / JSON**: Ideal para comunicación externa (Front-to-Back, consumo de APIs por terceros). Es humanamente legible, fácilmente cacheable en CDNs y universalmente compatible con cualquier cliente web o móvil.
  - **gRPC (HTTP/2 + Protobuf)**: Ideal para comunicación interna entre **microservicios (East-West traffic)**.
    - Serialización binaria extremadamente compacta (hasta 5-10x más rápida que JSON).
    - Multiplexación de peticiones sobre una única conexión TCP continua.
    - Soporte nativo para Streaming bidireccional, cliente-servidor y Server-Sent.
    - Contratos fuertemente tipados autogenerados mediante archivos `.proto`.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Proponer gRPC directamente para navegadores web públicos sin considerar proxies intermedios (gRPC-Web) o depuración.
  - 🟢 **Green Flag**: Argumentar con análisis de throughput de CPU y ancho de banda en infraestructuras de microservicios masivas.

---

### 12. ¿Cómo se diseña una estrategia de Versionado de APIs compatible con Backward Compatibility?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  Estrategias de versionado:
  1. **URI Path** (`/api/v1/users`): La más común y amigable con CDNs y balanceadores de carga.
  2. **Custom Header** (`X-API-Version: 2`): Mantiene URLs limpias pero complica el almacenamiento en caché de intermediaries.
  3. **Content Negotiation / Accept Header** (`Accept: application/vnd.empresa.v2+json`): Es el estándar purista de REST.
  **Regla de Oro de Compatibilidad Hacia Atrás**:
  - Un cambio mayor de versión (`v2`) solo debe introducirse cuando hay un **Breaking Change** (renombrar/eliminar campos, cambiar tipos de datos o lógica de negocio incompatible).
  - Agregar campos nuevos no obligatorios a una respuesta JSON **NUNCA** debe requerir un cambio de versión mayor (Principio de Tolerancia de Postel: *"Sé conservador en lo que envías y liberal en lo que aceptas"*).
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Crear una versión `v2` de la API cada vez que se agrega una propiedad nueva a una tabla.
  - 🟢 **Green Flag**: Usar técnicas de deprecación formal mediante cabeceras estándar `Deprecation: @1735689600` y `Sunset: Wed, 31 Dec 2025 23:59:59 GMT`.

---

### 13. ¿Qué es Server-Sent Events (SSE) y en qué escenarios supera a WebSockets para comunicación en tiempo real?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  - **SSE (RFC 8895)**: Protocolo unidireccional (Server-to-Client) sobre HTTP estándar (`Content-Type: text/event-stream`). Cuenta con reconexión automática nativa en el navegador, soporte transparente para HTTP/2 multiplexado y paso sin problemas por proxies corporativos y firewalls.
  - **WebSockets**: Protocolo bidireccional full-duplex sobre TCP independiente (iniciado mediante un HTTP Upgrade). Requiere infraestructura específica de balanceo de carga y control manual de reconexiones (heartbeats/ping-pong).
  - **Cuándo SSE es superior**: Notificaciones de estado, streaming de respuestas de modelos de Inteligencia Artificial (LLMs), dashboards en tiempo real y cotizaciones de bolsa (donde el cliente solo escucha y el servidor emite).
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Usar WebSockets para una simple pantalla de notificaciones donde el cliente nunca envía datos al servidor.
  - 🟢 **Green Flag**: Destacar la compatibilidad nativa de SSE con HTTP/2 y la gestión automática del campo `Last-Event-ID` para recuperación tras desconexión.

---

## 2. Bases de Datos Relacionales (SQL, Concurrencia y MVCC)

### 14. ¿Qué es exactamente MVCC (Multi-Version Concurrency Control) en PostgreSQL y cómo gestiona las tuplas con `xmin` y `xmax`?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  MVCC permite que las lecturas no bloqueen las escrituras y las escrituras no bloqueen las lecturas. Cada fila en el disco almacena metadatos de visibilidad:
  - `xmin`: El ID de la transacción (`txid`) que insertó la tupla.
  - `xmax`: El ID de la transacción que la actualizó o eliminó (0 si la fila sigue viva).
  Cuando se ejecuta un `UPDATE`, PostgreSQL **no sobrescribe los bytes en disco**: inserta una copia nueva de la fila con su propio `xmin` nuevo y marca el `xmax` de la fila anterior con el ID de la transacción actual.
  Una transacción determina si puede "ver" una tupla consultando su **Snapshot de Transacción**, que contiene el estado de las transacciones activas en ese milisegundo. Las tuplas viejas (*Dead Tuples*) permanecen en disco hasta que el proceso en segundo plano **VACUUM** las recolecta y libera el espacio.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Creer que un `UPDATE` en SQL simplemente hace un cambio in-place en los bloques de disco.
  - 🟢 **Green Flag**: Advertir sobre el fenómeno de *Table Bloat* cuando transacciones de larga duración impiden que `VACUUM` limpie tuplas muertas.

---

### 15. ¿Cuáles son las 4 anomalías de aislamiento de transacciones según el estándar SQL y la anomalía extra descubierta en investigación moderna?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Las 4 anomalías tradicionales (ANSI SQL-92):
  1. **Dirty Read (Lectura Sucia)**: Transacción 1 lee cambios hechos por Transacción 2 que aún no han hecho `COMMIT` y que luego hacen `ROLLBACK`.
  2. **Non-repeatable Read (Lectura No Repetible)**: Transacción 1 lee una fila; Transacción 2 modifica o elimina esa fila y hace `COMMIT`; Transacción 1 vuelve a leerla y encuentra datos diferentes.
  3. **Phantom Read (Lectura Fantasma)**: Transacción 1 ejecuta una consulta por rango (`WHERE age > 30`); Transacción 2 inserta una nueva fila que coincide con el rango y hace `COMMIT`; Transacción 1 vuelve a ejecutar la consulta y ve aparecer filas "fantasma".
  4. **Write Skew (Sesgo de Escritura - Berenson et al. 1995)**: Dos transacciones concurrentes leen datos solapados, evalúan una regla de negocio y actualizan conjuntos disjuntos de filas de forma que la invariante global se rompe (ej. médicos de guardia: cada médico ve que hay 2 doctores activos y ambos deciden darse de baja simultáneamente en transacciones separadas). Ocurre en aislamiento **Repeatable Read** y solo se resuelve en **Serializable**.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Desconocer Write Skew o creer que Repeatable Read previene cualquier error de concurrencia.
  - 🟢 **Green Flag**: Detallar el caso de los médicos de guardia o saldos combinados y explicar por qué Serializable o locks explícitos son requeridos.

---

### 16. ¿Cómo funciona la instrucción `SELECT ... FOR UPDATE SKIP LOCKED` y por qué es el estándar de oro para colas de trabajo concurrentes en SQL?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Al construir una cola distribuida en una tabla relacional (`tasks`), si 100 workers concurrentes ejecutan `SELECT id FROM tasks WHERE status = 'PENDING' LIMIT 1 FOR UPDATE;`:
  - **Sin SKIP LOCKED**: Todos los workers compiten por la misma fila bloqueada; 1 la toma y los otros 99 quedan suspendidos esperando que libere el lock (*Thundering Herd & Lock Contention*).
  - **Con `SKIP LOCKED`**:
    ```sql
    BEGIN;
    SELECT id, payload 
    FROM tasks 
    WHERE status = 'PENDING' 
    ORDER BY created_at ASC 
    LIMIT 1 
    FOR UPDATE SKIP LOCKED;
    
    -- El worker procesa la tarea aquí...
    UPDATE tasks SET status = 'COMPLETED' WHERE id = $id;
    COMMIT;
    ```
    PostgreSQL ignora silenciosamente cualquier fila que ya esté bloqueada por otra transacción y toma la primera fila libre disponible. Logra una concurrencia masiva perfecta sin contención entre workers.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Proponer un polling ingenuo con `UPDATE tasks SET status = 'PROCESSING'` que genera race conditions.
  - 🟢 **Green Flag**: Destacar que `SKIP LOCKED` elimina la necesidad de introducir brokers de mensajería externos (RabbitMQ/Kafka) para cargas de trabajo moderadas.

---

### 17. ¿Cómo se calcula la fórmula matemática recomendada para dimensionar el Pool de Conexiones a una Base de Datos (HikariCP Formula)?
- **Nivel**: Senior / Staff / Tech Lead
- **Respuesta Técnica**:
  Fórmula empírica investigada por los ingenieros de rendimiento de PostgreSQL y el equipo de HikariCP:
  $$\text{Pool Size} = (2 \times \text{CPU Cores}) + \text{Effective Spindle Count (Discos)}$$
  Ejemplo: Un servidor de BD de 8 núcleos de CPU con 1 disco NVMe requiere aproximadamente:
  $$\text{Pool Size} = (2 \times 8) + 1 = 17 \text{ conexiones}$$
  **Por qué más conexiones degradan el rendimiento**:
  Cada conexión abierta consume memoria dedicada y compite por el planificador del sistema operativo. Cuando tienes 1,000 conexiones concurrentes en una máquina de 8 cores, el CPU pasa la mayor parte del tiempo ejecutando cambios de contexto (*Context Switching*) y contención de cerrojos de memoria en lugar de ejecutar consultas SQL. Un pool pequeño mantiene la CPU operando al 100% de eficiencia de cómputo en sus registros.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: "Para atender 10,000 usuarios en mi app, configuré el pool de PostgreSQL en 10,000 conexiones".
  - 🟢 **Green Flag**: Proponer un connection pooler intermedio como **PgBouncer** para multiplexar miles de clientes sobre unas pocas conexiones físicas a la base de datos.

---

### 18. ¿Cuál es la diferencia entre un índice B-Tree, un índice Hash y un índice GIN (Generalized Inverted Index) en PostgreSQL?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  - **B-Tree**: El índice por defecto. Estructura balanceada auto-equilibrada. Soporta búsquedas exactas (`=`) y por rango (`<`, `>`, `BETWEEN`, `ORDER BY`). Complejidad $O(\log N)$.
  - **Hash**: Solo optimizado para comparaciones de igualdad exacta (`=`). No soporta consultas de rango ni ordenamiento. Ocupa menos espacio pero su caso de uso es muy acotado.
  - **GIN (Generalized Inverted Index)**: Diseñado para valores compuestos o multipropiedad donde un elemento contiene múltiples subclaves internas: documentos **JSONB**, vectores de búsqueda de texto completo (**Full-Text Search / tsvector**) y arrays. Mapea cada subelemento o clave interna hacia las filas que lo contienen.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Intentar crear un índice B-Tree sobre un campo JSONB esperando acelerar búsquedas de atributos anidados arbitrarios.
  - 🟢 **Green Flag**: Explicar la diferencia entre `jsonb_ops` (índice GIN completo) y `jsonb_path_ops` (índice GIN mucho más pequeño optimizado para el operador `@>`).

---

### 19. ¿Por qué el orden de las columnas en un Índice Compuesto (Composite Index) es de vida o muerte para el Optimizador de Consultas?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  Los índices compuestos B-Tree se ordenan jerárquicamente siguiendo la **Regla del Prefijo Más a la Izquierda (Leftmost Prefix Rule)**.
  Si creas un índice en `(country, status, created_at)`:
  - ✅ `WHERE country = 'ES'` ➔ Usa el índice eficientemente.
  - ✅ `WHERE country = 'ES' AND status = 'ACTIVE'` ➔ Usa el índice eficientemente.
  - ✅ `WHERE country = 'ES' AND status = 'ACTIVE' AND created_at > '2025-01-01'` ➔ Usa el índice eficientemente.
  - ❌ `WHERE status = 'ACTIVE'` ➔ **NO puede usar el índice** (o requerirá un Full Index Scan ineficiente) porque la primera columna no está presente.
  - ❌ `WHERE created_at > '2025-01-01'` ➔ **NO puede usar el índice**.
  **Regla de diseño**: Ubicar primero las columnas con mayor cardinalidad / selectividad que se consultan por igualdad estricta, y dejar al final las columnas consultadas por rango (`<`, `>`).
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Pensar que un índice compuesto en `(A, B)` funciona idéntico a un índice en `(B, A)`.
  - 🟢 **Green Flag**: Analizar el orden de las columnas basándose en el análisis de selectividad y el plan de ejecución `EXPLAIN ANALYZE`.

---

### 20. ¿Qué es un Deadlock en base de datos y cuáles son las estrategias de prevención arquitectónica?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  Un Deadlock (abrazo mortal) ocurre cuando la Transacción A bloquea la Fila 1 y espera la Fila 2, mientras la Transacción B bloquea la Fila 2 y espera la Fila 1. Ninguna puede continuar.
  **Estrategias de Prevención**:
  1. **Orden de Adquisición Determinista**: Garantizar que todas las transacciones del sistema siempre adquieran los locks de las entidades en el mismo orden global (ej. ordenar los IDs de los registros antes de bloquear: `SELECT ... WHERE id IN (1, 2) ORDER BY id FOR UPDATE`).
  2. **Acortar la duración de las transacciones**: Mantener las transacciones lo más pequeñas posible y nunca realizar llamadas de red externas (APIs de terceros, correos) dentro de un bloque de transacción SQL.
  3. **Uso de Niveles de Aislamiento Optimistas** con políticas de reintento automático y backoff exponencial cuando el motor de BD aborta una de las dos transacciones.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Realizar llamadas HTTP a Stripe o AWS S3 dentro de un `BEGIN ... COMMIT` de base de datos.
  - 🟢 **Green Flag**: Implementar ordenamiento de IDs previo al lock y mecanismos de reintento deterministas con detección de código de error PostgreSQL `40P01` (deadlock_detected).

---

### 21. ¿Qué es y cómo funciona el Write-Ahead Logging (WAL) en bases de datos relacionales?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  El WAL es el mecanismo que garantiza la **Durabilidad (la 'D' de ACID)** de forma eficiente:
  - Escribir cambios directamente en los archivos de datos relacionales dispersos en disco (Data Pages) requiere I/O aleatorio sumamente lento.
  - Con el WAL, antes de mutar cualquier página de datos en memoria (Buffer Pool), el motor escribe de forma secuencial y apéndice (*Append-Only*) el registro de la transacción en el archivo WAL en disco mediante un `fsync()`.
  - El I/O secuencial es órdenes de magnitud más rápido. Si el servidor se apaga repentinamente por fallo eléctrico, al reiniciar lee el log de WAL desde el último Checkpoint y reproduce los cambios (*Crash Recovery / Redo Log*), garantizando que ningún dato comprometido se pierda.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Creer que cada `COMMIT` reescribe inmediatamente toda la tabla de base de datos en disco.
  - 🟢 **Green Flag**: Conectar el WAL con la replicación física de réplicas de lectura (Streaming Replication) y Change Data Capture (CDC).

---

### 22. ¿Cuál es el problema de las Consultas N+1 en ORMs y cómo se mitiga técnicamente?
- **Nivel**: Junior / Mid-Level
- **Respuesta Técnica**:
  Ocurre cuando el código ejecuta 1 consulta para obtener una lista de $N$ registros padre, y luego ejecuta $N$ consultas individuales secundarias en un bucle para obtener los registros hijos relacionados:
  ```typescript
  // 1 consulta para traer 100 usuarios
  const users = await userRepository.findAll(); 
  for (const user of users) {
    // 100 consultas adicionales para traer los pedidos de cada uno (1 + 100 = 101 consultas!)
    const orders = await orderRepository.findByUserId(user.id);
  }
  ```
  **Mitigaciones**:
  1. **Eager Loading con JOIN**: Ejecutar un único `SELECT ... LEFT JOIN orders ON orders.user_id = users.id`.
  2. **Batch Fetching / DataLoaders**: Agrupar los IDs y lanzar una segunda consulta masiva: `SELECT * FROM orders WHERE user_id IN (1, 2, ..., 100)`.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: No darse cuenta de que acceder a una propiedad de relación lazy dentro de un template o loop lanza una consulta SQL oculta por cada iteración.
  - 🟢 **Green Flag**: Explicar el patrón DataLoader de Facebook para batching y caching en arquitecturas GraphQL o REST.

---

### 23. ¿Qué es un Advisory Lock en PostgreSQL y en qué casos es superior a crear una tabla de cerrojos en base de datos?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Un Advisory Lock es un cerrojo de aplicación gestionado por PostgreSQL en su tabla interna de memoria de locks, sin necesidad de bloquear ninguna fila ni escribir en ninguna tabla del disco.
  - Se adquiere llamando: `SELECT pg_advisory_lock(12345);` o a nivel de transacción: `SELECT pg_try_advisory_xact_lock(12345);`.
  - **Ventajas**: Cero I/O en disco, cero tuplas muertas que limpiar con VACUUM, liberación automática si se cae la conexión TCP y rendimiento extremadamente alto.
  - **Casos de uso**: Tareas programadas distribuidas (Cron Jobs ejecutándose en múltiples pods donde solo uno debe ejecutar la tarea a las 12:00 AM), o migraciones de base de datos concurrentes.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Crear tablas como `cron_locks` con inserts y deletes continuos para sincronizar procesos de backend.
  - 🟢 **Green Flag**: Utilizar `pg_try_advisory_xact_lock` no bloqueante que retorna `false` inmediatamente si otro proceso ya está ejecutando la tarea.

---

### 24. ¿Qué es el fenómeno de "Table Bloat" y por qué `VACUUM FULL` puede ser peligroso en un entorno de producción?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Debido al modelo MVCC de PostgreSQL, las filas actualizadas o eliminadas dejan *Dead Tuples*. Si el proceso de autovacuum no es lo suficientemente agresivo o transacciones largas impiden su limpieza, las páginas de disco quedan llenas de espacio vacío y tuplas muertas (**Table Bloat**), disparando los tiempos de lectura.
  - `VACUUM` (ordinario): Reclama el espacio interno de las páginas para que nuevas tuplas puedan reutilizarlo, pero **no devuelve el espacio libre al sistema operativo** ni reordena el archivo físico. No bloquea lecturas ni escrituras.
  - `VACUUM FULL`: Reescribe la tabla completa en un nuevo archivo de disco contiguo y devuelve el espacio al sistema operativo. **Peligro**: Adquiere un lock exclusivo absoluto (**`ACCESS EXCLUSIVE LOCK`**) sobre toda la tabla, bloqueando completamente todas las lecturas y escrituras hasta que termine (lo que en tablas de cientos de gigabytes puede tardar horas e interrumpir el servicio).
  - **Alternativa segura en producción**: Utilizar herramientas como **`pg_repack`**.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Ejecutar `VACUUM FULL` en tablas de producción críticas en mitad del día laboral.
  - 🟢 **Green Flag**: Mencionar la optimización de los parámetros de `autovacuum_vacuum_scale_factor` y el uso de `pg_repack` para recompactar sin bloqueos.

---

### 25. ¿Qué significa "Partitioning" en bases de datos relacionales y cómo se diferencia el particionado declarativo de PostgreSQL del "Sharding"?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  - **Table Partitioning (Particionado Vertical/Horizontal en un solo nodo)**: Divide una tabla lógica masiva (ej. `audit_logs` con 500M de registros) en tablas físicas hijas más pequeñas (ej. una partición por mes: `audit_logs_2025_01`, `audit_logs_2025_02`) dentro de la misma instancia de base de datos. El motor utiliza **Partition Pruning**: si una consulta filtra por `WHERE date >= '2025-01-01' AND date < '2025-02-01'`, el motor escanea únicamente la partición de ese mes e ignora el 95% restante del disco.
  - **Sharding (Particionado Horizontal Distribuido)**: Los datos se dividen y se almacenan en **múltiples servidores físicos o clusters independientes** mediante una clave de sharding (*Shard Key*). Requiere routers de aplicación o capas distribuidas (Citus, Vitess) para coordinar consultas cross-shard.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Confundir particionado local de tablas con sharding entre múltiples instancias de servidores.
  - 🟢 **Green Flag**: Analizar el Partition Pruning y la eliminación instantánea de datos viejos mediante `DROP TABLE partition_2024_01` en lugar del costoso `DELETE FROM ...`.

---

### 26. ¿Cómo optimizar una consulta lenta utilizando `EXPLAIN (ANALYZE, BUFFERS)`?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  - `EXPLAIN` simple solo muestra la estimación matemática que el planificador de consultas calculó a partir de las estadísticas (*cost*, *rows* proyectadas).
  - `EXPLAIN (ANALYZE, BUFFERS)` **ejecuta la consulta realmente en la base de datos** y reporta:
    - **Execution Time**: Tiempo real medido en milisegundos.
    - **Actual Rows vs Estimated Rows**: Si hay una discrepancia enorme (ej. estimó 10 filas pero devolvió 1,000,000), las estadísticas de la tabla están desactualizadas (se requiere `ANALYZE`).
    - **Buffers**: Muestra las páginas leídas desde memoria caché (**Shared Hit**) versus las leídas físicamente desde el disco (**Read**).
    - **Operadores críticos**: Identificar `Seq Scan` (escaneo secuencial completo de la tabla) en tablas grandes en lugar de `Index Scan` o `Bitmap Index Scan`, y detectar ordenamientos que caen en disco (*Sort Method: external merge Disk*) por falta de memoria en `work_mem`.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Mirar únicamente el coste numérico preliminar sin ejecutar `ANALYZE` ni revisar los buffers de I/O de disco.
  - 🟢 **Green Flag**: Ajustar `work_mem` para evitar que los ordenamientos u operaciones hash caigan en disco temporal.

---

## 3. Almacenamiento Distribuido y NoSQL

### 27. ¿Qué formula el Teorema CAP y por qué la extensión PACELC es mucho más relevante para arquitecturas modernas?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  - **Teorema CAP (Eric Brewer)**: En presencia de una partición de red (**P** - partición inevitable en sistemas distribuidos), el sistema solo puede garantizar Consistencia Estricta (**C**) o Disponibilidad (**A**), pero jamás ambas a la vez:
    - **CP**: Prioriza que todos los nodos devuelvan los mismos datos; si hay partición de red, rechaza escrituras/lecturas de nodos aislados.
    - **AP**: Permite que cualquier nodo responda siempre, tolerando que puedan devolver datos desactualizados (*Eventual Consistency*).
  - **Teorema PACELC (Daniel Abadi)**: CAP solo describe qué pasa cuando hay un fallo de red. Pero los fallos ocurren el 0.1% del tiempo; ¿qué pasa durante el 99.9% del tiempo de operación normal?
    - **If Partition (P)**: ¿Prefieres **A**vailability o **C**onsistency?
    - **Else (E)**: ¿Prefieres **L**atency o **C**onsistency?
    Ejemplo: MongoDB es típicamente **PC/EC** (consistente bajo partición y bajo estado normal sacrifica latencia para garantizar consistencia); DynamoDB o Cassandra son **PA/EL** (disponibles bajo partición y bajo estado normal priorizan mínima latencia sobre consistencia inmediata).
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Decir que un sistema puede ser "CA" (no existe CA en sistemas distribuidos reales porque la red siempre puede fallar).
  - 🟢 **Green Flag**: Explicar el trade-off de latencia de PACELC en escenarios sin fallos de red.

---

### 28. ¿Por qué Redis es mono-hilo (Single-Threaded) en su núcleo de comandos y cómo logra procesar cientos de miles de operaciones por segundo?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  El motor de ejecución de datos de Redis es un **Event Loop single-threaded no bloqueante** sobre I/O multiplexing (`epoll` en Linux, `kqueue` en macOS).
  Razones de su altísimo rendimiento:
  1. **Todo reside en memoria RAM**: Cero lecturas de disco durante el ciclo de vida de los comandos.
  2. **Cero contención de locks**: Al ser single-threaded, cada comando se ejecuta de forma totalmente secuencial y atómica. No existen mutexes, ni locks de hebra, ni semáforos, eliminando por completo el coste de sincronización y cambios de contexto de CPU.
  3. **I/O Threads (Redis 6+)**: Las operaciones de lectura del socket TCP y parseo de protocolos fueron delegadas a hilos auxiliares, pero la manipulación de las estructuras de datos sigue siendo estrictamente mono-hilo.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Pensar que ejecutar comandos largos como `KEYS *` es inofensivo en producción.
  - 🟢 **Green Flag**: Advertir que comandos $O(N)$ como `KEYS *` bloquean por completo el event loop congelando todas las demás peticiones del sistema; en su lugar debe usarse `SCAN`.

---

### 29. ¿Qué es el fenómeno de Cache Stampede (Thundering Herd) y cómo lo soluciona el patrón SingleFlight / Mutex?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Ocurre cuando una clave de caché de alto tráfico (ej. el feed principal o catálogo de productos consultado 50,000 veces por segundo) expira repentinamente:
  - En ese mismo milisegundo, miles de peticiones concurrentes leen la caché, obtienen un *Cache Miss* y todas lanzan simultáneamente la consulta pesada hacia la base de datos relacional.
  - La base de datos colapsa instantáneamente por saturación de CPU y agotamiento de conexiones.
  **Solución con SingleFlight (Request Coalescing)**:
  Un mecanismo de exclusión mutua donde, si 1,000 llamadas concurrentes solicitan la misma clave ausente, solo **1 sola llamada** es autorizada a consultar la base de datos. Las otras 999 quedan esperando en memoria la resolución de esa única promesa o future compartido. Una vez que la consulta retorna y puebla la caché, todas las peticiones en espera se resuelven con ese valor compartido.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Responder que la solución es simplemente aumentar el TTL de la caché.
  - 🟢 **Green Flag**: Citar SingleFlight o técnicas como *Probabilistic Early Expiration* (Algoritmo XFetch).

---

### 30. ¿En qué consiste el algoritmo Redlock para Bloqueos Distribuidos en Redis y cuáles fueron las críticas de Martin Kleppmann?
- **Nivel**: Staff / Principal Architect
- **Respuesta Técnica**:
  Propuesto por Salvatore Sanfilippo (creador de Redis):
  - En lugar de confiar en una sola instancia de Redis (si se cae la réplica antes de sincronizar el lock, se pierde la exclusión mutua), Redlock despliega $N$ nodos maestros independientes (típicamente 5).
  - El cliente intenta adquirir el lock en los 5 nodos concurrentemente con un timeout pequeño.
  - El lock se considera adquirido si el cliente lo obtuvo en la mayoría ($N/2 + 1 = 3$ nodos) y el tiempo total empleado es menor que la validez del lock.
  **Críticas de Martin Kleppmann (Cambridge University)**:
  Redlock asume un modelo de tiempo sincrónico irreal. Si el cliente sufre una pausa prolongada por Garbage Collection (GC Stop-the-World), una anomalía de salto de reloj NTP en el sistema operativo o un retardo de red extremo, el lock puede expirar en Redis sin que el cliente lo sepa. Otro cliente adquirirá el lock y ambos escribirán en la base de datos concurrentemente corrompiendo los datos. Kleppmann demostró que si necesitas seguridad absoluta en almacenamiento, debes usar **Fencing Tokens** (tokens incrementales validados por el recurso de destino).
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Afirmar categóricamente que Redlock garantiza el 100% de consistencia sin entender las limitaciones de los saltos de tiempo en sistemas distribuidos.
  - 🟢 **Green Flag**: Citar la controversia Kleppmann vs Antirez y la necesidad de Fencing Tokens en bases de datos para validar exclusión mutua estricta.

---

### 31. ¿Cuáles son las políticas de desalojo (Eviction Policies) en Redis y cuándo usar LRU frente a LFU?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  Cuando Redis alcanza el límite configurado en `maxmemory`:
  1. `noeviction`: Retorna errores en comandos de escritura.
  2. `allkeys-lru` / `volatile-lru`: Desaloja las claves menos recientemente usadas (**Least Recently Used**).
  3. `allkeys-lfu` / `volatile-lfu`: Desaloja las claves menos frecuentemente usadas (**Least Frequently Used**).
  4. `volatile-ttl`: Desaloja las claves con TTL más próximo a expirar.
  5. `allkeys-random` / `volatile-random`: Desalojo aleatorio.
  - **LRU vs LFU**: Si una clave tuvo 1 millón de visitas en las últimas 2 horas pero no ha sido consultada en los últimos 5 minutos, LRU la desalojará ante una ráfaga de claves nuevas. LFU mantiene un contador logarítmico de frecuencia de acceso; preserva claves históricamente populares incluso si tuvieron una pequeña pausa temporal de consultas.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Configurar Redis como caché sin definir una política de desalojo (provocando errores OOM en escrituras).
  - 🟢 **Green Flag**: Elegir LFU para catálogos con distribución de popularidad de Pareto (ley 80/20).

---

### 32. ¿Cómo se modela en DynamoDB bajo el principio de "Single Table Design" y por qué difiere del modelado relacional?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  En bases de datos relacionales, el esquema se normaliza primero y las consultas se diseñan después mediante `JOIN`s.
  En DynamoDB:
  - **No existen JOINs**. El rendimiento debe ser predecible ($<10\text{ms}$) independientemente de si la tabla tiene 10 megabytes o 100 terabytes.
  - **Single Table Design**: Todas las entidades del dominio (Usuarios, Pedidos, Productos, Pagos) se almacenan en una **única tabla física**.
  - Se utilizan nombres genéricos para la clave primaria compuesta: `PK` (Partition Key) y `SK` (Sort Key).
  - **Modelado Guiado por Patrones de Acceso**: Antes de crear la tabla, debes conocer el 100% de las consultas que la aplicación requerirá. Mediante sobrecarga de claves (*Key Overloading*) y Global Secondary Indexes (GSI), una sola consulta `Query` puede obtener un usuario y sus últimos 10 pedidos en una única petición a la red.
- **Ejemplo**:
  | PK | SK | Data / Attributes |
  |---|---|---|
  | `USER#101` | `METADATA` | `{ name: "Laura", email: "..." }` |
  | `USER#101` | `ORDER#2025-001` | `{ total: 45.00, status: "PAID" }` |
  | `USER#101` | `ORDER#2025-002` | `{ total: 110.00, status: "PENDING" }` |
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Crear una tabla separada para cada entidad en DynamoDB e intentar hacer múltiples consultas secuenciales emulando JOINs en el backend.
  - 🟢 **Green Flag**: Utilizar herramientas como NoSQL Workbench y explicar cómo la Partition Key distribuye el tráfico entre particiones físicas evitando *Hot Partitions*.

---

### 33. ¿Cuál es la diferencia entre Write Concern y Read Concern en MongoDB Replica Sets?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Gobiernan el nivel de garantías de consistencia y durabilidad en un clúster de réplicas de MongoDB:
  - **Write Concern (`w`)**:
    - `w: 1`: El nodo primario confirma la escritura en memoria antes de que sea replicada a los secundarios. (Riesgo de pérdida de datos si el primario se cae antes de replicar).
    - `w: "majority"`: La escritura solo se confirma al cliente cuando ha sido persistida en la mayoría de los nodos del clúster ($> 50\%$). Previene pérdidas de datos ante fallos del nodo maestro (*Failover Rollbacks*).
  - **Read Concern**:
    - `local`: Lee los datos del nodo actual sin verificar si fueron confirmados por la mayoría.
    - `majority`: Solo lee datos que ya han sido confirmados por la mayoría de los nodos réplica, garantizando que el dato leído no será revertido en caso de partición de red.
    - `linearizable`: Garantiza lecturas estrictamente secuenciales en tiempo real comunicándose con la mayoría de nodos antes de responder.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Asumir que MongoDB siempre garantiza durabilidad por defecto con configuraciones estándar de fábrica.
  - 🟢 **Green Flag**: Analizar el trade-off de latencia de red que introduce `w: majority` frente a la seguridad de la información financiera.

---

### 34. ¿Qué es una "Hot Partition" en bases de datos NoSQL distribuidas (DynamoDB / Cassandra) y cómo se previene?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Ocurre cuando la clave de partición elegida concentra un volumen desproporcionado de peticiones de lectura o escritura en un único nodo físico del clúster, saturando su CPU o su cuota de IOPS mientras los otros 99 nodos permanecen ociosos.
  Ejemplo: Usar `created_date` (ej. `2025-09-21`) como Partition Key ➔ Todas las transacciones del día de hoy van a la misma partición física.
  **Estrategias de Prevención (Write Sharding / Salting)**:
  - Agregar un sufijo pseudoaleatorio o hash a la clave de partición para distribuir la carga: `PK = "2025-09-21#" + random(1, 10)`.
  - Las escrituras se dispersan uniformemente entre 10 particiones físicas diferentes. En las lecturas, el backend lanza 10 lecturas paralelas (*Scatter-Gather*) y fusiona los resultados.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Seleccionar un atributo de baja cardinalidad (ej. género o estado booleano) como Partition Key.
  - 🟢 **Green Flag**: Explicar la técnica de Hash Partitioning y el cálculo de límites de throughput por partición física en AWS DynamoDB (1,000 WCU / 3,000 RCU por partición).

---

### 35. ¿Cómo funciona la estructura de datos Redis Streams frente a Pub/Sub tradicional?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  - **Redis Pub/Sub**: Modelo "Dispara y Olvida" (*Fire and Forget*). No tiene persistencia. Si un suscriptor está desconectado en el milisegundo en que se publica un mensaje, el mensaje se pierde para siempre. No existe concepto de confirmación de entrega (*ACK*) ni de consumidores competidores distribuidos.
  - **Redis Streams (tipo `XADD`, `XREADGROUP`)**: Log apéndice persistente en memoria inspirado en Apache Kafka:
    - Los mensajes se persisten con IDs cronológicos basados en timestamp.
    - Soporta **Consumer Groups**: Múltiples instancias de backend pueden repartirse el procesamiento de los mensajes del stream sin duplicar trabajo.
    - Cuenta con **Pending Entries List (PEL)** y comando `XACK`: Si un consumidor muere a mitad del procesamiento, otro consumidor puede reclamar el mensaje pendiente (`XCLAIM`) evitando la pérdida de tareas.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Usar Pub/Sub para tareas transaccionales críticas donde la pérdida de mensajes es inaceptable.
  - 🟢 **Green Flag**: Utilizar Consumer Groups en Redis Streams con gestión explícita de `XACK` para construir colas de mensajería altamente resilientes.

---

### 36. ¿Qué es un Bloom Filter y cómo optimiza la lectura en motores de almacenamiento LSM-Tree (Cassandra, RocksDB)?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Un Bloom Filter es una estructura de datos probabilística ultra compacta en memoria diseñada para responder con certeza matemática a una sola pregunta: *"¿Existe este elemento en el conjunto?"*.
  - Respuestas posibles:
    - **"Definitivamente NO está"**: 100% de certeza (cero falsos negativos).
    - **"Probablemente SÍ esté"**: Con una pequeña tasa configurable de falsos positivos.
  - **Aplicación en LSM-Trees (Log-Structured Merge-Trees)**: En bases de datos como Cassandra o RocksDB, los datos residen en múltiples archivos inmutables en disco llamados SSTables. Sin Bloom Filters, para buscar una fila ausente la base de datos tendría que abrir y leer cada archivo del disco. Con un Bloom Filter en RAM por cada SSTable, el motor descarta instantáneamente el 99% de los archivos sin tocar el disco.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Creer que un Bloom Filter puede almacenar y devolver los objetos originales o que permite borrar elementos sin estructuras complejas (Counting Bloom Filters).
  - 🟢 **Green Flag**: Explicar el funcionamiento mediante múltiples funciones de hashing independientes sobre un bit array en memoria.

---

### 37. ¿Cuándo se debe elegir una Base de Datos de Grafos (Neo4j) frente a un modelo relacional tradicional?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  Cuando el valor nuclear de la información reside en las **relaciones complejas y profundas** entre las entidades y no solo en los atributos de las entidades aisladas.
  - **En SQL relacional**: Consultar amigos de amigos de amigos (recorridos de 4 a 6 niveles de profundidad) requiere múltiples `JOIN`s recursivos costosos que crecen exponencialmente ($O(N^K)$), degradando la memoria de la base de datos.
  - **En Bases de Datos de Grafos (Neo4j con Index-Free Adjacency)**: Cada nodo almacena punteros físicos directos en memoria a sus nodos vecinos adyacentes. Atravesar relaciones se resuelve desreferenciando punteros en tiempo constante $O(1)$ por salto, independientemente del tamaño total del grafo global.
  - **Casos de uso**: Detección de fraude financiero (redes de cuentas cruzadas), motores de recomendación social, grafos de dependencias e infraestructuras de identidad y permisos (IAM / RBAC).
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Usar Neo4j para almacenar un simple CRUD transaccional de facturación o e-commerce tradicional.
  - 🟢 **Green Flag**: Citar el concepto de *Index-Free Adjacency* para justificar el rendimiento de travesía en grafos densos.

---

### 38. ¿Qué es y cómo se resuelve el problema de "Split-Brain" en clústeres NoSQL distribuidos?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Ocurre cuando una partición de red divide un clúster de $N$ nodos en dos subredes aisladas que no pueden comunicarse entre sí. Si ambas mitades asumen erróneamente que la otra mitad murió y ambas eligen a un nuevo nodo líder o aceptan escrituras independientes, la base de datos se bifurca en dos estados divergentes e irreconciliables (**Split-Brain**).
  **Solución mediante Quorum (Algoritmos de Consenso: Raft / Paxos)**:
  - Se requiere un número **impar** de nodos votantes (mínimo 3 o 5).
  - Para elegir a un líder o confirmar cualquier escritura, se exige estrictamente la **Mayoría Absoluta (Quorum)**:
    $$\text{Quorum} = \left\lfloor \frac{N}{2} \right\rfloor + 1$$
  - En un clúster de 5 nodos dividido en 3 y 2: la partición con 3 nodos tiene mayoría ($3 \ge 3$) y puede operar; la partición con 2 nodos queda en minoría, rechaza escrituras automáticamente y entra en modo de solo lectura o aislamiento, evitando el Split-Brain de forma matemáticamente garantizada.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Proponer un clúster de 2 nodos maestros pensando que aporta alta disponibilidad (si se desconectan, ninguno tiene quórum de mayoría).
  - 🟢 **Green Flag**: Demostrar por qué el número de nodos maestros en Raft/etcd/Zookeeper siempre debe ser impar ($2F + 1$ para tolerar $F$ fallos).

---

## 4. Sistemas Distribuidos, Consistencia y Resiliencia

### 39. ¿Qué es el Patrón Circuit Breaker y cuáles son sus 3 estados de transición interna?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  Previene fallos en cascada cuando un servicio downstream remoto falla o experimenta latencias inasumibles:
  1. **CLOSED (Cerrado - Operación Normal)**: Las peticiones fluyen libremente hacia el servicio remoto. El circuito mide la tasa de fallos o timeouts en una ventana de tiempo. Si la tasa de fallos supera un umbral crítico (ej. 50% de errores en 10 segundos), el circuito conmuta a **OPEN**.
  2. **OPEN (Abierto - Fallo Rápido / Fail-Fast)**: Ninguna petición se envía a la red. El Circuit Breaker rechaza inmediatamente todas las llamadas entrantes arrojando una excepción inmediata o ejecutando una lógica de degradación (*Fallback*). Esto protege los hilos de nuestro servidor y le otorga tiempo de recuperación al servicio caído.
  3. **HALF-OPEN (Semi-Abierto - Prueba de Recuperación)**: Tras expirar un temporizador de enfriamiento (*sleep window*, ej. 30 segundos), el circuito permite pasar una cantidad mínima de peticiones de sondeo (ej. 5 llamadas). Si esas peticiones tienen éxito, el circuito se restablece a **CLOSED**. Si una sola falla, regresa inmediatamente a **OPEN**.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Reintentar llamadas infinitamente con bucles `while(true)` ante un servicio downstream caído.
  - 🟢 **Green Flag**: Combinar Circuit Breaker con librerías estándar (Resilience4j, Polly, opossum) y métricas expuestas a Prometheus.

---

### 40. ¿Por qué el Exponential Backoff DEBE combinarse obligatoriamente con "Full Jitter"?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  El retroceso exponencial incrementa el tiempo de espera entre reintentos ($t = 2^{\text{attempt}} \times \text{base}$).
  **El problema sin Jitter**: Si 10,000 clientes experimentan un fallo simultáneo a las 12:00:00, todos reintentarán exactamente a las 12:00:01, luego todos a las 12:00:03, luego todos a las 12:00:07. El tráfico no se dispersa, sino que se sincroniza en ráfagas devastadoras (*Thundering Herd*) que impiden que el servicio recuperado vuelva a levantarse.
  **Fórmula de Full Jitter (AWS Architecture Paper)**:
  $$t_{\text{sleep}} = \text{random}(0, \min(\text{cap}, \text{base} \times 2^{\text{attempt}}))$$
  Introducir aleatoriedad uniforme completa rompe la sincronización entre clientes, aplanando la curva de concurrencia y distribuyendo los reintentos de forma homogénea a lo largo del tiempo.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Implementar reintentos con un `sleep(2000)` fijo o con backoff exponencial sin aleatoriedad.
  - 🟢 **Green Flag**: Citar la investigación formal de AWS sobre Jitter y demostrar su aplicación en arquitecturas de alta concurrencia.

---

### 41. ¿Qué es el Transactional Outbox Pattern y qué grave problema de consistencia resuelve?
- **Nivel**: Senior / Staff / Architect
- **Respuesta Técnica**:
  **El Problema de la Doble Escritura (Dual-Write Problem)**:
  En una operación de negocio, necesitas guardar una orden en la Base de Datos relacional y publicar un evento `OrderCreated` en Kafka o RabbitMQ.
  - Si guardas en BD primero y la red falla antes de enviar a Kafka ➔ El evento se pierde; los otros servicios nunca se enteran.
  - Si publicas en Kafka primero y la BD hace rollback por violación de constraint ➔ Publicaste un evento fantasma de una orden que nunca existió.
  No puedes tener una transacción atómica distribuida tradicional (2PC) eficiente entre una BD y un Message Broker.
  **La Solución: Transactional Outbox Pattern**:
  1. En la misma base de datos relacional, se crea una tabla llamada `outbox_events`.
  2. Dentro de una **única transacción ACID local**:
     ```sql
     BEGIN;
     INSERT INTO orders (id, total, user_id) VALUES (...);
     INSERT INTO outbox_events (aggregate_id, event_type, payload) VALUES (...);
     COMMIT;
     ```
  3. Un proceso desacoplado asíncrono lee la tabla `outbox` mediante **Change Data Capture (CDC con Debezium/Kafka Connect)** leyendo el Transaction Log de la BD (WAL) o un relay seguro, y publica el mensaje en Kafka con garantías de entrega.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Intentar resolver la doble escritura con un bloque `try/catch` simple en el código de la aplicación.
  - 🟢 **Green Flag**: Explicar CDC basado en lectura del log de transacciones (WAL/Oplog) evitando el polling recurrente a la base de datos.

---

### 42. ¿Cuál es la diferencia arquitectónica nuclear entre Apache Kafka y RabbitMQ?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  - **RabbitMQ (Message Broker Inteligente / Dumb Consumer)**:
    - Enrutamiento complejo y dinámico mediante Exchanges (Direct, Topic, Fanout, Headers).
    - Basado en colas transitorias en memoria: una vez que el consumidor procesa el mensaje y emite un `ACK`, el mensaje se elimina del broker.
    - Ideal para procesamiento de comandos asíncronos y tareas puntuales de backend (*Work Queues*).
  - **Apache Kafka (Distributed Commit Log / Smart Consumer)**:
    - Registro de eventos apéndice inmutable persistido en disco y ordenado cronológicamente por particiones.
    - Los mensajes **NO se eliminan tras ser leídos**; se retienen según una política de retención temporal o por tamaño (días/meses).
    - Los consumidores son autónomos: cada uno mantiene su propio puntero (**Offset**) y pueden reproducir la historia desde el inicio (*Time-travel / Event Replay*).
    - Diseñado para flujos masivos de streaming de datos con rendimientos de millones de eventos por segundo.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Elegir Kafka simplemente para enviar un correo electrónico de confirmación de registro de usuario.
  - 🟢 **Green Flag**: Analizar el desacoplamiento de velocidad que ofrece el Offset de Kafka y la capacidad de re-procesar eventos pasados tras reparar un bug en un servicio downstream.

---

### 43. ¿Qué significan las semánticas de entrega "At-Least-Once", "At-Most-Once" y "Exactly-Once" en sistemas de mensajería?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  - **At-Most-Once (A lo sumo una vez)**: El mensaje se entrega 0 o 1 vez. El emisor no reintenta si hay fallos o emite el ACK antes de procesar. Cero duplicados, pero se toleran pérdidas de mensajes.
  - **At-Least-Once (Al menos una vez)**: El mensaje se entrega 1 o más veces. Ante cualquier fallo de red o falta de ACK, el broker reintenta la entrega. No se pierde ningún mensaje, pero **pueden llegar mensajes duplicados**. (Es el estándar de la industria).
  - **Exactly-Once (Exactamente una vez)**: El mensaje se procesa exactamente 1 vez con efectos secundarios no duplicados. En sistemas distribuidos abiertos es un mito a menos que se cumpla una condición obligatoria: **el consumidor DEBE ser estrictamente Idempotente**.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Creer que activar una configuración mágica en Kafka elimina la necesidad de diseñar consumidores idempotentes en la base de datos receptora.
  - 🟢 **Green Flag**: Enfatizar que en el mundo real, "Exactly-Once" es el resultado de la combinación de *At-Least-Once delivery* más *Idempotent consumer processing*.

---

### 44. ¿En qué consiste el Patrón Saga para transacciones distribuidas y cuáles son las diferencias entre Coreografía y Orquestación?
- **Nivel**: Senior / Staff / Architect
- **Respuesta Técnica**:
  En arquitecturas de microservicios con bases de datos desacopladas, una transacción global (ej. Compra: Crear Pedido ➔ Cobrar Tarjeta ➔ Reservar Stock ➔ Enviar Envío) no puede usar transacciones ACID tradicionales.
  Una **Saga** es una secuencia de transacciones locales. Cada transacción local actualiza la base de datos de un servicio y publica un evento. Si una etapa falla (ej. tarjeta rechazada), la Saga ejecuta **Transacciones de Compensación** hacia atrás para deshacer los cambios previos (ej. cancelar orden, liberar stock).
  - **Coreografía (Descentralizada)**: Cada microservicio reacciona a los eventos de los demás servicios sin un coordinador central.
    - *Pros*: Altamente desacoplado, sin punto único de fallo.
    - *Contras*: Difícil de rastrear el flujo global; riesgo de dependencias circulares complejas.
  - **Orquestación (Centralizada)**: Un orquestador central (ej. Temporal.io, AWS Step Functions o un servicio de Saga) gestiona el flujo, invoca los microservicios y decide cuándo activar las transacciones compensatorias.
    - *Pros*: Flujo transparente, fácil observabilidad y control de errores.
    - *Contras*: Riesgo de acoplar demasiada lógica de negocio en el orquestador.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Proponer Two-Phase Commit (2PC) para microservicios web públicos (bloqueante, no escala y sufre si un nodo se cuelga).
  - 🟢 **Green Flag**: Destacar que las transacciones de compensación deben ser idempotentes y tolerar que el rollback también pueda sufrir reintentos.

---

### 45. ¿Qué es CQRS (Command Query Responsibility Segregation) y cuándo está justificado implementarlo?
- **Nivel**: Senior / Staff / Architect
- **Respuesta Técnica**:
  CQRS segrega de forma estricta los modelos de lectura (**Query**) de los modelos de escritura (**Command**):
  - **Command Stack**: Optimizado exclusivamente para transacciones de negocio, validación de invariantes y mutaciones atómicas (ej. base de datos relacional PostgreSQL con normalización estricta).
  - **Query Stack**: Optimizado para búsquedas ultra rápidas, agregaciones complejas y vistas de usuario (ej. Elasticsearch para búsqueda full-text o vistas materializadas desnormalizadas en Redis/MongoDB).
  - La sincronización entre ambos stacks se realiza asíncronamente mediante eventos de dominio (*Eventual Consistency*).
  **Cuándo está justificado**:
  - Diferencia brutal entre el volumen de lecturas y escrituras (ej. 10,000 lecturas por cada 1 escritura).
  - Cuando los requerimientos de consulta exigen unir docenas de tablas complejas que destruyen el rendimiento del modelo transaccional.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Implementar CQRS en un CRUD básico o aplicación pequeña sin justificación de escala (añade una complejidad accidental desmedida).
  - 🟢 **Green Flag**: Advertir sobre la consistencia eventual y cómo manejar la experiencia de usuario (UI optimista) cuando el Query model tarda unos cientos de milisegundos en actualizarse tras un comando.

---

### 46. ¿Qué es Event Sourcing y cómo se relaciona con CQRS?
- **Nivel**: Staff / Principal Architect
- **Respuesta Técnica**:
  En lugar de almacenar el *estado actual* de una entidad en una fila mutable de una tabla (sobrescribiendo valores con `UPDATE`), **Event Sourcing** almacena el historial completo e inmutable de todos los eventos de dominio que le ocurrieron a esa entidad en un **Event Store** apéndice:
  - En lugar de `balance: 250`, se almacena: `AccountOpened(+0)`, `MoneyDeposited(+300)`, `MoneyWithdrawn(-50)`.
  - El estado actual se reconstruye en memoria reproduciendo (*rehydrating*) todos los eventos pasados desde el origen.
  - Para optimizar el tiempo de reconstrucción se utilizan **Snapshots** periódicos.
  **Relación con CQRS**: Event Sourcing es casi imposible de consultar eficientemente por rangos o filtros múltiples (`WHERE balance > 100`). Por lo tanto, casi siempre requiere CQRS: el Event Store procesa los comandos y publica eventos hacia proyecciones de lectura optimizadas para consultas.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Creer que Event Sourcing es simplemente tener una tabla de auditoría secundaria.
  - 🟢 **Green Flag**: Destacar casos de uso idóneos como libros contables financieros, trazabilidad médica o sistemas de seguros donde la auditoría inmutable es imperativo legal.

---

### 47. ¿Qué es el Patrón Bulkhead (Mamparo) y cómo protege la estabilidad del backend?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  Inspirado en los mamparos estancos de los barcos (que aíslan las secciones del casco para que una fuga de agua en una habitación no hunda el navío completo):
  En backend, el patrón **Bulkhead** aísla los recursos del sistema (hilos de ejecución, pools de conexiones a base de datos, memoria) asignando cuotas separadas para diferentes funcionalidades críticas:
  - Ejemplo: Si el servicio de "Generación de Reportes PDF en segundo plano" y el servicio de "Checkout de Pagos" comparten el mismo pool de 20 conexiones a la base de datos, una avalancha de usuarios pidiendo reportes consumirá las 20 conexiones, provocando que el checkout de pagos falle por inanición de recursos.
  - **Aplicación del Mamparo**: Asignar un pool dedicado de 5 conexiones exclusivas para reportes y un pool dedicado de 15 conexiones exclusivas para checkout. Si los reportes colapsan, el flujo de pagos sigue operando con total normalidad.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Permitir que un endpoint secundario no crítico comparta la misma piscina de hilos y conexiones que el core de facturación de la empresa.
  - 🟢 **Green Flag**: Explicar la implementación de Bulkheads a nivel de software (pools aislados) y a nivel de infraestructura (Kubernetes node pools dedicados).

---

### 48. ¿Cómo funciona el algoritmo de Consenso Raft en sistemas distribuidos modernos (etcd, Kubernetes)?
- **Nivel**: Senior / Staff / Architect
- **Respuesta Técnica**:
  Diseñado por Ongaro y Ousterhout (Stanford) como alternativa comprensible a Paxos. Un clúster Raft elige a un único **Líder** que tiene la responsabilidad absoluta de gestionar la replicación del Log distribuido:
  1. **Roles de los Nodos**: Cada nodo se encuentra en uno de 3 estados: *Follower*, *Candidate* o *Leader*.
  2. **Leader Election**: Los followers tienen temporizadores de elección aleatorios (*Election Timers* entre 150ms y 300ms). Si un follower no recibe el heartbeat del líder antes de que su temporizador expire, se convierte en *Candidate*, vota por sí mismo y solicita votos a los demás. Si obtiene la mayoría absoluta de votos ($> N/2$), se convierte en el nuevo *Leader*.
  3. **Log Replication**: Todos los clientes envían sus escrituras al Líder. El Líder escribe la entrada en su log local y la envía a los followers mediante mensajes `AppendEntries`. Cuando la mayoría de los followers confirman la escritura, la entrada se marca como **Committed** y el líder responde con éxito al cliente.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Desconocer que etcd (el cerebro de Kubernetes) utiliza Raft para garantizar la coherencia de todo el estado del clúster.
  - 🟢 **Green Flag**: Explicar cómo los election timeouts aleatorios evitan que múltiples candidatos dividan los votos indefinidamente (*Split-Vote Prevention*).

---

### 49. ¿Cuáles son las diferencias entre una Arquitectura Orquestada vs Coreografiada en Microservicios y cuándo elegir cada una?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  - **Coreografía**: Modelo reactivo basado en eventos (*Event-Driven*). Los servicios emiten eventos al bus de mensajería y otros servicios suscritos actúan autónomamente. No existe un cerebro central.
    - *Cuándo elegir*: Procesos con pocos pasos, alta necesidad de desacoplamiento e independencia de equipos.
  - **Orquestación**: Un servicio centralizado actúa como director de orquesta coordinando las llamadas a los demás servicios mediante APIs síncronas o asíncronas.
    - *Cuándo elegir*: Flujos de negocio complejos con más de 5-10 pasos condicionales, requisitos estrictos de auditoría de estado en tiempo real y necesidad de coordinar transacciones compensatorias (Sagas complejas).
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Forzar coreografía en flujos de negocio hipercomplejos donde nadie en la empresa sabe qué servicio se ejecuta después ni dónde se detuvo un pedido.
  - 🟢 **Green Flag**: Evaluar herramientas de State Machine y Workflow Orchestration como Temporal.io o Camunda para flujos orquestados resilientes.

---

### 50. ¿Cómo se diseña un sistema de Observabilidad Distribuida completo utilizando OpenTelemetry (Traces, Metrics y Logs)?
- **Nivel**: Staff / Principal Architect
- **Respuesta Técnica**:
  Los 3 Pilares de la Observabilidad correlacionados unívocamente:
  1. **Distributed Tracing**:
     - Cada petición entrante en el API Gateway recibe un **`Trace ID`** global único de 128 bits y un **`Span ID`** local (estándar **W3C Trace Context**: cabecera `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`).
     - Al invocar otros microservicios por HTTP o Kafka, la cabecera `traceparent` se propaga en los headers. Permite graficar la cascada de latencias exacta a través de 20 microservicios en herramientas como Jaeger o Tempo.
  2. **Structured Logging con Inyección de Contexto**:
     - Todos los logs se emiten en formato JSON hacia `stdout` e inyectan automáticamente el `trace_id` y `span_id` actual mediante librerías de contexto asíncrono (ej. `AsyncLocalStorage` en Node.js, `ThreadLocal` / MDC en Java). Permite buscar un error en Loki/Elasticsearch y saltar con un clic a la traza exacta.
  3. **Métricas (RED Method)**:
     - **R**ate (peticiones por segundo), **E**rrors (tasa de errores 5xx), **D**uration (histograma de latencias p95, p99). Exportadas a Prometheus en formato OpenTelemetry.
- **Diferenciadores en la entrevista**:
  - 🚩 **Red Flag**: Proponer rastreo de errores mediante logs de texto plano dispersos en archivos locales de cada máquina sin IDs de correlación.
  - 🟢 **Green Flag**: Citar el estándar W3C Trace Context y OpenTelemetry Collector para desacoplar el código de los proveedores específicos de observabilidad (Datadog, Dynatrace, Grafana).


---

## 5. Persistencia Relacional Avanzada, Sharding y Optimización SQL

### 51. ¿Cómo funciona el particionamiento de tablas (*Table Partitioning*) por rango, lista y hash en PostgreSQL?
- **Nivel**: Senior / Staff / DBA
- **Respuesta Técnica**:
  El particionamiento divide lógicamente una tabla masiva en múltiples tablas físicas más pequeñas transparentes para el cliente:
  - **Range Partitioning**: Divide por rangos de valores continuos (ideal para series temporales por fecha, ej. particiones por mes).
  - **List Partitioning**: Divide por un conjunto explícito de valores discretos (ej. código de país `'ES'`, `'MX'`, `'US'`).
  - **Hash Partitioning**: Distribuye las filas de manera uniforme entre N particiones calculando un hash sobre la clave:
  ```sql
  -- Tabla Maestra Declarativa
  CREATE TABLE audit_logs (
    id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB
  ) PARTITION BY RANGE (created_at);

  -- Particiones Físicas
  CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
  CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
  ```
  *Partition Pruning*: El optimizador de PostgreSQL analiza la cláusula `WHERE created_at >= '2026-01-15'` y descarta escanear todas las particiones irrelevantes, reduciendo lecturas de disco drásticamente.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Mantener una única tabla plana de 500 millones de filas sin particionar provocando caídas de mantenimiento e índices gigantescos en RAM.
  - 🟢 *Green Flag*: Explica cómo el particionamiento permite purgar datos viejos de forma instantánea con `DROP TABLE partition` sin generar bloat ni bloqueos de `DELETE`.

---

### 52. ¿Qué es el Sharding horizontal de bases de datos, cómo elegir una Sharding Key y cómo mitigar el *Hot Partitioning*?
- **Nivel**: Staff Engineer / Distributed Systems
- **Respuesta Técnica**:
  Cuando una base de datos excede la capacidad de cómputo y almacenamiento de una sola máquina física (escalado vertical agotado), se aplica **Sharding Horizontal**: distribuir filas de una tabla entre múltiples servidores de bases de datos independientes (*Shards*).
  - **Elección de la Sharding Key**:
    - Debe tener **alta cardinalidad** (millones de valores posibles).
    - Distribución uniforme de lecturas y escrituras para evitar que un solo servidor se sature (**Hot Partitioning**).
    - Alinear con las consultas más frecuentes: si consultas siempre por `tenant_id` o `company_id`, esa clave agrupa todos los datos del cliente en el mismo nodo evitando *Cross-Shard Queries*.
  - **Peligro de Claves Secuenciales**: Usar un timestamp o auto-incremental como sharding key provoca que el 100% de las nuevas inserciones golpeen siempre al último nodo del clúster mientras los demás están inactivos.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Elegir claves de sharding con baja cardinalidad (ej. `gender` o `country`) creando particiones gigantes desbalanceadas.
  - 🟢 *Green Flag*: Explica el uso de hashing consistente (*Consistent Hashing*) con shards virtuales para rebalancear datos sin migraciones masivas.

---

### 53. ¿Cuál es la diferencia arquitectónica interna entre un índice B-Tree, un índice LSM-Tree y un índice GiST/GIN?
- **Nivel**: Senior / Staff / Data Systems
- **Respuesta Técnica**:
  - **B-Tree (PostgreSQL, MySQL InnoDB)**:
    - Árbol balanceado optimizado para lecturas rápidas y búsquedas por rango ($O(\log N)$).
    - Las mutaciones actualizan páginas en disco directamente en el sitio (*In-Place Updates*). Muy eficiente en lecturas aleatorias, pero costoso en escrituras de alta frecuencia debido a rebalanceo de páginas y fragmentación.
  - **LSM-Tree (Log-Structured Merge-Tree: Cassandra, RocksDB, ClickHouse)**:
    - Optimizado para **escrituras extremas de alta velocidad**: las inserciones se escriben secuencialmente en un buffer en memoria (*MemTable*) y en un log continuo (*WAL*).
    - Cuando la MemTable se llena, se vuelca al disco como un archivo inmutable ordenado (*SSTable*).
    - Un proceso en segundo plano (*Compaction*) fusiona y desduplica SSTables. Las lecturas pueden ser más lentas porque consultan múltiples archivos (mitigado con Bloom Filters).
  - **GIN (Generalized Inverted Index en Postgres)**:
    - Índice invertido ideal para tipos de datos compuestos (JSONB, Arrays, Full-Text Search): asocia cada clave o palabra interna a una lista de IDs de filas.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Asumir que todas las bases de datos utilizan índices B-Tree independientemente de su perfil de lectura/escritura.
  - 🟢 *Green Flag*: Justifica el uso de LSM-Trees para sistemas de telemetría y logs con 500,000 inserciones/segundo.

---

### 54. ¿Cómo optimizar consultas SQL analizando el plan de ejecución con `EXPLAIN (ANALYZE, BUFFERS)` de PostgreSQL?
- **Nivel**: Senior / DBA
- **Respuesta Técnica**:
  `EXPLAIN (ANALYZE, BUFFERS)` ejecuta la consulta real y devuelve la telemetría exacta del motor:
  ```sql
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT * FROM orders WHERE customer_id = 'c123' AND status = 'PENDING';
  ```
  *Métricas Clave de Diagnóstico*:
  1. **Seq Scan (Sequential Scan)**: El motor leyó la tabla completa de arriba a abajo. Alerta de falta de índice.
  2. **Index Scan vs Bitmap Index Scan**:
     - *Index Scan*: Lee el índice B-Tree y busca cada fila en la tabla directamente (ideal para pocos resultados).
     - *Bitmap Index Scan*: Escanea el índice construyendo un mapa de bits en memoria de páginas de datos y lee las páginas en bloque secuencialmente (óptimo cuando hay cientos de coincidencias).
  3. **Buffers: Shared Hit vs Read**:
     - `Shared Hit`: Bloques leídos directamente de la memoria RAM (*Buffer Pool* de PostgreSQL) en microsegundos.
     - `Shared Read`: Bloques leídos físicamente del disco SSD (latencia en milisegundos).
  4. **Cost vs Actual Time**: Si las filas estimadas (`rows=1`) difieren drásticamente de las reales (`actual rows=50000`), las estadísticas de la tabla están desactualizadas (`ANALYZE table;`).
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Mirar únicamente el coste teórico de `EXPLAIN` sin analizar los buffers leídos de disco o la discrepancia de filas estimadas.
  - 🟢 *Green Flag*: Detecta escaneos secuenciales y rediseña índices compuestos multicolumna respetando el principio de izquierda a derecha.

---

### 55. ¿Cómo funciona el *Vacuuming* y el *Autovacuum* en PostgreSQL y qué riesgos de degradación de rendimiento introduce el Bloat?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  Debido al modelo MVCC de PostgreSQL, cuando se ejecuta un `UPDATE` o `DELETE`, el motor **no borra los datos en disco inmediatamente**:
  - Marca la fila vieja como una **Tupla Muerta (Dead Tuple)** y crea una nueva tupla para la versión actualizada.
  - Si una tabla recibe millones de actualizaciones y las tuplas muertas no se limpian, el archivo en disco crece artificialmente (**Table Bloat**), haciendo que las consultas lean páginas vacías y los índices se inflen en memoria RAM.
  - **Autovacuum**: Proceso demonio en segundo plano que escanea páginas y marca el espacio de las tuplas muertas como disponible para futuras inserciones.
  - **Transaction ID Wraparound (Riesgo Crítico de Caída)**: PostgreSQL usa números de transacción de 32 bits (~4 mil millones). Si Autovacuum no congela (*Freeze*) tuplas viejas antes de que el contador alcance 2 mil millones de transacciones, PostgreSQL se apaga de emergencia para evitar pérdida de datos.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Desactivar el Autovacuum porque "consume CPU" sin entender que la base de datos colapsará por bloat y congelamiento de IDs de transacción.
  - 🟢 *Green Flag*: Ajusta parámetros de autovacuum (`autovacuum_vacuum_scale_factor = 0.05`, `autovacuum_cost_limit = 2000`) para tablas masivas.

---

### 56. ¿Cómo evitar el agotamiento de IDs enteros de 32 bits (*Integer Overflow*) en claves primarias y cómo migrar a `BIGINT` sin downtime?
- **Nivel**: Senior / Production Engineering
- **Respuesta Técnica**:
  Una columna `INTEGER` (`SERIAL`) de 32 bits tiene un límite de $2,147,483,647$ registros. Al alcanzar ese número, cualquier nuevo `INSERT` falla catastróficamente con `ERROR: integer out of range`.
  *Estrategia de Migración Zero-Downtime a BIGINT (64 bits)*:
  Ejecutar un simple `ALTER TABLE orders ALTER COLUMN id TYPE BIGINT` bloquea la tabla en modo exclusivo durante horas en tablas masivas.
  *Procedimiento en 5 pasos*:
  1. Crear una nueva columna: `ALTER TABLE orders ADD COLUMN id_tmp BIGINT;`
  2. Crear un Trigger que replique los nuevos inserts/updates de `id` hacia `id_tmp`.
  3. Ejecutar un script batch en segundo plano que copie los IDs viejos en bloques de 10,000 filas.
  4. Crear un índice único sobre `id_tmp` de forma concurrente: `CREATE UNIQUE INDEX CONCURRENTLY idx_orders_id_tmp ON orders (id_tmp);`.
  5. En una transacción atómica ultra-rápida (< 10ms): renombrar columnas y reasignar la Primary Key.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Ejecutar un `ALTER COLUMN` directo en producción en una tabla de 500 millones de filas sin medir el bloqueo de tabla.
  - 🟢 *Green Flag*: Monitorea proactivamente el consumo de secuencias (`percent_used` sobre `pg_sequences`) para migrar antes de alcanzar el 80% del límite.

---

### 57. ¿Por qué los UUIDv4 degradan el rendimiento de los índices B-Tree (*Index Fragmentation*) y por qué `UUIDv7` o `ULID` son superiores?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  - **UUIDv4**: Generado de forma puramente aleatoria.
    - Cuando se insertan millones de filas con UUIDv4 en una tabla con clave primaria B-Tree, las claves se distribuyen aleatoriamente por todo el árbol.
    - Esto provoca continuas **divisiones de páginas de disco (Page Splits)**: el motor debe cargar páginas viejas desde el disco a la RAM para insertar en medio, fragmentando el índice e impidiendo que quepa en el Buffer Pool de la memoria.
  - **UUIDv7 (RFC 9562) y ULID**:
    - Son **K-Sortable**: Comienzan con una estampa de tiempo en milisegundos de 48 bits seguida de entropía aleatoria.
    - Las nuevas inserciones siempre se agregan secuencialmente al final del árbol B-Tree (*Append-Only*).
    - Preservan la localidad espacial de la caché, reducen el tamaño de los índices en un 50% y aumentan el rendimiento de inserción hasta en un 400%.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Defender UUIDv4 como la mejor clave primaria para bases de datos relacionales ignorando el impacto de fragmentación en índices B-Tree.
  - 🟢 *Green Flag*: Promueve la adopción de `UUIDv7` nativo para combinar unicidad global sin colisiones con ordenación temporal secuencial.

---

### 58. ¿Cómo implementar replicación física streaming (síncrona vs asíncrona) en PostgreSQL y cómo mitigar el *Replication Lag*?
- **Nivel**: Senior / SRE
- **Respuesta Técnica**:
  La replicación por streaming transmite el log de transacciones (WAL) desde el nodo Primario hacia los nodos Réplica de solo lectura (*Read Replicas*):
  - **Asíncrona (Por Defecto)**: El Primario confirma la transacción al cliente tan pronto como escribe su propio WAL local.
    - *Ventaja*: Máximo rendimiento de escritura.
    - *Riesgo*: Si el primario sufre un corte eléctrico antes de enviar los bytes de WAL, se produce pérdida de datos (**RPO > 0**). Las réplicas pueden tener retraso de lectura (**Replication Lag**).
  - **Síncrona (`synchronous_commit = on` y `synchronous_standby_names`))**: El Primario no confirma la transacción al cliente hasta que al menos una réplica confirme haber recibido y escrito el WAL en disco.
    - *Ventaja*: Cero pérdida de datos (**RPO = 0**).
    - *Desventaja*: La latencia de cada escritura aumenta por el tiempo de ida y vuelta de red (RTT) hacia la réplica.
  *Mitigación de Inconsistencia de Lectura*: Si un usuario actualiza su perfil, la siguiente lectura inmediata de ese usuario debe dirigirse forzosamente al Primario (*Read-Your-Own-Writes Consistency*).
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Enrutar lecturas inmediatas posteriores a una mutación a réplicas asíncronas y sorprenderse de que el usuario vea datos viejos.
  - 🟢 *Green Flag*: Diseña una política híbrida: lecturas críticas en el primario y lecturas analíticas o secundarias en réplicas con monitoreo de lag en bytes (`pg_wal_lsn_diff`).

---

### 59. ¿Cómo gestionar conexiones de base de datos a gran escala con Connection Poolers como PgBouncer (Session vs Transaction Pooling)?
- **Nivel**: Senior / Infrastructure
- **Respuesta Técnica**:
  En PostgreSQL, cada conexión de cliente lanza un proceso independiente en el sistema operativo Linux que consume entre 5MB y 10MB de memoria RAM y genera sobrecarga de cambio de contexto en el kernel. Tener más de 500-1000 conexiones directas degrada severamente el CPU.
  **PgBouncer** actúa como un proxy ligero intermediario que mantiene abierto un pool pequeño y eficiente de conexiones reales hacia Postgres (ej. 50 conexiones):
  - **Session Pooling**: La conexión del pool se asigna al cliente durante toda su sesión hasta que se desconecta (soporta sentencias preparadas y variables de sesión).
  - **Transaction Pooling (Recomendado para APIs REST/Microservicios)**:
    - La conexión física hacia Postgres se asigna al cliente **únicamente durante la ejecución de una transacción (`BEGIN ... COMMIT`)**.
    - Tan pronto como la transacción termina, la conexión física se devuelve inmediatamente al pool para que otra petición HTTP la use.
    - Permite que 10,000 clientes concurrentes sean atendidos fluidamente por solo 50 conexiones de base de datos.
    - *Restricción*: Prohíbe el uso de `SET SESSION`, `LISTEN/NOTIFY` o sentencias preparadas a nivel de sesión sin flags especiales.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Levantar 100 pods de Kubernetes cada uno con un pool local de 50 conexiones hacia PostgreSQL saturando el servidor con 5,000 conexiones directas.
  - 🟢 *Green Flag*: Coloca PgBouncer en modo Transaction Pooling centralizado y sintoniza los límites con la cantidad de núcleos de CPU de la base de datos.

---

### 60. ¿Cómo implementar Foreign Data Wrappers (FDW) en PostgreSQL para consultar bases de datos remotas como tablas locales?
- **Nivel**: Senior
- **Respuesta Técnica**:
  La extensión **`postgres_fdw`** (conforme al estándar SQL/MED - Management of External Data) permite consultar tablas de otras instancias remotas de PostgreSQL directamente desde consultas SQL locales:
  ```sql
  CREATE EXTENSION postgres_fdw;

  -- Definir servidor remoto
  CREATE SERVER billing_server
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host 'billing-db.internal', dbname 'billing_prod', port '5432');

  -- Mapear usuario local con credenciales remotas
  CREATE USER MAPPING FOR current_user
    SERVER billing_server
    OPTIONS (user 'readonly_user', password 'SecretPass123');

  -- Importar esquema remoto
  IMPORT FOREIGN SCHEMA public FROM SERVER billing_server INTO remote_billing;

  -- Ejecutar consulta con JOIN entre la base de datos local y la remota
  SELECT u.name, b.invoice_total
  FROM local_users u
  JOIN remote_billing.invoices b ON u.id = b.user_id
  WHERE b.status = 'PAID';
  ```
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Sincronizar tablas completas mediante cron jobs caseros cuando una consulta federada ligera con FDW resuelve la necesidad sin duplicar datos.
  - 🟢 *Green Flag*: Advierte sobre el impacto en el optimizador de consultas y utiliza empuje de predicados (*Predicate Pushdown*) en FDW.

---

## 6. Sistemas NoSQL, Modelos Distribuidos y Consistencia

### 61. ¿Cómo funciona el teorema PACELC como extensión del teorema CAP ante la ausencia de particiones de red?
- **Nivel**: Staff Engineer / Distributed Systems
- **Respuesta Técnica**:
  El Teorema CAP es incompleto porque solo describe qué ocurre cuando **existe una partición de red (P)** (elegir entre Disponibilidad o Consistencia). Sin embargo, en el 99.9% del tiempo, las redes operan con normalidad sin particiones activas.
  El teorema **PACELC** (formulado por Daniel Abadi) completa la ecuación:
  - **Si hay Partición (P)**: ¿Eliges Disponibilidad (**A**) o Consistencia (**C**)?
  - **ELSE (E)** (En funcionamiento normal sin particiones): ¿Prefieres baja Latencia (**L**) o estricta Consistencia (**C**)?
  *Clasificación de Sistemas Reales*:
  - **PC/EC (Consistencia Extrema)**: PostgreSQL, CockroachDB, Spanner. Ante partición eligen consistencia; sin partición pagan penalización de latencia para garantizar que todas las lecturas sean estrictamente consistentes.
  - **PA/EL (Baja Latencia y Disponibilidad)**: DynamoDB, Cassandra. Ante partición se mantienen disponibles; en operación normal responden con latencias sub-milisegundo sacrificando consistencia inmediata (consistencia eventual).
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Limitar el análisis arquitectónico al teorema CAP tradicional sin considerar el compromiso entre latencia y consistencia en operación normal.
  - 🟢 *Green Flag*: Explica cómo DynamoDB permite sintonizar PACELC mediante el flag `ConsistentRead: true` en cada consulta individual.

---

### 62. ¿Cómo funciona DynamoDB con Partition Keys compuestas con Sort Keys y Global Secondary Indexes (GSI)?
- **Nivel**: Senior / NoSQL Architecture
- **Respuesta Técnica**:
  DynamoDB es una base de datos distribuida totalmente gestionada con escalado horizontal transparente:
  - **Partition Key (PK / Hash Key)**: Determina en qué partición física de almacenamiento se guardan los datos mediante un hash MD5 interno.
  - **Sort Key (SK / Range Key)**: Permite ordenar los elementos físicamente dentro de la misma partición, permitiendo consultas por rango (`BEGINS_WITH`, `BETWEEN`, `>`).
  - **Patrón Single Table Design**: Modelar múltiples entidades de negocio (Usuarios, Pedidos, Productos) en una única tabla usando prefijos en PK y SK:
    - `PK = USER#123`, `SK = PROFILE`
    - `PK = USER#123`, `SK = ORDER#987`
  - **GSI (Global Secondary Index)**: Proyecta una nueva partición con diferente PK y SK para habilitar patrones de acceso alternativos (ej. buscar pedidos por fecha o por estado) de forma asíncrona.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Diseñar tablas de DynamoDB como si fueran tablas relacionales creando 20 tablas separadas y haciendo JOINs en la aplicación.
  - 🟢 *Green Flag*: Domina el diseño de tabla única (*Single-Table Design*) optimizando los patrones de acceso para lecturas eficientes en tiempo $O(1)$.

---

### 63. ¿Qué son los CRDTs (Conflict-free Replicated Data Types) y cómo permiten sincronización de datos con convergencia matemática?
- **Nivel**: Staff Engineer / Distributed Algorithms
- **Respuesta Técnica**:
  En sistemas distribuidos desconectados (ej. aplicaciones colaborativas tipo Google Docs, Notion o bases de datos multi-región), múltiples nodos mutan el mismo documento concurrentemente sin un nodo maestro central.
  Un **CRDT** es una estructura de datos diseñada con propiedades matemáticas (conmutatividad, asociatividad e idempotencia en una estructura de semirretículo):
  - **G-Counter (Grow-Only Counter)**: Solo permite incrementos. Cada nodo mantiene un vector de contadores locales; el total es la suma de los máximos de cada nodo.
  - **PN-Counter (Positive-Negative Counter)**: Dos G-Counters combinados para permitir sumas y restas.
  - **LWW-Element-Set (Last-Write-Wins)**: Resuelve conflictos de adición/eliminación utilizando marcas de tiempo de reloj monótono.
  *Garantía de Convergencia*: Los nodos pueden intercambiar actualizaciones en cualquier orden y en cualquier momento; matemáticamente el estado convergerá al mismo resultado idéntico en todos los nodos sin bloqueos ni transacciones 2PC.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Resolver conflictos de datos en sistemas distribuidos simplemente sobreescribiendo el registro con la hora local de cada máquina (*NTP clock drift* corrompe datos).
  - 🟢 *Green Flag*: Explica la diferencia entre State-based (CvRDT) y Operation-based (CmRDT) CRDTs.

---

### 64. ¿Cómo funciona el almacenamiento de datos orientado a columnas (*Columnar Storage* tipo ClickHouse o Redshift) para analítica OLAP?
- **Nivel**: Senior / Data Systems
- **Respuesta Técnica**:
  - **Bases de Datos Tradicionales por Filas (OLTP: Postgres, MySQL)**:
    - Almacenan todos los datos de una fila juntos en disco: `[ID, Nombre, Email, Edad, Dirección]`.
    - Óptimo para transacciones donde se lee o actualiza un registro completo por ID.
    - Pésimo para analítica: Para calcular el promedio de edad sobre 100 millones de usuarios (`SELECT AVG(edad) FROM users`), debe leer de disco los gigabytes enteros de nombres, emails y direcciones.
  - **Bases de Datos Orientadas a Columnas (OLAP: ClickHouse, DuckDB, Parquet)**:
    - Almacenan todos los valores de la misma columna contiguos en disco: `[Edad1, Edad2, Edad3...]`.
    - Solo lee del disco la columna `edad`, ignorando el resto del archivo.
    - **Compresión Extrema**: Como todos los valores de una columna son del mismo tipo (ej. enteros), algoritmos como Delta-encoding o Run-Length Encoding reducen el tamaño en disco hasta en un 90%.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Ejecutar consultas analíticas masivas de reportería con agregaciones sobre el cluster relacional transaccional OLTP de producción.
  - 🟢 *Green Flag*: Propone arquitecturas híbridas replicando eventos hacia ClickHouse o DuckDB para analítica en tiempo real.

---

### 65. ¿Cómo funciona Cassandra con hashing consistente (Consistent Hashing Ring) y factor de replicación?
- **Nivel**: Senior / Distributed Architecture
- **Respuesta Técnica**:
  Apache Cassandra organiza sus nodos en un **Anillo Lógico (Ring)** utilizando un algoritmo de Hashing Consistente (ej. Murmur3):
  1. El rango de enteros del hash (de $-2^{63}$ a $2^{63}-1$) se mapea sobre el anillo.
  2. Cada nodo físico es responsable de un conjunto de segmentos del anillo mediante tokens virtuales (*vnodes*).
  3. Al insertar una fila, se calcula el hash de su Partition Key; el dato se almacena en el primer nodo cuyo token sea mayor o igual al hash.
  4. **Factor de Replicación (RF = 3)**: Los datos se replican automáticamente en los 2 nodos siguientes en sentido horario en el anillo, asegurando que si un nodo físico se apaga, los datos siguen accesibles sin rebalanceo de todo el clúster.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Creer que añadir un nodo a Cassandra requiere recalcular el hash de todos los datos existentes como en una función módulo (`hash % N`).
  - 🟢 *Green Flag*: Explica cómo el Hashing Consistente permite añadir o retirar nodos moviendo únicamente un subconjunto mínimo de particiones ($K/N$).

---

### 66. ¿Qué es el nivel de consistencia configurable en NoSQL (`QUORUM`, `ONE`, `ALL`) y cómo se cumple la fórmula $R + W > N$?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  En bases de datos con consistencia configurable (Cassandra, DynamoDB):
  Sea $N$ el Factor de Replicación (ej. $N = 3$), $W$ el número de nodos que deben confirmar la escritura, y $R$ el número de nodos consultados en la lectura:
  - **Fórmula de Consistencia Fuerte**:
    $$R + W > N$$
    Si la suma de nodos de lectura y escritura es estrictamente mayor que el número total de réplicas, se garantiza que **al menos un nodo de la lectura contiene la versión más reciente del dato escrito**.
  - **Ejemplo Típico**: Con $N=3$, configurando $W = \text{QUORUM} (2)$ y $R = \text{QUORUM} (2)$:
    $$2 + 2 = 4 > 3$$
    El sistema tolera la caída completa de 1 nodo garantizando consistencia estricta (*Strong Consistency*).
  - Si configuras $W = 1$ y $R = 1$ ($1 + 1 = 2 < 3$), obtienes máxima velocidad pero consistencia eventual (*Eventual Consistency*).
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Pensar que los sistemas NoSQL son inherentemente inconsistentes y no pueden configurarse para consistencia fuerte.
  - 🟢 *Green Flag*: Calcula quórums matemáticos exactos según los requerimientos de tolerancia a fallos y latencia del negocio.

---

### 67. ¿Cómo mitigar el problema de *Cache Stampede* o *Thundering Herd* usando algoritmos probabilísticos de expiración temprana (XFetch)?
- **Nivel**: Staff Engineer / Caching
- **Respuesta Técnica**:
  Cuando una clave de caché caliente (ej. el catálogo de productos leído por 10,000 RPS) expira en Redis a las 12:00:00:
  Miles de peticiones concurrentes detectan un *Cache Miss* en el mismo microsegundo y bombardean simultáneamente la base de datos primaria para recalcular el valor, provocando la caída del backend (**Cache Stampede / Thundering Herd**).
  **Algoritmo XFetch (Probabilistic Early Expiration)**:
  En lugar de esperar a que la clave expire totalmente, el algoritmo calcula probabilísticamente si un cliente debe recalcular el dato antes de su vencimiento real:
  $$\text{compute} = -\beta \cdot \delta \cdot \ln(\text{rand}()) > \text{TTL}$$
  Donde $\delta$ es el tiempo que tarda la consulta en ejecutarse, $\beta$ es la agresividad ($> 0$), y $\text{rand}()$ es un número aleatorio entre 0 y 1.
  A medida que el TTL se acerca a cero, la probabilidad aumenta: **un único cliente afortunado recalculará el valor en segundo plano antes de que expire**, refrescando la caché de forma invisible sin ningún pico de carga en la base de datos.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Intentar resolver el Cache Stampede únicamente usando bloqueos distribuidos (Distributed Locks) que aumentan la latencia de todos los clientes.
  - 🟢 *Green Flag*: Explica la elegancia matemática de XFetch para refresco proactivo de caché de lectura intensiva.

---

### 68. ¿Cómo funciona la arquitectura de Redis Cluster con 16,384 Hash Slots y cómo gestionar transacciones multi-key con Hash Tags `{user_1}`?
- **Nivel**: Senior
- **Respuesta Técnica**:
  Redis Cluster no utiliza hashing consistente puro; divide el espacio de claves en **16,384 Hash Slots fijos**:
  - Cada nodo maestro del clúster es responsable de un subconjunto de slots (ej. Nodo A: slots 0 a 5500).
  - El slot se calcula como: `CRC16(key) % 16384`.
  - **La Limitación Multi-Key**: Las operaciones transaccionales (`MGET`, `MSET`, transacciones `MULTI/EXEC`, Lua scripts) **solo pueden ejecutarse sobre claves que residan en el mismo nodo físico (mismo Hash Slot)**. Si intentas consultar dos claves en slots diferentes, Redis devuelve el error `CROSSSLOT Keys in request don't hash to the same slot`.
  - **La Solución: Hash Tags**: Forzar a que solo la subcadena entre llaves `{...}` sea tomada en cuenta para el cálculo del hash:
    - `user:{100}:profile`
    - `user:{100}:orders`
    Ambas claves hasharán exactamente al mismo slot porque solo se calcula el CRC16 de `100`, permitiendo operaciones transaccionales atómicas multi-clave.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Intentar ejecutar transacciones sobre claves aleatorias en Redis Cluster sin usar Hash Tags.
  - 🟢 *Green Flag*: Explica cómo los clientes de Redis (ioredis, redis-py) manejan redirecciones `MOVED` y `ASK` ante rebalanceos de slots.

---

### 69. ¿Cómo implementar estructuras de datos probabilísticas en Redis: Bloom Filters, HyperLogLog y Count-Min Sketch?
- **Nivel**: Senior / Staff / Big Data
- **Respuesta Técnica**:
  Permiten responder consultas complejas con memoria constante $O(1)$ despreciable (pocos kilobytes) aceptando un margen de error configurable:
  1. **HyperLogLog (`PFADD`, `PFCOUNT`)**:
     - Estima la **cardinalidad de conjuntos masivos** (ej. contar usuarios únicos diarios entre 100 millones de visitas).
     - Consume un máximo fijo de **12 KB de memoria** independientemente de si cuentas 1,000 o 1,000 millones de elementos, con un error estándar de solo el 0.81%.
  2. **Bloom Filter (`BF.ADD`, `BF.EXISTS`)**:
     - Determina si un elemento es miembro de un conjunto con falsos positivos controlados (ej. 1%), pero **cero falsos negativos**.
     - Caso de uso: Verificar si un nombre de usuario ya está tomado antes de consultar la base de datos de disco.
  3. **Count-Min Sketch**: Estima la frecuencia de eventos (identificar elementos más populares / *Top-K items* en streaming).
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Usar un `Set` de Redis gigante de 50GB para contar usuarios únicos diarios cuando un HyperLogLog de 12KB resuelve el problema.
  - 🟢 *Green Flag*: Conoce la teoría de hashes y bits subyacente y elige estructuras probabilísticas para optimizar memoria en alta concurrencia.

---

### 70. ¿Cómo funciona el Write-Ahead Log (WAL) y cómo garantiza durabilidad ACID ante cortes de energía repentinos?
- **Nivel**: Senior / Systems Internals
- **Respuesta Técnica**:
  Actualizar páginas de tablas e índices directamente en el disco es una operación lenta y aleatoria. Si el servidor se apaga a mitad de camino, los datos en disco quedan corruptos.
  **Principio del WAL (Write-Ahead Logging)**:
  1. Cualquier cambio en la base de datos se escribe primero en un **log secuencial de solo anexado (WAL)** en disco antes de tocar las páginas de datos en memoria.
  2. Escribir secuencialmente al final de un archivo es órdenes de magnitud más rápido que modificar bloques aleatorios de tablas e índices.
  3. Una vez que el WAL se descarga a disco físicamente (`fsync`), la transacción se confirma al cliente como exitosa (**Durabilidad garantizada**).
  4. Las páginas de datos reales se modifican únicamente en la memoria RAM (*Buffer Pool*) y se marcan como *Dirty Pages*.
  5. Periódicamente, un proceso de **Checkpoint** vuelca las páginas sucias de RAM a los archivos de tabla en disco.
  *Recuperación ante Caídas (Crash Recovery)*: Si el servidor sufre un corte de energía, al reiniciar lee el último Checkpoint y re-aplica los cambios del WAL (*REDO*) reconstruyendo el estado exacto sin pérdida de datos.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Creer que una base de datos escribe inmediatamente cada fila en su archivo de tabla final en el momento del commit.
  - 🟢 *Green Flag*: Explica el papel de `fsync`, la compensación de rendimiento con `commit_delay` y el proceso de Checkpoint.

---

## 7. Arquitectura de Mensajería, Brokers y Event-Driven Streaming

### 71. ¿Cuál es la diferencia arquitectónica fundamental entre un Message Queue tradicional (RabbitMQ) y un Event Stream distribuido (Apache Kafka)?
- **Nivel**: Senior / Staff / Architect
- **Respuesta Técnica**:
  - **RabbitMQ (Message Queue Tradicional)**:
    - **Smart Broker, Dumb Consumer**: El broker mantiene el estado de cada mensaje.
    - Cuando un consumidor confirma (`ACK`) un mensaje, **el broker elimina el mensaje de la cola**.
    - La carga de trabajo escala por cola; si múltiples consumidores leen de la misma cola, se reparten los mensajes (modo Round-Robin).
    - Ideal para tareas de trabajo (*Work Queues*), enrutamiento complejo con exchanges y lógica transaccional clásica.
  - **Apache Kafka (Distributed Commit Log)**:
    - **Dumb Broker, Smart Consumer**: El broker es un log secuencial inmutable en disco particionado.
    - Los mensajes **NO se eliminan tras ser leídos**; persisten según políticas de retención temporal (ej. 7 días) o por tamaño.
    - Cada consumidor mantiene su propio puntero de lectura (**Offset**).
    - Permite que múltiples consumidores independientes lean el mismo flujo de eventos a ritmos diferentes o rebobinen al pasado (*Replayability*).
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Intentar usar RabbitMQ como almacenamiento histórico de eventos o usar Kafka para tareas de trabajo con acknowledge individual arbitrario.
  - 🟢 *Green Flag*: Explica cómo el Commit Log inmutable de Kafka permite Event Sourcing y re-procesamiento analítico.

---

### 72. ¿Cómo funciona el particionamiento de tópicos en Apache Kafka y cómo se garantiza el orden estricto de mensajes?
- **Nivel**: Senior
- **Respuesta Técnica**:
  En Kafka, un tópico se divide físicamente en una o más **Particiones**.
  - **Garantía de Orden de Kafka**: Kafka garantiza el orden secuencial estricto de entrega **ÚNICAMENTE dentro de una misma partición**. No existe garantía de orden global entre diferentes particiones.
  - **Estrategia de Particionamiento con Clave (`Record Key`)**:
    - Si el productor publica sin clave, Kafka distribuye los mensajes en Round-Robin entre particiones (máximo paralelismo, pero orden no preservado).
    - Si el productor envía una clave de partición (ej. `userId` o `orderId`):
      `partition = murmur2(key) % total_partitions`.
      Todos los eventos pertenecientes al mismo `orderId` caerán **obligatoriamente en la misma partición**, garantizando que el consumidor procese los eventos de esa orden en el orden cronológico exacto en que ocurrieron.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Afirmar que Kafka garantiza orden total de todos los mensajes de un tópico distribuido en múltiples particiones.
  - 🟢 *Green Flag*: Explica cómo la clave de partición asegura orden local y advierte sobre el desbalanceo si una clave concentra demasiados eventos (*Hot Key*).

---

### 73. ¿Cómo gestiona Kafka los Consumer Groups, el rebalanceo de particiones y el offset commit (manual vs automático)?
- **Nivel**: Senior / Staff
- **Respuesta Técnica**:
  - **Consumer Group**: Conjunto de procesos consumidores que colaboran para leer un tópico. Cada partición se asigna a **exactamente un único consumidor** dentro del grupo.
    - Si un tópico tiene 6 particiones y el grupo tiene 3 consumidores, cada uno atiende 2 particiones.
    - Si el grupo tiene 10 consumidores, 4 quedarán inactivos (el número de particiones es el límite máximo de paralelismo).
  - **Rebalanceo de Particiones**: Si un consumidor muere o se agrega uno nuevo, el Group Coordinator reasigna las particiones entre los miembros activos.
  - **Offset Commit**:
    - **Automático (`enable.auto.commit = true`)**: Confirma offsets periódicamente (ej. cada 5s). Peligro: si el proceso crashea después de confirmar pero antes de terminar de procesar, se pierden mensajes.
    - **Manual (`commitSync` / `commitAsync`))**: El consumidor confirma el offset únicamente **tras procesar exitosamente la lógica de negocio y persistir en la base de datos**, garantizando semántica *At-Least-Once*.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Dejar `enable.auto.commit = true` en aplicaciones financieras o de inventario crítico.
  - 🟢 *Green Flag*: Utiliza commits manuales asíncronos y gestiona excepciones en listeners de rebalanceo (*ConsumerRebalanceListener*).

---

### 74. ¿Cómo implementar procesamiento de eventos exactamente una vez (*Exactly-Once Semantics - EOS*) en Kafka?
- **Nivel**: Staff Engineer / Distributed Systems
- **Respuesta Técnica**:
  La semántica *Exactly-Once* en sistemas distribuidos no significa que los fallos de red nunca ocurran; significa que **el efecto colateral final en el sistema es exactamente como si el mensaje se hubiera procesado una sola vez**.
  *Los 3 Componentes de EOS en Kafka*:
  1. **Idempotent Producer (`enable.idempotence = true`)**: El broker asigna a cada productor un Producer ID (PID) y un número de secuencia monótono por mensaje. Si un reintento de red reenvía un mensaje duplicado, el broker de Kafka lo detecta y lo descarta silenciosamente.
  2. **Transacciones en Kafka (`transactional.id`)**: Permite que un productor escriba atómicamente a múltiples tópicos y confirme offsets de lectura en una única transacción de dos fases coordinada por el Transaction Coordinator de Kafka.
  3. **Consumidores con Aislamiento (`isolation.level = read_committed`)**: Los consumidores ignoran mensajes de transacciones abortadas.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Creer que activar EOS en Kafka protege contra duplicados si la base de datos externa no tiene control de idempotencia propio.
  - 🟢 *Green Flag*: Combina las transacciones de Kafka con claves de deduplicación en la base de datos relacional consumidora.

---

### 75. ¿Cómo funciona RabbitMQ con sus tipos de exchanges: Direct, Topic, Fanout y Headers?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  En RabbitMQ, los productores nunca envían mensajes directamente a las colas; envían a un **Exchange**, que enruta el mensaje a una o más colas según enlaces (*Bindings*) y la clave de enrutamiento (*Routing Key*):
  1. **Direct Exchange**: Enrutamiento por coincidencia exacta de la routing key (ej. binding `error` solo recibe mensajes con clave `error`).
  2. **Topic Exchange**: Enrutamiento por patrones con comodines:
     - `*` reemplaza exactamente una palabra (`orders.*.created` coincide con `orders.eu.created`).
     - `#` reemplaza cero o más palabras (`audit.#` coincide con cualquier evento de auditoría).
  3. **Fanout Exchange**: Enrutamiento de difusión total (Broadcast). Ignora la routing key y copia el mensaje a **todas** las colas enlazadas (ideal para notificaciones masivas).
  4. **Headers Exchange**: Enruta basándose en atributos de la cabecera del mensaje en lugar de la routing key.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Usar Fanout para flujos punto a punto o Direct cuando se necesita filtrado por múltiples dimensiones.
  - 🟢 *Green Flag*: Diseña una jerarquía de tópicos con comodines (`domain.entity.action`) para permitir enrutamiento extensible.

---

### 76. ¿Cómo implementar colas de mensajes demorados (*Delayed Message Queues*) y reintentos escalonados con DLX en RabbitMQ?
- **Nivel**: Senior
- **Respuesta Técnica**:
  RabbitMQ no tiene soporte de delay nativo en el core tradicional sin plugins.
  *Arquitectura de Reintentos Escalonados sin Plugins (Dead Letter Exchange + TTL)*:
  1. Se definen colas intermedias de espera con TTL:
     - `retry-5s-queue` con `x-message-ttl: 5000` y `x-dead-letter-exchange: main-exchange`.
     - `retry-30s-queue` con `x-message-ttl: 30000` y `x-dead-letter-exchange: main-exchange`.
  2. Cuando el consumidor falla al procesar un mensaje:
     - Inspecciona la cabecera de intentos (`x-delivery-count`).
     - Rechaza el mensaje sin requeue (`basic.reject(requeue=false)`) enviándolo a la cola de delay correspondiente según el intento.
     - El mensaje permanece en la cola de delay sin ningún consumidor escuchándola.
     - Al expirar el TTL, RabbitMQ lo expulsa automáticamente hacia el Dead Letter Exchange, que lo reenvía de vuelta a la cola de procesamiento principal.
  3. Si supera el límite máximo de intentos (ej. 5), se envía a la cola final de **Dead Letter Queue (DLQ)** para auditoría manual.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Reencolar mensajes fallidos con `basic.nack(requeue=true)` inmediatamente, generando un bucle infinito que satura el CPU al 100%.
  - 🟢 *Green Flag*: Diseña un flujo de retroceso exponencial utilizando DLX y TTL para no bloquear el procesamiento de mensajes nuevos.

---

### 77. ¿Cómo funciona la arquitectura de Event Sourcing combinada con Snapshots periódicos para acelerar la reconstrucción de entidades?
- **Nivel**: Senior / Staff / Architecture
- **Respuesta Técnica**:
  En **Event Sourcing**, para obtener el estado actual de una cuenta bancaria, se deben leer y reproducir todos sus eventos desde el día de su apertura.
  - **El Problema del Replay**: Si una cuenta tiene 500,000 transacciones, reconstruir la entidad en memoria requiere leer 500,000 registros de base de datos, tardando varios segundos por petición.
  - **La Solución: Snapshots Periódicos**:
    - Cada N eventos (ej. cada 100 eventos), un proceso guarda una foto del estado actual consolidado en una tabla `snapshots`:
      `{ accountId: 'acc-1', version: 1000, balance: 4500.50 }`.
    - Al cargar la cuenta:
      1. Se lee el snapshot más reciente (versión 1000).
      2. Solo se consultan y reproducen los eventos con versión $> 1000$ (ej. 15 eventos).
      3. La entidad se reconstruye en menos de 2 milisegundos con rendimiento $O(1)$.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Reproducir la historia completa de eventos en cada petición de lectura sin snapshots.
  - 🟢 *Green Flag*: Explica cómo los snapshots optimizan el arranque de agregados preservando la inmutabilidad del log histórico de eventos.

---

### 78. ¿Cómo diseñar contratos de eventos desacoplados usando Protocol Buffers o Apache Avro con Schema Registry?
- **Nivel**: Staff Engineer / Governance
- **Respuesta Técnica**:
  Compartir clases de TypeScript o Java entre microservicios para definir eventos crea un acoplamiento rígido de código fuente.
  *Arquitectura con Apache Avro / Protobuf y Confluent Schema Registry*:
  1. El contrato del evento se define en un archivo estandarizado independiente del lenguaje (`.avsc` o `.proto`):
     ```json
     {
       "type": "record",
       "name": "OrderPlaced",
       "fields": [
         { "name": "orderId", "type": "string" },
         { "name": "amount", "type": "double" },
         { "name": "currency", "type": "string", "default": "USD" }
       ]
     }
     ```
  2. El Schema Registry almacena las versiones de los esquemas y asigna un ID numérico global.
  3. El productor serializa los datos en binario compacto y antepone el Schema ID de 4 bytes.
  4. Si un desarrollador intenta publicar un cambio incompatible hacia atrás (ej. cambiar `orderId` de string a int), el Schema Registry **rechaza la publicación en el pipeline de CI/CD**, garantizando que los consumidores nunca crasheen en producción.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Enviar payloads JSON gigantescos sin esquema ni validación de compatibilidad hacia atrás en microservicios a gran escala.
  - 🟢 *Green Flag*: Implementa reglas de compatibilidad de esquemas (`BACKWARD`, `FULL`) gestionadas por un Schema Registry centralizado.

---

### 79. ¿Cómo gestionar el escalado de consumidores de eventos y evitar el cuello de botella por lag en colas de mensajes?
- **Nivel**: Senior / SRE
- **Respuesta Técnica**:
  El **Consumer Lag** es la diferencia entre el último mensaje producido en el tópico y el último mensaje procesado por el grupo consumidor. Si el lag crece continuamente, los usuarios experimentan retrasos inaceptables.
  *Estrategias de Mitigación*:
  1. **Aumentar el Paralelismo**: Escalar horizontalmente los pods consumidores (hasta el número máximo de particiones del tópico en Kafka).
  2. **Procesamiento Concurrente Interno en el Consumidor**:
     Si el consumidor está atado a I/O externa (llamadas HTTP lentas a pasarelas de pago), un solo hilo procesa lentamente. Se puede despachar el trabajo a un pool de workers interno agrupando por clave de partición para no romper el orden de la misma entidad.
  3. **Batch Processing**: Leer mensajes en bloques (`max.poll.records = 500`) e insertarlos en la base de datos mediante `INSERT INTO ... VALUES (...), (...)` masivos en lugar de 500 inserts individuales.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Aumentar el número de pods de consumidores por encima del número de particiones de Kafka (los pods sobrantes quedan 100% inactivos).
  - 🟢 *Green Flag*: Monitorea el lag con Prometheus/Burrow y escala automáticamente con KEDA (Kubernetes Event-driven Autoscaling) basado en la métrica de lag.

---

### 80. ¿Cómo implementar un Change Data Capture (CDC) de base de datos a Kafka en tiempo real utilizando Debezium?
- **Nivel**: Staff Engineer / Data Architecture
- **Respuesta Técnica**:
  Consultar periódicamente la base de datos con un cron `SELECT * FROM users WHERE updated_at > :last` satura la base de datos y no detecta eliminaciones físicas (`DELETE`).
  **Debezium (Change Data Capture)**:
  - Se conecta directamente como un cliente de replicación al **Write-Ahead Log (WAL en Postgres o Binlog en MySQL)**.
  - Lee los cambios a nivel de bytes en tiempo real con latencia sub-segundo sin ejecutar consultas SQL sobre las tablas de producción.
  - Publica cada inserción, actualización y eliminación como un evento enriquecido en un tópico de Kafka:
    ```json
    {
      "before": { "id": 1, "status": "PENDING" },
      "after": { "id": 1, "status": "COMPLETED" },
      "op": "u",
      "ts_ms": 1716300000000
    }
    ```
  Permite replicar datos a Elasticsearch, caches de Redis o data warehouses sin tocar el código de la aplicación.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Proponer polling recurrente contra la base de datos transaccional primaria para sincronizar motores de búsqueda.
  - 🟢 *Green Flag*: Utiliza Debezium con Kafka Connect para streaming de cambios basado en el log de replicación del motor relacional.

---

## 8. Patrones de Resiliencia, Concurrencia y Gobernanza

### 81. ¿Cómo funciona el protocolo Two-Phase Commit (2PC) y por qué se desaconseja en arquitecturas modernas de microservicios?
- **Nivel**: Staff Engineer / Distributed Systems
- **Respuesta Técnica**:
  **Two-Phase Commit (2PC)** es un protocolo de consenso atómico coordinado por un nodo central (*Transaction Coordinator*):
  1. **Fase 1 (Prepare)**: El coordinador pregunta a todos los nodos participantes si están listos para confirmar. Los participantes bloquean los registros localmente y responden `VOTE_COMMIT` o `VOTE_ABORT`.
  2. **Fase 2 (Commit)**: Si todos votaron sí, el coordinador envía la orden de `COMMIT`. Si alguno votó no, envía `ROLLBACK`.
  *Por qué es un antipatrón en microservicios*:
  - **Bloqueante y Frágil**: Si el coordinador muere durante la fase 2, los participantes mantienen los recursos y bloqueos de base de datos congelados indefinidamente.
  - **Latencia Destructiva**: La velocidad de la transacción global queda limitada por el participante más lento a través de la red física.
  - Viola la autonomía de microservicios. En su lugar, la industria utiliza el **Patrón Saga** con consistencia eventual.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Intentar orquestar transacciones distribuidas en la nube utilizando coordinadores XA / 2PC.
  - 🟢 *Green Flag*: Explica la degradación de disponibilidad del 2PC conforme aumenta el número de nodos participantes.

---

### 82. ¿Cómo diseñar Sagas coreografiadas vs Sagas orquestadas con compensaciones automáticas ante fallos?
- **Nivel**: Senior / Staff / Architect
- **Respuesta Técnica**:
  - **Saga Coreografiada (Descentralizada)**:
    - Cada microservicio publica un evento de dominio al completar su transacción local. Otros servicios escuchan y actúan.
    - *Ventaja*: Simple para flujos de 2 a 4 pasos.
    - *Desventaja*: Difícil de rastrear y depurar; riesgo de ciclos de eventos descontrolados.
  - **Saga Orquestada (Centralizada)**:
    - Un **Orquestador de Saga** (ej. máquina de estados con Temporal.io o servicio dedicado) indica explícitamente a cada microservicio qué comando ejecutar.
    - Si el paso 3 (Cobro) falla, el orquestador ejecuta en orden inverso los comandos de compensación: invoca `ReleaseInventoryCommand` en el microservicio de inventario y `CancelOrderCommand` en el de órdenes.
    - *Ventaja*: Visibilidad centralizada del estado del flujo de negocio y manejo determinista de fallos.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Pensar que las transacciones compensatorias en Sagas pueden revertir mágicamente efectos colaterales ya observados por usuarios (ej. un email de confirmación ya enviado).
  - 🟢 *Green Flag*: Diseña compensaciones semánticas que dejan constancia del reembolso o cancelación en lugar de borrados físicos.

---

### 83. ¿Cómo mitigar ataques de denegación de servicio con algoritmos Token Bucket y Leaky Bucket?
- **Nivel**: Senior / Security
- **Respuesta Técnica**:
  - **Token Bucket**:
    - Un cubo acumula tokens a una tasa constante de recarga (ej. 10 tokens/segundo) hasta una capacidad máxima (ej. 50 tokens).
    - Cada petición entrante consume 1 token. Si hay tokens en el cubo, la petición pasa inmediatamente.
    - **Permite ráfagas cortas de tráfico (*Traffic Bursts*)**: un cliente inactivo puede consumir sus 50 tokens de golpe si los acumuló.
  - **Leaky Bucket (Cubo Perforado)**:
    - Las peticiones entran a una cola de capacidad fija y salen procesadas a una **tasa constante e inmutable** (como agua goteando por el fondo de un cubo perforado).
    - Si la cola se llena, las nuevas peticiones se descartan (`HTTP 429`).
    - **Suaviza el tráfico eliminando las ráfagas**: ideal para proteger servicios downstream delicados que no toleran picos repentinos.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Implementar rate limiters basados en ventanas fijas (`Fixed Window`) que permiten el doble de la cuota en el límite de la ventana.
  - 🟢 *Green Flag*: Selecciona Token Bucket para APIs públicas elásticas y Leaky Bucket para protección de sistemas de base de datos legacy.

---

### 84. ¿Cómo implementar el patrón Bulkhead para aislar recursos y prevenir fallos en cascada?
- **Nivel**: Senior / Resilience
- **Respuesta Técnica**:
  El término proviene de los mamparos estancos de los barcos: si el casco se rompe en una sección, el agua se contiene en ese compartimento sin hundir el barco completo.
  En sistemas backend:
  - Si un servicio dedica un único pool de 100 hilos HTTP a todas sus operaciones, y un servicio secundario de envío de SMS tarda 30 segundos en responder, todos los 100 hilos quedarán bloqueados esperando los SMS.
  - Los usuarios que solo quieran consultar su saldo bancario (que tarda 5ms) no encontrarán hilos disponibles, provocando la caída completa del sistema (*Cascading Failure*).
  - **Implementación del Bulkhead**:
    - Dividir los pools de hilos o conexiones: asignar 80 conexiones para transacciones bancarias críticas y un pool aislado de máximo 10 conexiones para SMS.
    - Si el proveedor de SMS colapsa, solo afectará a su propio compartimento estanco; el core del negocio seguirá operando al 100%.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Permitir que llamadas a dependencias secundarias o no esenciales compartan los mismos pools de hilos que las operaciones críticas.
  - 🟢 *Green Flag*: Configura límites de concurrencia y pools de conexiones dedicados por servicio downstream.

---

### 85. ¿Cómo funciona un Reverse Proxy de alto rendimiento (Envoy / Nginx) gestionando terminación TLS y HTTP/2 to HTTP/1.1?
- **Nivel**: Senior / Infrastructure
- **Respuesta Técnica**:
  Un Reverse Proxy se sitúa en la frontera de la red para optimizar el tráfico antes de entregarlo a los servicios backend:
  1. **Terminación TLS**: Asume el cómputo criptográfico intensivo de los certificados SSL/TLS y el handshake con los clientes públicos. La comunicación interna en la red privada hacia los pods se realiza en HTTP plano o mTLS optimizado.
  2. **Traducción de Protocolos (Protocol Downgrade/Upgrade)**: Acepta conexiones HTTP/2 o HTTP/3 multiplexadas desde los navegadores de internet y las traduce a conexiones HTTP/1.1 con Keep-Alive reutilizables hacia los microservicios backend de Node.js, Python o PHP.
  3. **Descarga de Tareas Comunes**: Compresión gzip/brotli, validación de cabeceras, rate limiting perimetral y almacenamiento en caché de activos estáticos.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Cargar los certificados SSL y hacer terminación TLS directamente dentro del proceso de Node.js en arquitecturas de contenedores masivas.
  - 🟢 *Green Flag*: Recomienda descargar la terminación TLS y compresión en Envoy/Nginx para liberar ciclos de CPU en los runtimes de aplicación.

---

### 86. ¿Cómo gestionar la migración de esquemas de bases de datos sin tiempo de inactividad utilizando el patrón Expand and Contract?
- **Nivel**: Senior / DevOps / Database
- **Respuesta Técnica**:
  El patrón **Expand and Contract (Parallel Run)** permite modificar la estructura de la base de datos sin requerir ventanas de mantenimiento nocturnas ni caídas de servicio:
  - **Fase 1: Expandir (Expand)**:
    - Se añade la nueva columna o tabla en la base de datos sin eliminar la antigua (ej. añadir `full_name` mientras `first_name` y `last_name` siguen existiendo).
    - La versión vieja de la aplicación (v1) sigue leyendo y escribiendo en las columnas viejas.
    - Un trigger o la versión nueva (v2) escribe simultáneamente en ambos formatos (*Dual Writing*).
  - **Fase 2: Migrar Datos**: Un script en segundo plano copia los datos históricos hacia la nueva estructura en lotes pequeños.
  - **Fase 3: Transición**: La versión v2 de la aplicación se despliega completamente; ahora lee y escribe exclusivamente de la nueva columna.
  - **Fase 4: Contraer (Contract)**: Una vez verificado que ninguna instancia de la versión v1 está corriendo, se eliminan las columnas viejas y los triggers con un simple `DROP COLUMN`.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Ejecutar migraciones destructivas (`DROP COLUMN` o renombrar columnas) en el mismo despliegue en que se actualiza el código fuente.
  - 🟢 *Green Flag*: Diseña migraciones hacia adelante y hacia atrás compatibles con despliegues Rolling Update y Canary.

---

### 87. ¿Cómo implementar autenticación inter-servicio Zero-Trust usando mTLS (Mutual TLS) y SPIFFE/SPIRE?
- **Nivel**: Staff Engineer / Security
- **Respuesta Técnica**:
  En el modelo perimetral tradicional, todo lo que reside dentro de la red privada se considera "confiable". En el modelo **Zero-Trust**, ningún microservicio confía en otro por el simple hecho de estar en la misma subred.
  - **mTLS (Mutual TLS)**: No solo el cliente valida el certificado del servidor; el servidor también exige y valida el certificado criptográfico del cliente entrante, cifrando el tráfico y verificando la identidad en ambas direcciones.
  - **SPIFFE / SPIRE**:
    - **SPIFFE (Standard)**: Define un formato estándar de identidad de cargas de trabajo: `spiffe://empresa.com/ns/prod/sa/order-service`.
    - **SPIRE (Implementación)**: Un agente emite certificados X.509 de corta duración (ej. 1 hora) y los rota automáticamente en los pods sin intervención manual.
    - Service Meshes como Istio o Linkerd utilizan mTLS basado en SPIFFE para garantizar cifrado de extremo a extremo y control de acceso estricto entre pods en Kubernetes.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Confiar ciegamente en la dirección IP interna como único mecanismo de seguridad entre microservicios.
  - 🟢 *Green Flag*: Explica cómo mTLS previene ataques de Man-in-the-Middle y spoofing de servicios dentro de la red del clúster.

---

### 88. ¿Cómo funciona la arquitectura Backend-For-Frontend (BFF) y cuándo adoptarla frente a un API Gateway monolítico?
- **Nivel**: Senior / Architect
- **Respuesta Técnica**:
  En lugar de un único API Gateway monolítico que intenta servir a clientes móviles, aplicaciones web SPA y dispositivos IoT:
  - **El Problema del Gateway Compartido**: La aplicación móvil requiere payloads JSON diminutos optimizados para 4G y datos agregados en 1 sola llamada; la aplicación web de escritorio requiere datos enriquecidos y streaming; el equipo móvil bloquea despliegues del equipo web al modificar el mismo gateway compartido.
  - **Patrón Backend-For-Frontend (BFF)**:
    - Se crea un servicio backend ligero dedicado para cada tipo de interfaz de usuario: `Mobile-BFF`, `Web-BFF`, `Partner-BFF`.
    - Cada BFF es mantenido por el mismo equipo responsable del frontend correspondiente.
    - El BFF traduce, formatea y agrega las llamadas hacia los microservicios de dominio internos, reduciendo el consumo de batería y datos en clientes móviles.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Crear BFFs que contengan reglas de negocio pesadas o persistencia de base de datos propia (los BFFs deben ser capas de adaptación y agregación delgadas).
  - 🟢 *Green Flag*: Identifica la necesidad de BFF cuando los requerimientos de consumo de red y formatos de UI divergen entre plataformas.

---

### 89. ¿Cómo diseñar APIs de alta disponibilidad multi-región con base de datos activa-activa (*Multi-Region Active-Active*)?
- **Nivel**: Staff / Principal Architect
- **Respuesta Técnica**:
  Para tolerar la caída catastrófica de un centro de datos regional completo (ej. AWS us-east-1) con RTO cercano a 0:
  1. **Enrutamiento DNS Global (Latency / Geolocation Routing)**: Route 53 o Cloudflare dirige a los usuarios a la región más cercana.
  2. **Persistencia Activa-Activa**:
     - Ambas regiones procesan lecturas y escrituras simultáneamente.
     - Requiere bases de datos con soporte de replicación global multi-master (Amazon DynamoDB Global Tables, CockroachDB, o Google Cloud Spanner).
  3. **Resolución de Conflictos de Escritura Concurrentes**:
     - *Last-Write-Wins (LWW)*: Basado en estampas temporales sincronizadas con relojes atómicos (TrueTime de Google Spanner) o relojes lógicos híbridos (HLC).
     - *Particionamiento Geográfico*: Asignar la propiedad de escritura de cada usuario a su región primaria (*Home Region*).
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Asumir que se puede implementar base de datos relacional clásica activa-activa sobre continentes sin pagar una penalización de latencia de red gobernada por la velocidad de la luz.
  - 🟢 *Green Flag*: Cita los compromisos del teorema CAP/PACELC y utiliza Relojes Lógicos Híbridos (HLC) o TrueTime para ordenar eventos globales.

---

### 90. ¿Cómo implementar auditoría inmutable de transacciones financieras utilizando tablas Append-Only criptográficamente encadenadas?
- **Nivel**: Staff Engineer / Security
- **Respuesta Técnica**:
  En sistemas bancarios o de contabilidad, las mutaciones de datos nunca deben realizarse mediante `UPDATE` o `DELETE`.
  *Arquitectura de Ledger Append-Only*:
  1. La tabla solo admite inserciones (`INSERT`). Los permisos de `UPDATE` y `DELETE` se revocan a nivel de usuario de base de datos.
  2. Cada nueva entrada incluye un **Hash Criptográfico encadenado** que calcula el SHA-256 del contenido actual concatenado con el hash del registro anterior (*Hash Chain* similar a una cadena de bloques):
     $$\text{Hash}_n = \text{SHA256}(\text{Data}_n + \text{Hash}_{n-1})$$
  3. Si un administrador malicioso con acceso root a la base de datos modifica una fila histórica para alterar un monto financiero, toda la cadena criptográfica subsiguiente queda invalidada, permitiendo detectar la manipulación en auditorías automáticas inmediatas.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Permitir actualizaciones directas de saldos en tablas sin un registro de auditoría de transacciones inmutable.
  - 🟢 *Green Flag*: Explica cómo el encadenamiento de hashes garantiza integridad matemática demostrable ante reguladores externos.

---

## 9. Seguridad de APIs, Protocolos y Estándares Empresariales

### 91. ¿Cómo implementar autenticación OAuth 2.1 con Proof Key for Code Exchange (PKCE) para clientes públicos y SPAs?
- **Nivel**: Senior / Security
- **Respuesta Técnica**:
  En OAuth 2.0 tradicional, los clientes utilizaban el flujo implícito (*Implicit Flow*) que devolvía el token en la URL, o el flujo de código con un `client_secret` que las aplicaciones móviles o SPAs no podían proteger.
  **OAuth 2.1 y PKCE (RFC 7636)** elimina el flujo implícito y hace PKCE obligatorio para todos los clientes:
  1. El cliente genera un secreto aleatorio: **`code_verifier`** (43-128 caracteres).
  2. El cliente calcula el hash SHA-256: **`code_challenge = base64url(sha256(code_verifier))`**.
  3. Al solicitar autorización, envía el `code_challenge`. El servidor de autorización guarda este hash y emite el código de autorización.
  4. Al intercambiar el código por el token, el cliente envía el **`code_verifier`** en texto plano.
  5. El servidor calcula `sha256(code_verifier)` y comprueba que coincida con el `code_challenge` original.
  *Seguridad*: Si un atacante intercepta el código de autorización en el dispositivo, no puede canjearlo porque no posee el `code_verifier` original.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Continuar usando el flujo implícito de OAuth en aplicaciones SPA modernas.
  - 🟢 *Green Flag*: Explica la protección matemática de PKCE contra ataques de interceptación del código de autorización.

---

### 92. ¿Cómo gestionar la revocación instantánea de JWTs sin estado mediante listas negras en Redis o Bloom Filters?
- **Nivel**: Senior / Architecture
- **Respuesta Técnica**:
  Por definición, un JWT es **stateless**: una vez firmado por el servidor, es válido hasta que su estampa `exp` expire, lo que impide revocar el acceso de inmediato si un usuario cambia su contraseña o le roban el dispositivo.
  *Estrategias de Revocación Escala*:
  1. **Tiempos de Vida Cortos (Short-lived Tokens)**: El JWT solo dura 5 a 15 minutos. La revocación tarda como máximo ese lapso en surtir efecto.
  2. **Lista Negra Distribuida en Redis (Blacklisting con TTL)**:
     - Cada JWT incluye un identificador único: `jti` (JWT ID).
     - Al cerrar sesión o revocar, se guarda el `jti` en Redis con un TTL igual al tiempo que le reste al token: `SET jti:uuid 1 EX remainingSeconds`.
     - El API Gateway o middleware consulta Redis en cada petición.
  3. **Control de Versión de Tokens de Usuario**: Almacenar en la base de datos y en la sesión del usuario un `tokenVersion: number`. Cuando el usuario cambia su clave, se incrementa `tokenVersion + 1`. Cualquier JWT antiguo con versión desactualizada es rechazado instantáneamente.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Emitir JWTs con expiración a 30 días sin ningún mecanismo de revocación de sesiones.
  - 🟢 *Green Flag*: Combina tokens de acceso de corta duración en memoria con rotación estricta de Refresh Tokens y validación de versiones en Redis.

---

### 93. ¿Cómo mitigar ataques de Server-Side Request Forgery (SSRF) en microservicios que descargan URLs o webhooks externos?
- **Nivel**: Senior / Security
- **Respuesta Técnica**:
  El ataque **SSRF** ocurre cuando una API permite al usuario ingresar una URL para descargar un avatar o disparar un webhook, y el servidor ejecuta la petición HTTP sin validación.
  El atacante ingresa URLs de la red interna privada:
  - `http://169.254.169.254/latest/meta-data/` (Metadatos de AWS/GCP para robar credenciales IAM temporales del pod).
  - `http://localhost:6379` (Inyección de comandos directos a Redis en memoria).
  *Defensa Defensiva en Profundidad*:
  1. **Lista Blanca de Protocolos**: Rechazar cualquier protocolo que no sea `http://` o `https://` (bloquear `file://`, `gopher://`).
  2. **Resolución de DNS y Validación de IP (Prevención de DNS Rebinding)**:
     - Resolver el DNS antes de enviar la petición.
     - Validar que la IP resuelta no pertenezca a rangos privados o reservados:
       - `127.0.0.0/8` (Loopback)
       - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 Privadas)
       - `169.254.0.0/16` (Link-Local / Cloud Metadata)
  3. Deshabilitar seguimiento automático de redirecciones (`redirect: 'manual'`).
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Validar la URL solo comprobando que no empiece por `localhost` (un atacante puede usar un dominio público que resuelva a 127.0.0.1 o usar DNS Rebinding).
  - 🟢 *Green Flag*: Valida la IP resuelta inmediatamente antes de abrir el socket TCP bloqueando rangos CIDR privados.

---

### 94. ¿Cómo comparar y elegir entre gRPC Protobuf, MessagePack y JSON para comunicación backend de alto rendimiento?
- **Nivel**: Senior / Performance
- **Respuesta Técnica**:
  | Formato | Tipo de Serialización | Esquema Estricto | Rendimiento / Tamaño | Caso de Uso Óptimo |
  | :--- | :--- | :--- | :--- | :--- |
  | **JSON** | Texto plano human-readable | Opcional (JSON Schema) | Lento en parsing; tamaño grande (repite nombres de claves). | APIs públicas REST, frontends web y depuración sencilla. |
  | **MessagePack** | Binario schemaless | No | Hasta 2x más rápido que JSON; tamaño 30-50% menor sin tipado estricto. | Alternativa directa a JSON en sockets o colas que requieren menor tamaño sin compilar esquemas. |
  | **gRPC / Protobuf** | Binario con esquema tipado | Sí (`.proto` estricto) | **Hasta 5x-10x más rápido**; tamaño mínimo (claves son enteros de 1 byte). | Comunicación síncrona inter-microservicio de alta frecuencia en redes privadas. |
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Proponer gRPC para APIs públicas consumidas por navegadores sin considerar la necesidad de proxies intermediarios (gRPC-Web).
  - 🟢 *Green Flag*: Elige Protocol Buffers para la malla interna de microservicios y expone REST/JSON hacia los clientes externos.

---

### 95. ¿Cómo gestionar la seguridad de las cabeceras de autorización HTTP evitando la fuga de credenciales en logs y proxies?
- **Nivel**: Mid-Level / Senior
- **Respuesta Técnica**:
  Las cabeceras `Authorization: Bearer <token>` pueden ser registradas accidentalmente por balanceadores, proxies y software de recolección de logs si no se toman medidas activas:
  1. **Redacción de Logs Centralizada**: Configurar los middlewares de logging (Pino, Winston, Morgan) con listas de campos prohibidos (*Redaction Masks*):
     ```javascript
     redact: ['req.headers.authorization', 'req.headers.cookie']
     ```
  2. **Configuración en Reverse Proxies**: En Nginx o Envoy, suprimir el registro de la variable `$http_authorization` en el formato de log estándar de acceso.
  3. **Prevención de Fuga en Redirecciones**: Si el cliente sigue una redirección HTTP 302 hacia un dominio externo de terceros, el cliente HTTP no debe reenviar la cabecera `Authorization` al nuevo host (*Cross-Origin Auth Strip*).
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Encontrar tokens JWT completos impresos en texto plano en los archivos de log de Datadog o Elasticsearch.
  - 🟢 *Green Flag*: Aplica políticas de redacción automática antes de serializar cualquier mensaje hacia stdout.

---

### 96. ¿Cómo estructurar un pipeline de pruebas de carga con k6 modelando ramp-up, picos de tráfico y soak testing?
- **Nivel**: Senior / Performance QA
- **Respuesta Técnica**:
  Las pruebas de carga deben modelar diferentes perfiles de estrés del sistema utilizando **k6**:
  ```javascript
  import http from 'k6/http';
  import { check, sleep } from 'k6';

  export const options = {
    stages: [
      { duration: '2m', target: 100 }, // Ramp-up progresivo a 100 VUs
      { duration: '5m', target: 100 }, // Carga sostenida (Load Test)
      { duration: '1m', target: 500 }, // Ráfaga súbita (Spike Test)
      { duration: '2m', target: 500 },
      { duration: '2m', target: 0 },   // Ramp-down
    ],
    thresholds: {
      http_req_failed: ['rate<0.01'],      // Menos del 1% de errores
      http_req_duration: ['p(95)<200'],   // El 95% de peticiones debe responder en < 200ms
      http_req_duration: ['p(99)<500'],   // El 99% en < 500ms
    },
  };

  export default function () {
    const res = http.get('https://api.empresa.com/v1/catalog');
    check(res, { 'status es 200': (r) => r.status === 200 });
    sleep(1);
  }
  ```
  *Soak Testing (Prueba de Resistencia)*: Ejecutar una carga moderada durante 12-24 horas continuas para detectar fugas lentas de memoria o saturación gradual de pools de base de datos.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Probar únicamente con peticiones concurrentes instantáneas sin ramp-up ni simulación de pausas de usuario (*Think Time* con `sleep`).
  - 🟢 *Green Flag*: Define *Thresholds* cuantitativos basados en los SLOs de la empresa que rompen el pipeline de CI ante degradaciones de latencia.

---

### 97. ¿Cómo definir Service Level Indicators (SLIs), Service Level Objectives (SLOs) y Error Budgets en servicios backend?
- **Nivel**: Staff Engineer / SRE
- **Respuesta Técnica**:
  El marco de Site Reliability Engineering (SRE) de Google alinea los objetivos técnicos con las expectativas del negocio:
  - **SLI (Service Level Indicator)**: La métrica cuantitativa real observada.
    $$\text{SLI} = \frac{\text{Peticiones HTTP exitosas (< 200ms)}}{\text{Total de peticiones válidas}} \times 100$$
  - **SLO (Service Level Objective)**: La meta acordada con negocio durante una ventana de tiempo (ej. 30 días móvil):
    *"El 99.9% de las peticiones deben responder con éxito en menos de 200ms durante los últimos 30 días"*.
  - **Error Budget (Presupuesto de Error)**: La tasa de fallo permitida ($100\% - \text{SLO} = 0.1\%$).
    - Si el servicio recibe 10 millones de peticiones al mes, el equipo tiene un presupuesto de 10,000 peticiones fallidas permitidas.
    - **Gobernanza**: Si el Error Budget se agota antes de fin de mes, se congelan los despliegues de nuevas funcionalidades y el 100% de la capacidad de ingeniería se enfoca en resiliencia, refactor y estabilidad.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Exigir "100% de disponibilidad sin fallos jamás" (es matemáticamente imposible y frena la innovación).
  - 🟢 *Green Flag*: Utiliza el Error Budget como mecanismo de negociación objetivo entre Product Managers y equipos de desarrollo.

---

### 98. ¿Cómo funciona el algoritmo de elección de líder Bully frente a Raft en sistemas distribuidos?
- **Nivel**: Staff Engineer / Distributed Algorithms
- **Respuesta Técnica**:
  - **Algoritmo Bully (García-Molina)**:
    - Asume que cada nodo tiene un ID numérico único.
    - Cuando un nodo nota que el líder murió, envía un mensaje de elección a todos los nodos con IDs superiores.
    - Si nadie con ID superior responde, se autoproclama líder ("el matón / el más fuerte gana").
    - *Desventaja*: Genera tormentas de mensajes ($O(N^2)$) ante fallos recurrentes y es muy sensible a inestabilidades de red.
  - **Algoritmo Raft (Moderno y Estandarizado)**:
    - Diseñado para comprensibilidad y consenso formal de log inmutable.
    - Utiliza temporizadores de elección aleatorios (*Randomized Election Timers*) que evitan colisiones de votos (*Split Votes*).
    - Un candidato solo puede ser elegido si su log local está tan actualizado como el de la mayoría ($> N/2$), garantizando que ningún dato comprometido se pierda.
    - Adoptado universalmente por herramientas modernas como Kubernetes (`etcd`), Consul y Kafka KRaft.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Desconocer cómo se gestiona el consenso y la elección de líder en el clúster de infraestructura.
  - 🟢 *Green Flag*: Explica cómo KRaft reemplazó a ZooKeeper en Apache Kafka eliminando la necesidad de gestionar dos sistemas distribuidos independientes.

---

### 99. ¿Cómo diseñar contratos de API versionados (URL Path vs Header vs Content Negotiation) minimizando la deuda técnica?
- **Nivel**: Senior / Architect
- **Respuesta Técnica**:
  Existen 3 estrategias principales para versionar APIs REST:
  1. **URI Path Versioning (`/api/v1/users` vs `/api/v2/users`)**:
     - *Pros*: Altamente visible, trivial de enrutar en proxies de red (Nginx/Envoy), fácil de compartir y probar en navegadores.
     - *Contras*: Rompe la pureza de la URI (el mismo recurso conceptual tiene dos identificadores distintos).
  2. **Custom Request Header (`X-API-Version: 2`)**:
     - *Pros*: Las URIs se mantienen limpias e invariables.
     - *Contras*: Difícil de explorar y probar manualmente sin herramientas como cURL o Postman; riesgo de colisión de cachés si se omite `Vary: X-API-Version`.
  3. **Content Negotiation (`Accept: application/vnd.empresa.v2+json`)**:
     - *Pros*: Conforme al estándar REST de Roy Fielding (HATEOAS).
     - *Contras*: Curva de aprendizaje alta y complejidad de configuración en clientes.
  *Recomendación Enterprise*: La industria estandarizó mayoritariamente **URI Path Versioning** para grandes versiones mayores con breaking changes, manteniendo compatibilidad hacia atrás en cambios menores sin subir de versión.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Introducir *Breaking Changes* (ej. renombrar campos obligatorios) en la misma versión de la API sin avisar a los clientes.
  - 🟢 *Green Flag*: Aplica la Ley de Postel (Principio de Robustez): sé conservador en lo que envías y liberal en lo que aceptas.

---

### 100. ¿Cómo construir un sistema backend que cumpla con los principios The Twelve-Factor App para la nube?
- **Nivel**: Staff / Principal Architect
- **Respuesta Técnica**:
  La metodología **The Twelve-Factor App** define los estándares universales para construir aplicaciones SaaS escalables y portables:
  1. **Codebase**: Un único repositorio bajo control de versiones (Git), múltiples despliegues (dev, staging, prod).
  2. **Dependencies**: Declarar y aislar dependencias explícitamente (package.json, lockfiles; nunca asumir paquetes preinstalados).
  3. **Config**: Almacenar la configuración en el entorno (`process.env`), nunca en el código fuente.
  4. **Backing Services**: Tratar bases de datos y colas como recursos adjuntos intercambiables vía URLs.
  5. **Build, Release, Run**: Separación estricta de las etapas de construcción, empaquetado y ejecución.
  6. **Processes**: Ejecutar la aplicación como procesos sin estado (*Stateless*) que no comparten memoria.
  7. **Port Binding**: Exportar servicios vinculándose directamente a puertos de red propios.
  8. **Concurrency**: Escalar horizontalmente multiplicando procesos del sistema operativo.
  9. **Disposability**: Maximizar la robustez con arranque ultra-rápido y apagado ordenado (*Graceful Shutdown* ante `SIGTERM`).
  10. **Dev/Prod Parity**: Mantener los entornos de desarrollo y producción tan idénticos como sea posible (usar PostgreSQL en local si usas PostgreSQL en prod).
  11. **Logs**: Tratar los logs como streams continuos dirigidos a `stdout` para ser recolectados por la infraestructura.
  12. **Admin Processes**: Ejecutar tareas de administración y migraciones como procesos aislados únicos.
- **Criterio de Evaluación**:
  - 🚩 *Red Flag*: Guardar archivos temporales o sesiones de usuario en el disco duro local del contenedor asumiendo que el contenedor vivirá para siempre.
  - 🟢 *Green Flag*: Domina los 12 factores y explica cómo habilitan la orquestación elástica moderna en Kubernetes y plataformas Serverless.
