import React, { createContext, useContext, useEffect } from 'react';
import { useDataProvider, type ComboCheckinState } from './dataProvider/useDataProvider';
import type { Asset, Request, User, Institution, Notification, AuditLog, MaintenanceLog, Bundle } from '../types';

export type { ComboCheckinState } from './dataProvider/useDataProvider';

/** Tipo del contexto de datos: activos, solicitudes, notificaciones y acciones. */
interface DataContextType {
  assets: Asset[];
  requests: Request[];
  institutions: Institution[];
  notifications: Notification[];
  maintenanceLogs: MaintenanceLog[];
  bundles: Bundle[];
  auditLogs: AuditLog[];
  stats: { 
    assetCounts: Record<string, number>; 
    requestCounts: { overdue: number; active: number }; 
    categoryCounts?: Record<string, number>;
    topAssets?: Array<{ name: string; count: number }>;
    topUsers?: Array<{ name: string; count: number }>;
    disciplines?: string[];
    topAssetsByDiscipline?: Record<string, Array<{ name: string; count: number }>>;
  } | null;
  isLoading: boolean;
  unreadCount: number;

  addAsset: (asset: Partial<Asset>) => Promise<void>;
  updateAsset: (id: string, updates: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  importAssets: (csvText: string) => Promise<void>;
  getNextTag: () => Promise<string>;
  validateMaintenanceAsset: (assetId: string) => Promise<void>;

  createBundle: (name: string, description: string, assetIds: string[]) => Promise<void>;
  updateBundle: (id: string, patch: { name?: string; description?: string; assetIds?: string[] }) => Promise<void>;
  createBatchRequest: (bundle: Bundle, user: User, days: number, motive: string, autoApprove?: boolean, institutionId?: number, isInternal?: boolean) => Promise<void>;

  addInstitution: (inst: Partial<Institution>) => Promise<void>;
  updateInstitution: (id: number, updates: Partial<Institution>) => Promise<void>;
  deleteInstitution: (id: number) => Promise<void>;

  processQRScan: (qrData: string) => Promise<{ asset?: Asset; request?: Request } | null>;

  approveRequest: (reqId: number, approverId: string, approverName: string) => Promise<void>;
  rejectRequest: (reqId: number, reason: string) => Promise<void>;
  returnRequestWithFeedback: (reqId: number, feedback: string) => Promise<void>;
  getTeamRequests: (managerId: string) => Request[];

  createRequest: (asset: Asset, user: User, days: number, motive?: string, institutionId?: number, autoApprove?: boolean, isInternal?: boolean) => Promise<void>;
  createMultipleRequests: (assets: Asset[], user: User, days: number, motive?: string, institutionId?: number, autoApprove?: boolean, isInternal?: boolean) => Promise<void>;
  cancelRequest: (reqId: number) => Promise<void>;
  renewRequest: (reqId: number, additionalDays: number) => Promise<void>;
  getUserRequests: (userId: string) => Request[];

  generateQRCode: (requestId: number) => string;
  getQRPayload: (requestId: number) => object | null;

  processGuardScan: (
    qrData: string,
    type: 'CHECKOUT' | 'CHECKIN',
    signature?: string,
    isDamaged?: boolean,
    damageNotes?: string
  ) => Promise<{ success: boolean; message: string; data?: unknown; comboState?: ComboCheckinState }>;

  confirmComboCheckin: (
    state: ComboCheckinState,
    isDamaged: boolean,
    damageNotes: string
  ) => Promise<{ success: boolean; message: string }>;

  markNotificationRead: (notifId: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;

  reportMaintenance: (assetId: string, userId: string, description: string) => Promise<void>;
  resolveMaintenance: (logId: number, cost?: number) => Promise<void>;

  getAssetHistory: (assetId: string) => AuditLog[];
  fetchData: (opts?: { silent?: boolean }) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export const requestPushPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

/** Proveedor del contexto de datos; carga inicial y métodos de mutación. */
export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    requestPushPermission();
  }, []);

  const value = useDataProvider();

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
