# 🌐 REST APIs Enterprise Architecture: Principios, Estándares y Prácticas en Node.js

Ruta de maestría técnica en **Diseño, Seguridad y Arquitectura de APIs RESTful de Alta Escala**. Este track aborda desde los fundamentos de la semántica HTTP según los estándares del IETF (RFCs) hasta la implementación de patrones de resiliencia en sistemas distribuidos en **Node.js**.

---

## 🏛️ Estructura del Track

```
rest-apis/
├── 01-architecture-and-standards/   # Richardson Model (L0-L3), RFC 9110, RFC 7807/9457, Versionado
├── 02-security-and-resilience/      # CORS Preflight, Rate Limiting, JWT Rotation vs Sessions, Helmet
├── 03-performance-and-data/         # Caching HTTP (ETag, 304), Streaming NDJSON, Compresión Gzip/Brotli
└── 04-senior-internals/             # Laboratorios ejecutables de grado Senior / Staff
    ├── 01-idempotency-key-engine.ts      # [Lab 01: Motor de Idempotencia y Locks de Concurrencia]
    ├── 02-cursor-vs-offset-pagination.ts # [Lab 02: Cursor Keyset O(1) vs Offset Antipattern O(N)]
    └── 03-rate-limiter-sliding-window.ts # [Lab 03: Sliding Window Counter y Cabeceras RateLimit-*]
```

---

## 🧠 Matriz de Diferenciación por Seniority

| Dimensión | Junior | Intermediate | Senior / Staff |
|---|---|---|---|
| **Semántica HTTP** | Usar solo GET y POST para todo, retornar siempre 200 OK con `{ success: false }`. | Uso correcto de verbos (GET, POST, PUT, PATCH, DELETE) y códigos de estado (201, 204, 400, 404). | Comprensión estricta de **Idempotencia vs Seguridad** (RFC 9110), formato estandarizado de errores **RFC 7807 / 9457 Problem Details**. |
| **Paginación** | `OFFSET` y `LIMIT` directo de SQL en cualquier tabla sin importar su tamaño. | Paginación por offset con metadatos (`totalPages`, `totalCount`). | **Cursor-based / Keyset Pagination**: índices B-Tree compuestos, tiempo constante $O(1)$, eliminación de saltos o duplicados ante mutaciones concurrentes. |
| **Idempotencia** | Depender de que el frontend deshabilite el botón tras hacer click. | Validar duplicados básicos por email o ID en la base de datos. | **Idempotency-Key Engine (RFC Draft 9608)**: Bloqueos atómicos para peticiones en vuelo, almacenamiento de huella de hash (payload tampering) y replay en caché. |
| **Control de Tráfico** | Sin rate limiting o un simple contador en memoria que colapsa con múltiples instancias. | Rate limiting básico por IP con ventana fija (Fixed Window). | **Sliding Window Counter / Token Bucket** distribuido con Redis, inyección de cabeceras RFC 6585 (`RateLimit-*`), graceful degradation. |
| **Caché y Negociación** | Desactivar caché con `no-cache` o ignorar cabeceras HTTP. | Cabecera `Cache-Control: max-age=3600`. | **Validación condicional**: `ETag` fuerte vs débil, `If-None-Match`, respuestas `304 Not Modified` con cero transferencia de body, `Vary` header. |

---

## 🔬 Laboratorios Ejecutables Senior (`04-senior-internals/`)

1. **`01-idempotency-key-engine.ts`**:
   - Implementación de un middleware de idempotencia de grado bancario en Node.js.
   - Manejo de tres estados: `IN_PROGRESS` (bloqueo contra peticiones concurrentes con la misma clave), `RESOLVED` (respuesta en caché) y `FAILED`.
   - Detección de alteraciones de payload (Tampering): responde con HTTP 422 si se reenvía la misma clave con diferente body.

2. **`02-cursor-vs-offset-pagination.ts`**:
   - Comparativa de rendimiento y consistencia entre `OFFSET` y `CURSOR`.
   - Demostración visual de la anomalía de "elementos saltados" o "elementos duplicados" en tiempo real ante inserciones concurrentes.

3. **`03-rate-limiter-sliding-window.ts`**:
   - Algoritmo de Sliding Window Counter con cálculo ponderado de ventanas de tiempo.
   - Generación de cabeceras estándar `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` y respuesta `429 Too Many Requests`.

---

## ⚡ Comandos Rápidos de Ejecución

```bash
# Ejecutar laboratorios del track de APIs REST:
npm run api:senior:01   # Motor de Idempotencia y Locks de Concurrencia
npm run api:senior:02   # Cursor Keyset Pagination vs Offset Antipattern
npm run api:senior:03   # Sliding Window Rate Limiter y Cabeceras RFC
```
