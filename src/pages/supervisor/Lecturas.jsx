// src/pages/supervisor/Lecturas.jsx
import React, { useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useCierreStore } from '../../store/useCierreStore.js';
import { formatNumber } from '../../lib/formatters.js';
import { TANK_LABELS, SHIFT_LABELS } from '../../config/constants.js';

export default function Lecturas() {
  const {
    currentShift,
    updatePumpReading,
    updateTankReading,
    setGandolaLiters,
    updateTasa,
    loadCurrentShift,
  } = useCierreStore();

  useEffect(() => {
    loadCurrentShift();
  }, [loadCurrentShift]);

  // Agrupar lecturas por isla para mostrar subtotales
  // (useMemo SIEMPRE antes del early return — Rules of Hooks)
  const readingsByIsland = useMemo(() => {
    const readings = currentShift?.pumpReadings || [];
    const groups = {};
    readings.forEach((reading, idx) => {
      const islandId = reading.islandId;
      if (!groups[islandId]) {
        groups[islandId] = [];
      }
      groups[islandId].push({ ...reading, originalIndex: idx });
    });
    const sortedIslands = Object.keys(groups).sort((a, b) => Number(a) - Number(b));
    return sortedIslands.map((id) => {
      const items = groups[id];
      const totalLiters = items.reduce((s, r) => s + Math.max(0, r.litersSold || 0), 0);
      return { islandId: id, items, totalLiters };
    });
  }, [currentShift?.pumpReadings]);

  const handlePumpChange = (index, field, value) => {
    const num = parseFloat(value) || 0;
    updatePumpReading(index, field, num);
  };

  const handleTankChange = (index, field, value) => {
    const num = parseFloat(value) || 0;
    updateTankReading(index, field, num);
  };

  // ── Early return DESPUÉS de todos los hooks ──
  if (!currentShift) {
    return (
      <Alert severity="warning">No hay un turno activo. Ve al Dashboard e inicia un turno.</Alert>
    );
  }

  const isNocturno = currentShift.operatorShiftType === 'NOCTURNO';
  const is1TS = currentShift.supervisorShiftType === 'AM';

  // Verificar si hay lecturas iniciales auto-llenadas (al menos una > 0)
  const hasAutoInitial = (currentShift.pumpReadings || []).some((r) => r.initialReading > 0);

  const totalAllLiters = (currentShift.pumpReadings || []).reduce((s, r) => s + Math.max(0, r.litersSold || 0), 0);

  const totalTankLiters = (currentShift.tankReadings || []).reduce((s, t) => s + (t.liters || 0), 0);

  // Verificar si hay al menos una lectura final registrada
  const anyHasFinal = (currentShift.pumpReadings || []).some((r) => r.finalReading && r.finalReading > 0);

  const handleSendWhatsApp = () => {
    const titulo = is1TS ? 'Inventario Inicial' : 'Inventario Final';
    let text = `*${titulo} ${currentShift.date}*\n`;
    (currentShift.tankReadings || []).forEach((tank) => {
      const label = (TANK_LABELS[tank.tankId] || tank.tankId).replace('Tanque ', 'T');
      text += `${label}: ${formatNumber(tank.liters || 0, 0)} lts\n`;
    });
    text += `Total: ${formatNumber(totalTankLiters, 0)} lts`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Lecturas</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Registro de surtidores y tanques — {currentShift.date}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={SHIFT_LABELS[currentShift.operatorShiftType] || ''}
            color={isNocturno ? 'primary' : 'secondary'}
            variant="outlined"
            size="small"
          />
          <Chip label="Auto-guardado" color="success" size="small" variant="outlined" icon={<CloudSyncIcon />} />
        </Box>
      </Box>

      {/* Tasa BCV */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 700 }}>
            Tasa BCV
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Tasa 1"
                type="number"
                value={currentShift.tasa1 ? currentShift.tasa1.toFixed(2) : ''}
                onChange={(e) => updateTasa('tasa1', parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
                inputProps={{ step: 0.01 }}
              />
            </Grid>
            {isNocturno && (
              <Grid item xs={6} sm={3}>
                <TextField
                  label="Tasa 2 (turno nocturno)"
                  type="number"
                  value={currentShift.tasa2 ? currentShift.tasa2.toFixed(2) : ''}
                  onChange={(e) => updateTasa('tasa2', parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
                  InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
                  inputProps={{ step: 0.01 }}
                />
              </Grid>
            )}
          </Grid>
          {!isNocturno && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              Turno diurno (7:00 AM - 7:00 PM) utiliza una sola tasa.
            </Typography>
          )}
          {isNocturno && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              Turno nocturno (7:00 PM - 7:00 AM) utiliza dos tasas (Tasa 1 y Tasa 2).
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Pump Readings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="h6" sx={{ color: 'secondary.main', fontWeight: 700 }}>
              Lecturas de Surtidores
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
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Isla</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Surtidor</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#E3F2FD' }} align="right">
                    Lectura Inicial
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Lectura Final</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right" style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>
                    Litros Vendidos
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {readingsByIsland.map((island, islandIdx) => (
                  <React.Fragment key={`island-${island.islandId}`}>
                    {island.items.map((reading) => {
                      const hasFinal = reading.finalReading && reading.finalReading > 0;
                      return (
                        <TableRow key={`${reading.islandId}-${reading.pumpNumber}`}>
                          <TableCell>Isla {reading.islandId}</TableCell>
                          <TableCell>Surtidor {reading.pumpNumber}</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#E3F2FD' }}>
                            <TextField
                              type="number"
                              variant="standard"
                              value={reading.initialReading || ''}
                              onChange={(e) => handlePumpChange(reading.originalIndex, 'initialReading', e.target.value)}
                              sx={{ width: 100, '& input': { textAlign: 'right' } }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              variant="standard"
                              value={reading.finalReading || ''}
                              onChange={(e) => handlePumpChange(reading.originalIndex, 'finalReading', e.target.value)}
                              sx={{ width: 100, '& input': { textAlign: 'right' } }}
                            />
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 700, bgcolor: '#E8F5E9', color: hasFinal ? '#2E7D32' : '#9E9E9E' }}
                          >
                            {hasFinal ? formatNumber(Math.max(0, reading.litersSold || 0), 0) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow key={`subtotal-${island.islandId}`}>
                      <TableCell
                        colSpan={4}
                        sx={{ fontWeight: 700, bgcolor: '#F3E5F5', color: '#7B1FA2', fontSize: '0.85rem' }}
                        align="right"
                      >
                        Subtotal Isla {island.islandId}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, bgcolor: '#F3E5F5', color: '#7B1FA2', fontSize: '0.95rem' }}
                      >
                        {island.items.some((r) => r.finalReading && r.finalReading > 0) ? `${formatNumber(island.totalLiters, 0)} L` : '—'}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
                <TableRow>
                  <TableCell
                    colSpan={4}
                    sx={{ fontWeight: 700, bgcolor: '#E0E0E0', color: '#212121', fontSize: '0.95rem' }}
                    align="right"
                  >
                    TOTAL GENERAL
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, bgcolor: '#E0E0E0', color: anyHasFinal ? '#2E7D32' : '#9E9E9E', fontSize: '1rem' }}
                  >
                    {anyHasFinal ? `${formatNumber(totalAllLiters, 0)} L` : '—'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Tank Readings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h6" sx={{ color: 'warning.main', fontWeight: 700 }}>
                Lecturas de Tanques
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Los litros se calculan automáticamente a partir de los centímetros (CM) usando la tabla de calibración.
                Use valores en incrementos de 0.5 cm (ej: 105, 105.5, 106).
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<WhatsAppIcon />}
              onClick={handleSendWhatsApp}
              sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' }, borderRadius: 2 }}
            >
              WhatsApp
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Tanque</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">CM</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right" style={{ backgroundColor: '#E3F2FD', color: '#1565C0' }}>
                    Litros
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(currentShift.tankReadings || []).map((tank, idx) => (
                  <TableRow key={tank.tankId}>
                    <TableCell>{TANK_LABELS[tank.tankId] || `Tanque ${tank.tankId}`}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        variant="standard"
                        value={tank.cm || ''}
                        onChange={(e) => handleTankChange(idx, 'cm', e.target.value)}
                        sx={{ width: 100, '& input': { textAlign: 'right' } }}
                        inputProps={{ step: 0.5 }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, bgcolor: '#E3F2FD', color: '#1565C0' }}>
                      {formatNumber(tank.liters, 0)} L
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#BBDEFB' }}>TOTAL</TableCell>
                  <TableCell sx={{ bgcolor: '#BBDEFB' }} />
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#BBDEFB', color: '#1565C0', fontSize: '1rem' }}>
                    {formatNumber(totalTankLiters, 0)} L
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}