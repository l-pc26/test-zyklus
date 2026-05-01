import { query } from '../db/index.js';
import { logAudit } from './auditService.js';
import { createNotif, notifyByRole } from './notificationService.js';

const isValidUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s ?? '');

/** Estado intermedio cuando se hace check‑in de un combo (múltiples activos). */
export interface ComboCheckinState {
  bundleGroupId: string;
  totalAssets: number;
  scannedAssetIds: string[];
  pendingAssets: Array<{ id: string; name: string; tag: string }>;
  allRequests: Array<{ id: number; asset_id: string; user_id: string; assets?: { name?: string; tag?: string } }>;
}

/** Respuesta estándar para escaneo de QR por parte del guardia. */
export interface GuardScanResult {
  success: boolean;
  message: string;
  data?: unknown;
  comboState?: ComboCheckinState;
}

/** Procesa el QR escaneado por el guardia (salida o devolución). */
export async function processGuardScan(
  qrData: string,
  type: 'CHECKOUT' | 'CHECKIN',
  signature?: string,
  isDamaged?: boolean,
  damageNotes?: string,
  termsAccepted?: boolean
): Promise<GuardScanResult> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(qrData);
  } catch {
    return { success: false, message: 'QR inválido.' };
  }

  const reqId = parsed.request_id ?? parsed.id;
  const bundleId = parsed.bundle_group_id as string | undefined;

  if (type === 'CHECKOUT') {
    let reqsToProcess: Array<Record<string, unknown>> = [];
    if (bundleId) {
      const result = await query(
        `SELECT r.*, row_to_json(a) AS assets FROM requests r
         LEFT JOIN assets a ON r.asset_id = a.id
         WHERE r.bundle_group_id = $1 AND r.status IN ('APPROVED', 'ACTIVE_INTERNAL')`,
        [bundleId]
      );
      reqsToProcess = (result.rows ?? []) as Array<Record<string, unknown>>;
      if (reqsToProcess.length === 0) return { success: false, message: 'Combo sin solicitudes aprobadas.' };
      // Verificar si es interno — los préstamos internos no pasan por caseta
      const firstReq = reqsToProcess[0] as { is_internal?: boolean };
      if (firstReq.is_internal) {
        return { success: false, message: '⚠️ Préstamo Interno: Este activo es de uso exclusivo dentro de las instalaciones. No requiere salida por caseta.' };
      }
    } else {
      // Validar que reqId sea un número válido antes de usarlo como bigint en la BD
      const reqIdNum = Number(reqId);
      if (!reqId || isNaN(reqIdNum) || !Number.isInteger(reqIdNum)) {
        return { success: false, message: 'QR inválido: el ID de solicitud no es un número válido.' };
      }
      const result = await query(
        `SELECT r.*, row_to_json(a) AS assets FROM requests r
         LEFT JOIN assets a ON r.asset_id = a.id
         WHERE r.id = $1 AND r.status IN ('APPROVED', 'ACTIVE_INTERNAL') LIMIT 1`,
        [reqIdNum]
      );
      const row = result.rows[0];
      if (!row) return { success: false, message: 'Solicitud no aprobada.' };
      // Verificar si es interno — los préstamos internos no pasan por caseta
      const req = row as { is_internal?: boolean };
      if (req.is_internal) {
        return { success: false, message: '⚠️ Préstamo Interno: Este activo es de uso exclusivo dentro de las instalaciones. No requiere salida por caseta.' };
      }
      reqsToProcess = [row] as Array<Record<string, unknown>>;
    }
    if (signature) {
      const now = new Date().toISOString();
      for (const raw of reqsToProcess) {
        const r = raw as { id: number; asset_id: string; assets?: { usage_count?: number; maintenance_usage_threshold?: number; name?: string } };
        const assets = (r.assets as Record<string, unknown>) ?? {};
        const usage = (assets.usage_count as number) ?? 0;
        const threshold = (assets.maintenance_usage_threshold as number) ?? 10;
        const newUsage = usage + 1;
        await query(
          `UPDATE requests SET status = 'ACTIVE', checkout_at = $1, digital_signature = $2, terms_accepted = $3, signature_date = $4 WHERE id = $5`,
          [now, signature, termsAccepted ?? false, now, r.id]
        );
        await query(
          `UPDATE assets SET status = 'Prestada', usage_count = $1, maintenance_alert = $2 WHERE id = $3`,
          [newUsage, newUsage >= threshold, r.asset_id]
        );
        await logAudit('CHECKOUT', 'guard', 'Guardia', String(r.id), 'REQUEST', `Salida: ${(assets.name as string) ?? ''}`);
      }
      const first = reqsToProcess[0] as { requester_name?: string; user_id?: string; assets?: { name?: string } };
      await notifyByRole('ADMIN_PATRIMONIAL', 'Activo Retirado', `${first.requester_name} retiró "${bundleId ? 'combo' : (first.assets?.name ?? 'equipo')}".`, 'INFO');
      const userId = first.user_id as string | undefined;
      if (userId && isValidUUID(userId)) {
        const uResult = await query(`SELECT manager_id FROM users WHERE id = $1`, [userId]);
        const managerId = (uResult.rows[0] as { manager_id?: string } | undefined)?.manager_id;
        if (managerId) await createNotif(managerId, 'Equipo Retirado', `${first.requester_name} retiró "${bundleId ? 'combo' : (first.assets?.name ?? 'equipo')}".`, 'INFO');
      }
      return { success: true, message: 'Salida confirmada.' };
    }
    return { success: true, message: 'Verificado', data: reqsToProcess };
  }

  const assetId = (parsed.id ?? parsed.asset_id) as string;
  if (!assetId) return { success: false, message: 'QR sin ID de activo.' };

  const reqResult = await query(
    `SELECT r.*, row_to_json(a) AS assets FROM requests r
     LEFT JOIN assets a ON r.asset_id = a.id
     WHERE r.asset_id = $1 AND r.status IN ('ACTIVE', 'ACTIVE_INTERNAL', 'OVERDUE')
     ORDER BY r.checkout_at DESC LIMIT 1`,
    [assetId]
  );
  const reqRow = reqResult.rows[0] as { id: number; asset_id: string; user_id: string; bundle_group_id?: string; assets?: { name?: string; tag?: string } } | undefined;
  if (!reqRow) return { success: false, message: 'No hay préstamo activo para este activo.' };

  const isConfirm = Boolean(signature);

  if (reqRow.bundle_group_id) {
    const allResult = await query(
      `SELECT r.*, row_to_json(a) AS assets FROM requests r
       LEFT JOIN assets a ON r.asset_id = a.id
       WHERE r.bundle_group_id = $1 AND r.status IN ('ACTIVE', 'ACTIVE_INTERNAL', 'OVERDUE')`,
      [reqRow.bundle_group_id]
    );
    const allReqs = (allResult.rows ?? []) as Array<{ id: number; asset_id: string; user_id: string; assets?: { name?: string; tag?: string } }>;
    if (!isConfirm) {
      if (allReqs.length === 1) {
        return { success: true, message: 'Verificado', data: allReqs[0] };
      }
      const comboState: ComboCheckinState = {
        bundleGroupId: reqRow.bundle_group_id,
        totalAssets: allReqs.length,
        scannedAssetIds: [assetId],
        pendingAssets: allReqs.filter((r) => r.asset_id !== assetId).map((r) => ({
          id: r.asset_id,
          name: r.assets?.name ?? 'Activo',
          tag: r.assets?.tag ?? '—',
        })),
        allRequests: allReqs,
      };
      return {
        success: true,
        message: `Combo detectado (${allReqs.length} activos). Escanea los ${allReqs.length - 1} restantes.`,
        comboState,
      };
    }
    return await doCheckin(allReqs, isDamaged ?? false, damageNotes ?? '');
  }

  if (!isConfirm) {
    return { success: true, message: 'Verificado', data: reqRow };
  }

  return await doCheckin([reqRow], isDamaged ?? false, damageNotes ?? '');
}

