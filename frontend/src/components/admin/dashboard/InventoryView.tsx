import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, Upload, Plus, CheckSquare, Square, QrCode, Edit, Trash2, X, Printer, Package, Shield
} from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { getAssetsPaginated } from '../../../api/assets';
import { Card, Button, Input } from '../../ui/core';
import { CategoryFilter } from '../../ui/CategoryFilter';
import { RefreshButton } from '../../ui/RefreshButton';
import { DataLoadingScreen } from '../../ui/DataLoadingScreen';
import { BundleManagerPanel } from './BundleManagerPanel';
import { INVENTORY_PAGE_SIZE } from './constants';
import type { Asset, AssetState } from '../../../types';

interface InventoryViewProps {
  onPrintSelected: (ids: Set<string>, assets: Asset[]) => void;
  onPrintSingle: (asset: Asset) => void;
}

/** Vista de inventario: tabla de activos, alta/edición, importación CSV y combos. */
export function InventoryView({ onPrintSelected, onPrintSingle }: InventoryViewProps) {
  const { addAsset, updateAsset, deleteAsset, importAssets, getNextTag, createBundle } = useData();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('Todas');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryAssets, setInventoryAssets] = useState<Asset[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedAssetsMap, setSelectedAssetsMap] = useState<Map<string, Asset>>(new Map());
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAsset, setCurrentAsset] = useState<Partial<Asset>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [showBundleManager, setShowBundleManager] = useState(false);

  const loadInventory = useCallback(async (page: number) => {
    setInventoryLoading(true);
    try {
      const res = await getAssetsPaginated(page, INVENTORY_PAGE_SIZE, {
        search: search || undefined,
        category: catFilter !== 'Todas' ? catFilter : undefined,
        status: statusFilter !== 'Todos' ? statusFilter : undefined,
        unbundledOnly: false,
      });
      setInventoryAssets(res.assets);
      setInventoryTotal(res.total);
      if (res.categories?.length) setCategories(res.categories);
    } catch (err) {
      console.error('loadInventory:', err);
      setInventoryAssets([]);
    } finally {
      setInventoryLoading(false);
    }
  }, [search, catFilter, statusFilter]);

  useEffect(() => { setInventoryPage(1); }, [search, catFilter, statusFilter]);
  useEffect(() => { loadInventory(inventoryPage); }, [loadInventory, inventoryPage]);

  const inventoryTotalPages = Math.ceil(inventoryTotal / INVENTORY_PAGE_SIZE) || 1;

  const toggleSelection = (asset: Asset) => {
    const n = new Set(selectedIds);
    const m = new Map(selectedAssetsMap);
    if (n.has(asset.id)) {
      n.delete(asset.id);
      m.delete(asset.id);
    } else {
      n.add(asset.id);
      m.set(asset.id, asset);
    }
    setSelectedIds(n);
    setSelectedAssetsMap(m);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { const r = new FileReader(); r.onload = ev => importAssets(ev.target?.result as string); r.readAsText(f); }
  };

  const handleSave = async () => {
    if (isEditing && currentAsset.id) await updateAsset(currentAsset.id, currentAsset);
    else await addAsset(currentAsset);
    setShowModal(false);
  };

  const statusColors: Record<string, string> = {
    'Disponible': 'text-emerald-400 bg-emerald-500/10',
    'Prestada': 'text-cyan-400 bg-cyan-500/10',
    'En mantenimiento': 'text-amber-400 bg-amber-500/10',
    'Requiere Mantenimiento': 'text-orange-400 bg-orange-500/10',
    'Dada de baja': 'text-slate-500 bg-slate-700/50',
  };

  return (
    <div className="animate-in fade-in">
      {showBundleManager && <BundleManagerPanel onClose={() => setShowBundleManager(false)} />}

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 shadow-lg gap-4">
          <div>
            <h3 className="text-white font-bold text-lg">Gestión de Inventario</h3>
            <p className="text-slate-500 text-xs mt-1">Da de alta equipos nuevos o importa de forma masiva</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleFileUpload} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none border-primary/20 text-primary hover:bg-primary/10">
              <Upload size={16} className="mr-2" /> Importar CSV
            </Button>
            <Button
              variant="neon"
              onClick={async () => {
                setIsEditing(false);
                const tag = await getNextTag();
                setCurrentAsset({ tag, status: 'Disponible', maintenance_period_days: 180, maintenance_usage_threshold: 10 });
                setShowModal(true);
              }}
              className="flex-1 sm:flex-none"
            >
              <Plus size={16} className="mr-2" /> Alta Activo
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
        {/* Fila 1: Búsqueda (full width) */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-3 text-slate-500 w-4 h-4" />
          <Input placeholder="Buscar activo por nombre o tag..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 bg-slate-900 border-slate-800 w-full" />
        </div>

        {/* Fila 2: Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[130px]">
            <CategoryFilter categories={categories} value={catFilter} onChange={setCatFilter} />
          </div>
          {/* Filtro por Estado */}
          <select
            className="flex-1 min-w-[130px] h-11 bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-xl px-3 focus:outline-none focus:border-primary hover:border-slate-600 transition-colors cursor-pointer"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="Todos">Estado: Todos</option>
            <option value="Disponible">Disponible</option>
            <option value="Prestada">Prestada</option>
            <option value="En mantenimiento">En mantenimiento</option>
            <option value="Requiere Mantenimiento">Requiere Mantenimiento</option>
            <option value="En trámite">En trámite</option>
            <option value="Dada de baja">Dada de baja</option>
            <option value="Fuera de servicio">Fuera de servicio</option>
          </select>
        </div>

        {/* Fila 3: Acciones */}
        <div className="flex items-center gap-2">
          <RefreshButton />
          <button
            onClick={() => setShowBundleManager(true)}
            className="flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-bold transition-all border bg-slate-900 text-slate-300 border-slate-700 hover:border-primary/60 hover:text-primary hover:bg-primary/5 active:scale-95"
          >
            <Package size={15} />
            <span>Combos</span>
          </button>
        </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 bg-primary text-black px-5 py-2.5 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.5)] flex items-center gap-4 font-bold text-sm">
          <span>{selectedIds.size} seleccionados</span>
          <Button size="sm" variant="secondary" onClick={() => setShowBundleModal(true)} className="h-8 text-xs bg-black text-primary hover:bg-slate-900 border-0">Crear</Button>
          <Button size="sm" variant="secondary" onClick={() => onPrintSelected(selectedIds, Array.from(selectedAssetsMap.values()))} className="h-8 text-xs bg-black text-primary hover:bg-slate-900 border-0">
            <Printer size={14} /> Imprimir QR
          </Button>
          <button onClick={() => { setSelectedIds(new Set()); setSelectedAssetsMap(new Map()); }} className="hover:text-rose-600"><X size={18} /></button>
        </div>
      )}

      {showBundleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-sm space-y-4 border-primary/30">
            <h3 className="text-white font-bold text-lg">Nuevo Combo</h3>
            <p className="text-xs text-slate-400">Agrupará los {selectedIds.size} activos seleccionados.</p>
            <Input placeholder="Nombre del Combo" value={bundleName} onChange={e => setBundleName(e.target.value)} />
            <Input placeholder="Descripción breve" value={bundleDesc} onChange={e => setBundleDesc(e.target.value)} />
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setShowBundleModal(false)} variant="ghost" className="flex-1">Cancelar</Button>
              <Button variant="neon" className="flex-1" disabled={!bundleName.trim()}
                onClick={async () => {
                  await createBundle(bundleName, bundleDesc, Array.from(selectedIds));
                  setShowBundleModal(false);
                  setSelectedIds(new Set());
                  setSelectedAssetsMap(new Map());
                  setBundleName('');
                  setBundleDesc('');
                  loadInventory(inventoryPage);
                }}>
                Guardar Combo
              </Button>
            </div>
          </Card>
        </div>
      )}

      {inventoryLoading ? (
        <div className="flex justify-center py-16">
          <DataLoadingScreen message="Cargando inventario..." />
        </div>
      ) : (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
            <tr>
              <th className="p-3 w-10"></th>
              <th className="p-3">Activo</th>
              <th className="p-3 hidden md:table-cell">Categoría</th>
              <th className="p-3 text-center">Estado</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {inventoryAssets.map(a => (
              <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3">
                  <button onClick={() => toggleSelection(a)}>
                    {selectedIds.has(a.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-slate-600" />}
                  </button>
                </td>
                <td className="p-3">
                  <span className="text-white font-medium">{a.name}</span>
                  <span className="text-slate-500 text-xs ml-2 font-mono">{a.tag}</span>
                  {a.maintenance_alert && <span className="ml-2 text-[10px] text-amber-400">Mant.</span>}
                </td>
                <td className="p-3 hidden md:table-cell text-xs">{a.category || '—'}</td>
                <td className="p-3 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${statusColors[a.status] || 'text-slate-400 bg-slate-700'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => onPrintSingle(a)} className="text-slate-400 hover:text-cyan-400 transition-colors" title="Imprimir / Guardar como PDF">
                      <QrCode size={14} />
                    </button>
                    <button onClick={() => { setIsEditing(true); setCurrentAsset(a); setShowModal(true); }} className="text-slate-400 hover:text-primary transition-colors">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => deleteAsset(a.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {inventoryAssets.length === 0 && (
          <div className="text-center py-12 text-slate-500">Sin activos con ese filtro.</div>
        )}
        {(inventoryTotal > 0 || inventoryAssets.length > 0) && (
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 p-4 border-t border-slate-800">
            <span className="text-xs text-slate-500">
              Mostrando {(inventoryPage - 1) * INVENTORY_PAGE_SIZE + 1}–{Math.min(inventoryPage * INVENTORY_PAGE_SIZE, inventoryTotal)} de {inventoryTotal} activos
            </span>
            {inventoryTotalPages > 1 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setInventoryPage(p => Math.max(1, p - 1))} disabled={inventoryPage <= 1}>Anterior</Button>
                <span className="flex items-center px-4 text-sm text-slate-400">Página {inventoryPage} de {inventoryTotalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setInventoryPage(p => Math.min(inventoryTotalPages, p + 1))} disabled={inventoryPage >= inventoryTotalPages}>Siguiente</Button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-white font-bold">{isEditing ? 'Editar' : 'Nuevo'} Activo</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Nombre *" value={currentAsset.name || ''} onChange={e => setCurrentAsset({ ...currentAsset, name: e.target.value })} />
              <Input placeholder="Tag (auto)" value={currentAsset.tag || ''} onChange={e => setCurrentAsset({ ...currentAsset, tag: e.target.value })} />
              <Input placeholder="Categoría" value={currentAsset.category || ''} onChange={e => setCurrentAsset({ ...currentAsset, category: e.target.value })} />
              <Input placeholder="Marca" value={currentAsset.brand || ''} onChange={e => setCurrentAsset({ ...currentAsset, brand: e.target.value })} />
              <Input placeholder="Modelo" value={currentAsset.model || ''} onChange={e => setCurrentAsset({ ...currentAsset, model: e.target.value })} />
              <Input placeholder="N° Serie" value={currentAsset.serial || ''} onChange={e => setCurrentAsset({ ...currentAsset, serial: e.target.value })} />
              <Input placeholder="Ubicación" value={currentAsset.location || ''} onChange={e => setCurrentAsset({ ...currentAsset, location: e.target.value })} />
              <Input type="number" placeholder="Valor Comercial" value={currentAsset.commercial_value || ''} onChange={e => setCurrentAsset({ ...currentAsset, commercial_value: Number(e.target.value) })} />
            </div>

            <select
              className="w-full h-10 bg-slate-950 border border-slate-700 text-white rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={currentAsset.status || 'Disponible'}
              onChange={e => setCurrentAsset({ ...currentAsset, status: e.target.value as AssetState })}
            >
              <option value="Disponible">Disponible</option>
              <option value="En Mantenimiento">En mantenimiento</option>
              <option value="Requiere Mantenimiento">Requiere Mantenimiento</option>
              <option value="Prestada">Prestada</option>
              <option value="Dada de baja">Dada de baja</option>
              <option value="Fuera de servicio">Fuera de servicio</option>
            </select>

            <div className="border border-amber-500/20 rounded-xl p-4 bg-amber-500/5 space-y-3">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Shield size={12} /> Reglas de Mantenimiento Preventivo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Cada N días</label>
                  <Input type="number" placeholder="180" value={currentAsset.maintenance_period_days || ''} onChange={e => setCurrentAsset({ ...currentAsset, maintenance_period_days: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Después de N préstamos</label>
                  <Input type="number" placeholder="10" value={currentAsset.maintenance_usage_threshold || ''} onChange={e => setCurrentAsset({ ...currentAsset, maintenance_usage_threshold: Number(e.target.value) })} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
