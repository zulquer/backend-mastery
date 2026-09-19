# 🌐 REST APIs Level 04: Senior & Staff Internals

Laboratorios ejecutables de alto nivel para ingeniería de backend: Idempotencia transaccional, paginación por cursor y rate limiting con algoritmos de ventana deslizante.

---

## 🔬 Laboratorios de este Nivel

### 1. `01-idempotency-key-engine.ts`:
- Implementación de un motor de **Idempotency-Key** (siguiendo el borrador de especificación IETF RFC).
- Estados de clave: `IN_PROGRESS` (con bloqueo para prevenir condiciones de carrera cuando dos peticiones paralelas llegan con la misma clave), `RESOLVED` (con payload en caché), y `FAILED`.
- Detección de alteraciones (*tampering*): si se reenvía la misma clave con un payload JSON diferente, rechaza con HTTP 422 Unprocessable Entity.

### 2. `02-cursor-vs-offset-pagination.ts`:
- Demostración visual y analítica de por qué `OFFSET / LIMIT` es peligroso en bases de datos relacionales a escala.
- Implementación de paginación por cursor opaco en Base64 (`(createdAt, id)`).
- Simulación de inserciones concurrentes en vivo demostrando cómo `OFFSET` omite y duplica elementos, mientras que el `CURSOR` mantiene consistencia absoluta.

### 3. `03-rate-limiter-sliding-window.ts`:
- Algoritmo de **Sliding Window Counter** con cálculo ponderado de tráfico.
- Inyección de cabeceras estándar de la industria (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
- Respuestas automáticas con HTTP `429 Too Many Requests` y cabecera `Retry-After`.

---

## ⚡ Ejecución Directa

```bash
npm run api:senior:01   # Motor de Idempotencia y Locks de Concurrencia
npm run api:senior:02   # Cursor Keyset vs Offset Antipattern
npm run api:senior:03   # Sliding Window Rate Limiter y Cabeceras RFC
```
