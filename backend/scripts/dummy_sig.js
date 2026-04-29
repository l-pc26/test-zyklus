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

async function addDummySignature() {
  try {
    // A fake base64 png image
    const dummySig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const query = `
      UPDATE requests 
      SET digital_signature = $1, terms_accepted = true, signature_date = NOW()
      WHERE id = (SELECT id FROM requests ORDER BY id DESC LIMIT 1)
      RETURNING id;
    `;
    const res = await pool.query(query, [dummySig]);
    console.log('Updated request ID:', res.rows[0]?.id);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

addDummySignature();
