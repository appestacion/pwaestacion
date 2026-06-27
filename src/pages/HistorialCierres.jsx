// src/pages/HistorialCierres.jsx
// Historial de turnos cerrados con vista de informe completo inline y generación de PDF.
// Refactorizado con MUI Tabs: Cierres | Recaudación | Gandolas

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';

import useStore from '../store/useStore.js';
import { useCierreStore } from '../store/useCierreStore.js';
import { useConfigStore } from '../store/useConfigStore.js';
import { useProductStore } from '../store/useProductStore.js';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { useGandolaStore } from '../store/useGandolaStore.js';
import { calculateBiblia, calculateBibliaTotals, calculateCuadrePV, calculateCuadrePVTotals } from '../lib/calculations.js';
import { formatBs, formatUSD, formatNumber } from '../lib/formatters.js';
import { cmToLiters } from '../lib/conversions.js';
import { bsToUsd, usdToBs } from '../lib/conversions.js';
import { ISLAND_LABELS, SHIFT_LABELS, CATEGORY_ORDER } from '../config/constants.js';
import {
  generateAllInOnePDF,
  downloadBlob,
  safeFilename,
} from '../lib/pdfGenerator.js';
import { enqueueSnackbar } from 'notistack';
import ReporteCompleto from '../components/ReporteCompleto.jsx';

function buildReporteData(dayShifts, selectedShift, receptionsHistory, config, supervisorName) {
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
            litersSold: Math.max(0, r.litersSold || 0),
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
    supervisorName: supervisorName || '',
  };
}

const TAB_CIERRES = 0;
const TAB_RECAUDACION = 1;
const TAB_GANDOLAS = 2;

const TAB_CONFIG = [
  { label: 'Cierres', icon: <LocalGasStationIcon sx={{ fontSize: 18 }} />, title: 'Historial de Cierres' },
  { label: 'Recaudación', icon: <AccessTimeIcon sx={{ fontSize: 18 }} />, title: 'Historial de Recaudación' },
  { label: 'Gandolas', icon: <LocalShippingIcon sx={{ fontSize: 18 }} />, title: 'Historial de Gandolas' },
];

