// src/lib/pdfGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBs, formatUSD, formatNumber } from './formatters.js';
import { ISLAND_LABELS, SHIFT_LABELS, SUPERVISOR_SHIFT_LABELS } from '../config/constants.js';

const PRIMARY_COLOR = [206, 17, 38]; // #CE1126
const SECONDARY_COLOR = [0, 51, 153]; // #003399
const ACCENT_COLOR = [255, 209, 0]; // #FFD100
const GRAY_COLOR = [100, 100, 100];
const LIGHT_BLUE = [227, 242, 253]; // #E3F2FD
const LIGHT_GRAY = [240, 244, 255]; // #F0F4FF
const LIGHT_GREEN = [232, 245, 233]; // #E8F5E9
const LIGHT_ORANGE = [255, 243, 224]; // #FFF3E0

function addHeader(doc, title, shift, stationConfig) {
  const stationName = stationConfig?.stationName || 'Estación de Servicio';
  const stationRif = stationConfig?.stationRif || '';
  const stationAddress = stationConfig?.stationAddress || '';

  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(stationName, 14, 20);

  if (stationRif && stationRif !== 'J-00000000-0') {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_COLOR);
    doc.text(`RIF: ${stationRif}`, 14, 26);
  }

  doc.setFontSize(12);
  doc.setTextColor(...SECONDARY_COLOR);
  const titleY = stationRif && stationRif !== 'J-00000000-0' ? 33 : 27;
  doc.text(title, 14, titleY);

  doc.setFontSize(9);
  doc.setTextColor(...GRAY_COLOR);

  const opLabel = SHIFT_LABELS[shift.operatorShiftType] || shift.operatorShiftType || shift.shiftType || '';
  const supLabel = SUPERVISOR_SHIFT_LABELS[shift.supervisorShiftType] || '';
  const infoY = titleY + 7;
  doc.text(`Fecha: ${shift.date}  |  ${opLabel}`, 14, infoY);

  if (supLabel) {
    doc.text(`Supervisor: ${supLabel}`, 14, infoY + 5);
  }

  doc.text(`Tasa BCV: ${formatBs(shift.tasa1)}`, 14, supLabel ? infoY + 11 : infoY + 5);
  if (shift.tasa2 > 0) {
    doc.text(`Tasa 2: ${formatBs(shift.tasa2)}`, 14, supLabel ? infoY + 16 : infoY + 10);
  }

  const lineY = supLabel
    ? (shift.tasa2 > 0 ? infoY + 22 : infoY + 17)
    : (shift.tasa2 > 0 ? infoY + 16 : infoY + 11);

  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.5);
  doc.line(14, lineY, 196, lineY);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_COLOR);
    if (stationAddress) {
      doc.text(`${stationName} — ${stationAddress}`, 14, 287);
    } else {
      doc.text(stationName, 14, 287);
    }
    doc.text(`Página ${i} de ${pageCount}`, 196, 287, { align: 'right' });
  }

  return lineY + 5;
}

function buildCuadrePVRows(cuadre, tasa1, tasa2) {
  const hasTasa2 = (tasa2 || 0) > 0;
  const body = [];

  let sumT1Bs = 0, sumT1Usd = 0, sumT1Lit = 0;
  let sumT2Bs = 0, sumT2Usd = 0, sumT2Lit = 0;

  for (const r of cuadre) {
    body.push({
      island: ISLAND_LABELS[r.islandId],
      bs: '', usd: '', lit: '',
      _type: 'island_header',
    });

    sumT1Bs += r.pvTotalBs;
    sumT1Usd += r.pvTotalUSD;
    sumT1Lit += r.pvUSDinLiters;
    body.push({
      island: `   Tasa 1 (${formatBs(tasa1)})`,
      bs: formatBs(r.pvTotalBs),
      usd: formatUSD(r.pvTotalUSD),
      lit: formatNumber(r.pvUSDinLiters, 2),
      _type: 'tasa_row',
    });

    if (hasTasa2) {
      sumT2Bs += r.pv2TotalBs;
      sumT2Usd += r.pv2TotalUSD;
      sumT2Lit += r.pv2USDinLiters;
      body.push({
        island: `   Tasa 2 (${formatBs(tasa2)})`,
        bs: formatBs(r.pv2TotalBs),
        usd: formatUSD(r.pv2TotalUSD),
        lit: formatNumber(r.pv2USDinLiters, 2),
        _type: 'tasa_row',
      });
    }
  }

  body.push({
    island: 'Total Tasa 1',
    bs: formatBs(sumT1Bs),
    usd: formatUSD(sumT1Usd),
    lit: formatNumber(sumT1Lit, 2) + ' L',
    _type: 'total_tasa1',
  });

  if (hasTasa2) {
    body.push({
      island: 'Total Tasa 2',
      bs: formatBs(sumT2Bs),
      usd: formatUSD(sumT2Usd),
      lit: formatNumber(sumT2Lit, 2) + ' L',
      _type: 'total_tasa2',
    });
  }

  body.push({
    island: 'TOTAL TURNO',
    bs: formatBs(sumT1Bs + sumT2Bs),
    usd: formatUSD(sumT1Usd + sumT2Usd),
    lit: formatNumber(sumT1Lit + sumT2Lit, 2) + ' L',
    _type: 'total_turno',
  });

  return body;
}

