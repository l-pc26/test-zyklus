import { useMemo, useState } from 'react';
import {
  BookOpenText,
  LogIn,
  LogOut,
  X,
} from 'lucide-react';
import { Button, Card } from '../../ui/core';

type KioskAction = 'CHECKIN' | 'CHECKOUT';

export function GuardKioskScreen() {
  const [action, setAction] = useState<KioskAction | null>(null);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  const instructions = useMemo(
    () => ({
      checkout: [
        { title: '1) Escanea QR de solicitud', desc: 'El QR lo genera el solicitante desde la app.' },
        { title: '2) Escanea QR del activo', desc: 'Verifica físicamente el equipo antes de confirmar.' },
      ],
      checkin: [{ title: 'Escanea QR del activo', desc: 'Lee la etiqueta física del equipo para registrar la entrada.' }],
    }),
    [],
  );

  return (
    <div className="h-full bg-background overflow-hidden">
      <div className="relative h-full overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_15%,rgba(6,182,212,0.10),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(168,85,247,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950/50" />

        <div className="relative h-full max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-6 shrink-0">
            <div>
              <p className="text-slate-400 text-xs font-black tracking-widest uppercase">ZF / Zyklus Halo</p>
              <h1 className="text-white font-black text-3xl sm:text-4xl tracking-tight">Kiosko de Guardia</h1>
              <p className="mt-1 text-slate-500 text-sm">Selecciona una acción para iniciar.</p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl font-black"
              onClick={() => setIsHowItWorksOpen(true)}
            >
              <BookOpenText size={16} className="mr-2" />
              ¿Cómo funciona?
            </Button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => setAction('CHECKOUT')}
                className={[
                  'h-[220px] sm:h-[260px] rounded-[28px] border text-left px-8 sm:px-10 py-8 sm:py-10 transition-all active:scale-[0.99]',
                  'relative overflow-hidden bg-slate-900/80 hover:bg-slate-900',
                  'shadow-[0_20px_60px_rgba(0,0,0,0.35)]',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25',
                  action === 'CHECKOUT'
                    ? 'border-primary/50 ring-2 ring-primary/25'
                    : 'border-white/15 hover:border-white/25',
                ].join(' ')}
              >
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(600px_circle_at_20%_20%,rgba(6,182,212,0.18),transparent_60%)]" />
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/80" />
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-slate-400 text-xs font-black tracking-widest uppercase">Salida</p>
                    <h2 className="mt-2 text-white font-black text-4xl tracking-tight">Check-out</h2>
                    <p className="mt-2 text-slate-300 text-base font-medium">Escanea solicitud → luego activo</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 shadow-[0_0_0_1px_rgba(6,182,212,0.10)]">
                    <LogOut className="text-primary" size={28} />
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAction('CHECKIN')}
                className={[
                  'h-[220px] sm:h-[260px] rounded-[28px] border text-left px-8 sm:px-10 py-8 sm:py-10 transition-all active:scale-[0.99]',
                  'relative overflow-hidden bg-slate-900/80 hover:bg-slate-900',
                  'shadow-[0_20px_60px_rgba(0,0,0,0.35)]',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25',
                  action === 'CHECKIN'
                    ? 'border-primary/50 ring-2 ring-primary/25'
                    : 'border-white/15 hover:border-white/25',
                ].join(' ')}
              >
                <div className="absolute inset-0 opacity-70 bg-[radial-gradient(600px_circle_at_20%_20%,rgba(6,182,212,0.16),transparent_60%)]" />
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/80" />
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-slate-400 text-xs font-black tracking-widest uppercase">Entrada</p>
                    <h2 className="mt-2 text-white font-black text-4xl tracking-tight">Check-in</h2>
                    <p className="mt-2 text-slate-300 text-base font-medium">Escanea el activo</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 shadow-[0_0_0_1px_rgba(6,182,212,0.10)]">
                    <LogIn className="text-primary" size={28} />
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="shrink-0 pt-5">
            <p className="text-center text-slate-500 text-sm">
              Acerca el código QR al escáner del kiosko para continuar.
            </p>
          </div>
        </div>

        {isHowItWorksOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-2xl glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-black tracking-widest uppercase">Instrucciones</p>
                  <h3 className="text-white font-black text-lg">¿Cómo funciona?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHowItWorksOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-5 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5">
                  <p className="text-slate-400 text-xs font-black tracking-widest uppercase">Check-out (Salida)</p>
                  <div className="mt-3 space-y-3">
                    {instructions.checkout.map((s) => (
                      <div key={s.title} className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                        <p className="text-white font-black">{s.title}</p>
                        <p className="text-slate-400 text-sm">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <p className="text-slate-400 text-xs font-black tracking-widest uppercase">Check-in (Entrada)</p>
                  <div className="mt-3 space-y-3">
                    {instructions.checkin.map((s) => (
                      <div key={s.title} className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                        <p className="text-white font-black">{s.title}</p>
                        <p className="text-slate-400 text-sm">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="px-5 sm:px-6 py-4 border-t border-white/10 flex justify-end">
                <Button
                  type="button"
                  variant="default"
                  className="h-11 rounded-xl font-black"
                  onClick={() => setIsHowItWorksOpen(false)}
                >
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

