import { Card } from '../../ui/core';
import { X } from 'lucide-react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Request } from '../../../types';

interface QRModalProps {
  request: Request & { is_bundle?: boolean; bundle_items?: number };
  onClose: () => void;
}

/** Modal que muestra el QR de una solicitud aprobada para retirar el activo. */
export function QRModal({ request, onClose }: QRModalProps) {
  const qrData = JSON.stringify({
    request_id: request.id,
    bundle_group_id: request.bundle_group_id,
    asset_id: request.asset_id,
    generated_at: new Date().toISOString()
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-xs text-center border-primary/30 shadow-[0_0_60px_rgba(6,182,212,0.2)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold">QR de Salida</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="bg-white p-4 rounded-xl mb-4 inline-block">
          <QRCode value={qrData} size={180} />
        </div>
        <div className="space-y-2 text-left bg-slate-900/80 rounded-xl p-3 border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Solicitante</span>
            <span className="text-white font-medium">{request.requester_name}</span>
          </div>
          <div className="flex justify-between text-xs text-primary font-bold">
            <span>{request.is_bundle ? 'Combo' : 'Activo'}</span>
            <span className="text-right">{request.is_bundle ? `${request.bundle_items} equipos` : request.assets?.name}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Retorno</span>
            <span className="text-primary font-medium">
              {request.expected_return_date ? format(new Date(request.expected_return_date), 'd MMM yyyy', { locale: es }) : '—'}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-3">Presenta este QR al guardia de seguridad.</p>
      </Card>
    </div>
  );
}
