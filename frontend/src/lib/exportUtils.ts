/** Utilidades de exportación: CSV, PDF, Excel para solicitudes, inventario, auditoría y mantenimiento. */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Request, Asset, AuditLog, MaintenanceLog } from '../types';

/** Formatea fechas de forma segura. */
const safeDate = (d?: string) =>
  d ? format(new Date(d), 'dd/MM/yyyy', { locale: es }) : '—';

/** Exporta solicitudes a CSV (BOM para tildes en Excel). */
export const exportRequestsToCSV = (requests: Request[]) => {
  const headers = ['ID', 'Activo', 'Tag', 'Solicitante', 'Disciplina', 'Estado', 'Dias', 'Fecha Solicitud', 'Fecha Retorno'];
  const rows = requests.map(r => [
    r.id,
    r.assets?.name ?? r.asset_id,
    r.assets?.tag ?? '—',
    r.requester_name,
    r.requester_disciplina ?? '—',
    r.status,
    r.days_requested,
    safeDate(r.created_at),
    safeDate(r.expected_return_date),
  ]);

  const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
  downloadFile(csv, `zyklus_solicitudes_${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv;charset=utf-8;');
};

/** Exporta solicitudes a PDF. */
export const exportRequestsToPDF = (requests: Request[]) => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(6, 182, 212);
  doc.text('ZYKLUS HALO', 14, 15);

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text('Reporte de Solicitudes', 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generado: ${format(new Date(), "d 'de' MMMM 'de' yyyy HH:mm", { locale: es })}`, 14, 28);
  doc.text(`Total: ${requests.length} registros`, 14, 33);

  const tableData = requests.map(r => [
    String(r.id),
    r.assets?.name ?? r.asset_id,
    r.requester_name,
    r.requester_disciplina ?? '—',
    r.status,
    String(r.days_requested),
    safeDate(r.created_at),
    safeDate(r.expected_return_date),
  ]);

  autoTable(doc, {
    head: [['ID', 'Activo', 'Solicitante', 'Disciplina', 'Estado', 'Dias', 'Fecha', 'Retorno']],
    body: tableData,
    startY: 38,
    theme: 'grid',
    headStyles: { fillColor: [6, 182, 212], textColor: [2, 6, 23], fontSize: 8 },
    bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 38, left: 10, right: 10 },
  });

  doc.save(`zyklus_solicitudes_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

/** Exporta solicitudes a Excel. */
export const exportRequestsToExcel = (requests: Request[]) => {
  const data = requests.map(r => ({
    'ID': r.id,
    'Activo': r.assets?.name ?? r.asset_id,
    'Tag': r.assets?.tag ?? '—',
    'Solicitante': r.requester_name,
    'Disciplina': r.requester_disciplina ?? '—',
    'Estado': r.status,
    'Dias Solicitados': r.days_requested,
    'Fecha Solicitud': safeDate(r.created_at),
    'Fecha Retorno': safeDate(r.expected_return_date),
    'Motivo': r.motive ?? '—',
    'Institucion': r.institutions?.name ?? '—',
    'Es Kit': r.bundle_group_id ? 'Si' : 'No',
    'Danos': r.is_damaged ? `Si: ${r.damage_notes ?? ''}` : 'No',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Solicitudes');

  const wscols = [
    { wch: 6 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 18 },
    { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
    { wch: 20 }, { wch: 8 }, { wch: 20 },
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, `zyklus_solicitudes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

/** Exporta préstamos por usuario y disciplina a Excel. */
export const exportRequestsByUser = (requests: Request[]) => {
  const workbook = XLSX.utils.book_new();

  const byUser: Record<string, {
    nombre: string; disciplina: string;
    total: number; activos: number; devueltos: number; vencidos: number; _dias: number[];
  }> = {};

  for (const r of requests) {
    const uid = r.user_id;
    if (!byUser[uid]) {
      byUser[uid] = {
        nombre: r.requester_name,
        disciplina: r.requester_disciplina ?? '—',
        total: 0, activos: 0, devueltos: 0, vencidos: 0, _dias: [],
      };
    }
    byUser[uid].total++;
    if (r.status === 'ACTIVE') byUser[uid].activos++;
    if (r.status === 'RETURNED') byUser[uid].devueltos++;
    if (r.status === 'OVERDUE') byUser[uid].vencidos++;
    byUser[uid]._dias.push(r.days_requested ?? 0);
  }

  const userSummary = Object.values(byUser).map(u => ({
    'Nombre': u.nombre,
    'Disciplina / Centro de Costo': u.disciplina,
    'Total Solicitudes': u.total,
    'Activos': u.activos,
    'Devueltos': u.devueltos,
    'Vencidos': u.vencidos,
    'Promedio Dias Prestamo': u._dias.length
      ? Math.round(u._dias.reduce((a, b) => a + b, 0) / u._dias.length)
      : 0,
  })).sort((a, b) => b['Total Solicitudes'] - a['Total Solicitudes']);

  const ws1 = XLSX.utils.json_to_sheet(userSummary);
  ws1['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, ws1, 'Por Usuario');

  const byDisciplina: Record<string, { total: number; activos: number; vencidos: number }> = {};
  for (const r of requests) {
    const d = r.requester_disciplina ?? 'Sin asignar';
    if (!byDisciplina[d]) byDisciplina[d] = { total: 0, activos: 0, vencidos: 0 };
    byDisciplina[d].total++;
    if (r.status === 'ACTIVE') byDisciplina[d].activos++;
    if (r.status === 'OVERDUE') byDisciplina[d].vencidos++;
  }

  const total = requests.length || 1;
  const disciplinaData = Object.entries(byDisciplina).map(([d, v]) => ({
    'Disciplina / Centro de Costo': d,
    'Total Solicitudes': v.total,
    'Activos en Prestamo': v.activos,
    'Vencidos': v.vencidos,
    'Porcentaje del Total': `${Math.round((v.total / total) * 100)}%`,
  })).sort((a, b) => b['Total Solicitudes'] - a['Total Solicitudes']);

  const ws2 = XLSX.utils.json_to_sheet(disciplinaData);
  ws2['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, ws2, 'Por Disciplina');

  const detail = requests.map(r => ({
    'ID': r.id,
    'Activo': r.assets?.name ?? r.asset_id,
    'Tag': r.assets?.tag ?? '—',
    'Solicitante': r.requester_name,
    'Disciplina': r.requester_disciplina ?? '—',
    'Estado': r.status,
    'Dias': r.days_requested,
    'Solicitud': safeDate(r.created_at),
    'Retorno Esperado': safeDate(r.expected_return_date),
    'Devolucion Real': safeDate(r.checkin_at),
    'Motivo': r.motive ?? '—',
    'Institucion Externa': r.institutions?.name ?? '—',
  }));

  const ws3 = XLSX.utils.json_to_sheet(detail);
  ws3['!cols'] = [
    { wch: 6 }, { wch: 25 }, { wch: 10 }, { wch: 22 }, { wch: 20 },
    { wch: 12 }, { wch: 6 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, ws3, 'Detalle Completo');

  XLSX.writeFile(workbook, `zyklus_prestamos_por_usuario_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

/** Exporta incidencias y mantenimientos a Excel. */
export const exportMaintenanceReport = (maintenanceLogs: MaintenanceLog[], assets: Asset[]) => {
  const workbook = XLSX.utils.book_new();

  const logsData = maintenanceLogs.map(log => {
    const statusLabel =
      log.status === 'RESOLVED' ? 'Resuelto' :
      log.status === 'IN_PROGRESS' ? 'En Proceso' : 'Abierto';

    const diasResolucion = log.resolved_at
      ? Math.round((new Date(log.resolved_at).getTime() - new Date(log.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      'ID': log.id,
      'Activo': log.assets?.name ?? log.asset_id,
      'Tag': log.assets?.tag ?? '—',
      'Descripcion del Problema': log.issue_description ?? '—',
      'Estado': statusLabel,
      'Reportado Por': log.users?.name ?? '—',
      'Fecha Reporte': safeDate(log.created_at),
      'Fecha Resolucion': safeDate(log.resolved_at),
      'Costo Reparacion': log.cost != null ? `$${log.cost}` : '—',
      'Dias Resolucion': diasResolucion != null ? diasResolucion : '—',
    };
  });

  const ws1 = XLSX.utils.json_to_sheet(logsData);
  ws1['!cols'] = [
    { wch: 6 }, { wch: 25 }, { wch: 10 }, { wch: 40 }, { wch: 12 },
    { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, ws1, 'Incidencias');

  const byAsset: Record<string, { nombre: string; tag: string; total: number; resueltos: number; costo: number }> = {};
  for (const log of maintenanceLogs) {
    const aid = log.asset_id;
    if (!byAsset[aid]) {
      byAsset[aid] = {
        nombre: log.assets?.name ?? aid,
        tag: log.assets?.tag ?? '—',
        total: 0, resueltos: 0, costo: 0,
      };
    }
    byAsset[aid].total++;
    if (log.status === 'RESOLVED') byAsset[aid].resueltos++;
    if (log.cost != null) byAsset[aid].costo += log.cost;
  }

  const assetRanking = Object.values(byAsset).map(a => ({
    'Activo': a.nombre,
    'Tag': a.tag,
    'Total Incidencias': a.total,
    'Resueltas': a.resueltos,
    'Pendientes': a.total - a.resueltos,
    'Costo Total Reparaciones': a.costo > 0 ? `$${a.costo}` : '—',
  })).sort((a, b) => b['Total Incidencias'] - a['Total Incidencias']);

  const ws2 = XLSX.utils.json_to_sheet(assetRanking);
  ws2['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, ws2, 'Ranking por Activo');

  const needsMaint = assets
    .filter(a => a.maintenance_alert || a.status === 'En mantenimiento' || a.status === 'Requiere Mantenimiento')
    .map(a => ({
      'Tag': a.tag,
      'Nombre': a.name,
      'Categoria': a.category ?? '—',
      'Estado Actual': a.status,
      'Alerta Activa': a.maintenance_alert ? 'Si' : 'No',
      'Usos desde Ult. Mantenimiento': a.usage_count ?? 0,
      'Umbral de Usos': a.maintenance_usage_threshold ?? '—',
      'Proximo Mantenimiento': a.next_maintenance_date ? safeDate(a.next_maintenance_date) : '—',
      'Ubicacion': a.location ?? '—',
    }));

  const ws3Sheet = needsMaint.length
    ? needsMaint
    : [{ 'Mensaje': 'No hay activos que requieran mantenimiento actualmente' }];

  const ws3 = XLSX.utils.json_to_sheet(ws3Sheet);
  ws3['!cols'] = [
    { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 20 },
    { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(workbook, ws3, 'Requieren Atencion');

  XLSX.writeFile(workbook, `zyklus_mantenimientos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

/** Exporta inventario completo a PDF. */
export const exportInventoryToPDF = (assets: Asset[]) => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(6, 182, 212);
  doc.text('INVENTARIO COMPLETO', 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Total de Activos: ${assets.length}`, 14, 22);
  doc.text(`Generado: ${format(new Date(), "d 'de' MMMM 'de' yyyy HH:mm", { locale: es })}`, 14, 27);

  const tableData = assets.map(a => [
    a.tag,
    a.name,
    a.category ?? '—',
    a.status,
    a.location ?? '—',
    a.brand ?? '—',
    a.serial ?? '—',
    a.next_maintenance_date ? safeDate(a.next_maintenance_date) : '—',
  ]);

  autoTable(doc, {
    head: [['Tag', 'Nombre', 'Categoria', 'Estado', 'Ubicacion', 'Marca', 'Serie', 'Prox. Mant.']],
    body: tableData,
    startY: 33,
    theme: 'grid',
    headStyles: { fillColor: [6, 182, 212], textColor: [2, 6, 23], fontSize: 8 },
    bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 33, left: 10, right: 10 },
  });

  doc.save(`zyklus_inventario_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

/** Exporta registros de auditoría a Excel. */
export const exportAuditLogsToExcel = (logs: AuditLog[]) => {
  const data = logs.map(log => ({
    'Timestamp': format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es }),
    'Accion': log.action,
    'Actor': log.actor_name ?? log.actor_id ?? 'Sistema',
    'Target ID': log.target_id,
    'Tipo de Target': log.target_type,
    'Detalles': log.details ?? '—',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Trail');

  worksheet['!cols'] = [
    { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 38 }, { wch: 12 }, { wch: 50 },
  ];

  XLSX.writeFile(workbook, `zyklus_audit_trail_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

/** Descarga un archivo en el navegador. */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}