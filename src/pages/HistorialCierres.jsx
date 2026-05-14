// src/pages/HistorialCierres.jsx
// Historial de turnos cerrados con vista de informe completo inline y generación de PDF.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';

import { useCierreStore } from '../store/useCierreStore.js';
import { useConfigStore } from '../store/useConfigStore.js';
import { useProductStore } from '../store/useProductStore.js';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { useGandolaStore } from '../store/useGandolaStore.js';
import { calculateBiblia, calculateBibliaTotals, calculateCuadrePV, calculateCuadrePVTotals } from '../lib/calculations.js';
import { formatBs, formatUSD, formatNumber, formatDate, getVenezuelaDateString } from '../lib/formatters.js';
import { cmToLiters } from '../lib/conversions.js';
import { ISLAND_LABELS, SHIFT_LABELS, CATEGORY_ORDER } from '../config/constants.js';
import {
  generateAllInOnePDF,
  downloadBlob,
  safeFilename,
} from '../lib/pdfGenerator.js';
import { enqueueSnackbar } from 'notistack';

// ── Estilos tipo formulario impreso (consistente con Biblia.jsx) ──
const border = '1px solid #666';
const c = { border, p: '4px 6px', fontSize: '0.72rem', lineHeight: 1.3 };
const tot = { ...c, fontWeight: 700, bgcolor: '#dcdcdc' };
const sec = { ...c, fontWeight: 700, bgcolor: '#bbb', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 };
const resumenSec = { ...sec, bgcolor: '#888', color: '#fff' };

