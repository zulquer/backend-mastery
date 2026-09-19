/**
 * ============================================================================
 * 🍃 NOSQL SENIOR LAB 03: CAP THEOREM, NETWORK PARTITIONS & QUORUM (W + R > N)
 * ============================================================================
 *
 * ¿QUÉ APRENDERÁS EN ESTE LABORATORIO?:
 * 1. La mecánica exacta de la ecuación de Quórum Distribuido: W + R > N.
 * 2. Qué ocurre con consistencia eventual débil (W=1, R=1): lecturas desactualizadas (Stale Reads).
 * 3. Cómo el quórum mayoritario (W=3, R=3 en N=5) garantiza consistencia fuerte mediante
 *    el principio del palomar (Pigeonhole Principle).
 * 4. Simulación de una Partición de Red (Split-Brain) y cómo los sistemas CP protegen
 *    la integridad rechazando escrituras en la partición minoritaria.
 *
 * EJECUCIÓN:
 *   npx tsx nosql/05-senior-internals/03-cap-quorum-eventual-consistency.ts
 *   o: npm run nosql:senior:03
 * ============================================================================
 */

import { styleText } from 'node:util';

export interface RecordVersion {
  value: string;
  version: number;
  timestamp: number;
}

export class ReplicaNode {
  public data = new Map<string, RecordVersion>();
  public isOnline = true;

  constructor(public readonly id: string) {}

  write(key: string, value: string, version: number): boolean {
    if (!this.isOnline) return false;
    this.data.set(key, { value, version, timestamp: Date.now() });
    return true;
  }

  read(key: string): RecordVersion | null {
    if (!this.isOnline) return null;
    return this.data.get(key) || null;
  }
}

export class DistributedCluster {
  public nodes: ReplicaNode[] = [];

  constructor(public readonly nodeCount: number = 5) {
    for (let i = 1; i <= nodeCount; i++) {
      this.nodes.push(new ReplicaNode(`Node-${i}`));
    }
  }

  /**
   * Escritura distribuida con nivel de Quórum W
   */
  async writeQuorum(key: string, value: string, version: number, W: number): Promise<boolean> {
    let acks = 0;
    for (const node of this.nodes) {
      if (node.isOnline && node.write(key, value, version)) {
        acks++;
        if (acks >= W) break; // Quórum alcanzado
      }
    }
    return acks >= W;
  }

  /**
   * Lectura distribuida con nivel de Quórum R
   * Consulta R réplicas y escoge la versión más alta (Last-Write-Wins / Version vector)
   */
  async readQuorum(key: string, R: number): Promise<{ value: string; version: number } | null> {
    let responses: RecordVersion[] = [];

    for (const node of this.nodes) {
      if (node.isOnline) {
        const record = node.read(key);
        if (record) responses.push(record);
        if (responses.length >= R) break;
      }
    }

    if (responses.length < R) {
      throw new Error(`QuorumReadFailed: Solo ${responses.length} de ${R} réplicas requeridas respondieron`);
    }

    // Resolver con la versión más reciente entre las réplicas consultadas
    responses.sort((a, b) => b.version - a.version);
    return { value: responses[0].value, version: responses[0].version };
  }
}

