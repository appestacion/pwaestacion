// src/pages/supervisor/RecepcionGandola.jsx
import React, { useEffect, useState } from 'react';
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
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Paper from '@mui/material/Paper';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { useGandolaStore } from '../../store/useGandolaStore.js';
import { useCierreStore } from '../../store/useCierreStore.js';
import useStore from '../../store/useStore.js';
import { formatNumber } from '../../lib/formatters.js';
import { TANK_LABELS } from '../../config/constants.js';
import { enqueueSnackbar } from 'notistack';

const TANK_CAPACITY = 35000;

export default function RecepcionGandola() {
  const {
    currentReception,
    initNewReception,
    loadCurrentReception,
    updateReceptionField,
    updateTankReception,
    closeReception,
    cancelReception,
  } = useGandolaStore();

  const { currentShift } = useCierreStore();
  const getAllUsers = useStore((s) => s.getAllUsers);
  const [supervisors, setSupervisors] = useState([]);

  useEffect(() => {
    loadCurrentReception();
  }, [loadCurrentReception]);

  useEffect(() => {
    const load = async () => {
      const users = await getAllUsers();
      const sups = (Array.isArray(users) ? users : []).filter(
        (u) => u.role === 'supervisor' && u.active
      );
      setSupervisors(sups);
    };
    load();
  }, [getAllUsers]);

  const handleStartReception = () => {
    initNewReception();
    enqueueSnackbar({ message: 'Recepción de Gandola iniciada', variant: 'info' });
  };

  const handleClose = () => {
    closeReception();
    enqueueSnackbar({ message: 'Recepción de Gandola cerrada exitosamente', variant: 'success' });
  };

  const handleCancel = () => {
    cancelReception();
    enqueueSnackbar({ message: 'Recepción cancelada', variant: 'warning' });
  };

  const r = currentReception || {};

  const safeSupervisorId =
    supervisors.length > 0 && supervisors.some((s) => s.id === r.supervisorId)
      ? r.supervisorId
      : '';

  const totalLitersBefore = r.tankReadings
    ? r.tankReadings.reduce((s, t) => s + (t.litersBefore || 0), 0)
    : 0;
  const totalLitersAfter = r.tankReadings
    ? r.tankReadings.reduce((s, t) => s + (t.litersAfter || 0), 0)
    : 0;
  const totalReceived = totalLitersAfter - totalLitersBefore;
  const totalCompartment =
    (r.compartment1Liters || 0) + (r.compartment2Liters || 0) + (r.compartment3Liters || 0);

  // Caudalímetro y diferencia
  const caudalimetro = r.caudalimetro || 0;
  const diferencia = caudalimetro - totalCompartment;
  const diferenciaSign = diferencia >= 0 ? '+' : '';
  const diferenciaColor = diferencia > 0 ? '#2E7D32' : diferencia < 0 ? '#D32F2F' : '#757575';

  const handleSupervisorChange = (e) => {
    const selectedId = e.target.value;
    const sup = supervisors.find((s) => s.id === selectedId);
    updateReceptionField('supervisorId', selectedId);
    updateReceptionField('supervisorName', sup ? sup.name : '');
  };

  const handleSendWhatsAppBefore = () => {
    if (!currentReception) return;

    let text = '*Antes de la descarga*\n';
    (r.tankReadings || []).forEach((tank) => {
      const label = (TANK_LABELS[tank.tankId] || tank.tankId).replace('Tanque ', 'T');
      text += `${label}: ${formatNumber(tank.litersBefore || 0, 0)} lts\n`;
    });
    text += `Total: ${formatNumber(totalLitersBefore, 0)} lts`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    enqueueSnackbar({ message: 'Enviando WhatsApp (Antes de la descarga)...', variant: 'info' });
  };

  const handleSendWhatsAppAfter = () => {
    if (!currentReception) return;

    let text = '*Después de la descarga*\n';
    (r.tankReadings || []).forEach((tank) => {
      const label = (TANK_LABELS[tank.tankId] || tank.tankId).replace('Tanque ', 'T');
      text += `${label}: ${formatNumber(tank.litersAfter || 0, 0)} lts\n`;
    });
    text += `Total: ${formatNumber(totalLitersAfter, 0)} lts`;

    if (caudalimetro > 0) {
      text += `\n\nCaudalímetro: ${diferenciaSign}${formatNumber(diferencia, 0)} L`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    enqueueSnackbar({ message: 'Enviando WhatsApp (Después de la descarga)...', variant: 'info' });
  };

  const getTankColor = (liters) => {
    const pct = (liters / TANK_CAPACITY) * 100;
    if (liters >= TANK_CAPACITY) return '#D32F2F';
    if (pct >= 90) return '#F57C00';
    if (pct >= 75) return '#FBC02D';
    return '#2E7D32';
  };

  const getTankStatus = (liters) => {
    if (liters >= TANK_CAPACITY) return { text: 'LLENO', color: '#D32F2F' };
    const available = TANK_CAPACITY - liters;
    if (available <= 5000) return { text: 'POCO ESPACIO', color: '#F57C00' };
    if (available <= 10000) return { text: 'REGULAR', color: '#FBC02D' };
    return { text: 'DISPONIBLE', color: '#2E7D32' };
  };

  const renderTankBar = (tank) => {
    const liters = tank.litersBefore || 0;
    const available = Math.max(TANK_CAPACITY - liters, 0);
    const fillPct = Math.min((liters / TANK_CAPACITY) * 100, 100);
    const status = getTankStatus(liters);
    const barColor = getTankColor(liters);

    return (
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {TANK_LABELS[tank.tankId]}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Disponible: <b style={{ color: status.color }}>{formatNumber(available, 0)} L</b>
            </Typography>
            <Chip
              label={status.text}
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20, bgcolor: status.color, color: '#fff' }}
            />
          </Box>
        </Box>

        <Box sx={{ position: 'relative', width: '100%', height: 32, bgcolor: '#ECEFF1', borderRadius: 2, overflow: 'hidden', border: '1px solid #CFD8DC' }}>
          <Box sx={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${fillPct}%`, bgcolor: barColor, borderRadius: '4px 0 0 4px', transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 0.5 }}>
            {fillPct > 15 && (
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.7rem' }}>
                {formatNumber(liters, 0)} L
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.3 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>0 L</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
            Capacidad: {formatNumber(TANK_CAPACITY, 0)} L
          </Typography>
        </Box>
      </Box>
    );
  };

  // ========== DOWNLOAD SUGGESTION LOGIC ==========
  const buildSuggestions = () => {
    const compartments = [
      { name: 'Compartimento 1', liters: r.compartment1Liters || 0 },
      { name: 'Compartimento 2', liters: r.compartment2Liters || 0 },
      { name: 'Compartimento 3', liters: r.compartment3Liters || 0 },
    ].filter((c) => c.liters > 0);

    if (compartments.length === 0 || !(r.tankReadings || []).length) return [];

    // Sort compartments: [0]=largest, [1]=middle, [2]=smallest
    const sorted = [...compartments].sort((a, b) => b.liters - a.liters);

    const tankData = (r.tankReadings || []).map((t) => ({
      id: t.tankId,
      label: TANK_LABELS[t.tankId] || t.tankId,
      current: t.litersBefore || 0,
      available: Math.max(TANK_CAPACITY - (t.litersBefore || 0), 0),
    })).sort((a, b) => b.available - a.available);

    const remaining = tankData.map((t) => ({ ...t }));
    const suggestions = [];
    const assigned = new Set(); // indices in `sorted` that are already assigned

    // ===== PRIORITY 1: 2 largest compartments in 1 tank =====
    if (sorted.length >= 2) {
      const biggestTank = remaining[0]; // tank with most space
      if (biggestTank) {
        const twoLargest = sorted[0].liters + sorted[1].liters;
        if (biggestTank.available >= twoLargest) {
          suggestions.push({
            compartment: sorted[0].name,
            liters: sorted[0].liters,
            type: 'single',
            allocations: [{ tank: biggestTank.label, tankId: biggestTank.id, liters: sorted[0].liters }],
          });
          suggestions.push({
            compartment: sorted[1].name,
            liters: sorted[1].liters,
            type: 'single',
            allocations: [{ tank: biggestTank.label, tankId: biggestTank.id, liters: sorted[1].liters }],
          });
          biggestTank.available -= twoLargest;
          assigned.add(0);
          assigned.add(1);
        }
      }
    }

    // ===== PRIORITY 2: largest + smallest in 1 tank =====
    if (assigned.size === 0 && sorted.length >= 2) {
      const biggestTank = remaining[0];
      if (biggestTank) {
        const largestPlusSmallest = sorted[0].liters + sorted[sorted.length - 1].liters;
        if (biggestTank.available >= largestPlusSmallest) {
          suggestions.push({
            compartment: sorted[0].name,
            liters: sorted[0].liters,
            type: 'single',
            allocations: [{ tank: biggestTank.label, tankId: biggestTank.id, liters: sorted[0].liters }],
          });
          suggestions.push({
            compartment: sorted[sorted.length - 1].name,
            liters: sorted[sorted.length - 1].liters,
            type: 'single',
            allocations: [{ tank: biggestTank.label, tankId: biggestTank.id, liters: sorted[sorted.length - 1].liters }],
          });
          biggestTank.available -= largestPlusSmallest;
          assigned.add(0);
          assigned.add(sorted.length - 1);
        }
      }
    }

    // ===== PROCESS REMAINING COMPARTMENTS =====
    for (let i = 0; i < sorted.length; i++) {
      if (assigned.has(i)) continue;

      const comp = sorted[i];

      // Try single tank first
      const singleTank = remaining.find((t) => t.available >= comp.liters);

      if (singleTank) {
        suggestions.push({
          compartment: comp.name,
          liters: comp.liters,
          type: 'single',
          allocations: [{ tank: singleTank.label, tankId: singleTank.id, liters: comp.liters }],
        });
        singleTank.available -= comp.liters;
      } else {
        // Distributed: try 2 tanks first, then all
        const tanksWithSpace = remaining.filter((t) => t.available > 0);
        const sortedBySpace = [...tanksWithSpace].sort((a, b) => b.available - a.available);
        const top2 = sortedBySpace.slice(0, 2);
        const top2Capacity = top2.reduce((s, t) => s + t.available, 0);
        const selectedTanks = top2Capacity >= comp.liters ? top2 : sortedBySpace;
        const selectedCapacity = selectedTanks.reduce((s, t) => s + t.available, 0);

        let remainingLiters = comp.liters;
        const allocations = [];

        for (const tank of selectedTanks) {
          if (remainingLiters <= 0) break;
          const share = Math.min(
            Math.round((tank.available / selectedCapacity) * comp.liters),
            tank.available
          );
          if (share > 0) {
            allocations.push({ tank: tank.label, tankId: tank.id, liters: share });
            tank.available -= share;
            remainingLiters -= share;
          }
        }

        // Second pass: fill remainder
        if (remainingLiters > 0) {
          for (const tank of selectedTanks) {
            if (remainingLiters <= 0) break;
            const extra = Math.min(remainingLiters, tank.available);
            if (extra > 0) {
              const existing = allocations.find((a) => a.tankId === tank.id);
              if (existing) {
                existing.liters += extra;
              } else {
                allocations.push({ tank: tank.label, tankId: tank.id, liters: extra });
              }
              tank.available -= extra;
              remainingLiters -= extra;
            }
          }
        }

        suggestions.push({
          compartment: comp.name,
          liters: comp.liters,
          type: allocations.length > 1 ? 'distributed' : 'single',
          allocations,
        });
      }
    }

    // ========== POST-PROCESS: Round distributed to multiples of 1000 ==========
    for (const sug of suggestions) {
      if (sug.type !== 'distributed' || sug.allocations.length === 0) continue;

      let totalRounded = 0;
      for (const alloc of sug.allocations) {
        alloc.liters = Math.floor(alloc.liters / 1000) * 1000;
        totalRounded += alloc.liters;
      }

      sug.allocations = sug.allocations.filter((a) => a.liters > 0);

      const remainder = sug.liters - totalRounded;

      if (remainder > 0) {
        const usedTankIds = new Set(sug.allocations.map((a) => a.tankId));
        const otherTanks = (r.tankReadings || [])
          .filter((t) => !usedTankIds.has(t.tankId))
          .map((t) => ({
            id: t.tankId,
            label: TANK_LABELS[t.tankId] || t.tankId,
            available: Math.max(TANK_CAPACITY - (t.litersBefore || 0), 0),
          }))
          .filter((t) => t.available >= remainder)
          .sort((a, b) => b.available - a.available);

        if (otherTanks.length > 0) {
          sug.allocations.push({
            tank: otherTanks[0].label,
            tankId: otherTanks[0].id,
            liters: remainder,
          });
        } else {
          const bestAlloc = sug.allocations.reduce(
            (best, alloc) => {
              const tank = (r.tankReadings || []).find((t) => t.tankId === alloc.tankId);
              const avail = tank ? Math.max(TANK_CAPACITY - (tank.litersBefore || 0), 0) - alloc.liters : 0;
              return avail > best.avail ? { alloc, avail } : best;
            },
            { alloc: null, avail: -1 }
          );

          if (bestAlloc.alloc && bestAlloc.avail >= remainder) {
            bestAlloc.alloc.liters += remainder;
          }
        }
      }

      sug.allocations = sug.allocations.filter((a) => a.liters > 0);
      if (sug.allocations.length <= 1) sug.type = 'single';
    }

    return suggestions;
  };

  const suggestions = buildSuggestions();
  const totalAvailableAll = (r.tankReadings || []).reduce(
    (s, t) => s + Math.max(TANK_CAPACITY - (t.litersBefore || 0), 0),
    0
  );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Recepción de Gandola</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Registro de lecturas de tanques antes y después de la descarga de combustible
        </Typography>
      </Box>

      {!currentReception ? (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <LocalShippingIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Inicia el proceso de recepción para registrar las lecturas de los tanques antes y después de la descarga.
            </Alert>
            <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={handleStartReception} sx={{ px: 4 }}>
              Iniciar Recepción de Gandola
            </Button>
            {currentShift && (
              <Box sx={{ mt: 3 }}>
                <Chip label={`Turno activo: ${currentShift.date}`} color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
              </Box>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ===== RECEPCIÓN EN PROGRESO ===== */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <LocalShippingIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>Recepción en Progreso</Typography>
                <Chip label={r.date || ''} size="small" color="default" />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Supervisor que Recibe</InputLabel>
                    <Select value={safeSupervisorId} label="Supervisor que Recibe" onChange={handleSupervisorChange}>
                      {supervisors.map((sup) => (
                        <MenuItem key={sup.id} value={sup.id}>{sup.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Nombre del Chofer" value={r.gandolaDriver || ''} onChange={(e) => updateReceptionField('gandolaDriver', e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="C.I. del Chofer" value={r.driverCI || ''} onChange={(e) => updateReceptionField('driverCI', e.target.value)} placeholder="Ej: V-12345678" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Compartimento 1 (Litros)" type="number" value={r.compartment1Liters || ''} onChange={(e) => updateReceptionField('compartment1Liters', parseFloat(e.target.value) || 0)} InputProps={{ endAdornment: <span style={{ marginLeft: 4 }}>L</span> }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Compartimento 2 (Litros)" type="number" value={r.compartment2Liters || ''} onChange={(e) => updateReceptionField('compartment2Liters', parseFloat(e.target.value) || 0)} InputProps={{ endAdornment: <span style={{ marginLeft: 4 }}>L</span> }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Compartimento 3 (Litros)" type="number" value={r.compartment3Liters || ''} onChange={(e) => updateReceptionField('compartment3Liters', parseFloat(e.target.value) || 0)} InputProps={{ endAdornment: <span style={{ marginLeft: 4 }}>L</span> }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, bgcolor: '#E8F5E9', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Cantidad Neta Total</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>{formatNumber(totalCompartment, 0)} L</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Hora de Llegada" type="time" value={r.arrivalTime || ''} onChange={(e) => updateReceptionField('arrivalTime', e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Hora de Salida" type="time" value={r.departureTime || ''} onChange={(e) => updateReceptionField('departureTime', e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth label="Precintos" value={r.precintos || ''} onChange={(e) => updateReceptionField('precintos', e.target.value)} placeholder="Número de precintos..." />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField fullWidth label="Caudalímetro" type="number" value={r.caudalimetro || ''} onChange={(e) => updateReceptionField('caudalimetro', parseFloat(e.target.value) || 0)} placeholder="Lectura del caudalímetro" InputProps={{ endAdornment: <span style={{ marginLeft: 4 }}>L</span> }} />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Paper sx={{ p: 2, bgcolor: diferencia === 0 ? '#F5F5F5' : diferencia > 0 ? '#E8F5E9' : '#FFEBEE', borderRadius: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Diferencia</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: diferenciaColor }}>
                      {caudalimetro > 0 ? `${diferenciaSign}${formatNumber(diferencia, 0)} L` : '—'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                      Caudalímetro − Cantidad Neta
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* ===== LECTURAS ANTES ===== */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#F57C00' }}>Lecturas de Tanques - Antes de la Descarga</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Registre los centímetros (CM) de cada tanque ANTES de iniciar la descarga.</Typography>
                </Box>
                <Button variant="contained" startIcon={<WhatsAppIcon />} onClick={handleSendWhatsAppBefore} sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' }, borderRadius: 2 }}>
                  WhatsApp Antes
                </Button>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Tanque</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#FFF3E0' }} align="center">CM</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#FFF3E0' }} align="right">Litros</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(r.tankReadings || []).map((tank, idx) => (
                      <TableRow key={tank.tankId}>
                        <TableCell sx={{ fontWeight: 600 }}>{TANK_LABELS[tank.tankId]}</TableCell>
                        <TableCell align="center" sx={{ bgcolor: '#FFF8E1' }}>
                          <TextField type="number" variant="standard" value={tank.cmBefore || ''} onChange={(e) => updateTankReception(idx, 'cmBefore', e.target.value)} sx={{ width: 100, '& input': { textAlign: 'center' } }} placeholder="CM" inputProps={{ step: 0.5 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#FFF8E1', fontWeight: 600, color: 'text.secondary' }}>
                          {formatNumber(tank.litersBefore || 0, 0)} L
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#FFE0B2' }}>TOTAL</TableCell>
                      <TableCell sx={{ bgcolor: '#FFE0B2' }} />
                      <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#FFE0B2', color: '#F57C00', fontSize: '1rem' }}>
                        {formatNumber(totalLitersBefore, 0)} L
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* ===== CAPACIDAD DISPONIBLE ===== */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565C0', mb: 1 }}>Capacidad Disponible por Tanque</Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, p: 1, bgcolor: '#F5F5F5', borderRadius: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: '#2E7D32' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Disponible</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: '#FBC02D' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Llenándose</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: '#F57C00' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Poco espacio</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: '#D32F2F' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Lleno</Typography>
                </Box>
              </Box>

              {(r.tankReadings || []).map((tank) => (
                <Box key={`cap-${tank.tankId}`}>{renderTankBar(tank)}</Box>
              ))}

              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 1.5, bgcolor: '#E3F2FD', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>Capacidad Total</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1565C0' }}>{formatNumber(TANK_CAPACITY * (r.tankReadings || []).length, 0)} L</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 1.5, bgcolor: '#FFF8E1', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>Nivel Actual</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#F57C00' }}>{formatNumber(totalLitersBefore, 0)} L</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 1.5, bgcolor: '#E8F5E9', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>Espacio Disponible</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#2E7D32' }}>{formatNumber(totalAvailableAll, 0)} L</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* ===== SUGERENCIA DE DESCARGA ===== */}
          {totalCompartment > 0 && (r.tankReadings || []).length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <LocalShippingIcon sx={{ color: '#7B1FA2' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#7B1FA2' }}>
                    Sugerencia de Descarga
                  </Typography>
                </Box>

                {totalCompartment > totalAvailableAll ? (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      No hay espacio suficiente. La gandola trae {formatNumber(totalCompartment, 0)} L pero solo hay {formatNumber(totalAvailableAll, 0)} L disponibles. Faltan {formatNumber(totalCompartment - totalAvailableAll, 0)} L.
                    </Typography>
                  </Alert>
                ) : (
                  <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                    <Typography variant="body2">
                      Hay espacio disponible ({formatNumber(totalAvailableAll, 0)} L) para los {formatNumber(totalCompartment, 0)} L de la gandola.
                    </Typography>
                  </Alert>
                )}

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#F3E5F5' }}>Compartimento</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#F3E5F5' }} align="right">Litros</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#F3E5F5' }} align="center">Tipo</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#F3E5F5' }}>Descargar en</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {suggestions.map((sug) => (
                        <TableRow key={sug.compartment}>
                          <TableCell sx={{ fontWeight: 600 }}>{sug.compartment}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{formatNumber(sug.liters, 0)} L</TableCell>
                          <TableCell align="center">
                            {sug.type === 'single' && (
                              <Chip label="Completo" size="small" sx={{ bgcolor: '#2E7D32', color: '#fff', fontWeight: 600, fontSize: '0.7rem' }} />
                            )}
                            {sug.type === 'distributed' && (
                              <Chip label="Distribuido" size="small" sx={{ bgcolor: '#F57C00', color: '#fff', fontWeight: 600, fontSize: '0.7rem' }} />
                            )}
                            {sug.type === 'overflow' && (
                              <Chip label="SIN ESPACIO" size="small" sx={{ bgcolor: '#D32F2F', color: '#fff', fontWeight: 600, fontSize: '0.7rem' }} />
                            )}
                          </TableCell>
                          <TableCell>
                            {sug.type === 'overflow' ? (
                              <Typography variant="body2" sx={{ color: '#D32F2F', fontWeight: 600 }}>
                                No cabe en ningún tanque
                              </Typography>
                            ) : sug.type === 'single' ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ArrowRightIcon sx={{ fontSize: 16, color: '#2E7D32' }} />
                                <Chip
                                  label={`${sug.allocations[0].tank} (${formatNumber(sug.allocations[0].liters, 0)} L)`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ borderColor: '#2E7D32', color: '#2E7D32', fontWeight: 600 }}
                                />
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {sug.allocations.map((alloc, allocIdx) => {
                                  const isRounded = alloc.liters > 0 && alloc.liters % 1000 === 0;
                                  const isRemainder = allocIdx === sug.allocations.length - 1 && !isRounded;
                                  return (
                                    <Box key={`${sug.compartment}-${alloc.tankId}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <ArrowRightIcon sx={{ fontSize: 14, color: isRemainder ? '#1565C0' : '#F57C00' }} />
                                      <Chip
                                        label={`${alloc.tank}: ${formatNumber(alloc.liters, 0)} L${isRemainder ? ' (resto)' : ''}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          borderColor: isRemainder ? '#1565C0' : '#F57C00',
                                          color: isRemainder ? '#1565C0' : '#F57C00',
                                          fontWeight: 600,
                                          fontSize: '0.7rem',
                                        }}
                                      />
                                    </Box>
                                  );
                                })}
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Resumen por Tanque Después de Descarga Sugerida:</Typography>
                <Grid container spacing={1}>
                  {(r.tankReadings || []).map((tank) => {
                    const tankLabel = TANK_LABELS[tank.tankId] || tank.tankId;
                    const currentLiters = tank.litersBefore || 0;
                    let incoming = 0;
                    suggestions.forEach((sug) => {
                      sug.allocations.forEach((alloc) => {
                        if (alloc.tankId === tank.tankId) incoming += alloc.liters;
                      });
                    });
                    const projected = currentLiters + incoming;
                    const pct = (projected / TANK_CAPACITY) * 100;
                    const projColor = pct > 95 ? '#D32F2F' : pct > 85 ? '#F57C00' : pct > 70 ? '#FBC02D' : '#2E7D32';

                    return (
                      <Grid item xs={6} sm={4} key={`proj-${tank.tankId}`}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            border: '1px solid #E0E0E0',
                            height: '100%',
                            minHeight: 110,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>{tankLabel}</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                              Actual: {formatNumber(currentLiters, 0)} L
                            </Typography>
                            {incoming > 0 && (
                              <Typography variant="body2" sx={{ color: '#2E7D32', fontSize: '0.75rem', fontWeight: 600 }}>
                                + {formatNumber(incoming, 0)} L
                              </Typography>
                            )}
                            {!incoming && (
                              <Typography variant="body2" sx={{ color: '#BDBDBD', fontSize: '0.75rem' }}>
                                &nbsp;
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: projColor, mt: 0.5 }}>
                            Final: {formatNumber(projected, 0)} L ({pct.toFixed(1)}%)
                          </Typography>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* ===== LECTURAS DESPUÉS ===== */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2E7D32' }}>Lecturas de Tanques - Después de la Descarga</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Registre los centímetros (CM) de cada tanque DESPUÉS de completar la descarga.</Typography>
                </Box>
                <Button variant="contained" startIcon={<WhatsAppIcon />} onClick={handleSendWhatsAppAfter} sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' }, borderRadius: 2 }}>
                  WhatsApp Después
                </Button>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Tanque</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#E8F5E9' }} align="center">CM</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#E8F5E9' }} align="right">Litros</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(r.tankReadings || []).map((tank, idx) => (
                      <TableRow key={tank.tankId}>
                        <TableCell sx={{ fontWeight: 600 }}>{TANK_LABELS[tank.tankId]}</TableCell>
                        <TableCell align="center" sx={{ bgcolor: '#F1F8E9' }}>
                          <TextField type="number" variant="standard" value={tank.cmAfter || ''} onChange={(e) => updateTankReception(idx, 'cmAfter', e.target.value)} sx={{ width: 100, '& input': { textAlign: 'center' } }} placeholder="CM" inputProps={{ step: 0.5 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#F1F8E9', fontWeight: 600, color: 'text.secondary' }}>
                          {formatNumber(tank.litersAfter || 0, 0)} L
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: '#C8E6C9' }}>TOTAL</TableCell>
                      <TableCell sx={{ bgcolor: '#C8E6C9' }} />
                      <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#C8E6C9', color: '#2E7D32', fontSize: '1rem' }}>
                        {formatNumber(totalLitersAfter, 0)} L
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />

              <Paper sx={{ p: 2, bgcolor: '#E3F2FD', borderRadius: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Total Antes</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatNumber(totalLitersBefore, 0)} L</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Total Después</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatNumber(totalLitersAfter, 0)} L</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Litros Recibidos</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: totalReceived > 0 ? 'success.main' : 'text.secondary' }}>
                      {totalReceived > 0 ? `+${formatNumber(totalReceived, 0)} L` : '—'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </CardContent>
          </Card>

          {/* ===== BOTONES ===== */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={handleCancel}>Cancelar Recepción</Button>
            <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={handleClose}>Cerrar Recepción</Button>
          </Box>
        </>
      )}
    </Box>
  );
}