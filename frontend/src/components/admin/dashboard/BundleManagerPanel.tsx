import React from 'react';
import { X, Package } from 'lucide-react';
import { Card } from '../../ui/core';
import { BundleManager } from '../BundleManager';

interface BundleManagerPanelProps {
  onClose: () => void;
}

/** Modal con el componente de gestión de kits (combos). */
export function BundleManagerPanel({ onClose }: BundleManagerPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-2xl border-primary/30 max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-slate-800">
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <Package size={20} className="text-primary" /> Gestión de Combos
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <BundleManager />
        </div>
      </Card>
    </div>
  );
}
