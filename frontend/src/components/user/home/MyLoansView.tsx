import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { Card, Button } from '../../ui/core';
import { RequestDetailModal } from '../../ui/RequestDetailModal';
import { Package, Clock, QrCode, MessageSquare, Trash2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import type { Request } from '../../../types';
import { StatusBadge } from './StatusBadge';
import { CancelConfirmModal } from './CancelConfirmModal';

interface MyLoansViewProps {
  onShowQR: (req: Request) => void;
  onFeedback: (req: Request) => void;
}

/** Vista de mis préstamos activos con opción de ver QR o dar feedback. */
export function MyLoansView({ onShowQR, onFeedback }: MyLoansViewProps) {
  const { getUserRequests, requests, cancelRequest } = useData();
  const { user } = useAuth();
  const [bundleDetailsId, setBundleDetailsId] = useState<string | null>(null);
  const [detailReq, setDetailReq] = useState<Request | null>(null);
  const [cancelReqId, setCancelReqId] = useState<number | null>(null);

  const userReqs = getUserRequests(user?.id || '');
  const active = userReqs.filter(r => ['PENDING', 'ACTION_REQUIRED', 'APPROVED', 'ACTIVE', 'ACTIVE_INTERNAL', 'OVERDUE'].includes(r.status));
  const history = userReqs.filter(r => ['RETURNED', 'MAINTENANCE', 'REJECTED', 'CANCELLED'].includes(r.status));

  const getRealRequest = (req: Request): Request => {
    if (req.bundle_group_id) {
      // Recoge TODOS los activos del grupo para pasarlos al modal como bundle_assets
      const siblings = requests.filter(r => r.bundle_group_id === req.bundle_group_id);
      const representante = siblings[0] || req;
      const allAssets = siblings
        .map(r => r.assets)
        .filter((a): a is NonNullable<typeof a> => a != null);
      return { ...representante, bundle_assets: allAssets.length > 0 ? allAssets : representante.bundle_assets };
    }
    return requests.find(r => r.id === req.id) || req;
  };

  const getBundleAssets = (bundleGroupId: string) =>
    requests
      .filter(r => r.bundle_group_id === bundleGroupId && r.assets)
      .map(r => r.assets!)
      .filter(Boolean);

  const handleCancel = async (reqId: number) => {
    await cancelRequest(reqId);
    setCancelReqId(null);
    toast.success('Solicitud cancelada y activo liberado');
  };

  return (
    <div className="space-y-6">
      {detailReq && <RequestDetailModal request={getRealRequest(detailReq)} onClose={() => setDetailReq(null)} />}
      {cancelReqId !== null && (
        <CancelConfirmModal onConfirm={() => handleCancel(cancelReqId)} onCancel={() => setCancelReqId(null)} />
      )}

      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Mis Préstamos Activos</h2>
        <div className="space-y-3">
          {active.length === 0 && (
            <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tienes préstamos activos.</p>
            </div>
          )}
          {active.map(req => {
            const isOverdue = req.status === 'OVERDUE';
            const isActionRequired = req.status === 'ACTION_REQUIRED';
            const isCancellable = ['PENDING', 'ACTION_REQUIRED'].includes(req.status);
            const reasonText = req.rejection_feedback || req.feedback_log;

            return (
              <Card key={req.id} className={`border transition-all ${isOverdue ? 'border-rose-500/40' : isActionRequired ? 'border-orange-500/40' : 'border-white/5'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailReq(req)}>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold truncate hover:text-primary transition-colors">
                        {req.is_bundle ? (req.motive?.match(/\[(?:KIT|COMBO): (.+?)\]/)?.[1] || 'Combo de equipos') : req.assets?.name || `Activo #${req.asset_id}`}
                      </h3>
                      {!req.is_bundle && <span className="text-xs text-slate-500 font-mono flex-shrink-0">{req.assets?.tag}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
                      <StatusBadge status={req.status} />
                      {req.expected_return_date && (
                        <span className={isOverdue ? 'text-rose-400' : 'text-slate-400'}>
                          <Clock size={10} className="inline mr-1" />
                          {format(new Date(req.expected_return_date), 'd MMM yyyy', { locale: es })}
                        </span>
                      )}
                    </div>
                    {req.is_bundle && (
                      <div className="mt-1">
                        <button
                          onClick={e => { e.stopPropagation(); setBundleDetailsId(bundleDetailsId === req.bundle_group_id ? null : (req.bundle_group_id ?? null)); }}
                          className="text-[10px] text-primary hover:underline flex items-center gap-1"
                        >
                          <Info size={12} /> {bundleDetailsId === req.bundle_group_id ? 'Ocultar' : `Ver ${req.bundle_items} equipos`}
                        </button>
                        {bundleDetailsId === req.bundle_group_id && req.bundle_group_id && (
                          <div className="mt-2 bg-slate-950 p-2 rounded border border-slate-800 space-y-1.5">
                            {getBundleAssets(req.bundle_group_id).map((asset, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-300 truncate">{asset.name}</span>
                                <span className="text-[10px] font-mono text-primary ml-2 flex-shrink-0">{asset.tag}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {isActionRequired && reasonText && (
                      <div className="mt-2 bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
                        <p className="text-xs text-orange-300">Líder dice: "{reasonText}"</p>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-600 mt-2 flex items-center gap-1"><Info size={9} /> Toca para ver detalles completos</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                    {req.status === 'APPROVED' && (
                      <Button size="sm" variant="neon" onClick={() => onShowQR(req)} className="text-[11px] h-8">
                        <QrCode size={12} className="mr-1" /> QR
                      </Button>
                    )}
                    {isActionRequired && (
                      <Button size="sm" variant="outline" onClick={() => onFeedback(req)} className="text-[11px] h-8 border-orange-500/40 text-orange-400">
                        <MessageSquare size={12} className="mr-1" /> Responder
                      </Button>
                    )}
                    {isCancellable && (
                      <button
                        onClick={e => { e.stopPropagation(); setCancelReqId(req.id); }}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Cancelar solicitud"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Historial</h2>
          <div className="space-y-2">
            {history.slice(0, 10).map(req => {
              const reasonText = req.rejection_feedback || req.feedback_log;
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors"
                  onClick={() => setDetailReq(getRealRequest(req))}
                >
                  <div>
                    <p className="text-slate-300 text-sm font-medium">
                      {req.is_bundle ? `Combo (${req.bundle_items} equipos)` : req.assets?.name || `Activo #${req.asset_id}`}
                    </p>
                    <p className="text-slate-500 text-xs">{format(new Date(req.created_at), 'd MMM yyyy', { locale: es })}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={req.status} />
                    {req.status === 'REJECTED' && reasonText && (
                      <p className="text-[9px] text-rose-400 mt-1 max-w-[150px] truncate">{reasonText}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
