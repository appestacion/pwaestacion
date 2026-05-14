// src/pages/supervisor/GenerarPDF.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import ShareIcon from '@mui/icons-material/Share';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DescriptionIcon from '@mui/icons-material/Description';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useProductStore } from '../../store/useProductStore.js';
import { useInventoryStore } from '../../store/useInventoryStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { useGandolaStore } from '../../store/useGandolaStore.js';
import { calculateBiblia, calculateBibliaTotals, calculateCuadrePV, calculateCuadrePVTotals } from '../../lib/calculations.js';
import { getVenezuelaDateString, formatNumber } from '../../lib/formatters.js';
import { cmToLiters } from '../../lib/conversions.js';
import { ISLAND_LABELS, SHIFT_LABELS, SUPERVISOR_SHIFT_LABELS, CATEGORY_ORDER } from '../../config/constants.js';
import {
  generateCierreCortesPDF,
  generateReportePDF,
  generateBibliaPDF,
  generateCuadrePVPDF,
  generateInventarioIslasPDF,
  generateAllInOnePDF,
  downloadBlob,
  printBlob,
  getPdfBlob,
  safeFilename,
} from '../../lib/pdfGenerator.js';
import { enqueueSnackbar } from 'notistack';

// ── Configuración de cada PDF ──
const PDF_CARDS = [
  {
    key: 'cierre',
    title: 'Cierre de Turno',
    desc: 'Cortes en Bolívares y Dólares por isla',
    icon: ReceiptLongIcon,
    color: '#CE1126',
    requiresShift: true,
  },
  {
    key: 'reporte',
    title: 'Reporte Lectura y Recepción',
    desc: 'Lecturas de surtidores, tanques y gandola del día',
    icon: DescriptionIcon,
    color: '#003399',
    requiresShift: false,
  },
  {
    key: 'biblia',
    title: 'Biblia',
    desc: 'Resumen financiero por isla con propinas',
    icon: MenuBookIcon,
    color: '#2E7D32',
    requiresShift: true,
  },
  {
    key: 'cuadre',
    title: 'Cuadre Punto de Venta',
    desc: 'Desglose de PV por isla con tasas',
    icon: PointOfSaleIcon,
    color: '#E65100',
    requiresShift: true,
  },
  {
    key: 'inventario',
    title: 'Inventario por Islas',
    desc: 'Stock, ventas y existencia por isla',
    icon: InventoryIcon,
    color: '#455A64',
    requiresShift: false,
  },
];

// ── WhatsApp sharing helper ──
async function shareViaWhatsApp(doc, filename) {
  try {
    const blob = getPdfBlob(doc);
    const file = new File([blob], filename, { type: 'application/pdf' });

    // Intentar Web Share API (móvil)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
        text: `Reporte: ${filename}`,
      });
      enqueueSnackbar({ message: 'Compartido correctamente', variant: 'success' });
      return true;
    }
  } catch (err) {
    if (err.name === 'AbortError') return true; // Usuario canceló
  }

  // Fallback: descargar archivo
  downloadBlob(doc, filename);
  enqueueSnackbar({
    message: 'PDF descargado. Ábrelo y compártelo por WhatsApp manualmente.',
    variant: 'info',
    autoHideDuration: 5000,
  });
  return true;
}

