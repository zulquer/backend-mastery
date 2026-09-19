/**
 * ============================================================================
 * 🌐 REST APIS SENIOR LAB 01: TRANSACTIONAL IDEMPOTENCY KEY ENGINE (RFC DRAFT 9608)
 * ============================================================================
 *
 * ¿QUÉ APRENDERÁS EN ESTE LABORATORIO?:
 * 1. Por qué la idempotencia en métodos no idempotentes (POST) es obligatoria
 *    en pasarelas de pago (Stripe, Adyen) y APIs de misión crítica.
 * 2. El ciclo de vida de una clave de idempotencia:
 *    - Bloqueo en vuelo (`IN_PROGRESS`) para evitar condiciones de carrera.
 *    - Almacenamiento en caché (`RESOLVED`) para replay sin re-ejecución.
 * 3. Detección de alteraciones de payload (Tampering):
 *    Hashing SHA-256 para rechazar peticiones con la misma clave pero diferente body (422).
 * 4. Respuestas formales con cabecera `Idempotent-Replayed: true`.
 *
 * EJECUCIÓN:
 *   npx tsx rest-apis/04-senior-internals/01-idempotency-key-engine.ts
 *   o: npm run api:senior:01
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import { styleText } from 'node:util';

// ----------------------------------------------------------------------------
// 1. TIPOS Y ESTRUCTURA DEL REGISTRO DE IDEMPOTENCIA
// ----------------------------------------------------------------------------
export type IdempotencyStatus = 'IN_PROGRESS' | 'RESOLVED' | 'FAILED';

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  status: IdempotencyStatus;
  createdAt: number;
  responseStatusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
}

export interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

// ----------------------------------------------------------------------------
// 2. MOTOR DE IDEMPOTENCIA (SIMULACIÓN DE DISTRIBUIDO CON REDIS / POSTGRESQL)
// ----------------------------------------------------------------------------
export class IdempotencyEngine {
  private store = new Map<string, IdempotencyRecord>();
  public totalHandlerExecutions = 0;

  /**
   * Genera una huella criptográfica determinista del contenido de la petición
   */
  private computeRequestHash(req: HttpRequest): string {
    const rawPayload = `${req.method.toUpperCase()}:${req.path}:${JSON.stringify(req.body ?? {})}`;
    return createHash('sha256').update(rawPayload).digest('hex');
  }

  /**
   * Middleware de ejecución segura con garantía de idempotencia
   */
  async handle(
    req: HttpRequest,
    handler: (req: HttpRequest) => Promise<HttpResponse>
  ): Promise<HttpResponse> {
    const key = req.headers['idempotency-key'];

    // Si no envía cabecera de idempotencia, se ejecuta sin protección
    if (!key) {
      this.totalHandlerExecutions++;
      return handler(req);
    }

    const currentHash = this.computeRequestHash(req);
    const existing = this.store.get(key);

    if (existing) {
      // CASO A: Petición idéntica aún en proceso (bloqueo concurrente)
      if (existing.status === 'IN_PROGRESS') {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/problem+json' },
          body: {
            type: 'https://api.enterprise.com/errors/concurrent-idempotency',
            title: 'Conflict: Request In Progress',
            status: 409,
            detail: 'Una petición con esta misma Idempotency-Key está siendo procesada actualmente.',
          },
        };
      }

      // CASO B: Detección de Tampering (misma clave, diferente payload)
      if (existing.requestHash !== currentHash) {
        return {
          statusCode: 422,
          headers: { 'Content-Type': 'application/problem+json' },
          body: {
            type: 'https://api.enterprise.com/errors/idempotency-payload-mismatch',
            title: 'Unprocessable Entity: Payload Mismatch',
            status: 422,
            detail: 'Esta Idempotency-Key ya fue utilizada previamente con un cuerpo o parámetros diferentes.',
          },
        };
      }

      // CASO C: Replay legítimo de una transacción completada
      if (existing.status === 'RESOLVED') {
        return {
          statusCode: existing.responseStatusCode!,
          headers: {
            ...existing.responseHeaders,
            'Idempotent-Replayed': 'true',
          },
          body: existing.responseBody,
        };
      }
    }

    // Registrar clave en estado IN_PROGRESS (adquisición de lock atómico)
    this.store.set(key, {
      key,
      requestHash: currentHash,
      status: 'IN_PROGRESS',
      createdAt: Date.now(),
    });

    try {
      // Ejecutar la operación de negocio real (ej. cobro con tarjeta)
      this.totalHandlerExecutions++;
      const response = await handler(req);

      // Persistir respuesta final resuelta
      this.store.set(key, {
        key,
        requestHash: currentHash,
        status: 'RESOLVED',
        createdAt: Date.now(),
        responseStatusCode: response.statusCode,
        responseHeaders: response.headers,
        responseBody: response.body,
      });

      return response;
    } catch (error: any) {
      // Si la transacción falló a nivel de infraestructura, liberamos el lock
      this.store.delete(key);
      throw error;
    }
  }
}

