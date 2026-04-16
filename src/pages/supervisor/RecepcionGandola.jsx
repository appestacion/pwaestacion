// src/pages/supervisor/RecepcionGandola.jsx
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
import Divider from '@mui/material/Divider';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { useGandolaStore } from '../../store/useGandolaStore.js';
import { useCierreStore } from '../../store/useCierreStore.js';
import { formatNumber } from '../../lib/formatters.js';
import { TANK_LABELS } from '../../config/constants.js';
import { enqueueSnackbar } from 'notistack';

const PRODUCT_TYPES = [
  { value: 'gasolina_95', label: 'Gasolina 95 Octanos' },
  { value: 'gasolina_91', label: 'Gasolina 91 Octanos' },
  { value: 'diesel', label: 'Diesel' },
];

export default function RecepcionGandola() {
  const {
    currentReception,
    initNewReception,
    loadCurrentReception,
    updateReceptionField,
    updateTankReception,
    closeReception,
    cancelReception,
    saveCurrentReception,
  } = useGandolaStore();

  const { currentShift } = useCierreStore();

  useEffect(() => {
    loadCurrentReception();
  }, [loadCurrentReception]);

  const handleStartReception = () => {
    initNewReception();
    enqueueSnackbar({ message: 'Recepcion de Gandola iniciada', variant: 'info' });
  };

  const handleSave = () => {
    saveCurrentReception();
    enqueueSnackbar({ message: 'Datos guardados correctamente', variant: 'success' });
  };

  const handleClose = () => {
    closeReception();
    enqueueSnackbar({ message: 'Recepcion de Gandola cerrada exitosamente', variant: 'success' });
  };

  const handleCancel = () => {
    cancelReception();
    enqueueSnackbar({ message: 'Recepcion cancelada', variant: 'warning' });
  };

  // Calculate totals
  const totalLitersBefore = currentReception
    ? currentReception.tankReadings.reduce((s, t) => s + t.litersBefore, 0)
    : 0;
  const totalLitersAfter = currentReception
    ? currentReception.tankReadings.reduce((s, t) => s + t.litersAfter, 0)
    : 0;
  const totalReceived = totalLitersAfter - totalLitersBefore;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Recepcion de Gandola</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Registro de lecturas de tanques antes y despues de la descarga de combustible
        </Typography>
      </Box>

      {!currentReception ? (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <LocalShippingIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Inicia el proceso de recepcion para registrar las lecturas de los tanques antes y despues de la descarga.
            </Alert>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={handleStartReception}
              sx={{ px: 4 }}
            >
              Iniciar Recepcion de Gandola
            </Button>

            {/* Shift info */}
            {currentShift && (
              <Box sx={{ mt: 3 }}>
                <Chip label={`Turno activo: ${currentShift.date}`} color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
              </Box>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Reception Info */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <LocalShippingIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  Recepcion en Progreso
                </Typography>
                <Chip label={currentReception.date} size="small" color="default" />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Supervisor que Recibe"
                    value={currentReception.supervisorName}
                    onChange={(e) => updateReceptionField('supervisorName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Placa de la Gandola"
                    value={currentReception.gandolaPlate}
                    onChange={(e) => updateReceptionField('gandolaPlate', e.target.value.toUpperCase())}
                    placeholder="Ej: ABC123"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Nombre del Chofer"
                    value={currentReception.gandolaDriver}
                    onChange={(e) => updateReceptionField('gandolaDriver', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Tipo de Combustible"
                    value={currentReception.productType}
                    onChange={(e) => updateReceptionField('productType', e.target.value)}
                  >
                    {PRODUCT_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Observaciones"
                    value={currentReception.observations}
                    onChange={(e) => updateReceptionField('observations', e.target.value)}
                    placeholder="Notas adicionales..."
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Tank Readings Before and After */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 700, color: 'secondary.main' }}>
                Lecturas de Tanques
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Registre los centimetros (CM) de cada tanque ANTES de la descarga y DESPUES de la descarga.
                Los litros se calculan automaticamente via tabla de calibracion (incrementos de 0.5 cm).
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Tanque</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#FFECB3' }} align="right">CM Antes</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#FFECB3' }} align="right">L Antes</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#C8E6C9' }} align="right">CM Despues</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#C8E6C9' }} align="right">L Despues</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#E3F2FD' }} align="right">Diferencia L</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentReception.tankReadings.map((tank, idx) => (
                      <TableRow key={tank.tankId}>
                        <TableCell sx={{ fontWeight: 600 }}>{TANK_LABELS[tank.tankId]}</TableCell>
                        {/* Before */}
                        <TableCell align="right" sx={{ bgcolor: '#FFF8E1' }}>
                          <TextField
                            type="number"
                            variant="standard"
                            value={tank.cmBefore || ''}
                            onChange={(e) => updateTankReception(idx, 'cmBefore', e.target.value)}
                            sx={{ width: 90, '& input': { textAlign: 'right' } }}
                            placeholder="CM"
                            inputProps={{ step: 0.5 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#FFF8E1', fontWeight: 600, color: 'text.secondary' }}>
                          {formatNumber(tank.litersBefore, 0)}
                        </TableCell>
                        {/* After */}
                        <TableCell align="right" sx={{ bgcolor: '#F1F8E9' }}>
                          <TextField
                            type="number"
                            variant="standard"
                            value={tank.cmAfter || ''}
                            onChange={(e) => updateTankReception(idx, 'cmAfter', e.target.value)}
                            sx={{ width: 90, '& input': { textAlign: 'right' } }}
                            placeholder="CM"
                            inputProps={{ step: 0.5 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#F1F8E9', fontWeight: 600, color: 'text.secondary' }}>
                          {formatNumber(tank.litersAfter, 0)}
                        </TableCell>
                        {/* Difference */}
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            bgcolor: '#E3F2FD',
                            color: tank.litersDifference > 0 ? 'success.main' : 'text.secondary',
                          }}
                        >
                          {tank.litersDifference > 0 ? `+${formatNumber(tank.litersDifference, 0)}` : formatNumber(tank.litersDifference, 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />

              {/* Totals */}
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Total Antes</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatNumber(totalLitersBefore, 0)} L</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Total Despues</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatNumber(totalLitersAfter, 0)} L</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Litros Recibidos</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: totalReceived > 0 ? 'success.main' : 'text.secondary' }}>
                    {totalReceived > 0 ? `+${formatNumber(totalReceived, 0)}` : formatNumber(totalReceived, 0)} L
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={handleCancel}>
              Cancelar Recepcion
            </Button>
            <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSave}>
              Guardar Progreso
            </Button>
            <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={handleClose}>
              Cerrar Recepcion
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
