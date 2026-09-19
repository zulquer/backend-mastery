/**
 * ============================================================================
 * 🐘 POSTGRESQL SENIOR LAB 01: ROW LOCKS & `SKIP LOCKED` CONCURRENT QUEUES
 * ============================================================================
 *
 * ¿QUÉ APRENDERÁS EN ESTE LABORATORIO?:
 * 1. La vulnerabilidad de Race Conditions en saldos bancarios si no se usa bloqueo pesimista.
 * 2. La solución con `SELECT ... FOR UPDATE`: bloqueo a nivel de fila durante la transacción.
 * 3. La arquitectura de Colas Distribuidas en PostgreSQL con `FOR UPDATE SKIP LOCKED`:
 *    Cómo múltiples workers concurrentes en Node.js pueden procesar trabajos de la misma tabla
 *    a máxima velocidad sin colisiones, sin esperas y sin contención de locks.
 *
 * EJECUCIÓN:
 *   npx tsx postgresql/04-senior-internals/01-concurrency-locks-and-skip-locked.ts
 *   o: npm run pg:senior:01
 * ============================================================================
 */

import { styleText } from 'node:util';

// ----------------------------------------------------------------------------
// 1. SIMULACIÓN DEL MOTOR DE BASE DE DATOS Y GESTOR DE LOCKS
// ----------------------------------------------------------------------------
export interface AccountRow {
  id: number;
  holder: string;
  balance: number;
}

export interface JobRow {
  id: number;
  payload: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED';
}

export class PostgresEngineSimulator {
  public accounts = new Map<number, AccountRow>();
  public jobs: JobRow[] = [];
  private lockedRows = new Set<number>(); // IDs de filas actualmente bloqueadas por transacciones activas

  constructor() {
    this.accounts.set(1, { id: 1, holder: 'Empresa Principal', balance: 100 });
    for (let i = 1; i <= 6; i++) {
      this.jobs.push({ id: i, payload: `Tarea Crítica #${i}`, status: 'PENDING' });
    }
  }

  /**
   * Intenta adquirir un lock exclusivo sobre una fila (SELECT FOR UPDATE)
   */
  async acquireRowLock(rowId: number, timeoutMs = 2000): Promise<boolean> {
    const start = Date.now();
    while (this.lockedRows.has(rowId)) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`LockTimeout: No se pudo adquirir lock sobre fila ${rowId}`);
      }
      await new Promise(r => setTimeout(r, 10)); // Espera cooperativa
    }
    this.lockedRows.add(rowId);
    return true;
  }

  releaseRowLock(rowId: number) {
    this.lockedRows.delete(rowId);
  }

  /**
   * Patrón FOR UPDATE SKIP LOCKED:
   * Encuentra el siguiente trabajo pendiente que NO esté bloqueado por ningún otro worker.
   */
  async fetchNextJobSkipLocked(workerName: string): Promise<JobRow | null> {
    for (const job of this.jobs) {
      if (job.status === 'PENDING' && !this.lockedRows.has(job.id)) {
        // Bloqueamos la fila inmediatamente
        this.lockedRows.add(job.id);
        job.status = 'PROCESSING';
        console.log(
          `   [${styleText('cyan', workerName)}] Adquirió lock atómico sobre Job #${job.id} (SKIP LOCKED)`
        );
        return job;
      }
    }
    return null; // No hay más trabajos libres
  }
}