/** Confirma el check-in de un combo (varios activos devueltos a la vez). */
export async function confirmComboCheckin(
  allRequests: Array<{ id: number; asset_id: string; user_id: string; assets?: { name?: string } }>,
  isDamaged: boolean,
  damageNotes: string
): Promise<{ success: boolean; message: string }> {
  return doCheckin(allRequests, isDamaged, damageNotes);
}

async function doCheckin(
  reqs: Array<{ id: number; asset_id: string; user_id: string; assets?: { name?: string } }>,
  isDamaged: boolean,
  damageNotes: string
): Promise<{ success: boolean; message: string }> {
  const newAssetStatus = isDamaged ? 'En mantenimiento' : 'Disponible';
  const newReqStatus = isDamaged ? 'MAINTENANCE' : 'RETURNED';
  const now = new Date().toISOString();

  for (const r of reqs) {
    await query(
      `UPDATE requests SET status = $1, checkin_at = $2, is_damaged = $3, damage_notes = $4, return_condition = $5 WHERE id = $6`,
      [newReqStatus, now, isDamaged, damageNotes || null, isDamaged ? 'DAÑADO' : 'BUENO', r.id]
    );

    // Obtener datos actuales del asset para verificar mantenimiento preventivo
    const assetResult = await query(
      `SELECT usage_count, maintenance_usage_threshold, name FROM assets WHERE id = $1`,
      [r.asset_id]
    );
    const asset = assetResult.rows[0] as { usage_count?: number; maintenance_usage_threshold?: number; name?: string };
    const currentUsage = (asset.usage_count ?? 0);
    const newUsage = currentUsage + 1;
    const threshold = asset.maintenance_usage_threshold ?? 100;
    const needsMaintenance = newUsage >= threshold;

    // Actualizar asset con nuevo status y usage_count
    const finalAssetStatus = isDamaged || needsMaintenance ? 'En mantenimiento' : 'Disponible';
    await query(
      `UPDATE assets SET status = $1, usage_count = $2, maintenance_alert = $3 WHERE id = $4`,
      [finalAssetStatus, newUsage, needsMaintenance, r.asset_id]
    );

    await logAudit('CHECKIN', 'guard', 'Guardia', String(r.id), 'REQUEST', `Devolución: ${asset.name ?? ''}`);

    // Si requiere mantenimiento preventivo, registrar en audit_logs
    if (needsMaintenance && !isDamaged) {
      await logAudit('MAINTENANCE', 'system', 'Sistema', r.asset_id, 'ASSET', `Mantenimiento preventivo automático alcanzado (${newUsage}/${threshold})`);
    }
  }

  if (isDamaged) {
    for (const r of reqs) {
      await query(
        `INSERT INTO maintenance_logs (asset_id, reported_by_user_id, issue_description, status)
         VALUES ($1, $2, $3, 'OPEN')`,
        [r.asset_id, isValidUUID(r.user_id) ? r.user_id : null, damageNotes || 'Daños en devolución']
      );
      await query(`UPDATE assets SET maintenance_alert = true WHERE id = $1`, [r.asset_id]);
    }
    await notifyByRole('ADMIN_PATRIMONIAL', 'Daños en Devolución', `${reqs.length} equipo(s) devueltos con daños. ${damageNotes}`, 'ALERT');
    const userId = reqs[0]?.user_id;
    if (userId && isValidUUID(userId)) {
      const uResult = await query(`SELECT manager_id FROM users WHERE id = $1`, [userId]);
      const managerId = (uResult.rows[0] as { manager_id?: string } | undefined)?.manager_id;
      if (managerId) await createNotif(managerId, 'Equipo Devuelto con Daños', `Daños en ${reqs.length} equipo(s). ${damageNotes}`, 'ALERT');
    }
  } else {
    const names = reqs.map((r) => r.assets?.name).filter(Boolean).join(', ');
    await notifyByRole('ADMIN_PATRIMONIAL', 'Devolución Registrada', `Devueltos: ${names}.`, 'INFO');
  }

  return { success: true, message: isDamaged ? 'Devuelto con daño' : 'Devuelto correctamente' };
}
