import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { processEscalations } from './services/escalationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function forceTest() {
  try {
    console.log('--- RESETEANDO ALERTAS DEL DÍA DE HOY PARA PRUEBAS ---');
    await pool.query("UPDATE requests SET last_voice_alert_at = NULL WHERE status = 'OVERDUE'");
    console.log('Alertas reseteadas.');
    
    console.log('--- FORZANDO EJECUCIÓN DEL SISTEMA DE ESCALACIÓN ---');
    await processEscalations();
    console.log('--- SISTEMA DE ESCALACIÓN FINALIZADO ---');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

forceTest();
