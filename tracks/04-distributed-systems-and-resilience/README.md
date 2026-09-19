# 🛡️ Backend Level 04: Patrones de Sistemas Distribuidos y Resiliencia

Circuit Breaker, Transactional Outbox Pattern, Exponential Backoff con Jitter, Bulkhead y consistencia eventual.

---

## ⚡ 1. Circuit Breaker (Cortacircuitos de Producción)

Cuando un servicio aguas abajo (ej.: pasarela de pagos) empieza a fallar o responder con 30 segundos de latencia, seguir enviándole peticiones satura los sockets y la memoria del servicio que llama (*Cascading Failure*):

```
       [ CLOSED ]  <--- (Operación normal; peticiones pasan)
           |
       (Fallo sostenido > 50% en ventana de tiempo)
           v
        [ OPEN ]   ---> (Peticiones fallan instantáneamente en 0ms sin tocar la red)
           |
       (Tras periodo de enfriamiento, ej. 30 segundos)
           v
      [ HALF-OPEN ] ---> (Pasa 1 petición de prueba: si funciona -> CLOSED; si falla -> OPEN)
```

---

## 📮 2. El Patrón Transactional Outbox

### El Problema de la Doble Escritura Inconsistente (*Dual-Write Problem*)
En arquitecturas de microservicios dirigidas por eventos:
```typescript
await db.orders.create(order);       // 1. Escribe en PostgreSQL
await messageBroker.publish(order);  // 2. Publica en Kafka / RabbitMQ
```
- Si la base de datos confirma pero el servidor se apaga antes de publicar en Kafka: **el evento nunca se envía**.
- Si publicas primero y la base de datos rechaza la transacción por una restricción: **enviaste un evento falso al mundo exterior**.

### La Solución Staff: Transactional Outbox
1. En la **misma transacción ACID** de la base de datos, se guarda la orden en `orders` y un registro en la tabla `outbox_events`.
2. Como ambas tablas están en la misma base de datos, la atomicidad está 100% garantizada.
3. Un proceso desacoplado (**Debezium CDC** o un worker que consulta con `SKIP LOCKED`) lee la tabla `outbox_events` y la publica en Kafka de forma asíncrona garantizando entrega **At-Least-Once**.
