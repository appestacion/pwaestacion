import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBs, formatUSD, formatNumber } from './formatters.js';
import { ISLAND_LABELS, SHIFT_LABELS, SUPERVISOR_SHIFT_LABELS } from '../config/constants.js';

const PRIMARY_COLOR = [206, 17, 38]; // #CE1126
const SECONDARY_COLOR = [0, 51, 153]; // #003399
const ACCENT_COLOR = [255, 209, 0]; // #FFD100
const GRAY_COLOR = [100, 100, 100];

function addHeader(doc, title, shift, stationConfig) {
  const stationName = stationConfig?.stationName || 'Estación de Servicio';
  const stationRif = stationConfig?.stationRif || '';
  const stationAddress = stationConfig?.stationAddress || '';

  // Station name
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(stationName, 14, 20);

  // RIF
  if (stationRif && stationRif !== 'J-00000000-0') {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_COLOR);
    doc.text(`RIF: ${stationRif}`, 14, 26);
  }

  // Report title
  doc.setFontSize(12);
  doc.setTextColor(...SECONDARY_COLOR);
  const titleY = stationRif && stationRif !== 'J-00000000-0' ? 33 : 27;
  doc.text(title, 14, titleY);

  // Shift info
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

  // Footer
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

export function generateCierrePDF(shift, biblia, stationConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = addHeader(doc, 'CIERRE DE TURNO - LECTURAS DE SURTIDORES', shift, stationConfig);

  // Pump readings
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

  // Tank readings (simplified: CM and Liters)
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

  // Gandola
  const gandY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(...GRAY_COLOR);
  doc.text(`Litros recibidos (Gandola): ${formatNumber(shift.gandolaLiters, 0)}`, 14, gandY);

  return doc;
}

export function generateBibliaPDF(shift, biblia, stationConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');
  addHeader(doc, 'BIBLIA - RESUMEN FINANCIERO', shift, stationConfig);

  const bibliaData = biblia.map((b) => [
    ISLAND_LABELS[b.islandId],
    b.operatorName,
    formatNumber(b.litersRef, 2),
    formatBs(b.bsTotal),
    formatUSD(b.bsInUSD),
    formatUSD(b.usdTotal),
    formatUSD(b.puntoTotal),
    formatUSD(b.ueTotal),
    formatUSD(b.ingresosTotalUSD),
    formatUSD(b.propinaUSD),
    formatBs(b.propinaBs),
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Isla', 'Operador', 'Lit. Ref', 'Bs Total', 'Bs→$', 'USD', 'PV', 'UE', 'Ingresos $', 'Prop. $', 'Prop. Bs']],
    body: bibliaData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    styles: { halign: 'center', overflow: 'linebreak' },
    columnStyles: { 1: { halign: 'left' } },
  });

  return doc;
}

export function generateCuadrePVPDF(shift, cuadre, stationConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');
  addHeader(doc, 'CUADRE PUNTO DE VENTA', shift, stationConfig);

  const cuadreData = cuadre.map((r) => [
    ISLAND_LABELS[r.islandId],
    formatUSD(r.pvTotalUSD),
    formatBs(r.pvTotalBs),
    formatNumber(r.pvUSDinLiters, 2),
    formatUSD(r.pv2TotalUSD),
    formatBs(r.pv2TotalBs),
    formatNumber(r.pv2USDinLiters, 2),
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Isla', 'PV $', 'PV Bs', 'PV→Lit', 'PV2 $', 'PV2 Bs', 'PV2→Lit']],
    body: cuadreData,
    theme: 'grid',
    headStyles: { fillColor: SECONDARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    styles: { halign: 'center' },
  });

  return doc;
}

export function generateInventarioPDF(shift, inventory, stationConfig) {
  const doc = new jsPDF('p', 'mm', 'a4');
  addHeader(doc, 'INVENTARIO DE PRODUCTOS', shift, stationConfig);

  const invData = inventory.map((r) => [
    r.productName.substring(0, 35),
    r.stockInicial.toString(),
    r.vendidoIsla1.toString(),
    r.vendidoIsla2.toString(),
    r.vendidoIsla3.toString(),
    r.totalVendido.toString(),
    r.stockFinal.toString(),
    formatUSD(r.totalUSD),
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Producto', 'Stock Ini', 'Isla 1', 'Isla 2', 'Isla 3', 'Total Ven', 'Stock Fin', 'Total $']],
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

  // Station header on first page
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

  // Pump readings
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

  // Biblia
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('BIBLIA', 14, currentY);
  currentY += 5;

  const bibliaData = biblia.map((b) => [
    ISLAND_LABELS[b.islandId], b.operatorName,
    formatNumber(b.litersRef, 2), formatUSD(b.bsInUSD),
    formatUSD(b.usdTotal), formatUSD(b.puntoTotal),
    formatUSD(b.ingresosTotalUSD), formatUSD(b.propinaUSD),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Isla', 'Operador', 'Lit.Ref', 'Bs→$', 'USD', 'PV', 'Ingresos', 'Prop.$']],
    body: bibliaData,
    theme: 'grid',
    headStyles: { fillColor: SECONDARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    styles: { halign: 'center', overflow: 'linebreak' },
    columnStyles: { 1: { halign: 'left' } },
  });

  // Page 2: Cuadre PV + Inventario
  doc.addPage();

  // Re-add header on page 2
  doc.setFontSize(12);
  doc.setTextColor(...SECONDARY_COLOR);
  doc.text(`${stationName} — CUADRE PV - ${opLabel}`, 14, 20);
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_COLOR);
  doc.text(`Fecha: ${shift.date}  |  Tasa BCV: ${formatBs(shift.tasa1)}`, 14, 27);

  const cuadreData = cuadre.map((r) => [
    ISLAND_LABELS[r.islandId],
    formatUSD(r.pvTotalUSD), formatBs(r.pvTotalBs),
    formatUSD(r.pv2TotalUSD), formatBs(r.pv2TotalBs),
  ]);

  autoTable(doc, {
    startY: 35,
    head: [['Isla', 'PV $', 'PV Bs', 'PV2 $', 'PV2 Bs']],
    body: cuadreData,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    styles: { halign: 'center' },
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

  // Footer on all pages
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
