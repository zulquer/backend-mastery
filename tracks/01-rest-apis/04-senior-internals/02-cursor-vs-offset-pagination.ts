/**
 * ============================================================================
 * 🌐 REST APIS SENIOR LAB 02: CURSOR KEYSET PAGINATION VS OFFSET ANTIPATTERN
 * ============================================================================
 *
 * ¿QUÉ APRENDERÁS EN ESTE LABORATORIO?:
 * 1. La degradación algorítmica de OFFSET / LIMIT:
 *    Por qué `OFFSET 1000000` obliga a la base de datos a leer 1,000,020 filas ($O(N)$).
 * 2. La anomalía de consistencia de OFFSET en sistemas concurrentes:
 *    Cómo una inserción en tiempo real provoca que el usuario vea registros duplicados o se salte registros.
 * 3. La implementación de Paginación por Cursor (Keyset Pagination):
 *    Índice B-Tree compuesto $O(1)$, cursores opacos en Base64 y consistencia absoluta.
 *
 * EJECUCIÓN:
 *   npx tsx rest-apis/04-senior-internals/02-cursor-vs-offset-pagination.ts
 *   o: npm run api:senior:02
 * ============================================================================
 */

import { styleText } from 'node:util';

export interface OrderRecord {
  id: number;
  createdAt: number;
  customer: string;
  total: number;
}

// ----------------------------------------------------------------------------
// 1. SIMULACIÓN DE BASE DE DATOS EN MEMORIA
// ----------------------------------------------------------------------------
export class DatabaseSimulator {
  private rows: OrderRecord[] = [];

  constructor(initialCount: number) {
    const baseTime = 1700000000000;
    for (let i = 1; i <= initialCount; i++) {
      this.rows.push({
        id: i,
        createdAt: baseTime + i * 1000,
        customer: `Cliente #${i}`,
        total: Math.round(10 + Math.random() * 100),
      });
    }
  }

  insertNewOrderAtTop(order: OrderRecord) {
    // Inserta una nueva orden con timestamp más reciente (al principio de la lista ordenada desc)
    this.rows.push(order);
  }

  /**
   * ENFOQUE TRADICIONAL: OFFSET / LIMIT
   * Simula SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset
   */
  paginateWithOffset(limit: number, offset: number): { data: OrderRecord[]; scannedRows: number } {
    // Para ordenar descendentemente
    const sorted = [...this.rows].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);

    // En una BD real, el motor debe recorrer físicamente (offset + limit) filas
    const scannedRows = Math.min(sorted.length, offset + limit);
    const data = sorted.slice(offset, offset + limit);

    return { data, scannedRows };
  }

  /**
   * ENFOQUE SENIOR: CURSOR KEYSET PAGINATION
   * Simula WHERE (created_at, id) < (:cursorCreatedAt, :cursorId) ORDER BY created_at DESC, id DESC LIMIT :limit
   */
  paginateWithCursor(limit: number, cursor?: string): { data: OrderRecord[]; nextCursor: string | null; scannedRows: number } {
    const sorted = [...this.rows].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);

    let filtered = sorted;
    if (cursor) {
      // Decodificar cursor opaco en Base64
      const decodedJson = Buffer.from(cursor, 'base64url').toString('utf8');
      const { createdAt, id } = JSON.parse(decodedJson);

      // Búsqueda directa en índice compuesto (created_at, id)
      filtered = sorted.filter(row => row.createdAt < createdAt || (row.createdAt === createdAt && row.id < id));
    }

    const data = filtered.slice(0, limit);
    const lastItem = data[data.length - 1];

    let nextCursor: string | null = null;
    if (lastItem && filtered.length > limit) {
      // Generar nuevo cursor opaco
      const payload = JSON.stringify({ createdAt: lastItem.createdAt, id: lastItem.id });
      nextCursor = Buffer.from(payload).toString('base64url');
    }

    // En una BD con índice B-Tree, el motor salta directamente a la posición en tiempo constante O(1)
    const scannedRows = data.length;

    return { data, nextCursor, scannedRows };
  }
}

