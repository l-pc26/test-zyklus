import { query } from '../db/index.js';

const isValidUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s ?? '');

/** Crea una notificación para un usuario. */
export async function createNotif(
  userId: string,
  title: string,
  message: string,
  type = 'INFO',
  requestId?: number,
  assetId?: string
): Promise<void> {
  if (!userId || !isValidUUID(userId)) return;
  await query(
    `INSERT INTO notifications (user_id, request_id, asset_id, title, message, type, is_read)
     VALUES ($1, $2, $3, $4, $5, $6, false)`,
    [userId, requestId ?? null, assetId ?? null, title, message, type]
  );
}

/** Crea notificaciones para todos los usuarios con un rol dado. */
export async function notifyByRole(
  role: string,
  title: string,
  message: string,
  type = 'INFO',
  requestId?: number,
  assetId?: string
): Promise<void> {
  const result = await query<{ id: string }>('SELECT id FROM users WHERE role = $1', [role]);
  const users = result.rows ?? [];
  for (const u of users) {
    await createNotif(u.id, title, message, type, requestId, assetId);
  }
}

// --- Twilio Configuration ---
import twilio from 'twilio';
import webpush from 'web-push';
import dotenv from 'dotenv';
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const apiKeySid = process.env.TWILIO_API_KEY_SID || '';
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || '';
const twilioNumber = process.env.TWILIO_FROM_NUMBER || '';
const flowSid = process.env.TWILIO_STUDIO_FLOW_SID || '';

let twilioClient: twilio.Twilio | null = null;

try {
  // Primero intentamos usar API Keys (más seguro)
  if (apiKeySid && apiKeySecret && accountSid) {
    twilioClient = twilio(apiKeySid, apiKeySecret, { accountSid });
    console.log('Twilio client initialized with API Key');
  } 
  // Si no hay API Keys, usamos el clásico Auth Token
  else if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
    console.log('Twilio client initialized with Auth Token');
  } else {
    console.warn('Twilio credentials missing. Voice alerts disabled.');
  }
} catch (error) {
  console.error('Twilio initialization failed:', error);
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+52${cleaned}`;
  }
  if (!phone.startsWith('+')) {
    return `+${cleaned}`;
  }
  return phone;
}

export async function triggerVoiceAlert(to: string, nombre: string, mensaje: string): Promise<boolean> {
  if (!twilioClient || !flowSid) {
    console.warn(`[Mock Voice] Call to ${to} (Flow ${flowSid}): Nombre=${nombre}, Mensaje="${mensaje}"`);
    return false;
  }

  if (!to) return false;

  const formattedTo = formatPhoneNumber(to);

  try {
    const execution = await twilioClient.studio.v2.flows(flowSid).executions.create({
      to: formattedTo,
      from: twilioNumber,
      parameters: {
        nombre,
        mensaje
      }
    });
    console.log(`Studio Flow execution created. SID: ${execution.sid}`);
    return true;
  } catch (error) {
    console.error(`Error triggering Studio Flow for ${formattedTo}:`, error);
    return false;
  }
}

// --- Web Push Configuration ---
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.WEB_PUSH_CONTACT || process.env.VAPID_SUBJECT || 'mailto:test@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('VAPID keys not found. Web Push disabled.');
}

export async function sendPushNotification(userId: string, title: string, body: string, url?: string): Promise<number> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn(`[Mock Push] To ${userId}: ${title} - ${body}`);
    return 0;
  }

  try {
    const res = await query<{ subscription: any }>('SELECT subscription FROM push_subscriptions WHERE user_id = $1', [userId]);
    const subscriptions = res.rows || [];
    let successCount = 0;

    const payload = JSON.stringify({ title, body, url: url || '/' });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        successCount++;
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await query('DELETE FROM push_subscriptions WHERE subscription = $1', [sub.subscription]);
        } else {
          console.error('Error sending push notification:', error);
        }
      }
    }
    return successCount;
  } catch (error) {
    console.error('Database error fetching subscriptions:', error);
    return 0;
  }
}
