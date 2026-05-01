import { query } from '../db/index.js';
import { logAudit } from './auditService.js';
import { createNotif, notifyByRole } from './notificationService.js';

function toReturnDate(days: number): string {
  if (days === 0) {
    const d = new Date();
    d.setHours(21, 0, 0, 0);
    return d.toISOString();
  }
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Crea una solicitud individual de préstamo. */
export async function createRequest(body: {
  assetId: string;
  userId: string;
  userName: string;
  userDisciplina: string;
  managerId?: string;
  days: number;
  motive?: string;
  institutionId?: number;
  autoApprove?: boolean;
  isInternal?: boolean;
}): Promise<{ id: number }> {
  const { assetId, userId, userName, userDisciplina, managerId, days, motive, institutionId, autoApprove, isInternal } = body;
  const assetResult = await query(
    `SELECT id, name, status, maintenance_alert FROM assets WHERE id = $1`,
    [assetId]
  );
  const asset = assetResult.rows[0] as { id: string; name: string; status: string; maintenance_alert?: boolean } | undefined;
  if (!asset) throw new Error('Activo no encontrado');
  if (asset.status === 'Requiere Mantenimiento' || asset.maintenance_alert) throw new Error('Requiere mantenimiento.');
  if (asset.status !== 'Disponible') throw new Error(`No disponible (${asset.status})`);
  const returnDate = toReturnDate(days);
  const status = autoApprove ? (isInternal ? 'ACTIVE_INTERNAL' : 'APPROVED') : 'PENDING';
  const approvedAt = autoApprove ? new Date().toISOString() : null;
  const checkoutAt = autoApprove && isInternal ? approvedAt : null;
  const result = await query(
    `INSERT INTO requests (asset_id, user_id, institution_id, requester_name, requester_disciplina, days_requested, motive, status, approved_at, checkout_at, expected_return_date, is_internal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [assetId, userId, institutionId ?? null, userName, userDisciplina, days, motive ?? '', status, approvedAt, checkoutAt, returnDate, isInternal ?? false]
  );
  const row = result.rows[0] as { id: number };
  await query(`UPDATE assets SET status = $1 WHERE id = $2`, [autoApprove ? 'Prestada' : 'En trámite', assetId]);
  if (!autoApprove) {
    if (managerId) await createNotif(managerId, 'Nueva Solicitud', `${userName} solicita "${asset.name}"${institutionId ? ' — institución externa' : ''}. ${motive || ''}`, 'INFO', row.id);
    await notifyByRole('ADMIN_PATRIMONIAL', 'Nueva Solicitud', `${userName} solicita "${asset.name}"${institutionId ? ' — institución externa' : ''}.`, 'INFO', row.id, assetId);
  } else {
    await logAudit('APPROVE', userId, userName, String(row.id), 'REQUEST', `Auto-aprobado: ${asset.name}`);
  }
  return { id: row.id };
}

export async function createBatchRequest(body: {
  assetIds: string[];
  userId: string;
  userName: string;
  userDisciplina: string;
  managerId?: string;
  days: number;
  motive?: string;
  institutionId?: number;
  autoApprove?: boolean;
  isInternal?: boolean;
}): Promise<void> {
  const { assetIds, userId, userName, userDisciplina, managerId, days, motive, institutionId, autoApprove, isInternal } = body;
  if (assetIds.length === 0) throw new Error('No hay activos');
  const returnDate = toReturnDate(days);
  const cartGroupId = `CART-${Date.now()}`;
  const groupedMotive = (motive?.trim() ? `[CARRITO] ${motive}` : '[CARRITO] Solicitud desde carrito');
  const status = autoApprove ? (isInternal ? 'ACTIVE_INTERNAL' : 'APPROVED') : 'PENDING';
  const approvedAt = autoApprove ? new Date().toISOString() : null;
  const checkoutAt = autoApprove && isInternal ? approvedAt : null;
  for (const assetId of assetIds) {
    const ar = await query(`SELECT status, maintenance_alert, name FROM assets WHERE id = $1`, [assetId]);
    const a = ar.rows[0] as { status: string; maintenance_alert?: boolean; name: string } | undefined;
    if (!a || a.status !== 'Disponible' || a.maintenance_alert) throw new Error(`No disponible: ${a?.name ?? assetId}`);
  }
  for (const assetId of assetIds) {
    await query(
      `INSERT INTO requests (asset_id, user_id, institution_id, requester_name, requester_disciplina, days_requested, motive, status, approved_at, checkout_at, expected_return_date, bundle_group_id, is_internal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [assetId, userId, institutionId ?? null, userName, userDisciplina, days, groupedMotive, status, approvedAt, checkoutAt, returnDate, cartGroupId, isInternal ?? false]
    );
  }
  for (const aid of assetIds) {
    await query(`UPDATE assets SET status = $1 WHERE id = $2`, [autoApprove ? 'Prestada' : 'En trámite', aid]);
  }
  if (autoApprove) {
    await logAudit('APPROVE', userId, userName, cartGroupId, 'REQUEST', `Auto-aprobado carrito: ${assetIds.length} activos`);
  } else {
    if (managerId) await createNotif(managerId, 'Nueva Solicitud — Carrito', `${userName} solicita ${assetIds.length} activo(s).`, 'INFO');
    await notifyByRole('ADMIN_PATRIMONIAL', 'Nueva Solicitud — Carrito', `${userName} solicita ${assetIds.length} activo(s).`, 'INFO');
  }
}

/** Crea solicitudes para un combo (combo). */
export async function createBundleRequest(body: {
  bundleId: string;
  assetIds: string[];
  bundleName: string;
  userId: string;
  userName: string;
  userDisciplina: string;
  managerId?: string;
  days: number;
  motive: string;
  institutionId?: number;
  autoApprove?: boolean;
  isInternal?: boolean;
}): Promise<void> {
  const { bundleId, assetIds, bundleName, userId, userName, userDisciplina, managerId, days, motive, institutionId, autoApprove, isInternal } = body;
  if (assetIds.length === 0) throw new Error('Combo sin activos');
  const returnDate = toReturnDate(days);
  const bundleGroupId = `BNDL-${Date.now()}`;
  const status = autoApprove ? (isInternal ? 'ACTIVE_INTERNAL' : 'APPROVED') : 'PENDING';
  const approvedAt = autoApprove ? new Date().toISOString() : null;
  const checkoutAt = autoApprove && isInternal ? approvedAt : null;
  const motiveText = `[COMBO: ${bundleName}] ${motive}`;
  for (const assetId of assetIds) {
    const ar = await query(`SELECT status FROM assets WHERE id = $1`, [assetId]);
    const a = ar.rows[0] as { status: string } | undefined;
    if (!a || a.status !== 'Disponible') throw new Error(`No disponible: ${assetId}`);
  }
  for (const assetId of assetIds) {
    await query(
      `INSERT INTO requests (asset_id, user_id, institution_id, requester_name, requester_disciplina, days_requested, motive, status, approved_at, checkout_at, expected_return_date, bundle_group_id, is_internal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [assetId, userId, institutionId ?? null, userName, userDisciplina, days, motiveText, status, approvedAt, checkoutAt, returnDate, bundleGroupId, isInternal ?? false]
    );
  }
  for (const assetId of assetIds) {
    await query(`UPDATE assets SET status = $1 WHERE id = $2`, [autoApprove ? 'Prestada' : 'En trámite', assetId]);
  }
  if (autoApprove) {
    await logAudit('APPROVE', userId, userName, bundleGroupId, 'REQUEST', `Auto-combo: ${bundleName}`);
  } else {
    if (managerId) await createNotif(managerId, 'Nueva Solicitud — Combo', `${userName} solicita combo "${bundleName}".`, 'INFO');
    await notifyByRole('ADMIN_PATRIMONIAL', 'Nueva Solicitud — Combo', `${userName} solicita combo "${bundleName}".`, 'INFO');
  }
}

/** Aprueba una solicitud (individual o combo). */
export async function approveRequest(
  reqId: number,
  approverId: string,
  approverName: string,
  bundleGroupId?: string | null,
  userId?: string,
  assetName?: string
): Promise<void> {
  const now = new Date().toISOString();
  if (bundleGroupId) {
    // Verificar si es interno para el combo
    const comboResult = await query(`SELECT is_internal FROM requests WHERE bundle_group_id = $1 LIMIT 1`, [bundleGroupId]);
    const isInternal = (comboResult.rows[0] as { is_internal?: boolean })?.is_internal ?? false;
    const newStatus = isInternal ? 'ACTIVE_INTERNAL' : 'APPROVED';
    const updateFields = isInternal ? 'status = $1, approved_at = $2, checkout_at = $2' : 'status = $1, approved_at = $2';
    const params = isInternal ? [newStatus, now, bundleGroupId] : [newStatus, now, bundleGroupId];
    await query(`UPDATE requests SET ${updateFields} WHERE bundle_group_id = $3`, params);
    if (isInternal) {
      await query(
        `UPDATE assets SET status = 'Prestada' WHERE id IN (SELECT asset_id FROM requests WHERE bundle_group_id = $1)`,
        [bundleGroupId]
      );
    }
    await logAudit('APPROVE', approverId, approverName, bundleGroupId, 'REQUEST', `Combo aprobado (${isInternal ? 'interno' : 'normal'})`);
  } else {
    // Verificar si es interno para solicitud individual
    const reqResult = await query(`SELECT is_internal FROM requests WHERE id = $1`, [reqId]);
    const isInternal = (reqResult.rows[0] as { is_internal?: boolean })?.is_internal ?? false;
    const newStatus = isInternal ? 'ACTIVE_INTERNAL' : 'APPROVED';
    const updateFields = isInternal ? 'status = $1, approved_at = $2, checkout_at = $2' : 'status = $1, approved_at = $2';
    const params = isInternal ? [newStatus, now, reqId] : [newStatus, now, reqId];
    await query(`UPDATE requests SET ${updateFields} WHERE id = $3`, params);
    if (isInternal) {
      await query(
        `UPDATE assets SET status = 'Prestada' WHERE id = (SELECT asset_id FROM requests WHERE id = $1)`,
        [reqId]
      );
    }
    await logAudit('APPROVE', approverId, approverName, String(reqId), 'REQUEST', `Aprobado (${isInternal ? 'interno' : 'normal'}): ${assetName ?? reqId}`);
  }
  if (userId) await createNotif(userId, 'Solicitud Aprobada', `"${assetName ?? 'equipo'}" aprobado por ${approverName}. Preséntate al guardia.`, 'INFO', reqId);
}

/** Rechaza una solicitud y libera los activos. */
export async function rejectRequest(
  reqId: number,
  reason: string,
  bundleGroupId?: string | null,
  assetIds?: string[],
  userId?: string
): Promise<void> {
  if (bundleGroupId) {
    await query(`UPDATE requests SET status = 'REJECTED', rejection_feedback = $1 WHERE bundle_group_id = $2`, [reason, bundleGroupId]);
    if (assetIds?.length) {
      for (const aid of assetIds) {
        await query(`UPDATE assets SET status = 'Disponible' WHERE id = $1 AND status = 'En trámite'`, [aid]);
      }
    }
    await logAudit('REJECT', 'system', 'Líder/Admin', bundleGroupId, 'REQUEST', reason);
  } else {
    await query(`UPDATE requests SET status = 'REJECTED', rejection_feedback = $1 WHERE id = $2`, [reason, reqId]);
    await query(`UPDATE assets SET status = 'Disponible' WHERE id = (SELECT asset_id FROM requests WHERE id = $1) AND status = 'En trámite'`, [reqId]);
    await logAudit('REJECT', 'system', 'Líder/Admin', String(reqId), 'REQUEST', reason);
  }
  if (userId) await createNotif(userId, 'Solicitud Rechazada', `Motivo: ${reason}`, 'ALERT', reqId);
}

/** Devuelve la solicitud al usuario con feedback para completar información. */
export async function returnRequestWithFeedback(
  reqId: number,
  feedback: string,
  bundleGroupId?: string | null,
  userId?: string
): Promise<void> {
  if (bundleGroupId) {
    await query(`UPDATE requests SET status = 'ACTION_REQUIRED', feedback_log = $1 WHERE bundle_group_id = $2`, [feedback, bundleGroupId]);
  } else {
    await query(`UPDATE requests SET status = 'ACTION_REQUIRED', feedback_log = $1 WHERE id = $2`, [feedback, reqId]);
  }
  if (userId) await createNotif(userId, 'Acción Requerida', `Tu solicitud necesita más info: ${feedback}`, 'WARNING', reqId);
}

/** Cancela una solicitud y libera activos en trámite. */
export async function cancelRequest(
  reqId: number,
  bundleGroupId?: string | null,
  assetIdsToFree?: string[]
): Promise<void> {
  if (bundleGroupId) {
    await query(`UPDATE requests SET status = 'CANCELLED' WHERE bundle_group_id = $1`, [bundleGroupId]);
  } else {
    await query(`UPDATE requests SET status = 'CANCELLED' WHERE id = $1`, [reqId]);
  }
  if (assetIdsToFree?.length) {
    for (const aid of assetIdsToFree) {
      await query(`UPDATE assets SET status = 'Disponible' WHERE id = $1 AND status = 'En trámite'`, [aid]);
    }
  }
}

/** Responde al feedback y vuelve a poner la solicitud en PENDING. */
export async function respondToFeedback(reqId: number, feedback: string, bundleGroupId?: string | null): Promise<void> {
  if (bundleGroupId) {
    await query(
      `UPDATE requests SET status = 'PENDING', feedback_log = $1 WHERE bundle_group_id = $2`,
      [feedback, bundleGroupId]
    );
  } else {
    await query(
      `UPDATE requests SET status = 'PENDING', feedback_log = $1 WHERE id = $2`,
      [feedback, reqId]
    );
  }
}

/** Extiende la fecha de retorno de un préstamo activo. */
export async function renewRequest(reqId: number, additionalDays: number): Promise<void> {
  const r = await query(`SELECT expected_return_date, days_requested FROM requests WHERE id = $1`, [reqId]);
  const row = r.rows[0] as { expected_return_date: string; days_requested: number } | undefined;
  if (!row?.expected_return_date) throw new Error('Solicitud no encontrada');
  const newReturn = new Date(row.expected_return_date);
  newReturn.setDate(newReturn.getDate() + additionalDays);
  await query(
    `UPDATE requests SET expected_return_date = $1, days_requested = $2, status = 'ACTIVE' WHERE id = $3`,
    [newReturn.toISOString(), row.days_requested + additionalDays, reqId]
  );
}
