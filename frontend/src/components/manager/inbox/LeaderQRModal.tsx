import { Card } from '../../ui/core';
import { X } from 'lucide-react';
import QRCode from 'react-qr-code';
import type { Request } from '../../../types';

interface LeaderQRModalProps {
  request: Request & { is_bundle?: boolean; bundle_items?: number };
  onClose: () => void;
}

/** Modal con QR para que el líder retire el activo aprobado. */
export function LeaderQRModal({ request, onClose }: LeaderQRModalProps) {
  const qrData = JSON.stringify({
    request_id: request.id,
    bundle_group_id: request.bundle_group_id,
    asset_id: request.asset_id,
    generated_at: new Date().toISOString()
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-xs text-center border-primary/30">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold">Mi QR de Salida</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="bg-white p-4 rounded-xl mb-4 inline-block">
          <QRCode value={qrData} size={180} />
        </div>
        <p className="text-xs text-slate-400 font-bold mb-1">
          {request.is_bundle
            ? `Combo (${request.bundle_items} piezas)`
            : request.assets?.name}
        </p>
        <p className="text-[10px] text-slate-500">Aprobación automática de Líder.</p>
      </Card>
    </div>
  );
}
