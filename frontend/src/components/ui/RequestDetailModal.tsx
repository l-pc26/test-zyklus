/** Modal con detalle de una solicitud. */
import React from 'react';
import { X, Package, Clock, User, Building2, Tag, Calendar, Hash, CheckCircle, AlertCircle, RotateCcw, XCircle, Hourglass, FileDown } from 'lucide-react';
import { Card } from './core';
import { generateResponsibilityVoucher } from '../../lib/exportUtils';
import type { Request } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RequestDetailModalProps {
  request: Request;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:         { label: 'Pendiente de Aprobación', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',   icon: <Hourglass size={14} /> },
  ACTION_REQUIRED: { label: 'Acción Requerida',         color: 'text-orange-400 bg-orange-500/10 border-orange-500/30', icon: <AlertCircle size={14} /> },
  APPROVED:        { label: 'Aprobado — Listo para retirar', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: <CheckCircle size={14} /> },
  ACTIVE:          { label: 'En Préstamo',              color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',     icon: <CheckCircle size={14} /> },
  OVERDUE:         { label: 'VENCIDO',                  color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',     icon: <AlertCircle size={14} /> },
  ACTIVE_INTERNAL: { label: 'Prestado en Sucursal',    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',     icon: <CheckCircle size={14} /> },
  RETURNED:        { label: 'Devuelto',                 color: 'text-slate-400 bg-slate-700/50 border-slate-600/30', icon: <CheckCircle size={14} /> },
  MAINTENANCE:     { label: 'En Mantenimiento',         color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', icon: <RotateCcw size={14} /> },
  REJECTED:        { label: 'Rechazado',                color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',     icon: <XCircle size={14} /> },
  CANCELLED:       { label: 'Cancelado',                color: 'text-slate-500 bg-slate-800/50 border-slate-700/30', icon: <XCircle size={14} /> },
  IN_PROGRESS:     { label: 'En Trámite',               color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',    icon: <Hourglass size={14} /> },
};

const Field = ({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
      {icon && <span className="text-slate-500 mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-200 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
};

export function RequestDetailModal({ request: req, onClose }: RequestDetailModalProps) {
  const status = statusConfig[req.status] || { label: req.status, color: 'text-slate-400 bg-slate-700 border-slate-600', icon: null };
  const isBundle = !!req.bundle_group_id && req.is_bundle;

  const safeDate = (d?: string | null) =>
    d ? format(new Date(d), "d 'de' MMMM yyyy, HH:mm", { locale: es }) : null;

  const safeDateShort = (d?: string | null) =>
    d ? format(new Date(d), 'd MMM yyyy', { locale: es }) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md animate-in slide-in-from-bottom-4 duration-200">
        <Card className="border border-slate-700/50 shadow-2xl p-0 overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-slate-800">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-2">
                {isBundle
                  ? <Package size={16} className="text-primary flex-shrink-0" />
                  : <Tag size={16} className="text-primary flex-shrink-0" />
                }
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  {isBundle ? `Combo · ${req.bundle_items || 1} equipos` : 'Solicitud Individual'}
                </span>
              </div>
              <h2 className="text-white font-bold text-lg leading-tight">
                {isBundle
                  ? req.motive?.match(/\[(?:KIT|COMBO): (.+?)\]/)?.[1] || 'Combo de equipos'
                  : req.assets?.name || `Activo #${req.asset_id}`
                }
              </h2>
              {!isBundle && req.assets?.tag && (
                <p className="text-slate-500 text-xs font-mono mt-1">{req.assets.tag}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          {/* Status badge */}
          <div className="px-5 pt-4">
            <span className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border ${status.color}`}>
              {status.icon} {status.label}
            </span>
          </div>

          {/* Content */}
          <div className="px-5 py-3 space-y-0 max-h-[55vh] overflow-y-auto scrollbar-hide">

            {/* Activos info */}
            {isBundle && req.bundle_assets && req.bundle_assets.length > 0 ? (
              <div className="py-2.5 border-b border-slate-800/60">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-500"><Package size={14} /></span>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Activos del Combo ({req.bundle_assets.length})</p>
                </div>
                <div className="space-y-1.5">
                  {req.bundle_assets.map((a, i) => (
                    <div key={a.id ?? i} className="bg-slate-800/40 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-200 font-medium truncate">{a.name}</span>
                        <span className="text-[10px] font-mono text-primary ml-2 flex-shrink-0">{a.tag}</span>
                      </div>
                      {a.category && (
                        <span className="text-[10px] text-slate-500 mt-0.5 block">{a.category}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : !isBundle && req.assets ? (
              <>
                <Field label="Activo" value={req.assets.name} icon={<Package size={14} />} />
                {req.assets.category && <Field label="Categoría" value={req.assets.category} icon={<Tag size={14} />} />}
                {req.assets.brand && <Field label="Marca / Modelo" value={`${req.assets.brand}${req.assets.model ? ` — ${req.assets.model}` : ''}`} />}
                {req.assets.location && <Field label="Ubicación del activo" value={req.assets.location} />}
              </>
            ) : null}

            {/* Solicitante */}
            <Field label="Solicitante" value={req.requester_name} icon={<User size={14} />} />
            <Field label="Disciplina" value={req.requester_disciplina} />

            {/* Institución — visible para líderes */}
            {req.institutions?.name && (
              <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/60">
                <Building2 size={14} className="text-cyan-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Institución Externa</p>
                  <p className="text-sm text-cyan-300 font-medium mt-0.5">{req.institutions.name}</p>
                  {req.institutions.contact_name && (
                    <p className="text-xs text-slate-400 mt-0.5">Contacto: {req.institutions.contact_name}</p>
                  )}
                  {req.institutions.contact_email && (
                    <p className="text-xs text-slate-500">{req.institutions.contact_email}</p>
                  )}
                </div>
              </div>
            )}

            {/* Duración */}
            <Field
              label="Duración del préstamo"
              value={req.days_requested === 0 ? 'Mismo día (hasta las 9 PM)' : `${req.days_requested} días`}
              icon={<Clock size={14} />}
            />

            {/* Tipo de Préstamo */}
            {req.is_internal && <Field label="Tipo de Préstamo" value="Préstamo Interno (Sucursal)" icon={<Building2 size={14} />} />}

            {/* Motivo */}
            {req.motive && (
              <Field
                label="Motivo"
                value={isBundle
                  ? (req.motive.split('] ')[1] || req.motive.split(']')[1] || req.motive)
                  : req.motive
                }
              />
            )}

            {/* Fechas */}
            <Field label="Fecha de solicitud" value={safeDate(req.created_at)} icon={<Calendar size={14} />} />
            {req.approved_at && <Field label="Fecha de aprobación" value={safeDate(req.approved_at)} />}
            {req.checkout_at && <Field label="Fecha de retiro" value={safeDate(req.checkout_at)} />}
            {req.expected_return_date && (
              <Field
                label="Retorno esperado"
                value={safeDateShort(req.expected_return_date)}
                icon={<Calendar size={14} />}
              />
            )}
            {req.checkin_at && <Field label="Fecha de devolución" value={safeDate(req.checkin_at)} />}

            {/* ID de referencia */}
            <Field label="ID de solicitud" value={`#${req.id}`} icon={<Hash size={14} />} />
            {req.bundle_group_id && <Field label="ID de combo" value={req.bundle_group_id} />}

            {/* Feedback / Notas */}
            {req.feedback_log && (
              <div className="mt-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-orange-400 uppercase mb-1">Comentario del Líder</p>
                <p className="text-xs text-orange-200">{req.feedback_log}</p>
              </div>
            )}
            {req.rejection_feedback && (
              <div className="mt-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-rose-400 uppercase mb-1">Motivo de Rechazo</p>
                <p className="text-xs text-rose-200">{req.rejection_feedback}</p>
              </div>
            )}
            {req.is_damaged && req.damage_notes && (
              <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                <p className="text-[10px] font-bold text-amber-400 uppercase mb-1">Daños Reportados</p>
                <p className="text-xs text-amber-200">{req.damage_notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-800 space-y-2">
            {req.digital_signature && (
              <button
                onClick={() => generateResponsibilityVoucher(req)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-black bg-cyan-500 hover:bg-cyan-400 rounded-xl transition-all shadow-lg shadow-cyan-500/20"
              >
                <FileDown size={14} /> Descargar Comprobante de Resguardo
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all"
            >
              Cerrar
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
