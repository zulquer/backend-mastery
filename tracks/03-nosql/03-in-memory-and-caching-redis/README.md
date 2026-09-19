# ⚡ NoSQL Level 03: In-Memory Data Stores & Redis Internals

Arquitectura Single-Threaded de Redis, estructuras de datos nativas, patrones de caché, anomalías de concurrencia y evicción de memoria.

---

## 🏎️ 1. ¿Por qué Redis es Ultra Rápido? (Arquitectura Interna)

Redis procesa más de 100,000 operaciones por segundo en un único núcleo de CPU debido a tres principios de diseño de bajo nivel:

1. **Persistencia en Memoria RAM**: El acceso a memoria RAM tiene una latencia de ~100 nanosegundos, comparado con los ~1-10 milisegundos de un disco NVMe/SSD.
2. **Event-Driven Single-Threaded Execution**: El bucle principal de ejecución de comandos se ejecuta en **un único hilo**. Esto elimina por completo el coste de:
   - Cambio de contexto de CPU (*Context Switches*).
   - Locks, mutexes y condiciones de carrera a nivel de memoria de la CPU.
   - Cada comando individual (`INCR`, `HSET`, `LPOP`) es **estrictamente atómico** sin coste adicional de sincronización.
3. **I/O Multiplexing (epoll / kqueue)**: Utiliza llamadas al kernel del sistema operativo para monitorizar miles de sockets TCP abiertos simultáneamente sin bloquear la ejecución.

---

## 🧱 2. Estructuras de Datos Nativas y su Complejidad Algorítmica

| Tipo | Implementación Interna C | Complejidad | Caso de Uso Óptimo |
|---|---|---|---|
| **String** | SDS (Simple Dynamic String) | $O(1)$ | Caché simple, contadores con `INCRBY`, bitfields, JSON serializado |
| **Hash** | Listpack / Dict (Tabla Hash) | $O(1)$ | Objetos con propiedades (usuario, sesión) sin tener que serializar todo el JSON |
| **List** | Quicklist (Lista doblemente enlazada de ziplists) | $O(1)$ en extremos | Colas FIFO (`LPUSH` / `RPOP`), timeline de actividad |
| **Set** | Intset / Dict | $O(1)$ inserción / comprobación | Tags únicos, amigos en común, IPs bloqueadas (`SISMEMBER`) |
| **Sorted Set (ZSet)** | SkipList + Dict | $O(\log N)$ | Leaderboards de videojuegos, Rate Limiters de ventana deslizante por timestamp |
| **Stream** | Radix Tree | $O(1)$ inserción | Log de eventos append-only persistente tipo Kafka ligero con grupos de consumidores |

---

## 🛡️ 3. Patrones de Caché en Arquitectura de Backend

### A. Cache-Aside (Lazy Loading) - El Estándar de la Industria
1. La aplicación recibe una petición y consulta la caché (Redis).
2. Si hay **Cache Hit**: devuelve el dato de Redis inmediatamente.
3. Si hay **Cache Miss**: consulta la base de datos relacional (PostgreSQL), escribe el resultado en Redis con un TTL, y devuelve la respuesta.
- *Ventaja*: Solo se cachea lo que realmente se consulta. Si Redis cae, la BD sigue disponible (aunque con mayor latencia).

### B. Write-Through
La aplicación escribe siempre en la caché primero, y la caché se encarga de escribir sincrónicamente en la base de datos antes de responder.
- *Ventaja*: Los datos en caché nunca están desactualizados. *Desventaja*: Mayor latencia en cada escritura.

### C. Write-Behind (Write-Back)
La aplicación escribe en Redis de inmediato y confirma al usuario. Un worker asíncrono en background acumula las escrituras y las vuelca por lotes (*batching*) a PostgreSQL.
- *Ventaja*: Escrituras hiperrápidas. *Riesgo*: Si el nodo de Redis colapsa antes del volcado, puede haber pérdida de datos.

---

## 💣 4. Las 4 Grandes Trampas de Producción y cómo Mitigarlas

### 1. Cache Stampede (Thundering Herd)
- **El Problema**: Una clave con 10,000 peticiones por segundo expira su TTL. En ese milisegundo exacto, 10,000 peticiones sufren un *Cache Miss* simultáneo e intentan consultar la base de datos al mismo tiempo, colapsando el pool de PostgreSQL.
- **Solución Senior**:
  - **SingleFlight / Mutex**: La primera petición que detecta el miss adquiere un lock y consulta la BD; las demás 9,999 peticiones se quedan esperando en memoria la misma Promise sin golpear la base de datos.
  - **Probabilistic Early Expiration (XFetch)**: Un algoritmo recalcula el valor en background antes de que expire si detecta alta concurrencia.

### 2. Cache Avalanche
- **El Problema**: Cientos de claves se guardan a las 12:00 con un TTL de exactamente 1 hora (`TTL = 3600`). A las 13:00, todas expiran en el mismo segundo, redirigiendo todo el tráfico de golpe a la BD.
- **Solución Senior**: **TTL Jitter**: Añadir una variación aleatoria al TTL: `TTL = 3600 + Math.floor(Math.random() * 300)`.

### 3. Cache Penetration
- **El Problema**: Atacantes solicitan IDs maliciosos o inexistentes (`/users/999999999`). Como no existen, nunca se cachean y todas las peticiones llegan a la base de datos física.
- **Solución Senior**: Cachear valores nulos con TTL corto (`SET user:999999999 "NULL" EX 60`) o usar un **Bloom Filter** en memoria que descarte peticiones con IDs inexistentes en $O(1)$.

---

## 🧹 5. Políticas de Evicción de Memoria (`maxmemory-policy`)

Cuando Redis alcanza el límite de memoria asignado (`maxmemory`), debe decidir qué hacer:

- `noeviction` *(Default)*: Rechaza nuevas escrituras devolviendo error de memoria; permite lecturas.
- `allkeys-lru` *(Recomendada para Caching general)*: Expulsa las claves menos recientemente usadas (Least Recently Used) de todo el espacio de claves.
- `volatile-lru`: Expulsa LRU solo entre las claves que tienen un `TTL` configurado.
- `allkeys-lfu`: Expulsa según frecuencia de uso (Least Frequently Used), ideal si hay claves que se consultan esporádicamente pero no deben eliminarse si su volumen total de accesos es masivo.
