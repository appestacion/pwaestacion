// src/lib/pdfGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatBs, formatUSD, formatNumber } from './formatters.js';
import { usdToBs } from './conversions.js';
import { ISLAND_LABELS } from '../config/constants.js';

// -- Labels para formas de pago (igual a CuadrePV.jsx) --
const PAYMENT_LABELS = {
  punto_de_venta: 'PV',
  efectivo_bs: 'Ef.Bs',
  efectivo_usd: 'Ef.$',
  transferencia: 'Transf.',
  combinado: 'Combinado',
};

// ================================================================
// IDENTIDAD FIJA -- siempre estos valores, sin depender de Firestore
// ================================================================
const ST = {
  name:  'E/S Monta\u00f1a Fresca',
  rif:   'J-30894985-2',
  addr:  'AV. CASANOVA GODOY ZONA INDUSTRIAL, Aragua - Venezuela',
  phone: '0424 3036024',
};

function stName(cfg)  { return cfg?.stationName === 'Estaci\u00f3n' ? ST.name : (cfg?.stationName || ST.name); }
function stRif(cfg)   { return cfg?.stationRif  || ST.rif; }
function stAddr(cfg)  { return cfg?.stationAddress === '' || !cfg?.stationAddress ? ST.addr : (cfg?.stationAddress || ST.addr); }

const RED       = [206, 17, 38];
const BLUE      = [0, 51, 153];
const GREEN     = [46, 125, 50];
const GRAY      = [100, 100, 100];
const SLATE     = [69, 90, 100];
const DARK_GRAY = [136, 136, 136];
const SEC_BG    = [187, 187, 187];
const TOT_BG    = [220, 220, 220];
const YELLOW_BG = [255, 243, 205];
const WARN_TXT  = [133, 100, 4];
const DASH = '\u2014';

// ================================================================
// DIMENSIONES
// ================================================================
const PAGE = {
  letterP: { w: 215.9, h: 279.4 },
  letterL: { w: 279.4, h: 215.9 },
};

// ================================================================
// HELPERS: HEADER, FOOTER, SPACE
// ================================================================
function addPageHeader(doc, title, info, stationConfig, pw, ph) {
  const name  = stName(stationConfig);
  const rif   = stRif(stationConfig);
  const rightEdge = pw - 14;
  doc.setFontSize(14); doc.setTextColor(...RED);
  doc.text(name, 14, 18);
  if (rif) {
    doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text('RIF: ' + rif, 14, 23);
  }
  const ty = rif ? 29 : 24;
  doc.setFontSize(11); doc.setTextColor(...BLUE);
  doc.text(title, 14, ty);
  doc.setFontSize(8); doc.setTextColor(...GRAY);
  const iy = ty + 6;
  if (Array.isArray(info)) {
    info.forEach((line, i) => doc.text(line, 14, iy + i * 4));
  }
  const lineY = iy + (Array.isArray(info) ? info.length * 4 : 0) + 3;
  doc.setDrawColor(...RED); doc.setLineWidth(0.5);
  doc.line(14, lineY, rightEdge, lineY);
  return lineY + 5;
}

function addFooters(doc, name, addr) {
  const pc = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.height || 279.4;
    const pw = doc.internal.pageSize.width || 215.9;
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(addr ? name + ' -- ' + addr : name, 14, ph - 12);
    doc.text('P\u00e1gina ' + i + ' de ' + pc, pw - 14, ph - 12, { align: 'right' });
  }
}

function ensureSpace(doc, needed, currentY, orientation) {
  const ph = orientation === 'l' ? PAGE.letterL.h : PAGE.letterP.h;
  if (currentY + needed > ph - 20) {
    doc.addPage('letter', orientation);
    const dims = orientation === 'l' ? PAGE.letterL : PAGE.letterP;
    doc.internal.pageSize.width = dims.w;
    doc.internal.pageSize.height = dims.h;
    return 20;
  }
  return currentY;
}

function addPageOrientation(doc, orientation) {
  doc.addPage('letter', orientation);
  const dims = orientation === 'l' ? PAGE.letterL : PAGE.letterP;
  doc.internal.pageSize.width = dims.w;
  doc.internal.pageSize.height = dims.h;
}

// ================================================================
// 1. CIERRE DE TURNO -- CARTA VERTICAL, SIN TOTALES, CON UE Bs/UE $ // ================================================================
export function generateCierreCortesPDF(shift, stationConfig, sharedDoc) {
  const ownDoc = !sharedDoc;
  const orientation = 'p';
  const doc  = sharedDoc || new jsPDF(orientation, 'mm', 'letter');
  const name = stName(stationConfig);
  const addr = stAddr(stationConfig);
  const pw = PAGE.letterP.w;
  const ph = PAGE.letterP.h;
  const tasa1 = shift.tasa1 || 1;
  const maxC  = stationConfig?.maxCortes || 12;
  const isNoc = shift.operatorShiftType === 'NOCTURNO';
  const turnoLabel = isNoc ? '2TO Nocturno' : '1TO Diurno';
  const info = [
    'Fecha: ' + shift.date,
    'Turno: ' + turnoLabel,
    'Tasa: ' + formatNumber(tasa1, 2),
  ];
  if (isNoc && shift.tasa2 > 0 && shift.tasa2 !== tasa1) {
    info.push('Tasa 2: ' + formatNumber(shift.tasa2, 2));
  }
  if (!ownDoc) addPageOrientation(doc, orientation);
  let y = addPageHeader(doc, 'CIERRE DE TURNO -- CORTES POR ISLA', info, stationConfig, pw, ph);
  const mL = 10;
  const mR = 10;
  const gap = 4;
  const avail = pw - mL - mR - gap;
  const halfW = avail / 2;
  const xBs = mL;
  const xUsd = mL + halfW + gap;
  const fs = 7;
  const cp = 1;
  const allBsTotal = { v: 0 };
  const allUsdTotal = { v: 0 };
  (shift.islands || []).forEach((island) => {
    const cBs  = (island.cortesBs || []).slice(0, maxC);
    const cUsd = (island.cortesUSD || []).slice(0, maxC);
    const islandBsTotal = (island.bsAdicionales || 0) + cBs.reduce((s, v) => s + v, 0);
    const islandUsdTotal = (island.usdAdicionales || 0) + cUsd.reduce((s, v) => s + v, 0);
    allBsTotal.v += islandBsTotal;
    allUsdTotal.v += islandUsdTotal;
    doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    doc.setFillColor(...SLATE); doc.rect(mL, y - 3.5, pw - mL - mR, 6, 'F');
    doc.text(ISLAND_LABELS[island.islandId] + ' -- Operador: ' + (island.operatorName || DASH), mL + 2, y);
    y += 7;
    const bsRows = cBs.map((v, i) => ['Corte ' + (i + 1), formatBs(v)]);
    bsRows.push([
      { content: 'UE Bs.', styles: { fontStyle: 'bold', fillColor: YELLOW_BG, textColor: WARN_TXT } },
      { content: island.bsAdicionales ? formatBs(island.bsAdicionales) : formatBs(0), styles: { fillColor: YELLOW_BG, textColor: WARN_TXT } },
    ]);
    bsRows.push([
      { content: 'Total Isla:', styles: { fontStyle: 'bold', fontSize: fs, halign: 'left' } },
      { content: formatBs(islandBsTotal), styles: { fontStyle: 'bold', fontSize: fs } },
    ]);
    const usdRows = cUsd.map((v, i) => ['Corte ' + (i + 1), formatUSD(v)]);
    usdRows.push([
      { content: 'UE $', styles: { fontStyle: 'bold', fillColor: YELLOW_BG, textColor: WARN_TXT } },
      { content: island.usdAdicionales ? formatUSD(island.usdAdicionales) : formatUSD(0), styles: { fillColor: YELLOW_BG, textColor: WARN_TXT } },
    ]);
    usdRows.push([
      { content: 'Total Isla:', styles: { fontStyle: 'bold', fontSize: fs, halign: 'left' } },
      { content: formatUSD(islandUsdTotal), styles: { fontStyle: 'bold', fontSize: fs } },
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Corte', 'Bs.']],
      body: bsRows,
      theme: 'grid',
      styles: { fontSize: fs, halign: 'right', cellPadding: cp },
      headStyles: { fillColor: RED, textColor: 255, fontStyle: 'bold', fontSize: fs },
      columnStyles: { 0: { halign: 'left', cellWidth: 30 } },
      margin: { left: xBs, right: pw - xBs - halfW },
      tableWidth: halfW,
    });
    const bsFinalY = doc.lastAutoTable.finalY;
    autoTable(doc, {
      startY: y,
      head: [['Corte', '$']],
      body: usdRows,
      theme: 'grid',
      styles: { fontSize: fs, halign: 'right', cellPadding: cp },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: fs },
      columnStyles: { 0: { halign: 'left', cellWidth: 30 } },
      margin: { left: xUsd, right: pw - xUsd - halfW },
      tableWidth: halfW,
    });
    const usdFinalY = doc.lastAutoTable.finalY;
    y = Math.max(bsFinalY, usdFinalY) + 10;
  });
  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: 'Total Bs. en el turno:', styles: { fontStyle: 'bold', fontSize: 8, halign: 'right' } },
        { content: formatBs(allBsTotal.v), styles: { fontStyle: 'bold', fontSize: 8 } },
      ],
      [
        { content: 'Total $ en el turno:', styles: { fontStyle: 'bold', fontSize: 8, halign: 'right' } },
        { content: formatUSD(allUsdTotal.v), styles: { fontStyle: 'bold', fontSize: 8 } },
      ],
    ],
    theme: 'grid',
    styles: { fontSize: fs, halign: 'center', cellPadding: cp },
    margin: { left: mL, right: mR },
    tableWidth: pw - mL - mR,
  });
  if (ownDoc) addFooters(doc, name, addr);
  return doc;
}

