import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

async function checkData() {
  try {
    const sigRes = await pool.query(`SELECT id, digital_signature IS NOT NULL as has_sig FROM requests WHERE digital_signature IS NOT NULL LIMIT 5;`);
    console.log('Requests with sig:', sigRes.rows);

    const logRes = await pool.query(`SELECT target_id, target_type FROM audit_logs ORDER BY timestamp DESC LIMIT 10;`);
    console.log('Recent logs:', logRes.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkData();
