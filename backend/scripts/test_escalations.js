import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkEscalations() {
  try {
    const res = await pool.query(`
      SELECT 
        r.id, r.status, r.expected_return_date, r.last_voice_alert_at,
        u.name as user_name, u.phone as user_phone
      FROM requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.status = 'OVERDUE'
    `);
    
    const requests = res.rows;
    const now = dayjs();
    
    console.log(`Found ${requests.length} OVERDUE requests.`);
    
    for (const req of requests) {
      if (!req.expected_return_date) continue;
      
      const returnDate = dayjs(req.expected_return_date);
      const diffDays = now.diff(returnDate, 'day');
      const lastAlert = req.last_voice_alert_at ? new Date(req.last_voice_alert_at) : null;
      const alertedToday = lastAlert ? dayjs(lastAlert).isSame(now, 'day') : false;
      
      console.log(`Request ID ${req.id}: diffDays=${diffDays}, alertedToday=${alertedToday}, userPhone=${req.user_phone}`);
      
      if (!alertedToday) {
        if (diffDays === 1 || diffDays === 3 || diffDays >= 7) {
          console.log(` -> WOULD TRIGGER CALL! (diffDays is ${diffDays})`);
        } else {
          console.log(` -> No call triggered because diffDays (${diffDays}) is not exactly 1, 3, or >= 7.`);
        }
      } else {
         console.log(` -> Already alerted today.`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkEscalations();