// ----------------------------------------------------------------------------
// EJECUCIÓN DEL LABORATORIO
// ----------------------------------------------------------------------------
async function runLab() {
  console.log(styleText('bold', styleText('bgCyan', ' 🍃 NOSQL SENIOR LAB 03: CAP THEOREM & DISTRIBUTED QUORUMS ')));
  console.log(styleText('gray', 'Simulando un clúster de N=5 nodos réplica (estilo Cassandra / DynamoDB / MongoDB)\n'));

  const N = 5;
  const cluster = new DistributedCluster(N);
  const KEY = 'user_balance:acc_501';

  // Inicializar balance con versión 1 en todos los nodos
  for (const node of cluster.nodes) {
    node.write(KEY, '100 EUR', 1);
  }

  // --- ESCENARIO 1: Consistencia Débil (W=1, R=1 => W + R = 2 < 5) ---
  console.log(styleText('bold', styleText('yellow', '🟡 ESCENARIO 1: Consistencia Débil (W=1, R=1, W+R=2 < N)')));
  console.log('1. Cliente escribe nuevo balance ("250 EUR", versión 2) con W=1.');
  await cluster.writeQuorum(KEY, '250 EUR', 2, 1);
  console.log('   ↳ Solo se requirió confirmación del primer nodo (Node-1). Las réplicas 2, 3, 4 y 5 aún tienen la versión 1.');

  // Simulamos que un lector consulta a réplicas que aún no recibieron la propagación
  const staleRead = cluster.nodes[3].read(KEY);
  console.log(styleText('red', `   ↳ ⚠️ Lectura de cliente desde réplica rezagada (Node-4): "${staleRead?.value}" (Versión ${staleRead?.version})`));
  console.log(styleText('yellow', '   ↳ Consecuencia: Stale Read (Lectura de datos viejos por falta de quórum solapado).\n'));

  // --- ESCENARIO 2: Consistencia Fuerte con Quórum Mayoritario (W=3, R=3 => W+R=6 > 5) ---
  console.log(styleText('bold', styleText('green', '🟢 ESCENARIO 2: Consistencia Fuerte con Quórum Mayoritario (W=3, R=3, W+R=6 > N)')));
  console.log('1. Cliente escribe nuevo balance ("500 EUR", versión 3) con W=3 (mayoría estricta).');
  const writeSuccess = await cluster.writeQuorum(KEY, '500 EUR', 3, 3);
  console.log(`   ↳ Confirmación recibida de W=3 nodos: ${writeSuccess ? '✅ Éxito' : 'Fallo'}`);

  console.log('2. Cliente lee con R=3 nodos cualquiera del clúster.');
  const quorumRead = await cluster.readQuorum(KEY, 3);
  console.log(styleText('green', `   ↳ ✅ Valor resuelto por Quórum: "${quorumRead?.value}" (Versión ${quorumRead?.version})`));
  console.log(styleText('cyan', '   ↳ Demostración matemática: Dado que W(3) + R(3) = 6 > 5, al menos 1 nodo consultado garantizó contener la versión más reciente.\n'));

  // --- ESCENARIO 3: Partición de Red (Network Split-Brain Simulation) ---
  console.log(styleText('bold', styleText('magenta', '⚡ ESCENARIO 3: Partición de Red (CAP: CP vs AP)')));
  console.log('💥 Se produce un corte de fibra en el datacenter:');
  console.log('   - Partición A (Mayoritaria): Node-1, Node-2, Node-3 (3 nodos)');
  console.log('   - Partición B (Minoritaria): Node-4, Node-5 (2 nodos aislados)');

  // Desconectamos la partición minoritaria (Node-4 y Node-5 quedan aislados)
  cluster.nodes[3].isOnline = false; // Node-4
  cluster.nodes[4].isOnline = false; // Node-5

  console.log('\nIntento de escritura en Partición A con quórum mayoritario (W=3):');
  const writePartA = await cluster.writeQuorum(KEY, '750 EUR', 4, 3);
  console.log(`   ↳ Partición A tiene 3 nodos disponibles: ${writePartA ? styleText('green', '✅ ESCRITURA CONFIRMADA (Tiene Quórum)') : 'Rechazada'}`);

  console.log('\nIntento de escritura intentando usar solo los 2 nodos de la Partición B (Minoría):');
  const writeMinority = [cluster.nodes[3], cluster.nodes[4]].filter(n => n.isOnline).length >= 3;
  console.log(`   ↳ Partición B sólo tiene 2 nodos: ${writeMinority ? 'Aceptada' : styleText('bold', styleText('red', '❌ RECHAZADA (QuorumLossException: Previene Split-Brain en CP)'))}`);

  console.log(styleText('bold', styleText('cyan', '\n🎯 REGLA DE ORO SENIOR / STAFF:')));
  console.log('Para sistemas que exigen consistencia linealizable (bancos, inventario, auth):');
  console.log('Configura siempre W + R > N (típicamente W = Majority, R = Majority).');
  console.log('Esto garantiza que ningún cliente lea datos obsoletos y evita que una partición de red corrompa el estado.');
}

runLab();
