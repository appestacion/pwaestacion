// src/pages/supervisor/EstimacionLitrosVendidos.jsx
//
// Sección AISLADA de la app — no guarda en Firestore ni afecta el turno.
// Estima los litros vendidos en un período usando lectura inicial/final
// del surtidor. Entrada manual única (OCR eliminado).
//
// Cambios clave:
//   - Incluye FECHA y HORA en formato 07:00 AM
//   - La lectura inicial se auto-hereda del turno actual (como Lecturas.jsx)
//   - Botón "Pasar Finales → Iniciales" → mueve todas las finales a iniciales
//   - Solo enteros (sin decimales) — los contadores no manejan decimales
//   - No maneja tasa ni precio, solo litros vendidos
//   - Los datos persisten en localStorage hasta "Limpiar Todo"
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import InputAdornment from '@mui/material/InputAdornment';
import RefreshIcon from '@mui/icons-material/Refresh';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useConfigStore } from '../../store/useConfigStore.js';
import { useCierreStore } from '../../store/useCierreStore.js';
import { formatNumber, getVenezuelaDateString, getVenezuelaDate, formatDate, toInputDate } from '../../lib/formatters.js';
import { getIslandIds, ISLAND_LABELS } from '../../config/constants.js';

// ── localStorage persistence key ──
const LS_KEY = 'estimacionLitrosVendidos';

// ── Helpers ──

/** Obtener hora de inicio del turno según tipo, en formato 12h AM/PM */
function getShiftStartTime12h(shiftType) {
  if (shiftType === 'NOCTURNO') return '07:00 PM';
  return '07:00 AM';
}

/** Hora actual en formato 12h AM/PM (zona Venezuela) */
function getCurrentTime12hVE() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(now);
  const h = parts.find((p) => p.type === 'hour')?.value || '12';
  const m = parts.find((p) => p.type === 'minute')?.value || '00';
  const ap = parts.find((p) => p.type === 'dayPeriod')?.value || 'AM';
  return `${h}:${m} ${ap}`;
}