// ================================================================
// 2. REPORTE LECTURA Y RECEPCION -- CARTA HORIZONTAL
// ================================================================
export function generateReportePDF(rd, stationConfig, sharedDoc) {
  const ownDoc = !sharedDoc;
  const orientation = 'l';
  const doc  = sharedDoc || new jsPDF(orientation, 'mm', 'letter');
  const name = stName(stationConfig);
  const addr = stAddr(stationConfig);
  const rif  = stRif(stationConfig);
  const pw = PAGE.letterL.w;
  const ph = PAGE.letterL.h;
  const margin = 14;
  const gap = 4;
  const contentW = pw - margin * 2 - gap * 2;
  const totalFr = 3 + 2 + 3;
  const col1W = contentW * 3 / totalFr;
  const col2W = contentW * 2 / totalFr;
  const col3W = contentW * 3 / totalFr;
  if (!ownDoc) addPageOrientation(doc, orientation);
  doc.setFontSize(14); doc.setTextColor(...RED);
  doc.text(name, margin, 16);
  if (rif) {
    doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text('RIF: ' + rif, margin, 21);
  }
  const ty = rif ? 27 : 22;
  doc.setFontSize(11); doc.setTextColor(...BLUE);
  doc.text('REPORTE LECTURA Y RECEPCION', margin, ty);
  doc.setFontSize(7); doc.setTextColor(...GRAY);
  const iy = ty + 5;
  doc.text('Fecha: ' + rd.selectedDate, margin, iy);
  doc.text('Tasa 1: ' + formatNumber(rd.tasa1, 2), margin + 66, iy);
  if (rd.tasa2 > 0) doc.text('Tasa 2: ' + formatNumber(rd.tasa2, 2), margin + 126, iy);
  const supLabel = rd.is1TS ? '1TS (6AM-2PM)' : '2TS (2PM-10PM)';
  const supText = rd.supervisorName ? 'Supervisor: ' + rd.supervisorName + ' -- ' + supLabel : 'Supervisor: ' + supLabel;
  doc.text(supText, pw - margin, iy, { align: 'right' });
  const lineY = iy + 5;
  doc.setDrawColor(...RED); doc.setLineWidth(0.5);
  doc.line(margin, lineY, pw - margin, lineY);
  const contentStartY = lineY + 5;
  const sectionBanner = (text, x, w, y) => {
    doc.setFontSize(6); doc.setTextColor(0);
    doc.setFillColor(200, 200, 200);
    doc.rect(x, y - 2.5, w, 4, 'F');
    doc.text(text, x + w / 2, y, { align: 'center' });
    return y + 4.5;
  };
  let col1Y = contentStartY;
  let col2Y = contentStartY;
  let col3Y = contentStartY;
  const renderIslandTable = (isl, shift, startX, colWidth, currentY) => {
    const filled = !!shift;
    const totalL = isl.pumps.reduce((s, p) => s + p.litersSold, 0);
    const rows = isl.pumps.map((p) => [
      String(p.pumpNumber),
      filled && !p.empty ? formatNumber(p.initialReading, 0) : DASH,
      filled && !p.empty ? formatNumber(p.finalReading, 0) : DASH,
      filled && !p.empty ? formatNumber(p.litersSold, 0) : DASH,
    ]);
    autoTable(doc, {
      startY: currentY,
      head: [[
        { content: 'ISLA ' + isl.islandId, colSpan: 4, styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
      ], [
        { content: 'Surt.', styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 7 } },
        { content: 'Lect. Inicial', styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 7 } },
        { content: 'Lect. Final', styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 7 } },
        { content: 'Litros', styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 7 } },
      ]],
      body: [
        ...rows.map(r => r.map(v => ({ content: v, styles: { fontSize: 7, textColor: 0 } }))),
        [
          { content: 'Total Litros:', styles: { fontStyle: 'bold', fontSize: 7, halign: 'right', textColor: 0 }, colSpan: 3 },
          { content: filled ? formatNumber(totalL, 0) : DASH, styles: { fontStyle: 'bold', fontSize: 7, textColor: 0 } },
        ],
      ],
      theme: 'grid',
      styles: { halign: 'center', cellPadding: 1.5, textColor: 0 },
      margin: { left: startX, right: pw - startX - colWidth },
      tableWidth: colWidth,
    });
    return doc.lastAutoTable.finalY + 3;
  };
  const renderTankTable = (data, label, totalVal, filled, startY, startX, colWidth) => {
    const tanksCount = data.length;
    const headerRow = [
      { content: '', styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 7, textColor: 0 } },
      ...data.map(tk => ({
        content: 'TQ ' + tk.tankId,
        styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 7, textColor: 0 },
      })),
    ];
    const cmRow = [
      { content: 'CM', styles: { fontStyle: 'bold', fontSize: 7, textColor: 0 } },
      ...data.map(tk => ({
        content: filled ? (tk.cm > 0 ? formatNumber(tk.cm, 1) : DASH) : DASH,
        styles: { fontSize: 7, textColor: 0 },
      })),
    ];
    const litRow = [
      { content: 'Litros', styles: { fontStyle: 'bold', fontSize: 7, textColor: 0 } },
      ...data.map(tk => ({
        content: filled ? (tk.liters > 0 ? formatNumber(tk.liters, 0) : DASH) : DASH,
        styles: { fontSize: 7, textColor: 0 },
      })),
    ];
    const totalRow = [
      { content: 'Total:', styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 7, halign: 'right', textColor: 0 }, colSpan: tanksCount },
      { content: filled ? formatNumber(totalVal, 0) : DASH, styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 7, textColor: 0 } },
    ];
    autoTable(doc, {
      startY,
      head: [[
        { content: label, colSpan: tanksCount + 1, styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
      ]],
      body: [headerRow, cmRow, litRow, totalRow],
      theme: 'grid',
      styles: { halign: 'center', cellPadding: 1.5, textColor: 0 },
      margin: { left: startX, right: pw - startX - colWidth },
      tableWidth: colWidth,
    });
    return doc.lastAutoTable.finalY + 1.5;
  };
  const x1 = margin;
  col1Y = sectionBanner('7:00 AM a 7:00 PM', x1, col1W, col1Y);
  (rd.diurnoIslands || []).forEach(isl => {
    col1Y = renderIslandTable(isl, rd.diurnoShift, x1, col1W, col1Y);
  });
  autoTable(doc, {
    startY: col1Y,
    body: [[
      { content: 'Total 1:', styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7, halign: 'right' } },
      { content: rd.diurnoShift ? formatNumber(rd.diurnoTotal, 0) : DASH, styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
    ]],
    theme: 'grid',
    styles: { halign: 'center', cellPadding: 1.5, textColor: 0 },
    margin: { left: x1, right: pw - x1 - col1W },
    tableWidth: col1W,
  });
  const x2 = margin + col1W + gap;
  col2Y = sectionBanner('7:00 AM a 7:00 PM', x2, col2W, col2Y);
  col2Y = renderTankTable(rd.invInicial, 'INVENTARIO INICIAL', rd.totalInvInicial, !!rd.hasInvInicial, col2Y, x2, col2W);
  col2Y = renderTankTable(rd.antesDesc, 'ANTES DE LA DESCARGA', rd.totalAntes, !!rd.gandola, col2Y, x2, col2W);
  autoTable(doc, {
    startY: col2Y,
    body: [[
      { content: 'Gandola:', styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7, halign: 'right' } },
      { content: rd.gandola ? formatNumber(rd.totalCompartment || 0, 0) : DASH, styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
    ]],
    theme: 'grid',
    styles: { halign: 'center', cellPadding: 1.5, textColor: 0 },
    margin: { left: x2, right: pw - x2 - col2W },
    tableWidth: col2W,
  });
  col2Y = doc.lastAutoTable.finalY + 1.5;
  col2Y = renderTankTable(rd.despDesc, 'DESPUES DE LA DESCARGA', rd.totalDespues, !!rd.gandola, col2Y, x2, col2W);
  col2Y += 3;
  col2Y = sectionBanner('7:00 PM a 7:00 AM', x2, col2W, col2Y);
  col2Y = renderTankTable(rd.invFinal, 'INVENTARIO FINAL', rd.totalInvFinal, !rd.is1TS && !!rd.currentShift, col2Y, x2, col2W);
  const showTotalGeneral = !!rd.nocturnoShiftForDisplay && (rd.diurnoTotal || 0) > 0 && (rd.displayNocturnoTotal || 0) > 0;
  if (showTotalGeneral) {
    autoTable(doc, {
      startY: col2Y,
      body: [[
        { content: 'Total General:', styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7, halign: 'right' } },
        { content: formatNumber((rd.diurnoTotal || 0) + (rd.displayNocturnoTotal || 0), 0) + ' L', styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
      ]],
      theme: 'grid',
      styles: { halign: 'center', cellPadding: 1.5, textColor: 0 },
      margin: { left: x2, right: pw - x2 - col2W },
      tableWidth: col2W,
    });
  }
  const x3 = margin + col1W + gap + col2W + gap;
  col3Y = sectionBanner('7:00 PM a 7:00 AM', x3, col3W, col3Y);
  (rd.displayNocturnoIslands || []).forEach(isl => {
    col3Y = renderIslandTable(isl, rd.nocturnoShiftForDisplay, x3, col3W, col3Y);
  });
  autoTable(doc, {
    startY: col3Y,
    body: [[
      { content: 'Total 2:', styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7, halign: 'right' } },
      { content: rd.nocturnoShiftForDisplay ? formatNumber(rd.displayNocturnoTotal, 0) : DASH, styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
    ]],
    theme: 'grid',
    styles: { halign: 'center', cellPadding: 1.5, textColor: 0 },
    margin: { left: x3, right: pw - x3 - col3W },
    tableWidth: col3W,
  });
  if (ownDoc) addFooters(doc, name, addr);
  return doc;
}