// ----------------------------------------------------------------------------
// 3. LABORATORIO: CASOS DE PRUEBA DE ALTA CONCURRENCIA Y REINTENTOS
// ----------------------------------------------------------------------------
async function runLab() {
  console.log(styleText('bold', styleText('bgCyan', ' 🌐 REST APIS SENIOR: TRANSACTIONAL IDEMPOTENCY KEY ENGINE ')));
  console.log(styleText('gray', 'Simulación del protocolo de idempotencia según el estándar IETF RFC Draft 9608.\n'));

  const engine = new IdempotencyEngine();

  // Handler de negocio ficticio (simula cobro bancario de 20ms)
  let paymentCounter = 1000;
  const paymentHandler = async (req: HttpRequest): Promise<HttpResponse> => {
    await new Promise(r => setTimeout(r, 20)); // Simula I/O con Stripe/DB
    paymentCounter++;
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: {
        paymentId: `pay_${paymentCounter}`,
        amount: req.body.amount,
        currency: req.body.currency,
        status: 'SUCCEEDED',
      },
    };
  };

  const key1 = 'idemp_key_uuid_1111';

  // --------------------------------------------------------------------------
  // ESCENARIO 1: Primera Petición Legítima
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '--- ESCENARIO 1: PRIMERA PETICIÓN (CREACIÓN EXITOSA) ---'));
  const req1: HttpRequest = {
    method: 'POST',
    path: '/v1/payments',
    headers: { 'idempotency-key': key1 },
    body: { amount: 150.0, currency: 'EUR' },
  };

  const res1 = await engine.handle(req1, paymentHandler);
  console.log(`Status: ${res1.statusCode} | Payment ID: ${styleText('green', res1.body.paymentId)}`);
  console.log(`Idempotent-Replayed: ${res1.headers['Idempotent-Replayed'] ?? 'false'}`);
  console.log(`Handler de negocio ejecutado: ${styleText('bold', String(engine.totalHandlerExecutions))} vez`);

  // --------------------------------------------------------------------------
  // ESCENARIO 2: Reintento de Red con la Misma Clave (Replay Automático)
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '\n--- ESCENARIO 2: CLIENTE PIERDE CONEXIÓN Y REINTENTA EXACTAMENTE LA MISMA PETICIÓN ---'));
  const res2 = await engine.handle(req1, paymentHandler);
  console.log(`Status: ${res2.statusCode} | Payment ID: ${styleText('green', res2.body.paymentId)}`);
  console.log(`Idempotent-Replayed: ${styleText('bold', styleText('yellow', res2.headers['Idempotent-Replayed']))}`);
  console.log(`Handler de negocio ejecutado: ${styleText('bold', String(engine.totalHandlerExecutions))} vez (¡Cero cobros dobles!)`);

  // --------------------------------------------------------------------------
  // ESCENARIO 3: Detección de Tampering (Misma clave pero payload modificado)
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '\n--- ESCENARIO 3: PETICIÓN MALICIOSA / CORRUPTA (MISMA CLAVE, DISTINTO IMPORTE) ---'));
  const req3Tampered: HttpRequest = {
    method: 'POST',
    path: '/v1/payments',
    headers: { 'idempotency-key': key1 },
    body: { amount: 9999.0, currency: 'USD' }, // Modificó el importe
  };

  const res3 = await engine.handle(req3Tampered, paymentHandler);
  console.log(`Status: ${styleText('red', String(res3.statusCode))} (Esperado: 422 Unprocessable Entity)`);
  console.log(`Detalle del error RFC 7807: ${styleText('red', res3.body.detail)}`);

  // --------------------------------------------------------------------------
  // ESCENARIO 4: Condición de Carrera en Vuelo (Petición concurrente simultánea)
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '\n--- ESCENARIO 4: DOS PETICIONES EN PARALELO CON LA MISMA CLAVE (RACE CONDITION) ---'));
  const key2 = 'idemp_key_uuid_2222';
  const parallelReq: HttpRequest = {
    method: 'POST',
    path: '/v1/payments',
    headers: { 'idempotency-key': key2 },
    body: { amount: 50.0, currency: 'EUR' },
  };

  // Disparamos ambas concurrentemente
  const [parallelRes1, parallelRes2] = await Promise.all([
    engine.handle(parallelReq, paymentHandler),
    engine.handle(parallelReq, paymentHandler),
  ]);

  console.log(`Petición A -> Status: ${parallelRes1.statusCode}`);
  console.log(`Petición B -> Status: ${styleText('yellow', String(parallelRes2.statusCode))} (Esperado: 409 Conflict si llega mientras A está IN_PROGRESS)`);

  console.log(styleText('bold', styleText('green', '\n🎯 CONCLUSIÓN SENIOR:')));
  console.log(
    '1. El estándar ' + styleText('yellow', 'Idempotency-Key') + ' protege a las pasarelas financieras de cobros duplicados por reintentos de red.\n' +
    '2. La comprobación de ' + styleText('cyan', 'Hash SHA-256') + ' previene ataques donde un atacante reutiliza claves ajenas para transacciones no autorizadas.\n' +
    '3. Los estados ' + styleText('magenta', 'IN_PROGRESS con Lock') + ' mitigan fallos de concurrencia cuando usuarios impacientes hacen doble click rápido.'
  );
}

runLab().catch(console.error);
