# 🌐 Backend & Distributed Systems Architecture Mastery

Repositorio maestro de referencia técnica profunda para consolidar habilidades de nivel **Senior / Staff / Principal Backend Engineer** en **Arquitectura de APIs REST empresariales y RFCs oficiales, Persistencia Relacional (SQL & PostgreSQL Internals), Almacenamiento Distribuido NoSQL (MongoDB, Redis, DynamoDB) y Patrones de Sistemas Distribuidos**.

---

## 🎯 Preguntas de Entrevista Técnica

Para preparar entrevistas técnicas de alto nivel (**Senior Backend Engineer, Systems Architect y Tech Lead**), este módulo incluye la guía:

👉 **[Las 100 Preguntas Más Comunes en Entrevistas Técnicas: Backend & Distributed Systems](./INTERVIEW-QUESTIONS.md)** (RFC 9110, RFC 7807/9457, SQL MVCC, SKIP LOCKED, NoSQL CAP/PACELC, Distributed Sagas, Outbox Pattern, con criterios 🚩 *Red Flags* vs 🟢 *Green Flags*).

---

## 🌐 The Mastery Suite (Ecosistema Modular)

| Repositorio | Especialidad Técnica | Enlace |
|---|---|---|
| **`nodejs-ecosystem-mastery`** | 🟢 **Node.js Core, V8, Libuv, Express, NestJS, Testing & TypeScript** | [Ver Repositorio](../nodejs-ecosystem-mastery/) |
| **`python-ecosystem-mastery`** | 🐍 **CPython Internals, GIL, FastAPI, Django, PySpark & Pytest** | [Ver Repositorio](../python-ecosystem-mastery/) |
| **`php-ecosystem-mastery`** | 🐘 **Zend Engine, OPcache, JIT, Laravel, Symfony, FrankenPHP & Pest** | [Ver Repositorio](../php-ecosystem-mastery/) |
| **`backend-mastery`** | 🌐 **REST APIs RFC 9110, SQL, NoSQL, Sistemas Distribuidos & Caché** | *Este repositorio* |
| **`frontend-mastery`** | ⚛️ **React 19, Angular v2-v19+, Next.js App Router & Web Performance** | [Ver Repositorio](../frontend-mastery/) |
| **`cloud-mastery`** | ☁️ **Cloud Architecture (AWS, Azure, DigitalOcean), K8s, Terraform & FinOps** | [Ver Repositorio](../cloud-mastery/) |
| **`cicd-mastery`** | 🚀 **CI/CD Universal (GitHub Actions, Azure, GitLab), GitOps & Canary** | [Ver Repositorio](../cicd-mastery/) |
| **`agile-mastery`** | 🏃 **Scrum, Kanban, Ley de Little, XP (TDD/Trunk-Based) & Cynefin** | [Ver Repositorio](../agile-mastery/) |

---

## 🏛️ Organización de los Tracks

```
backend-mastery/
├── tracks/
│   ├── 01-rest-apis/                             # Richardson L0-L3, RFC 9110, RFC 7807/9457, Idempotencia, Cursors
│   ├── 02-sql/                                   # ACID, MVCC, B-Tree/GIN, Row Locks (SKIP LOCKED), Write Skew, Pools
│   ├── 03-nosql/                                 # Teorema CAP & PACELC, MongoDB Oplog, Redis SingleFlight, DynamoDB
│   └── 04-distributed-systems-and-resilience/    # Circuit Breaker, Outbox Pattern, Event-Driven & CQRS
├── .gitignore
└── package.json
```

---

## 🧠 Matriz de Diferenciación por Seniority en Backend

| Dimensión | Junior | Intermediate | Senior / Staff Backend Engineer |
|---|---|---|---|
| **Diseño de APIs** | URLs sin estructura, verbos en rutas (`/getUser`, `/createOrder`), siempre retornar HTTP 200 con `{ success: false }`. | Usar verbos HTTP adecuados (`GET`, `POST`, `PUT`, `DELETE`) y códigos de estado estándar (201, 400, 404). | **Cumplimiento RFC Formal**: Semántica RFC 9110, errores estandarizados con **RFC 7807/9457 Problem Details**, motores de **Idempotencia con distributed locks (RFC Draft 9608)**, paginación O(1) Keyset Cursor en vez del antipatrón `OFFSET`, y Rate Limiting de ventana deslizante. |
| **Persistencia SQL** | Consultas N+1, `SELECT *`, y abrir conexiones sin pool. | Usar ORMs estándar y transacciones simples con `BEGIN`/`COMMIT`. | **Internals de RDBMS & Concurrencia**: Entender **MVCC** (`xmin`, `xmax`), las 4 anomalías de aislamiento (Dirty Read a Write Skew), dimensionamiento matemático de Pools (`connections = 2 * cores + disks`), y colas distribuidas concurrentes sin contención con **`SELECT ... FOR UPDATE SKIP LOCKED`**. |
| **Persistencia NoSQL** | "NoSQL no tiene esquemas, puedo guardar cualquier JSON". | Modelar documentos con arrays embebidos básicos. | **Sistemas Distribuidos**: Dominar **CAP & PACELC**, modelar bajo el principio de acceso (*Single Table Design* en DynamoDB), mitigar **Cache Stampede / Thundering Herd** con SingleFlight Mutex, y diseñar exclusión mutua segura con scripts Lua y Redlock. |
| **Resiliencia Distribuida** | Reintentar peticiones en bucle infinito hasta tumbar el servidor caído (*Thundering Herd*). | Usar `try/catch` con timeouts fijos. | **Patrones de Estabilidad**: **Circuit Breaker** con half-open states, **Exponential Backoff con Full Jitter**, patrón **Transactional Outbox** para consistencia eventual entre BD y Message Broker (Kafka/RabbitMQ), y Bulkheading. |

---

## 🔬 Laboratorios Ejecutables Senior

```bash
# 🌐 REST APIs Senior:
npm run api:senior:01      # Motor de Idempotencia y Locks de Concurrencia
npm run api:senior:02      # Cursor Keyset Pagination O(1) vs Offset Antipattern
npm run api:senior:03      # Sliding Window Counter y Cabeceras RateLimit-*

# 🐘 SQL / PostgreSQL Senior:
npm run sql:senior:01      # Row Locks y Colas Concurrentes con SKIP LOCKED
npm run sql:senior:02      # Niveles de Aislamiento y Detección de Write Skew
npm run sql:senior:03      # Connection Pool Sizing y Prevención de Starvation

# 🍃 NoSQL & Distributed Data Stores:
npm run nosql:senior:01    # Cache Stampede / Thundering Herd y SingleFlight Mutex
npm run nosql:senior:02    # Distributed Lock con TTL Lease y Liberación Atómica Lua
npm run nosql:senior:03    # Teorema CAP, Partición de Red y Quórum W+R>N
```
