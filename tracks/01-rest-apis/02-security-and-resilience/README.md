# 🌐 REST APIs: Seguridad, Resiliencia y Control de Tráfico

Guía técnica de protección perimetral, CORS preflights, autenticación y mitigación de ataques de denegación de servicio.

---

## 🛡️ 1. Mecánica Interna de CORS (Cross-Origin Resource Sharing)

CORS es un mecanismo del navegador (no del servidor ni de herramientas como Postman o cURL) para impedir que un origen malicioso lea datos de otro origen no autorizado.

### A. Peticiones Simples (*Simple Requests*):
No disparan preflight si cumplen:
- Métodos: `GET`, `HEAD` o `POST`.
- Cabeceras manuales limitadas a: `Accept`, `Accept-Language`, `Content-Language`, `Content-Type`.
- `Content-Type` limitado a: `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`.

### B. Peticiones con Preflight (`OPTIONS`):
Cualquier petición que envíe `Content-Type: application/json` o incluya cabeceras como `Authorization` dispara automáticamente una petición previa `OPTIONS`:

```http
OPTIONS /api/v1/orders HTTP/1.1
Origin: https://frontend.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization, content-type
```

El servidor debe responder con:
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://frontend.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

> [!CAUTION]
> **La Trampa de Credenciales y Asteriscos**:
> Si una petición incluye credenciales (cookies o cabeceras `Authorization` en requests con `credentials: 'include'`), el navegador **bloqueará inmediatamente la respuesta** si el servidor responde con:
> `Access-Control-Allow-Origin: *`.
> **Regla de Oro**: Si `Access-Control-Allow-Credentials: true`, el origen **debe reflejar explícitamente el dominio origen validado contra una whitelist** (`Access-Control-Allow-Origin: https://frontend.com`).

---

## 🔑 2. Autenticación: Stateful Sessions vs Stateless JWTs

| Criterio | Stateful (Sesiones en Redis) | Stateless (JWT Bearer) |
|---|---|---|
| **Almacenamiento en Cliente** | Cookie `sessionId` (HttpOnly, Secure, SameSite=Strict). | Memoria JS o Cookie segura (¡NUNCA `localStorage`!). |
| **Revocación Inmediata** | **Instantánea**: basta con borrar la clave en Redis. | **Compleja**: el token es válido hasta su expiración a menos que se mantenga una lista negra distribuida (lo que rompe el concepto de stateless). |
| **Escala Horizontal** | Requiere acceso centralizado a Redis / DB con latencia de red. | Descentralizada: cualquier servicio con la clave pública RSA puede validar la firma en CPU sin I/O. |

### Patrón Recomendado: Refresh Token Rotation con Detección de Replay:
1. **Access Token**: JWT firmado de muy corta duración (5 a 15 minutos).
2. **Refresh Token**: UUID criptográfico opaco almacenado en base de datos y enviado en cookie `HttpOnly`.
3. Cada vez que el cliente renueva el access token, el servidor invalida el refresh token anterior y entrega uno nuevo (**rotación**).
4. **Detección de Replay**: Si un atacante roba un refresh token y el usuario legítimo ya lo había usado, el servidor detecta el reuso, marca toda la "familia de tokens" como comprometida y revoca todas las sesiones del usuario inmediatamente.

---

## 🚦 3. Algoritmos de Rate Limiting y Cabeceras RFC

| Algoritmo | Cómo Funciona | Pros | Contras |
|---|---|---|---|
| **Fixed Window** | Cuenta peticiones en ventanas fijas (ej. 00:00 a 00:01). | Muy fácil de implementar con un contador simple. | Permite ráfagas del doble del límite en los bordes de la ventana (ej. 100 req al 00:59 y 100 req al 01:00). |
| **Token Bucket** | Un cubo con tokens que se llena a tasa constante. Cada petición consume 1 token. | Soporta ráfagas controladas (*bursts*). Muy utilizado en AWS y Stripe. | Requiere calcular la reposición de tokens en cada tick. |
| **Sliding Window Counter** | Pondera el tráfico de la ventana anterior con el tiempo transcurrido de la actual. | Suaviza el tráfico en los límites con memoria constante $O(1)$. | Aproximación matemática con un margen de error menor al 0.5%. |

### Cabeceras Estándar (RFC 6585 y Draft IETF):
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 30
Content-Type: application/problem+json
```

---

## 🛡️ 4. Cabeceras Defensivas Esenciales (Helmet)

1. **`Strict-Transport-Security (HSTS)`**: `max-age=31536000; includeSubDomains; preload` (fuerza HTTPS en navegadores).
2. **`X-Content-Type-Options: nosniff`**: Impide que el navegador interprete un archivo `.txt` o imagen como código JavaScript malicioso (MIME sniffing).
3. **`X-Frame-Options: DENY`**: Impide que la API sea renderizada dentro de un `<iframe>`, neutralizando ataques de Clickjacking.
