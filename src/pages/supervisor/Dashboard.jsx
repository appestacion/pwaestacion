// src/pages/supervisor/Dashboard.jsx
import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import SpeedIcon from '@mui/icons-material/Speed';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BookIcon from '@mui/icons-material/Book';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { useNavigate } from 'react-router-dom';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { formatBs, formatNumber } from '../../lib/formatters.js';
import { calcTotalLitersSold, calcLitersByIsland } from '../../lib/calculations.js';
import { SHIFT_LABELS, SUPERVISOR_SHIFT_LABELS, SUPERVISOR_CLOSES_SHIFT, ISLAND_LABELS } from '../../config/constants.js';

export default function SupervisorDashboard() {
  const { currentShift, initNewShift, closeShift } = useCierreStore();
  const navigate = useNavigate();
  const config = useConfigStore((state) => state.config);

  const handleStartShift = (supervisorShiftType) => {
    initNewShift(supervisorShiftType, config.tasa1, config.tasa2);
  };

  const handleCloseShift = () => {
    closeShift();
    navigate('/generar-pdf');
  };

  const totalLiters = currentShift ? calcTotalLitersSold(currentShift.pumpReadings) : 0;
  const litersByIsland = currentShift ? calcLitersByIsland(currentShift.pumpReadings) : { 1: 0, 2: 0, 3: 0 };

  const quickActions = [
    { label: 'Lecturas', icon: <SpeedIcon />, path: '/lecturas', color: '#CE1126' },
    { label: 'Cierre de Turno', icon: <ReceiptLongIcon />, path: '/cierre', color: '#003399' },
    { label: 'Biblia', icon: <BookIcon />, path: '/biblia', color: '#FFD100' },
    { label: 'Cuadre PV', icon: <PointOfSaleIcon />, path: '/cuadre-pv', color: '#00A651' },
    { label: 'Inventario', icon: <InventoryIcon />, path: '/inventario', color: '#FF6600' },
    { label: 'Recepción Gandola', icon: <LocalShippingIcon />, path: '/recepcion-gandola', color: '#9C27B0' },
    { label: 'Generar PDF', icon: <PictureAsPdfIcon />, path: '/generar-pdf', color: '#666666' },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Dashboard Supervisor
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Control de operaciones del turno
        </Typography>
      </Box>

      {!currentShift ? (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              No hay un turno activo. Selecciona tu turno de supervisor para comenzar el cierre del turno de operadores correspondiente.
            </Alert>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={() => handleStartShift('AM')}
                sx={{ px: 4 }}
              >
                Turno Supervisor 6:00 AM - 2:00 PM
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={() => handleStartShift('PM')}
                sx={{ px: 4, borderColor: 'secondary.main', color: 'secondary.main' }}
              >
                Turno Supervisor 2:00 PM - 10:00 PM
              </Button>
            </Box>
            <Box sx={{ mt: 3, display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Chip
                label="6AM → Cierra Turno Nocturno (7PM-7AM)"
                sx={{ fontWeight: 600 }}
                color="primary"
                variant="outlined"
              />
              <Chip
                label="2PM → Cierra Turno Diurno (7AM-7PM)"
                sx={{ fontWeight: 600 }}
                color="secondary"
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active Shift Card */}
          <Card sx={{ mb: 3, borderLeft: '4px solid', borderColor: currentShift.status === 'en_progreso' ? 'success.main' : 'grey.400' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {SUPERVISOR_SHIFT_LABELS[currentShift.supervisorShiftType]}
                    </Typography>
                    <Chip
                      label={currentShift.status === 'en_progreso' ? 'En Progreso' : 'Cerrado'}
                      color={currentShift.status === 'en_progreso' ? 'success' : 'default'}
                      size="small"
                      icon={currentShift.status === 'en_progreso' ? <CheckCircleIcon /> : undefined}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Cerrando: <strong>{SHIFT_LABELS[currentShift.operatorShiftType]}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Fecha: {currentShift.date} &nbsp;|&nbsp; Tasa BCV: {formatBs(currentShift.tasa1)}
                    {currentShift.tasa2 > 0 && ` / ${formatBs(currentShift.tasa2)}`}
                  </Typography>
                </Box>
                {currentShift.status === 'en_progreso' && (
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleCloseShift}
                    size="small"
                  >
                    Cerrar Turno
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Litros Totales
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}>
                    {formatNumber(totalLiters, 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {[1, 2, 3].map((id) => (
              <Grid item xs={6} sm={3} key={id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {ISLAND_LABELS[id]}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {formatNumber(litersByIsland[id], 0)}
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>L</Typography>
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Quick Actions */}
          <Typography variant="h6" sx={{ mb: 2 }}>Acciones Rápidas</Typography>
          <Grid container spacing={2}>
            {quickActions.map((action) => (
              <Grid item xs={6} sm={4} key={action.path}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                    borderLeft: '4px solid',
                    borderColor: action.color,
                  }}
                  onClick={() => navigate(action.path)}
                >
                  <CardContent sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, '&:last-child': { pb: 2 } }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        bgcolor: `${action.color}15`,
                        color: action.color,
                      }}
                    >
                      {action.icon}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {action.label}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}