export default function GenerarPDF() {
  const { currentShift, shiftsHistory, loadCurrentShift, loadShiftsHistory, loadShiftsByDate } = useCierreStore();
  const { products, loadProducts } = useProductStore();
  const { stock, islandStock, loadStock, loadIslandStock } = useInventoryStore();
  const config = useConfigStore((s) => s.config);
  const { receptionsHistory, loadReceptionsHistory } = useGandolaStore();

  const [dayShifts, setDayShifts] = useState([]);
  const [loadingReporte, setLoadingReporte] = useState(true);
  const [generating, setGenerating] = useState(null); // key del PDF que se está generando
  const [sharing, setSharing] = useState(null); // key del PDF que se está compartiendo

  // ── Cargar datos iniciales ──
  useEffect(() => {
    loadCurrentShift();
    loadProducts();
    loadStock();
    loadIslandStock();
    loadShiftsHistory();
    loadReceptionsHistory();
  }, [loadCurrentShift, loadProducts, loadStock, loadIslandStock, loadShiftsHistory, loadReceptionsHistory]);

  // ── Cargar turnos del día (para Reporte) ──
  useEffect(() => {
    const loadDayShifts = async () => {
      const date = currentShift?.date || getVenezuelaDateString();
      setLoadingReporte(true);
      try {
        const found = await loadShiftsByDate(date);
        let all = [...(found || [])];
        if (currentShift && currentShift.date === date && currentShift.status === 'en_progreso') {
          if (!all.find(sh => sh.id === currentShift.id)) all = [...all, currentShift];
        }
        setDayShifts(all);
      } catch (err) {
        console.error('Error cargando turnos del día:', err);
      } finally {
        setLoadingReporte(false);
      }
    };
    if (currentShift?.date || true) loadDayShifts();
  }, [currentShift, loadShiftsByDate]);

  // ── Cálculos: Biblia ──
  const biblia = useMemo(() => {
    if (!currentShift) return [];
    return calculateBiblia(currentShift);
  }, [currentShift]);

  const bibliaTotals = useMemo(() => {
    if (biblia.length === 0) return null;
    return calculateBibliaTotals(biblia, currentShift);
  }, [biblia, currentShift]);

  // ── Cálculos: Cuadre PV ──
  const cuadre = useMemo(() => {
    if (!currentShift) return [];
    return calculateCuadrePV(currentShift);
  }, [currentShift]);

  const cuadreTotals = useMemo(() => {
    if (!currentShift || cuadre.length === 0) return null;
    return calculateCuadrePVTotals(cuadre, currentShift.tasa1, currentShift.tasa2);
  }, [currentShift, cuadre]);

  // ── Cálculos: Inventario por islas ──
  const islandCount = config.islandsCount || 3;
  const islandIds = useMemo(() => Array.from({ length: islandCount }, (_, i) => i + 1), [islandCount]);

  const activeProducts = useMemo(() => {
    return products
      .filter((p) => p.active)
      .sort((a, b) => {
        const catA = CATEGORY_ORDER.indexOf(a.category ?? 'otro');
        const catB = CATEGORY_ORDER.indexOf(b.category ?? 'otro');
        if (catA !== catB) return catA - catB;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [products]);

  const islandsSold = useMemo(() => {
    if (!currentShift) return {};
    const sold = {};
    currentShift.islands.forEach((i) => { sold[i.islandId] = i.productsSold || []; });
    return sold;
  }, [currentShift]);

  const islandInventoryData = useMemo(() => {
    return activeProducts.map((prod) => {
      const generalQty = stock[prod.name] || 0;
      const perIsland = {};
      let totalEnIslas = 0;
      let totalVendido = 0;
      islandIds.forEach((iid) => {
        const islStock = islandStock[String(iid)]?.[prod.name] || 0;
        const sold = (islandsSold[iid] || []).reduce((s, p) => p.productName === prod.name ? s + (p.quantity || 0) : s, 0);
        const quedan = islStock - sold;
        perIsland[iid] = { islStock, sold, quedan };
        totalEnIslas += islStock;
        totalVendido += sold;
      });
      return { productName: prod.name, generalQty, totalEnIslas, totalVendido, totalQuedan: totalEnIslas - totalVendido, perIsland };
    });
  }, [activeProducts, stock, islandStock, islandsSold, islandIds]);

  // ── Cálculos: Reporte (igual lógica que ReporteLecturaRecepcion.jsx) ──
  const reporteData = useMemo(() => {
    if (dayShifts.length === 0) return null;

    const selectedDate = currentShift?.date || getVenezuelaDateString();
    const supervisorType = currentShift?.supervisorShiftType || 'PM';
    const is1TS = supervisorType === 'AM';
    const tanksCount = config.tanksCount || 3;

    const diurnoShift = dayShifts.find(sh => sh.operatorShiftType === 'DIURNO');
    const nocturnoShift = dayShifts.find(sh => sh.operatorShiftType === 'NOCTURNO');

    // Agrupar surtidores por isla
    const getIslandsWithPumps = (shift) => {
      const map = {};
      for (let i = 1; i <= islandCount; i++) map[i] = { islandId: i, pumps: [] };
      if (shift?.pumpReadings) {
        shift.pumpReadings.forEach(r => {
          if (map[r.islandId]) {
            map[r.islandId].pumps.push({
              pumpNumber: r.pumpNumber,
              initialReading: r.initialReading || 0,
              finalReading: r.finalReading || 0,
              litersSold: r.litersSold || 0,
            });
          }
        });
      }
      Object.values(map).forEach(isl => {
        isl.pumps.sort((a, b) => a.pumpNumber - b.pumpNumber);
        while (isl.pumps.length < 2) {
          isl.pumps.push({ pumpNumber: isl.pumps.length + 1, initialReading: 0, finalReading: 0, litersSold: 0, empty: true });
        }
      });
      return Object.values(map);
    };

    const diurnoIslands = getIslandsWithPumps(diurnoShift);
    const nocturnoIslands = getIslandsWithPumps(nocturnoShift);
    const diurnoTotal = diurnoIslands.reduce((s, i) => s + i.pumps.reduce((ps, p) => ps + p.litersSold, 0), 0);

    // Display nocturno según tipo de supervisor
    const displayNocturnoIslands = is1TS
      ? nocturnoIslands.map(nIsl => {
          const dIsl = diurnoIslands.find(d => d.islandId === nIsl.islandId);
          return {
            ...nIsl,
            pumps: nIsl.pumps.map((p, idx) => {
              const dPump = dIsl?.pumps?.[idx];
              if (dPump && !dPump.empty && !p.empty) {
                return { ...p, initialReading: dPump.finalReading, litersSold: Math.max(0, p.finalReading - dPump.finalReading) };
              }
              return p;
            }),
          };
        })
      : nocturnoIslands.map(nIsl => ({
          ...nIsl,
          pumps: nIsl.pumps.map(p => ({ ...p, initialReading: 0, finalReading: 0, litersSold: 0, empty: true })),
        }));

    const displayNocturnoTotal = displayNocturnoIslands.reduce((s, i) => s + i.pumps.reduce((ps, p) => ps + p.litersSold, 0), 0);
    const nocturnoShiftForDisplay = is1TS ? nocturnoShift : null;

    // Tanques
    const getTankRows = (source, key) => Array.from({ length: tanksCount }, (_, i) => {
      const tankId = i + 1;
      const tr = source?.tankReadings?.find(r => r.tankId === tankId);
      const cm = tr ? (tr[key] || 0) : 0;
      return { tankId, cm, liters: cmToLiters(cm) };
    });

    const gandola = (() => {
      const fromHistory = receptionsHistory.find(r => r.date === selectedDate);
      return fromHistory || null;
    })();

    const invInicial = getTankRows(is1TS ? currentShift : null, 'cm');
    const antesDesc = getTankRows(gandola, 'cmBefore');
    const despDesc = getTankRows(gandola, 'cmAfter');
    const invFinal = getTankRows(!is1TS ? currentShift : null, 'cm');

    const totalInvInicial = invInicial.reduce((s, tk) => s + tk.liters, 0);
    const totalAntes = antesDesc.reduce((s, tk) => s + tk.liters, 0);
    const totalDespues = despDesc.reduce((s, tk) => s + tk.liters, 0);
    const totalInvFinal = invFinal.reduce((s, tk) => s + tk.liters, 0);
    const totalGandola = gandola?.tankReadings?.reduce((s, tk) => s + (tk.litersDifference || 0), 0) || 0;
    const totalCompartment = gandola
      ? (gandola.compartment1Liters || 0) + (gandola.compartment2Liters || 0) + (gandola.compartment3Liters || 0)
      : 0;

    const tasa1 = diurnoShift?.tasa1 || nocturnoShift?.tasa1 || 0;
    const tasa2 = nocturnoShift?.tasa2 || 0;

    return {
      selectedDate, is1TS, tasa1, tasa2,
      diurnoIslands, nocturnoIslands,
      diurnoShift, nocturnoShift,
      diurnoTotal, nocturnoTotal: displayNocturnoTotal,
      displayNocturnoIslands, displayNocturnoTotal,
      nocturnoShiftForDisplay,
      invInicial, antesDesc, despDesc, invFinal,
      totalInvInicial, totalAntes, totalDespues, totalInvFinal,
      gandola, totalGandola, totalCompartment,
      currentShift,
    };
  }, [dayShifts, currentShift, receptionsHistory, config, islandCount]);

  // ── Generar PDF individual ──
  const handleGenerate = (key, action) => {
    try {
      const baseName = safeFilename(config.stationName);
      const date = currentShift?.date || getVenezuelaDateString();
      const shiftType = currentShift?.operatorShiftType || '';
      let doc = null;
      let filename = '';

      switch (key) {
        case 'cierre':
          if (!currentShift) { enqueueSnackbar({ message: 'Se requiere turno activo', variant: 'warning' }); return; }
          doc = generateCierreCortesPDF(currentShift, config);
          filename = `Cierre_Cortes_${baseName}_${date}_${shiftType}.pdf`;
          break;

        case 'reporte':
          if (!reporteData) { enqueueSnackbar({ message: 'No hay datos del reporte para este día', variant: 'warning' }); return; }
          doc = generateReportePDF(reporteData, config);
          filename = `Reporte_${baseName}_${reporteData.selectedDate}.pdf`;
          break;

        case 'biblia':
          if (!currentShift || biblia.length === 0) { enqueueSnackbar({ message: 'Se requiere turno activo con datos', variant: 'warning' }); return; }
          doc = generateBibliaPDF(currentShift, biblia, bibliaTotals, config);
          filename = `Biblia_${baseName}_${date}_${shiftType}.pdf`;
          break;

        case 'cuadre':
          if (!currentShift || cuadre.length === 0) { enqueueSnackbar({ message: 'Se requiere turno activo con datos', variant: 'warning' }); return; }
          doc = generateCuadrePVPDF(currentShift, cuadre, cuadreTotals, config, products);
          filename = `CuadrePV_${baseName}_${date}_${shiftType}.pdf`;
          break;

        case 'inventario':
          doc = generateInventarioIslasPDF(currentShift, islandInventoryData, islandIds, config);
          filename = `Inventario_${baseName}_${date}.pdf`;
          break;

        default:
          return;
      }

      if (!doc) return;

      if (action === 'download') {
        downloadBlob(doc, filename);
        enqueueSnackbar({ message: `${filename} generado correctamente`, variant: 'success' });
      } else if (action === 'print') {
        printBlob(doc);
      } else if (action === 'whatsapp') {
        shareViaWhatsApp(doc, filename);
      }
    } catch (err) {
      console.error('Error generando PDF:', err);
      enqueueSnackbar({ message: 'Error al generar PDF: ' + err.message, variant: 'error' });
    }
  };

  // ── Descargar TODO en UN SOLO PDF ──
  const handleDownloadAll = () => {
    try {
      const baseName = safeFilename(config.stationName);
      const date = currentShift?.date || getVenezuelaDateString();
      const shiftType = currentShift?.operatorShiftType || '';

      const doc = generateAllInOnePDF({
        shift: currentShift,
        reporteData,
        biblia,
        bibliaTotals,
        cuadre,
        cuadreTotals,
        islandInventoryData,
        islandIds,
        config,
        products,
      });

      const filename = `Reporte_Completo_${baseName}_${date}_${shiftType}.pdf`;
      downloadBlob(doc, filename);
      enqueueSnackbar({ message: `${filename} generado correctamente`, variant: 'success' });
    } catch (err) {
      console.error('Error generando PDF completo:', err);
      enqueueSnackbar({ message: 'Error al generar PDF completo: ' + err.message, variant: 'error' });
    }
  };

  // ── Compartir TODO por WhatsApp (PDF combinado) ──
  const handleShareAllWhatsApp = async () => {
    try {
      const baseName = safeFilename(config.stationName);
      const date = currentShift?.date || getVenezuelaDateString();
      const shiftType = currentShift?.operatorShiftType || '';

      setSharing('all');

      const doc = generateAllInOnePDF({
        shift: currentShift,
        reporteData,
        biblia,
        bibliaTotals,
        cuadre,
        cuadreTotals,
        islandInventoryData,
        islandIds,
        config,
        products,
      });

      const filename = `Reporte_Completo_${baseName}_${date}_${shiftType}.pdf`;
      await shareViaWhatsApp(doc, filename);
    } catch (err) {
      console.error('Error compartiendo PDF:', err);
      enqueueSnackbar({ message: 'Error al compartir: ' + err.message, variant: 'error' });
    } finally {
      setSharing(null);
    }
  };

  // ── Compartir PDF individual por WhatsApp ──
  const handleShareWhatsApp = async (key) => {
    try {
      setSharing(key);
      await handleGenerate(key, 'whatsapp');
    } finally {
      setSharing(null);
    }
  };

  // ── Resumen del turno ──
  const getShiftLabel = (shift) => {
    if (shift?.operatorShiftType) return SHIFT_LABELS[shift.operatorShiftType] || shift.operatorShiftType;
    return shift?.shiftType || 'N/A';
  };

  const islandSummary = useMemo(() => {
    if (!currentShift?.islands) return [];
    return currentShift.islands.map((isl) => ({
      label: ISLAND_LABELS[isl.islandId],
      value: isl.operatorName || '—',
    }));
  }, [currentShift]);

  // ── Validaciones por PDF (disabled = sin datos, NO mientras carga) ──
  const getDisabled = (key) => {
    if (key === 'cierre' || key === 'biblia' || key === 'cuadre') return !currentShift;
    if (key === 'reporte') return !reporteData && !loadingReporte;
    return false;
  };

  // ── Indicador de carga por PDF ──
  const getLoading = (key) => {
    if (key === 'reporte') return loadingReporte;
    return false;
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Sin turno activo
  // ═══════════════════════════════════════════════════════════════
  if (!currentShift) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Generar PDF</Typography>

        {/* PDFs que no requieren turno */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {PDF_CARDS.filter(c => !c.requiresShift).map((card) => {
            const Icon = card.icon;
            const disabled = getDisabled(card.key);
            const isLoading = getLoading(card.key);
            const isGen = generating === card.key;
            const isShar = sharing === card.key;
            return (
              <Grid item xs={12} sm={6} md={4} key={card.key}>
                <Card sx={{ height: '100%', border: '2px solid', borderColor: disabled ? 'divider' : card.color, opacity: disabled ? 0.6 : 1 }}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Icon sx={{ fontSize: 40, color: card.color, mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>{card.title}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '0.8rem' }}>{card.desc}</Typography>
                    {isLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                        <CircularProgress size={24} sx={{ color: card.color }} />
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Button variant="contained" size="small" startIcon={isGen ? <CircularProgress size={16} /> : <DownloadIcon />} onClick={() => handleGenerate(card.key, 'download')} disabled={disabled || isGen}>
                          Descargar
                        </Button>
                        <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={() => handleGenerate(card.key, 'print')} disabled={disabled}>
                          Imprimir
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={isShar ? <CircularProgress size={14} /> : <ShareIcon />}
                          onClick={() => handleShareWhatsApp(card.key)}
                          disabled={disabled || isShar}
                          sx={{ color: '#25D366', borderColor: '#25D366', '&:hover': { borderColor: '#128C7E', color: '#128C7E' } }}
                        >
                          WhatsApp
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Historial de turnos cerrados */}
        {shiftsHistory.length > 0 ? (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Turnos Cerrados</Typography>
              {shiftsHistory.slice(0, 10).map((shift) => (
                <Box key={shift.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box>
                    <Typography variant="body2">{shift.date} — {getShiftLabel(shift)}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Cerrado: {shift.closedAt ? new Date(shift.closedAt).toLocaleString('es-VE') : 'N/A'}
                    </Typography>
                  </Box>
                  <Chip label={shift.status} size="small" color={shift.status === 'cerrado' ? 'success' : 'warning'} />
                </Box>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Alert severity="info">No hay turnos para generar PDF. Inicia y cierra un turno primero.</Alert>
        )}
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Con turno activo
  // ═══════════════════════════════════════════════════════════════
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Generar PDF</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Generación de reportes — {currentShift.date}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* ── Tarjetas de PDF ── */}
        <Grid item xs={12} md={8}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleDownloadAll}
              disabled={generating !== null || sharing !== null}
              sx={{ fontWeight: 700 }}
            >
              Descargar Todo (1 PDF)
            </Button>
            <Button
              variant="contained"
              startIcon={sharing === 'all' ? <CircularProgress size={16} /> : <ShareIcon />}
              onClick={handleShareAllWhatsApp}
              disabled={generating !== null || sharing !== null}
              sx={{ fontWeight: 700, bgcolor: '#25D366', '&:hover': { bgcolor: '#128C7E' } }}
            >
              {sharing === 'all' ? 'Compartiendo...' : 'Compartir Todo (WhatsApp)'}
            </Button>
          </Box>

          <Grid container spacing={2}>
            {PDF_CARDS.map((card) => {
              const Icon = card.icon;
              const disabled = getDisabled(card.key);
              const isLoading = getLoading(card.key);
              const isGen = generating === card.key;
              const isShar = sharing === card.key;
              return (
                <Grid item xs={12} sm={6} md={4} key={card.key}>
                  <Tooltip title={disabled ? (card.requiresShift ? 'Requiere turno activo' : 'No hay datos disponibles') : ''} arrow>
                    <Card
                      sx={{
                        height: '100%',
                        border: '2px solid',
                        borderColor: disabled ? 'divider' : card.color,
                        opacity: disabled ? 0.5 : 1,
                        transition: 'all 0.2s',
                        '&:hover': disabled ? {} : { transform: 'translateY(-2px)', boxShadow: 4 },
                      }}
                    >
                      <CardContent sx={{ textAlign: 'center', py: 3 }}>
                        <Icon sx={{ fontSize: 40, color: disabled ? 'text.disabled' : card.color, mb: 1 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>{card.title}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '0.78rem' }}>{card.desc}</Typography>
                        {isLoading ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 0.5 }}>
                            <CircularProgress size={18} sx={{ color: card.color }} />
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Cargando datos...</Typography>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={isGen ? <CircularProgress size={14} /> : <DownloadIcon />}
                              onClick={() => handleGenerate(card.key, 'download')}
                              disabled={disabled || isGen}
                              sx={{ bgcolor: card.color, '&:hover': { bgcolor: card.color, opacity: 0.85 } }}
                            >
                              {isGen ? '...' : 'Descargar'}
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<PrintIcon />}
                              onClick={() => handleGenerate(card.key, 'print')}
                              disabled={disabled}
                            >
                              Imprimir
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={isShar ? <CircularProgress size={14} /> : <ShareIcon />}
                              onClick={() => handleShareWhatsApp(card.key)}
                              disabled={disabled || isShar}
                              sx={{ color: '#25D366', borderColor: '#25D366', '&:hover': { borderColor: '#128C7E', color: '#128C7E' }, fontSize: '0.7rem' }}
                            >
                              {isShar ? '...' : 'WhatsApp'}
                            </Button>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Tooltip>
                </Grid>
              );
            })}
          </Grid>
        </Grid>

        {/* ── Resumen del turno ── */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Resumen del Turno</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  { label: 'Fecha', value: currentShift.date },
                  { label: 'Supervisor', value: SUPERVISOR_SHIFT_LABELS[currentShift.supervisorShiftType] || 'N/A' },
                  { label: 'Operadores', value: SHIFT_LABELS[currentShift.operatorShiftType] || 'N/A' },
                  { label: 'Tasa BCV', value: `${currentShift.tasa1} Bs.` },
                  ...(currentShift.tasa2 > 0 && currentShift.tasa2 !== currentShift.tasa1
                    ? [{ label: 'Tasa 2', value: `${currentShift.tasa2} Bs.` }]
                    : []),
                  { label: 'Estado', value: currentShift.status === 'cerrado' ? 'Cerrado' : 'En Progreso' },
                  ...islandSummary.map((item) => ({ label: item.label, value: item.value })),
                ].map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>

              {/* Info adicional */}
              <Box sx={{ mt: 3, p: 1.5, bgcolor: '#F5F5F5', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Datos disponibles
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Chip label={`${biblia.length} islas (biblia)`} size="small" variant="outlined" color={biblia.length > 0 ? 'success' : 'default'} />
                  <Chip label={`${cuadre.length} islas (cuadre)`} size="small" variant="outlined" color={cuadre.length > 0 ? 'success' : 'default'} />
                  <Chip label={`${islandInventoryData.length} productos`} size="small" variant="outlined" color={islandInventoryData.length > 0 ? 'info' : 'default'} />
                  <Chip label={loadingReporte ? 'Cargando reporte...' : reporteData ? 'Reporte OK' : 'Sin reporte'} size="small" variant="outlined" color={loadingReporte ? 'default' : reporteData ? 'success' : 'warning'} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}