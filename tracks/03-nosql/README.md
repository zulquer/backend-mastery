# 🍃 NoSQL & Distributed Data Stores: Arquitectura Senior y Concurrencia en Node.js

Ruta de maestría técnica en **Bases de Datos No Relacionales (NoSQL)**, almacenamiento distribuido y estrategias avanzadas de **Caché en Memoria**, cubriendo los 4 modelos de persistencia no relacional: **Documental (MongoDB)**, **Clave-Valor / In-Memory (Redis)**, **Wide-Column (DynamoDB / Cassandra)** y **Vector / Search**.

---

## 🏛️ Organización del Track

```
nosql/
├── 01-distributed-fundamentals/              # Teorema CAP, PACELC, BASE vs ACID, Consistent Hashing y Quorums
├── 02-document-stores-mongodb/               # Modelado Embebido vs Referenciado, Replica Sets, Oplog y Concerns
├── 03-in-memory-and-caching-redis/           # Event-Driven Single Thread, Patrones de Caché, Stampede y Evicción
├── 04-wide-column-and-dynamodb/              # Partition Key, Sort Key, Single Table Design y Hot Partitions
└── 05-senior-internals/                      # Laboratorios Ejecutables Senior
    ├── 01-cache-stampede-and-mutex.ts        # [Lab 01: Thundering Herd / Cache Stampede y Mutex SingleFlight]
    ├── 02-distributed-lock-redlock.ts        # [Lab 02: Locks Distribuidos, TTL Leases y Liberación Atómica Lua]
    └── 03-cap-quorum-eventual-consistency.ts # [Lab 03: Simulación de Partición de Red, Split-Brain y Quorum W+R>N]
```

---

## 🧭 Las 4 Familias NoSQL en Perspectiva

| Familia | Motores de Referencia | Estructura de Datos | Casos de Uso Óptimos | Cuándo Evitar |
|---|---|---|---|---|
| **Documental** | MongoDB, AWS DocumentDB | BSON / JSON anidado y polimórfico | Catálogos con atributos dinámicos, CMS, configuraciones de usuario, carritos de compra | Datos con grafos de relaciones profundas o transferencias bancarias de estricta doble partida |
| **Key-Value / In-Memory** | Redis, Valkey, Memcached | Clave -> String, Hash, List, Set, ZSet | Caching de baja latencia (<1ms), contadores atómicos, sesiones, rate limiting, locks distribuidos | Almacenamiento primario masivo de terabytes dependiente de queries analíticas ad-hoc |
| **Wide-Column** | Apache Cassandra, AWS DynamoDB, ScyllaDB | Filas con columnas dinámicas particionadas por hashing | Escrituras masivas a escala global, series temporales, eventos de telemetría (IoT), logs | Queries sin la clave de partición (provocan escaneos O(N) catastróficos en clúster) |
| **Search & Vector** | Elasticsearch, OpenSearch, Qdrant, Pinecone | Índices Invertidos y Embeddings HNSW | Búsqueda全文 (Full-Text), analítica de logs (ELK), búsqueda semántica y RAG para LLMs | Fuente de verdad transaccional de lectura/escritura primaria |

---

## 🧠 Matriz de Diferenciación por Seniority

| Dimensión | Junior | Intermediate | Senior / Staff |
|---|---|---|---|
| **Decisión de Adopción** | "Uso MongoDB porque no me gusta definir esquemas SQL ni migraciones". | Saber cuándo usar documentos y cuándo usar tablas relacionales. | Aplicar **Políglota Persistence**: usar SQL para la fuente transaccional inmutable (Single Source of Truth) y NoSQL/Redis para proyecciones de lectura desnormalizadas y caching optimizado. |
| **Teorema CAP & Redes** | Asumir que toda base de datos garantiza consistencia y disponibilidad siempre. | Saber qué significan las siglas C, A y P. | Entender que la tolerancia a partición (**P**) es inevitable en redes físicas. Diseñar bajo **PACELC**: decidir conscientemente entre Latencia y Consistencia en operación normal, y mitigar **Split-Brain** con quórums formales ($W + R > N$). |
| **Estrategias de Caché** | Poner `cache.set(key, val)` después de cada SELECT sin TTL. | Usar Cache-Aside con TTLs fijos y entender invalidación básica. | Prevenir **Cache Stampede (Thundering Herd)** mediante SingleFlight Mutex / Probabilistic Early Expiration. Mitigar **Cache Penetration** con Bloom Filters y evitar **Cache Avalanche** con *TTL Jitter*. Implementar **Distributed Locks** seguros tolerantes a pausas de GC. |
| **Modelado NoSQL** | Replicar el modelo relacional con IDs foráneos y hacer $N+1$ queries manuales. | Usar documentos embebidos para relaciones 1 a N comunes. | Dominar el equilibrio de tamaño de BSON (límite 16MB en MongoDB), modelado *1-to-few* vs *1-to-squillions*. En DynamoDB: aplicar **Single Table Design** riguroso mediante PK/SK sintéticos y evitar **Hot Partitions** mediante salting determinista. |

---

## 🔬 Laboratorios Ejecutables Senior (`05-senior-internals/`)

1. **`01-cache-stampede-and-mutex.ts`**:
   - Demostración de colapso de la base de datos cuando una clave caliente con alto tráfico expira y 50 peticiones simultáneas golpean la persistencia.
   - Implementación del patrón **SingleFlight / Distributed Mutex** en Node.js, donde sólo 1 hilo consulta la base de datos y los 49 restantes esperan y reutilizan la misma Promise resuelta en memoria.

2. **`02-distributed-lock-redlock.ts`**:
   - Simulación del algoritmo de **Distributed Lock** en Node.js/Redis.
   - Prevención de la trampa del *Split-Lock* (cuando una petición tarda más que el TTL del lock y un worker libera accidentalmente el lock recién adquirido por otro worker) mediante tokens criptográficos y scripts atómicos en Lua.

3. **`03-cap-quorum-eventual-consistency.ts`**:
   - Simulación de un clúster distribuido de 5 nodos con latencia y partición de red simulada.
   - Demostración práctica de cómo el quórum $W + R > N$ previene lecturas inconsistentes (Stale Reads) y cómo el sistema conmuta entre consistencia fuerte y consistencia eventual.

---

## ⚡ Comandos Rápidos de Ejecución

```bash
# Laboratorios ejecutables del track NoSQL:
npm run nosql:senior:01   # Cache Stampede / Thundering Herd y SingleFlight Mutex
npm run nosql:senior:02   # Distributed Lock, TTL Lease y Liberación Atómica Lua
npm run nosql:senior:03   # Teorema CAP, Split-Brain y Quorum Distribuido (W + R > N)
```
