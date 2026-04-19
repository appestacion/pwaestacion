// src/pages/supervisor/ReporteLecturaRecepcion.jsx
import React, { useState, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useGandolaStore } from '../../store/useGandolaStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { formatNumber, getVenezuelaDateString } from '../../lib/formatters.js';
import { TANK_LABELS } from '../../config/constants.js';

export default function ReporteLecturaRecepcion() {
  const { currentShift, shiftsHistory, loadShiftsHistory, loadShiftsByDate } = useCierreStore();
  const { currentReception, receptionsHistory, loadReceptionsHistory } = useGandolaStore();
  const config = useConfigStore((s) => s.config);
  const tanksCount = config.tanksCount || 3;

  const [selectedDate, setSelectedDate] = useState(() =>
    currentShift?.date || getVenezuelaDateString()
  );

  const [dayShifts, setDayShifts] = useState([]);

  useEffect(() => {
    loadShiftsHistory();
    loadReceptionsHistory();
  }, [loadShiftsHistory, loadReceptionsHistory]);

  useEffect(() => {
    if (!selectedDate) return;
    const loadReport = async () => {
      try {
        const found = await loadShiftsByDate(selectedDate);
        let all = [...(found || [])];
        if (currentShift && currentShift.date === selectedDate && currentShift.status === 'en_progreso') {
          if (!all.find(s => s.id === currentShift.id)) {
            all = [...all, currentShift];
          }
        }
        setDayShifts(all);
      } catch (err) {
        console.error('Error cargando datos del reporte:', err);
      }
    };
    loadReport();
  }, [selectedDate, currentShift, shiftsHistory, loadShiftsByDate]);

  const diurnoShift = useMemo(
    () => dayShifts.find(s => s.operatorShiftType === 'DIURNO'),
    [dayShifts]
  );
  const nocturnoShift = useMemo(
    () => dayShifts.find(s => s.operatorShiftType === 'NOCTURNO'),
    [dayShifts]
  );

  const gandola = useMemo(() => {
    const fromHistory = receptionsHistory.find(r => r.date === selectedDate);
    if (fromHistory) return fromHistory;
    if (currentReception?.date === selectedDate) return currentReception;
    return null;
  }, [selectedDate, receptionsHistory, currentReception]);

  // Totales de litros vendidos por turno
  const diurnoTotal = useMemo(
    () => (diurnoShift?.pumpReadings || []).reduce((s, r) => s + (r.litersSold || 0), 0),
    [diurnoShift]
  );
  const nocturnoTotal = useMemo(
    () => (nocturnoShift?.pumpReadings || []).reduce((s, r) => s + (r.litersSold || 0), 0),
    [nocturnoShift]
  );
  const totalGeneral = diurnoTotal + nocturnoTotal;

  // Datos de tanques combinando diurno + gandola + nocturno
  const tankData = useMemo(() => {
    return Array.from({ length: tanksCount }, (_, i) => {
      const t = i + 1;
      const dTank = diurnoShift?.tankReadings?.find(tr => tr.tankId === t);
      const nTank = nocturnoShift?.tankReadings?.find(tr => tr.tankId === t);
      const gTank = gandola?.tankReadings?.find(tr => tr.tankId === t);
      return {
        tankId: t,
        initialCm: dTank?.cm || 0,
        beforeCm: gTank?.cmBefore || 0,
        gandolaLiters: gTank?.litersDifference || 0,
        afterCm: gTank?.cmAfter || 0,
        finalCm: nTank?.cm || 0,
      };
    });
  }, [diurnoShift, nocturnoShift, gandola, tanksCount]);

  const hasData = dayShifts.length > 0;

  // Estilos compartidos
  const hSx = { fontWeight: 700, fontSize: '0.75rem', p: '6px 8px' };
  const dSx = { fontSize: '0.8rem', p: '5px 8px' };

  // Renderizar tabla de surtidores para un turno
  const renderSurtidorTable = (shift, label, color, total, tasaLabel) => {
    if (!shift) {
      return (
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color, mb: 2, textTransform: 'uppercase' }}>
              {label}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              Sin datos para este turno
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color, mb: 0.5, textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
            {tasaLabel}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={hSx}>Isla</TableCell>
                  <TableCell sx={hSx} align="right">Lect. Inicial</TableCell>
                  <TableCell sx={hSx} align="right">Lect. Final</TableCell>
                  <TableCell sx={{ ...hSx, bgcolor: '#E8F5E9' }} align="right">Litros</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(shift.pumpReadings || []).map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={dSx}>I{r.islandId}-S{r.pumpNumber}</TableCell>
                    <TableCell sx={dSx} align="right">
                      {formatNumber(r.initialReading || 0, 0)}
                    </TableCell>
                    <TableCell sx={dSx} align="right">
                      {formatNumber(r.finalReading || 0, 0)}
                    </TableCell>
                    <TableCell
                      sx={{ ...dSx, fontWeight: 700, bgcolor: '#E8F5E9', color: '#2E7D32' }}
                      align="right"
                    >
                      {formatNumber(r.litersSold || 0, 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 1, pt: 1, borderTop: '2px solid', borderColor: 'divider', textAlign: 'right' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2E7D32' }}>
              TOTAL: {formatNumber(total, 0)} L
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Etiqueta de tasa para cada turno
  const diurnoTasaLabel = diurnoShift
    ? `Tasa: ${formatNumber(diurnoShift.tasa1, 2)} Bs.`
    : 'Tasa: —';

  const nocturnoTasaLabel = nocturnoShift
    ? nocturnoShift.tasa2 > 0
      ? `Tasa 1: ${formatNumber(nocturnoShift.tasa1, 2)} Bs. / Tasa 2: ${formatNumber(nocturnoShift.tasa2, 2)} Bs.`
      : `Tasa: ${formatNumber(nocturnoShift.tasa1, 2)} Bs.`
    : 'Tasa: — / Tasa 2: —';

  return (
    <Box>
      {/* Encabezado */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Reporte Lectura y Recepcion</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Reporte diario de lecturas de surtidores y recepcion de gandola
          </Typography>
        </Box>
        <TextField
          label="Fecha"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          size="small"
          placeholder="DD/MM/YYYY"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CalendarTodayIcon sx={{ fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
          sx={{ width: 180 }}
        />
      </Box>

      {!hasData ? (
        <Alert severity="warning">
          No hay datos para la fecha {selectedDate}. Los turnos apareceran aqui una vez cerrados.
        </Alert>
      ) : (
        <>
          {/* Info de estacion y tasas */}
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {config.stationName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {config.stationRif !== 'J-00000000-0' ? `${config.stationRif} — ` : ''}
                    {config.stationAddress}
                  </Typography>
                </Grid>
                <Grid item>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`Fecha: ${selectedDate}`} size="small" variant="outlined" />
                    <Chip
                      label={`Tasa: ${formatNumber(diurnoShift?.tasa1 || nocturnoShift?.tasa1 || 0, 2)} Bs.`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {(nocturnoShift?.tasa2 > 0) && (
                      <Chip
                        label={`Tasa 2: ${formatNumber(nocturnoShift.tasa2, 2)} Bs.`}
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Titulo del reporte */}
          <Paper
            sx={{
              mb: 2,
              py: 1,
              textAlign: 'center',
              bgcolor: 'grey.100',
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
              REPORTE LECTURA Y RECEPCION
            </Typography>
          </Paper>

          {/* Layout principal: 3 columnas */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {/* TURNO DIURNO */}
            <Grid item xs={12} md={4}>
              {renderSurtidorTable(diurnoShift, 'Turno Diurno', '#1565C0', diurnoTotal, diurnoTasaLabel)}
            </Grid>

            {/* INVENTARIO TANQUES */}
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#E65100', mb: 0.5, textTransform: 'uppercase' }}>
                    Inventario Tanques
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                    Lecturas en centimetros (CM)
                  </Typography>
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={hSx}>Tanque</TableCell>
                          <TableCell sx={hSx} align="right">Inicial</TableCell>
                          <TableCell sx={hSx} align="right">Antes D.</TableCell>
                          <TableCell sx={{ ...hSx, bgcolor: '#FFF8E1' }} align="right">Gandola</TableCell>
                          <TableCell sx={hSx} align="right">Desp. D.</TableCell>
                          <TableCell sx={hSx} align="right">Final</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tankData.map(t => (
                          <TableRow key={t.tankId}>
                            <TableCell sx={dSx}>{TANK_LABELS[t.tankId]}</TableCell>
                            <TableCell sx={dSx} align="right">
                              {formatNumber(t.initialCm, 1)}
                            </TableCell>
                            <TableCell sx={dSx} align="right">
                              {formatNumber(t.beforeCm, 1)}
                            </TableCell>
                            <TableCell
                              sx={{ ...dSx, fontWeight: 700, bgcolor: '#FFF8E1', color: '#F57F17' }}
                              align="right"
                            >
                              {formatNumber(t.gandolaLiters, 0)}
                            </TableCell>
                            <TableCell sx={dSx} align="right">
                              {formatNumber(t.afterCm, 1)}
                            </TableCell>
                            <TableCell sx={dSx} align="right">
                              {formatNumber(t.finalCm, 1)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {gandola && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Gandola: {gandola.gandolaPlate || '—'} | {gandola.gandolaDriver || '—'} | {gandola.productType || '—'}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* TURNO NOCTURNO */}
            <Grid item xs={12} md={4}>
              {renderSurtidorTable(nocturnoShift, 'Turno Nocturno', '#7B1FA2', nocturnoTotal, nocturnoTasaLabel)}
            </Grid>
          </Grid>

          {/* TOTAL GENERAL */}
          <Paper
            sx={{
              p: 2,
              textAlign: 'center',
              bgcolor: 'primary.main',
              color: 'white',
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              TOTAL GENERAL: {formatNumber(totalGeneral, 0)} L
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Total 1 ({formatNumber(diurnoTotal, 0)} L) + Total 2 ({formatNumber(nocturnoTotal, 0)} L)
            </Typography>
          </Paper>

          {/* Info adicional de turnos */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              {diurnoShift && (
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565C0', mb: 1 }}>
                      Turno Diurno
                    </Typography>
                    <Typography variant="body2">
                      Supervisor: {diurnoShift.supervisorShiftType === 'PM' ? 'PM (2:00 PM - 10:00 PM)' : 'AM (6:00 AM - 2:00 PM)'}
                    </Typography>
                    <Typography variant="body2">
                      Estado: {diurnoShift.status === 'cerrado' ? 'Cerrado' : 'En Progreso'}
                    </Typography>
                    {diurnoShift.islands?.map(isl => (
                      isl.operatorName ? (
                        <Typography key={isl.islandId} variant="body2">
                          Isla {isl.islandId}: {isl.operatorName}
                        </Typography>
                      ) : null
                    ))}
                  </CardContent>
                </Card>
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              {nocturnoShift && (
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#7B1FA2', mb: 1 }}>
                      Turno Nocturno
                    </Typography>
                    <Typography variant="body2">
                      Supervisor: {nocturnoShift.supervisorShiftType === 'AM' ? 'AM (6:00 AM - 2:00 PM)' : 'PM (2:00 PM - 10:00 PM)'}
                    </Typography>
                    <Typography variant="body2">
                      Estado: {nocturnoShift.status === 'cerrado' ? 'Cerrado' : 'En Progreso'}
                    </Typography>
                    {nocturnoShift.islands?.map(isl => (
                      isl.operatorName ? (
                        <Typography key={isl.islandId} variant="body2">
                          Isla {isl.islandId}: {isl.operatorName}
                        </Typography>
                      ) : null
                    ))}
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}