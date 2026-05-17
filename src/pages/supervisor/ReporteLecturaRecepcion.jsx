// src/pages/supervisor/ReporteLecturaRecepcion.jsx
import React, { useState, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useGandolaStore } from '../../store/useGandolaStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { formatNumber, getVenezuelaDateString } from '../../lib/formatters.js';
import { cmToLiters } from '../../lib/conversions.js';

// ── Estilos tipo formulario impreso ──
const b = '1px solid #666';
const c = { border: b, p: '3px 5px', fontSize: '0.7rem', lineHeight: 1.2 };
const h = { ...c, fontWeight: 700, bgcolor: '#d0d0d0', textAlign: 'center' };
const tot = { ...c, fontWeight: 700, bgcolor: '#dcdcdc' };
const sec = { ...c, fontWeight: 700, bgcolor: '#bbb', textAlign: 'center', textTransform: 'uppercase' };
const DASH = '—';

// ── Helper: sumar/restar días a una fecha en formato dd/MM/yyyy ──
function shiftDateStr(dateStr, days) {
  const [d, m, y] = dateStr.split('/').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

export default function ReporteLecturaRecepcion() {
  const { currentShift, shiftsHistory, loadShiftsHistory, loadShiftsByDate } = useCierreStore();
  const { currentReception, receptionsHistory, loadReceptionsHistory } = useGandolaStore();
  const config = useConfigStore((s) => s.config);
  const tanksCount = config.tanksCount || 3;
  const islandsCount = config.islandsCount || 3;

  const selectedDate = currentShift?.date || getVenezuelaDateString();
  const [dayShifts, setDayShifts] = useState([]);
  const supervisorType = currentShift?.supervisorShiftType || 'PM';
  const is1TS = supervisorType === 'AM';

  useEffect(() => {
    loadShiftsHistory();
    loadReceptionsHistory();
  }, [loadShiftsHistory, loadReceptionsHistory]);

  // ── Cargar turnos del día anterior, actual y siguiente ──
  // 1TS (AM) tiene date = ayer, 2TS (PM) tiene date = hoy.
  // Cargar 3 días asegura encontrar ambos shifts sin importar quién ve el reporte.
  useEffect(() => {
    if (!selectedDate) return;
    const loadReport = async () => {
      try {
        const prevDate = shiftDateStr(selectedDate, -1);
        const nextDate = shiftDateStr(selectedDate, 1);

        const [foundPrev, foundCurrent, foundNext] = await Promise.all([
          loadShiftsByDate(prevDate),
          loadShiftsByDate(selectedDate),
          loadShiftsByDate(nextDate),
        ]);

        // Fusionar y deduplicar por ID
        const seen = new Set();
        let all = [];
        [...(foundCurrent || []), ...(foundPrev || []), ...(foundNext || [])].forEach(sh => {
          if (!seen.has(sh.id)) {
            seen.add(sh.id);
            all.push(sh);
          }
        });

        // Ordenar por createdAt descendente para que find() tome el más reciente
        all.sort((a, b) => {
          const ta = new Date(a.createdAt || 0).getTime();
          const tb = new Date(b.createdAt || 0).getTime();
          return tb - ta;
        });

        // Incluir turno en progreso si no está ya en la lista
        if (currentShift && currentShift.status === 'en_progreso') {
          if (!all.find(sh => sh.id === currentShift.id)) {
            all.unshift(currentShift);
          }
        }
        setDayShifts(all);
      } catch (err) {
        console.error('Error cargando datos del reporte:', err);
      }
    };
    loadReport();
  }, [selectedDate, currentShift, shiftsHistory, loadShiftsByDate]);

  const diurnoShift = useMemo(() => dayShifts.find(sh => sh.operatorShiftType === 'DIURNO'), [dayShifts]);
  const nocturnoShift = useMemo(() => dayShifts.find(sh => sh.operatorShiftType === 'NOCTURNO'), [dayShifts]);

  // ── Gandola: buscar en fecha actual y fecha adyacente ──
  // Gandola siempre usa getVenezuelaDateString() (hoy),
  // pero 1TS tiene selectedDate = ayer, así que también busca hoy.
  const gandola = useMemo(() => {
    const todayStr = getVenezuelaDateString();
    // Primero buscar por la fecha del gandola (hoy) en el historial
    const fromHistory = receptionsHistory.find(r => r.date === todayStr);
    if (fromHistory) return fromHistory;
    // Luego buscar por selectedDate
    const fromSelectedDate = receptionsHistory.find(r => r.date === selectedDate);
    if (fromSelectedDate) return fromSelectedDate;
    // Finalmente verificar recepción activa
    if (currentReception) return currentReception;
    return null;
  }, [selectedDate, receptionsHistory, currentReception]);

  // ── Agrupar surtidores por isla (2 surtidores por isla) ──
  const getIslandsWithPumps = (shift) => {
    const map = {};
    for (let i = 1; i <= islandsCount; i++) {
      map[i] = { islandId: i, pumps: [] };
    }
    if (shift?.pumpReadings) {
      shift.pumpReadings.forEach(r => {
        const id = r.islandId;
        if (map[id]) {
          map[id].pumps.push({
            pumpNumber: r.pumpNumber,
            initialReading: r.initialReading || 0,
            finalReading: r.finalReading || 0,
            litersSold: Math.max(0, r.litersSold || 0),
          });
        }
      });
    }
    Object.values(map).forEach(isl => {
      isl.pumps.sort((a, b) => a.pumpNumber - b.pumpNumber);
      while (isl.pumps.length < 2) {
        isl.pumps.push({
          pumpNumber: isl.pumps.length + 1,
          initialReading: 0,
          finalReading: 0,
          litersSold: 0,
          empty: true,
        });
      }
    });
    return Object.values(map);
  };

  const diurnoIslands = useMemo(() => getIslandsWithPumps(diurnoShift), [diurnoShift, islandsCount]);
  const nocturnoIslands = useMemo(() => getIslandsWithPumps(nocturnoShift), [nocturnoShift, islandsCount]);
  const diurnoTotal = useMemo(() => diurnoIslands.reduce((s, i) => s + i.pumps.reduce((ps, p) => ps + p.litersSold, 0), 0), [diurnoIslands]);
  const nocturnoTotal = useMemo(() => nocturnoIslands.reduce((s, i) => s + i.pumps.reduce((ps, p) => ps + p.litersSold, 0), 0), [nocturnoIslands]);

  // ── Datos de visualización para NOCTURNO ──
  // Siempre ajusta lecturas iniciales desde lectura final del diurno,
  // para que ambos supervisores (1TS y 2TS) vean datos completos.
  const displayNocturnoIslands = useMemo(() => {
    return nocturnoIslands.map(nIsl => {
      const dIsl = diurnoIslands.find(d => d.islandId === nIsl.islandId);
      const modifiedPumps = nIsl.pumps.map((p, idx) => {
        const dPump = dIsl?.pumps?.[idx];
        if (dPump && !dPump.empty && !p.empty) {
          const newInitial = dPump.finalReading;
          return {
            ...p,
            initialReading: newInitial,
            litersSold: Math.max(0, p.finalReading - newInitial),
          };
        }
        return p;
      });
      return { ...nIsl, pumps: modifiedPumps };
    });
  }, [nocturnoIslands, diurnoIslands]);

  const displayNocturnoTotal = useMemo(() =>
    displayNocturnoIslands.reduce((s, i) => s + i.pumps.reduce((ps, p) => ps + p.litersSold, 0), 0),
    [displayNocturnoIslands]
  );

  // Ambos supervisores ven los datos nocturnos cuando existen (1TS ya los llenó)
  const nocturnoShiftForDisplay = nocturnoShift;

  // ── Tanques por sección ──
  const getTankRows = (source, key) => Array.from({ length: tanksCount }, (_, i) => {
    const tankId = i + 1;
    const tr = source?.tankReadings?.find(r => r.tankId === tankId);
    const cm = tr ? (tr[key] || 0) : 0;
    return { tankId, cm, liters: cmToLiters(cm) };
  });

  // 1TS: Inventario Inicial desde lecturas de tanques del turno actual (1TS)
  // 2TS: Inventario Inicial desde el turno del 1TS (shift nocturno)
  // Ahora nocturnoShift siempre se encuentra porque cargamos 3 días de shifts
  const invInicial = useMemo(() => getTankRows(is1TS ? currentShift : nocturnoShift, 'cm'), [is1TS, currentShift, nocturnoShift, tanksCount]);
  const antesDesc = useMemo(() => Array.from({ length: tanksCount }, (_, i) => {
    const tankId = i + 1;
    const tr = gandola?.tankReadings?.find(r => r.tankId === tankId);
    const cm = tr?.cmBefore || 0;
    return { tankId, cm, liters: cmToLiters(cm) };
  }), [gandola, tanksCount]);
  const despDesc = useMemo(() => Array.from({ length: tanksCount }, (_, i) => {
    const tankId = i + 1;
    const tr = gandola?.tankReadings?.find(r => r.tankId === tankId);
    const cm = tr?.cmAfter || 0;
    return { tankId, cm, liters: cmToLiters(cm) };
  }), [gandola, tanksCount]);
  // 2TS: Inventario Final desde lecturas de tanques del turno actual (2TS)
  // 1TS: Inventario Final desde el turno del 2TS (shift diurno)
  const invFinal = useMemo(() => getTankRows(!is1TS ? currentShift : diurnoShift, 'cm'), [is1TS, currentShift, diurnoShift, tanksCount]);

  const totalInvInicial = useMemo(() => invInicial.reduce((s, tk) => s + tk.liters, 0), [invInicial]);
  const totalAntes = useMemo(() => antesDesc.reduce((s, tk) => s + tk.liters, 0), [antesDesc]);
  const totalDespues = useMemo(() => despDesc.reduce((s, tk) => s + tk.liters, 0), [despDesc]);
  const totalInvFinal = useMemo(() => invFinal.reduce((s, tk) => s + tk.liters, 0), [invFinal]);
  const totalGandola = useMemo(() => {
    if (!gandola?.tankReadings) return 0;
    return gandola.tankReadings.reduce((s, tk) => s + (tk.litersDifference || 0), 0);
  }, [gandola]);

  const totalCompartment = useMemo(() => {
    if (!gandola) return 0;
    return (gandola.compartment1Liters || 0) + (gandola.compartment2Liters || 0) + (gandola.compartment3Liters || 0);
  }, [gandola]);

  const hasData = dayShifts.length > 0;
  const tasa1 = diurnoShift?.tasa1 || nocturnoShift?.tasa1 || 0;
  const tasa2 = nocturnoShift?.tasa2 || 0;

  // ── Render: Tabla de una Isla ──
  const renderIslaTable = (isl, shift) => {
    const filled = !!shift;
    const totalLitros = isl.pumps.reduce((s, p) => s + p.litersSold, 0);
    return (
      <TableContainer>
        <Table size="small" sx={{ '& td': { border: b } }}>
          <TableBody>
            <TableRow>
              <TableCell sx={sec} colSpan={4}>ISLA {isl.islandId}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={h}>Surt.</TableCell>
              <TableCell sx={h}>Lect. Inicial</TableCell>
              <TableCell sx={h}>Lect. Final</TableCell>
              <TableCell sx={h}>Litros</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ ...c, fontWeight: 600, textAlign: 'center' }}>1</TableCell>
              <TableCell sx={c} align="center">
                {filled && isl.pumps[0] && !isl.pumps[0].empty ? formatNumber(isl.pumps[0].initialReading, 0) : DASH}
              </TableCell>
              <TableCell sx={c} align="center">
                {filled && isl.pumps[0] && !isl.pumps[0].empty ? formatNumber(isl.pumps[0].finalReading, 0) : DASH}
              </TableCell>
              <TableCell sx={{ ...c, fontWeight: 600 }} align="center">
                {filled && isl.pumps[0] && !isl.pumps[0].empty ? formatNumber(isl.pumps[0].litersSold, 0) : DASH}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ ...c, fontWeight: 600, textAlign: 'center' }}>2</TableCell>
              <TableCell sx={c} align="center">
                {filled && isl.pumps[1] && !isl.pumps[1].empty ? formatNumber(isl.pumps[1].initialReading, 0) : DASH}
              </TableCell>
              <TableCell sx={c} align="center">
                {filled && isl.pumps[1] && !isl.pumps[1].empty ? formatNumber(isl.pumps[1].finalReading, 0) : DASH}
              </TableCell>
              <TableCell sx={{ ...c, fontWeight: 600 }} align="center">
                {filled && isl.pumps[1] && !isl.pumps[1].empty ? formatNumber(isl.pumps[1].litersSold, 0) : DASH}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ ...tot, textAlign: 'right' }} colSpan={3}>Total Litros:</TableCell>
              <TableCell sx={{ ...tot, textAlign: 'center' }}>{filled ? formatNumber(totalLitros, 0) : DASH}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // ── Render: Total del turno ──
  const renderTotalTable = (label, value, shift) => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border: b } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={{ ...tot, bgcolor: '#999', textAlign: 'right', color: '#fff', fontSize: '0.75rem' }} colSpan={2}>{label}</TableCell>
            <TableCell sx={{ ...tot, bgcolor: '#999', textAlign: 'center', color: '#fff', fontSize: '0.78rem' }}>
              {shift ? formatNumber(value, 0) : DASH}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ── Render: Sección de tanques ──
  const renderTankSection = (data, label, totalLabel, totalVal, filled) => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border: b } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={sec} colSpan={tanksCount + 1}>{label}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={h}></TableCell>
            {data.map(tk => (
              <TableCell key={tk.tankId} sx={h} align="center">TQ {tk.tankId}</TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableCell sx={{ ...c, fontWeight: 600 }}>CM</TableCell>
            {data.map(tk => (
              <TableCell key={tk.tankId} sx={c} align="center">{filled ? (tk.cm > 0 ? formatNumber(tk.cm, 1) : DASH) : DASH}</TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableCell sx={{ ...c, fontWeight: 600 }}>Litros</TableCell>
            {data.map(tk => (
              <TableCell key={tk.tankId} sx={c} align="center">{filled ? (tk.liters > 0 ? formatNumber(tk.liters, 0) : DASH) : DASH}</TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableCell sx={{ ...tot, textAlign: 'right' }} colSpan={tanksCount}>{totalLabel}</TableCell>
            <TableCell sx={{ ...tot, textAlign: 'center' }}>{filled ? formatNumber(totalVal, 0) : DASH}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ── Render: Gandola ──
  const renderGandolaTable = () => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border: b } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={{ ...tot, bgcolor: '#fff3cd', textAlign: 'right', color: '#856404' }}>Gandola:</TableCell>
            <TableCell sx={{ ...tot, textAlign: 'center', bgcolor: '#fff3cd', color: '#856404', fontWeight: 800 }}>
              {gandola ? formatNumber(totalCompartment, 0) : DASH}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ── Render: Total General ──
  const renderTotalGeneral = () => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border: b } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={{ ...tot, bgcolor: '#78909c', textAlign: 'right', color: '#fff', fontSize: '0.75rem' }}>Total General:</TableCell>
            <TableCell sx={{ ...tot, bgcolor: '#78909c', textAlign: 'center', color: '#fff', fontSize: '0.78rem' }}>
              {formatNumber(diurnoTotal + displayNocturnoTotal, 0)} L
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box>
      {/* ── Encabezado con Logo ── */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {config.stationLogo ? (
            <Avatar
              src={config.stationLogo}
              alt={config.stationName}
              sx={{ width: 64, height: 64, borderRadius: 1.5 }}
              variant="rounded"
            />
          ) : (
            <Box sx={{ width: 64, height: 64, borderRadius: 1.5, bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LocalGasStationIcon sx={{ fontSize: 40, color: 'grey.500' }} />
            </Box>
          )}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
              Reporte Lectura y Recepción
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {config.stationName}{config.stationRif !== 'J-00000000-0' ? ` — ${config.stationRif}` : ''}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            component="img"
            src="/PDVSA.png"
            alt="PDVSA"
            sx={{ width: 100, height: 'auto', objectFit: 'contain' }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Chip
              icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
              label={selectedDate}
              size="small"
              variant="outlined"
            />
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Tasa1: {formatNumber(tasa1, 2)}</Typography>
              {is1TS && (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Tasa2: {tasa2 > 0 ? formatNumber(tasa2, 2) : DASH}</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      {!hasData ? (
        <Alert severity="warning">No hay datos para la fecha {selectedDate}.</Alert>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '3fr 2fr 3fr' },
          gap: 1.5,
        }}>
          {/* ═══ COLUMNA IZQUIERDA — 7:00 AM a 7:00 PM ═══ */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'center', bgcolor: '#90a4ae', color: '#fff', py: 0.5, borderRadius: 0.5, fontSize: '0.78rem' }}>
              7:00 AM a 7:00 PM
            </Typography>
            {diurnoIslands.map(isl => (
              <Box key={isl.islandId}>{renderIslaTable(isl, diurnoShift)}</Box>
            ))}
            {renderTotalTable('Total 1:', diurnoTotal, diurnoShift)}
          </Box>

          {/* ═══ COLUMNA CENTRAL — TANQUES ═══ */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'center', bgcolor: '#90a4ae', color: '#fff', py: 0.5, borderRadius: 0.5, fontSize: '0.78rem' }}>
              7:00 AM a 7:00 PM
            </Typography>
            {renderTankSection(invInicial, 'INVENTARIO INICIAL', 'Inicial Tanques:', totalInvInicial, is1TS ? !!currentShift : !!nocturnoShift)}
            {renderTankSection(antesDesc, 'ANTES DE LA DESCARGA', 'Total:', totalAntes, !!gandola)}
            {renderGandolaTable()}
            {renderTankSection(despDesc, 'DESPUÉS DE LA DESCARGA', 'Total:', totalDespues, !!gandola)}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'center', bgcolor: '#90a4ae', color: '#fff', py: 0.5, borderRadius: 0.5, fontSize: '0.78rem' }}>
              7:00 PM a 7:00 AM
            </Typography>
            {renderTankSection(invFinal, 'INVENTARIO FINAL', 'Final Tanques:', totalInvFinal, !is1TS ? !!currentShift : !!diurnoShift)}
            {!!nocturnoShiftForDisplay && diurnoTotal > 0 && displayNocturnoTotal > 0 && renderTotalGeneral()}
          </Box>

          {/* ═══ COLUMNA DERECHA — 7:00 PM a 7:00 AM ═══ */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'center', bgcolor: '#90a4ae', color: '#fff', py: 0.5, borderRadius: 0.5, fontSize: '0.78rem' }}>
              7:00 PM a 7:00 AM
            </Typography>
            {displayNocturnoIslands.map(isl => (
              <Box key={isl.islandId}>{renderIslaTable(isl, nocturnoShiftForDisplay)}</Box>
            ))}
            {renderTotalTable('Total 2:', displayNocturnoTotal, nocturnoShiftForDisplay)}
          </Box>
        </Box>
      )}
    </Box>
  );
}