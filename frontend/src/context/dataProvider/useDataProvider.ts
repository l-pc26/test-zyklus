import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../../api/data';
import * as apiAssets from '../../api/assets';
import * as apiBundles from '../../api/bundles';
import * as apiInstitutions from '../../api/institutions';
import * as apiRequests from '../../api/requests';
import * as apiGuard from '../../api/guard';
import * as apiNotifications from '../../api/notifications';
import * as apiMaintenance from '../../api/maintenance';
import { useAuth } from '../AuthContext';
import type { Asset, Request, User, Institution, Notification, AuditLog, MaintenanceLog, Bundle } from '../../types';
import { toast } from 'sonner';

/** Estado de un check-in de combo (varios activos a la vez). */
export interface ComboCheckinState {
  bundleGroupId: string;
  totalAssets: number;
  scannedAssetIds: string[];
  pendingAssets: Array<{ id: string; name: string; tag: string }>;
  allRequests: Array<{ id: number; asset_id: string; user_id: string; assets?: { name?: string; tag?: string } }>;
}

export function useDataProvider() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [stats, setStats] = useState<{ assetCounts: Record<string, number>; requestCounts: { overdue: number; active: number }; categoryCounts?: Record<string, number> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // For lazy-loaded historical data
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [maintenanceLogsPage, setMaintenanceLogsPage] = useState(1);

  // Caché para resultados paginados (evita re-fetch del mismo filtro)
  const auditLogsCache = useRef(new Map<string, AuditLog[]>());
  const maintenanceLogsCache = useRef(new Map<string, MaintenanceLog[]>());

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const hasExistingData = assets.length > 0;
    const shouldShowLoading = !silent && !hasExistingData;
    try {
      if (shouldShowLoading) setIsLoading(true);
      const [data, statsData] = await Promise.all([api.getData(), api.getStats()]);
      setAssets(data.assets);
      setRequests(data.requests);
      setInstitutions(data.institutions);
      setNotifications(data.notifications);
      setMaintenanceLogs(data.maintenanceLogs);
      setAuditLogs(data.auditLogs);
      setBundles(data.bundles);
      setStats(statsData);
      await apiNotifications.checkOverdue();
    } catch (err) {
      console.error('fetchData:', err);
    } finally {
      if (shouldShowLoading) setIsLoading(false);
    }
  }, [assets.length]);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchData]);

  const loadMoreAuditLogs = useCallback(async (filters?: { action?: string; search?: string }) => {
    try {
      const nextPage = auditLogsPage + 1;
      const cacheKey = `p${nextPage}_${filters?.action || 'ALL'}_${filters?.search || ''}`;
      const cached = auditLogsCache.current.get(cacheKey);

      if (cached) {
        setAuditLogs(prev => [...prev, ...cached]);
        setAuditLogsPage(nextPage);
      } else {
        const result = await api.getAuditLogsPaginated(nextPage, 50, filters);
        auditLogsCache.current.set(cacheKey, result.auditLogs);
        setAuditLogs(prev => [...prev, ...result.auditLogs]);
        setAuditLogsPage(nextPage);
      }
    } catch (err) {
      console.error('loadMoreAuditLogs:', err);
      toast.error('Error al cargar más registros de auditoría');
    }
  }, [auditLogsPage]);

  const loadMoreMaintenanceLogs = useCallback(async (filters?: { status?: string; search?: string }) => {
    try {
      const nextPage = maintenanceLogsPage + 1;
      const cacheKey = `p${nextPage}_${filters?.status || 'ALL'}_${filters?.search || ''}`;
      const cached = maintenanceLogsCache.current.get(cacheKey);

      if (cached) {
        setMaintenanceLogs(prev => [...prev, ...cached]);
        setMaintenanceLogsPage(nextPage);
      } else {
        const result = await api.getMaintenanceLogsPaginated(nextPage, 50, filters);
        maintenanceLogsCache.current.set(cacheKey, result.maintenanceLogs);
        setMaintenanceLogs(prev => [...prev, ...result.maintenanceLogs]);
        setMaintenanceLogsPage(nextPage);
      }
    } catch (err) {
      console.error('loadMoreMaintenanceLogs:', err);
      toast.error('Error al cargar más registros de mantenimiento');
    }
  }, [maintenanceLogsPage]);

  const getNextTag = useCallback(async () => {
    const res = await apiAssets.getNextTag();
    return res;
  }, []);

  const addAsset = async (asset: Partial<Asset>) => {
    try {
      const tag = asset.tag || (await getNextTag());
      const payload = { ...asset, tag, status: asset.status || 'Disponible' };
      await apiAssets.createAsset(payload);
      toast.success(`${payload.tag} creado`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear activo');
    }
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    try {
      await apiAssets.updateAsset(id, updates);
      toast.success('Activo actualizado');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const deleteAsset = async (id: string) => {
    try {
      await apiAssets.deleteAsset(id);
      toast.success('Baja lógica procesada');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const importAssets = async (csvText: string) => {
    const lines = csvText.split('\n').filter(Boolean);
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',');
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      return { name: obj.name || obj.nombre || 'Sin nombre', tag: obj.tag || null, category: obj.category || obj.categoria || 'General', serial: obj.serial || obj.serie };
    });
    try {
      const count = await apiAssets.importAssets(rows);
      toast.success(`${count} activos importados`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    }
  };

  const validateMaintenanceAsset = async (assetId: string) => {
    let asset: Asset | null | undefined = assets.find(a => a.id === assetId);
    if (!asset) asset = await apiAssets.getAssetById(assetId) ?? undefined;
    if (!asset) return;
    try {
      await apiAssets.validateMaintenance(assetId, asset.maintenance_period_days ?? 180);
      toast.success('Mantenimiento validado.');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const createBundle = async (name: string, description: string, assetIds: string[]) => {
    try {
      await apiBundles.createBundle(name, description, assetIds);
      toast.success(`Combo "${name}" creado`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear combo');
    }
  };

  const updateBundle = async (id: string, patch: { name?: string; description?: string; assetIds?: string[] }) => {
    try {
      await apiBundles.updateBundle(id, patch);
      toast.success('Combo actualizado');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar combo');
    }
  };

  const createBatchRequest = async (bundle: Bundle, user: User, days: number, motive: string, autoApprove = false, institutionId?: number, isInternal = false) => {
    if (!bundle.assets?.length) { toast.error('Combo sin activos'); return; }
    const unavail = bundle.assets.filter(a => a.status !== 'Disponible');
    if (unavail.length) { toast.error(`No disponibles: ${unavail.map(a => `${a.name}(${a.status})`).join(', ')}`); return; }
    try {
      await apiRequests.createBundleRequest(
        bundle.id,
        bundle.assets.map(a => a.id),
        bundle.name,
        user,
        days,
        motive,
        autoApprove,
        institutionId,
        isInternal
      );
      toast.success(`Combo "${bundle.name}" solicitado`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const addInstitution = async (inst: Partial<Institution>) => {
    try {
      await apiInstitutions.addInstitution(inst);
      toast.success('Institución registrada');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };
  const updateInstitution = async (id: number, updates: Partial<Institution>) => {
    try {
      await apiInstitutions.updateInstitution(id, updates);
      toast.success('Institución actualizada');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };
  const deleteInstitution = async (id: number) => {
    try {
      await apiInstitutions.deleteInstitution(id);
      toast.success('Institución eliminada');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const generateQRCode = (requestId: number): string => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return '';
    return JSON.stringify({ type: 'REQUEST', request_id: requestId, bundle_group_id: req.bundle_group_id, asset_id: req.asset_id, requester_name: req.requester_name });
  };
  const getQRPayload = (_: number) => null;
  const processQRScan = async (qrData: string) => {
    try {
      const json = JSON.parse(qrData);
      const assetId = json.asset_id || json.id;
      let asset = assets.find(a => a.id === assetId || a.tag === assetId);
      if (!asset && assetId) asset = (await apiAssets.getAssetById(assetId)) ?? undefined;
      const request = requests.find(r => r.id === json.request_id || r.asset_id === assetId);
      return { asset: asset ?? undefined, request };
    } catch { toast.error('QR inválido'); return null; }
  };

  const approveRequest = async (reqId: number, approverId: string, approverName: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;
    try {
      await apiRequests.approveRequest(reqId, approverId, approverName, {
        bundleGroupId: req.bundle_group_id ?? undefined,
        userId: req.user_id,
        assetName: req.assets?.name,
      });
      toast.success(req.bundle_group_id ? 'Combo aprobado' : 'Aprobado');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const rejectRequest = async (reqId: number, reason: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;
    try {
      const assetIds = req.bundle_group_id
        ? requests.filter(r => r.bundle_group_id === req.bundle_group_id).map(r => r.asset_id)
        : undefined;
      await apiRequests.rejectRequest(reqId, reason, {
        bundleGroupId: req.bundle_group_id ?? undefined,
        assetIds,
        userId: req.user_id,
      });
      toast.error('Solicitud rechazada');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const returnRequestWithFeedback = async (reqId: number, feedback: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;
    try {
      await apiRequests.returnRequestWithFeedback(reqId, feedback, {
        bundleGroupId: req.bundle_group_id ?? undefined,
        userId: req.user_id,
      });
      toast.warning('Devuelta para corrección');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const getTeamRequests = (managerId: string): Request[] => {
    const grouped = new Map<string | number, Request>();
    requests.filter(r => r.users?.manager_id === managerId).forEach(r => {
      if (r.bundle_group_id) {
        if (!grouped.has(r.bundle_group_id)) {
          grouped.set(r.bundle_group_id, { ...r, is_bundle: true, bundle_items: 1, bundle_assets: r.assets ? [r.assets] : [] });
        } else {
          const g = grouped.get(r.bundle_group_id)!;
          g.bundle_items = (g.bundle_items || 1) + 1;
          if (r.assets) g.bundle_assets = [...(g.bundle_assets || []), r.assets];
        }
      } else grouped.set(r.id, r);
    });
    return Array.from(grouped.values());
  };

  const createRequest = async (asset: Asset, user: User, days: number, motive = '', institutionId?: number, autoApprove = false, isInternal = false) => {
    if (asset.status === 'Requiere Mantenimiento' || asset.maintenance_alert) { toast.error('Requiere mantenimiento.'); return; }
    if (asset.status !== 'Disponible') {
      const msgs: Record<string, string> = { 'Prestada': 'Ya prestado.', 'En trámite': 'Ya tiene solicitud en trámite.', 'En mantenimiento': 'En mantenimiento.', 'Dada de baja': 'Dado de baja.' };
      toast.error(msgs[asset.status] || `No disponible (${asset.status})`);
      return;
    }
    try {
      await apiRequests.createRequest(asset.id, user, days, motive, institutionId, autoApprove, isInternal);
      toast.success(autoApprove ? 'Auto-Aprobado. Preséntate al guardia' : 'Solicitud enviada');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const createMultipleRequests = async (assetList: Asset[], user: User, days: number, motive = '', institutionId?: number, autoApprove = false, isInternal = false) => {
    if (!assetList.length) { toast.error('No hay activos en el carrito'); return; }
    const unavail = assetList.filter(a => a.status !== 'Disponible' || a.maintenance_alert);
    if (unavail.length) {
      const msgs: Record<string, string> = { 'Prestada': 'Ya prestado', 'En trámite': 'Ya tiene solicitud', 'En mantenimiento': 'En mantenimiento', 'Dada de baja': 'Dado de baja' };
      toast.error(`No disponibles: ${unavail.map(a => `${a.name} (${msgs[a.status] || a.status})`).join(', ')}`);
      return;
    }
    try {
      await apiRequests.createBatchRequest(assetList.map(a => a.id), user, days, motive, institutionId, autoApprove, isInternal);
      toast.success(autoApprove ? `${assetList.length} activos auto-aprobados` : 'Solicitud enviada');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const cancelRequest = async (reqId: number) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;
    try {
      const assetIdsToFree = ['PENDING', 'ACTION_REQUIRED'].includes(req.status)
        ? (req.bundle_group_id ? requests.filter(r => r.bundle_group_id === req.bundle_group_id).map(r => r.asset_id) : req.asset_id ? [req.asset_id] : []).filter(Boolean) as string[]
        : undefined;
      await apiRequests.cancelRequest(reqId, { bundleGroupId: req.bundle_group_id ?? undefined, assetIdsToFree });
      toast.success(req.bundle_group_id ? 'Solicitud (carrito/combo) cancelada' : 'Solicitud cancelada');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const renewRequest = async (reqId: number, days: number) => {
    const req = requests.find(r => r.id === reqId);
    if (!req?.expected_return_date) return;
    try {
      await apiRequests.renewRequest(reqId, days);
      toast.success(`Renovado ${days} días`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const getUserRequests = (userId: string): Request[] => {
    const grouped = new Map<string | number, Request>();
    requests.filter(r => r.user_id === userId).forEach(r => {
      if (r.bundle_group_id) {
        if (!grouped.has(r.bundle_group_id)) {
          grouped.set(r.bundle_group_id, { ...r, is_bundle: true, bundle_items: 1, bundle_assets: r.assets ? [r.assets] : [] });
        } else {
          const g = grouped.get(r.bundle_group_id)!;
          g.bundle_items = (g.bundle_items || 1) + 1;
          if (r.assets) g.bundle_assets = [...(g.bundle_assets || []), r.assets];
        }
      } else grouped.set(r.id, r);
    });
    return Array.from(grouped.values());
  };

  const processGuardScan = async (
    qrData: string, type: 'CHECKOUT' | 'CHECKIN',
    signature = '', isDamaged = false, damageNotes = '', termsAccepted = false
  ): Promise<{ success: boolean; message: string; data?: unknown; comboState?: ComboCheckinState }> => {
    try {
      const result = await apiGuard.guardScan(qrData, type, { signature, isDamaged, damageNotes, termsAccepted });
      if (!result.success) return result;
      if (result.message?.includes('Salida confirmada') || result.message?.startsWith('Devuelto')) {
        if (result.message.startsWith('Devuelto')) {
          if (result.message.includes('daño')) toast.warning('Daño registrado. Activos a mantenimiento.');
          else toast.success('Devolución registrada.');
        }
        fetchData();
      }
      return {
        success: result.success,
        message: result.message,
        data: result.data,
        comboState: result.comboState as ComboCheckinState | undefined,
      };
    } catch (err) {
      console.error('processGuardScan:', err);
      return { success: false, message: err instanceof Error ? err.message : 'Error interno.' };
    }
  };

  const confirmComboCheckin = async (
    state: ComboCheckinState, isDamaged: boolean, damageNotes: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await apiGuard.confirmComboCheckin(state, isDamaged, damageNotes);
      if (result.success) {
        if (result.message.includes('daño')) toast.warning('Daño registrado. Activos a mantenimiento.');
        else toast.success('Devolución registrada.');
        fetchData();
      }
      return result;
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Error' };
    }
  };

  const markNotificationRead = async (notifId: string) => {
    try {
      await apiNotifications.markRead(notifId);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (_) {}
  };

  const markAllRead = async (userId: string) => {
    try {
      await apiNotifications.markAllRead(userId);
      setNotifications(prev => prev.map(n => n.user_id === userId ? { ...n, is_read: true } : n));
      toast.success('Todas leídas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const reportMaintenance = async (assetId: string, userId: string, description: string) => {
    try {
      await apiMaintenance.reportMaintenance(assetId, userId, description);
      toast.warning('En mantenimiento');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const resolveMaintenance = async (logId: number, cost?: number) => {
    try {
      await apiMaintenance.resolveMaintenance(logId, cost);
      toast.success('Resuelto');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const getAssetHistory = (assetId: string) =>
    auditLogs.filter(l => l.target_id === assetId || (l.metadata as Record<string, unknown>)?.asset_id === assetId);

  return {
    assets,
    requests,
    institutions,
    notifications,
    maintenanceLogs,
    bundles,
    auditLogs,
    stats,
    isLoading,
    unreadCount,
    addAsset,
    updateAsset,
    deleteAsset,
    importAssets,
    getNextTag,
    validateMaintenanceAsset,
    createBundle,
    updateBundle,
    createBatchRequest,
    addInstitution,
    updateInstitution,
    deleteInstitution,
    processQRScan,
    approveRequest,
    rejectRequest,
    returnRequestWithFeedback,
    getTeamRequests,
    createRequest,
    createMultipleRequests,
    cancelRequest,
    renewRequest,
    getUserRequests,
    generateQRCode,
    getQRPayload,
    processGuardScan,
    confirmComboCheckin,
    markNotificationRead,
    markAllRead,
    reportMaintenance,
    resolveMaintenance,
    getAssetHistory,
    fetchData,
    loadMoreAuditLogs,
    loadMoreMaintenanceLogs,
  };
}
