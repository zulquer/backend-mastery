# 🐘 PostgreSQL Level 02: Connection Pooling y Arquitectura de Procesos

Comprender el modelo de procesos de PostgreSQL, el coste de abrir conexiones y el cálculo riguroso del tamaño del pool en Node.js.

---

## 🏗️ 1. El Modelo de Procesos de PostgreSQL (Process-Based Architecture)

A diferencia de motores multihilo como MySQL o SQL Server, PostgreSQL utiliza una arquitectura basada en **procesos independientes (`fork`)**:

```
[ Cliente Node.js ] ──TCP──> [ Postmaster (Proceso Principal) ]
                                      │
                                      ▼ fork()
                           [ Dedicated Backend Process ] (1 por conexión)
                           ├─ Memoria privada (work_mem, temp_buffers)
                           └─ Conexión con Shared Buffers y WAL
```

### El Coste Real de Cada Conexión:
1. **Consumo de Memoria RAM**: Cada conexión activa consume entre 5MB y 20MB de memoria base, más la memoria de trabajo asignada a consultas (`work_mem`). Si configuras 1,000 conexiones, PostgreSQL puede consumir 15GB solo en mantener los procesos abiertos.
2. **Cambio de Contexto de CPU (Context Switching)**: Cuando cientos de procesos compiten por un número limitado de núcleos de CPU (ej. 8 o 16 cores), el sistema operativo pasa más tiempo intercambiando procesos en la CPU que ejecutando consultas reales.

---

## ⚡ 2. La Fórmula de Oro de Sizing del Pool de Conexiones

Definida por el equipo de rendimiento de PostgreSQL y confirmada por pruebas de estrés:

$$\text{Conexiones Óptimas} = (\text{Número de Cores de CPU} \times 2) + \text{Número de Discos Físicos (Spindles)}$$

### Ejemplo Práctico:
- Para un servidor con **8 núcleos de CPU** y disco SSD NVMe (1 spindle efectivo):
  $$\text{Pool Size} = (8 \times 2) + 1 = 17 \text{ conexiones}$$
- **La paradoja Senior**: Un pool de **20 conexiones** procesa más transacciones por segundo (TPS) con menor latencia que un pool de **500 conexiones**. En pruebas de saturación, 500 conexiones colapsan el motor por contención de locks en `Shared Buffers` y CPU thrashing.

---

## 🛠️ 3. Implementación de `pg.Pool` en Node.js

```typescript
import { Pool } from 'pg';

export const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                  // Número máximo de clientes en el pool
  min: 4,                   // Conexiones mínimas calientes
  idleTimeoutMillis: 30000, // Cierra conexiones inactivas tras 30s
  connectionTimeoutMillis: 2000, // Falla rápido (Fast-Fail) si no hay conexión libre en 2s
});

// Buenas Prácticas: Liberación obligatoria en bloques finally
export async function withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // ¡CRÍTICO! client.release() devuelve la conexión al pool.
    // Olvidar release() agota el pool en pocos segundos (Connection Pool Exhaustion).
    client.release();
  }
}
```

---

## 🌐 4. PgBouncer y Connection Pooling Externo

En entornos serverless (AWS Lambda, Google Cloud Run) o clusters de Kubernetes con decenas de pods de Node.js, cada pod crearía su propio pool, superando fácilmente el límite `max_connections` de PostgreSQL.
- **Solución de Infraestructura**: Instalar **PgBouncer** o **Supavisor** como proxy intermedio.
- **Modo Transaction Pooling**: Una conexión real con PostgreSQL solo se asocia a la instancia de Node.js durante la duración de una transacción específica, liberándose inmediatamente para otros pods al hacer `COMMIT`.
