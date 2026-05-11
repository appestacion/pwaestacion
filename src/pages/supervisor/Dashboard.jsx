// src/pages/supervisor/Dashboard.jsx
import React, { useState } from 'react';
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
import NightlightIcon from '@mui/icons-material/Nightlight';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import useStore from '../../store/useStore.js';
import { formatBs, formatNumber } from '../../lib/formatters.js';
import { calcTotalLitersSold, calcLitersByIsland } from '../../lib/calculations.js';
import { SHIFT_LABELS, SHIFT_LABELS_SHORT, SUPERVISOR_SHIFT_LABELS, SUPERVISOR_SHIFT_LABELS_SHORT, ISLAND_LABELS } from '../../config/constants.js';

// Datos de cada tarjeta de turno supervisor
const SHIFT_CARDS = {
  AM: {
    key: 'AM',
    label: '1TS',
    fullLabel: '1TS (6:00 AM - 2:00 PM)',
    closesLabel: 'Cierra 2TO Nocturno (7:00 PM - 7:00 AM)',
    closesLabelMobile: 'Cierra 2TO Nocturno',
    color: '#CE1126',
    icon: <NightlightIcon />,
  },
  PM: {
    key: 'PM',
    label: '2TS',
    fullLabel: '2TS (2:00 PM - 10:00 PM)',
    closesLabel: 'Cierra 1TO Diurno (7:00 AM - 7:00 PM)',
    closesLabelMobile: 'Cierra 1TO Diurno',
    color: '#003399',
    icon: <WbSunnyIcon />,
  },
};

