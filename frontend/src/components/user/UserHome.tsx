import { useState, useEffect, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { getAssetsPaginated } from '../../api/assets';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Input } from '../ui/core';
import { NotificationCenter } from '../ui/NotificationCenter';
import {
  Search, LogOut, Package, ChevronRight, X,
  CheckCircle, LayoutGrid, List, ShoppingCart, Minus, Building2, ShieldCheck, Phone
} from 'lucide-react';
import { ChatAssistant } from '../ui/ChatAssistant';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CategoryFilter } from '../ui/CategoryFilter';
import { DataLoadingScreen } from '../ui/DataLoadingScreen';
import { toast } from 'sonner';
import { RefreshButton } from '../ui/RefreshButton';
import type { Request, Asset } from '../../types';
import {
  AssetDetailModal,
  AssetCatalogTable,
  MyLoansView,
  QRModal,
  FeedbackModal,
  CATALOG_PAGE_SIZE,
} from './home';

/** Vista principal del usuario: catálogo, carrito, solicitudes y préstamos activos. */
export function UserHome({ isManagerView = false, onBack }: { isManagerView?: boolean; onBack?: () => void }) {
  const { bundles, createRequest, createBatchRequest, createMultipleRequests, institutions, fetchData, isLoading } = useData();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'activos' | 'combos'>('activos');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  const [catFilter, setCatFilter] = useState<string>('Todas');
  const [activeTab, setActiveTab] = useState<'catalog' | 'loans'>('catalog');

  const [catalogAssets, setCatalogAssets] = useState<Asset[]>([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<typeof bundles[0] | null>(null);
  const [cart, setCart] = useState<Asset[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutFromCart, setCheckoutFromCart] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [days, setDays] = useState(0);
  const [motive, setMotive] = useState('');
  const [isExternal, setIsExternal] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<number | undefined>();
  const [isInternal, setIsInternal] = useState(false);

  const [qrRequest, setQRRequest] = useState<Request | null>(null);
  const [feedbackRequest, setFeedbackRequest] = useState<Request | null>(null);

  const addToCart = (asset: Asset) => {
    let added = false;
    setCart(prev => {
      if (prev.some(a => a.id === asset.id)) return prev;
      added = true;
      return [...prev, asset];
    });
    return added;
  };
  const removeFromCart = (assetId: string) => setCart(prev => prev.filter(a => a.id !== assetId));

  const fetchCatalogAssets = useCallback(async (page: number) => {
    if (activeTab !== 'catalog' || view !== 'activos') return;
    setCatalogLoading(true);
    try {
      const res = await getAssetsPaginated(page, CATALOG_PAGE_SIZE, {
        search: search || undefined,
        category: catFilter !== 'Todas' ? catFilter : undefined,
        availableOnly: true,
      });
      setCatalogAssets(res.assets);
      setCatalogTotal(res.total);
      if (res.categories?.length) setCategories(res.categories);
    } catch (err) {
      console.error('fetchCatalogAssets:', err);
      setCatalogAssets([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [activeTab, view, search, catFilter]);

  useEffect(() => {
    setCatalogPage(1);
  }, [search, catFilter]);

  useEffect(() => {
    fetchCatalogAssets(catalogPage);
  }, [fetchCatalogAssets, catalogPage]);

  const catalogTotalPages = Math.ceil(catalogTotal / CATALOG_PAGE_SIZE) || 1;

  const handleSubmit = async () => {
    if (!user) return;
    if (checkoutFromCart && cart.length > 0) {
      await createMultipleRequests(cart, user, days, motive, isExternal ? selectedInstitution : undefined, isManagerView, isInternal);
      setCart([]);
      setCheckoutFromCart(false);
      setCartOpen(false);
    } else if (selectedAsset) {
      await createRequest(selectedAsset, user, days, motive, isExternal ? selectedInstitution : undefined, isManagerView, isInternal);
    } else if (selectedBundle) {
      await createBatchRequest(selectedBundle, user, days, motive, isManagerView, isExternal ? selectedInstitution : undefined, isInternal);
    }
    setSelectedAsset(null);
    setSelectedBundle(null);
    setMotive('');
    setDays(0);
    setIsExternal(false);
    setSelectedInstitution(undefined);
    setIsInternal(false);
    if (!isManagerView) setActiveTab('loans');
    if (isManagerView && onBack) onBack();
  };

  const handleTestCall = async () => {
    toast.loading('Solicitando llamada a Twilio...', { id: 'test-call' });
    try {
      const data = await apiFetch<{ ok: boolean }>('/api/notifications/test-call', {
        method: 'POST'
      });
      
      if (data.ok) {
        toast.success('¡Llamada en camino! Revisa tu teléfono.', { id: 'test-call' });
      } else {
        toast.error('Falló la integración con Twilio.', { id: 'test-call' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al conectar con el servidor', { id: 'test-call' });
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${isManagerView ? 'bg-transparent' : 'bg-background'} font-sans`}>
        <DataLoadingScreen message="Cargando catálogo..." />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isManagerView ? 'bg-transparent' : 'bg-background'} font-sans pb-24`}>
      {!isManagerView && <ChatAssistant />}
      {qrRequest && <QRModal request={qrRequest as Request & { is_bundle?: boolean; bundle_items?: number }} onClose={() => setQRRequest(null)} />}
      {feedbackRequest && <FeedbackModal request={feedbackRequest} onClose={() => setFeedbackRequest(null)} onRefresh={fetchData} />}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="relative w-full max-w-sm bg-background border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-white font-bold flex items-center gap-2">
                <ShoppingCart size={20} className="text-primary" />
                Carrito ({cart.length})
              </h3>
              <button onClick={() => setCartOpen(false)} className="p-2 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Package size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Tu carrito está vacío.</p>
                  <p className="text-xs mt-1">Añade activos desde el catálogo.</p>
                </div>
              ) : (
                cart.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{a.name}</p>
                      <p className="text-slate-500 text-xs font-mono">{a.tag}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(a.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Quitar"
                    >
                      <Minus size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-800">
                <Button variant="neon" className="w-full" onClick={() => { setCartOpen(false); setCheckoutFromCart(true); }}>
                  Completar solicitud ({cart.length} {cart.length === 1 ? 'activo' : 'activos'})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {previewAsset && (
        <AssetDetailModal
          asset={previewAsset}
          onClose={() => setPreviewAsset(null)}
          onRequest={(a) => setSelectedAsset(a)}
          onAddToCart={addToCart}
        />
      )}

      {!isManagerView && (
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-slate-800">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-lg font-bold text-white">Hola, <span className="text-primary">{user?.name?.split(' ')[0]}</span></h1>
              <p className="text-[11px] text-slate-500">{user?.disciplina}</p>
            </div>
            <div className="flex items-center gap-2">
              {((activeTab === 'catalog' && view === 'activos') || cart.length > 0) && (
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-primary transition-all"
                  title="Ver carrito"
                >
                  <ShoppingCart size={20} />
                  {cart.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary text-black text-[10px] font-bold rounded-full">
                      {cart.length}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={handleTestCall}
                className="p-2 rounded-lg hover:bg-slate-800/80 text-emerald-400 hover:text-emerald-300 transition-all border border-emerald-500/20 bg-emerald-500/10"
                title="Probar Llamada"
              >
                <Phone size={20} />
              </button>
              <RefreshButton />
              <NotificationCenter />
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={logout}><LogOut size={18} /></Button>
            </div>
          </div>
          <div className="flex border-t border-slate-800">
            <button onClick={() => setActiveTab('catalog')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'catalog' ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`}>Catálogo</button>
            <button onClick={() => setActiveTab('loans')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'loans' ? 'text-primary border-b-2 border-primary' : 'text-slate-500'}`}>Mis Préstamos</button>
          </div>
        </header>
      )}

      {isManagerView && (
        <header className="flex justify-between items-center mb-6 px-4 pt-5 pb-2">
          <div>
            <h1 className="text-xl font-bold text-white">Auto-Solicitud Líder</h1>
            <p className="text-emerald-400 text-xs font-bold mt-0.5">Aprobación directa</p>
          </div>
          <div className="flex items-center gap-2">
            {((activeTab === 'catalog' && view === 'activos') || cart.length > 0) && (
              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-primary transition-all border border-slate-700"
                title="Ver carrito"
              >
                <ShoppingCart size={20} />
                {cart.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary text-black text-[10px] font-bold rounded-full">
                    {cart.length}
                  </span>
                )}
              </button>
            )}
            <RefreshButton />
            <Button variant="outline" onClick={onBack}>Cancelar</Button>
          </div>
        </header>
      )}

      <main className="p-4">
        {activeTab === 'catalog' ? (
          <>
            <div className="flex flex-col gap-4 mb-6 mt-2 max-w-4xl mx-auto">
              <div className="flex bg-slate-900 rounded-xl p-1.5 border border-slate-800 shadow-inner w-full sm:max-w-md mx-auto">
                <button
                  onClick={() => setView('activos')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${view === 'activos' ? 'bg-primary text-black shadow-md scale-105' : 'text-slate-400 hover:text-white'}`}
                >
                  Activos Sueltos
                </button>
                <button
                  onClick={() => setView('combos')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${view === 'combos' ? 'bg-primary text-black shadow-md scale-105' : 'text-slate-400 hover:text-white'}`}
                >
                  Kits
                </button>
              </div>

              {view === 'activos' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
                    <Input
                      placeholder="¿Qué activo necesitas hoy?"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-12 h-12 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.1)] focus:shadow-[0_0_30px_rgba(6,182,212,0.25)] text-base"
                    />
                  </div>
                  <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 flex-shrink-0">
                    <button
                      onClick={() => setDisplayMode('grid')}
                      className={`p-2 rounded-lg transition-all ${displayMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-slate-500 hover:text-white'}`}
                      title="Vista en cuadrícula"
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      onClick={() => setDisplayMode('list')}
                      className={`p-2 rounded-lg transition-all ${displayMode === 'list' ? 'bg-primary/20 text-primary' : 'text-slate-500 hover:text-white'}`}
                      title="Vista en lista"
                    >
                      <List size={16} />
                    </button>
                  </div>
                  <CategoryFilter categories={categories} value={catFilter} onChange={setCatFilter} />
                </div>
              )}
            </div>

            {view === 'activos' ? (
              displayMode === 'grid' ? (
                <>
                  {catalogLoading ? (
                    <div className="flex justify-center py-16">
                      <DataLoadingScreen message="Cargando activos..." />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {catalogAssets.map(asset => (
                        <Card key={asset.id} className="group hover:-translate-y-1 transition-all duration-300 cursor-pointer" onClick={() => setPreviewAsset(asset)}>
                          <div className="aspect-video bg-slate-800 rounded-lg mb-3 overflow-hidden relative">
                            <img
                              src={asset.image || `https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=500`}
                              className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                              alt={asset.name}
                            />
                            <span className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-white keep-white border border-white/10">{asset.tag}</span>
                            {asset.category && <span className="absolute bottom-2 left-2 bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/20">{asset.category}</span>}
                          </div>
                          <h3 className="text-white font-bold text-sm mb-1 truncate">{asset.name}</h3>
                          <p className="text-secondary text-xs mb-3 truncate">{asset.description || asset.location || 'Sin descripción'}</p>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-800 gap-2">
                            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1"><CheckCircle size={10} /> Disponible</span>
                            <div className="flex gap-1">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const added = addToCart(asset);
                                  if (added) toast.success(`${asset.name} añadido al carrito`);
                                  else toast.warning('Este activo ya está en el carrito');
                                }}
                                className="p-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-primary hover:border-primary/50 transition-all"
                                title="Añadir al carrito"
                              >
                                <ShoppingCart size={14} />
                              </button>
                              <Button size="sm" variant="neon" className="text-[11px] h-7" onClick={e => { e.stopPropagation(); setSelectedAsset(asset); }}>
                                Solicitar <ChevronRight size={12} />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {catalogAssets.length === 0 && (
                        <div className="col-span-full text-center py-16 text-slate-500">
                          <Package size={40} className="mx-auto mb-3 opacity-30" />
                          <p>No hay activos disponibles con ese filtro.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {!catalogLoading && catalogTotal > 0 && (
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mt-6 pt-4 border-t border-slate-800">
                      <span className="text-xs text-slate-500">
                        Mostrando {(catalogPage - 1) * CATALOG_PAGE_SIZE + 1}–{Math.min(catalogPage * CATALOG_PAGE_SIZE, catalogTotal)} de {catalogTotal} activos
                      </span>
                      {catalogTotalPages > 1 && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setCatalogPage(p => Math.max(1, p - 1))} disabled={catalogPage <= 1}>Anterior</Button>
                          <span className="flex items-center px-4 text-sm text-slate-400">Página {catalogPage} de {catalogTotalPages}</span>
                          <Button variant="outline" size="sm" onClick={() => setCatalogPage(p => Math.min(catalogTotalPages, p + 1))} disabled={catalogPage >= catalogTotalPages}>Siguiente</Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {catalogLoading ? (
                    <div className="flex justify-center py-16">
                      <DataLoadingScreen message="Cargando activos..." />
                    </div>
                  ) : (
                    <AssetCatalogTable
                      assets={catalogAssets}
                      onSelect={(a) => setPreviewAsset(a)}
                      onAddToCart={(a) => {
                        const added = addToCart(a);
                        if (added) toast.success(`${a.name} añadido al carrito`);
                        else toast.warning('Este activo ya está en el carrito');
                      }}
                    />
                  )}
                  {!catalogLoading && catalogTotal > 0 && (
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mt-6 pt-4 border-t border-slate-800">
                      <span className="text-xs text-slate-500">
                        Mostrando {(catalogPage - 1) * CATALOG_PAGE_SIZE + 1}–{Math.min(catalogPage * CATALOG_PAGE_SIZE, catalogTotal)} de {catalogTotal} activos
                      </span>
                      {catalogTotalPages > 1 && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setCatalogPage(p => Math.max(1, p - 1))} disabled={catalogPage <= 1}>Anterior</Button>
                          <span className="flex items-center px-4 text-sm text-slate-400">Página {catalogPage} de {catalogTotalPages}</span>
                          <Button variant="outline" size="sm" onClick={() => setCatalogPage(p => Math.min(catalogTotalPages, p + 1))} disabled={catalogPage >= catalogTotalPages}>Siguiente</Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {bundles.map(bundle => (
                  <Card key={bundle.id} className="border-primary/20 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => setSelectedBundle(bundle)}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary group-hover:scale-110 transition-transform">
                        <Package size={24} />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg">{bundle.name}</h3>
                        <p className="text-slate-400 text-xs">{(bundle.assets || []).length} equipos incluidos</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {bundle.assets?.slice(0, 3).map(a => (
                        <span key={a.id} className="bg-slate-800 text-slate-300 text-[10px] px-2 py-1 rounded">{a.name}</span>
                      ))}
                      {(bundle.assets?.length || 0) > 3 && (
                        <span className="text-[10px] text-slate-500 flex items-center">+{bundle.assets!.length - 3} más</span>
                      )}
                    </div>
                    <Button size="sm" variant="neon" className="w-full text-xs h-9 font-bold tracking-wider">
                      Solicitar Kit Completo
                    </Button>
                  </Card>
                ))}
                {bundles.length === 0 && (
                  <div className="col-span-full text-center py-16 text-slate-500">
                    <Package size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No hay kits configurados en el sistema.</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <MyLoansView onShowQR={(req) => setQRRequest(req)} onFeedback={(req) => setFeedbackRequest(req)} />
        )}
      </main>

      {(selectedAsset || selectedBundle || (checkoutFromCart && cart.length > 0)) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md space-y-6 border-primary/30 shadow-[0_0_50px_rgba(6,182,212,0.15)]">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white">Configura tu solicitud</h2>
                <p className="text-primary text-sm mt-0.5">
                  {checkoutFromCart && cart.length > 0
                    ? `${cart.length} activos en el carrito`
                    : selectedAsset ? selectedAsset.name : `Kit: ${selectedBundle?.name}`}
                </p>
                {checkoutFromCart && cart.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cart.map(a => (
                      <span key={a.id} className="text-[10px] px-2 py-0.5 bg-slate-800 rounded text-slate-400">{a.name}</span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => { setSelectedAsset(null); setSelectedBundle(null); setCheckoutFromCart(false); }} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-bold text-white uppercase tracking-wider">Retorno</label>
                <div className="bg-primary text-black px-4 py-2 rounded-xl font-black text-xl shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                  {days === 0 ? 'Mismo Día' : `${days} días`}
                </div>
              </div>
              <div className="relative">
                <input
                  type="range" min="0" max="30" value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className="w-full h-3 bg-slate-800 rounded-full appearance-none cursor-pointer accent-primary"
                  style={{ background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${(days / 30) * 100}%, rgb(30 41 59) ${(days / 30) * 100}%, rgb(30 41 59) 100%)` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-3 font-mono">
                <span className={days === 0 ? 'text-primary font-bold' : ''}>Hoy (9pm)</span>
                <span className={days === 7 ? 'text-primary font-bold' : ''}>1 sem</span>
                <span className={days === 15 ? 'text-primary font-bold' : ''}>15 días</span>
                <span className={days === 30 ? 'text-primary font-bold' : ''}>30 días</span>
              </div>
            </div>

            <Input placeholder="Motivo del préstamo (opcional)" value={motive} onChange={e => setMotive(e.target.value)} />

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isExternal}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsExternal(checked);
                    if (checked) {
                      setIsInternal(false);
                    }
                  }}
                  className="w-5 h-5 rounded border-2 border-slate-700 bg-slate-900 checked:bg-primary checked:border-primary cursor-pointer transition-all"
                />
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-slate-500 group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Es para una institución externa</span>
                </div>
              </label>
              {isExternal && (
                <div className="pl-8 animate-in slide-in-from-top-2">
                  <select
                    value={selectedInstitution}
                    onChange={e => setSelectedInstitution(Number(e.target.value))}
                    className="w-full h-11 bg-slate-950 border border-primary/30 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Selecciona institución...</option>
                    {institutions.map(inst => (<option key={inst.id} value={inst.id}>{inst.name}</option>))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsInternal(checked);
                    if (checked) {
                      setIsExternal(false);
                      setSelectedInstitution(undefined);
                    }
                  }}
                  className="w-5 h-5 rounded border-2 border-slate-700 bg-slate-900 checked:bg-primary checked:border-primary cursor-pointer transition-all"
                />
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-slate-500 group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Préstamo Interno (Uso exclusivo en sucursal)</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button variant="ghost" onClick={() => { setSelectedAsset(null); setSelectedBundle(null); setCheckoutFromCart(false); }}>Cancelar</Button>
              <Button variant="neon" onClick={handleSubmit}>
                {(checkoutFromCart && cart.length > 0) ? (isManagerView ? `Auto-Aprobar ${cart.length} activos` : 'Enviar 1 solicitud') : (isManagerView ? 'Auto-Aprobar' : 'Enviar Solicitud')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
