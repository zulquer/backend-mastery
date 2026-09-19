/**
 * ============================================================================
 * 🍃 NOSQL SENIOR LAB 02: DISTRIBUTED LOCKS, LEASES & ATOMIC LUA RELEASES
 * ============================================================================
 *
 * ¿QUÉ APRENDERÁS EN ESTE LABORATORIO?:
 * 1. La anomalía del "Split-Lock" / "Premature Expiration":
 *    Qué ocurre cuando un worker tarda más que el TTL de su lock y borra
 *    accidentalmente el lock recién adquirido por otro worker si usa un simple DEL.
 * 2. La implementación del patrón de Distributed Lock seguro en Redis:
 *    - Token criptográfico único por worker (UUIDv4/Random).
 *    - Adquisición atómica con bandera NX y tiempo de arrendamiento (PX lease).
 *    - Liberación atómica mediante script Lua evaluado en el servidor Redis.
 * 3. Demostración práctica de cómo se preserva la exclusión mutua.
 *
 * EJECUCIÓN:
 *   npx tsx nosql/05-senior-internals/02-distributed-lock-redlock.ts
 *   o: npm run nosql:senior:02
 * ============================================================================
 */

import { randomUUID } from 'node:crypto';
import { styleText } from 'node:util';

// ----------------------------------------------------------------------------
// 1. SIMULADOR DEL SERVIDOR REDIS (SINGLE-THREADED EVENT-DRIVEN)
// ----------------------------------------------------------------------------
export class RedisServerSimulator {
  private storage = new Map<string, { value: string; expiresAt: number }>();

  /**
   * Equivalente atómico a: SET key value NX PX ttlMs
   */
  async set(key: string, value: string, options?: { nx?: boolean; px?: number }): Promise<boolean> {
    const now = Date.now();
    const current = this.storage.get(key);

    // Si ya existe y no ha expirado, NX falla
    if (current && current.expiresAt > now) {
      if (options?.nx) {
        return false;
      }
    }

    const ttl = options?.px ?? 10_000;
    this.storage.set(key, { value, expiresAt: now + ttl });
    return true;
  }

  /**
   * Antipatrón: Borrado ciego con DEL key
   */
  async del(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  /**
   * Patrón Senior: Script Lua atómico que verifica propiedad del token antes de borrar
   *
   * if redis.call("get", KEYS[1]) == ARGV[1] then
   *     return redis.call("del", KEYS[1])
   * else
   *     return 0
   * end
   */
  async evalAtomicReleaseLua(key: string, expectedToken: string): Promise<boolean> {
    const now = Date.now();
    const current = this.storage.get(key);

    if (!current || current.expiresAt <= now) {
      return false; // El lock ya no existe o expiró naturalmente
    }

    if (current.value === expectedToken) {
      this.storage.delete(key);
      return true; // Token coincide: Liberación exitosa
    }

    // ¡CRÍTICO!: El token no coincide. Pertenece a OTRO worker. ¡No lo borramos!
    return false;
  }

  getActiveHolder(key: string): string | null {
    const now = Date.now();
    const current = this.storage.get(key);
    if (!current || current.expiresAt <= now) return null;
    return current.value;
  }
}

// ----------------------------------------------------------------------------
// 2. GESTOR DE LOCKS DISTRIBUIDOS
// ----------------------------------------------------------------------------
export class DistributedLockManager {
  constructor(private redis: RedisServerSimulator) {}

  /**
   * Adquisición de lock con lease time
   */
  async acquireLock(resourceKey: string, leaseMs: number): Promise<string | null> {
    const lockToken = randomUUID();
    const acquired = await this.redis.set(`lock:${resourceKey}`, lockToken, {
      nx: true,
      px: leaseMs
    });

    return acquired ? lockToken : null;
  }

  /**
   * Liberación vulnerable (DEL ciego)
   */
  async releaseVulnerable(resourceKey: string): Promise<void> {
    await this.redis.del(`lock:${resourceKey}`);
  }

