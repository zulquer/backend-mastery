# 🐘 SQL & Relational Databases: Arquitectura Senior y Concurrencia en Node.js

Ruta de maestría técnica en **Bases de Datos Relacionales (SQL)**, con foco primordial en **PostgreSQL**, el estándar indiscutible de la industria para persistencia transaccional de alta fiabilidad.

---

## 🏛️ Organización del Track

```
sql/
├── 01-fundamentals/                             # ACID, Modelo Relacional, JSONB vs Relacional, Tipos Críticos
├── 02-connection-pooling-and-architecture/      # Modelo de Procesos de PG, Pool Sizing, Latencia y Starvation
├── 03-indexes-and-query-optimization/           # B-Tree, GIN, BRIN, EXPLAIN (ANALYZE, BUFFERS), MVCC y VACUUM
└── 04-senior-internals/                         # Laboratorios Ejecutables Senior
    ├── 01-concurrency-locks-and-skip-locked.ts   # [Lab 01: Locks en Fila y Colas con SKIP LOCKED]
    ├── 02-isolation-levels-and-anomalies.ts     # [Lab 02: Niveles de Aislamiento y Anomalía de Write Skew]
    └── 03-connection-pool-starvation-and-sizing.ts # [Lab 03: Cálculo de Pool Sizing y Prevención de Exhaustion]
```

---

## 🧠 Matriz de Diferenciación por Seniority

| Dimensión | Junior | Intermediate | Senior / Staff |
|---|---|---|---|
| **Manejo de Conexiones** | Abrir un `new Client()` en cada petición HTTP. | Usar `pg.Pool` con valores por defecto (10 conexiones). | Sintonizar el tamaño del pool con la fórmula de hardware de PostgreSQL: `connections = (cores * 2) + disk_spindles`. Mitigar saturación de RAM por procesos backend en PG. |
| **Transacciones y Concurrencia** | `SELECT` de saldo seguido de `UPDATE`, provocando condiciones de carrera. | Usar transacciones simples con `BEGIN` y `COMMIT`. | Bloqueo pesimista con **`SELECT ... FOR UPDATE`**, y diseño de colas distribuidas concurrentes de alto rendimiento sin contención usando **`FOR UPDATE SKIP LOCKED`**. |
| **Aislamiento Transaccional** | Asumir que toda transacción en base de datos es 100% aislada. | Conocer la existencia de `Read Committed` y `Serializable`. | Comprender **MVCC** (`xmin`, `xmax`), las 4 anomalías formales (Dirty Read, Non-repeatable Read, Phantom Read, Serialization Anomaly / Write Skew), y el coste de reintentos por rollback. |
| **Estrategia de Indexación** | Indexar cada columna de búsqueda con B-Tree o no indexar nada. | Crear índices compuestos y examinar `EXPLAIN`. | Diferenciar familias de índices: **B-Tree** (igualdad/rangos), **GIN** (búsqueda en arrays y `jsonb`), **BRIN** (series temporales masivas ordenadas físicamente). Análisis de `BUFFERS` en planes de ejecución y prevención de **Table Bloat** con afinación de `autovacuum`. |

---

## 🔬 Laboratorios Ejecutables Senior (`04-senior-internals/`)

1. **`01-concurrency-locks-and-skip-locked.ts`**:
   - Demostración de transferencias bancarias concurrentes y prevención de saldos negativos mediante `SELECT ... FOR UPDATE`.
   - Implementación del patrón de **Cola de Mensajes Distribuida en Base de Datos** utilizando `FOR UPDATE SKIP LOCKED`, permitiendo que $N$ workers consuman trabajos en paralelo sin bloquearse entre sí.

2. **`02-isolation-levels-and-anomalies.ts`**:
   - Simulación didáctica de los niveles de aislamiento SQL: `Read Committed`, `Repeatable Read` y `Serializable`.
   - Reproducción en vivo de la anomalía de **Write Skew** (desviación de escritura) y cómo `Serializable Snapshot Isolation (SSI)` la neutraliza.

3. **`03-connection-pool-starvation-and-sizing.ts`**:
   - Demostración de por qué abrir 500 conexiones simultáneas degrada el rendimiento de PostgreSQL respecto a un pool acotado de 20 conexiones (cambio de contexto de CPU y agotamiento de memoria).
   - Simulación de colas de espera en el pool y manejo de timeouts para evitar el colapso del servicio.

---

## ⚡ Comandos Rápidos de Ejecución

```bash
# Laboratorios ejecutables del track SQL (alias pg:senior:* también disponible):
npm run sql:senior:01   # Locks en Fila y Colas con SKIP LOCKED
npm run sql:senior:02   # Niveles de Aislamiento y Write Skew
npm run sql:senior:03   # Connection Pool Sizing y Starvation
```
