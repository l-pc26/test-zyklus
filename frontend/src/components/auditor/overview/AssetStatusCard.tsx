import { useState, useMemo } from 'react';
import { useData } from '../../../context/DataContext';
import { Card } from '../../ui/core';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Package, Clock, CheckCircle2, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  'Prestados':    '#06b6d4',
  'Disponibles':  '#10b981',
  'Aprobados':    '#f59e0b',
  'Sin datos':    '#334155',
};

const DISCIPLINE_ALL = '__ALL__';

/** Tarjeta de Estado de Activos: donut chart + tabla de préstamos filtrados por disciplina */
export function AssetStatusCard() {
  const { assets, requests, stats } = useData();

  // Disciplinas únicas de los usuarios que tienen solicitudes
  const disciplinas = useMemo(() => {
    return Array.from(
      new Set(
        requests
          .map(r => r.requester_disciplina)
          .filter((d): d is string => Boolean(d))
      )
    ).sort();
  }, [requests]);

  const [selectedDisciplina, setSelectedDisciplina] = useState<string>(DISCIPLINE_ALL);
  const [showAvailableInChart, setShowAvailableInChart] = useState<boolean>(false);

  // Filtrar solicitudes por disciplina
  const filteredRequests = useMemo(() => {
    if (selectedDisciplina === DISCIPLINE_ALL) return requests;
    return requests.filter(r => r.requester_disciplina === selectedDisciplina);
  }, [requests, selectedDisciplina]);

  // Contar activos en cada estado dentro del filtro
  const activeLoans = useMemo(
    () => filteredRequests.filter(r => ['ACTIVE', 'ACTIVE_INTERNAL'].includes(r.status)),
    [filteredRequests]
  );
  const approvedPending = useMemo(
    () => filteredRequests.filter(r => r.status === 'APPROVED'),
    [filteredRequests]
  );
  const overdueLoans = useMemo(
    () => filteredRequests.filter(r => r.status === 'OVERDUE'),
    [filteredRequests]
  );

  // Activos disponibles (global, no depende de disciplina ya que es estado de activo)
  const availableCount = stats?.assetCounts?.['disponible'] ?? assets.filter(a => a.status === 'Disponible').length;

  // Datos para el donut chart
  const chartData = useMemo(() => {
    const data = [
      { name: 'Prestados', value: activeLoans.length + overdueLoans.length },
      ...(showAvailableInChart ? [{ name: 'Disponibles', value: availableCount }] : []),
      { name: 'Aprobados', value: approvedPending.length }
    ].filter(d => d.value > 0);

    // Si todo es 0, Recharts lanza error (NaN). Retornamos un estado vacío.
    if (data.length === 0) {
      return [{ name: 'Sin datos', value: 1 }];
    }

    return data;
  }, [activeLoans.length, overdueLoans.length, availableCount, approvedPending.length, showAvailableInChart]);

  // Tabla de préstamos activos filtrados (top 8)
  const loanRows = useMemo(() => {
    return [...activeLoans, ...overdueLoans]
      .slice(0, 8)
      .map(r => ({
        id: r.id,
        assetName: r.assets?.name ?? `Activo #${r.asset_id}`,
        requester: r.requester_name,
        disciplina: r.requester_disciplina ?? '—',
        expectedReturn: r.expected_return_date
          ? format(new Date(r.expected_return_date), 'dd/MM/yy', { locale: es })
          : '—',
        isOverdue: r.status === 'OVERDUE',
      }));
  }, [activeLoans, overdueLoans]);

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-slate-900 to-cyan-900/5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Package className="text-cyan-400" size={18} />
          <h3 className="text-white font-bold text-sm">Estado de Activos por Disciplina</h3>
        </div>

        {/* Selector de disciplina y toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAvailableInChart(prev => !prev)}
            className={`text-[10px] px-2 py-1.5 rounded-md border font-bold transition-colors ${showAvailableInChart ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
          >
            {showAvailableInChart ? 'Ocultar Disp.' : 'Ver Disponibles'}
          </button>
          
          <Globe size={13} className="text-slate-400 shrink-0" />
          <select
            className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 max-w-[180px]"
            value={selectedDisciplina}
            onChange={e => setSelectedDisciplina(e.target.value)}
          >
            <option value={DISCIPLINE_ALL}>Todas las disciplinas</option>
            {disciplinas.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- Gráfica Donut --- */}
        <div>
          {/* KPI chips */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex flex-col items-center p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
              <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wide">Prestados</span>
              <span className="text-xl font-black text-white mt-0.5">{activeLoans.length + overdueLoans.length}</span>
              {overdueLoans.length > 0 && (
                <span className="text-[9px] text-rose-400 mt-0.5">{overdueLoans.length} vencido{overdueLoans.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="flex flex-col items-center p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">Disponibles</span>
              <span className="text-xl font-black text-white mt-0.5">{availableCount}</span>
              <span className="text-[9px] text-slate-500 mt-0.5">Global</span>
            </div>
            <div className="flex flex-col items-center p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">Aprobados</span>
              <span className="text-xl font-black text-white mt-0.5">{approvedPending.length}</span>
              <span className="text-[9px] text-slate-500 mt-0.5">Pendientes</span>
            </div>
          </div>

          {/* Donut */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--text)' }}
                  formatter={(value: number, name: string) => [`${value} activos`, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={v => <span className="text-slate-300">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* --- Tabla de préstamos activos --- */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} className="text-cyan-400" />
            <span className="text-xs font-semibold text-slate-300">
              Activos actualmente prestados
              {selectedDisciplina !== DISCIPLINE_ALL && (
                <span className="ml-1.5 text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded-full">
                  {selectedDisciplina}
                </span>
              )}
            </span>
          </div>

          {loanRows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl h-48">
              <div className="text-center space-y-1">
                <CheckCircle2 size={20} className="mx-auto text-emerald-500/40" />
                <p>Sin préstamos activos</p>
                {selectedDisciplina !== DISCIPLINE_ALL && (
                  <p className="text-[10px] text-slate-600">en {selectedDisciplina}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 max-h-56">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-[9px] uppercase font-bold text-slate-500 tracking-wide">Activo</th>
                    <th className="px-3 py-2 text-[9px] uppercase font-bold text-slate-500 tracking-wide hidden sm:table-cell">Solicitante</th>
                    <th className="px-3 py-2 text-[9px] uppercase font-bold text-slate-500 tracking-wide">Retorno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loanRows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2">
                        <span className="font-medium text-white truncate max-w-[120px] block">{row.assetName}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-400 hidden sm:table-cell">
                        <div>{row.requester}</div>
                        <div className="text-[9px] text-slate-600">{row.disciplina}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-mono ${row.isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                          {row.expectedReturn}
                        </span>
                        {row.isOverdue && (
                          <span className="ml-1 text-[9px] text-rose-400">vencido</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loanRows.length > 0 && (
            <p className="text-[9px] text-slate-600 mt-1.5 text-right">
              Mostrando {loanRows.length} de {activeLoans.length + overdueLoans.length} préstamos
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
