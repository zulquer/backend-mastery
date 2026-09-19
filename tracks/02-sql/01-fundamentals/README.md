# 🐘 PostgreSQL Level 01: Fundamentals

Principios transaccionales ACID, tipos de datos críticos y modelado relacional riguroso.

---

## 🎯 1. Las Propiedades ACID en Detalle

1. **Atomicidad (Atomicity)**:
   - Todo o nada. Si una transacción modifica 10 tablas y la última sentencia falla, todas las modificaciones anteriores se descartan (`ROLLBACK`).
   - Soporte para puntos de guardado intermedios con `SAVEPOINT` y `ROLLBACK TO SAVEPOINT`.
2. **Consistencia (Consistency)**:
   - La base de datos pasa de un estado válido a otro estado válido.
   - Garantizada por restricciones del esquema: `FOREIGN KEY`, `UNIQUE`, `CHECK (balance >= 0)` y `NOT NULL`.
3. **Aislamiento (Isolation)**:
   - Controla la visibilidad de los cambios no confirmados entre transacciones simultáneas para evitar lecturas sucias o sobreescrituras.
4. **Durabilidad (Durability)**:
   - Una vez confirmada una transacción (`COMMIT`), los datos sobreviven incluso a un corte repentino de energía.
   - En PostgreSQL se garantiza mediante el **WAL (Write-Ahead Logging)**: los cambios se escriben secuencialmente en el log de disco antes de que las páginas de datos en memoria se vuelquen físicamente al almacenamiento permanente.

---

## 💎 2. Tipos de Datos Críticos y Decisiones de Arquitectura

### A. Dinero y Finanzas: `NUMERIC` vs `DOUBLE PRECISION`
- **Error Grave**: Usar `FLOAT` o `DOUBLE PRECISION` para saldos bancarios. El estándar IEEE 754 de coma flotante introduce errores de redondeo binario (`0.1 + 0.2 !== 0.3`).
- **Regla Senior**: Usar siempre `NUMERIC(18, 4)` o almacenar centavos enteros como `BIGINT`.

### B. Fechas y Tiempos: `TIMESTAMPTZ` vs `TIMESTAMP`
- `TIMESTAMP WITHOUT TIME ZONE`: Almacena fecha y hora ciega sin contexto de huso horario. Si un usuario en Madrid guarda `15:00` y un servidor en Nueva York lo lee, se producen desfases de horas.
- `TIMESTAMP WITH TIME ZONE (TIMESTAMPTZ)`: PostgreSQL convierte automáticamente la fecha recibida a **UTC** antes de escribirla en disco, y la formatea según la zona horaria de la sesión del cliente al leer. Es el único estándar aceptable para producción.

### C. Identificadores Primarios: `UUIDv4` vs `UUIDv7` vs `BIGINT`
- `BIGINT (IDENTITY)`: Ocupa solo 8 bytes y es secuencial, pero expone métricas de negocio (los clientes pueden adivinar cuántos pedidos tienes) y no es seguro para sistemas distribuidos.
- `UUIDv4`: Aleatorio de 16 bytes. Seguro contra adivinación, pero **destruye el rendimiento de los índices B-Tree** a partir de millones de filas debido a la fragmentación de páginas de disco (*B-Tree Page Splitting*).
- `UUIDv7 (RFC 9562)`: **La solución moderna**: Combina un prefijo de timestamp de milisegundos con entropía aleatoria. Mantiene la unicidad global y la impenetrabilidad de UUID, pero es **monótonamente creciente**, permitiendo escrituras contiguas y compactas en el árbol B-Tree.

### D. ¿Cuándo usar `JSONB` en PostgreSQL?
- `JSONB` descompone el JSON en formato binario optimizado para búsquedas rápidas con operadores (`@>`, `?`, `->>`) e índices GIN.
- **Cuándo usarlo**: Esquemas verdaderamente variables (atributos dinámicos de productos en un marketplace, configuraciones de usuario personalizadas, payloads de webhooks externos).
- **Cuándo NO usarlo**: Para relaciones fundamentales entre entidades de negocio (usuarios, pedidos, facturas). Normalizar en tablas relacionales aprovecha claves foráneas, validación estricta y menor consumo de almacenamiento.
