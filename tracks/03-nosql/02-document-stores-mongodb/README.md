# 🍃 NoSQL Level 02: Document Stores & MongoDB Internals

Modelado documental, BSON vs JSON, Replica Sets, Oplog, Read/Write Concerns y Aggregation Pipeline.

---

## 📄 1. Modelado Documental: Embebido vs Referenciado

El principio rector en bases de datos documentales es: **"Lo que se consulta junto, se almacena junto"**.

### A. Documentos Embebidos (*Denormalization / 1-to-Few*)
Los datos relacionados se guardan como subdocumentos o arrays dentro del mismo documento principal.
- **Ventajas**: Lectura atómica en una sola operación de disco ($O(1)$) sin necesidad de `$lookup` ni `JOINs`.
- **Casos de Uso**: Direcciones de un usuario, items de una orden de compra inmutable, tags de un post.
- **Límite Físico Crítico**: En MongoDB, un documento individual **no puede superar los 16MB de BSON**.

### B. Referencias (*Normalization / 1-to-Squillions*)
Se almacenan `ObjectId` apuntando a documentos en otras colecciones.
- **Cuándo es Obligatorio**:
  - Relaciones donde los subelementos crecen sin límite (ej.: logs de actividad de un usuario, transacciones bancarias). Si embebes un array que crece indefinidamente (*Unbounded Growth*), el documento superará los 16MB o forzará continuas reubicaciones de memoria en el motor **WiredTiger**.
  - Datos compartidos por múltiples entidades independientes que mutan con frecuencia (para evitar inconsistencias masivas por desnormalización).

---

## 🔄 2. Replica Sets, Elecciones y el Oplog

Un clúster de producción en MongoDB se estructura mediante **Replica Sets** (habitualmente 1 Primario + 2 Secundarios):

```
       [ Cliente Node.js ]
          /           \
  (Write / Read)   (Read Seconds)
        v               v
  [ PRIMARY ] ----> [ SECONDARY 1 ]
       |         Oplog     |
       +-----------------> [ SECONDARY 2 ]
```

1. **El Primario (Primary)**: Es el único nodo que acepta operaciones de escritura.
2. **El Oplog (`local.oplog.rs`)**: Una colección circular capada (*Capped Collection*) donde el Primario registra secuencialmente cada cambio en formato idempotente. Los Secundarios consumen continuamente el Oplog de forma asíncrona para replicar el estado.
3. **Failover Automático (Protocolo Raft modificado)**: Si el Primario deja de enviar *Heartbeats* durante más de 10 segundos, los Secundarios inician una votación. El nodo con el Oplog más actualizado y con el quórum mayoritario de votos se auto-promueve a nuevo Primario en menos de 3 segundos.

---

## 🛡️ 3. Read Concerns y Write Concerns

En Node.js, nunca asumas que un `await collection.insertOne()` garantiza que los datos sobrevivirán a una caída del nodo sin configurar los **Concerns**:

### Write Concerns (`w` y `j`)
- `{ w: 1 }` *(Default histórico)*: El Primario confirma la escritura tan pronto la recibe en memoria. Si el servidor se apaga repentinamente antes de escribir a disco o replicar, **los datos se pierden**.
- `{ w: "majority", j: true }` *(Estándar Senior)*:
  - `w: "majority"`: La escritura debe ser replicada en la mayoría de nodos del Replica Set antes de responder al cliente.
  - `j: true` *(Journaling)*: Garantiza que los cambios fueron grabados físicamente en el log de disco en el Primario. Es inmune a caídas catastróficas.

### Read Concerns
- `local`: Lee el estado actual del nodo consultado (puede incluir lecturas que sean revertidas en un failover).
- `majority`: Solo devuelve datos que ya han sido confirmados por la mayoría de nodos. **Inmune a Dirty Reads tras un failover del Primario**.
- `linearizable`: Garantiza que el dato leído no sólo es mayoría, sino que el nodo consultado sigue siendo el Primario activo en el momento exacto de responder la consulta.

---

## ⚡ 4. Aggregation Pipeline: Operaciones en Memoria y Límites

El Aggregation Pipeline procesa secuencias de etapas (`$match`, `$project`, `$group`, `$sort`, `$facet`):

- **Regla de Oro de Rendimiento**: Colocar siempre `$match` y `$sort` en las dos primeras etapas para aprovechar índices B-Tree de WiredTiger y descartar millones de documentos antes de consumir memoria RAM.
- **Límite de RAM de 100MB**: Por defecto, ninguna etapa intermedia de agregación puede consumir más de 100MB de memoria. Si se supera este límite sin configurar `{ allowDiskUse: true }`, la consulta aborta con error de memoria.
