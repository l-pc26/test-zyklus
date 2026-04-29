import { pool } from '../db/index.js';

export interface DataPayload {
  assets: unknown[];
  requests: unknown[];
  institutions: unknown[];
  notifications: unknown[];
  maintenanceLogs: unknown[];
  auditLogs: unknown[];
  bundles: unknown[];
}

/** Obtiene todos los datos del sistema (requests, institutions, notifications, etc.). */
export async function getAllData(): Promise<DataPayload> {
  const client = await pool.connect();
  try {
    const [
      requestsRes,
      institutionsRes,
      notificationsRes,
      maintenanceRes,
      auditRes,
      bundlesRes,
      bundleAssetsRes,
      assetsRes,
      usersRes,
    ] = await Promise.all([
      client.query(
        `SELECT
           r.id,
           r.asset_id,
           r.user_id,
           r.institution_id,
           r.requester_name,
           r.requester_disciplina,
           r.days_requested,
           r.motive,
           r.status,
           r.is_internal,
           r.approved_at,
           r.expected_return_date,
           r.returned_at,
           r.checkout_at,
           r.checkin_at,
           r.bundle_group_id,
           r.rejection_feedback,
           r.feedback_log,
           r.created_at,
           r.digital_signature,
           r.terms_accepted,
           r.signature_date,
           CASE WHEN a.id IS NULL THEN NULL ELSE row_to_json((SELECT sub FROM (SELECT a.id, a.tag, a.name, a.status, a.category, a.image, a.usage_count, a.maintenance_alert) AS sub)) END AS assets,
           CASE WHEN u.id IS NULL THEN NULL ELSE row_to_json((SELECT sub FROM (SELECT u.id, u.name, u.email, u.role, u.disciplina, u.manager_id, u.created_at) AS sub)) END AS users,
           CASE WHEN i.id IS NULL THEN NULL ELSE row_to_json((SELECT sub FROM (SELECT i.id, i.name, i.contact_name, i.contact_email, i.contact_phone, i.address, i.created_at) AS sub)) END AS institutions
         FROM requests r
         LEFT JOIN assets a ON r.asset_id = a.id
         LEFT JOIN users u ON r.user_id = u.id
         LEFT JOIN institutions i ON r.institution_id = i.id
         WHERE r.status = 'OVERDUE' OR r.id IN (SELECT id FROM requests ORDER BY created_at DESC LIMIT 50)
         ORDER BY r.created_at DESC`
      ),
      client.query('SELECT id, name, contact_name, contact_email, contact_phone, address, created_at FROM institutions ORDER BY id DESC LIMIT 50'),
      client.query('SELECT id, user_id, request_id, asset_id, type, channel, title, message, is_read, created_at FROM notifications ORDER BY created_at DESC LIMIT 100'),
      client.query(
        `SELECT
           ml.id,
           ml.asset_id,
           ml.reported_by_user_id,
           ml.issue_description,
           ml.status,
           ml.cost,
           ml.created_at,
           ml.resolved_at,
           CASE WHEN a.id IS NULL THEN NULL ELSE row_to_json((SELECT sub FROM (SELECT a.id, a.tag, a.name, a.status, a.category, a.image, a.usage_count, a.maintenance_alert) AS sub)) END AS assets,
           CASE WHEN u.id IS NULL THEN NULL ELSE row_to_json((SELECT sub FROM (SELECT u.id, u.name, u.email, u.role, u.disciplina, u.created_at) AS sub)) END AS users
         FROM maintenance_logs ml
         LEFT JOIN assets a ON ml.asset_id = a.id
         LEFT JOIN users u ON ml.reported_by_user_id = u.id
         ORDER BY ml.created_at DESC
         LIMIT 100`
      ),
      client.query('SELECT id, timestamp, action, actor_id, actor_name, target_id, target_type, details FROM audit_logs ORDER BY timestamp DESC LIMIT 50'),
      client.query('SELECT id, name, description, image_url, created_at FROM bundles ORDER BY created_at DESC LIMIT 50'),
      client.query('SELECT id, bundle_id, tag, name, status, category FROM assets WHERE bundle_id IS NOT NULL ORDER BY created_at DESC'),
      client.query('SELECT id, tag, name, status, category, image, usage_count, maintenance_alert, bundle_id, created_at FROM assets ORDER BY created_at DESC LIMIT 50'),
      client.query('SELECT id, name, email, role, disciplina, manager_id, created_at FROM users ORDER BY created_at DESC LIMIT 50'),
    ]);

  const requests = (requestsRes.rows ?? []).map((row: Record<string, unknown>) => {
    const { assets: assetRow, users: userRow, institutions: instRow, ...rest } = row;
    return { ...rest, assets: assetRow ?? null, users: userRow ?? null, institutions: instRow ?? null };
  });
  const institutions = institutionsRes.rows ?? [];
  const notifications = notificationsRes.rows ?? [];
  const maintenanceLogs = (maintenanceRes.rows ?? []).map((row: Record<string, unknown>) => {
    const { assets: assetRow, users: userRow, ...rest } = row;
    return { ...rest, assets: assetRow, users: userRow };
  });
  const auditLogs = auditRes.rows ?? [];
  const bundles = bundlesRes.rows ?? [];
  const bundleAssets = (bundleAssetsRes.rows ?? []) as Record<string, unknown>[];

  const assetsByBundleId = new Map<string | number, Record<string, unknown>[]>();
  for (const a of bundleAssets) {
    const bid = a.bundle_id as string | number;
    if (!assetsByBundleId.has(bid)) assetsByBundleId.set(bid, []);
    assetsByBundleId.get(bid)!.push(a);
  }

  const bundlesWithAssets = (bundles as Record<string, unknown>[]).map((b) => ({
    ...b,
    assets: assetsByBundleId.get(b.id as string | number) ?? [],
  }));

    return {
      assets: assetsRes.rows ?? [],
      requests,
      institutions,
      notifications,
      maintenanceLogs,
      auditLogs,
      bundles: bundlesWithAssets,
    };
  } finally {
    client.release();
  }
}

