// src/pages/supervisor/Lecturas.jsx
import React, { useEffect } from 'react';
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
import SaveIcon from '@mui/icons-material/Save';
import { useCierreStore } from '../../store/useCierreStore.js';
import { formatNumber } from '../../lib/formatters.js';
import { TANK_LABELS, SHIFT_LABELS } from '../../config/constants.js';
import { enqueueSnackbar } from 'notistack';

export default function Lecturas() {
  const {
    currentShift,
    updatePumpReading,
    updateTankReading,
    setGandolaLiters,
    updateTasa,
    saveCurrentShift,
    loadCurrentShift,
  } = useCierreStore();

  useEffect(() => {
    loadCurrentShift();
  }, [loadCurrentShift]);

  const handlePumpChange = (index, field, value) => {
    const num = parseFloat(value) || 0;
    updatePumpReading(index, field, num);
  };

  const handleTankChange = (index, field, value) => {
    const num = parseFloat(value) || 0;
    updateTankReading(index, field, num);
  };

  const handleSave = () => {
    saveCurrentShift();
    enqueueSnackbar({ message: 'Lecturas guardadas correctamente', variant: 'success' });
  };

  if (!currentShift) {
    return (
      <Alert severity="warning">No hay un turno activo. Ve al Dashboard e inicia un turno.</Alert>
    );
  }

  // NOCTURNO (7PM-7AM) uses 2 tasas, DIURNO (7AM-7PM) uses 1 tasa
  const isNocturno = currentShift.operatorShiftType === 'NOCTURNO';

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
          <Button variant="contained" onClick={handleSave} startIcon={<SaveIcon />}>
            Guardar
          </Button>
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
                value={currentShift.tasa1 || ''}
                onChange={(e) => updateTasa('tasa1', parseFloat(e.target.value) || 0)}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
              />
            </Grid>
            {isNocturno && (
              <Grid item xs={6} sm={3}>
                <TextField
                  label="Tasa 2 (turno nocturno)"
                  type="number"
                  value={currentShift.tasa2 || ''}
                  onChange={(e) => updateTasa('tasa2', parseFloat(e.target.value) || 0)}
                  InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
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
          <Typography variant="h6" sx={{ mb: 2, color: 'secondary.main', fontWeight: 700 }}>
            Lecturas de Surtidores
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Isla</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Surtidor</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Lectura Inicial</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Lectura Final</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right" style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>
                    Litros Vendidos
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(currentShift.pumpReadings || []).map((reading, idx) => (
                  <TableRow key={`${reading.islandId}-${reading.pumpNumber}`}>
                    <TableCell>Isla {reading.islandId}</TableCell>
                    <TableCell>Surtidor {reading.pumpNumber}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        variant="standard"
                        value={reading.initialReading || ''}
                        onChange={(e) => handlePumpChange(idx, 'initialReading', e.target.value)}
                        sx={{ width: 100, '& input': { textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        variant="standard"
                        value={reading.finalReading || ''}
                        onChange={(e) => handlePumpChange(idx, 'finalReading', e.target.value)}
                        sx={{ width: 100, '& input': { textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, bgcolor: '#E8F5E9', color: '#2E7D32' }}
                    >
                      {formatNumber(reading.litersSold, 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Tank Readings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: 'warning.main', fontWeight: 700 }}>
            Lecturas de Tanques
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Los litros se calculan automaticamente a partir de los centimetros (CM) usando la tabla de calibracion.
            Use valores en incrementos de 0.5 cm (ej: 105, 105.5, 106).
          </Typography>
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
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}