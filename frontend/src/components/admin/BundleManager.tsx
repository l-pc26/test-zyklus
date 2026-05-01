import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { getAssetsPaginated } from '../../api/assets';
import { Package, Check, Save, ChevronLeft, ChevronRight, Edit2, List, Plus, X } from 'lucide-react';
import { Button, Input } from '../ui/core';
import { toast } from 'sonner';
import type { Asset, Bundle } from '../../types';

const PAGE_SIZE = 24;

type Tab = 'list' | 'create';

/** Gestión de combos (kits): crear, editar y asignar activos a bundles. */
export const BundleManager = () => {
  const { bundles, createBundle, updateBundle, fetchData } = useData();
  const [tab, setTab] = useState<Tab>('list');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAssets, setEditAssets] = useState<Asset[]>([]);
  const [removedAssets, setRemovedAssets] = useState<Asset[]>([]);
  const [unbundledForEdit, setUnbundledForEdit] = useState<Asset[]>([]);
  const [loadingUnbundled, setLoadingUnbundled] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadAssets = useCallback(async (p: number) => {
    setLoadingAssets(true);
    try {
      const res = await getAssetsPaginated(p, PAGE_SIZE, { unbundledOnly: true });
      setAssets(res.assets);
      setTotal(res.total);
    } catch (err) {
      console.error('BundleManager loadAssets:', err);
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  const loadUnbundledForEdit = useCallback(async () => {
    setLoadingUnbundled(true);
    try {
      const res = await getAssetsPaginated(1, 100, { unbundledOnly: true });
      setUnbundledForEdit(res.assets);
    } catch (err) {
      setUnbundledForEdit([]);
    } finally {
      setLoadingUnbundled(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'create') loadAssets(page);
  }, [tab, loadAssets, page]);

  useEffect(() => {
    if (editingBundle) loadUnbundledForEdit();
  }, [editingBundle, loadUnbundledForEdit]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const handleCreate = async () => {
    if (!bundleName.trim() || selectedIds.length === 0) {
      toast.error('Nombre y al menos un activo son obligatorios');
      return;
    }
    setLoading(true);
    try {
      await createBundle(bundleName.trim(), bundleDesc.trim(), selectedIds);
      setBundleName('');
      setBundleDesc('');
      setSelectedIds([]);
      setTab('list');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error creando combo');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (b: Bundle) => {
    setEditingBundle(b);
    setEditName(b.name);
    setEditDesc(b.description ?? '');
    setEditAssets(b.assets ?? []);
    setRemovedAssets([]);
  };

  const cancelEdit = () => {
    setEditingBundle(null);
    setEditAssets([]);
    setRemovedAssets([]);
  };

  const removeAssetFromEdit = (a: Asset) => {
    setEditAssets(prev => prev.filter(x => x.id !== a.id));
    setRemovedAssets(prev => [...prev, a]);
  };

  const addAssetToEdit = (a: Asset) => {
    setEditAssets(prev => [...prev, a]);
    setRemovedAssets(prev => prev.filter(x => x.id !== a.id));
  };

  const addableAssets = [
    ...removedAssets,
    ...unbundledForEdit.filter(a => !editAssets.some(e => e.id === a.id)),
  ];

  const handleSaveEdit = async () => {
    if (!editingBundle) return;
    if (!editName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    setSavingEdit(true);
    try {
      await updateBundle(editingBundle.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        assetIds: editAssets.map(a => a.id),
      });
      cancelEdit();
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-700 pb-3">
        <button
          type="button"
          onClick={() => setTab('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'list' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:text-white border border-transparent'}`}
        >
          <List size={16} /> Ver combos
        </button>
        <button
          type="button"
          onClick={() => setTab('create')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'create' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:text-white border border-transparent'}`}
        >
          <Package size={16} /> Crear combo
        </button>
      </div>

      {tab === 'list' && (
        <div className="space-y-4">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <List size={16} className="text-primary" /> Combos existentes ({bundles.length})
          </h3>
          {bundles.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">No hay combos. Crea uno en la pestaña &quot;Crear combo&quot;.</p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {bundles.map(b => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-700 bg-slate-900/50 hover:border-slate-600 transition-colors"
                >
                  {editingBundle?.id === b.id ? (
                    <div className="flex-1 flex flex-col gap-3 w-full min-w-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="bg-slate-950 border-slate-700 text-white text-sm h-9"
                          placeholder="Nombre del combo"
                        />
                        <Input
                          value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          className="bg-slate-950 border-slate-700 text-white text-xs h-8"
                          placeholder="Descripción (opcional)"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-700 rounded-xl p-2 bg-slate-900/30">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Activos en el combo ({editAssets.length})</p>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {editAssets.length === 0 ? (
                              <p className="text-slate-500 text-xs py-2">Sin activos. Añade desde la lista de la derecha.</p>
                            ) : (
                              editAssets.map(a => (
                                <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-slate-800/50 group">
                                  <span className="text-sm text-white truncate">{a.name}</span>
                                  <button
                                    onClick={() => removeAssetFromEdit(a)}
                                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex-shrink-0"
                                    title="Quitar del combo"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="border border-slate-700 rounded-xl p-2 bg-slate-900/30">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Añadir activos</p>
                          {loadingUnbundled ? (
                            <p className="text-slate-500 text-xs py-2">Cargando…</p>
                          ) : addableAssets.length === 0 ? (
                            <p className="text-slate-500 text-xs py-2">No hay activos disponibles para añadir.</p>
                          ) : (
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {addableAssets.map(a => (
                                <div
                                  key={a.id}
                                  onClick={() => addAssetToEdit(a)}
                                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-slate-800/50 hover:bg-primary/20 cursor-pointer group"
                                >
                                  <span className="text-sm text-white truncate">{a.name}</span>
                                  <Plus size={14} className="text-primary flex-shrink-0" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit} className="bg-primary text-black text-xs">
                          {savingEdit ? 'Guardando…' : 'Guardar'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit} className="text-xs">
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{b.name}</p>
                        <p className="text-slate-500 text-xs">{(b.assets ?? []).length} activos</p>
                        {b.description && <p className="text-slate-500 text-xs truncate mt-0.5">{b.description}</p>}
                      </div>
                      <button
                        onClick={() => startEdit(b)}
                        className="p-2 rounded-lg border border-slate-600 text-slate-400 hover:text-primary hover:border-primary/50 transition-colors"
                        title="Editar nombre y descripción"
                      >
                        <Edit2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'create' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-400 uppercase">Nombre del combo</label>
            <Input
              value={bundleName}
              onChange={e => setBundleName(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white"
              placeholder="Ej: Combo de Grabación"
            />
            <label className="block text-xs font-bold text-slate-400 uppercase">Descripción (opcional)</label>
            <Input
              value={bundleDesc}
              onChange={e => setBundleDesc(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white"
              placeholder="Breve descripción"
            />
            <Button
              onClick={handleCreate}
              disabled={loading || !bundleName.trim() || selectedIds.length === 0}
              className="w-full bg-primary text-black font-bold flex items-center justify-center gap-2"
            >
              <Save size={16} /> {loading ? 'Creando…' : 'Crear combo'}
            </Button>
          </div>
          <div className="border border-slate-700 rounded-xl overflow-hidden flex flex-col bg-slate-900/30">
            <p className="text-xs text-slate-500 p-2 border-b border-slate-700">Selecciona activos sin combo</p>
            <div className="flex-1 overflow-y-auto min-h-[180px] p-2">
              {loadingAssets ? (
                <p className="text-sm text-slate-500 py-4">Cargando activos…</p>
              ) : (
                assets.map(a => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedIds(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])}
                    className={`p-2 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${selectedIds.includes(a.id) ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:bg-slate-800/50 border border-transparent'}`}
                  >
                    <span className="text-sm truncate">{a.name}</span>
                    {selectedIds.includes(a.id) && <Check size={16} />}
                  </div>
                ))
              )}
            </div>
            {total > 0 && (
              <div className="flex items-center justify-between p-2 border-t border-slate-700 text-xs text-slate-500 gap-2">
                <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}</span>
                {totalPages > 1 && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-1">Pág. {page}/{totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