/** Convert "HH:mm AM/PM" to 24h "HH:mm" for comparison */
function time12to24(time12) {
  if (!time12) return '00:00';
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return time12;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ap = match[3].toUpperCase();
  if (ap === 'AM' && h === 12) h = 0;
  if (ap === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${m}`;
}

/** Parse time string "HH:mm AM/PM" to minutes since midnight */
function timeToMinutes(timeStr) {
  const t24 = time12to24(timeStr);
  const [h, m] = t24.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Calcular duración entre dos horas en formato "HH:mm AM/PM" */
function calcDuration(from, to) {
  let fromMin = timeToMinutes(from);
  let toMin = timeToMinutes(to);
  if (toMin < fromMin) toMin += 24 * 60; // Cruza medianoche
  const diff = toMin - fromMin;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

// ── Componente principal ──

export default function EstimacionLitrosVendidos() {
  const config = useConfigStore((s) => s.config) || {};
  const currentShift = useCierreStore((s) => s.currentShift);
  const islandsCount = config.islandsCount || 3;
  const pumpsPerIsland = config.pumpsPerIsland || 2;

  const islandIds = useMemo(() => getIslandIds(islandsCount), [islandsCount]);

  // ── Período de venta ──
  const shiftType = currentShift?.operatorShiftType || null;
  const defaultDesde = shiftType ? getShiftStartTime12h(shiftType) : '07:00 AM';
  const defaultHasta = getCurrentTime12hVE();
  const defaultFecha = toInputDate(getVenezuelaDate());

  const [fecha, setFecha] = useState(defaultFecha);
  const [desde, setDesde] = useState(defaultDesde);
  const [hasta, setHasta] = useState(defaultHasta);

  // ── Estado de lecturas: { "islandId-pumpNum": { inicial, final } } ──
  const buildInitialLecturas = useCallback(() => {
    const init = {};
    islandIds.forEach((id) => {
      for (let p = 1; p <= pumpsPerIsland; p++) {
        init[`${id}-${p}`] = { inicial: 0, final: 0 };
      }
    });
    return init;
  }, [islandIds, pumpsPerIsland]);

  // ★ Identificador del turno actual — se usa para detectar cambios de turno
  // y evitar mostrar lecturas iniciales stalé de un turno anterior.
  const currentShiftId = currentShift?.id || null;

  // Verifica si el localStorage pertenece al turno actual (mismo id).
  // Si currentShift aún no carga (null), devuelve false para forzar refresh
  // automático cuando el turno cargue.
  const initialDataMatchesShift = (() => {
    if (!currentShiftId) return false;
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      return parsed.shiftKey === currentShiftId;
    } catch (e) {
      return false;
    }
  })();

  const [lecturas, setLecturas] = useState(() => {
    // Intentar restaurar desde localStorage
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);

        // ★ FIX LECTURA INICIAL: Si el localStorage pertenece a OTRO turno
        // (shiftKey distinto), descartar los datos previos. Así las lecturas
        // iniciales se heredan del turno actual y no se muestran valores
        // stalé del turno anterior.
        if (currentShiftId && parsed.shiftKey && parsed.shiftKey !== currentShiftId) {
          console.log('[EstimacionLitros] Turno cambió desde última sesión, descartando localStorage.');
          localStorage.removeItem(LS_KEY);
          return buildInitialLecturas();
        }

        if (parsed.lecturas && typeof parsed.lecturas === 'object') {
          const rebuilt = buildInitialLecturas();
          for (const key of Object.keys(rebuilt)) {
            if (parsed.lecturas[key]) {
              rebuilt[key] = {
                inicial: parseInt(parsed.lecturas[key].inicial, 10) || 0,
                final: parseInt(parsed.lecturas[key].final, 10) || 0,
              };
            }
          }
          if (parsed.fecha) setFecha(parsed.fecha);
          if (parsed.desde) setDesde(parsed.desde);
          if (parsed.hasta) setHasta(parsed.hasta);
          return rebuilt;
        }
      }
    } catch (e) {
      console.warn('[EstimacionLitros] Error restaurando localStorage:', e);
    }
    return buildInitialLecturas();
  });

  // ★ Ref que rastrea para qué turno ya aplicamos la auto-herencia.
  // - Si restauramos localStorage del mismo turno (initialDataMatchesShift=true),
  //   se inicializa con el id del turno actual (no forzar refresh).
  // - En caso contrario (turno nuevo, localStorage vacío/stalé, o turno no cargado),
  //   se inicializa en null para forzar el refresh cuando el turno cargue.
  const appliedShiftIdRef = useRef(initialDataMatchesShift ? currentShiftId : null);

  // ★ AUTO-HERENCIA: Las lecturas iniciales se cargan automáticamente
  // desde currentShift.pumpReadings (que ya tiene initialReading pre-llenado).
  // - Si el turno cambió (shiftChanged=true), se fuerza el refresh de TODAS
  //   las iniciales desde el turno actual (sobrescribe valores stalé).
  // - Si seguimos en el mismo turno, solo se aplica si el valor actual es 0
  //   (no sobrescribe datos del usuario dentro del mismo turno).
  const hasAutoInitial = useMemo(() => {
    return (currentShift?.pumpReadings || []).some((r) => r.initialReading > 0);
  }, [currentShift?.pumpReadings]);

  useEffect(() => {
    if (!currentShift?.pumpReadings) return;
    if (!currentShiftId) return;

    const pumpReadings = currentShift.pumpReadings;
    const shiftChanged = appliedShiftIdRef.current !== currentShiftId;
    appliedShiftIdRef.current = currentShiftId;

    setLecturas((prev) => {
      const updated = { ...prev };
      let applied = 0;

      for (const pr of pumpReadings) {
        const key = `${pr.islandId}-${pr.pumpNumber}`;
        if (updated[key] === undefined) continue;

        const ir = parseInt(pr.initialReading, 10) || 0;

        if (ir > 0 && (shiftChanged || updated[key].inicial === 0)) {
          updated[key] = { ...updated[key], inicial: ir };
          applied++;
        }
      }

      if (applied > 0) {
        console.log(`[EstimacionLitros] Auto-heredadas ${applied} lecturas iniciales desde el turno actual (shiftChanged=${shiftChanged}).`);
      }
      return applied > 0 ? updated : prev;
    });
  }, [currentShift?.pumpReadings, currentShiftId]);

  // ── Persistir a localStorage cada vez que cambien las lecturas o el período ──
  // ★ Incluye shiftKey = currentShift.id para detectar cambios de turno
  // en la próxima sesión y descartar datos stalé.
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        lecturas,
        fecha,
        desde,
        hasta,
        shiftKey: currentShiftId,
      }));
    } catch (e) {
      console.warn('[EstimacionLitros] Error guardando localStorage:', e);
    }
  }, [lecturas, fecha, desde, hasta, currentShiftId]);

  // ── Actualizar campo manual ──
  const handleLecturaChange = (pumpKey, field) => (e) => {
    const raw = e.target.value;
    const v = parseInt(raw, 10);
    const val = isNaN(v) || v < 0 ? 0 : v;
    setLecturas((prev) => ({
      ...prev,
      [pumpKey]: { ...prev[pumpKey], [field]: val },
    }));
  };

  // ── Pasar lecturas finales a iniciales ──
  const handlePassFinalesToIniciales = () => {
    setLecturas((prev) => {
      const updated = {};
      for (const key of Object.keys(prev)) {
        updated[key] = {
          inicial: prev[key].final,
          final: 0,
        };
      }
      return updated;
    });
  };

  // ── Reset (limpia TODO incluyendo localStorage) ──
  const handleReset = () => {
    setLecturas(buildInitialLecturas());
    setFecha(toInputDate(getVenezuelaDate()));
    setDesde(shiftType ? getShiftStartTime12h(shiftType) : '07:00 AM');
    setHasta(getCurrentTime12hVE());
    localStorage.removeItem(LS_KEY);
  };

  // ── Cálculos ──
  const pumpResults = useMemo(() => {
    const results = [];
    islandIds.forEach((islandId) => {
      for (let pumpNum = 1; pumpNum <= pumpsPerIsland; pumpNum++) {
        const key = `${islandId}-${pumpNum}`;
        const lec = lecturas[key] || { inicial: 0, final: 0 };
        const litros = lec.final > lec.inicial ? lec.final - lec.inicial : 0;
        results.push({
          islandId,
          pumpNumber: pumpNum,
          key,
          inicial: lec.inicial,
          final: lec.final,
          litros,
        });
      }
    });
    return results;
  }, [lecturas, islandIds, pumpsPerIsland]);

  // Agrupar por isla
  const readingsByIsland = useMemo(() => {
    const groups = {};
    pumpResults.forEach((r) => {
      if (!groups[r.islandId]) groups[r.islandId] = [];
      groups[r.islandId].push(r);
    });
    return islandIds.map((id) => {
      const items = groups[id] || [];
      const totalLiters = items.reduce((s, r) => s + r.litros, 0);
      return { islandId: id, items, totalLiters };
    });
  }, [pumpResults, islandIds]);

  const totalLitros = useMemo(() => pumpResults.reduce((s, r) => s + r.litros, 0), [pumpResults]);
  const anyHasFinal = pumpResults.some((r) => r.final > 0 && r.final > r.inicial);

  // ── Litros por isla (para las tarjetas) ──
  const litersByIsland = useMemo(() => {
    const result = {};
    readingsByIsland.forEach(({ islandId, totalLiters }) => {
      result[islandId] = totalLiters;
    });
    return result;
  }, [readingsByIsland]);

  // ── Fecha formateada para mostrar ──
  const fechaDisplay = useMemo(() => {
    if (!fecha) return '—';
    const d = new Date(fecha + 'T12:00:00');
    return formatDate(d);
  }, [fecha]);

  // ── WhatsApp ──
  const handleSendWhatsApp = () => {
    const lines = [
      '⛽ *ESTIMACIÓN DE LITROS VENDIDOS*',
      `📅 Fecha: ${fechaDisplay}`,
      `🕐 Período: ${desde} — ${hasta}`,
      '',
    ];

    readingsByIsland.forEach(({ islandId, items, totalLiters }) => {
      lines.push(`📍 ${ISLAND_LABELS[islandId]}:`);
      items.forEach((r) => {
        if (r.inicial > 0 || r.final > 0) {
          lines.push(`   Surt. ${r.pumpNumber}: ${r.inicial} → ${r.final} = ${r.litros} Lts`);
        }
      });
      lines.push(`   Subtotal: ${totalLiters} Lts`);
      lines.push('');
    });

    lines.push('──────────────');
    lines.push(`📊 *TOTAL LITROS: ${totalLitros} Lts*`);

    const text = lines.join('\n');
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // ── Formatear fecha para mostrar en input date ──
  const handleFechaChange = (e) => {
    setFecha(e.target.value);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Estimación de Litros Vendidos
          </Typography>
        </Box>
        <Chip
          label="Sección aislada — no afecta el turno"
          color="info"
          size="small"
          variant="outlined"
        />
      </Box>

      {/* ═══ Fecha y Período de Venta ═══ */}
      <Card sx={{ mb: 2, border: '2px solid', borderColor: 'primary.light' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CalendarTodayIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
              Fecha y Período de Venta
            </Typography>
          </Box>
          <Grid container spacing={2} alignItems="center">
            {/* Fecha */}
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Fecha"
                type="date"
                value={fecha}
                onChange={handleFechaChange}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ fontSize: '0.75rem' }}>
                      📅
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            {/* Desde */}
            <Grid item xs={5} sm={3}>
              <TextField
                fullWidth
                label="Desde"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                size="small"
                placeholder="07:00 AM"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ fontSize: '0.75rem' }}>
                      🕐
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            {/* Flecha */}
            <Grid item xs={2} sm={1} sx={{ textAlign: 'center' }}>
              <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                →
              </Typography>
            </Grid>
            {/* Hasta */}
            <Grid item xs={5} sm={3}>
              <TextField
                fullWidth
                label="Hasta"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                size="small"
                placeholder="07:00 PM"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ fontSize: '0.75rem' }}>
                      🕐
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            {/* Duración */}
            <Grid item xs={12} sm={2}>
              <Chip
                sx={{ bgcolor: '#E3F2FD', fontWeight: 700, color: '#1565C0', p: 2, fontSize: '0.95rem' }}
                label={desde && hasta ? calcDuration(desde, hasta) : '—'}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ═══ Botón: Pasar Finales → Iniciales ═══ */}
      <Box sx={{ mb: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<ArrowDownwardIcon />}
          onClick={handlePassFinalesToIniciales}
          sx={{
            borderColor: '#7B1FA2',
            color: '#7B1FA2',
            fontWeight: 700,
            borderRadius: 2,
            py: 1,
            '&:hover': { borderColor: '#4A148C', bgcolor: '#F3E5F5' },
          }}
        >
          Pasar Finales → Iniciales
        </Button>
      </Box>

      {/* ═══ Lecturas por Isla ═══ */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LocalGasStationIcon sx={{ color: 'secondary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main' }}>
              Lecturas por Isla (Litros)
            </Typography>
            {hasAutoInitial && (
              <Chip
                icon={<AutoAwesomeIcon sx={{ fontSize: '0.85rem !important' }} />}
                label="Lect. inicial automática"
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem', color: '#1565C0', borderColor: '#1565C0', bgcolor: '#E3F2FD' }}
              />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
            La lectura inicial se carga automáticamente desde la lectura final del turno anterior.
            Los campos siguen siendo editables por si requieren corrección.
            Solo números enteros — los contadores no manejan decimales.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: '14%' }}>Isla</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '14%' }}>Surtidor</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#E3F2FD', width: '24%' }} align="right">
                    Lectura Inicial
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '24%' }} align="right">
                    Lectura Final
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#E8F5E9', color: '#2E7D32', width: '24%' }} align="right">
                    Litros Vendidos
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {readingsByIsland.map((island) => (
                  <React.Fragment key={`island-${island.islandId}`}>
                    {island.items.map((r, rIdx) => {
                      const hasFinal = r.final > 0 && r.final > r.inicial;
                      const isFirstPump = rIdx === 0;
                      return (
                        <TableRow key={r.key}>
                          {/* Isla — solo en la primera fila, con rowspan */}
                          {isFirstPump && (
                            <TableCell
                              rowSpan={island.items.length}
                              sx={{ verticalAlign: 'middle', borderRight: '1px solid', borderColor: 'divider' }}
                            >
                              <Chip
                                label={ISLAND_LABELS[r.islandId]}
                                size="small"
                                sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                              />
                            </TableCell>
                          )}
                          <TableCell>Surt. {r.pumpNumber}</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#F5F5F5' }}>
                            <TextField
                              type="number"
                              variant="standard"
                              value={r.inicial || ''}
                              onChange={handleLecturaChange(r.key, 'inicial')}
                              InputProps={{
                                sx: { '& input': { textAlign: 'right', width: 100 } },
                              }}
                              inputProps={{ min: 0, step: 1, inputMode: 'numeric' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              variant="standard"
                              value={r.final || ''}
                              onChange={handleLecturaChange(r.key, 'final')}
                              InputProps={{
                                sx: { '& input': { textAlign: 'right', width: 100 } },
                              }}
                              inputProps={{ min: 0, step: 1, inputMode: 'numeric' }}
                            />
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 700,
                              bgcolor: '#E8F5E9',
                              color: hasFinal ? '#2E7D32' : '#9E9E9E',
                              fontSize: '0.95rem',
                            }}
                          >
                            {hasFinal ? formatNumber(r.litros, 0) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Subtotal por isla */}
                    <TableRow key={`subtotal-${island.islandId}`}>
                      <TableCell
                        colSpan={3}
                        sx={{ bgcolor: '#F3E5F5' }}
                      />
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, bgcolor: '#F3E5F5', color: '#7B1FA2', fontSize: '0.85rem' }}
                      >
                        Subtotal {ISLAND_LABELS[island.islandId]}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, bgcolor: '#F3E5F5', color: '#7B1FA2', fontSize: '0.95rem' }}
                      >
                        {island.items.some((r) => r.final > 0 && r.final > r.inicial)
                          ? `${formatNumber(island.totalLiters, 0)} L`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
                {/* Total general */}
                <TableRow>
                  <TableCell
                    colSpan={3}
                    sx={{ bgcolor: '#E0E0E0' }}
                  />
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, bgcolor: '#E0E0E0', color: '#212121', fontSize: '0.95rem' }}
                  >
                    TOTAL GENERAL
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      bgcolor: '#C8E6C9',
                      color: anyHasFinal ? '#1B5E20' : '#9E9E9E',
                      fontSize: '1.1rem',
                    }}
                  >
                    {anyHasFinal ? `${formatNumber(totalLitros, 0)} L` : '—'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ═══ Tarjetas resumen ═══ */}
      {anyHasFinal && (
        <>
          <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700, color: 'primary.main' }}>
            Resumen — {fechaDisplay} — {desde} a {hasta}
          </Typography>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {/* Total general */}
            <Grid item xs={6} sm={3}>
              <Card sx={{ height: '100%', borderLeft: '4px solid #1B5E20' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                    Total Litros
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1B5E20', mt: 0.5 }}>
                    {formatNumber(totalLitros, 0)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Lts</Typography>
                </CardContent>
              </Card>
            </Grid>
            {/* Por isla */}
            {islandIds.map((id) => (
              <Grid item xs={6} sm={3} key={id}>
                <Card sx={{ height: '100%', borderLeft: '4px solid', borderColor: id === 1 ? '#CE1126' : id === 2 ? '#003399' : '#00A651' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem' }}>
                      {ISLAND_LABELS[id]}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
                      {formatNumber(litersByIsland[id] || 0, 0)}
                    </Typography>
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>L</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Desglose por isla */}
          <Card sx={{ mb: 2, bgcolor: '#FFF8E1', border: '2px solid #FFB74D' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1 }}>
                Desglose por Isla
              </Typography>
              {readingsByIsland
                .filter((isl) => isl.totalLiters > 0)
                .map((isl) => (
                  <Box key={isl.islandId} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">
                      {ISLAND_LABELS[isl.islandId]}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatNumber(isl.totalLiters, 0)} Lts
                    </Typography>
                  </Box>
                ))}
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Total General</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1B5E20' }}>
                  {formatNumber(totalLitros, 0)} Lts
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══ Botones: WhatsApp + Limpiar ═══ */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<WhatsAppIcon />}
          onClick={handleSendWhatsApp}
          sx={{
            bgcolor: '#25D366',
            color: 'white',
            borderRadius: 3,
            px: 3,
            py: 1,
            fontWeight: 700,
            '&:hover': { bgcolor: '#1DA851' },
          }}
        >
          Enviar por WhatsApp
        </Button>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={handleReset}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            borderRadius: 3,
            px: 3,
            py: 1,
            fontWeight: 700,
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          Limpiar Todo
        </Button>
      </Box>
    </Box>
  );
}