export default function HistorialCierres() {
  const { shiftsHistory, loadingHistory, loadShiftsHistory, getShiftById, loadShiftsByDate } = useCierreStore();
  const config = useConfigStore((s) => s.config);
  const { products, loadProducts } = useProductStore();
  const { stock, islandStock, loadStock, loadIslandStock } = useInventoryStore();
  const { receptionsHistory, loadReceptionsHistory } = useGandolaStore();
  const userName = useStore((s) => s.user?.name) || '';

  const [activeTab, setActiveTab] = useState(TAB_CIERRES);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const cierresDataLoaded = useRef(false);
  const recaudacionDataLoaded = useRef(false);
  const gandolaDataLoaded = useRef(false);

  useEffect(() => {
    loadShiftsHistory();
  }, [loadShiftsHistory]);

  useEffect(() => {
    if (activeTab === TAB_CIERRES && !cierresDataLoaded.current) {
      loadProducts();
      loadStock();
      loadIslandStock();
      cierresDataLoaded.current = true;
    }
    if (activeTab === TAB_RECAUDACION) {
      recaudacionDataLoaded.current = true;
    }
    if (activeTab === TAB_GANDOLAS && !gandolaDataLoaded.current) {
      loadReceptionsHistory();
      gandolaDataLoaded.current = true;
    }
  }, [activeTab, loadProducts, loadStock, loadIslandStock, loadReceptionsHistory]);

  const parseShiftDate = useCallback((dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }, []);

  const inputToDate = useCallback((inputStr) => {
    if (!inputStr) return null;
    const parts = inputStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }, []);

  const filteredShifts = useMemo(() => {
    if (!shiftsHistory) return [];
    const seen = new Set();
    return shiftsHistory.filter((shift) => {
      if (!shift.date) return false;
      if (shift.id && seen.has(shift.id)) return false;
      if (shift.id) seen.add(shift.id);
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

  const filteredGandolas = useMemo(() => {
    if (!receptionsHistory) return [];
    return receptionsHistory.filter((rec) => {
      if (!rec.date) return false;
      const recDate = parseShiftDate(rec.date);
      if (!recDate) return true;
      if (dateFrom) {
        const from = inputToDate(dateFrom);
        if (from && recDate < from) return false;
      }
      if (dateTo) {
        const to = inputToDate(dateTo);
        if (to && recDate > to) return false;
      }
      return true;
    });
  }, [receptionsHistory, dateFrom, dateTo, parseShiftDate, inputToDate]);

  const hasFilters = dateFrom || dateTo;

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

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

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedShift(null);
  };

  const handleGeneratePdf = async () => {
    if (!selectedShift) return;
    setGeneratingPdf(true);
    try {
      const precioLitroUSD = config?.precioLitroUSD || 0.50;
      const biblia = calculateBiblia(selectedShift, precioLitroUSD);
      const bibliaTotals = biblia.length > 0 ? calculateBibliaTotals(biblia) : null;
      const cuadre = calculateCuadrePV(selectedShift);
      const cuadreTotals = cuadre.length > 0 ? calculateCuadrePVTotals(cuadre, selectedShift.tasa1, selectedShift.tasa2) : null;

      let reporteData = null;
      try {
        const dayShifts = await loadShiftsByDate(selectedShift.date);
        if (dayShifts && dayShifts.length > 0) {
          reporteData = buildReporteData(dayShifts, selectedShift, receptionsHistory, config, userName);
        }
      } catch (e) {
        console.warn('No se pudo calcular reporteData:', e);
      }

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

  // ★ CAMBIO: Total litros de un turno
  const getShiftTotalLiters = useCallback((shift) => {
    if (!shift?.pumpReadings) return 0;
    return shift.pumpReadings.reduce((sum, r) => sum + Math.max(0, r.litersSold || 0), 0);
  }, []);

  // ★ CAMBIO: Total USD de los CORTES de un turno
  const getShiftTotalUSD = useCallback((shift) => {
    if (!shift?.islands) return 0;
    let total = 0;
    for (const island of shift.islands) {
      const cortes = island.cortesUSD || [];
      total += cortes.reduce((s, v) => s + v, 0) + (island.usdAdicionales || 0);
    }
    return total;
  }, []);

  // ★ CAMBIO: Total Bs de los CORTES de un turno
  const getShiftTotalBs = useCallback((shift) => {
    if (!shift?.islands) return 0;
    let total = 0;
    for (const island of shift.islands) {
      const cortes = island.cortesBs || [];
      total += cortes.reduce((s, v) => s + v, 0) + (island.bsAdicionales || 0);
    }
    return total;
  }, []);

  // Total USD incluyendo propinas (PV Total completo)
  const getShiftTotalWithTips = useCallback((shift) => {
    if (!shift?.islands) return 0;
    let total = 0;
    for (const island of shift.islands) {
      total += island.pvTotalUSD || 0;
      total += island.pv2TotalUSD || 0;
      total += island.propinaUSD || 0;
    }
    return total;
  }, []);

  const getOperatorNames = useCallback((shift) => {
    if (!shift?.islands) return '—';
    return shift.islands
      .map((i) => i.operatorName)
      .filter(Boolean)
      .join(', ') || '—';
  }, []);

  const getDayName = useCallback((dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const d = new Date(parts[2], parts[1] - 1, parts[0]);
    return dayNames[d.getDay()] || '';
  }, []);

  const recaudacionRows = useMemo(() => {
    if (activeTab !== TAB_RECAUDACION) return [];
    const rows = [];
    (filteredShifts || []).forEach((shift) => {
      const islands = shift.islands || [];
      islands.forEach((isl) => {
        let propinaUSD = isl.propinaUSD || 0;
        let propinaBs = isl.propinaBs || 0;
        let recaudacionBs = isl.recaudacionBs || 0;
        let pct = isl.porcentajeRecaudacionUsado || null;

        if (propinaBs === 0 && recaudacionBs === 0) {
          try {
            const precioLitroUSD = config?.precioLitroUSD || 0.50;
            const biblia = calculateBiblia(shift, precioLitroUSD);
            const b = biblia.find((x) => x.islandId === isl.islandId);
            propinaUSD = b?.propinaUSD || 0;
            propinaBs = b?.propinaBs || 0;
            pct = config?.porcentajeRecaudacion || 10;
            recaudacionBs = propinaBs > 0 ? Math.floor(propinaBs * ((pct || 10) / 100) / 10) * 10 : 0;
          } catch (e) { /* ignore */ }
        }
        if (pct == null) pct = config?.porcentajeRecaudacion || 10;

        rows.push({
          date: shift.date,
          operatorShiftType: shift.operatorShiftType,
          islandId: isl.islandId,
          operatorName: isl.operatorName || '—',
          propinaUSD,
          propinaBs,
          porcentaje: pct,
          recaudacionBs,
        });
      });
    });
    return rows;
  }, [filteredShifts, config, activeTab]);

  const totalPropinaUSD = recaudacionRows.reduce((s, r) => s + r.propinaUSD, 0);
  const totalPropina = recaudacionRows.reduce((s, r) => s + r.propinaBs, 0);
  const totalRecaudacion = recaudacionRows.reduce((s, r) => s + r.recaudacionBs, 0);

  if (loadingHistory && activeTab !== TAB_GANDOLAS) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
        <CircularProgress size={48} />
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>Cargando historial...</Typography>
      </Box>
    );
  }

  const getTabSubtitle = () => {
    switch (activeTab) {
      case TAB_CIERRES:
        return `${filteredShifts.length} turno${filteredShifts.length !== 1 ? 's' : ''} cerrado${filteredShifts.length !== 1 ? 's' : ''}${hasFilters ? ' (filtrado)' : ''}`;
      case TAB_RECAUDACION:
        return `${recaudacionRows.length} registro${recaudacionRows.length !== 1 ? 's' : ''}${hasFilters ? ' (filtrado)' : ''}`;
      case TAB_GANDOLAS:
        return `${filteredGandolas.length} recepción${filteredGandolas.length !== 1 ? 'es' : ''}${hasFilters ? ' (filtrado)' : ''}`;
      default:
        return '';
    }
  };

  const renderDialog = () => {
    return (
      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullScreen maxWidth="lg"
        PaperProps={{ sx: { bgcolor: '#f5f5f5' } }}>
        <DialogTitle sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 2, py: 1.5, bgcolor: 'white', borderBottom: '2px solid', borderColor: 'divider',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LocalGasStationIcon sx={{ color: '#CE1126' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Informe Completo</Typography>
              {selectedShift && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {selectedShift.date} — {SHIFT_LABELS[selectedShift.operatorShiftType] || selectedShift.operatorShiftType}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button variant="contained" size="small"
              startIcon={generatingPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={handleGeneratePdf} disabled={generatingPdf || !selectedShift}
              sx={{ bgcolor: '#CE1126', '&:hover': { bgcolor: '#a50e1f' }, fontWeight: 700 }}>
              {generatingPdf ? 'Generando...' : 'Generar PDF'}
            </Button>
            <IconButton onClick={handleCloseDialog} size="small"><CloseIcon /></IconButton>
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

  const renderCierresTab = () => {
    return (
      <>
        {filteredShifts.length === 0 ? (
          <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
            <LocalGasStationIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>No hay turnos cerrados</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {hasFilters ? 'No se encontraron turnos con los filtros seleccionados. Intenta cambiar el rango de fechas.' : 'Los turnos cerrados aparecerán aquí una vez que se completen.'}
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {filteredShifts.map((shift) => {
              const totalLiters = getShiftTotalLiters(shift);
              const totalUSD = getShiftTotalUSD(shift);
              const totalBs = getShiftTotalBs(shift);
              const totalPVWithTips = getShiftTotalWithTips(shift);
              const operators = getOperatorNames(shift);
              const dayName = getDayName(shift.date);
              const isNocturno = shift.operatorShiftType === 'NOCTURNO';
              const shiftChipBg = isNocturno ? '#455A64' : '#003399';
              const closedTime = shift.closedAt
                ? new Date(shift.closedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                : '—';
              const dayTotalLiters = isNocturno && shift.date
                ? (shiftsHistory || []).reduce((sum, s) => {
                    if (s.date === shift.date) return sum + getShiftTotalLiters(s);
                    return sum;
                  }, 0)
                : 0;

              return (
                <Grid item xs={12} sm={6} md={4} key={shift.id}>
                  <Card sx={{
                    borderRadius: 3, border: '1px solid', borderColor: 'divider', transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4, borderColor: '#CE1126' },
                    height: '100%', display: 'flex', flexDirection: 'column',
                  }}>
                    <Box sx={{
                      px: 2, py: 1.2, bgcolor: shiftChipBg, color: 'white',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px 12px 0 0',
                    }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {isNocturno ? '2TO Nocturno' : '1TO Diurno'}
                      </Typography>
                      <Chip label="Cerrado" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, fontSize: '0.7rem', height: 22 }} />
                    </Box>

                    <CardContent sx={{ flex: 1, py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                        <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{shift.date}</Typography>
                        {dayName && <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>{dayName}</Typography>}
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, mb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Tasa(s):</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {formatNumber(shift.tasa1 || 0, 2)} Bs.
                            {isNocturno && shift.tasa2 > 0 && shift.tasa2 !== shift.tasa1 ? ` / ${formatNumber(shift.tasa2, 2)} Bs.` : ''}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Litros:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {formatNumber(totalLiters, 0)} L
                            {isNocturno && dayTotalLiters > totalLiters ? ` / ${formatNumber(dayTotalLiters, 0)} L` : ''}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Bs. Total:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#795548' }}>{formatBs(totalBs)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>$ Total:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#1565C0' }}>{formatUSD(totalUSD)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>PV Total:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>{formatUSD(totalPVWithTips)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Cerrado:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>{closedTime}</Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 1.5 }}>
                        <PersonOutlineIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.2 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontSize: '0.7rem' }}>
                          {operators}
                        </Typography>
                      </Box>
                    </CardContent>

                    <Box sx={{ px: 1.5, pb: 1.5 }}>
                      <Button variant="contained" size="small" startIcon={<VisibilityIcon />} onClick={() => handleViewReport(shift.id)} fullWidth
                        sx={{ bgcolor: '#CE1126', '&:hover': { bgcolor: '#a50e1f' }, fontWeight: 700, borderRadius: 2, textTransform: 'none' }}>
                        Ver Informe
                      </Button>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </>
    );
  };

  const renderRecaudacionTab = () => {
    if (recaudacionRows.length === 0) {
      return (
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <AccessTimeIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>No hay datos de recaudación</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {hasFilters ? 'No se encontraron registros con los filtros seleccionados.' : 'Los datos de recaudación aparecerán cuando existan turnos cerrados.'}
          </Typography>
        </Paper>
      );
    }

    const recBorder = '1px solid #888';
    const rc = { border: recBorder, p: '5px 8px', fontSize: '0.75rem', lineHeight: 1.4 };
    const rSec = { ...rc, fontWeight: 700, bgcolor: '#E65100', color: '#fff', textAlign: 'center', textTransform: 'uppercase' };
    const rTot = { ...rc, fontWeight: 700, bgcolor: '#FFE0B2', textAlign: 'center' };
    const rLbl = { ...rc, fontWeight: 600, whiteSpace: 'nowrap' };
    const rData = { ...rc, textAlign: 'center' };
    const dayNamesMap = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

    return (
      <Box>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Total Acumulado</Typography>
          <Chip label={`${formatBs(totalRecaudacion)} total`} color="warning" size="small" sx={{ fontWeight: 700 }} />
        </Box>
        <TableContainer>
          <Table size="small" sx={{ '& td, & th': { border: recBorder } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={rSec}>Fecha</TableCell>
                <TableCell sx={rSec}>Turno</TableCell>
                <TableCell sx={rSec}>Isla</TableCell>
                <TableCell sx={rSec}>Operador</TableCell>
                <TableCell sx={{ ...rSec, bgcolor: '#1565C0' }}>Excedente $</TableCell>
                <TableCell sx={{ ...rSec, bgcolor: '#795548' }}>Excedente Bs</TableCell>
                <TableCell sx={{ ...rSec, bgcolor: '#795548' }}>% Rec.</TableCell>
                <TableCell sx={{ ...rSec, bgcolor: '#E65100' }}>Recaudación Bs</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recaudacionRows.map((row, idx) => {
                const parts = (row.date || '').split('/');
                const shiftDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : null;
                const dayLabel = shiftDate ? dayNamesMap[shiftDate.getDay()] || '' : '';
                const turnoLabel = row.operatorShiftType === 'NOCTURNO' ? '2TO' : '1TO';
                const isNocturno = row.operatorShiftType === 'NOCTURNO';
                return (
                  <TableRow key={idx} hover>
                    <TableCell sx={rLbl}>{row.date}{dayLabel && <Typography variant="caption" sx={{ display: 'block', color: '#888', fontStyle: 'italic' }}>{dayLabel}</Typography>}</TableCell>
                    <TableCell sx={{ ...rData, fontWeight: 600, color: isNocturno ? '#1565C0' : '#2E7D32' }}>{turnoLabel}</TableCell>
                    <TableCell sx={rData}>{ISLAND_LABELS[row.islandId]}</TableCell>
                    <TableCell sx={{ ...rLbl, fontSize: '0.7rem' }}>{row.operatorName}</TableCell>
                    <TableCell sx={{ ...rData, fontWeight: 600, color: '#1565C0' }}>{row.propinaUSD > 0 ? formatUSD(row.propinaUSD) : '—'}</TableCell>
                    <TableCell sx={rData}>{row.propinaBs > 0 ? formatBs(row.propinaBs) : '—'}</TableCell>
                    <TableCell sx={rData}>{row.porcentaje}%</TableCell>
                    <TableCell sx={{ ...rData, fontWeight: 700, color: row.recaudacionBs > 0 ? '#E65100' : '#999' }}>{row.recaudacionBs > 0 ? formatBs(row.recaudacionBs) : '—'}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell sx={rTot} colSpan={4}>TOTAL ({recaudacionRows.length} registros)</TableCell>
                <TableCell sx={{ ...rTot, fontWeight: 700, color: '#1565C0' }}>{formatUSD(totalPropinaUSD)}</TableCell>
                <TableCell sx={{ ...rTot, fontWeight: 700 }}>{formatBs(totalPropina)}</TableCell>
                <TableCell sx={rTot}>—</TableCell>
                <TableCell sx={{ ...rTot, fontWeight: 800, bgcolor: '#E65100', color: '#fff', fontSize: '0.85rem' }}>{formatBs(totalRecaudacion)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1 }}>Fórmula: Recaudación = redondear a 10 (Excedente Bs × % Recaudación)</Typography>
      </Box>
    );
  };

  const renderGandolasTab = () => {
    if (filteredGandolas.length === 0) {
      return (
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
          <LocalShippingIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>No hay recepciones de gandolas</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {hasFilters ? 'No se encontraron recepciones con los filtros seleccionados.' : 'Las recepciones de gandolas cerradas aparecerán aquí.'}
          </Typography>
        </Paper>
      );
    }

    const gBorder = '1px solid #888';
    const gc = { border: gBorder, p: '5px 8px', fontSize: '0.75rem', lineHeight: 1.4 };
    const gSec = { ...gc, fontWeight: 700, bgcolor: '#1565C0', color: '#fff', textAlign: 'center', textTransform: 'uppercase' };
    const gTot = { ...gc, fontWeight: 700, bgcolor: '#E3F2FD', textAlign: 'center' };
    const gLbl = { ...gc, fontWeight: 600, whiteSpace: 'nowrap' };
    const gData = { ...gc, textAlign: 'center' };
    const dayNamesMap = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const totalLitersGandola = filteredGandolas.reduce((s, r) => s + (r.compartment1Liters || 0) + (r.compartment2Liters || 0) + (r.compartment3Liters || 0), 0);

    return (
      <Box>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Total Acumulado</Typography>
          <Chip label={`${formatNumber(totalLitersGandola, 0)} L totales`} color="primary" size="small" sx={{ fontWeight: 700 }} />
        </Box>
        <TableContainer>
          <Table size="small" sx={{ '& td, & th': { border: gBorder } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={gSec}>Fecha</TableCell><TableCell sx={gSec}>Hora Llegada</TableCell><TableCell sx={gSec}>Hora Salida</TableCell>
                <TableCell sx={gSec}>Chofer</TableCell><TableCell sx={gSec}>CI</TableCell><TableCell sx={gSec}>Compart. 1</TableCell>
                <TableCell sx={gSec}>Compart. 2</TableCell><TableCell sx={gSec}>Compart. 3</TableCell>
                <TableCell sx={{ ...gSec, bgcolor: '#2E7D32' }}>Total L</TableCell><TableCell sx={gSec}>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredGandolas.map((rec, idx) => {
                const totalL = (rec.compartment1Liters || 0) + (rec.compartment2Liters || 0) + (rec.compartment3Liters || 0);
                const parts = (rec.date || '').split('/');
                const recDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : null;
                const dayLabel = recDate ? dayNamesMap[recDate.getDay()] || '' : '';
                const isCompletada = rec.status === 'completada';
                return (
                  <TableRow key={rec.id || idx} hover>
                    <TableCell sx={gLbl}>{rec.date}{dayLabel && <Typography variant="caption" sx={{ display: 'block', color: '#888', fontStyle: 'italic' }}>{dayLabel}</Typography>}</TableCell>
                    <TableCell sx={gData}>{rec.arrivalTime || '—'}</TableCell>
                    <TableCell sx={gData}>{rec.departureTime || '—'}</TableCell>
                    <TableCell sx={{ ...gLbl, fontSize: '0.7rem' }}>{rec.gandolaDriver || rec.driverName || '—'}</TableCell>
                    <TableCell sx={{ ...gData, fontSize: '0.7rem' }}>{rec.driverCI || '—'}</TableCell>
                    <TableCell sx={gData}>{(rec.compartment1Liters || 0) > 0 ? formatNumber(rec.compartment1Liters, 0) : '—'}</TableCell>
                    <TableCell sx={gData}>{(rec.compartment2Liters || 0) > 0 ? formatNumber(rec.compartment2Liters, 0) : '—'}</TableCell>
                    <TableCell sx={gData}>{(rec.compartment3Liters || 0) > 0 ? formatNumber(rec.compartment3Liters, 0) : '—'}</TableCell>
                    <TableCell sx={{ ...gData, fontWeight: 700, color: '#2E7D32' }}>{totalL > 0 ? formatNumber(totalL, 0) : '—'}</TableCell>
                    <TableCell sx={gData}>
                      <Chip label={isCompletada ? 'Completada' : 'En Proceso'} size="small" color={isCompletada ? 'success' : 'warning'} variant="outlined" sx={{ fontWeight: 600, fontSize: '0.65rem', height: 22 }} />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell sx={gTot} colSpan={8}>TOTAL ({filteredGandolas.length} recepciones)</TableCell>
                <TableCell sx={{ ...gTot, fontWeight: 800, bgcolor: '#2E7D32', color: '#fff', fontSize: '0.85rem' }}>{formatNumber(totalLitersGandola, 0)} L</TableCell>
                <TableCell sx={gTot}>—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{TAB_CONFIG[activeTab].title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{getTabSubtitle()}</Typography>
      </Box>

      <Paper sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} variant="fullWidth"
          sx={{ bgcolor: '#f9f9f9', borderBottom: '2px solid', borderColor: 'divider',
            '& .MuiTab-root': { minHeight: 52, textTransform: 'none', fontWeight: 600, fontSize: '0.9rem', '&.Mui-selected': { color: '#CE1126', fontWeight: 700 } },
            '& .MuiTabs-indicator': { backgroundColor: '#CE1126', height: 3 },
          }}>
          {TAB_CONFIG.map((tab, idx) => (
            <Tab key={idx} label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{tab.icon}<span>{tab.label}</span></Box>} />
          ))}
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>Filtrar por fecha</Typography>
        </Box>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField label="Desde" type="date" size="small" fullWidth value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>) }} />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField label="Hasta" type="date" size="small" fullWidth value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><CalendarTodayIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>) }} />
          </Grid>
          <Grid item xs={12} sm={2}>
            {hasFilters && (
              <Button variant="outlined" size="small" startIcon={<ClearIcon />} onClick={handleClearFilters} fullWidth sx={{ height: 40 }}>Limpiar</Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {activeTab === TAB_CIERRES && renderCierresTab()}
      {activeTab === TAB_RECAUDACION && renderRecaudacionTab()}
      {activeTab === TAB_GANDOLAS && renderGandolasTab()}
      {renderDialog()}
    </Box>
  );
}