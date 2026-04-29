import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useDebounce } from '../../hooks/useDebounce';
import type { Asset } from '../../types';
import { Card, Button } from '../ui/core';
import {
  LogOut, Database, Search, LayoutGrid, Building2, ScanLine, Wrench,
  ShieldCheck, BrainCircuit, Loader2, Flame, FileDown
} from 'lucide-react';
import { ChatAssistant } from '../ui/ChatAssistant';
import { InstitutionsManager } from './InstitutionsManager';
import { NotificationCenter } from '../ui/NotificationCenter';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AssetQRPrint } from './AssetQRPrint';
import { DataLoadingScreen } from '../ui/DataLoadingScreen';
import { DashboardCharts } from '../auditor';
import { AssetStatusCard } from '../auditor/overview/AssetStatusCard';
import { Scanner } from '@yudiel/react-qr-scanner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { RefreshButton } from '../ui/RefreshButton';
import { generatePredictiveReport as generateReport } from '../../lib/geminiUtils';
import { generateResponsibilityVoucher } from '../../lib/exportUtils';
import {
  AdminKPICard,
  AdminOverdueList,
  AssetInfoModal,
  MaintenancePanel,
  InventoryView,
  UsersView,
  actionBadge,
} from './dashboard';

/** Panel principal de administración: inventario, analíticas, mantenimiento, usuarios y externos. */
export function AdminDashboard() {
  const { user, logout } = useAuth();
  const { processQRScan, requests, auditLogs, stats, isLoading } = useData();
  const [currentView, setCurrentView] = useState<'inventory' | 'analytics' | 'external' | 'maintenance' | 'users'>('inventory');

  const [scannedInfo, setScannedInfo] = useState<{ asset?: Asset; request?: { requester_name: string; status: string; expected_return_date?: string } } | null>(null);
  const [useCamera, setUseCamera] = useState(false);
  const [showQRPrint, setShowQRPrint] = useState(false);
  const [qrPrintAssets, setQrPrintAssets] = useState<Asset[]>([]);

  const maintenanceCount = stats?.assetCounts?.mantenimiento ?? 0;

  const [searchLog, setSearchLog] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const debouncedSearchLog = useDebounce(searchLog);
  const debouncedFilterAction = useDebounce(filterAction);
  const [visibleLogsCount, setVisibleLogsCount] = useState(20);
  const [aiReport, setAiReport] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const kpis = useMemo(() => {
    const total = stats?.assetCounts?.total ?? 0;
    const disponible = stats?.assetCounts?.disponible ?? 0;
    const mantenimiento = stats?.assetCounts?.mantenimiento ?? 0;
    const disponibilidad = total > 0 ? Math.round((disponible / total) * 100) : 0;
    const overdueLoans = stats?.requestCounts?.overdue ?? requests.filter(r => r.status === 'OVERDUE').length;
    return { total, disponible, mantenimiento, disponibilidad, overdueLoans };
  }, [stats, requests]);

  const filteredLogs = useMemo(() =>
    auditLogs.filter(l =>
      l.action !== 'CREATE' &&
      (debouncedFilterAction === 'ALL' || l.action === debouncedFilterAction) &&
      (debouncedSearchLog === '' || l.details?.toLowerCase().includes(debouncedSearchLog.toLowerCase()) || l.actor_name?.toLowerCase().includes(debouncedSearchLog.toLowerCase()))
    ), [auditLogs, debouncedFilterAction, debouncedSearchLog]
  );

  const generatePredictiveReport = async () => {
    setIsGenerating(true);
    try {
      const assetNames = requests.filter(r => r.assets?.name).map(r => r.assets!.name as string);
      const report = await generateReport(assetNames, 'administrador');
      setAiReport(report);
      toast.success('Reporte generado exitosamente');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error(`Error Zykla AI: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCameraScan = async (detectedCodes: { rawValue?: string }[]) => {
    const code = detectedCodes?.[0]?.rawValue;
    if (!code) return;
    setUseCamera(false);
    const result = await processQRScan(code);
    if (result) setScannedInfo(result as { asset?: Asset; request?: { requester_name: string; status: string; expected_return_date?: string } });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background font-sans">
        <DataLoadingScreen message="Cargando panel de administración..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans pb-24 relative">
      <ChatAssistant />

      {scannedInfo && (
        <AssetInfoModal
          asset={scannedInfo.asset}
          relatedRequest={scannedInfo.request}
          onClose={() => setScannedInfo(null)}
        />
      )}

      {useCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md border-primary/30">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <ScanLine size={18} className="text-primary" /> Escanear QR del Activo
              </h3>
              <button onClick={() => setUseCamera(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
              <Scanner
                onScan={handleCameraScan}
                constraints={{ facingMode: 'environment' }}
                styles={{ container: { width: '100%', height: '100%' } }}
              />
            </div>
            <p className="text-xs text-slate-500 text-center mt-4">Centra el QR en la pantalla.</p>
          </Card>
        </div>
      )}

      {showQRPrint && (
        <AssetQRPrint assets={qrPrintAssets} onClose={() => setShowQRPrint(false)} />
      )}

      <header className="sticky top-0 z-30 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-background/80 backdrop-blur">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Database className="text-primary" size={20} /> Panel de Administración
          </h1>
          <p className="text-slate-500 text-xs mt-0.5 hidden sm:block">Gestión total del inventario y solicitudes</p>
        </div>
        <div className="hidden md:flex bg-slate-800 p-1 rounded-lg border border-slate-700 gap-1 nav-tabs">
            {[
              { id: 'inventory', icon: <LayoutGrid size={13} />, label: 'Inventario' },
              { id: 'analytics', icon: <PieChart size={13} />, label: 'Analíticas' },
              { id: 'external', icon: <Building2 size={13} />, label: 'Externos' },
              { id: 'maintenance', icon: <Wrench size={13} />, label: `Mant. ${maintenanceCount > 0 ? `(${maintenanceCount})` : ''}` },
              ...(user?.role === 'ADMIN_PATRIMONIAL' ? [{ id: 'users', icon: <UserIcon size={13} />, label: 'Usuarios' }] : []),
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id as typeof currentView)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${currentView === tab.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        <div className="flex flex-wrap justify-end items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setUseCamera(true)} className="border-primary/30 text-primary hover:bg-primary/10 text-xs shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <ScanLine size={14} className="mr-1" /> Escanear
          </Button>
          <RefreshButton />
          <NotificationCenter />
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={logout}><LogOut size={18} /></Button>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {currentView === 'inventory' && (
          <InventoryView
            onPrintSelected={(_ids: Set<string>, assetsToPrint: Asset[]) => {
              if (assetsToPrint.length === 0) {
                toast.warning('No hay activos para imprimir');
                return;
              }
              setQrPrintAssets(assetsToPrint);
              setShowQRPrint(true);
            }}
            onPrintSingle={(a: Asset) => { setQrPrintAssets([a]); setShowQRPrint(true); }}
          />
        )}
        {currentView === 'analytics' && (
          <div className="animate-in fade-in space-y-8 max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <AdminKPICard label="Total Activos" value={kpis.total} color="border-l-primary" icon={<Package />} sublabel={`${kpis.disponibilidad}% disponibles`} />
              <AdminKPICard label="Disponibilidad" value={`${kpis.disponibilidad}%`} color="border-l-emerald-500" icon={<CheckCircle2 />} sublabel={`${kpis.disponible} disponibles`} />
              <AdminKPICard label="Vencidos" value={kpis.overdueLoans} color="border-l-rose-500" icon={<AlertCircle />} sublabel="Requieren atención" />
              <AdminKPICard label="Mantenimiento" value={kpis.mantenimiento} color="border-l-amber-500" icon={<Wrench />} sublabel="Fuera de servicio" />
            </div>

            <Card className="border-purple-500/30 bg-gradient-to-br from-slate-900 to-purple-900/10 shadow-[0_0_25px_rgba(147,51,234,0.1)]">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <BrainCircuit className="text-purple-400" /> Reporte de Tendencias Predictivas (Zykla AI)
                </h3>
                <Button onClick={generatePredictiveReport} disabled={isGenerating} className="bg-purple-600 hover:bg-purple-500 text-white border-0 shadow-lg whitespace-nowrap">
                  {isGenerating ? <><Loader2 size={16} className="animate-spin mr-2"/> Generando Analítica...</> : 'Generar Reporte Zykla'}
                </Button>
              </div>
              {aiReport ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/20">
                  <p className="text-sm text-slate-300 leading-relaxed border-l-2 border-purple-500 pl-4">{aiReport}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Haz clic en el botón para que Zykla analice el historial de la base de datos y sugiera adquisiciones y tendencias.</p>
              )}
            </Card>

            <DashboardCharts />

            <AssetStatusCard />

            {/* Préstamos Vencidos - mejorado */}
            <div>
              <h3 className="text-white font-bold flex items-center gap-2 mb-4">
                <Flame className="text-rose-400" size={18} />
                Préstamos Vencidos
                {kpis.overdueLoans > 0 && (
                  <span className="ml-1 text-[11px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full">
                    {kpis.overdueLoans}
                  </span>
                )}
                <span className="text-slate-500 text-xs font-normal ml-1">— Ordenados por mayor tiempo sin devolver</span>
              </h3>
              <AdminOverdueList requests={requests} />
            </div>

            {/* Artículos Actualmente Prestados - corregido */}
            <div>
              <h3 className="text-white font-bold flex items-center gap-2 mb-4">
                <Package className="text-emerald-400" size={18} /> Artículos Actualmente Prestados
                <span className="ml-1.5 text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  {requests.filter(r => ['ACTIVE', 'ACTIVE_INTERNAL'].includes(r.status)).length}
                </span>
                <span className="text-slate-500 text-xs font-normal ml-1">— Activos + Internos (sin vencidos)</span>
              </h3>
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-400 min-w-[600px]">
                  <thead className="bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="p-3">Activo</th>
                      <th className="p-3">Solicitante</th>
                      <th className="p-3">Disciplina</th>
                      <th className="p-3">Retorno Esp.</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {requests.filter(r => ['ACTIVE', 'ACTIVE_INTERNAL'].includes(r.status)).map(r => (
                      <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-medium text-white">
                          {r.assets?.name ?? `Activo #${r.asset_id}`}
                          {r.assets?.tag && <span className="text-slate-500 text-[10px] font-mono ml-1.5">{r.assets.tag}</span>}
                        </td>
                        <td className="p-3">{r.requester_name}</td>
                        <td className="p-3 text-slate-500 text-[10px]">{r.requester_disciplina ?? '—'}</td>
                        <td className="p-3 font-mono">{r.expected_return_date ? format(new Date(r.expected_return_date), 'dd/MM/yy') : '—'}</td>
                        <td className="p-3">
                          {r.status === 'ACTIVE_INTERNAL'
                            ? <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-bold">INTERNO</span>
                            : <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-bold">ACTIVO</span>
                          }
                        </td>
                      </tr>
                    ))}
                    {requests.filter(r => ['ACTIVE', 'ACTIVE_INTERNAL'].includes(r.status)).length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-600">No hay activos prestados actualmente.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 mt-8">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <ShieldCheck className="text-primary" size={18} /> Trazabilidad Total (Audit Log)
                </h3>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-auto">
                    <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      value={searchLog}
                      onChange={e => setSearchLog(e.target.value)}
                      placeholder="Buscar..."
                      className="h-9 w-full md:w-44 pl-7 pr-3 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <select
                    value={filterAction}
                    onChange={e => setFilterAction(e.target.value)}
                    className="h-9 px-3 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ALL">Todo el Historial</option>
                    <option value="APPROVE">Aprobados</option>
                    <option value="REJECT">Rechazados</option>
                    <option value="CHECKOUT">Prestados (Salidas)</option>
                    <option value="CHECKIN">Devueltos (Entradas)</option>
                    <option value="MAINTENANCE">Mantenimientos</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto w-full">
                <table className="w-full text-left text-xs text-slate-400 min-w-[600px]">
                  <thead className="bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="p-3 w-32">Timestamp</th>
                      <th className="p-3 w-28">Estado / Acción</th>
                      <th className="p-3 w-32">Usuario</th>
                      <th className="p-3">Detalle</th>
                      <th className="p-3 w-24 text-center">Contrato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredLogs.slice(0, visibleLogsCount).map(log => {
                      const badge = actionBadge[log.action] ?? { label: log.action, style: 'text-slate-400 bg-slate-700' };
                      const relatedReq = log.target_type === 'REQUEST' ? requests.find(r => r.id.toString() === log.target_id) : null;
                      return (
                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 font-mono text-[10px] text-slate-500 whitespace-nowrap align-top">
                            {format(new Date(log.timestamp), 'dd/MM/yy HH:mm', { locale: es })}
                          </td>
                          <td className="p-3 align-top">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${badge.style}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300 align-top">{log.actor_name ?? log.actor_id}</td>
                          <td className="p-3 text-slate-400 min-w-[200px] whitespace-normal leading-relaxed break-words align-top">
                            {log.details ?? '—'}
                          </td>
                          <td className="p-3 align-top text-center">
                            {relatedReq?.digital_signature ? (
                              <button
                                onClick={() => generateResponsibilityVoucher(relatedReq)}
                                className="text-[10px] font-bold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-black border border-cyan-500/20 px-2 py-1 rounded transition-colors flex items-center justify-center gap-1 mx-auto"
                                title="Imprimir Contrato PDF"
                              >
                                <FileDown size={12} />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredLogs.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-600">No hay registros con ese filtro</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center mt-3 gap-3">
                <p className="text-[10px] text-slate-600 text-center sm:text-left">
                  Mostrando {Math.min(filteredLogs.length, visibleLogsCount)} de {filteredLogs.length} registros. Log inmutable.
                </p>
                {visibleLogsCount < filteredLogs.length && (
                  <Button
                    onClick={() => setVisibleLogsCount(v => v + 50)}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 w-full sm:w-auto"
                  >
                    Cargar más registros
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        {currentView === 'external' && <InstitutionsManager />}
        {currentView === 'maintenance' && (
          <MaintenancePanel
            onPrintAll={(assetsToPrint) => {
              if (assetsToPrint.length === 0) {
                toast.warning('No hay activos para imprimir');
                return;
              }
              setQrPrintAssets(assetsToPrint);
              setShowQRPrint(true);
            }}
          />
        )}
        {currentView === 'users' && user?.role === 'ADMIN_PATRIMONIAL' && <UsersView />}
      </main>

      <div className={`md:hidden fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 p-2 z-50 ${user?.role === 'ADMIN_PATRIMONIAL' ? 'grid grid-cols-5' : 'grid grid-cols-4'}`}>
        {[
          { id: 'inventory', icon: <LayoutGrid size={20} />, label: 'Inventario' },
          { id: 'analytics', icon: <PieChart size={20} />, label: 'Analíticas' },
          { id: 'external', icon: <Building2 size={20} />, label: 'Externos' },
          { id: 'maintenance', icon: <Wrench size={20} />, label: 'Mant.' },
          ...(user?.role === 'ADMIN_PATRIMONIAL' ? [{ id: 'users', icon: <UserIcon size={20} />, label: 'Usuarios' }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setCurrentView(tab.id as typeof currentView)}
            className={`flex flex-col items-center p-2 gap-0.5 relative ${currentView === tab.id ? (tab.id === 'maintenance' ? 'text-amber-400' : 'text-primary') : 'text-slate-500'}`}
          >
            {tab.icon}
            {tab.id === 'maintenance' && maintenanceCount > 0 && (
              <span className="absolute -top-1 right-0 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{maintenanceCount}</span>
            )}
            <span className="text-[10px] font-bold">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