export default function SupervisorDashboard() {
  const { currentShift, initNewShift, closeShift } = useCierreStore();
  const navigate = useNavigate();
  const config = useConfigStore((state) => state.config);
  const updateConfig = useConfigStore((state) => state.updateConfig);
  const user = useStore((state) => state.user);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isXs = useMediaQuery(theme.breakpoints.down('xs'));

  const handleStartShift = (supervisorShiftType) => {
    let tasa1 = config.tasa1;
    let tasa2 = config.tasa2;

    // PROMOCIÓN 2TS (PM): tasa2 → tasa1 si hay una tasa más reciente.
    // El 2TS usa la tasa vigente (la última que dejó la API durante la ventana
    // de rotación del día anterior). La tasa2 queda disponible para que el
    // 1TS del día siguiente pueda usar ambas tasas.
    if (supervisorShiftType === 'PM' && tasa2 > 0 && tasa2 !== tasa1) {
      tasa1 = tasa2;
      updateConfig({ tasa1: tasa2 });
    }

    // SEGURIDAD (AMBOS TURNOS): Si tasa1 es inválida (≤ 0) pero tasa2 es válida,
    // promover tasa2 → tasa1. Esto previene que un turno opere con tasa1=0
    // causado por una rotación con tasa2 vacía (ej: primer día de operación
    // o después de un reset de configuración).
    if (tasa1 <= 0 && tasa2 > 0) {
      tasa1 = tasa2;
      updateConfig({ tasa1: tasa2 });
    }

    initNewShift(supervisorShiftType, tasa1, tasa2);
  };

  const handleCloseShift = () => {
    closeShift();
  };

  const [shiftJustClosed, setShiftJustClosed] = useState(false);

  const totalLiters = currentShift ? calcTotalLitersSold(currentShift.pumpReadings) : 0;

  // Detectar cuando se acaba de cerrar un turno (currentShift pasa de algo a null)
  const prevShiftRef = React.useRef(!!currentShift);
  React.useEffect(() => {
    if (prevShiftRef.current && !currentShift) {
      setShiftJustClosed(true);
    }
    prevShiftRef.current = !!currentShift;
  }, [currentShift]);
  const litersByIsland = currentShift ? calcLitersByIsland(currentShift.pumpReadings) : { 1: 0, 2: 0, 3: 0 };

  // 1TS (AM) cierra 2TO Nocturno → usa 2 tasas (solo si son diferentes)
  // 2TS (PM) cierra 1TO Diurno → usa solo tasa1
  const showTasa2 = currentShift?.supervisorShiftType === 'AM'
    && currentShift?.tasa2 > 0
    && currentShift?.tasa2 !== currentShift?.tasa1;

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
      {/* Header */}
      <Box sx={{ mb: isMobile ? 2 : 3 }}>
        <Typography
          variant={isMobile ? 'h6' : 'h5'}
          sx={{ fontWeight: 700 }}
        >
          Dashboard Supervisor
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', fontSize: isXs ? '0.75rem' : '0.875rem' }}
        >
          Control de operaciones del turno
        </Typography>
      </Box>

      {!currentShift ? (
        /* ========== SIN TURNO ACTIVO ========== */
        shiftJustClosed ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '60vh',
              textAlign: 'center',
              px: 3,
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 80, color: '#2E7D32', mb: 3 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#2E7D32', mb: 1 }}>
              Turno Cerrado
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: 'text.secondary' }}>
              Gracias por tu trabajo, {user?.name || 'Supervisor'}
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => setShiftJustClosed(false)}
              sx={{
                bgcolor: '#003399',
                '&:hover': { bgcolor: '#002277' },
                fontWeight: 700,
                px: 5,
                py: 1.5,
                borderRadius: 3,
                fontSize: '1.1rem',
              }}
            >
              Aceptar
            </Button>
          </Box>
        ) : (
        <>
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2, fontSize: isXs ? '0.78rem' : undefined }}>
            No hay un turno activo. Selecciona tu turno de supervisor para comenzar el cierre del turno de operadores correspondiente.
          </Alert>

          {/* Tarjetas de turno - cada una con su info de cierre dentro */}
          <Grid container spacing={isMobile ? 2 : 3}>
            {Object.values(SHIFT_CARDS).map((shiftCard) => (
              <Grid item xs={12} sm={6} key={shiftCard.key}>
                <Card
                  sx={{
                    height: '100%',
                    borderLeft: '4px solid',
                    borderColor: shiftCard.color,
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                  }}
                >
                  <CardContent
                    sx={{
                      textAlign: 'center',
                      py: isMobile ? 3 : 4,
                      px: isMobile ? 2 : 3,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Typography
                      variant={isMobile ? 'h6' : 'h5'}
                      sx={{ fontWeight: 700, color: shiftCard.color }}
                    >
                      {shiftCard.label}
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', fontWeight: 500 }}
                    >
                      {shiftCard.fullLabel}
                    </Typography>

                    {/* Info de cierre - DENTRO de la tarjeta */}
                    <Chip
                      label={isMobile ? shiftCard.closesLabelMobile : shiftCard.closesLabel}
                      icon={isMobile ? undefined : shiftCard.icon}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontWeight: 600,
                        fontSize: isXs ? '0.68rem' : '0.78rem',
                        borderColor: shiftCard.color,
                        color: shiftCard.color,
                        bgcolor: `${shiftCard.color}08`,
                        mt: 1,
                      }}
                    />

                    {/* Boton para iniciar */}
                    <Button
                      variant="contained"
                      size={isMobile ? 'medium' : 'large'}
                      startIcon={<PlayArrowIcon />}
                      onClick={() => handleStartShift(shiftCard.key)}
                      sx={{
                        mt: 1,
                        px: isMobile ? 3 : 4,
                        width: '100%',
                        maxWidth: 320,
                        bgcolor: shiftCard.color,
                        '&:hover': { bgcolor: shiftCard.color, filter: 'brightness(0.9)' },
                      }}
                    >
                      Iniciar {shiftCard.label}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
        )
      ) : (
        /* ========== TURNO ACTIVO ========== */
        <>
          {/* Tarjeta de turno activo */}
          <Card sx={{
            mb: isMobile ? 2 : 3,
            borderLeft: '4px solid',
            borderColor: currentShift.status === 'en_progreso' ? 'success.main' : 'grey.400',
          }}>
            <CardContent sx={{ px: isMobile ? 2 : 3, py: isMobile ? 2 : 3 }}>
              {/* Encabezado del turno - responsive */}
              <Box sx={{
                display: 'flex',
                justifyContent: isMobile ? 'space-between' : 'flex-start',
                alignItems: isMobile ? 'center' : 'flex-start',
                gap: 2,
                flexWrap: 'wrap',
              }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant={isMobile ? 'subtitle1' : 'h6'}
                      sx={{ fontWeight: 700 }}
                    >
                      {isMobile
                        ? SUPERVISOR_SHIFT_LABELS_SHORT[currentShift.supervisorShiftType]
                        : SUPERVISOR_SHIFT_LABELS[currentShift.supervisorShiftType]}
                    </Typography>
                    <Chip
                      label={currentShift.status === 'en_progreso' ? 'En Progreso' : 'Cerrado'}
                      color={currentShift.status === 'en_progreso' ? 'success' : 'default'}
                      size="small"
                      icon={currentShift.status === 'en_progreso' ? <CheckCircleIcon /> : undefined}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: isXs ? '0.75rem' : undefined }}>
                    Cerrando: <strong>{isMobile
                      ? SHIFT_LABELS_SHORT[currentShift.operatorShiftType]
                      : SHIFT_LABELS[currentShift.operatorShiftType]}</strong>
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: isXs ? '0.75rem' : undefined,
                      wordBreak: 'break-word',
                    }}
                  >
                    Fecha: {currentShift.date}
                    {isMobile ? (
                      <React.Fragment>
                        <br />
                        BCV: {formatBs(currentShift.tasa1)}
                        {showTasa2 && ` / ${formatBs(currentShift.tasa2)}`}
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        &nbsp;|&nbsp; Tasa BCV: {formatBs(currentShift.tasa1)}
                        {showTasa2 && ` / ${formatBs(currentShift.tasa2)}`}
                      </React.Fragment>
                    )}
                  </Typography>
                </Box>

                {currentShift.status === 'en_progreso' && (
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleCloseShift}
                    size={isMobile ? 'small' : 'medium'}
                    sx={{
                      minWidth: isMobile ? 'auto' : undefined,
                      px: isMobile ? 2 : undefined,
                    }}
                  >
                    Cerrar Turno
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Tarjetas resumen - 2x2 en movil, 4 en linea en desktop */}
          <Grid container spacing={isMobile ? 1.5 : 2} sx={{ mb: isMobile ? 2 : 3 }}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      fontSize: isXs ? '0.6rem' : '0.75rem',
                    }}
                  >
                    {isXs ? 'Total' : 'Litros Totales'}
                  </Typography>
                  <Typography
                    variant={isMobile ? 'h6' : 'h5'}
                    sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}
                  >
                    {formatNumber(totalLiters, 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {[1, 2, 3].map((id) => (
              <Grid item xs={6} sm={3} key={id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: 600,
                        fontSize: isXs ? '0.6rem' : '0.75rem',
                      }}
                    >
                      {ISLAND_LABELS[id]}
                    </Typography>
                    <Typography
                      variant={isMobile ? 'h6' : 'h5'}
                      sx={{ fontWeight: 700, mt: 0.5 }}
                    >
                      {formatNumber(litersByIsland[id], 0)}
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>L</Typography>
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Acciones Rápidas */}
          <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ mb: isMobile ? 1.5 : 2 }}>
            Acciones Rápidas
          </Typography>
          <Grid container spacing={isMobile ? 1.5 : 2}>
            {quickActions.map((action) => (
              <Grid item xs={6} sm={4} key={action.path}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                    borderLeft: '3px solid',
                    borderColor: action.color,
                    height: '100%',
                  }}
                  onClick={() => navigate(action.path)}
                >
                  <CardContent sx={{
                    p: isMobile ? 1.5 : 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 1 : 1.5,
                    '&:last-child': { pb: isMobile ? 1.5 : 2 },
                    flexDirection: isXs && action.label.length > 10 ? 'column' : 'row',
                    textAlign: isXs && action.label.length > 10 ? 'center' : 'left',
                  }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: isMobile ? 36 : 40,
                        height: isMobile ? 36 : 40,
                        borderRadius: '10px',
                        bgcolor: `${action.color}15`,
                        color: action.color,
                        flexShrink: 0,
                      }}
                    >
                      {action.icon}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        fontSize: isXs ? '0.72rem' : '0.875rem',
                        lineHeight: 1.2,
                      }}
                    >
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