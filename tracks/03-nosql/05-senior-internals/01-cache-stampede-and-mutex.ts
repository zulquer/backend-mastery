/**
 * ============================================================================
 * 🍃 NOSQL SENIOR LAB 01: THUNDERING HERD, CACHE STAMPEDE & SINGLEFLIGHT MUTEX
 * ============================================================================
 *
 * ¿QUÉ APRENDERÁS EN ESTE LABORATORIO?:
 * 1. El fenómeno de "Cache Stampede" (Thundering Herd) en sistemas de alto tráfico:
 *    Por qué cuando una clave con 50 req/ms expira, el pool de la base de datos colapsa.
 * 2. La implementación del patrón "SingleFlight / Promise Deduplication Mutex":
 *    Cómo asegurar que 50 peticiones simultáneas desencadenen EXACTAMENTE 1 consulta a la BD,
 *    mientras las 49 restantes esperan en memoria y reutilizan el resultado atómicamente.
 * 3. Comparativa de latencia y llamadas físicas a base de datos.
 *
 * EJECUCIÓN:
 *   npx tsx nosql/05-senior-internals/01-cache-stampede-and-mutex.ts
 *   o: npm run nosql:senior:01
 * ============================================================================
 */

import { styleText } from 'node:util';

// ----------------------------------------------------------------------------
// 1. SIMULACIÓN DE PERSISTENCIA LENTA (PostgreSQL / MongoDB)
// ----------------------------------------------------------------------------
export class DatabaseSimulator {
  public queryCount = 0;

  async fetchUserProfile(userId: string): Promise<{ id: string; name: string; tier: string }> {
    this.queryCount++;
    // Simula latencia de I/O de base de datos de 80ms
    await new Promise(resolve => setTimeout(resolve, 80));
    return {
      id: userId,
      name: `Usuario-${userId}`,
      tier: 'Enterprise-VIP'
    };
  }
}

// ----------------------------------------------------------------------------
// 2. CACHÉ INGENUA: VULNERABLE A CACHE STAMPEDE
// ----------------------------------------------------------------------------
export class NaiveCacheService {
  private cache = new Map<string, any>();

  constructor(private db: DatabaseSimulator) {}

  async get(key: string): Promise<any> {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    // ANTIPATRÓN SENIOR: Si 50 peticiones concurrentes leen aquí a la vez,
    // todas reciben 'undefined' y las 50 llaman a la base de datos en paralelo.
    const freshData = await this.db.fetchUserProfile(key);
    this.cache.set(key, freshData);
    return freshData;
  }
}

// ----------------------------------------------------------------------------
// 3. CACHÉ RESILIENTE CON SINGLEFLIGHT PROMISE MUTEX (SENIOR / STAFF PATTERN)
// ----------------------------------------------------------------------------
export class SingleFlightCacheService {
  private cache = new Map<string, any>();
  // Mapa de promesas activas en vuelo ("in-flight requests")
  private inFlightRequests = new Map<string, Promise<any>>();

  constructor(private db: DatabaseSimulator) {}

  async get(key: string): Promise<any> {
    // 1. Fast path: Si ya está en caché, retornamos inmediatamente
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    // 2. SingleFlight Mutex: ¿Ya hay una petición en curso trayendo esta clave exacta?
    const existingFlight = this.inFlightRequests.get(key);
    if (existingFlight) {
      // Reutilizamos la promesa existente en memoria. ¡No tocamos la BD!
      return existingFlight;
    }

    // 3. Somos la primera petición ("Líder del grupo"):
    // Creamos la promesa y la registramos en el mapa de promesas en vuelo
    const flightPromise = (async () => {
      try {
        const freshData = await this.db.fetchUserProfile(key);
        this.cache.set(key, freshData);
        return freshData;
      } finally {
        // Al resolverse o fallar, limpiamos la petición en vuelo
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, flightPromise);
    return flightPromise;
  }
}

// ----------------------------------------------------------------------------
// 4. EJECUCIÓN Y COMPARATIVA DE ALTO IMPACTO
// ----------------------------------------------------------------------------
async function runLab() {
  console.log(styleText('bold', styleText('bgGreen', ' 🍃 NOSQL SENIOR LAB 01: THUNDERING HERD & SINGLEFLIGHT MUTEX ')));
  console.log(styleText('gray', 'Simulando un pico de 50 peticiones HTTP concurrentes que solicitan la misma clave caliente expirada...\n'));

  const CONCURRENT_REQUESTS = 50;
  const USER_KEY = 'usr_prod_99482';

  // --- ESCENARIO 1: Caché ingenua (Colapso por Stampede) ---
  console.log(styleText('bold', styleText('red', '🔴 ESCENARIO 1: Caché estándar sin deduplicación de vuelos')));
  const db1 = new DatabaseSimulator();
  const naiveCache = new NaiveCacheService(db1);

  const start1 = performance.now();
  const promises1: Promise<any>[] = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises1.push(naiveCache.get(USER_KEY));
  }
  await Promise.all(promises1);
  const duration1 = (performance.now() - start1).toFixed(2);

  console.log(`- Peticiones concurrentes procesadas: ${CONCURRENT_REQUESTS}`);
  console.log(`- ⚠️  Consultas reales lanzadas a la Base de Datos: ${styleText(['bold', 'red'], String(db1.queryCount))}`);
  console.log(`- Tiempo total de resolución: ${duration1} ms`);
  console.log(styleText('yellow', '  ↳ Resultado: Colapso de pool y desperdicio masivo de CPU en la BD.\n'));

  // --- ESCENARIO 2: SingleFlight Mutex (Arquitectura Senior) ---
  console.log(styleText('bold', styleText('green', '🟢 ESCENARIO 2: Caché con SingleFlight Promise Mutex')));
  const db2 = new DatabaseSimulator();
  const resilientCache = new SingleFlightCacheService(db2);

  const start2 = performance.now();
  const promises2: Promise<any>[] = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises2.push(resilientCache.get(USER_KEY));
  }
  await Promise.all(promises2);
  const duration2 = (performance.now() - start2).toFixed(2);

  console.log(`- Peticiones concurrentes procesadas: ${CONCURRENT_REQUESTS}`);
  console.log(`- ✅ Consultas reales lanzadas a la Base de Datos: ${styleText(['bold', 'green'], String(db2.queryCount))}`);
  console.log(`- Tiempo total de resolución: ${duration2} ms`);
  console.log(styleText('cyan', `  ↳ Reducción de carga en BD: ${((1 - db2.queryCount / CONCURRENT_REQUESTS) * 100).toFixed(1)}%`));
  console.log(styleText('gray', '  ↳ 1 sola petición fue a la base de datos; las otras 49 reutilizaron la misma Promise en memoria.\n'));

  console.log(styleText('bold', styleText('magenta', '🎯 CONCLUSIÓN ARQUITECTURAL:')));
  console.log('El patrón SingleFlight es la primera línea de defensa en sistemas con Redis/Memcached.');
  console.log('Evita que la expiración natural de una clave caliente tumbe los microservicios aguas abajo.');
}

runLab();
