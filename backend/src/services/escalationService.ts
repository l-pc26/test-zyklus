import cron from 'node-cron';
import { Pool } from 'pg';
import dayjs from 'dayjs';
import { triggerVoiceAlert, sendPushNotification } from './notificationService.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getAdminPhones(): Promise<string[]> {
  try {
    const res = await pool.query("SELECT phone FROM users WHERE role = 'ADMIN_PATRIMONIAL' AND phone IS NOT NULL");
    return res.rows.map(r => r.phone);
  } catch (err) {
    console.error('Error fetching admin phones', err);
    return [];
  }
}

async function markVoiceAlert(requestId: number) {
  try {
    await pool.query('UPDATE requests SET last_voice_alert_at = NOW() WHERE id = $1', [requestId]);
  } catch (err) {
    console.error(`Error marking voice alert for request ${requestId}`, err);
  }
}

function hasAlertedToday(lastAlertAt: Date | null): boolean {
  if (!lastAlertAt) return false;
  return dayjs(lastAlertAt).isSame(dayjs(), 'day');
}

function isWithinCallWindow(): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chihuahua',
      hour: 'numeric',
      hour12: false
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    // 9 AM to 3 PM (15:00) inclusive
    return hour >= 9 && hour <= 15;
  } catch (err) {
    // Fallback in case of timezone error, assume UTC-6
    const hour = new Date().getUTCHours() - 6;
    const localHour = hour < 0 ? hour + 24 : hour;
    return localHour >= 9 && localHour <= 15;
  }
}

export async function processEscalations() {
  console.log('Running escalation processing...');
  try {
    const query = `
      SELECT 
        r.id, r.status, r.created_at, r.expected_return_date, r.last_voice_alert_at,
        u.id as user_id, u.name as user_name, u.phone as user_phone,
        m.name as manager_name, m.phone as manager_phone,
        a.name as asset_name
      FROM requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users m ON u.manager_id = m.id
      LEFT JOIN assets a ON r.asset_id = a.id
      WHERE r.status IN ('PENDING', 'ACTIVE', 'ACTIVE_INTERNAL', 'OVERDUE')
    `;
    const res = await pool.query(query);
    const requests = res.rows;
    
    const now = dayjs();
    const adminPhones = await getAdminPhones();
    const canCall = isWithinCallWindow();

    if (!canCall) {
      console.log('Outside of call window (9 AM - 3 PM Chihuahua time). Voice calls will be skipped this run.');
    }

    for (const req of requests) {
      const assetName = req.asset_name || 'equipo';
      const userName = req.user_name ? req.user_name.split(' ')[0] : 'Usuario';
      const managerName = req.manager_name ? req.manager_name.split(' ')[0] : 'Manager';
      const lastAlert = req.last_voice_alert_at ? new Date(req.last_voice_alert_at) : null;
      const alertedToday = hasAlertedToday(lastAlert);

      // 1. SOLICITUDES PENDIENTES (> 5 min)
      if (req.status === 'PENDING') {
        const diffMinutes = now.diff(dayjs(req.created_at), 'minute');
        if (diffMinutes >= 5 && req.manager_phone && !alertedToday && canCall) {
          const message = `tienes solicitudes de equipo pendientes de aprobación en Zyklus. Por favor, revisa la plataforma.`;
          const success = await triggerVoiceAlert(req.manager_phone, managerName, message);
          if (success) await markVoiceAlert(req.id);
        }
        continue;
      }

      // 2. AVISOS PREVENTIVOS y ATRASOS (solo ACTIVE / OVERDUE con fecha esperada)
      if (!req.expected_return_date) continue;

      const returnDate = dayjs(req.expected_return_date);
      const diffHours = returnDate.diff(now, 'hour');
      const diffDays = now.diff(returnDate, 'day');

      if (['ACTIVE', 'ACTIVE_INTERNAL'].includes(req.status)) {
        if (diffHours === 48 || diffHours === 24) {
          await sendPushNotification(
            req.user_id,
            'Aviso de Vencimiento',
            `Tu préstamo de ${assetName} vence en ${diffHours} horas.`,
            '/my-loans'
          );
        }
      }

      if (req.status === 'OVERDUE' && !alertedToday && canCall) {
        if (diffDays === 1 && req.user_phone) {
          const msg = `tu préstamo del activo ${assetName} venció ayer. Por favor, devuélvelo en caseta lo antes posible.`;
          const success = await triggerVoiceAlert(req.user_phone, userName, msg);
          if (success) await markVoiceAlert(req.id);
        } 
        else if (diffDays === 3 && req.manager_phone) {
          const msg = `el usuario ${userName} tiene un préstamo vencido hace 3 días del activo ${assetName}. Por favor, gestiona su devolución.`;
          const success = await triggerVoiceAlert(req.manager_phone, managerName, msg);
          if (success) await markVoiceAlert(req.id);
        }
        else if (diffDays >= 7) {
          let called = false;
          if (req.manager_phone) {
            const msg = `escalación crítica. El usuario ${userName} tiene un préstamo vencido hace 7 días del activo ${assetName}. Por favor, revisa la plataforma.`;
            const s = await triggerVoiceAlert(req.manager_phone, managerName, msg);
            if (s) called = true;
          }
          for (const adminPhone of adminPhones) {
            const msgAdmin = `Aviso crítico. El usuario ${userName} tiene el activo ${assetName} vencido hace 7 días.`;
            await triggerVoiceAlert(adminPhone, 'Administrador Patrimonial', msgAdmin);
            called = true;
          }
          if (called) await markVoiceAlert(req.id);
        }
      }
    }
  } catch (err) {
    console.error('Error in processEscalations:', err);
  }
}

export function initEscalationCron() {
  cron.schedule('0 * * * *', () => {
    processEscalations();
  });
  console.log('Escalation cron job initialized (runs every hour).');
}
