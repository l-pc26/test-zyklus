import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Card, Button } from '../ui/core';
import { NotificationCenter } from '../ui/NotificationCenter';
import { RequestDetailModal } from '../ui/RequestDetailModal';
import {
  Check, X, RotateCcw, Box, User as UserIcon, LogOut,
  Package, Building2, Info, Clock, Plus, QrCode
} from 'lucide-react';
import type { Request } from '../../types';
import { ThemeToggle } from '../ui/ThemeToggle';
import { DataLoadingScreen } from '../ui/DataLoadingScreen';
import { UserHome } from '../user/UserHome';
import { RefreshButton } from '../ui/RefreshButton';
import { LeaderQRModal, RejectionModal, TeamView } from './inbox';

/** Inbox del líder: aprobar/rechazar solicitudes, ver equipo y mis préstamos. */
export function ManagerInbox() {
  const { getUserRequests, getTeamRequests, approveRequest, rejectRequest, returnRequestWithFeedback, requests, isLoading } = useData();
  const { logout, user } = useAuth();

  const [activeTab, setActiveTab] = useState<'inbox' | 'team' | 'myloans'>('inbox');
  const [rejectionModal, setRejectionModal] = useState<{ reqId: number; type: 'reject' | 'return' } | null>(null);
  const [leaderQRReq, setLeaderQRReq] = useState<Request | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [inboxDetailReq, setInboxDetailReq] = useState<Request | null>(null);

  const teamRequestsGrouped = getTeamRequests(user?.id || '');
  const pendingRequests = teamRequestsGrouped.filter(r => r.status === 'PENDING');

  const myRequestsGrouped = getUserRequests(user?.id || '');
  const myActiveLoans = myRequestsGrouped.filter(r => ['APPROVED', 'ACTIVE', 'ACTIVE_INTERNAL'].includes(r.status));

  const getRealRequest = (req: Request): Request => {
    if (req.bundle_group_id) {
      return requests.find(r => r.bundle_group_id === req.bundle_group_id) || req;
    }
    return requests.find(r => r.id === req.id) || req;
  };

  if (isRequesting) {
    return <UserHome isManagerView={true} onBack={() => setIsRequesting(false)} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <DataLoadingScreen message="Cargando bandeja de solicitudes..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans pb-24">
      {leaderQRReq && (
        <LeaderQRModal
          request={leaderQRReq as Request & { is_bundle?: boolean; bundle_items?: number }}
          onClose={() => setLeaderQRReq(null)}
        />
      )}

      {rejectionModal && (
        <RejectionModal
          type={rejectionModal.type}
          onConfirm={(reason) => {
            if (rejectionModal.type === 'reject') rejectRequest(rejectionModal.reqId, reason);
            else returnRequestWithFeedback(rejectionModal.reqId, reason);
            setRejectionModal(null);
          }}
          onCancel={() => setRejectionModal(null)}
        />
      )}

      {inboxDetailReq && (
        <RequestDetailModal
          request={getRealRequest(inboxDetailReq)}
          onClose={() => setInboxDetailReq(null)}
        />
      )}

      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-white">Hola, <span className="text-primary">{user?.name?.split(' ')[0]}</span></h1>
            <p className="text-[11px] text-slate-500">{pendingRequests.length} solicitudes pendientes</p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton />
            <NotificationCenter />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={logout}><LogOut size={18} /></Button>
          </div>
        </div>

        <div className="flex border-t border-slate-800">
          {[
            { id: 'inbox', label: 'Bandeja', badge: pendingRequests.length },
            { id: 'team', label: 'Mi Equipo', badge: 0 },
            { id: 'myloans', label: 'Mis Préstamos', badge: myActiveLoans.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className="bg-primary text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto">

        {activeTab === 'inbox' && (
          <div className="space-y-4">
            {pendingRequests.length === 0 && (
              <div className="text-center py-20 opacity-50">
                <Box size={48} className="mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">Todo al día. No hay solicitudes pendientes.</p>
              </div>
            )}

            {pendingRequests.map((req) => {
              const r = req as Request & { is_bundle?: boolean; bundle_items?: number };
              return (
                <Card key={r.id} className="hover:border-primary/20 transition-all border border-slate-800 bg-slate-900/50">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div
                      className="flex items-start gap-4 flex-1 cursor-pointer"
                      onClick={() => setInboxDetailReq(r)}
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                        {r.users?.avatar
                          ? <img src={r.users.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                          : <UserIcon size={24} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                          {r.requester_name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-primary text-sm font-medium flex items-center gap-1">
                            {r.is_bundle ? <Package size={14} /> : <Box size={14} />}
                            {r.is_bundle
                              ? `Combo: ${r.motive?.match(/\[(?:KIT|COMBO): (.+?)\]/)?.[1] || ''} (${r.bundle_items} equipos)`
                              : r.assets?.name}
                          </p>
                          {r.is_internal && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] bg-slate-800 border border-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full">
                              Préstamo interno
                            </span>
                          )}
                        </div>
                        {r.institutions?.name && (
                          <div className="flex items-center gap-1.5 mt-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2 py-1 w-fit">
                            <Building2 size={11} className="text-cyan-400 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-cyan-400">Institución Externa</p>
                              <p className="text-[10px] text-cyan-300">{r.institutions.name}</p>
                            </div>
                          </div>
                        )}
                        <p className="text-slate-400 text-xs mt-1 italic">
                          "{r.is_bundle
                            ? (r.motive?.split('] ')[1] || 'Sin motivo adicional')
                            : (r.motive || 'Sin motivo especificado')}"
                        </p>
                        <div className="flex gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {r.days_requested === 0 ? 'Mismo día' : `${r.days_requested} días`}
                          </span>
                          <span>{r.requester_disciplina}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-2 flex items-center gap-1">
                          <Info size={9} /> Toca la tarjeta para ver detalles completos
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex flex-row md:flex-col gap-2 justify-end flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <Button
                        onClick={() => user && approveRequest(r.id, user.id, user.name)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs border-0"
                      >
                        <Check size={14} className="mr-1" /> Aprobar
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setRejectionModal({ reqId: r.id, type: 'return' })}
                          className="flex-1 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs"
                          title="Devolver con comentario"
                        >
                          <RotateCcw size={13} />
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => setRejectionModal({ reqId: r.id, type: 'reject' })}
                          className="flex-1 text-xs border-rose-500/30 hover:bg-rose-500/10 text-rose-500"
                          title="Rechazar definitivamente"
                        >
                          <X size={13} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'team' && <TeamView />}

        {activeTab === 'myloans' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Mis Préstamos</h2>
              <Button size="sm" variant="neon" onClick={() => setIsRequesting(true)} className="text-xs">
                <Plus size={14} className="mr-1" /> Auto-solicitar
              </Button>
            </div>

            {myActiveLoans.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <p className="text-sm">No tienes préstamos activos.</p>
              </div>
            ) : (
              myActiveLoans.map((req) => {
                const r = req as Request & { is_bundle?: boolean; bundle_items?: number };
                return (
                  <Card key={r.id} className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-white font-bold">
                        {r.is_bundle ? `Combo (${r.bundle_items} equipos)` : r.assets?.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {r.is_bundle ? 'Solicitud Grupal' : r.assets?.tag}
                      </p>
                      {r.institutions?.name && (
                        <p className="text-[10px] text-cyan-400 flex items-center gap-1 mt-1">
                          <Building2 size={9} /> {r.institutions.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded">
                        {r.status}
                      </span>
                      {r.status === 'APPROVED' && (
                        <Button size="sm" variant="neon" onClick={() => setLeaderQRReq(r)} className="text-xs h-8">
                          <QrCode size={12} className="mr-1" /> QR
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