// ----------------------------------------------------------------------------
// 2. DEMOSTRACIÓN PRÁCTICA DEL PROBLEMA DE DUPLICADOS Y SALTOS
// ----------------------------------------------------------------------------
async function runLab() {
  console.log(styleText('bold', styleText('bgCyan', ' 🌐 REST APIS SENIOR: CURSOR KEYSET VS OFFSET ANTIPATTERN ')));
  console.log(styleText('gray', 'Demostración de anomalías de concurrencia y análisis de planes de ejecución.\n'));

  const pageSize = 3;
  const db = new DatabaseSimulator(10);

  // --------------------------------------------------------------------------
  // CASO A: EL ANTIPATRÓN DE OFFSET BAJO MUTACIONES CONCURRENTES
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '--- 🔴 CASO A: PAGINACIÓN CON OFFSET (ANOMALÍA DE ELEMENTOS DUPLICADOS) ---'));

  // Paso 1: El usuario carga la Página 1 (OFFSET = 0)
  const page1Offset = db.paginateWithOffset(pageSize, 0);
  console.log(styleText('cyan', '1. Usuario consulta Página 1 (OFFSET 0, LIMIT 3):'));
  console.log(page1Offset.data.map(o => `   [ID: ${o.id}] ${o.customer} (${new Date(o.createdAt).toISOString().slice(11, 19)})`).join('\n'));

  // Paso 2: Mientras el usuario lee la pantalla, un evento concurrente inserta 2 órdenes nuevas más recientes:
  console.log(styleText('magenta', '\n⚡ EVENTO CONCURRENTE: Se insertan 2 órdenes nuevas en la base de datos (ID: 991, 992)...'));
  db.insertNewOrderAtTop({ id: 991, createdAt: 1700000000000 + 20000, customer: 'Cliente VIP #991', total: 500 });
  db.insertNewOrderAtTop({ id: 992, createdAt: 1700000000000 + 21000, customer: 'Cliente VIP #992', total: 650 });

  // Paso 3: El usuario hace click en "Siguiente Página" (OFFSET = 3)
  const page2Offset = db.paginateWithOffset(pageSize, 3);
  console.log(styleText('cyan', '\n2. Usuario consulta Página 2 (OFFSET 3, LIMIT 3):'));
  console.log(page2Offset.data.map(o => `   [ID: ${o.id}] ${o.customer} (${new Date(o.createdAt).toISOString().slice(11, 19)})`).join('\n'));

  // Comprobación de duplicados:
  const idsPage1 = new Set(page1Offset.data.map(o => o.id));
  const duplicates = page2Offset.data.filter(o => idsPage1.has(o.id));

  console.log(styleText('red', `\n❌ [ANOMALÍA DETECTADA]:`));
  console.log(`   El usuario vio los elementos ${duplicates.map(d => `[ID: ${d.id}]`).join(', ')} en la Página 1 Y OTRA VEZ en la Página 2.`);
  console.log(`   El desplazamiento del OFFSET rompió la consistencia de la lectura del usuario.`);

  // --------------------------------------------------------------------------
  // CASO B: LA SOLUCIÓN SENIOR CON CURSOR (KEYSET)
  // --------------------------------------------------------------------------
  console.log(styleText('yellow', '\n--- 🟢 CASO B: PAGINACIÓN CON CURSOR (CONSISTENCIA GARANTIZADA) ---'));

  // Reiniciamos la base de datos
  const dbCursor = new DatabaseSimulator(10);

  // Paso 1: El usuario consulta Página 1 sin cursor
  const page1Cursor = dbCursor.paginateWithCursor(pageSize);
  console.log(styleText('cyan', '1. Usuario consulta Página 1 (Cursor Inicial):'));
  console.log(page1Cursor.data.map(o => `   [ID: ${o.id}] ${o.customer}`).join('\n'));
  console.log(`   Next Cursor recibido: ${styleText('yellow', page1Cursor.nextCursor!)}`);

  // Paso 2: Ocurre exactamente la misma inserción concurrente de 2 registros:
  console.log(styleText('magenta', '\n⚡ EVENTO CONCURRENTE: Se insertan 2 órdenes nuevas en la base de datos...'));
  dbCursor.insertNewOrderAtTop({ id: 991, createdAt: 1700000000000 + 20000, customer: 'Cliente VIP #991', total: 500 });
  dbCursor.insertNewOrderAtTop({ id: 992, createdAt: 1700000000000 + 21000, customer: 'Cliente VIP #992', total: 650 });

  // Paso 3: El usuario consulta Página 2 enviando el cursor de la página 1
  const page2Cursor = dbCursor.paginateWithCursor(pageSize, page1Cursor.nextCursor!);
  console.log(styleText('cyan', '\n2. Usuario consulta Página 2 con cursor opaco:'));
  console.log(page2Cursor.data.map(o => `   [ID: ${o.id}] ${o.customer}`).join('\n'));

  const cursorPage1Ids = new Set(page1Cursor.data.map(o => o.id));
  const cursorDuplicates = page2Cursor.data.filter(o => cursorPage1Ids.has(o.id));

  console.log(styleText('green', `\n✅ [CONSISTENCIA ABSOLUTA]:`));
  console.log(`   Duplicados encontrados: ${cursorDuplicates.length} (CERO)`);
  console.log(`   El cursor saltó de forma determinista exactamente al registro siguiente a través del índice B-Tree.`);

  // --------------------------------------------------------------------------
  // COMPARATIVA DE RENDIMIENTO TEÓRICO EN BASE DE DATOS
  // --------------------------------------------------------------------------
  console.log(styleText('bold', styleText('cyan', '\n📊 COMPARATIVA DE IMPACTO EN BASE DE DATOS (A 1,000,000 DE REGISTROS):')));
  console.log(`
┌───────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ Métrica               │ OFFSET 1,000,000             │ CURSOR KEYSET                │
├───────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Filas leídas en disco │ 1,000,020 filas escaneadas   │ 20 filas leídas exactamente  │
│ Complejidad temporal  │ O(N) lineal                  │ O(1) tiempo constante B-Tree │
│ Consumo de RAM en BD  │ Muy alto (buffer de descarte)│ Prácticamente cero           │
│ Estabilidad concurrente│ Inestable (saltos/duplicados)│ 100% Inmune a inserciones    │
└───────────────────────┴──────────────────────────────┴──────────────────────────────┘
  `);
}

runLab().catch(console.error);
