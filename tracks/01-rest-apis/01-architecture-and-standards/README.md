# 🌐 REST APIs: Arquitectura, Modelos y Estándares RFC

Fundamentos formales de la arquitectura RESTful según el modelo de madurez de Richardson y los estándares IETF (RFC 9110, RFC 7807 / 9457).

---

## 🏛️ 1. Modelo de Madurez de Richardson

Definido por Leonard Richardson, clasifica qué tan alineada está una API con los principios fundamentales de la Web:

```
Nivel 3: Controles Híper-media (HATEOAS)
   ↑
Nivel 2: Verbos HTTP y Códigos de Estado
   ↑
Nivel 1: Recursos Individuales (URIs específicas)
   ↑
Nivel 0: El pantano de POX (Plain Old XML / RPC sobre un único endpoint POST)
```

1. **Nivel 0 (The Swamp of POX / RPC)**:
   - Un único endpoint (ej. `POST /api/service`).
   - El payload JSON/XML define qué acción ejecutar (`{ "action": "getUser", "id": 123 }`).
   - No aprovecha las características del protocolo HTTP.
2. **Nivel 1 (Recursos)**:
   - Múltiples URIs para representar recursos (`/users/123`, `/orders/456`), pero aún utiliza un único verbo (frecuentemente POST) para todas las operaciones.
3. **Nivel 2 (Verbos HTTP y Códigos de Estado)**:
   - La gran mayoría de APIs industriales modernas.
   - Utiliza GET para lectura, POST para creación, PUT/PATCH para actualización y DELETE para eliminación.
   - Retorna códigos de estado HTTP correctos (201 Created, 204 No Content, 404 Not Found, 409 Conflict).
4. **Nivel 3 (HATEOAS - Hypermedia As The Engine Of Application State)**:
   - El recurso retornado contiene hiperenlaces (`_links`) que indican al cliente qué acciones puede realizar a continuación en base al estado del recurso:
   ```json
   {
     "orderId": 456,
     "status": "AWAITING_PAYMENT",
     "total": 99.00,
     "_links": {
       "self": { "href": "/orders/456" },
       "payment": { "href": "/orders/456/payments", "method": "POST" },
       "cancel": { "href": "/orders/456/cancel", "method": "PUT" }
     }
   }
   ```

---

## 📜 2. Semántica de Métodos HTTP (RFC 9110)

Un error común en entrevistas es confundir **Métodos Seguros (*Safe*)** con **Métodos Idempotentes**:

| Método | Seguro (*Safe*) | Idempotente | Semántica RFC 9110 |
|---|---|---|---|
| **GET** | ✅ Sí | ✅ Sí | Lectura de recurso. Cero efectos secundarios en el servidor. Cacheable por defecto. |
| **HEAD** | ✅ Sí | ✅ Sí | Idéntico a GET, pero el servidor NUNCA debe devolver body (solo cabeceras). |
| **OPTIONS** | ✅ Sí | ✅ Sí | Comunica las capacidades del servidor o resuelve preflights CORS. |
| **PUT** | ❌ No | ✅ Sí | Reemplazo completo del recurso en la URI. Si se ejecuta 100 veces, el estado final es idéntico. |
| **DELETE** | ❌ No | ✅ Sí | Eliminación del recurso. La primera llamada borra el recurso; las siguientes retornan 404 o 204, pero el estado del servidor no cambia. |
| **POST** | ❌ No | ❌ No | Procesamiento genérico o creación subordinada. Dos llamadas idénticas pueden crear dos recursos duplicados. |
| **PATCH** | ❌ No | ❌ No (por defecto) | Modificación parcial del recurso (RFC 5789). Puede ser idempotente según el diff, pero la especificación no lo garantiza. |

> [!IMPORTANT]
> **PATCH: JSON Merge Patch (RFC 7396) vs JSON Patch (RFC 6902)**:
> - **JSON Merge Patch (`application/merge-patch+json`)**: Envía solo las propiedades a cambiar: `{ "email": "nuevo@test.com" }`. Si se envía `null`, se elimina la propiedad. No permite eliminar elementos de un array con facilidad.
> - **JSON Patch (`application/json-patch+json`)**: Envía una secuencia de operaciones atómicas:
>   `[ { "op": "replace", "path": "/email", "value": "nuevo@test.com" }, { "op": "remove", "path": "/tags/0" } ]`.

---

## 🛑 3. Formato Estándar de Errores: RFC 7807 y RFC 9457 (*Problem Details*)

El estándar de oro para responder errores en APIs RESTful profesionales (`Content-Type: application/problem+json`):

```json
{
  "type": "https://api.tuempresa.com/errors/insufficient-funds",
  "title": "Saldo Insuficiente",
  "status": 403,
  "detail": "Tu cuenta tiene $12.50 disponible, pero la transacción requiere $50.00.",
  "instance": "/accounts/acc_987/transactions/tx_12345",
  "invalid_params": [
    { "name": "amount", "reason": "Excede el límite de sobregiro." }
  ]
}
```

**Propiedades estándar**:
- `type`: URI con la documentación del error para desarrolladores.
- `title`: Resumen corto y legible para humanos del tipo de problema.
- `status`: Código de estado HTTP (debe coincidir con la cabecera).
- `detail`: Explicación humana contextualizada para esta ocurrencia específica.
- `instance`: URI que identifica la petición o recurso específico que originó el error.

---

## 🔀 4. Estrategias de Versionado de APIs

1. **Versionado por URI Path (`/api/v1/users`)**:
   - *Pros*: Muy simple de implementar, altamente visible, fácil de cachear por proxies y CDNs.
   - *Contras*: Rompe el concepto formal de REST (la URI debe identificar el recurso, no la versión del contrato).
2. **Versionado por Cabecera Personalizada (`X-API-Version: 2`)**:
   - *Pros*: Las URIs se mantienen limpias e inmutables.
   - *Contras*: Requiere configurar la cabecera `Vary: X-API-Version` en todos los CDNs para evitar que usuarios de v1 reciban respuestas cacheadas de v2.
3. **Versionado por Negociación de Contenido (`Accept: application/vnd.company.v2+json`)**:
   - *Pros*: Máxima pureza RESTful. Permite versionar recursos individuales en lugar de toda la API monolítica.
   - *Contras*: Mayor complejidad para clientes móviles, Postman y herramientas de documentación OpenAPI.
