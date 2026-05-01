/** Centro de notificaciones: panel móvil (drawer) y escritorio (dropdown). */
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Bell, BellOff, X, CheckCheck, Info, AlertTriangle, AlertCircle, Zap } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { requestPushPermission } from '../../context/DataContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Notification } from '../../types';

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  INFO:     { icon: <Info size={14} />,         color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20' },
  WARNING:  { icon: <AlertTriangle size={14} />, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  ALERT:    { icon: <AlertCircle size={14} />,   color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20' },
  CRITICAL: { icon: <Zap size={14} />,           color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
};

/** Títulos de notificaciones que el auditor sí puede ver (vencimientos). */
const AUDITOR_ALLOWED_TITLES = [
  'Préstamo Vencido',
  'Incumplimiento —3 dias',
];

/** Títulos que el administrador patrimonial no debe ver (solicitudes, retiros, devoluciones sin daño). */
const ADMIN_HIDDEN_TITLES = [
  'Nueva Solicitud',
  'Nueva Solicitud — Carrito',
  'Nueva Solicitud — Combo',
  'Activo Retirado',
  'Equipo Retirado',
  'Devolución Registrada',
];

function NotifItem({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const cfg = typeConfig[notif.type] || typeConfig.INFO;
  const time = format(new Date(notif.created_at), "d MMM, HH:mm", { locale: es });

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
        notif.is_read
          ? 'bg-slate-900/30 border-slate-800/50 opacity-60'
          : `${cfg.bg} cursor-pointer active:scale-[0.98]`
      }`}
      onClick={() => !notif.is_read && onRead(notif.id)}
    >
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${notif.is_read ? 'bg-slate-800/50' : cfg.bg} ${cfg.color}`}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-bold leading-tight ${notif.is_read ? 'text-slate-400' : 'text-white'}`}>
            {notif.title}
          </p>
          {!notif.is_read && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1" />}
        </div>
        <p className={`text-xs leading-relaxed mt-0.5 ${notif.is_read ? 'text-slate-600' : 'text-slate-300'}`}>
          {notif.message}
        </p>
        <p className="text-[10px] text-slate-600 mt-1">{time}</p>
      </div>
    </div>
  );
}

/** Drawer móvil renderizado en document.body para que siempre se fije al viewport. */
function MobileDrawer({
  open,
  onClose,
  panelNotifs,
  panelUnread,
  pushEnabled,
  role,
  markNotificationRead,
  markAllRead,
  userId,
  handleEnablePush,
}: {
  open: boolean;
  onClose: () => void;
  panelNotifs: Notification[];
  panelUnread: number;
  pushEnabled: boolean;
  role: string;
  markNotificationRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  userId: string;
  handleEnablePush: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [visible, setVisible] = useState(false);
  const startYRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      setDragY(0);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 100) onClose();
    else setDragY(0);
  };

  const backdropOpacity = Math.max(0.05, 1 - dragY / 250);

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{
          zIndex: 9998,
          opacity: visible ? backdropOpacity : 0,
          transition: isDragging ? 'none' : 'opacity 0.3s ease',
        }}
        onClick={onClose}
      />

      {/* Drawer — SIEMPRE anclado al fondo del viewport */}
      <div
        className="fixed left-0 right-0 bottom-0 flex flex-col rounded-t-3xl border-t border-slate-800 bg-slate-950 shadow-[0_-24px_80px_rgba(0,0,0,0.9)]"
        style={{
          zIndex: 9999,
          height: '75vh',
          transform: `translateY(${visible ? dragY : '100%'}px)`,
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag pill */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 touch-none select-none">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              Notificaciones
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                EN VIVO
              </span>
            </h3>
            {role === 'AUDITOR' && (
              <p className="text-[10px] text-amber-400 font-bold mt-0.5">Solo alertas de vencimientos</p>
            )}
            {panelUnread > 0 && (
              <p className="text-primary text-[10px] font-bold mt-0.5">{panelUnread} sin leer</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 active:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Push banner */}
        {!pushEnabled && 'Notification' in window && Notification.permission === 'default' && (
          <div className="mx-4 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 flex-shrink-0">
            <BellOff size={14} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-xs flex-1 min-w-0">Activa notificaciones nativas</p>
            <button
              onClick={handleEnablePush}
              className="text-[10px] font-black text-black bg-amber-400 px-3 py-1.5 rounded-lg flex-shrink-0"
            >
              Activar
            </button>
          </div>
        )}

        {/* Mark all read */}
        {panelUnread > 0 && (
          <div className="px-4 pt-3 pb-1 flex-shrink-0">
            <button
              onClick={() => markAllRead(userId)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-primary/30 text-primary bg-primary/5 text-sm font-bold active:scale-[0.98] transition-transform"
            >
              <CheckCheck size={15} />
              Marcar todas como leídas ({panelUnread})
            </button>
          </div>
        )}

        {/* List */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
          style={{ overscrollBehavior: 'contain' }}
        >
          {panelNotifs.length === 0 ? (
            <div className="text-center py-14">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4">
                <Bell size={28} className="text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm font-medium">
                {role === 'AUDITOR' ? 'Sin vencimientos activos' : 'Sin notificaciones'}
              </p>
              <p className="text-slate-600 text-xs mt-1">
                {role === 'AUDITOR' ? 'Solo alertas de préstamos atrasados' : 'Estás al día'}
              </p>
            </div>
          ) : (
            panelNotifs.map(n => (
              <NotifItem key={n.id} notif={n} onRead={markNotificationRead} />
            ))
          )}
        </div>

        {/* Safe area (iPhone home bar) */}
        <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom, 12px)', minHeight: '12px' }} />
      </div>
    </>,
    document.body
  );
}

export function NotificationCenter() {
  const { notifications, markNotificationRead, markAllRead } = useData();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('Notification' in window) setPushEnabled(Notification.permission === 'granted');
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, isMobile]);

  if (!user) return null;

  const role = user.role;
  const userId = user.id;

  const getFilteredNotifs = (): Notification[] => {
    if (role === 'AUDITOR') {
      return notifications.filter(n =>
        n.user_id === userId &&
        AUDITOR_ALLOWED_TITLES.some(t => n.title.includes(t))
      );
    }
    if (role === 'ADMIN_PATRIMONIAL') {
      return notifications.filter(n =>
        n.user_id === userId &&
        !ADMIN_HIDDEN_TITLES.some(t => n.title === t || n.title.startsWith(t))
      );
    }
    return notifications.filter(n => n.user_id === userId);
  };

  const panelNotifs = getFilteredNotifs().slice(0, 30);
  const panelUnread = panelNotifs.filter(n => !n.is_read).length;

  const handleEnablePush = async () => {
    const granted = await requestPushPermission();
    setPushEnabled(granted);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all active:scale-90 ${
          open ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
      >
        <Bell size={20} />
        {panelUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-black text-[10px] font-black rounded-full flex items-center justify-center shadow-lg animate-pulse">
            {panelUnread > 99 ? '99+' : panelUnread}
          </span>
        )}
      </button>

      {/* ── MOBILE: Portal drawer (siempre anclado al fondo del viewport) ── */}
      {isMobile && (
        <MobileDrawer
          open={open}
          onClose={() => setOpen(false)}
          panelNotifs={panelNotifs}
          panelUnread={panelUnread}
          pushEnabled={pushEnabled}
          role={role}
          markNotificationRead={markNotificationRead}
          markAllRead={markAllRead}
          userId={userId}
          handleEnablePush={handleEnablePush}
        />
      )}

      {/* ── DESKTOP: dropdown normal ── */}
      {!isMobile && open && (
        <div
          className="absolute right-0 top-12 w-96 z-50 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200"
          style={{ maxHeight: '75vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                Notificaciones
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  EN VIVO
                </span>
              </h3>
              {role === 'AUDITOR' && (
                <p className="text-[10px] text-amber-400 font-bold mt-0.5">Solo alertas de vencimientos</p>
              )}
              {panelUnread > 0 && (
                <p className="text-primary text-[10px] font-bold">{panelUnread} sin leer</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {pushEnabled && (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <Bell size={10} /> Activas
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Push banner */}
          {!pushEnabled && 'Notification' in window && Notification.permission === 'default' && (
            <div className="mx-3 mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 flex-shrink-0">
              <BellOff size={16} className="text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-amber-300 text-xs font-bold">Activa notificaciones</p>
                <p className="text-amber-500 text-[10px]">Recibe alertas aunque la app esté cerrada</p>
              </div>
              <button
                onClick={handleEnablePush}
                className="text-[10px] font-black text-black bg-amber-400 hover:bg-amber-300 px-2 py-1.5 rounded-lg flex-shrink-0"
              >
                Activar
              </button>
            </div>
          )}

          {/* Mark all read */}
          {panelUnread > 0 && (
            <div className="px-4 pt-3 pb-1 flex-shrink-0">
              <button
                onClick={() => markAllRead(userId)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-primary/30 text-primary bg-primary/5 text-xs font-bold hover:bg-primary/10 transition-colors"
              >
                <CheckCheck size={14} />
                Marcar todas como leídas ({panelUnread})
              </button>
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1 p-3 space-y-2">
            {panelNotifs.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3">
                  {role === 'AUDITOR' ? <AlertCircle size={22} className="text-slate-600" /> : <Bell size={22} className="text-slate-600" />}
                </div>
                <p className="text-slate-400 text-sm font-medium">
                  {role === 'AUDITOR' ? 'Sin vencimientos activos' : 'Sin notificaciones'}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  {role === 'AUDITOR' ? 'Solo alertas de préstamos atrasados' : 'Estás al día'}
                </p>
              </div>
            ) : (
              panelNotifs.map(n => <NotifItem key={n.id} notif={n} onRead={markNotificationRead} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}