function cuadrePVCellHook(data) {
  const row = data.table.body[data.row.index];
  if (!row) return;

  const raw = row.raw;
  if (!raw || !raw._type) return;

  if (raw._type === 'island_header') {
    data.cell.styles.fillColor = LIGHT_BLUE;
    data.cell.styles.fontStyle = 'bold';
    data.cell.styles.textColor = SECONDARY_COLOR;
    data.cell.styles.fontSize = 9;
  } else if (raw._type === 'tasa_row') {
    data.cell.styles.fontSize = 8;
    data.cell.styles.fontStyle = 'normal';
    data.cell.styles.textColor = GRAY_COLOR;
    if (data.column.index === 0) {
      data.cell.styles.fontStyle = 'bold';
    }
  } else if (raw._type === 'total_tasa1') {
    data.cell.styles.fillColor = LIGHT_GRAY;
    data.cell.styles.fontStyle = 'bold';
    data.cell.styles.fontSize = 8.5;
  } else if (raw._type === 'total_tasa2') {
    data.cell.styles.fillColor = LIGHT_BLUE;
    data.cell.styles.fontStyle = 'bold';
    data.cell.styles.fontSize = 8.5;
  } else if (raw._type === 'total_turno') {
    data.cell.styles.fillColor = LIGHT_ORANGE;
    data.cell.styles.fontStyle = 'bold';
    data.cell.styles.fontSize = 9;
    data.cell.styles.textColor = PRIMARY_COLOR;
    if (data.column.index === 3) {
      data.cell.styles.textColor = [46, 125, 50];
    }
  }
}