export interface DataStats {
  assetCounts: { total: number; disponible: number; prestada: number; mantenimiento: number; [key: string]: number };
  requestCounts: { overdue: number; active: number };
  categoryCounts?: Record<string, number>;
  topAssets?: Array<{ name: string; count: number }>;
  topUsers?: Array<{ name: string; count: number }>;
  disciplines?: string[];
  topAssetsByDiscipline?: Record<string, Array<{ name: string; count: number }>>;
}

/** Obtiene estadísticas (conteos de activos, solicitudes activas/vencidas, categorías, y datos para gráficas). */
export async function getStats(): Promise<DataStats> {
  const client = await pool.connect();
  try {
    const [
      assetCountsRes, 
      overdueRes, 
      activeRes, 
      categoryRes,
      topAssetsRes,
      topUsersRes,
      disciplinesRes,
      topAssetsByDiscRes
    ] = await Promise.all([
      client.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::int AS count FROM assets GROUP BY status`
      ),
      client.query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM requests WHERE status = 'OVERDUE'`),
      client.query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM requests WHERE status = 'ACTIVE'`),
      client.query<{ category: string; count: string }>(`SELECT category, COUNT(*)::int AS count FROM assets WHERE category IS NOT NULL AND category != '' GROUP BY category`),
      client.query<{ name: string; count: number }>(`
        SELECT TRIM(split_part(COALESCE(a.name, 'Desconocido'), ' ', 1) || ' ' || split_part(COALESCE(a.name, 'Desconocido'), ' ', 2)) as name, 
               COUNT(r.id)::int as count 
        FROM requests r 
        LEFT JOIN assets a ON r.asset_id = a.id 
        GROUP BY name 
        ORDER BY count DESC 
        LIMIT 8
      `),
      client.query<{ name: string; count: number }>(`
        SELECT TRIM(split_part(requester_name, ' ', 1) || ' ' || split_part(requester_name, ' ', 2)) as name, 
               COUNT(id)::int as count 
        FROM requests 
        WHERE requester_name IS NOT NULL 
        GROUP BY name 
        ORDER BY count DESC 
        LIMIT 5
      `),
      client.query<{ disciplina: string }>(`
        SELECT DISTINCT requester_disciplina as disciplina 
        FROM requests 
        WHERE requester_disciplina IS NOT NULL AND requester_disciplina != ''
      `),
      client.query<{ disciplina: string; name: string; count: number }>(`
        WITH ranked AS (
          SELECT r.requester_disciplina as disciplina, 
                 TRIM(split_part(COALESCE(a.name, 'Desconocido'), ' ', 1) || ' ' || split_part(COALESCE(a.name, 'Desconocido'), ' ', 2)) as name, 
                 COUNT(r.id)::int as count,
                 ROW_NUMBER() OVER(
                   PARTITION BY r.requester_disciplina 
                   ORDER BY COUNT(r.id) DESC
                 ) as rn
          FROM requests r
          LEFT JOIN assets a ON r.asset_id = a.id
          WHERE r.requester_disciplina IS NOT NULL AND r.requester_disciplina != ''
          GROUP BY r.requester_disciplina, name
        )
        SELECT disciplina, name, count FROM ranked WHERE rn <= 5
      `)
    ]);

    const assetCounts: { total: number; disponible: number; prestada: number; mantenimiento: number; [key: string]: number } = { total: 0, disponible: 0, prestada: 0, mantenimiento: 0 };
    for (const row of assetCountsRes.rows ?? []) {
      const status = row.status ?? '';
      const count = Number(row.count ?? 0);
      assetCounts.total += count;
      if (status === 'Disponible') assetCounts.disponible = count;
      else if (status === 'Prestada') assetCounts.prestada = count;
      else if (status === 'En mantenimiento' || status === 'Requiere Mantenimiento') {
        assetCounts.mantenimiento = (assetCounts.mantenimiento ?? 0) + count;
      }
    }

    const categoryCounts: Record<string, number> = {};
    for (const row of categoryRes.rows ?? []) {
      categoryCounts[row.category ?? ''] = Number(row.count ?? 0);
    }

    const topAssetsByDiscipline: Record<string, Array<{ name: string; count: number }>> = {};
    for (const row of topAssetsByDiscRes.rows ?? []) {
      if (!topAssetsByDiscipline[row.disciplina]) {
        topAssetsByDiscipline[row.disciplina] = [];
      }
      topAssetsByDiscipline[row.disciplina].push({ name: row.name, count: row.count });
    }

    return {
      assetCounts,
      requestCounts: {
        overdue: Number(overdueRes.rows[0]?.count ?? 0),
        active: Number(activeRes.rows[0]?.count ?? 0),
      },
      categoryCounts,
      topAssets: topAssetsRes.rows ?? [],
      topUsers: topUsersRes.rows ?? [],
      disciplines: (disciplinesRes.rows ?? []).map(r => r.disciplina).sort(),
      topAssetsByDiscipline,
    };
  } finally {
    client.release();
  }
}

export interface PaginatedAuditResult {
  auditLogs: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
}

/** Obtiene audit_logs paginados con búsqueda y filtrado por acción. */
export async function getAuditLogsPaginated(
  page = 1,
  limit = 50,
  filters?: { action?: string; search?: string }
): Promise<PaginatedAuditResult> {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.action && filters.action !== 'ALL') {
    conditions.push(`action = $${paramIndex}`);
    params.push(filters.action);
    paramIndex++;
  }
  if (filters?.search) {
    conditions.push(`(LOWER(details) LIKE LOWER($${paramIndex}) OR LOWER(actor_name) LIKE LOWER($${paramIndex}))`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const client = await pool.connect();

  try {
    const [countRes, logsRes] = await Promise.all([
      client.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM audit_logs ${whereClause}`,
        params
      ),
      client.query(
        `SELECT id, timestamp, action, actor_id, actor_name, target_id, target_type, details FROM audit_logs ${whereClause}
         ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
    ]);

    return {
      auditLogs: (logsRes.rows ?? []) as Record<string, unknown>[],
      total: Number(countRes.rows[0]?.count ?? 0),
      page,
      limit,
    };
  } finally {
    client.release();
  }
}

export interface PaginatedMaintenanceResult {
  maintenanceLogs: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
}

/** Obtiene maintenance_logs paginados con búsqueda por status. */
export async function getMaintenanceLogsPaginated(
  page = 1,
  limit = 50,
  filters?: { status?: string; search?: string }
): Promise<PaginatedMaintenanceResult> {
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.status) {
    conditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }
  if (filters?.search) {
    conditions.push(`(LOWER(issue_description) LIKE LOWER($${paramIndex}))`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const client = await pool.connect();

  try {
    const [countRes, logsRes] = await Promise.all([
      client.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM maintenance_logs ${whereClause}`,
        params
      ),
      client.query(
        `SELECT ml.id, ml.asset_id, ml.reported_by_user_id, ml.issue_description, ml.status, ml.cost, ml.created_at, ml.resolved_at,
                CASE WHEN a.id IS NULL THEN NULL ELSE row_to_json((SELECT sub FROM (SELECT a.id, a.tag, a.name, a.status, a.category, a.image, a.usage_count, a.maintenance_alert) AS sub)) END AS assets,
                CASE WHEN u.id IS NULL THEN NULL ELSE row_to_json((SELECT sub FROM (SELECT u.id, u.name, u.email, u.role, u.disciplina, u.created_at) AS sub)) END AS users
         FROM maintenance_logs ml
         LEFT JOIN assets a ON ml.asset_id = a.id
         LEFT JOIN users u ON ml.reported_by_user_id = u.id
         ${whereClause}
         ORDER BY ml.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
    ]);

    return {
      maintenanceLogs: (logsRes.rows ?? []) as Record<string, unknown>[],
      total: Number(countRes.rows[0]?.count ?? 0),
      page,
      limit,
    };
  } finally {
    client.release();
  }
}
