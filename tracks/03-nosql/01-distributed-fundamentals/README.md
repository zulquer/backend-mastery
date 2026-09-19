# 🌐 NoSQL Level 01: Fundamentos de Sistemas Distribuidos

Teorema CAP, Teorema PACELC, modelo BASE vs ACID, particionamiento horizontal y quórums distribuidos.

---

## 🎯 1. El Teorema CAP en Producción

Propuesto por Eric Brewer, el teorema establece que en un sistema de datos distribuido y asíncrono es matemáticamente imposible garantizar simultáneamente las tres propiedades:

1. **C (Consistency / Linearizability)**:
   - Toda lectura recibe la escritura más reciente o un error. Todas las réplicas ven exactamente el mismo dato al mismo instante.
2. **A (Availability)**:
   - Todo nodo no caído responde a cualquier petición con una respuesta no errónea (aunque no garantiza que contenga la última versión del dato).
3. **P (Partition Tolerance)**:
   - El sistema continúa funcionando a pesar de que la red física falle y corte la comunicación entre nodos (*Network Partition*).

### La Falacia de "Elegir entre C, A y P"
En redes del mundo real (cables rotos, switches caídos, pausas de garbage collection, routers saturados), **las particiones de red son una certeza física inevitable**. Por tanto, **P no es negociable**.
La verdadera disyuntiva en caso de partición de red es:
- **CP (Consistency + Partition Tolerance)**: Si un nodo no puede comunicarse con la mayoría de réplicas para validar la escritura, rechaza la operación (`Error 503 / Timeout`). Prefiere fallar a devolver datos corruptos o divergentes (ej.: MongoDB con réplicas mayoritarias, HBase, etcd).
- **AP (Availability + Partition Tolerance)**: Los nodos aislados aceptan lecturas y escrituras locales. El sistema sigue 100% disponible, pero las réplicas divergen y presentan datos desactualizados (*Stale Reads*) que deben resolverse a posteriori (ej.: Apache Cassandra, Couchbase, DynamoDB en modo eventual).

---

## ⚖️ 2. El Teorema PACELC (La Imagen Completa)

El teorema CAP solo explica qué ocurre **cuando hay una falla de red (Partition)**. Sin embargo, el 99.99% del tiempo la red funciona con normalidad. El teorema **PACELC** (formulado por Daniel Abadi) completa la ecuación:

$$\text{If } \mathbf{P} \text{ (Partition)} \rightarrow \text{choose between } \mathbf{A} \text{ vs } \mathbf{C}; \quad \text{EL } \text{ (Else / Normal State)} \rightarrow \text{choose between } \mathbf{L} \text{ (Latency) vs } \mathbf{C} \text{ (Consistency)}$$

- **PC/EC** (ej.: Bigtable, PostgreSQL sync replication): Si hay partición, elige consistencia; en operación normal, sacrifica latencia para sincronizar todas las réplicas antes de responder.
- **PA/EL** (ej.: DynamoDB por defecto, Cassandra con Local Quorum): Si hay partición, elige disponibilidad; en operación normal, responde con latencia mínima de milisegundos asumiendo consistencia eventual.

---

## 🧩 3. Modelo BASE vs ACID

| Dimensión | ACID (Bases de Datos Relacionales) | BASE (Bases de Datos NoSQL) |
|---|---|---|
| **Filosofía** | Pesimista: la consistencia matemática inmediata es primordial. | Optimista: la disponibilidad y la escala horizontal son prioritarias. |
| **B - Basically Available** | Una transacción bloquea filas o tablas hasta terminar. | El sistema garantiza disponibilidad respondiendo aunque sea con datos locales o degradados. |
| **S - Soft State** | El estado es exacto y determinista en todo momento. | El estado del sistema puede fluctuar con el tiempo sin necesidad de nuevas escrituras externas debido a la propagación entre nodos. |
| **E - Eventual Consistency** | Lectura inmediata siempre ve el último commit (*Read Your Writes*). | Si no se realizan nuevas escrituras, con el tiempo todas las réplicas convergerán hacia el mismo valor. |

---

## 🗳️ 4. Quórums Distribuidos y la Ecuación $W + R > N$

Para coordinar lecturas y escrituras concurrentes sin necesidad de locks centralizados que destruirían el rendimiento, los sistemas distribuidos aplican **Quórum de Réplicas**:

- $N$: Número total de réplicas que almacenan la partición del dato (ej.: $N = 3$).
- $W$: Número mínimo de réplicas que deben confirmar con éxito una escritura para considerarla completada.
- $R$: Número mínimo de réplicas que deben responder a una lectura antes de devolver el dato al cliente.

### La Regla de Oro de Consistencia Fuerte:
$$W + R > N$$

Si se cumple esta desigualdad, el conjunto de nodos leídos ($R$) y el conjunto de nodos escritos ($W$) **se solapan en al menos un nodo en común (Pigeonhole Principle)**. Ese nodo común contendrá la versión más reciente del dato (determinada por su timestamp o número de versión), garantizando **Consistencia Fuerte / Lectura Linealizable**:

- Configuración Clásica ($N=3$):
  - $W = 2$ (Majority Write) y $R = 2$ (Majority Read): $2 + 2 = 4 > 3$. **Consistencia fuerte**.
  - $W = 1$ y $R = 1$: $1 + 1 = 2 < 3$. **Consistencia eventual con alta velocidad y riesgo de lecturas desactualizadas**.
