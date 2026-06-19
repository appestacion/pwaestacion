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
import PaymentsIcon from '@mui/icons-material/Payments';
import HistoryIcon from '@mui/icons-material/History';
import NightlightIcon from '@mui/icons-material/Nightlight';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import useStore from '../../store/useStore.js';
import { formatBs, formatNumber } from '../../lib/formatters.js';
import { calcTotalLitersSold, calcLitersByIsland } from '../../lib/calculations.js';
import { SHIFT_LABELS, SHIFT_LABELS_SHORT, SUPERVISOR_SHIFT_LABELS, SUPERVISOR_SHIFT_LABELS_SHORT, ISLAND_LABELS } from '../../config/constants.js';

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
  const { currentShift, initNewShift, closeShift, closingShift } = useCierreStore();
  const navigate = useNavigate();
  const config = useConfigStore((state) => state.config);
  const updateConfig = useConfigStore((state) => state.updateConfig);
  const user = useStore((state) => state.user);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isXs = useMediaQuery(theme.breakpoints.down('xs'));

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [snackbarError, setSnackbarError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  // ★ Shifts ya cerrados hoy — para deshabilitar botones proactivamente.
  // Estructura: { 'AM': true, 'PM': true } si ya están cerrados.
  const [closedShiftsToday, setClosedShiftsToday] = useState({});

  const closeRequestedRef = React.useRef(false);
  const closeCooldownRef = React.useRef(false);

  // ★ Verificación proactiva al montar y cuando cambia el currentShift:
  // consulta Firestore por turnos DIURNO y NOCTURNO ya cerrados hoy.
  React.useEffect(() => {
    if (!currentShift) {
      // Solo verificar cuando no hay turno activo (pantalla de selección).
      const checkBoth = async () => {
        const diurno = await useCierreStore.getState().checkForDuplicateShift('DIURNO');
        const nocturno = await useCierreStore.getState().checkForDuplicateShift('NOCTURNO');
        setClosedShiftsToday({
          // DIURNO corresponde a supervisor PM, NOCTURNO a supervisor AM.
          PM: !!diurno,
          AM: !!nocturno,
        });
      };
      checkBoth();
    } else {
      setClosedShiftsToday({});
    }
  }, [currentShift]);

  const handleStartShift = async (supervisorShiftType) => {
    if (closeCooldownRef.current) {
      return;
    }

    let tasa1 = config.tasa1;
    let tasa2 = config.tasa2;

    if (supervisorShiftType === 'PM' && tasa2 > 0 && tasa2 !== tasa1) {
      tasa1 = tasa2;
      updateConfig({ tasa1: tasa2 });
    }

    if (tasa1 <= 0 && tasa2 > 0) {
      tasa1 = tasa2;
      updateConfig({ tasa1: tasa2 });
    }

    const operatorShiftType = supervisorShiftType === 'AM' ? 'NOCTURNO' : 'DIURNO';
    const shiftCard = SHIFT_CARDS[supervisorShiftType];
    const existingClosed = await useCierreStore.getState().checkForDuplicateShift(operatorShiftType);

    if (existingClosed) {
      setDuplicateWarning({
        type: supervisorShiftType,
        operatorType: operatorShiftType,
        date: existingClosed.date || 'fecha desconocida',
        existingShiftId: existingClosed.id,
      });
      return;
    }

    initNewShift(supervisorShiftType, tasa1, tasa2);
  };

  const handleCloseShift = async () => {
    setConfirmCloseOpen(false);

    const result = await closeShift();

    if (result && result.success) {
      closeCooldownRef.current = true;
      setTimeout(() => {
        closeCooldownRef.current = false;
      }, 3000);
    }

    if (result && !result.success && result.error) {
      setSnackbarError(result.error);
    }
  };

  const [shiftJustClosed, setShiftJustClosed] = useState(false);

  const totalLiters = currentShift ? calcTotalLitersSold(currentShift.pumpReadings) : 0;
  const litersByIsland = currentShift ? calcLitersByIsland(currentShift.pumpReadings) : { 1: 0, 2: 0, 3: 0 };

  const hasAnyFinal = (currentShift?.pumpReadings || []).some((r) => r.finalReading && r.finalReading > 0);

  const prevShiftRef = React.useRef(!!currentShift);
  React.useEffect(() => {
    if (prevShiftRef.current && !currentShift) {
      setShiftJustClosed(true);
    }
    prevShiftRef.current = !!currentShift;
  }, [currentShift]);

  React.useEffect(() => {
    if (currentShift) {
      closeRequestedRef.current = false;
    }
  }, [currentShift]);

  const showTasa2 = currentShift?.supervisorShiftType === 'AM'
    && currentShift?.tasa2 > 0
    && currentShift?.tasa2 !== currentShift?.tasa1;

  const quickActions = [
    { label: 'Lecturas', icon: <SpeedIcon />, path: '/lecturas', color: '#CE1126' },
    { label: 'Cierre de Turno', icon: <ReceiptLongIcon />, path: '/cierre', color: '#003399' },
    { label: 'Gastos', icon: <PaymentsIcon />, path: '/gastos', color: '#D32F2F' },
    { label: 'Biblia', icon: <BookIcon />, path: '/biblia', color: '#FFD100' },
    { label: 'Cuadre PV', icon: <PointOfSaleIcon />, path: '/cuadre-pv', color: '#00A651' },
    { label: 'Inventario', icon: <InventoryIcon />, path: '/inventario', color: '#FF6600' },
    { label: 'Recepción Gandola', icon: <LocalShippingIcon />, path: '/recepcion-gandola', color: '#9C27B0' },
    { label: 'Historiales', icon: <HistoryIcon />, path: '/historial-cierres', color: '#607D8B' },
    { label: 'Generar PDF', icon: <PictureAsPdfIcon />, path: '/generar-pdf', color: '#666666' },
  ];

  const closingLabel = currentShift
    ? (isMobile
        ? `${SUPERVISOR_SHIFT_LABELS_SHORT[currentShift.supervisorShiftType]} - ${SHIFT_LABELS_SHORT[currentShift.operatorShiftType]}`
        : `${SUPERVISOR_SHIFT_LABELS[currentShift.supervisorShiftType]} - ${SHIFT_LABELS[currentShift.operatorShiftType]}`)
    : '';

  return (
    <Box>
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

          <Grid container spacing={isMobile ? 2 : 3}>
            {Object.values(SHIFT_CARDS).map((shiftCard) => {
              // ★ Si este turno ya está cerrado hoy, deshabilitar.
              const isClosedToday = !!closedShiftsToday[shiftCard.key];
              return (
              <Grid item xs={12} sm={6} key={shiftCard.key}>
                <Card
                  sx={{
                    height: '100%',
                    borderLeft: '4px solid',
                    borderColor: isClosedToday ? 'grey.400' : shiftCard.color,
                    opacity: isClosedToday ? 0.7 : 1,
                    transition: 'all 0.2s',
                    '&:hover': isClosedToday ? {} : { transform: 'translateY(-2px)', boxShadow: 4 },
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
                      sx={{ fontWeight: 700, color: isClosedToday ? 'grey.500' : shiftCard.color }}
                    >
                      {shiftCard.label}
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', fontWeight: 500 }}
                    >
                      {shiftCard.fullLabel}
                    </Typography>

                    {isClosedToday ? (
                      <Chip
                        label="Cerrado hoy"
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: isXs ? '0.68rem' : '0.78rem',
                          bgcolor: '#FFCDD2',
                          color: '#B71C1C',
                          mt: 1,
                        }}
                      />
                    ) : (
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
                    )}

                    <Button
                      variant="contained"
                      size={isMobile ? 'medium' : 'large'}
                      startIcon={<PlayArrowIcon />}
                      onClick={() => handleStartShift(shiftCard.key)}
                      disabled={isClosedToday}
                      sx={{
                        mt: 1,
                        px: isMobile ? 3 : 4,
                        width: '100%',
                        maxWidth: 320,
                        bgcolor: isClosedToday ? 'grey.400' : shiftCard.color,
                        '&:hover': isClosedToday
                          ? {}
                          : { bgcolor: shiftCard.color, filter: 'brightness(0.9)' },
                      }}
                    >
                      {isClosedToday ? 'No disponible' : `Iniciar ${shiftCard.label}`}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
              );
            })}
          </Grid>
        </>
        )
      ) : (
        <>
          <Card sx={{
            mb: isMobile ? 2 : 3,
            borderLeft: '4px solid',
            borderColor: currentShift.status === 'en_progreso' ? 'success.main' : 'grey.400',
          }}>
            <CardContent sx={{ px: isMobile ? 2 : 3, py: isMobile ? 2 : 3 }}>
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
                    onClick={() => {
                      if (closeRequestedRef.current) {
                        return;
                      }
                      closeRequestedRef.current = true;
                      setConfirmCloseOpen(true);
                    }}
                    size={isMobile ? 'small' : 'medium'}
                    disabled={closingShift}
                    sx={{
                      minWidth: isMobile ? 'auto' : undefined,
                      px: isMobile ? 2 : undefined,
                    }}
                  >
                    {closingShift ? 'Cerrando...' : 'Cerrar Turno'}
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

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
                    sx={{ fontWeight: 700, color: hasAnyFinal ? 'primary.main' : 'text.disabled', mt: 0.5 }}
                  >
                    {hasAnyFinal ? formatNumber(totalLiters, 0) : '-'}
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
                      sx={{ fontWeight: 700, color: hasAnyFinal ? 'text.primary' : 'text.disabled', mt: 0.5 }}
                    >
                      {hasAnyFinal ? formatNumber(litersByIsland[id], 0) : '-'}
                      {hasAnyFinal && <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>L</Typography>}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant={isMobile ? 'subtitle1' : 'h6'} sx={{ mb: isMobile ? 1.5 : 2 }}>
            Acciones Rapidas
          </Typography>
          <Grid container spacing={isMobile ? 1.5 : 2}>
            {quickActions.map((action) => (
              <Grid item xs={6} sm={4} md={3} key={action.path}>
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

      <Dialog
        open={confirmCloseOpen}
        onClose={() => {
          if (!closingShift) {
            setConfirmCloseOpen(false);
            closeRequestedRef.current = false;
          }
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, textAlign: 'center', fontSize: '1.2rem' }}>
          Cerrar Turno?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ textAlign: 'center', mb: 1, fontWeight: 600 }}>
            {closingLabel}
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
            Esta accion cerrara el turno actual y no se puede deshacer. Asegurate de haber registrado todas las lecturas y cortes.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 1, pb: 2 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setConfirmCloseOpen(false);
              closeRequestedRef.current = false;
            }}
            disabled={closingShift}
            sx={{ minWidth: 100, fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCloseShift}
            disabled={closingShift}
            startIcon={closingShift ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ minWidth: 100, fontWeight: 600 }}
          >
            {closingShift ? 'Cerrando...' : 'Si, Cerrar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!duplicateWarning}
        onClose={() => setDuplicateWarning(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, textAlign: 'center', fontSize: '1.2rem', color: '#C62828' }}>
          Turno ya cerrado
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            No puedes iniciar este turno porque ya fue cerrado hoy.
          </Alert>
          <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', mb: 1 }}>
            Ya existe un turno <strong>{duplicateWarning?.operatorType === 'DIURNO' ? 'Diurno' : 'Nocturno'}</strong> cerrado para la fecha <strong>{duplicateWarning?.date}</strong>.
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
            Si necesitas registrar ventas adicionales, abre el turno cerrado en <strong>Historiales</strong> y edita los datos desde alli. No se permite crear un turno duplicado para el mismo dia y tipo.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => setDuplicateWarning(null)}
            sx={{ minWidth: 120, fontWeight: 600, bgcolor: '#C62828', '&:hover': { bgcolor: '#B71C1C' } }}
          >
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbarError}
        autoHideDuration={8000}
        onClose={() => setSnackbarError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setSnackbarError('')}
          sx={{ width: '100%', borderRadius: 2, fontWeight: 600 }}
        >
          {snackbarError}
        </Alert>
      </Snackbar>
    </Box>
  );
}