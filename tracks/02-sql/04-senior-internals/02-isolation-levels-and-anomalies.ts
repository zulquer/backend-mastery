/**
 * ============================================================================
 * 🐘 POSTGRESQL SENIOR LAB 02: ISOLATION LEVELS, ANOMALIES & WRITE SKEW
 * ============================================================================
 *
 * ¿QUÉ APRENDERÁS EN ESTE LABORATORIO?:
 * 1. La diferencia real entre `Read Committed`, `Repeatable Read` y `Serializable`.
 * 2. Las 4 anomalías formales:
 *    - Dirty Read (Lectura Sucia)
 *    - Non-Repeatable Read (Lectura No Repetible)
 *    - Phantom Read (Lectura Fantasma)
 *    - Write Skew / Serialization Anomaly (Desviación de Escritura)
 * 3. Cómo Serializable Snapshot Isolation (SSI) en PostgreSQL detecta
 *    grafos de dependencias cruzadas y lanza el error `40001 (serialization_failure)`.
 *
 * EJECUCIÓN:
 *   npx tsx postgresql/04-senior-internals/02-isolation-levels-and-anomalies.ts
 *   o: npm run pg:senior:02
 * ============================================================================
 */

import { styleText } from 'node:util';

// ----------------------------------------------------------------------------
// 1. EL ESCENARIO CLÁSICO DE WRITE SKEW (MÉDICOS DE GUARDIA)
// ----------------------------------------------------------------------------
/**
 * Regla de negocio hospitalaria:
 * "Debe haber SIEMPRE al menos 1 médico de guardia en el hospital".
 * En este momento hay 2 médicos de guardia: Dr. Alice y Dr. Bob.
 *
 * Al mismo tiempo:
 * - Alice solicita darse de baja de la guardia. Su transacción comprueba: ¿Hay >= 2 médicos? Sí (Alice y Bob).
 * - Bob solicita darse de baja de la guardia. Su transacción comprueba: ¿Hay >= 2 médicos? Sí (Alice y Bob).
 *
 * En `Read Committed` o `Repeatable Read`: Ambas transacciones hacen COMMIT.
 * ¡Resultado catastrófico: CERO médicos de guardia en el hospital!
 */

export interface Doctor {
  id: number;
  name: string;
  onCall: boolean;
}

export class HospitalSchedulerSimulator {
  public doctors: Doctor[] = [
    { id: 1, name: 'Dra. Alice', onCall: true },
    { id: 2, name: 'Dr. Bob', onCall: true },
  ];

  /**
   * Intento de baja bajo REPEATABLE READ (Sufre Write Skew)
   */
  async leaveOnCallRepeatableRead(doctorId: number): Promise<{ success: boolean; reason?: string }> {
    // Snapshot capturado al inicio
    const onCallCount = this.doctors.filter(d => d.onCall).length;
    await new Promise(r => setTimeout(r, 20)); // Simula latencia concurrente

    if (onCallCount >= 2) {
      const doc = this.doctors.find(d => d.id === doctorId)!;
      doc.onCall = false;
      return { success: true };
    }

    return { success: false, reason: 'Debe quedar al menos 1 médico de guardia' };
  }

  /**
   * Intento de baja bajo SERIALIZABLE (SSI detecta el conflicto y aborta con 40001)
   */
  async leaveOnCallSerializable(
    doctorId: number,
    dependencyTracker: { conflictDetected: boolean }
  ): Promise<{ success: boolean; code?: string }> {
    const onCallCount = this.doctors.filter(d => d.onCall).length;
    await new Promise(r => setTimeout(r, 20));

    if (onCallCount >= 2) {
      if (dependencyTracker.conflictDetected) {
        // PostgreSQL detecta ciclo en el grafo de dependencias de lectura/escritura (si-locks)
        throw new Error('40001: could not serialize access due to read/write dependencies among transactions');
      }
      dependencyTracker.conflictDetected = true; // Marca que la primera transacción consumió la condición
      const doc = this.doctors.find(d => d.id === doctorId)!;
      doc.onCall = false;
      return { success: true };
    }

    return { success: false };
  }
}

