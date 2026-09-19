/**
 * ============================================================================
 * 🌐 REST APIS SENIOR LAB 03: SLIDING WINDOW COUNTER RATE LIMITER & RFC HEADERS
 * ============================================================================
 *
 * ¿QUÉ APRENDERÁS EN ESTE LABORATORIO?:
 * 1. La vulnerabilidad de los limitadores de tasa por Ventana Fija (Fixed Window):
 *    Permiten el doble del límite en los bordes de la ventana (tráfico en ráfaga / burst).
 * 2. El algoritmo matemático de Sliding Window Counter:
 *    Aproximación ponderada suave en tiempo O(1) con memoria constante sin almacenar timestamps individuales.
 * 3. Las cabeceras estándar de la industria (RFC 6585 e IETF Draft):
 *    `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` y respuesta `429 Too Many Requests`.
 *
 * EJECUCIÓN:
 *   npx tsx rest-apis/04-senior-internals/03-rate-limiter-sliding-window.ts
 *   o: npm run api:senior:03
 * ============================================================================
 */

import { styleText } from 'node:util';

// ----------------------------------------------------------------------------
// 1. MOTOR SLIDING WINDOW COUNTER
// ----------------------------------------------------------------------------
export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds?: number;
}

export class SlidingWindowRateLimiter {
  // Almacena: key -> { previousCount, currentCount, currentWindowStart }
  private buckets = new Map<string, { prevCount: number; currentCount: number; currentWindowStart: number }>();

  /**
   * @param windowMs Duración de la ventana en milisegundos (ej. 60,000ms = 1 minuto)
   * @param maxRequests Límite máximo de peticiones por ventana
   */
  constructor(
    public readonly windowMs: number,
    public readonly maxRequests: number
  ) {}

  check(key: string, now: number = Date.now()): RateLimitDecision {
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { prevCount: 0, currentCount: 0, currentWindowStart: windowStart };
      this.buckets.set(key, bucket);
    }

    // Si hemos avanzado de ventana de tiempo
    if (windowStart > bucket.currentWindowStart) {
      const windowsPassed = (windowStart - bucket.currentWindowStart) / this.windowMs;
      if (windowsPassed === 1) {
        // La ventana actual pasa a ser la ventana previa
        bucket.prevCount = bucket.currentCount;
      } else {
        // Pasaron 2 o más ventanas sin tráfico
        bucket.prevCount = 0;
      }
      bucket.currentCount = 0;
      bucket.currentWindowStart = windowStart;
    }

    // Cálculo ponderado de la ventana deslizante:
    // peso = fracción de tiempo transcurrida dentro de la ventana actual
    const timeIntoCurrentWindow = now - bucket.currentWindowStart;
    const currentWeight = timeIntoCurrentWindow / this.windowMs;
    const prevWeight = 1 - currentWeight;

    // Conteo estimado suave de peticiones en los últimos windowMs:
    const estimatedCount = Math.floor(bucket.prevCount * prevWeight + bucket.currentCount);

    const resetSeconds = Math.ceil((bucket.currentWindowStart + this.windowMs - now) / 1000);

    if (estimatedCount >= this.maxRequests) {
      // Tasa excedida: RECHAZAR con HTTP 429
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetSeconds,
        retryAfterSeconds: resetSeconds,
      };
    }

    // PERMITIR: Incrementamos el contador de la ventana actual
    bucket.currentCount++;
    const remaining = Math.max(0, this.maxRequests - (estimatedCount + 1));

    return {
      allowed: true,
      limit: this.maxRequests,
      remaining,
      resetSeconds,
    };
  }
}

// ----------------------------------------------------------------------------
// 2. LABORATORIO PRÁCTICO
// ----------------------------------------------------------------------------
async function runLab() {
  console.log(styleText('bold', styleText('bgCyan', ' 🌐 REST APIS SENIOR: SLIDING WINDOW COUNTER RATE LIMITER ')));
  console.log(styleText('gray', 'Simulación del algoritmo ponderado para mitigar ráfagas y cabeceras RFC.\n'));

  // Configuramos: 5 peticiones permitidas por ventana de 1 segundo (1000ms)
  const limiter = new SlidingWindowRateLimiter(1000, 5);
  const clientIp = '192.168.1.100';

  console.log(styleText('yellow', '--- PASO 1: CLIENTE ENVÍA 5 PETICIONES RÁPIDAS (DENTRO DEL LÍMITE) ---'));
  for (let i = 1; i <= 5; i++) {
    const decision = limiter.check(clientIp);
    console.log(
      `Petición #${i} -> ${decision.allowed ? styleText('green', '✅ 200 OK') : styleText('red', '❌ 429')} | ` +
      `RateLimit-Limit: ${decision.limit} | ` +
      `RateLimit-Remaining: ${styleText('yellow', String(decision.remaining))} | ` +
      `RateLimit-Reset: ${decision.resetSeconds}s`
    );
  }

  console.log(styleText('yellow', '\n--- PASO 2: CLIENTE ENVÍA PETICIÓN #6 Y #7 (EXCEDIENDO LA TASA) ---'));
  for (let i = 6; i <= 7; i++) {
    const decision = limiter.check(clientIp);
    console.log(
      `Petición #${i} -> ${decision.allowed ? styleText('green', '✅ 200 OK') : styleText('bold', styleText('red', '❌ 429 Too Many Requests'))} | ` +
      `RateLimit-Remaining: ${decision.remaining} | ` +
      `Retry-After: ${styleText('bold', styleText('yellow', `${decision.retryAfterSeconds}s`))}`
    );
  }

  console.log(styleText('yellow', '\n--- PASO 3: ESPERANDO QUE AVANCE LA VENTANA DE TIEMPO (1.1s) ---'));
  await new Promise(r => setTimeout(r, 1100));

  console.log(styleText('cyan', '-> Nueva petición tras expirar la ventana de tiempo:'));
  const decisionAfterWait = limiter.check(clientIp);
  console.log(
    `Petición #8 -> ${decisionAfterWait.allowed ? styleText('green', '✅ 200 OK (Acceso restaurado)') : styleText('red', '❌ 429')} | ` +
    `RateLimit-Remaining: ${styleText('yellow', String(decisionAfterWait.remaining))} | ` +
    `RateLimit-Reset: ${decisionAfterWait.resetSeconds}s`
  );

  console.log(styleText('bold', styleText('green', '\n🎯 RESUMEN ARQUITECTÓNICO SENIOR:')));
  console.log(
    '1. El algoritmo ' + styleText('yellow', 'Sliding Window Counter') + ' evita que un cliente consuma el doble de cuota en el cambio de minuto.\n' +
    '2. Las cabeceras ' + styleText('cyan', 'RateLimit-Limit, RateLimit-Remaining y RateLimit-Reset') + ' permiten que los clientes adapten su tasa con backoff exponencial.\n' +
    '3. En arquitecturas distribuidas con múltiples pods de Node.js, este algoritmo se implementa en ' +
    styleText('magenta', 'Redis con scripts Lua atómicos') + ' para mantener estado compartido sin locks.'
  );
}

runLab().catch(console.error);
