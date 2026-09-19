# 🏛️ NoSQL Level 04: Wide-Column Stores & AWS DynamoDB

Principios de almacenamiento por columnas anchas, diseño de clave de partición, Single Table Design y mitigación de Hot Partitions.

---

## 🏗️ 1. Arquitectura de Wide-Column y DynamoDB

A diferencia de las tablas SQL o los documentos flexibles de MongoDB, bases de datos como **Apache Cassandra, ScyllaDB y AWS DynamoDB** basan su modelo en el particionamiento hash determinista:

$$\text{Storage Node} = \text{Hash}(\text{Partition Key}) \pmod{\text{Total Nodes}}$$

### Clave Primaria Simple vs Clave Primaria Compuesta
1. **Partition Key (PK) / HASH**:
   - Determina el nodo físico exacto del clúster donde se almacenará el registro.
   - Las lecturas por PK son ultra eficientes: $O(1)$ sin importar si la base de datos almacena 100 registros o 100 mil millones.
2. **Sort Key (SK) / RANGE**:
   - Dentro del mismo nodo físico determinado por la PK, todos los registros se almacenan físicamente **ordenados por la Sort Key en un árbol B-Tree local**.
   - Permite consultas de rango ultra eficientes (`begins_with`, `between`, `>`, `<`) sin escanear el clúster.

---

## 🎯 2. Single Table Design (El Arte de Diseñar para DynamoDB)

En bases de datos relacionales, creas una tabla por cada entidad (`Users`, `Orders`, `Products`). En DynamoDB a escala masiva, **crear múltiples tablas es un antipatrón** porque destruye la posibilidad de obtener entidades agregadas en una sola petición de red.

### Patrón de Claves Sintéticas y Prefijos
En **Single Table Design**, todas las entidades de la aplicación conviven en una única tabla con nombres genéricos: `PK` y `SK`:

| PK (String) | SK (String) | Tipo de Entidad | Atributos Específicos |
|---|---|---|---|
| `USER#usr_101` | `METADATA` | Usuario | `{ name: "Carlos", email: "carlos@dev.io" }` |
| `USER#usr_101` | `ORDER#2026-09-01#ord_901` | Pedido | `{ total: 150.00, status: "PAID" }` |
| `USER#usr_101` | `ORDER#2026-09-15#ord_902` | Pedido | `{ total: 42.50, status: "SHIPPED" }` |
| `ORDER#ord_901` | `ITEM#prod_55` | Ítem de Pedido | `{ qty: 2, price: 75.00 }` |

### ¿Por qué esto es una obra de arte arquitectónica?
- Con una **única llamada de red** `Query(PK = "USER#usr_101")`, DynamoDB recupera el perfil del usuario **junto con todos sus pedidos históricos ordenados por fecha**, en una sola operación de milisegundos sin hacer `JOINs`.

---

## 🔍 3. Índices Secundarios: GSI vs LSI

Cuando necesitas consultar por atributos que no forman parte de la clave primaria original:

1. **Local Secondary Index (LSI)**:
   - Comparte la misma `PK` que la tabla, pero define una `SK` diferente.
   - Debe definirse **al crear la tabla obligatoriamente** (no se puede añadir después).
   - Soporta consistencia fuerte opcional.
2. **Global Secondary Index (GSI)**:
   - Define tanto una nueva `PK` como una nueva `SK` independientes.
   - Puede crearse o destruirse en cualquier momento en una tabla viva en producción.
   - **Solo soporta Consistencia Eventual**: los datos se replican asíncronamente desde la tabla base con un desfase de milisegundos.

---

## 💥 4. El Problema de "Hot Partitions" y Técnicas de Salting

### La Anomalía de la Partición Caliente
Si usas una clave de partición con baja entropía o distribución sesgada (ej.: la fecha `PK = "2026-09-19"` o un evento viral como el Black Friday), **el 100% de las peticiones de escritura se concentran en el mismo nodo físico del clúster**.
- Aunque hayas pagado miles de unidades de capacidad (WCU/RCU), ese nodo individual se satura y DynamoDB empieza a rechazar peticiones con `ProvisionedThroughputExceededException`.

### La Solución Senior: Salting de Clave de Partición
Para desparramar el tráfico entre múltiples particiones físicas contiguas, se añade un sufijo aleatorio o hash determinado:

```typescript
// En lugar de una PK estática:
const badPK = `EVENT#BLACK_FRIDAY_2026`;

// Añadimos un Salt determinista de 1 a N buckets:
const bucket = Math.floor(Math.random() * 10); // 10 buckets
const saltedPK = `EVENT#BLACK_FRIDAY_2026#BUCKET_${bucket}`;
```
- Las escrituras se reparten homogéneamente entre 10 nodos físicos independientes.
- Para leer, la aplicación dispara 10 consultas en paralelo con `Promise.all()` agregando los resultados en memoria.