// ----------------------------------------------------------------------------
// 2. DEMOSTRACIÓN PRÁCTICA
// ----------------------------------------------------------------------------
async function runLab() {
  console.log(styleText('bold', styleText('bgBlue', ' 🐘 POSTGRESQL SENIOR: ISOLATION LEVELS & WRITE SKEW ')));
  console.log(styleText('gray', 'Demostración de anomalías de concurrencia y detección de dependencias SSI.\n'));

  // --------------------------------------------------------------------------
  // CASO 1: WRITE SKEW EN REPEATABLE READ (FALLO DE REGLA DE NEGOCIO)
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '--- CASO 1: WRITE SKEW EN NIVEL REPEATABLE READ ---'));
  const hospital1 = new HospitalSchedulerSimulator();
  console.log('Médicos iniciales de guardia:', hospital1.doctors.filter(d => d.onCall).map(d => d.name));

  console.log(styleText('gray', '-> Alice y Bob intentan darse de baja exactamente al mismo tiempo...'));
  await Promise.all([
    hospital1.leaveOnCallRepeatableRead(1),
    hospital1.leaveOnCallRepeatableRead(2),
  ]);

  const remainingOnCall1 = hospital1.doctors.filter(d => d.onCall);
  console.log(`Médicos de guardia tras el commit simultáneo: ${remainingOnCall1.length}`);
  console.log(
    styleText('red', '❌ [ANOMALÍA DETECTADA: WRITE SKEW]:') +
    '\n   Ambas transacciones leyeron un snapshot válido, pero su combinación violó la restricción.' +
    '\n   ¡El hospital se quedó sin médicos de guardia!'
  );

  // --------------------------------------------------------------------------
  // CASO 2: PROTECCIÓN CON SERIALIZABLE (SERIALIZATION FAILURE 40001)
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '\n--- CASO 2: SOLUCIÓN CON NIVEL SERIALIZABLE (SSI) ---'));
  const hospital2 = new HospitalSchedulerSimulator();
  const tracker = { conflictDetected: false };

  console.log(styleText('gray', '-> Mismo intento simultáneo bajo isolation level SERIALIZABLE:'));

  const results = await Promise.allSettled([
    hospital2.leaveOnCallSerializable(1, tracker),
    hospital2.leaveOnCallSerializable(2, tracker),
  ]);

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const doctorName = i === 0 ? 'Alice' : 'Bob';
    if (res.status === 'fulfilled') {
      console.log(`   Transacción [${doctorName}]: ${styleText('green', '✅ COMMIT exitoso')}`);
    } else {
      console.log(`   Transacción [${doctorName}]: ${styleText('bold', styleText('yellow', '⚡ ROLLBACK AUTOMÁTICO (40001)'))} -> ${res.reason.message}`);
    }
  }

  const remainingOnCall2 = hospital2.doctors.filter(d => d.onCall);
  console.log(`\nMédicos de guardia restantes en hospital: ${styleText('bold', styleText('green', String(remainingOnCall2.length)))} (${remainingOnCall2[0].name})`);
  console.log(styleText('green', '✅ Restricción de negocio preservada al 100%.'));

  console.log(styleText('bold', styleText('cyan', '\n🎯 RESUMEN DE NIVELES DE AISLAMIENTO EN POSTGRESQL:')));
  console.log(`
┌───────────────────┬──────────────┬────────────────────┬──────────────┬──────────────┐
│ Nivel de Aislamiento│ Dirty Read   │ Non-Repeatable Read│ Phantom Read │ Write Skew   │
├───────────────────┼──────────────┼────────────────────┼──────────────┼──────────────┤
│ Read Committed (Def)│ Imposible    │ Posible            │ Posible      │ Posible      │
│ Repeatable Read   │ Imposible    │ Imposible          │ Imposible    │ Posible      │
│ Serializable (SSI)│ Imposible    │ Imposible          │ Imposible    │ Imposible    │
└───────────────────┴──────────────┴────────────────────┴──────────────┴──────────────┘
  `);
}

runLab().catch(console.error);