// ═══════════════════════════════════════════════════════════════
// Helper: buildReporteData — igual lógica que GenerarPDF.jsx
// Construye el objeto de datos para generateReportePDF().
// ═══════════════════════════════════════════════════════════════
function buildReporteData(dayShifts, selectedShift, receptionsHistory, config) {
  const selectedDate = selectedShift.date;
  const supervisorType = selectedShift.supervisorShiftType || 'PM';
  const is1TS = supervisorType === 'AM';
  const tanksCount = config.tanksCount || 3;
  const islandCount = config.islandsCount || 3;

  const diurnoShift = dayShifts.find((sh) => sh.operatorShiftType === 'DIURNO');
  const nocturnoShift = dayShifts.find((sh) => sh.operatorShiftType === 'NOCTURNO');

  const getIslandsWithPumps = (shift) => {
    const map = {};
    for (let i = 1; i <= islandCount; i++) map[i] = { islandId: i, pumps: [] };
    if (shift?.pumpReadings) {
      shift.pumpReadings.forEach((r) => {
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
    Object.values(map).forEach((isl) => {
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

  const displayNocturnoIslands = is1TS
    ? nocturnoIslands.map((nIsl) => {
        const dIsl = diurnoIslands.find((d) => d.islandId === nIsl.islandId);
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
    : nocturnoIslands.map((nIsl) => ({
        ...nIsl,
        pumps: nIsl.pumps.map((p) => ({ ...p, initialReading: 0, finalReading: 0, litersSold: 0, empty: true })),
      }));

  const displayNocturnoTotal = displayNocturnoIslands.reduce((s, i) => s + i.pumps.reduce((ps, p) => ps + p.litersSold, 0), 0);
  const nocturnoShiftForDisplay = is1TS ? nocturnoShift : null;

  const getTankRows = (source, key) => Array.from({ length: tanksCount }, (_, i) => {
    const tankId = i + 1;
    const tr = source?.tankReadings?.find((r) => r.tankId === tankId);
    const cm = tr ? (tr[key] || 0) : 0;
    return { tankId, cm, liters: cmToLiters(cm) };
  });

  const gandola = (() => {
    const fromHistory = receptionsHistory.find((r) => r.date === selectedDate);
    return fromHistory || null;
  })();

  const invInicial = getTankRows(is1TS ? selectedShift : null, 'cm');
  const antesDesc = getTankRows(gandola, 'cmBefore');
  const despDesc = getTankRows(gandola, 'cmAfter');
  const invFinal = getTankRows(!is1TS ? selectedShift : null, 'cm');

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
    currentShift: selectedShift,
  };
}

export default function HistorialCierres() {
  const { shiftsHistory, loadingHistory, loadShiftsHistory, getShiftById, loadShiftsByDate } = useCierreStore();
  const config = useConfigStore((s) => s.config);
  const { products, loadProducts } = useProductStore();
  const { stock, islandStock, loadStock, loadIslandStock } = useInventoryStore();
  const { receptionsHistory, loadReceptionsHistory } = useGandolaStore();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // ── Cargar datos iniciales ──
  useEffect(() => {
    loadShiftsHistory();
    loadProducts();
    loadStock();
    loadIslandStock();
    loadReceptionsHistory();
  }, [loadShiftsHistory, loadProducts, loadStock, loadIslandStock, loadReceptionsHistory]);

  // ── Parsear fecha DD/MM/YYYY a Date para comparación ──
  const parseShiftDate = useCallback((dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }, []);

  // ── Convertir input date (YYYY-MM-DD) a formato comparable ──
  const inputToDate = useCallback((inputStr) => {
    if (!inputStr) return null;
    const parts = inputStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }, []);

  // ── Filtrar turnos por fecha ──
  const filteredShifts = useMemo(() => {
    if (!shiftsHistory) return [];
    return shiftsHistory.filter((shift) => {
      if (!shift.date) return false;
      const shiftDate = parseShiftDate(shift.date);
      if (!shiftDate) return true;

      if (dateFrom) {
        const from = inputToDate(dateFrom);
        if (from && shiftDate < from) return false;
      }
      if (dateTo) {
        const to = inputToDate(dateTo);
        if (to && shiftDate > to) return false;
      }
      return true;
    });
  }, [shiftsHistory, dateFrom, dateTo, parseShiftDate, inputToDate]);

  const hasFilters = dateFrom || dateTo;

  // ── Limpiar filtros ──
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  // ── Abrir informe de un turno ──
  const handleViewReport = async (shiftId) => {
    setLoadingShift(true);
    setDialogOpen(true);
    try {
      const fullShift = await getShiftById(shiftId);
      if (fullShift) {
        setSelectedShift(fullShift);
      } else {
        enqueueSnackbar({ message: 'No se encontró el turno', variant: 'error' });
        setDialogOpen(false);
      }
    } catch (err) {
      console.error('Error cargando turno:', err);
      enqueueSnackbar({ message: 'Error al cargar el turno', variant: 'error' });
      setDialogOpen(false);
    } finally {
      setLoadingShift(false);
    }
  };

  // ── Cerrar diálogo ──
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedShift(null);
  };

  // ── Generar PDF completo (igual que GenerarPDF > Descargar Todo) ──
  const handleGeneratePdf = async () => {
    if (!selectedShift) return;
    setGeneratingPdf(true);
    try {
      // Cálculos base
      const biblia = calculateBiblia(selectedShift);
      const bibliaTotals = biblia.length > 0 ? calculateBibliaTotals(biblia) : null;
      const cuadre = calculateCuadrePV(selectedShift);
      const cuadreTotals = cuadre.length > 0 ? calculateCuadrePVTotals(cuadre, selectedShift.tasa1, selectedShift.tasa2) : null;

      // Cargar turnos del mismo día para el Reporte
      let reporteData = null;
      try {
        const dayShifts = await loadShiftsByDate(selectedShift.date);
        if (dayShifts && dayShifts.length > 0) {
          reporteData = buildReporteData(dayShifts, selectedShift, receptionsHistory, config);
        }
      } catch (e) {
        console.warn('No se pudo calcular reporteData:', e);
      }

      // Cálculo de inventario por islas
      const islandCount = config.islandsCount || 3;
      const islandIds = Array.from({ length: islandCount }, (_, i) => i + 1);
      const activeProducts = products
        .filter((p) => p.active)
        .sort((a, b) => {
          const catA = CATEGORY_ORDER.indexOf(a.category ?? 'otro');
          const catB = CATEGORY_ORDER.indexOf(b.category ?? 'otro');
          if (catA !== catB) return catA - catB;
          return (a.name || '').localeCompare(b.name || '');
        });
      const islandsSold = {};
      if (selectedShift.islands) {
        selectedShift.islands.forEach((i) => { islandsSold[i.islandId] = i.productsSold || []; });
      }
      const islandInventoryData = activeProducts.map((prod) => {
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

      // Generar PDF completo con portada — mismo formato que GenerarPDF > Descargar Todo
      const doc = generateAllInOnePDF({
        shift: selectedShift,
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

      const baseName = safeFilename(config.stationName);
      const date = selectedShift.date || '';
      const shiftType = selectedShift.operatorShiftType || '';
      const filename = `Reporte_Completo_${baseName}_${date}_${shiftType}.pdf`;

      downloadBlob(doc, filename);
      enqueueSnackbar({ message: `${filename} generado correctamente`, variant: 'success' });
    } catch (err) {
      console.error('Error generando PDF:', err);
      enqueueSnackbar({ message: 'Error al generar PDF: ' + err.message, variant: 'error' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── Obtener total litros de un turno ──
  const getShiftTotalLiters = useCallback((shift) => {
    if (!shift?.pumpReadings) return 0;
    return shift.pumpReadings.reduce((sum, r) => sum + (r.litersSold || 0), 0);
  }, []);

  // ── Obtener total USD de un turno (de biblia) ──
  const getShiftTotalUSD = useCallback((shift) => {
    if (!shift?.islands) return 0;
    let total = 0;
    for (const island of shift.islands) {
      total += island.pvTotalUSD || 0;
      total += island.pv2TotalUSD || 0;
    }
    return total;
  }, []);

  // ── Obtener operadores del turno ──
  const getOperatorNames = useCallback((shift) => {
    if (!shift?.islands) return '—';
    return shift.islands
      .map((i) => i.operatorName)
      .filter(Boolean)
      .join(', ') || '—';
  }, []);

  // ── Obtener día de la semana ──
  const getDayName = useCallback((dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const d = new Date(parts[2], parts[1] - 1, parts[0]);
    return dayNames[d.getDay()] || '';
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Loading
  // ═══════════════════════════════════════════════════════════════
  if (loadingHistory) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
        <CircularProgress size={48} />
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>Cargando historial de cierres...</Typography>
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Diálogo con informe completo
  // ═══════════════════════════════════════════════════════════════
  const renderDialog = () => {
    return (
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullScreen
        maxWidth="lg"
        PaperProps={{
          sx: { bgcolor: '#f5f5f5' },
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          bgcolor: 'white',
          borderBottom: '2px solid',
          borderColor: 'divider',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LocalGasStationIcon sx={{ color: '#CE1126' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Informe Completo
              </Typography>
              {selectedShift && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {selectedShift.date} — {SHIFT_LABELS[selectedShift.operatorShiftType] || selectedShift.operatorShiftType}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={generatingPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={handleGeneratePdf}
              disabled={generatingPdf || !selectedShift}
              sx={{ bgcolor: '#CE1126', '&:hover': { bgcolor: '#a50e1f' }, fontWeight: 700 }}
            >
              {generatingPdf ? 'Generando...' : 'Generar PDF'}
            </Button>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {loadingShift ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <CircularProgress size={36} />
              <Typography>Cargando datos del turno...</Typography>
            </Box>
          ) : selectedShift ? (
            <ReporteCompleto shift={selectedShift} config={config} products={products} />
          ) : null}
        </DialogContent>
      </Dialog>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Main
  // ═══════════════════════════════════════════════════════════════
  return (
    <Box>
      {/* ═══ Encabezado ═══ */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Historial de Cierres
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {filteredShifts.length} turno{filteredShifts.length !== 1 ? 's' : ''} cerrado{filteredShifts.length !== 1 ? 's' : ''}
          {hasFilters ? ' (filtrado)' : ''}
        </Typography>
      </Box>

      {/* ═══ Filtros de fecha ═══ */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Filtrar por fecha
          </Typography>
        </Box>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField
              label="Desde"
              type="date"
              size="small"
              fullWidth
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField
              label="Hasta"
              type="date"
              size="small"
              fullWidth
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            {hasFilters && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                fullWidth
                sx={{ height: 40 }}
              >
                Limpiar
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* ═══ Lista de turnos cerrados ═══ */}
      {filteredShifts.length === 0 ? (
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <LocalGasStationIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
            No hay turnos cerrados
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {hasFilters
              ? 'No se encontraron turnos con los filtros seleccionados. Intenta cambiar el rango de fechas.'
              : 'Los turnos cerrados aparecerán aquí una vez que se completen.'}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredShifts.map((shift) => {
            const totalLiters = getShiftTotalLiters(shift);
            const totalUSD = getShiftTotalUSD(shift);
            const operators = getOperatorNames(shift);
            const dayName = getDayName(shift.date);
            const isNocturno = shift.operatorShiftType === 'NOCTURNO';
            const shiftChipColor = isNocturno ? 'default' : 'primary';
            const shiftChipBg = isNocturno ? '#455A64' : '#003399';
            const closedTime = shift.closedAt
              ? new Date(shift.closedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
              : '—';

            return (
              <Grid item xs={12} sm={6} md={4} key={shift.id}>
                <Card
                  sx={{
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 4,
                      borderColor: '#CE1126',
                    },
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Card Header con color de turno */}
                  <Box sx={{
                    px: 2,
                    py: 1.2,
                    bgcolor: shiftChipBg,
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRadius: '12px 12px 0 0',
                  }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {isNocturno ? '2TO Nocturno' : '1TO Diurno'}
                    </Typography>
                    <Chip
                      label="Cerrado"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 22,
                      }}
                    />
                  </Box>

                  <CardContent sx={{ flex: 1, py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    {/* Fecha */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                      <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {shift.date}
                      </Typography>
                      {dayName && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          {dayName}
                        </Typography>
                      )}
                    </Box>

                    {/* Datos del turno */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Tasa:</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {formatNumber(shift.tasa1 || 0, 2)} Bs.
                          {isNocturno && shift.tasa2 > 0 && shift.tasa2 !== shift.tasa1
                            ? ` / ${formatNumber(shift.tasa2, 2)} Bs.`
                            : ''}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Litros:</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {formatNumber(totalLiters, 0)} L
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>PV Total:</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {formatUSD(totalUSD)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Cerrado:</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {closedTime}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Operadores */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 1.5 }}>
                      <PersonOutlineIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.2 }} />
                      <Typography variant="caption" sx={{
                        color: 'text.secondary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        fontSize: '0.7rem',
                      }}>
                        {operators}
                      </Typography>
                    </Box>
                  </CardContent>

                  {/* Botón Ver Informe */}
                  <Box sx={{ px: 1.5, pb: 1.5 }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewReport(shift.id)}
                      fullWidth
                      sx={{
                        bgcolor: '#CE1126',
                        '&:hover': { bgcolor: '#a50e1f' },
                        fontWeight: 700,
                        borderRadius: 2,
                        textTransform: 'none',
                      }}
                    >
                      Ver Informe
                    </Button>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* ═══ Diálogo de informe ═══ */}
      {renderDialog()}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente interno: Reporte Completo (dentro del Dialog)
// Muestra todas las tablas del informe: encabezado, surtidores, tanques, cortes,
// biblia por isla, cuadre PV, totales, productos vendidos, vales y transferencias.
// ═══════════════════════════════════════════════════════════════════════════
function ReporteCompleto({ shift, config, products }) {
  // ── Cálculos ──
  const biblia = useMemo(() => calculateBiblia(shift), [shift]);
  const bibliaTotals = useMemo(() => {
    if (biblia.length === 0) return null;
    return calculateBibliaTotals(biblia);
  }, [biblia]);
  const cuadre = useMemo(() => calculateCuadrePV(shift), [shift]);
  const cuadreTotals = useMemo(() => {
    if (!shift || cuadre.length === 0) return null;
    return calculateCuadrePVTotals(cuadre, shift.tasa1, shift.tasa2);
  }, [shift, cuadre]);

  const isNocturno = shift.operatorShiftType === 'NOCTURNO';
  const turnoLabel = isNocturno ? '2TO' : '1TO';
  const tasa1 = shift.tasa1 || 0;
  const tasa2 = shift.tasa2 || 0;
  const hasTasa2 = isNocturno && tasa2 > 0 && tasa2 !== tasa1;

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const parts = (shift.date || '').split('/');
  const shiftDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
  const dayName = dayNames[shiftDate.getDay()] || '';

  // ── Agrupar surtidores por isla ──
  const pumpsByIsland = useMemo(() => {
    const map = {};
    if (shift.pumpReadings) {
      shift.pumpReadings.forEach((r) => {
        if (!map[r.islandId]) map[r.islandId] = [];
        map[r.islandId].push(r);
      });
    }
    return map;
  }, [shift.pumpReadings]);

  // ── Estilos de celda ──
  const lbl = { ...c, fontWeight: 600, whiteSpace: 'nowrap' };
  const dataCell = { ...c, textAlign: 'center' };
  const descCell = { ...c, fontStyle: 'italic', fontSize: '0.65rem', color: '#555' };
  const totalValue = { ...tot, bgcolor: '#888', color: '#fff', textAlign: 'center', fontWeight: 800, fontSize: '0.8rem' };

  // ── Resumen calculado ──
  const totalBs = bibliaTotals?.totalBs || 0;
  const totalPropinaBs = bibliaTotals?.totalPropinaBs || 0;
  const restoBs = totalBs - totalPropinaBs;
  const bsResumenUSD = tasa1 > 0 ? restoBs / tasa1 : 0;
  const haySobregiro = bsResumenUSD < 0;
  const sobregiroUSD = haySobregiro ? Math.abs(bsResumenUSD) : 0;
  const totalResumenUSD = haySobregiro
    ? (bibliaTotals.totalUsdSinUE + bibliaTotals.totalPunto + bibliaTotals.totalUeUSD + bibliaTotals.totalVales + bibliaTotals.totalTransferencia)
    : (bibliaTotals?.totalIngresosUSD || 0);

  // ── Render: Tabla Biblia por isla ──
  const renderIslaBiblia = (data) => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={sec} colSpan={3}>
              ISLA {data.islandId} &nbsp;|&nbsp; Operador: {data.operatorName || '—'}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Bs.:</TableCell>
            <TableCell sx={dataCell}>{data.bsTotal > 0 ? formatBs(data.bsTotal) : ''}</TableCell>
            <TableCell sx={dataCell}>{data.bsInUSD > 0 ? formatUSD(data.bsInUSD) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>$:</TableCell>
            <TableCell sx={dataCell}></TableCell>
            <TableCell sx={dataCell}>{data.usdSinUE > 0 ? formatUSD(data.usdSinUE) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Punto:</TableCell>
            <TableCell sx={dataCell}></TableCell>
            <TableCell sx={dataCell}>{data.puntoTotal > 0 ? formatUSD(data.puntoTotal) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>UE:</TableCell>
            <TableCell sx={dataCell}></TableCell>
            <TableCell sx={dataCell}>{data.ueUSD > 0 ? formatUSD(data.ueUSD) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Vale(s):</TableCell>
            <TableCell sx={descCell}>{data.valesDescripcion || ''}</TableCell>
            <TableCell sx={dataCell}>{data.valesMonto > 0 ? formatUSD(data.valesMonto) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Transferencias:</TableCell>
            <TableCell sx={descCell}>{data.transferenciaDescripcion || ''}</TableCell>
            <TableCell sx={dataCell}>{data.transferenciaMonto > 0 ? formatUSD(data.transferenciaMonto) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Propina:</TableCell>
            <TableCell sx={dataCell}>{data.propinaBs > 0 ? formatBs(data.propinaBs) : ''}</TableCell>
            <TableCell sx={dataCell}>{data.propinaUSD > 0 ? formatUSD(data.propinaUSD) : ''}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ── Render: Tabla Resumen (2 columnas) ──
  const renderResumen = () => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={resumenSec} colSpan={2}>RESUMEN</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Bs.:</TableCell>
            <TableCell sx={dataCell}>{haySobregiro ? '' : (bsResumenUSD > 0 ? formatUSD(bsResumenUSD) : '')}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>$:</TableCell>
            <TableCell sx={dataCell}>{bibliaTotals?.totalUsdSinUE > 0 ? formatUSD(bibliaTotals.totalUsdSinUE) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Punto:</TableCell>
            <TableCell sx={dataCell}>{bibliaTotals?.totalPunto > 0 ? formatUSD(bibliaTotals.totalPunto) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>UE:</TableCell>
            <TableCell sx={dataCell}>{bibliaTotals?.totalUeUSD > 0 ? formatUSD(bibliaTotals.totalUeUSD) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Vale(s):</TableCell>
            <TableCell sx={dataCell}>{bibliaTotals?.totalVales > 0 ? formatUSD(bibliaTotals.totalVales) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Transferencias:</TableCell>
            <TableCell sx={dataCell}>{bibliaTotals?.totalTransferencia > 0 ? formatUSD(bibliaTotals.totalTransferencia) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff' }}>Total:</TableCell>
            <TableCell sx={totalValue}>{formatUSD(totalResumenUSD)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ── Construir grilla de biblia ──
  const allBlocks = [...biblia.map(b => ({ type: 'isla', data: b })), { type: 'resumen' }];
  const gridRows = [];
  for (let i = 0; i < allBlocks.length; i += 2) {
    gridRows.push({ left: allBlocks[i], right: allBlocks[i + 1] || null });
  }

  // ── Total litros por isla (para la tabla de surtidores) ──
  const getIslandLiters = (islandId) => {
    const pumps = pumpsByIsland[islandId] || [];
    return pumps.reduce((sum, r) => sum + (r.litersSold || 0), 0);
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* ═══ Encabezado del informe ═══ */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {config.stationLogo ? (
              <Avatar
                src={config.stationLogo}
                alt={config.stationName}
                sx={{ width: 56, height: 56, borderRadius: 1.5 }}
                variant="rounded"
              />
            ) : (
              <Box sx={{ width: 56, height: 56, borderRadius: 1.5, bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LocalGasStationIcon sx={{ fontSize: 32, color: 'grey.500' }} />
              </Box>
            )}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
                {config.stationName}
              </Typography>
              {config.stationRif !== 'J-00000000-0' && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  RIF: {config.stationRif}
                </Typography>
              )}
              {config.stationAddress && config.stationAddress !== 'Venezuela' && (
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  {config.stationAddress}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Chip
              icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
              label={shift.date}
              size="small"
              variant="outlined"
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Turno: {turnoLabel} {dayName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Tasa: {formatNumber(tasa1, 2)}</Typography>
              {hasTasa2 && (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Tasa 2: {formatNumber(tasa2, 2)}</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* ═══ Sección 1: Lectura de Surtidores ═══ */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
          Lectura de Surtidores
        </Typography>
        <Grid container spacing={2}>
          {Object.keys(pumpsByIsland)
            .map(Number)
            .sort((a, b) => a - b)
            .map((islandId) => {
              const pumps = pumpsByIsland[islandId] || [];
              const islandTotal = getIslandLiters(islandId);
              return (
                <Grid item xs={12} sm={6} md={4} key={islandId}>
                  <TableContainer>
                    <Table size="small" sx={{ '& td, & th': { border } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={sec} colSpan={4}>
                            {ISLAND_LABELS[islandId]}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#dcdcdc', textAlign: 'center' }}>Surt.</TableCell>
                          <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#dcdcdc', textAlign: 'center' }}>Lect. Inicial</TableCell>
                          <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#dcdcdc', textAlign: 'center' }}>Lect. Final</TableCell>
                          <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#dcdcdc', textAlign: 'center' }}>Litros</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pumps.map((pump, idx) => (
                          <TableRow key={idx}>
                            <TableCell sx={{ ...c, textAlign: 'center' }}>{pump.pumpNumber}</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'center' }}>{formatNumber(pump.initialReading || 0, 0)}</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'center' }}>{formatNumber(pump.finalReading || 0, 0)}</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'center' }}>{formatNumber(pump.litersSold || 0, 0)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell sx={{ ...tot, textAlign: 'right' }} colSpan={3}>Total Litros:</TableCell>
                          <TableCell sx={{ ...tot, textAlign: 'center' }}>{formatNumber(islandTotal, 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              );
            })}
        </Grid>
      </Paper>

      {/* ═══ Sección 2: Lectura de Tanques ═══ */}
      {shift.tankReadings && shift.tankReadings.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Lectura de Tanques
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { border } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={sec}>Tanque</TableCell>
                  <TableCell sx={sec}>CM</TableCell>
                  <TableCell sx={sec}>Litros</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shift.tankReadings.map((tank) => (
                  <TableRow key={tank.tankId}>
                    <TableCell sx={{ ...c, textAlign: 'center', fontWeight: 600 }}>Tanque {tank.tankId}</TableCell>
                    <TableCell sx={{ ...c, textAlign: 'center' }}>{tank.cm > 0 ? formatNumber(tank.cm, 1) : '—'}</TableCell>
                    <TableCell sx={{ ...c, textAlign: 'center' }}>{tank.liters > 0 ? formatNumber(tank.liters, 0) : '—'}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ ...tot, textAlign: 'right' }}>Total:</TableCell>
                  <TableCell sx={{ ...tot, textAlign: 'center' }}></TableCell>
                  <TableCell sx={{ ...tot, textAlign: 'center' }}>
                    {formatNumber(shift.tankReadings.reduce((s, t) => s + (t.liters || 0), 0), 0)} L
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ═══ Sección 3: Cortes por Isla (Bs / USD) ═══ */}
      {shift.islands && shift.islands.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Cortes por Isla
          </Typography>
          <Grid container spacing={2}>
            {shift.islands.map((island) => {
              const cBs = (island.cortesBs || []).filter(v => v > 0);
              const cUsd = (island.cortesUSD || []).filter(v => v > 0);
              const totalCortesBs = cBs.reduce((s, v) => s + v, 0) + (island.bsAdicionales || 0);
              const totalCortesUSD = cUsd.reduce((s, v) => s + v, 0) + (island.usdAdicionales || 0);
              return (
                <Grid item xs={12} sm={6} md={4} key={island.islandId}>
                  <Typography variant="subtitle2" sx={{
                    bgcolor: '#CE1126', color: 'white', p: '4px 8px', borderRadius: '4px 4px 0 0',
                    fontWeight: 700, fontSize: '0.75rem',
                  }}>
                    {ISLAND_LABELS[island.islandId]} — {island.operatorName || '—'}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border, borderBottom: 'none' }}>
                    {/* Tabla Bs */}
                    <TableContainer sx={{ borderBottom: 'none' }}>
                      <Table size="small" sx={{ '& td': { border } }}>
                        <TableBody>
                          <TableRow><TableCell sx={{ ...sec, bgcolor: '#CE1126' }}>Corte</TableCell><TableCell sx={{ ...sec, bgcolor: '#CE1126' }}>Bs.</TableCell></TableRow>
                          {cBs.length > 0 ? cBs.map((val, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={c}>Corte {idx + 1}</TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right' }}>{formatBs(val)}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell sx={descCell} colSpan={2}>Sin cortes</TableCell></TableRow>
                          )}
                          <TableRow>
                            <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#FFF3E0' }}>UE Bs.</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'right', bgcolor: '#FFF3E0' }}>{formatBs(island.bsAdicionales || 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={tot}>Total Bs.</TableCell>
                            <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatBs(totalCortesBs)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {/* Tabla USD */}
                    <TableContainer sx={{ borderBottom: 'none' }}>
                      <Table size="small" sx={{ '& td': { border } }}>
                        <TableBody>
                          <TableRow><TableCell sx={{ ...sec, bgcolor: '#2E7D32' }}>Corte</TableCell><TableCell sx={{ ...sec, bgcolor: '#2E7D32' }}>$</TableCell></TableRow>
                          {cUsd.length > 0 ? cUsd.map((val, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={c}>Corte {idx + 1}</TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right' }}>{formatUSD(val)}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell sx={descCell} colSpan={2}>Sin cortes</TableCell></TableRow>
                          )}
                          <TableRow>
                            <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#FFF3E0' }}>UE $</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'right', bgcolor: '#FFF3E0' }}>{formatUSD(island.usdAdicionales || 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={tot}>Total $</TableCell>
                            <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatUSD(totalCortesUSD)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
          {/* Total General */}
          <Box sx={{
            mt: 2, p: 1.5, bgcolor: '#dcdcdc', borderRadius: 1,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1,
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Total General</Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
                Bs: {formatBs(shift.islands.reduce((s, i) => s + (i.cortesBs || []).reduce((a, v) => a + v, 0) + (i.bsAdicionales || 0), 0))}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
                $: {formatUSD(shift.islands.reduce((s, i) => s + (i.cortesUSD || []).reduce((a, v) => a + v, 0) + (i.usdAdicionales || 0), 0))}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* ═══ Sección 4: Biblia — Resumen Financiero ═══ */}
      {biblia.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Biblia — Resumen Financiero
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}>
            {gridRows.map((row, idx) => (
              <React.Fragment key={idx}>
                <Box>
                  {row.left.type === 'isla'
                    ? renderIslaBiblia(row.left.data)
                    : renderResumen()
                  }
                </Box>
                {row.right ? (
                  <Box>
                    {row.right.type === 'isla'
                      ? renderIslaBiblia(row.right.data)
                      : renderResumen()
                    }
                  </Box>
                ) : (
                  <Box />
                )}
              </React.Fragment>
            ))}
          </Box>

          {/* Sobregiro */}
          {haySobregiro && (
            <Paper sx={{
              mt: 3,
              mx: 'auto',
              maxWidth: 400,
              p: 2,
              bgcolor: '#FFF3E0',
              border: '2px solid #E65100',
              borderRadius: 2,
              textAlign: 'center',
            }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#E65100', letterSpacing: 1 }}>
                SOBREGIRO
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#BF360C', mt: 1 }}>
                {formatUSD(sobregiroUSD)}
              </Typography>
            </Paper>
          )}
        </Paper>
      )}

      {/* ═══ Sección 5: Cuadre Punto de Venta ═══ */}
      {cuadre.length > 0 && cuadreTotals && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Cuadre Punto de Venta
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { border } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={sec}>Isla</TableCell>
                  <TableCell sx={sec}>Bs.</TableCell>
                  <TableCell sx={sec}>$</TableCell>
                  <TableCell sx={sec}>Litros</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cuadre.map((r) => (
                  <React.Fragment key={r.islandId}>
                    <TableRow>
                      <TableCell sx={{ ...sec, bgcolor: '#999' }} colSpan={4}>
                        {ISLAND_LABELS[r.islandId]}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ ...c, fontWeight: 700 }}>Tasa 1 ({formatBs(tasa1)})</TableCell>
                      <TableCell sx={{ ...c, textAlign: 'right' }}>{formatBs(r.pvTotalBs)}</TableCell>
                      <TableCell sx={{ ...c, textAlign: 'right' }}>{formatUSD(r.pvTotalUSD)}</TableCell>
                      <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 700 }}>{formatNumber(r.pvUSDinLiters, 2)}</TableCell>
                    </TableRow>
                    {isNocturno && tasa2 > 0 && (
                      <TableRow>
                        <TableCell sx={{ ...c, fontWeight: 700 }}>Tasa 2 ({formatBs(tasa2)})</TableCell>
                        <TableCell sx={{ ...c, textAlign: 'right' }}>{formatBs(r.pv2TotalBs)}</TableCell>
                        <TableCell sx={{ ...c, textAlign: 'right' }}>{formatUSD(r.pv2TotalUSD)}</TableCell>
                        <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 700 }}>{formatNumber(r.pv2USDinLiters, 2)}</TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                {/* Totales */}
                <TableRow>
                  <TableCell sx={{ ...tot, textAlign: 'left' }}>Total Tasa 1</TableCell>
                  <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatBs(cuadreTotals.totalPVBs)}</TableCell>
                  <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatUSD(cuadreTotals.totalPVUSD)}</TableCell>
                  <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatNumber(cuadreTotals.totalPVLiters, 2)}</TableCell>
                </TableRow>
                {isNocturno && tasa2 > 0 && (
                  <TableRow>
                    <TableCell sx={{ ...tot, textAlign: 'left' }}>Total Tasa 2</TableCell>
                    <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatBs(cuadreTotals.totalPV2Bs)}</TableCell>
                    <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatUSD(cuadreTotals.totalPV2USD)}</TableCell>
                    <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatNumber(cuadreTotals.totalPV2Liters, 2)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'left' }}>Total Turno</TableCell>
                  <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'right' }}>{formatBs(cuadreTotals.grandTotalBs)}</TableCell>
                  <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'right' }}>{formatUSD(cuadreTotals.grandTotalUSD)}</TableCell>
                  <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'right' }}>{formatNumber(cuadreTotals.grandTotalLiters, 2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ═══ Sección 6: Productos Vendidos por Isla ═══ */}
      {shift.islands && shift.islands.some((isl) => isl.productsSold && isl.productsSold.length > 0) && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Productos Vendidos por Isla
          </Typography>
          <Grid container spacing={2}>
            {shift.islands.map((island) => {
              const sold = island.productsSold || [];
              if (sold.length === 0) return null;
              return (
                <Grid item xs={12} sm={6} md={4} key={island.islandId}>
                  <TableContainer>
                    <Table size="small" sx={{ '& td, & th': { border } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ ...sec, bgcolor: '#999' }} colSpan={3}>
                            {ISLAND_LABELS[island.islandId]} — {island.operatorName || '—'}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={sec}>Producto</TableCell>
                          <TableCell sx={sec}>Cant.</TableCell>
                          <TableCell sx={sec}>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sold.map((ps, idx) => {
                          const prod = (products || []).find((p) => p.name === ps.productName);
                          const price = prod?.priceUSD || 0;
                          const total = price * ps.quantity;
                          const method = ps.paymentMethod || 'punto_de_venta';
                          const showBs = method === 'punto_de_venta' || method === 'efectivo_bs';
                          const totalBs = showBs && tasa1 > 0 ? total * tasa1 : 0;
                          const methodLabel = method === 'punto_de_venta' ? 'PV' : method === 'efectivo_bs' ? 'Ef.Bs' : 'Ef.$';
                          return (
                            <TableRow key={idx}>
                              <TableCell sx={{ ...c, fontSize: '0.65rem' }}>
                                {ps.productName}
                                {showBs && (
                                  <Typography variant="caption" sx={{ display: 'block', color: '#555', fontSize: '0.58rem' }}>
                                    {formatBs(totalBs)} — {methodLabel}
                                  </Typography>
                                )}
                                {!showBs && (
                                  <Typography variant="caption" sx={{ display: 'block', color: '#555', fontSize: '0.58rem' }}>
                                    {methodLabel}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ ...c, textAlign: 'center' }}>{ps.quantity}</TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 700 }}>{formatUSD(total)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow>
                          <TableCell sx={{ ...tot, textAlign: 'left' }}>Subtotal:</TableCell>
                          <TableCell sx={{ ...tot, textAlign: 'center' }}>
                            {sold.reduce((s, p) => s + (p.quantity || 0), 0)}
                          </TableCell>
                          <TableCell sx={{ ...tot, textAlign: 'right' }}>
                            {formatUSD(sold.reduce((s, ps) => {
                              const prod = (products || []).find((p) => p.name === ps.productName);
                              const price = prod?.priceUSD || 0;
                              return s + price * (ps.quantity || 0);
                            }, 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}

      {/* ═══ Sección 7: Vales y Transferencias por Isla ═══ */}
      {shift.islands && shift.islands.some((isl) => {
        const vales = isl.vales || [];
        const transfers = isl.transferencias || [];
        return vales.length > 0 || transfers.length > 0;
      }) && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Vales y Transferencias por Isla
          </Typography>
          <Grid container spacing={2}>
            {shift.islands.map((island) => {
              const vales = island.vales || [];
              const transfers = island.transferencias || [];
              if (vales.length === 0 && transfers.length === 0) return null;
              return (
                <Grid item xs={12} sm={6} md={4} key={island.islandId}>
                  {/* Header isla */}
                  <Typography variant="subtitle2" sx={{
                    bgcolor: '#999',
                    color: 'white',
                    p: '4px 8px',
                    borderRadius: '4px 4px 0 0',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}>
                    {ISLAND_LABELS[island.islandId]} — {island.operatorName || '—'}
                  </Typography>

                  {/* Vales */}
                  {vales.length > 0 && (
                    <TableContainer>
                      <Table size="small" sx={{ '& td, & th': { border } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ ...sec, fontSize: '0.65rem' }} colSpan={2}>Vales</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {vales.map((v, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ ...c, fontStyle: 'italic', fontSize: '0.65rem' }}>
                                {v.descripcion || `Vale ${idx + 1}`}
                              </TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 600 }}>
                                {formatUSD(v.monto || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {vales.length > 1 && (
                            <TableRow>
                              <TableCell sx={{ ...tot, textAlign: 'left' }}>Total Vales</TableCell>
                              <TableCell sx={{ ...tot, textAlign: 'right' }}>
                                {formatUSD(vales.reduce((s, v) => s + (v.monto || 0), 0))}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* Transferencias */}
                  {transfers.length > 0 && (
                    <TableContainer sx={vales.length > 0 ? { mt: 1 } : {}}>
                      <Table size="small" sx={{ '& td, & th': { border } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ ...sec, fontSize: '0.65rem' }} colSpan={2}>Transferencias</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {transfers.map((t, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ ...c, fontStyle: 'italic', fontSize: '0.65rem' }}>
                                {t.descripcion || `Transf. ${idx + 1}`}
                              </TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 600 }}>
                                {formatUSD(t.monto || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {transfers.length > 1 && (
                            <TableRow>
                              <TableCell sx={{ ...tot, textAlign: 'left' }}>Total Transf.</TableCell>
                              <TableCell sx={{ ...tot, textAlign: 'right' }}>
                                {formatUSD(transfers.reduce((s, t) => s + (t.monto || 0), 0))}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}
    </Box>
  );
}