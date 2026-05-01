import { useState } from 'react';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import { RequestDetailModal } from '../../ui/RequestDetailModal';
import { Users, User as UserIcon, Building2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Request } from '../../../types';

/** Vista de líder: muestra los préstamos activos, aprobados y vencidos del equipo (incluye combos). */
export function TeamView() {
  const { requests } = useData();
  const { user } = useAuth();
  const [detailReq, setDetailReq] = useState<Request | null>(null);

  const teamActive = Array.from(
    requests.filter(r =>
      r.users?.manager_id === user?.id &&
      ['ACTIVE', 'ACTIVE_INTERNAL', 'OVERDUE', 'APPROVED'].includes(r.status)
    ).reduce((acc, r) => {
      if (r.bundle_group_id) {
        if (!acc.has(r.bundle_group_id)) acc.set(r.bundle_group_id, { ...r, is_bundle: true, bundle_items: 1 });
        else {
          const ex = acc.get(r.bundle_group_id)!;
          ex.bundle_items = (ex.bundle_items || 1) + 1;
        }
      } else {
        acc.set(r.id, r);
      }
      return acc;
    }, new Map<string | number, Request>()).values()
  );

  const getRealRequest = (req: Request): Request =>
    requests.find(r => r.id === req.id) || req;

  return (
    <div className="space-y-4">
      {detailReq && (
        <RequestDetailModal
          request={getRealRequest(detailReq)}
          onClose={() => setDetailReq(null)}
        />
      )}

      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Activos en manos de mi equipo</h2>
      {teamActive.length === 0 ? (
        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
          <Users size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Tu equipo no tiene activos prestados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teamActive.map((req) => {
            const isOverdue = req.status === 'OVERDUE';
            const r = req as Request & { is_bundle?: boolean; bundle_items?: number };
            return (
              <div
                key={r.id}
                className={`bg-slate-900 border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/30 transition-all ${isOverdue ? 'border-rose-500/30' : 'border-slate-800'}`}
                onClick={() => setDetailReq(r)}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                  {r.users?.avatar
                    ? <img src={r.users.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                    : <UserIcon size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{r.requester_name}</p>
                  <p className="text-slate-400 text-xs truncate">
                    {r.is_bundle ? `Combo (${r.bundle_items} equipos)` : r.assets?.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {r.is_internal && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] bg-slate-800 border border-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full">
                        Préstamo interno
                      </span>
                    )}
                    {r.institutions?.name && (
                      <p className="text-cyan-400 text-[10px] flex items-center gap-1">
                        <Building2 size={9} /> {r.institutions.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${isOverdue ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'}`}>
                    {isOverdue ? 'VENCIDO' : req.status === 'ACTIVE_INTERNAL' ? 'SUCURSAL' : 'ACTIVO'}
                  </span>
                  {r.expected_return_date && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      {format(new Date(r.expected_return_date), 'd MMM', { locale: es })}
                    </p>
                  )}
                  <p className="text-[9px] text-slate-600 mt-1 flex items-center justify-end gap-0.5">
                    <Info size={8} /> ver detalle
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