// ----------------------------------------------------------------------------
// 2. DEMOSTRACIÓN PRÁCTICA
// ----------------------------------------------------------------------------
async function runLab() {
  console.log(styleText('bold', styleText('bgBlue', ' 🐘 POSTGRESQL SENIOR: ROW LOCKS & SKIP LOCKED ')));
  console.log(styleText('gray', 'Simulación de transacciones ACID y colas concurrentes de alto rendimiento.\n'));

  const pg = new PostgresEngineSimulator();

  // --------------------------------------------------------------------------
  // PARTE 1: TRANSFERENCIAS BANCARIAS CON `SELECT ... FOR UPDATE`
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '--- PARTE 1: CONCURRENCIA BANCARIA Y `SELECT ... FOR UPDATE` ---'));
  console.log(`Saldo inicial de Cuenta 1: $${pg.accounts.get(1)?.balance}`);

  // Simulamos dos peticiones concurrentes simultáneas intentando retirar $80 cada una
  // Si no hubiera lock, ambas leerían $100, aprobarían el retiro y dejarían el saldo en -$60 (DESASTRE).
  const withdrawWithLock = async (reqId: string, amount: number) => {
    console.log(`[Petición ${reqId}] ⏳ Iniciando transacción BEGIN...`);
    await pg.acquireRowLock(1);
    try {
      console.log(`[Petición ${reqId}] 🔒 Lock exclusivo adquirido (SELECT * FROM accounts WHERE id = 1 FOR UPDATE)`);
      const account = pg.accounts.get(1)!;
      await new Promise(r => setTimeout(r, 30)); // Simula latencia de procesamiento

      if (account.balance >= amount) {
        account.balance -= amount;
        console.log(`[Petición ${reqId}] ${styleText('green', '✅ Retiro aprobado')} de $${amount}. Saldo restante: $${account.balance}`);
        return true;
      } else {
        console.log(`[Petición ${reqId}] ${styleText('red', '❌ Retiro rechazado')}: Saldo insuficiente ($${account.balance} < $${amount})`);
        return false;
      }
    } finally {
      pg.releaseRowLock(1);
      console.log(`[Petición ${reqId}] 🔓 COMMIT y liberación de lock.`);
    }
  };

  console.log(styleText('gray', '-> Lanzando dos retiros simultáneos de $80 (Saldo total disponible: $100)...'));
  await Promise.all([
    withdrawWithLock('A', 80),
    withdrawWithLock('B', 80),
  ]);

  console.log(`Saldo final en base de datos: $${pg.accounts.get(1)?.balance} (¡Cero saldo negativo!)`);

  // --------------------------------------------------------------------------
  // PARTE 2: COLA DE MENSAJES DISTRIBUIDA CON `FOR UPDATE SKIP LOCKED`
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '\n--- PARTE 2: COLA DE MENSAJES CON `FOR UPDATE SKIP LOCKED` ---'));
  console.log(styleText('gray', 'Tres workers en paralelo consumen 6 tareas. Sin Redis ni RabbitMQ, directo en PostgreSQL:\n'));

  const worker = async (name: string) => {
    while (true) {
      const job = await pg.fetchNextJobSkipLocked(name);
      if (!job) break;

      // Simular procesamiento del trabajo
      await new Promise(r => setTimeout(r, 25));
      job.status = 'COMPLETED';
      pg.releaseRowLock(job.id);
      console.log(`   [${styleText('green', name)}] Completó Job #${job.id}`);
    }
  };

  // Lanzar 3 workers en paralelo compitiendo por la misma tabla
  await Promise.all([
    worker('Worker-Alpha'),
    worker('Worker-Beta'),
    worker('Worker-Gamma'),
  ]);

  const allCompleted = pg.jobs.every(j => j.status === 'COMPLETED');
  if (allCompleted) {
    console.log(
      styleText('bgGreen', styleText('black', '\n ✅ TODAS LAS TAREAS PROCESADAS ')) +
      styleText('green', ' Cero colisiones, cero bloqueos mutuos. Rendimiento masivo.')
    );
  }

  console.log(styleText('bold', styleText('cyan', '\n🎯 CONCLUSIÓN SENIOR:')));
  console.log(
    '1. ' + styleText('yellow', 'SELECT FOR UPDATE') + ' garantiza consistencia estricta en transacciones financieras críticas.\n' +
    '2. ' + styleText('yellow', 'FOR UPDATE SKIP LOCKED') + ' permite construir colas distribuidas fiables directamente en PostgreSQL,\n' +
    '   evitando introducir dependencias externas pesadas si el volumen de eventos no supera los cientos de miles por segundo.'
  );
}

runLab().catch(console.error);
