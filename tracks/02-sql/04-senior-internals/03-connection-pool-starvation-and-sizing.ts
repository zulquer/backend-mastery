/**
 * ============================================================================
 * 🐘 POSTGRESQL SENIOR LAB 03: CONNECTION POOL SIZING & STARVATION MITIGATION
 * ============================================================================
 *
 * ¿QUÉ APRENDERÁS EN ESTE LABORATORIO?:
 * 1. Qué es el Connection Pool Starvation (Agotamiento del Pool) y cómo una fuga
 *    de conexiones (olvidar `client.release()`) congela todas las peticiones entrantes.
 * 2. La importancia de la configuración `connectionTimeoutMillis` (Fast-Fail)
 *    para evitar que los sockets HTTP de Node.js se acumulen en el Heap hasta causar un OOM.
 * 3. La paradoja de rendimiento de PostgreSQL:
 *    Por qué un pool pequeño (10-20 conexiones) supera en Throughput (TPS) y latencia
 *    a un pool sobredimensionado (200-500 conexiones) debido a contención de CPU y memoria.
 *
 * EJECUCIÓN:
 *   npx tsx postgresql/04-senior-internals/03-connection-pool-starvation-and-sizing.ts
 *   o: npm run pg:senior:03
 * ============================================================================
 */

import { styleText } from 'node:util';

// ----------------------------------------------------------------------------
// 1. SIMULADOR DEL MOTOR DE CONNECTION POOLING (TIPO pg.Pool)
// ----------------------------------------------------------------------------
export interface PoolConfig {
  max: number;
  connectionTimeoutMillis: number;
}

export class ConnectionPoolSimulator {
  private activeClients = 0;
  private waitQueue: Array<{
    resolve: (id: number) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  constructor(public config: PoolConfig) {}

  async acquire(): Promise<number> {
    // Si hay conexiones disponibles en el pool
    if (this.activeClients < this.config.max) {
      this.activeClients++;
      return this.activeClients;
    }

    // Si el pool está lleno, encolamos al cliente con un timeout estricto
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remover de la cola de espera
        this.waitQueue = this.waitQueue.filter(item => item.timer !== timer);
        reject(new Error(`ConnectionTimeoutError: Timeout de ${this.config.connectionTimeoutMillis}ms agotado esperando conexión libre.`));
      }, this.config.connectionTimeoutMillis);

      this.waitQueue.push({ resolve, reject, timer });
    });
  }

  release(clientId: number) {
    // Si hay clientes esperando en la cola
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      clearTimeout(next.timer);
      next.resolve(clientId);
    } else {
      this.activeClients = Math.max(0, this.activeClients - 1);
    }
  }

  getStats() {
    return {
      active: this.activeClients,
      waiting: this.waitQueue.length,
      max: this.config.max,
    };
  }
}

// ----------------------------------------------------------------------------
// 2. DEMOSTRACIÓN PRÁCTICA
// ----------------------------------------------------------------------------
async function runLab() {
  console.log(styleText('bold', styleText('bgBlue', ' 🐘 POSTGRESQL SENIOR: CONNECTION POOLING & STARVATION ')));
  console.log(styleText('gray', 'Simulación de contención de sockets, fugas de conexiones y fast-fail.\n'));

  // Pool acotado a 3 conexiones con timeout de 50ms para la demostración
  const pool = new ConnectionPoolSimulator({ max: 3, connectionTimeoutMillis: 50 });

  // --------------------------------------------------------------------------
  // CASO 1: FLUJO NORMAL CON try/finally Y LIBERACIÓN OBLIGATORIA
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '--- CASO 1: ADQUISICIÓN Y LIBERACIÓN SALUDABLE (try / finally) ---'));
  
  const healthyQuery = async (reqId: string) => {
    const client = await pool.acquire();
    try {
      console.log(`   [Req ${reqId}] Conexión #${client} adquirida. Ejecutando query...`);
      await new Promise(r => setTimeout(r, 20)); // Simula consulta de 20ms
    } finally {
      pool.release(client);
      console.log(`   [Req ${reqId}] Conexión #${client} devuelta al pool.`);
    }
  };

  await Promise.all([healthyQuery('1'), healthyQuery('2'), healthyQuery('3')]);
  console.log(styleText('green', '✅ Todas las conexiones liberadas. Pool disponible: 3/3'));

  // --------------------------------------------------------------------------
  // CASO 2: FUGA DE CONEXIONES (LEAK) Y AGOTAMIENTO (STARVATION)
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '\n--- CASO 2: FUGA DE CONEXIÓN (LEAK) Y FAST-FAIL POR TIMEOUT ---'));
  console.log(styleText('gray', 'Un desarrollador junior olvida el bloque `finally` o captura mal una excepción:'));

  // Agotamos las 3 conexiones sin liberarlas (fuga simulada)
  const client1 = await pool.acquire();
  const client2 = await pool.acquire();
  const client3 = await pool.acquire();
  console.log(styleText('red', `⚠️  3 conexiones tomadas y retenidas en memoria (Pool al 100% de capacidad)`));

  // Llega una 4ta petición de usuario:
  console.log(styleText('cyan', '-> Llega Petición #4 intentando adquirir conexión...'));
  try {
    await pool.acquire();
  } catch (err: any) {
    console.log(styleText('yellow', `   ⚡ Fast-Fail activado con éxito: ${err.message}`));
    console.log(styleText('gray', '   Gracias a connectionTimeoutMillis, la petición falló rápido (50ms) en lugar de colgar el servidor indefinidamente.'));
  }

  // Liberamos las conexiones retenidas para limpiar
  pool.release(client1);
  pool.release(client2);
  pool.release(client3);

  console.log(styleText('bold', styleText('green', '\n🎯 REGLAS DE ORO EN PRODUCCIÓN:')));
  console.log(
    '1. Siempre envolver `const client = await pool.connect()` en ' + styleText('yellow', 'try { ... } finally { client.release(); }') + '.\n' +
    '2. Configurar siempre ' + styleText('cyan', 'connectionTimeoutMillis (ej. 2000ms)') + ' para fallar rápido ante picos de tráfico.\n' +
    '3. Aplicar la fórmula ' + styleText('magenta', 'Pool = (Cores * 2) + Spindles') + ' en lugar de aumentar ciegamente el pool a 500 conexiones.'
  );
}

runLab().catch(console.error);