  /**
   * Liberación atómica segura con Lua
   */
  async releaseSafe(resourceKey: string, lockToken: string): Promise<boolean> {
    return this.redis.evalAtomicReleaseLua(`lock:${resourceKey}`, lockToken);
  }
}

// ----------------------------------------------------------------------------
// 3. LABORATORIO DIDÁCTICO Y SIMULACIÓN
// ----------------------------------------------------------------------------
async function runLab() {
  console.log(styleText('bold', styleText('bgYellow', ' 🍃 NOSQL SENIOR LAB 02: DISTRIBUTED LOCK & ATOMIC LUA RELEASE ')));
  console.log(styleText('gray', 'Demostrando el peligro de pausas de GC / latencia y la solución de exclusión mutua.\n'));

  const redis = new RedisServerSimulator();
  const lockManager = new DistributedLockManager(redis);
  const RESOURCE = 'order:invoice:9021';
  const LEASE_TIME_MS = 60; // Lock expira en 60ms

  // --- PARTE 1: La trampa del borrado ciego (DEL) ---
  console.log(styleText('bold', styleText('red', '🔴 ESCENARIO 1: Antipatrón de liberación ciega (DEL)')));
  console.log('1. Worker A adquiere el lock con TTL de 60ms.');
  const tokenA = await lockManager.acquireLock(RESOURCE, LEASE_TIME_MS);
  console.log(`   ↳ Lock adquirido por Worker A (Token: ${tokenA?.slice(0, 8)}...)`);

  console.log('2. Worker A sufre una pausa de Garbage Collection o lentitud de red (duerme 100ms)...');
  await new Promise(r => setTimeout(r, 100)); // El lock de A ya expiró en Redis

  console.log('3. Worker B intenta adquirir el lock ahora que ha expirado.');
  const tokenB = await lockManager.acquireLock(RESOURCE, LEASE_TIME_MS);
  console.log(`   ↳ Lock adquirido por Worker B (Token: ${tokenB?.slice(0, 8)}...)`);

  console.log('4. Worker A se despierta de su pausa y ejecuta DEL ciego...');
  await lockManager.releaseVulnerable(RESOURCE);
  console.log(styleText('red', '   ↳ 💥 Worker A borró el lock que en realidad pertenecía a Worker B!'));

  const activeHolder1 = redis.getActiveHolder(`lock:${RESOURCE}`);
  console.log(`   ↳ ¿Quién tiene el lock ahora en Redis?: ${activeHolder1 ? 'Worker B' : styleText(['bold', 'red'], 'NADIE (Exclusión mutua violada)')}`);
  console.log(styleText('yellow', '   ↳ Consecuencia: Un Worker C ahora puede entrar simultáneamente mientras Worker B sigue ejecutándose!\n'));

  // --- PARTE 2: Liberación segura con script Lua atómico ---
  console.log(styleText('bold', styleText('green', '🟢 ESCENARIO 2: Liberación segura mediante Script Lua Atómico')));
  console.log('1. Worker X adquiere el lock con TTL de 60ms.');
  const tokenX = await lockManager.acquireLock(RESOURCE, LEASE_TIME_MS);
  console.log(`   ↳ Lock adquirido por Worker X (Token: ${tokenX?.slice(0, 8)}...)`);

  console.log('2. Worker X sufre una pausa inesperada (duerme 100ms)...');
  await new Promise(r => setTimeout(r, 100)); // Lock expiró

  console.log('3. Worker Y adquiere legítimamente el lock.');
  const tokenY = await lockManager.acquireLock(RESOURCE, LEASE_TIME_MS);
  console.log(`   ↳ Lock adquirido por Worker Y (Token: ${tokenY?.slice(0, 8)}...)`);

  console.log('4. Worker X se despierta e intenta liberar el lock con su token caducado...');
  const releasedX = await lockManager.releaseSafe(RESOURCE, tokenX!);
  console.log(`   ↳ Intento de liberación de Worker X: ${releasedX ? 'Éxito' : styleText(['bold', 'green'], 'RECHAZADO ATÓMICAMENTE POR LUA')}`);
  console.log('   ↳ Lua comprobó: "current_token !== worker_token". No borró nada.');

  const activeHolder2 = redis.getActiveHolder(`lock:${RESOURCE}`);
  console.log(`   ↳ ¿Quién sigue manteniendo el lock?: ${styleText(['bold', 'green'], `Worker Y (${tokenY?.slice(0, 8)}...)`)}`);
  console.log(styleText('cyan', '   ↳ ✅ La exclusión mutua se mantuvo intacta y el trabajo de Worker Y está 100% protegido.\n'));

  console.log(styleText('bold', styleText('magenta', '🎯 CONCLUSIÓN ARQUITECTURAL:')));
  console.log('En Redis, un lock distribuido NUNCA debe liberarse con un comando DEL ciego.');
  console.log('Siempre debe usarse un token único y un script Lua atómico para validar la propiedad del recurso.');
}

runLab();