export function generateCierrePDF(shift, biblia, stationConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = addHeader(doc, 'CIERRE DE TURNO - LECTURAS DE SURTIDORES', shift, stationConfig);

  const pumpData = shift.pumpReadings.map((r) => [
    `Isla ${r.islandId}`,
    `Surtidor ${r.pumpNumber}`,
    formatNumber(r.initialReading, 0),
    formatNumber(r.finalReading, 0),
    formatNumber(r.litersSold, 0),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Isla', 'Surtidor', 'Lectura Inicial', 'Lectura Final', 'Litros Vendidos']],
    body: pumpData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    styles: { halign: 'center' },
  });

  const tankY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text('LECTURAS DE TANQUES', 14, tankY);

  const tankData = shift.tankReadings.map((r) => [
    `Tanque ${r.tankId}`,
    formatNumber(r.cm, 1) + ' cm',
    formatNumber(r.liters, 0) + ' L',
  ]);

  autoTable(doc, {
    startY: tankY + 5,
    head: [['Tanque', 'CM', 'Litros']],
    body: tankData,
    theme: 'grid',
    headStyles: { fillColor: SECONDARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    styles: { halign: 'center' },
  });

  const gandY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(...GRAY_COLOR);
  doc.text(`Litros recibidos (Gandola): ${formatNumber(shift.gandolaLiters, 0)}`, 14, gandY);

  return doc;
}

export function generateBibliaPDF(shift, biblia, stationConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');
  addHeader(doc, 'BIBLIA - RESUMEN FINANCIERO', shift, stationConfig);

  const hasTasa2 = (shift.tasa2 || 0) > 0;

  const bibliaData = biblia.map((b) => {
    const row = [
      ISLAND_LABELS[b.islandId],
      b.operatorName,
      formatNumber(b.litersRef, 2),
      formatBs(b.bsTotal),
      formatUSD(b.bsInUSD),
      formatUSD(b.usdTotal),
      formatUSD(b.pv1Total),
    ];
    if (hasTasa2) {
      row.push(formatUSD(b.pv2Total));
    }
    row.push(
      formatUSD(b.valesMonto),
      formatUSD(b.transferenciaMonto),
      formatUSD(b.ingresosTotalUSD),
      formatUSD(b.propinaUSD),
      formatBs(b.propinaBs),
    );
    return row;
  });

  const head = hasTasa2
    ? [['Isla', 'Operador', 'Lit. Ref', 'Bs Total', 'Bs→$', 'USD', 'PV1', 'PV2', 'Vales', 'Transf.', 'Ingresos $', 'Prop. $', 'Prop. Bs']]
    : [['Isla', 'Operador', 'Lit. Ref', 'Bs Total', 'Bs→$', 'USD', 'PV', 'Vales', 'Transf.', 'Ingresos $', 'Prop. $', 'Prop. Bs']];

  autoTable(doc, {
    startY: 42,
    head,
    body: bibliaData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
    bodyStyles: { fontSize: 6.5 },
    styles: { halign: 'center', overflow: 'linebreak' },
    columnStyles: { 1: { halign: 'left' } },
  });

  return doc;
}

export function generateCuadrePVPDF(shift, cuadre, stationConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');
  addHeader(doc, 'CUADRE DIARIO PUNTO DE VENTA', shift, stationConfig);

  const bodyRows = buildCuadrePVRows(cuadre, shift.tasa1, shift.tasa2);
  const tableBody = bodyRows.map((r) => [r.island, r.bs, r.usd, r.lit]);

  autoTable(doc, {
    startY: 42,
    head: [['Isla', 'Bs.', '$', 'Litros']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: SECONDARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    styles: { halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 60 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    didParseCell: cuadrePVCellHook,
  });

  return doc;
}

/**
 * Genera PDF de inventario con columnas de islas DINÁMICAS.
 * Lee stationConfig.islandsCount para determinar cuántas columnas mostrar.
 */
export function generateInventarioPDF(shift, inventory, stationConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');
  addHeader(doc, 'INVENTARIO DE PRODUCTOS', shift, stationConfig);

  const islandCount = stationConfig?.islandsCount || 3;
  const islandIds = Array.from({ length: islandCount }, (_, i) => i + 1);

  // Cabecera dinámica
  const head = [
    ['Producto', 'Stock Ini', ...islandIds.map((id) => `Isla ${id}`), 'Total Ven', 'Stock Fin', 'Total $'],
  ];

  const invData = inventory.map((r) => [
    r.productName.substring(0, 35),
    r.stockInicial.toString(),
    ...islandIds.map((id) => (r.vendidoPorIsla[id] || 0).toString()),
    r.totalVendido.toString(),
    r.stockFinal.toString(),
    formatUSD(r.totalUSD),
  ]);

  autoTable(doc, {
    startY: 42,
    head,
    body: invData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
    bodyStyles: { fontSize: 6.5 },
    styles: { halign: 'center', overflow: 'linebreak' },
    columnStyles: { 0: { halign: 'left', cellWidth: 45 } },
  });

  return doc;
}

export function generateAllPDFs(shift, biblia, cuadre, inventory, stationConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');

  const stationName = stationConfig?.stationName || 'Estación de Servicio';
  const stationRif = stationConfig?.stationRif || '';
  const stationAddress = stationConfig?.stationAddress || '';

  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(stationName, 14, 20);

  if (stationRif && stationRif !== 'J-00000000-0') {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_COLOR);
    doc.text(`RIF: ${stationRif}`, 14, 26);
  }

  const opLabel = SHIFT_LABELS[shift.operatorShiftType] || shift.operatorShiftType || shift.shiftType || '';
  doc.setFontSize(12);
  doc.setTextColor(...SECONDARY_COLOR);
  const titleY = stationRif && stationRif !== 'J-00000000-0' ? 33 : 27;
  doc.text(`CIERRE DE TURNO - ${opLabel}`, 14, titleY);

  doc.setFontSize(9);
  doc.setTextColor(...GRAY_COLOR);
  const infoY = titleY + 7;
  doc.text(`Fecha: ${shift.date}`, 14, infoY);
  doc.text(`Tasa BCV: ${formatBs(shift.tasa1)}`, 14, infoY + 5);
  if (shift.tasa2 > 0) {
    doc.text(`Tasa 2: ${formatBs(shift.tasa2)}`, 14, infoY + 10);
  }

  let currentY = infoY + (shift.tasa2 > 0 ? 17 : 12);

  const pumpData = shift.pumpReadings.map((r) => [
    `Isla ${r.islandId}`, `Surtidor ${r.pumpNumber}`,
    formatNumber(r.initialReading, 0), formatNumber(r.finalReading, 0), formatNumber(r.litersSold, 0),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Isla', 'Surtidor', 'Inicial', 'Final', 'Litros']],
    body: pumpData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    styles: { halign: 'center' },
  });

  currentY = doc.lastAutoTable.finalY + 12;

  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('BIBLIA', 14, currentY);
  currentY += 5;

  const hasTasa2All = (shift.tasa2 || 0) > 0;
  const bibliaData = biblia.map((b) => {
    const row = [
      ISLAND_LABELS[b.islandId], b.operatorName,
      formatNumber(b.litersRef, 2), formatUSD(b.bsInUSD),
      formatUSD(b.usdTotal), formatUSD(b.pv1Total),
    ];
    if (hasTasa2All) {
      row.push(formatUSD(b.pv2Total));
    }
    row.push(
      formatUSD(b.valesMonto),
      formatUSD(b.transferenciaMonto),
      formatUSD(b.ingresosTotalUSD), formatUSD(b.propinaUSD),
    );
    return row;
  });

  const bibliaHead = hasTasa2All
    ? [['Isla', 'Operador', 'Lit.Ref', 'Bs→$', 'USD', 'PV1', 'PV2', 'Vales', 'Transf.', 'Ingresos', 'Prop.$']]
    : [['Isla', 'Operador', 'Lit.Ref', 'Bs→$', 'USD', 'PV', 'Vales', 'Transf.', 'Ingresos', 'Prop.$']];

  autoTable(doc, {
    startY: currentY,
    head: bibliaHead,
    body: bibliaData,
    theme: 'grid',
    headStyles: { fillColor: SECONDARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
    bodyStyles: { fontSize: 6.5 },
    styles: { halign: 'center', overflow: 'linebreak' },
    columnStyles: { 1: { halign: 'left' } },
  });

  doc.addPage();

  doc.setFontSize(12);
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text(`${stationName} — CUADRE PV - ${opLabel}`, 14, 20);
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_COLOR);
  doc.text(`Fecha: ${shift.date}  |  Tasa BCV: ${formatBs(shift.tasa1)}`, 14, 27);

  const cuadreBodyRows = buildCuadrePVRows(cuadre, shift.tasa1, shift.tasa2);
  const cuadreTableBody = cuadreBodyRows.map((r) => [r.island, r.bs, r.usd, r.lit]);

  autoTable(doc, {
    startY: 35,
    head: [['Isla', 'Bs.', '$', 'Litros']],
    body: cuadreTableBody,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    styles: { halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 60 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    didParseCell: cuadrePVCellHook,
  });

  const invY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('INVENTARIO', 14, invY);

  const invData = inventory.filter((r) => r.totalVendido > 0).map((r) => [
    r.productName.substring(0, 30), r.totalVendido.toString(), formatUSD(r.totalUSD),
  ]);

  autoTable(doc, {
    startY: invY + 5,
    head: [['Producto', 'Cant', 'Total $']],
    body: invData,
    theme: 'grid',
    headStyles: { fillColor: ACCENT_COLOR, textColor: 0, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    styles: { halign: 'center' },
    columnStyles: { 0: { halign: 'left' } },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_COLOR);
    if (stationAddress) {
      doc.text(`${stationName} — ${stationAddress}`, 14, 287);
    } else {
      doc.text(stationName, 14, 287);
    }
    doc.text(`Página ${i} de ${pageCount}`, 196, 287, { align: 'right' });
  }

  return doc;
}