// ================================================================
// 3. BIBLIA -- CARTA VERTICAL
// ================================================================
export function generateBibliaPDF(shift, biblia, totals, stationConfig, sharedDoc) {
  const ownDoc = !sharedDoc;
  const doc  = sharedDoc || new jsPDF('p', 'mm', 'letter');
  const name = stName(stationConfig);
  const addr = stAddr(stationConfig);
  const pw = PAGE.letterP.w;
  const isNoc = shift.operatorShiftType === 'NOCTURNO';
  const turnoLabel = isNoc ? '2TO' : '1TO';
  const tasa1 = shift.tasa1 || 0;
  const tasa2 = shift.tasa2 || 0;
  const precio = stationConfig?.precioLitroUSD || shift.precioLitroUSD || 0.50;
  const hasTasa2 = isNoc && tasa2 > 0 && tasa2 !== tasa1;
  const dayNames = ['domingo', 'lunes', 'martes', 'mi\u00e9rcoles', 'jueves', 'viernes', 's\u00e1bado'];
  const parts = (shift.date || '').split('/');
  const shiftDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
  const dayName = dayNames[shiftDate.getDay()] || '';
  const info = [
    'Fecha: ' + shift.date + '  |  Turno: ' + turnoLabel + ' ' + dayName,
    'Tasa: ' + formatNumber(tasa1, 2),
  ];
  if (hasTasa2) info.push('Tasa 2: ' + formatNumber(tasa2, 2));
  if (!ownDoc) {
    doc.addPage('letter', 'p');
    doc.internal.pageSize.width = PAGE.letterP.w;
    doc.internal.pageSize.height = PAGE.letterP.h;
  }
  let y = addPageHeader(doc, 'BIBLIA -- RESUMEN FINANCIERO', info, stationConfig, pw, PAGE.letterP.h);
  const marginL = 14;
  const marginR = 14;
  const gap = 4;
  const availW = pw - marginL - marginR - gap;
  const colW = availW / 2;
  const xLeft = marginL;
  const xRight = marginL + colW + gap;
  const blocks = biblia.map(b => ({ type: 'isla', data: b }));
  if (totals) blocks.push({ type: 'resumen' });
  const rows = [];
  for (let i = 0; i < blocks.length; i += 2) {
    rows.push({ left: blocks[i], right: blocks[i + 1] || null });
  }
  const totalBs = (totals && totals.totalBs) || 0;
  const totalPropinaBs = (totals && totals.totalPropinaBs) || 0;
  const restoBs = totalBs - totalPropinaBs;
  const bsResumenUSD = tasa1 > 0 ? restoBs / tasa1 : 0;
  const haySobregiro = bsResumenUSD < 0;
  const sobregiroUSD = haySobregiro ? Math.abs(bsResumenUSD) : 0;
  const itemsTotalUSD = (totals && totals.resumenItems || []).reduce((s, item) => s + item.montoUSD, 0);
  const totalResumenUSD = haySobregiro
    ? (totals.totalUsdSinUE + totals.totalPunto + totals.totalUeUSD + itemsTotalUSD)
    : (bsResumenUSD + totals.totalUsdSinUE + totals.totalPunto + totals.totalUeUSD + itemsTotalUSD);
  const totalGastosUSD = (totals && totals.resumenItems || [])
    .filter(function(item) { return item.tipo === 'Gasto'; })
    .reduce(function(s, item) { return s + item.montoUSD; }, 0);
  const netoSinGastosUSD = totalResumenUSD - totalGastosUSD;
  const excedenteUSD = !haySobregiro ? Math.max(0, netoSinGastosUSD - (totals && totals.totalLitersRef || 0)) : 0;
  const excedenteBs = tasa1 > 0 ? excedenteUSD * tasa1 : 0;
  const totalCajaChicaUSD = sobregiroUSD + totalGastosUSD;
  const totalCajaChicaBs = tasa1 > 0 ? totalCajaChicaUSD * tasa1 : 0;
  const totalDolaresAEntregarUSD = (totals && totals.totalUsdSinUE || 0) + (totals && totals.totalUeUSD || 0);
  // ── Total litros vendidos para fila Resumen ──
  const totalLitersSold = precio > 0 ? ((totals && totals.totalLitersRef || 0) / precio) : 0;
  var renderIslaBlock = function(b, startX, startY, columnWidth) {
    var litrosVendidos = precio > 0 ? b.litersRef / precio : 0;
    autoTable(doc, {
      startY: startY,
      head: [[
        { content: 'ISLA ' + b.islandId + '  |  Operador: ' + (b.operatorName || DASH), colSpan: 3, styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 6 } },
      ]],
      body: [
        [
          { content: 'Litros:', styles: { fontStyle: 'bold', fontSize: 6 } },
          { content: litrosVendidos > 0 ? formatNumber(litrosVendidos, 0) + ' L' : '', styles: { fontSize: 6, textColor: [102, 102, 102], fontStyle: 'italic' } },
          { content: b.litersRef > 0 ? formatUSD(b.litersRef) : '', styles: { fontSize: 6, textColor: [102, 102, 102], fontStyle: 'italic' } },
        ],
        [
          { content: 'Bs.:', styles: { fontStyle: 'bold', fontSize: 6 } },
          { content: b.bsTotal > 0 ? formatBs(b.bsTotal) : '', styles: { fontSize: 6 } },
          { content: b.bsInUSD > 0 ? formatUSD(b.bsInUSD) : '', styles: { fontSize: 6 } },
        ],
        [
          { content: '$:', styles: { fontStyle: 'bold', fontSize: 6 } },
          { content: '', styles: { fontSize: 6 } },
          { content: b.usdSinUE > 0 ? formatUSD(b.usdSinUE) : '', styles: { fontSize: 6 } },
        ],
        [
          { content: 'Punto:', styles: { fontStyle: 'bold', fontSize: 6 } },
          { content: '', styles: { fontSize: 6 } },
          { content: b.puntoTotal > 0 ? formatUSD(b.puntoTotal) : '', styles: { fontSize: 6 } },
        ],
        [
          { content: 'UE$:', styles: { fontStyle: 'bold', fontSize: 6 } },
          { content: '', styles: { fontSize: 6 } },
          { content: b.ueUSD > 0 ? formatUSD(b.ueUSD) : '', styles: { fontSize: 6 } },
        ],
        [
          { content: 'Vale(s):', styles: { fontStyle: 'bold', fontSize: 6 } },
          { content: b.valesDescripcion || '', styles: { fontSize: 5, fontStyle: 'italic', textColor: [85, 85, 85] } },
          { content: b.valesMonto > 0 ? formatUSD(b.valesMonto) : '', styles: { fontSize: 6 } },
        ],
        [
          { content: 'Transferencia(s):', styles: { fontStyle: 'bold', fontSize: 6 } },
          { content: b.transferenciaDescripcion || '', styles: { fontSize: 5, fontStyle: 'italic', textColor: [85, 85, 85] } },
          { content: b.transferenciaMonto > 0 ? formatUSD(b.transferenciaMonto) : '', styles: { fontSize: 6 } },
        ],
        [
          { content: 'Propina:', styles: { fontStyle: 'bold', fontSize: 6 } },
          { content: b.propinaBs > 0 ? formatBs(b.propinaBs) : '', styles: { fontSize: 6 } },
          { content: b.propinaUSD > 0 ? formatUSD(b.propinaUSD) : '', styles: { fontSize: 6 } },
        ],
      ],
      theme: 'grid',
      styles: { halign: 'center', cellPadding: 1.5 },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: startX, right: pw - startX - columnWidth },
    });
  };
  var renderResumenBlock = function(startX, startY, columnWidth) {
    if (!totals) return;
    var bodyRows = [
      [
        { content: 'Litros Vendidos:', styles: { fontStyle: 'bold', fontSize: 6 } },
        { content: totalLitersSold > 0 ? formatNumber(totalLitersSold, 2) + ' L' : '', styles: { fontSize: 6, textColor: [102, 102, 102], fontStyle: 'italic' } },
      ],
      [
        { content: 'Bs.:', styles: { fontStyle: 'bold', fontSize: 6 } },
        { content: haySobregiro ? '' : (bsResumenUSD > 0 ? formatUSD(bsResumenUSD) : ''), styles: { fontSize: 6 } },
      ],
      [
        { content: '$:', styles: { fontStyle: 'bold', fontSize: 6 } },
        { content: totals.totalUsdSinUE > 0 ? formatUSD(totals.totalUsdSinUE) : '', styles: { fontSize: 6 } },
      ],
      [
        { content: 'Punto:', styles: { fontStyle: 'bold', fontSize: 6 } },
        { content: totals.totalPunto > 0 ? formatUSD(totals.totalPunto) : '', styles: { fontSize: 6 } },
      ],
      [
        { content: 'UE$:', styles: { fontStyle: 'bold', fontSize: 6 } },
        { content: totals.totalUeUSD > 0 ? formatUSD(totals.totalUeUSD) : '', styles: { fontSize: 6 } },
      ],
    ];
    var items = totals.resumenItems || [];
    items.forEach(function(item) {
      var label = item.concepto ? item.tipo + ': (' + item.concepto + ')' : item.tipo + ':';
      bodyRows.push([
        { content: label, styles: { fontStyle: 'bold', fontSize: 5.5 } },
        { content: item.montoUSD > 0 ? formatUSD(item.montoUSD) : '', styles: { fontSize: 6 } },
      ]);
    });
    bodyRows.push([
      { content: 'Total:', styles: { fillColor: DARK_GRAY, textColor: 255, fontStyle: 'bold', fontSize: 7 } },
      { content: formatUSD(totalResumenUSD), styles: { fillColor: DARK_GRAY, textColor: 255, fontStyle: 'bold', fontSize: 7 } },
    ]);
    autoTable(doc, {
      startY: startY,
      head: [[
        { content: 'RESUMEN', colSpan: 2, styles: { fillColor: DARK_GRAY, textColor: 255, fontStyle: 'bold', fontSize: 7 } },
      ]],
      body: bodyRows,
      theme: 'grid',
      styles: { halign: 'center', cellPadding: 1.5 },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' } },
      margin: { left: startX, right: pw - startX - columnWidth },
    });
    var cardY = doc.lastAutoTable.finalY + 5;
    if (haySobregiro) {
      autoTable(doc, {
        startY: cardY,
        body: [
          [
            { content: 'SOBREGIRO', colSpan: 2, styles: { fillColor: [230, 81, 0], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          ],
          [
            { content: formatUSD(sobregiroUSD), colSpan: 2, styles: { fillColor: [255, 243, 224], textColor: [191, 54, 12], fontStyle: 'bold', fontSize: 11, halign: 'center' } },
          ],
        ],
        theme: 'grid',
        styles: { halign: 'center', cellPadding: 2 },
        margin: { left: startX, right: pw - startX - columnWidth },
      });
      cardY = doc.lastAutoTable.finalY + 3;
    }
    if (totalGastosUSD > 0) {
      autoTable(doc, {
        startY: cardY,
        body: [
          [
            { content: 'TOTAL GASTOS', colSpan: 2, styles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          ],
          [
            { content: formatUSD(totalGastosUSD), colSpan: 2, styles: { fillColor: [227, 242, 253], textColor: [13, 71, 161], fontStyle: 'bold', fontSize: 11, halign: 'center' } },
          ],
        ],
        theme: 'grid',
        styles: { halign: 'center', cellPadding: 2 },
        margin: { left: startX, right: pw - startX - columnWidth },
      });
      cardY = doc.lastAutoTable.finalY + 3;
    }
    if (totalDolaresAEntregarUSD > 0) {
      autoTable(doc, {
        startY: cardY,
        body: [
          [
            { content: 'TOTAL DOLARES A ENTREGAR', colSpan: 2, styles: { fillColor: [123, 31, 162], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          ],
          [
            { content: formatUSD(totalDolaresAEntregarUSD), colSpan: 2, styles: { fillColor: [243, 229, 245], textColor: [74, 20, 140], fontStyle: 'bold', fontSize: 12, halign: 'center' } },
          ],
        ],
        theme: 'grid',
        styles: { halign: 'center', cellPadding: 2 },
        margin: { left: startX, right: pw - startX - columnWidth },
      });
      cardY = doc.lastAutoTable.finalY + 3;
    }
    if (!haySobregiro && bsResumenUSD > 0) {
      autoTable(doc, {
        startY: cardY,
        body: [
          [
            { content: 'TOTAL BOLIVARES A ENTREGAR', colSpan: 2, styles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          ],
          [
            { content: formatUSD(bsResumenUSD), colSpan: 2, styles: { fillColor: [232, 245, 233], textColor: [27, 94, 32], fontStyle: 'bold', fontSize: 12, halign: 'center' } },
          ],
          [
            { content: formatBs(restoBs), colSpan: 2, styles: { fillColor: [232, 245, 233], textColor: [46, 125, 50], fontStyle: 'bold', fontSize: 8, halign: 'center' } },
          ],
        ],
        theme: 'grid',
        styles: { halign: 'center', cellPadding: 2 },
        margin: { left: startX, right: pw - startX - columnWidth },
      });
    } else if (haySobregiro) {
      autoTable(doc, {
        startY: cardY,
        body: [
          [
            { content: 'TOTAL A TOMAR DE RESERVA', colSpan: 2, styles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          ],
          [
            { content: formatUSD(totalCajaChicaUSD), colSpan: 2, styles: { fillColor: [232, 245, 233], textColor: [27, 94, 32], fontStyle: 'bold', fontSize: 12, halign: 'center' } },
          ],
          [
            { content: formatBs(totalCajaChicaBs), colSpan: 2, styles: { fillColor: [232, 245, 233], textColor: [27, 94, 32], fontStyle: 'bold', fontSize: 8, halign: 'center' } },
          ],
          [
            { content: 'Sobregiro: ' + formatUSD(sobregiroUSD), styles: { fillColor: [255, 243, 224], textColor: [230, 81, 0], fontSize: 6 } },
            { content: 'Gastos: ' + formatUSD(totalGastosUSD), styles: { fillColor: [255, 243, 224], textColor: [21, 101, 192], fontSize: 6 } },
          ],
        ],
        theme: 'grid',
        styles: { halign: 'center', cellPadding: 2 },
        margin: { left: startX, right: pw - startX - columnWidth },
      });
    }
  };
  var maxYThisRow = y;
  rows.forEach(function(row) {
    var hasResumenBlock = row.left.type === 'resumen' || (row.right && row.right.type === 'resumen');
    var resumenItemCount = hasResumenBlock ? (totals && totals.resumenItems && totals.resumenItems.length || 0) : 0;
    var itemsExtra = resumenItemCount * 5;
    var cardsExtra = 0;
    if (hasResumenBlock) {
      var numCards = (haySobregiro ? 1 : 0) + (totalGastosUSD > 0 ? 1 : 0) + (totalDolaresAEntregarUSD > 0 ? 1 : 0) + (!haySobregiro && bsResumenUSD > 0 ? 1 : 0) + (haySobregiro ? 1 : 0);
      cardsExtra = numCards > 0 ? numCards * 20 + 5 : 0;
    }
    y = ensureSpace(doc, 50 + itemsExtra + cardsExtra, maxYThisRow);
    if (row.left.type === 'isla') {
      renderIslaBlock(row.left.data, xLeft, y, colW);
    } else {
      renderResumenBlock(xLeft, y, colW);
    }
    if (row.right) {
      if (row.right.type === 'isla') {
        renderIslaBlock(row.right.data, xRight, y, colW);
      } else {
        renderResumenBlock(xRight, y, colW);
      }
    }
    maxYThisRow = doc.lastAutoTable.finalY + 6;
  });
  if (ownDoc) addFooters(doc, name, addr);
  return doc;
}

// ================================================================
// 4. CUADRE PV -- CARTA VERTICAL (igual a pantalla)
// ================================================================
export function generateCuadrePVPDF(shift, cuadre, cuadreTotals, stationConfig, products, sharedDoc) {
  const ownDoc = !sharedDoc;
  const doc  = sharedDoc || new jsPDF('p', 'mm', 'letter');
  const name = stName(stationConfig);
  const addr = stAddr(stationConfig);
  const pw = PAGE.letterP.w;
  const isNoc = shift.operatorShiftType === 'NOCTURNO';
  const turnoLabel = isNoc ? '2TO' : '1TO';
  const tasa1 = shift.tasa1 || 0;
  const tasa2 = shift.tasa2 || 0;
  const hasTasa2 = isNoc && tasa2 > 0;
  const singleTasa = !isNoc;
  const dayNames = ['domingo', 'lunes', 'martes', 'mi\u00e9rcoles', 'jueves', 'viernes', 's\u00e1bado'];
  const parts = (shift.date || '').split('/');
  const shiftDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
  const dayName = dayNames[shiftDate.getDay()] || '';
  const info = [
    'Fecha: ' + shift.date + '  |  Turno: ' + turnoLabel + ' ' + dayName,
    singleTasa
      ? 'Tasa: ' + formatNumber(tasa1, 2)
      : 'Tasa: ' + formatNumber(tasa1, 2) + (hasTasa2 ? '  |  Tasa 2: ' + formatNumber(tasa2, 2) : ''),
  ];
  if (!ownDoc) {
    doc.addPage('letter', 'p');
    doc.internal.pageSize.width = PAGE.letterP.w;
    doc.internal.pageSize.height = PAGE.letterP.h;
  }
  let y = addPageHeader(doc, 'CUADRE PUNTO DE VENTA', info, stationConfig, pw, PAGE.letterP.h);
  const body = [];
  body.push([
    { content: 'Isla', styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 8, cellWidth: 55 } },
    { content: 'Bs.', styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 8 } },
    { content: '$', styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 8 } },
    { content: 'Litros', styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 8 } },
  ]);
  cuadre.forEach(function(r) {
    body.push([
      { content: ISLAND_LABELS[r.islandId], colSpan: 4, styles: { fillColor: [153, 153, 153], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
    ]);
    if (singleTasa) {
      body.push([
        { content: '(' + formatBs(tasa1) + ')', styles: { fontStyle: 'bold', fontSize: 8, cellWidth: 55 } },
        { content: formatBs(r.pvTotalBs), styles: { fontSize: 8 } },
        { content: formatUSD(r.pvTotalUSD), styles: { fontSize: 8 } },
        { content: formatNumber(r.pvUSDinLiters, 2), styles: { fontSize: 8, fontStyle: 'bold' } },
      ]);
    } else {
      body.push([
        { content: 'Tasa 1 (' + formatBs(tasa1) + ')', styles: { fontStyle: 'bold', fontSize: 8, cellWidth: 55 } },
        { content: formatBs(r.pvTotalBs), styles: { fontSize: 8 } },
        { content: formatUSD(r.pvTotalUSD), styles: { fontSize: 8 } },
        { content: formatNumber(r.pvUSDinLiters, 2), styles: { fontSize: 8, fontStyle: 'bold' } },
      ]);
      if (hasTasa2) {
        body.push([
          { content: 'Tasa 2 (' + formatBs(tasa2) + ')', styles: { fontStyle: 'bold', fontSize: 8, cellWidth: 55 } },
          { content: formatBs(r.pv2TotalBs), styles: { fontSize: 8 } },
          { content: formatUSD(r.pv2TotalUSD), styles: { fontSize: 8 } },
          { content: formatNumber(r.pv2USDinLiters, 2), styles: { fontSize: 8, fontStyle: 'bold' } },
        ]);
      }
    }
  });
  if (cuadreTotals) {
    if (singleTasa) {
      body.push([
        { content: 'Total Turno', styles: { fillColor: DARK_GRAY, textColor: 255, fontStyle: 'bold', fontSize: 9, cellWidth: 55 } },
        { content: formatBs(cuadreTotals.totalPVBs), styles: { fillColor: DARK_GRAY, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
        { content: formatUSD(cuadreTotals.totalPVUSD), styles: { fillColor: DARK_GRAY, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
        { content: formatNumber(cuadreTotals.totalPVLiters, 2) + ' L', styles: { fillColor: DARK_GRAY, textColor: [200, 230, 201], fontStyle: 'bold', fontSize: 9 } },
      ]);
    } else {
      body.push([
        { content: 'Total Tasa 1', styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 8, cellWidth: 55 } },
        { content: formatBs(cuadreTotals.totalPVBs), styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 8 } },
        { content: formatUSD(cuadreTotals.totalPVUSD), styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 8 } },
        { content: formatNumber(cuadreTotals.totalPVLiters, 2) + ' L', styles: { fillColor: TOT_BG, fontStyle: 'bold', fontSize: 8 } },
      ]);
      if (hasTasa2) {
        body.push([
          { content: 'Total Tasa 2', styles: { fillColor: [227, 242, 253], fontStyle: 'bold', fontSize: 8, cellWidth: 55 } },
          { content: formatBs(cuadreTotals.totalPV2Bs), styles: { fillColor: [227, 242, 253], fontStyle: 'bold', fontSize: 8 } },
          { content: formatUSD(cuadreTotals.totalPV2USD), styles: { fillColor: [227, 242, 253], fontStyle: 'bold', fontSize: 8 } },
          { content: formatNumber(cuadreTotals.totalPV2Liters, 2) + ' L', styles: { fillColor: [227, 242, 253], fontStyle: 'bold', fontSize: 8 } },
        ]);
      }
      body.push([
        { content: 'Total Turno', styles: { fillColor: DARK_GRAY, textColor: 255, fontStyle: 'bold', fontSize: 9, cellWidth: 55 } },
        { content: formatBs(cuadreTotals.grandTotalBs), styles: { fillColor: DARK_GRAY, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
        { content: formatUSD(cuadreTotals.grandTotalUSD), styles: { fillColor: DARK_GRAY, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
        { content: formatNumber(cuadreTotals.grandTotalLiters, 2) + ' L', styles: { fillColor: DARK_GRAY, textColor: [200, 230, 201], fontStyle: 'bold', fontSize: 9 } },
      ]);
    }
  }
  autoTable(doc, {
    startY: y,
    body: body,
    theme: 'grid',
    styles: { halign: 'center', cellPadding: 2 },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });
  var hasDetails = shift.islands && shift.islands.some(function(island) {
    return (island.vales && island.vales.length > 0) || (island.transferencias && island.transferencias.length > 0) || (island.productsSold && island.productsSold.length > 0);
  });
  if (hasDetails && products) {
    y = doc.lastAutoTable.finalY + 10;
    (shift.islands || []).forEach(function(island) {
      var vales = island.vales || [];
      var transferencias = island.transferencias || [];
      var productsSold = island.productsSold || [];
      if (vales.length === 0 && transferencias.length === 0 && productsSold.length === 0) return;
      var rowCount = 1
        + (vales.length > 0 ? 1 + vales.length + (vales.length > 1 ? 1 : 0) : 0)
        + (transferencias.length > 0 ? 1 + transferencias.length + (transferencias.length > 1 ? 1 : 0) : 0)
        + (productsSold.length > 0 ? 1 + productsSold.length : 0);
      var neededHeight = rowCount * 6 + 4;
      y = ensureSpace(doc, neededHeight, y);
      var islandBody = [];
      islandBody.push([
        { content: ISLAND_LABELS[island.islandId], colSpan: 3, styles: { fillColor: [153, 153, 153], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
      ]);
      if (vales.length > 0) {
        islandBody.push([
          { content: 'Vales', colSpan: 3, styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
        ]);
        vales.forEach(function(v, i) {
          islandBody.push([
            { content: v.descripcion || 'Vale ' + (i + 1), styles: { fontSize: 7, fontStyle: 'italic' } },
            { content: formatUSD(v.monto || 0), styles: { fontSize: 7 }, colSpan: 2 },
          ]);
        });
        if (vales.length > 1) {
          var totalV = vales.reduce(function(s, v) { return s + (v.monto || 0); }, 0);
          islandBody.push([
            { content: 'Total Vales', styles: { fontStyle: 'bold', fontSize: 7 } },
            { content: formatUSD(totalV), styles: { fontStyle: 'bold', fontSize: 7 }, colSpan: 2 },
          ]);
        }
      }
      if (transferencias.length > 0) {
        islandBody.push([
          { content: 'Transferencias', colSpan: 3, styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
        ]);
        transferencias.forEach(function(t, i) {
          islandBody.push([
            { content: t.descripcion || 'Transf. ' + (i + 1), styles: { fontSize: 7, fontStyle: 'italic' } },
            { content: formatUSD(t.monto || 0), styles: { fontSize: 7 }, colSpan: 2 },
          ]);
        });
        if (transferencias.length > 1) {
          var totalT = transferencias.reduce(function(s, t) { return s + (t.monto || 0); }, 0);
          islandBody.push([
            { content: 'Total Transferencias', styles: { fontStyle: 'bold', fontSize: 7 } },
            { content: formatUSD(totalT), styles: { fontStyle: 'bold', fontSize: 7 }, colSpan: 2 },
          ]);
        }
      }
      if (productsSold.length > 0) {
        islandBody.push([
          { content: 'Producto', styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
          { content: 'Cant.', styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
          { content: 'Total', styles: { fillColor: SEC_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
        ]);
        productsSold.forEach(function(ps) {
          var prod = (products || []).find(function(p) { return p.name === ps.productName; });
          var price = (prod && prod.priceUSD) || 0;
          var total = price * ps.quantity;
          var method = ps.paymentMethod || 'punto_de_venta';
          var isCombined = method === 'combinado';
          var paymentDetail = '';
          if (isCombined && ps.paymentBreakdown && ps.paymentBreakdown.length > 0) {
            paymentDetail = ps.paymentBreakdown
              .filter(function(bd) { return bd.amountUSD > 0; })
              .map(function(bd) {
                var bdLabel = PAYMENT_LABELS[bd.method] || bd.method;
                var bdShowBs = bd.method === 'punto_de_venta' || bd.method === 'efectivo_bs' || bd.method === 'transferencia';
                if (bdShowBs) {
                  return bdLabel + ': ' + formatUSD(bd.amountUSD) + ' = ' + formatBs(usdToBs(bd.amountUSD, tasa1));
                }
                return bdLabel + ': ' + formatUSD(bd.amountUSD);
              })
              .join(' | ');
          } else {
            var methodLabel = PAYMENT_LABELS[method] || method;
            var showBs = method === 'punto_de_venta' || method === 'efectivo_bs' || method === 'transferencia';
            if (showBs) {
              paymentDetail = methodLabel + ': ' + formatUSD(total) + ' = ' + formatBs(usdToBs(total, tasa1));
            } else {
              paymentDetail = '(' + methodLabel + ')';
            }
            // ★ Anexar titular de la transferencia al detalle del producto
            if (method === 'transferencia' && ps.transferenciaTitular) {
              paymentDetail += ' — Titular: ' + ps.transferenciaTitular;
            }
          }
          islandBody.push([
            {
              content: ps.productName + ', ' + paymentDetail,
              styles: { fontSize: 7 },
              _isProductCell: true,
              _productName: ps.productName + ', ',
              _paymentDetail: paymentDetail,
            },
            { content: String(ps.quantity), styles: { fontSize: 7 } },
            { content: formatUSD(total), styles: { fontSize: 7, fontStyle: 'bold' } },
          ]);
        });
      }
      autoTable(doc, {
        startY: y,
        body: islandBody,
        theme: 'grid',
        styles: { halign: 'center', cellPadding: 1.5 },
        columnStyles: { 0: { halign: 'left' } },
        margin: { left: 14, right: 14 },
        willDrawCell: function(data) {
          if (data.cell.raw && data.cell.raw._isProductCell) {
            data.cell.text = [];
          }
        },
        didDrawCell: function(data) {
          if (data.cell.raw && data.cell.raw._isProductCell) {
            var cell = data.cell;
            var x = cell.x + cell.padding('left');
            var yCenter = cell.y + cell.height / 2;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(cell.raw._productName, x, yCenter, { baseline: 'middle' });
            var nameW = doc.getTextWidth(cell.raw._productName);
            doc.setFont('helvetica', 'normal');
            doc.text(cell.raw._paymentDetail, x + nameW, yCenter, { baseline: 'middle' });
          }
        },
      });
      y = doc.lastAutoTable.finalY + 5;
    });
  }
  if (ownDoc) addFooters(doc, name, addr);
  return doc;
}

// ================================================================
// 5. INVENTARIO POR ISLAS -- CARTA VERTICAL
// ================================================================
export function generateInventarioIslasPDF(shift, islandInventoryData, islandIds, stationConfig, sharedDoc) {
  const ownDoc = !sharedDoc;
  const doc  = sharedDoc || new jsPDF('p', 'mm', 'letter');
  const name = stName(stationConfig);
  const addr = stAddr(stationConfig);
  const pw = PAGE.letterP.w;
  const hasActiveShift = !!shift;
  const isNoc = shift && shift.operatorShiftType === 'NOCTURNO';
  const turnoLabel = shift ? (isNoc ? '2TO' : '1TO') : DASH;
  const shiftDate = (shift && shift.date) || '';
  const dayNames = ['domingo', 'lunes', 'martes', 'mi\u00e9rcoles', 'jueves', 'viernes', 's\u00e1bado'];
  const parts = (shiftDate || '').split('/');
  const d = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
  const dayName = dayNames[d.getDay()] || '';
  const info = [
    'Fecha: ' + shiftDate + (hasActiveShift ? '  |  Turno: ' + turnoLabel + ' ' + dayName : '  |  Sin turno activo'),
  ];
  if (!ownDoc) {
    doc.addPage('letter', 'p');
    doc.internal.pageSize.width = PAGE.letterP.w;
    doc.internal.pageSize.height = PAGE.letterP.h;
  }
  let y = addPageHeader(doc, 'INVENTARIO POR ISLAS', info, stationConfig, pw, PAGE.letterP.h);
  const prodW = 65;
  const islandW = pw - 28 - prodW;
  const subColW = islandW / (islandIds.length * 3);
  const headerRow1 = [
    { content: 'Producto', styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 } },
  ];
  const headerRow2 = [
    { content: '', styles: { fillColor: TOT_BG, textColor: 0, fontSize: 7 } },
  ];
  islandIds.forEach(function(id) {
    headerRow1.push({
      content: ISLAND_LABELS[id],
      colSpan: 3,
      styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 7 },
    });
    headerRow2.push(
      { content: 'En Isla', styles: { fillColor: TOT_BG, textColor: 0, fontSize: 6 } },
      { content: hasActiveShift ? 'Vendido' : DASH, styles: { fillColor: TOT_BG, textColor: 0, fontSize: 6 } },
      { content: hasActiveShift ? 'Quedan' : 'Stock', styles: { fillColor: TOT_BG, textColor: 0, fontSize: 6 } },
    );
  });
  const dataRows = [];
  islandInventoryData.forEach(function(row) {
    var worstStatus = 'empty';
    islandIds.forEach(function(id) {
      var dd = row.perIsland[id];
      if (!dd) return;
      if (dd.islStock <= 0) return;
      if (dd.quedan <= 0) worstStatus = 'critical';
      else if (dd.quedan <= 3 && worstStatus !== 'critical') worstStatus = 'low';
      else if (worstStatus === 'empty') worstStatus = 'normal';
    });
    var productCell = {
      content: row.productName,
      styles: {
        fontStyle: 'bold', fontSize: 7.5, halign: 'left', textColor: 0, cellWidth: 'auto',
      },
    };
    var islandCells = [];
    islandIds.forEach(function(id) {
      var dd = row.perIsland[id] || { islStock: 0, sold: 0, quedan: 0 };
      islandCells.push(
        { content: String(dd.islStock || ''), styles: { fontSize: 10, textColor: 0 } },
        { content: hasActiveShift ? String(dd.sold || '') : DASH, styles: { fontSize: 10, textColor: 0 } },
        { content: hasActiveShift ? String(dd.quedan) : (dd.islStock > 0 ? String(dd.islStock) : ''), styles: { fontSize: 10, fontStyle: 'bold', textColor: 0, fillColor: TOT_BG } },
      );
    });
    dataRows.push([productCell].concat(islandCells));
  });
  var totalCells = [
    { content: 'Total', styles: { fillColor: TOT_BG, textColor: 0, fontStyle: 'bold', fontSize: 10 } },
  ];
  islandIds.forEach(function(id) {
    var islStock = 0, sold = 0, quedan = 0;
    islandInventoryData.forEach(function(r) {
      var dd = r.perIsland[id] || { islStock: 0, sold: 0, quedan: 0 };
      islStock += dd.islStock;
      sold += dd.sold;
      quedan += dd.quedan;
    });
    totalCells.push(
      { content: String(islStock), styles: { fillColor: TOT_BG, textColor: 0, fontSize: 10 } },
      { content: hasActiveShift ? String(sold) : DASH, styles: { fillColor: TOT_BG, textColor: 0, fontSize: 10 } },
      { content: hasActiveShift ? String(quedan) : String(islStock), styles: { fillColor: TOT_BG, textColor: 0, fontSize: 10, fontStyle: 'bold' } },
    );
  });
  dataRows.push(totalCells);
  autoTable(doc, {
    startY: y,
    head: [headerRow1, headerRow2],
    body: dataRows,
    theme: 'grid',
    styles: { halign: 'center', cellPadding: 0.5, fontSize: 10, textColor: 0 },
    columnStyles: { 0: { cellWidth: prodW, halign: 'left', overflow: 'visible' } },
    margin: { left: 14, right: 14 },
  });
  if (ownDoc) addFooters(doc, name, addr);
  return doc;
}

// ================================================================
// 6. REPORTE COMPLETO -- TODOS LOS PDFs EN UNO SOLO
// ================================================================
export function generateAllInOnePDF(opts) {
  var shift = opts.shift;
  var reporteData = opts.reporteData;
  var biblia = opts.biblia;
  var bibliaTotals = opts.bibliaTotals;
  var cuadre = opts.cuadre;
  var cuadreTotals = opts.cuadreTotals;
  var islandInventoryData = opts.islandInventoryData;
  var islandIds = opts.islandIds;
  var config = opts.config;
  var products = opts.products;
  var doc = new jsPDF('p', 'mm', 'letter');
  var name = stName(config);
  var addr = stAddr(config);
  var rif  = stRif(config);
  var pw = PAGE.letterP.w;
  doc.setFontSize(18); doc.setTextColor(...RED);
  doc.text(name, pw / 2, 60, { align: 'center' });
  if (rif) {
    doc.setFontSize(9); doc.setTextColor(...GRAY);
    doc.text('RIF: ' + rif, pw / 2, 68, { align: 'center' });
  }
  doc.setDrawColor(...RED); doc.setLineWidth(1);
  doc.line(60, 75, pw - 60, 75);
  doc.setFontSize(22); doc.setTextColor(...BLUE);
  doc.text('REPORTE COMPLETO', pw / 2, 90, { align: 'center' });
  doc.setFontSize(10); doc.setTextColor(...GRAY);
  doc.text('Fecha: ' + (shift && shift.date || DASH), pw / 2, 105, { align: 'center' });
  var isNoc = shift && shift.operatorShiftType === 'NOCTURNO';
  var turnoLabel = isNoc ? '2TO Nocturno' : '1TO Diurno';
  doc.text('Turno: ' + turnoLabel, pw / 2, 112, { align: 'center' });
  doc.setFontSize(9); doc.setTextColor(...SLATE);
  var supLbl = reporteData && reporteData.is1TS ? '1TS (6AM-2PM)' : '2TS (2PM-10PM)';
  var supName = (reporteData && reporteData.supervisorName) || DASH;
  doc.text('Supervisor: ' + supName + ' -- ' + supLbl, pw / 2, 119, { align: 'center' });
  var tasaY = 127;
  doc.setFontSize(8);
  doc.text('Tasa 1: ' + formatNumber((shift && shift.tasa1) || 0, 2), pw / 2, tasaY, { align: 'center' });
  if (shift && shift.tasa2 > 0 && shift.tasa2 !== shift.tasa1) {
    doc.text('Tasa 2: ' + formatNumber(shift.tasa2, 2), pw / 2, tasaY + 5, { align: 'center' });
  }
  var genY = (shift && shift.tasa2 > 0 && shift.tasa2 !== shift.tasa1) ? tasaY + 13 : tasaY + 8;
  doc.setFontSize(7); doc.setTextColor(...GRAY);
  doc.text('Generado: ' + new Date().toLocaleString('es-VE'), pw / 2, genY, { align: 'center' });
  var yIdx = 160;
  doc.setFontSize(10); doc.setTextColor(...SLATE); doc.setFont(undefined, 'bold');
  doc.text('Contenido:', 14, yIdx);
  yIdx += 8;
  doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(...GRAY);
  var sections = [];
  if (shift) sections.push('1. Cierre de Turno -- Cortes por Isla');
  if (reporteData) sections.push('2. Reporte Lectura y Recepcion');
  if (shift && biblia && biblia.length > 0) sections.push('3. Biblia -- Resumen Financiero');
  if (shift && cuadre && cuadre.length > 0) sections.push('4. Cuadre Punto de Venta');
  sections.push('5. Inventario por Islas');
  sections.forEach(function(sec) {
    doc.text(sec, 20, yIdx);
    yIdx += 6;
  });
  if (shift) {
    generateCierreCortesPDF(shift, config, doc);
  }
  if (reporteData) {
    generateReportePDF(reporteData, config, doc);
  }
  if (shift && biblia && biblia.length > 0 && bibliaTotals) {
    generateBibliaPDF(shift, biblia, bibliaTotals, config, doc);
  }
  if (shift && cuadre && cuadre.length > 0 && cuadreTotals) {
    generateCuadrePVPDF(shift, cuadre, cuadreTotals, config, products, doc);
  }
  generateInventarioIslasPDF(shift, islandInventoryData, islandIds, config, doc);
  addFooters(doc, name, addr);
  return doc;
}

// ================================================================
// 7. HELPERS EXPORTADOS
// ================================================================
export function downloadBlob(doc, filename) {
  doc.save(filename);
}

export function printBlob(doc) {
  var blob = doc.output('blob');
  var url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function getPdfBlob(doc) {
  return doc.output('blob');
}

export function safeFilename(base) {
  return (base || 'E/S Montana Fresca').replace(/[^a-zA-Z0-9 ]/g, '').replace(/ +/g, '_');
}