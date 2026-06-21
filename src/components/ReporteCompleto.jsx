// src/components/ReporteCompleto.jsx
// Componente interno: Reporte Completo (dentro del Dialog)
// Muestra todas las tablas del informe: encabezado, surtidores, tanques, cortes,
// biblia por isla, cuadre PV, totales, productos vendidos, vales y transferencias.
// Extraído de HistorialCierres.jsx como archivo independiente.

import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';

import { calculateBiblia, calculateBibliaTotals, calculateCuadrePV, calculateCuadrePVTotals } from '../lib/calculations.js';
import { formatBs, formatUSD, formatNumber } from '../lib/formatters.js';
import { cmToLiters } from '../lib/conversions.js';
import { bsToUsd, usdToBs } from '../lib/conversions.js';
import { ISLAND_LABELS } from '../config/constants.js';
import { STATION_IDENTITY } from '../store/useConfigStore.js';

// ── Estilos tipo formulario impreso (consistente con Biblia.jsx) ──
const border = '1px solid #666';
const c = { border, p: '4px 6px', fontSize: '0.72rem', lineHeight: 1.3 };
const tot = { ...c, fontWeight: 700, bgcolor: '#dcdcdc' };
const sec = { ...c, fontWeight: 700, bgcolor: '#bbb', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 };
const resumenSec = { ...sec, bgcolor: '#888', color: '#fff' };

export default function ReporteCompleto({ shift, config, products }) {
  // ── Config con identidad de la estación ──
  const cfg = { ...STATION_IDENTITY, ...config };
  // ── Cálculos ──
  const precioLitroUSD = config?.precioLitroUSD || 0.50;
  const biblia = useMemo(() => calculateBiblia(shift, precioLitroUSD), [shift, precioLitroUSD]);
  // ★ FIX: pasar shift a calculateBibliaTotals para que incluya gastos en resumenItems
  const bibliaTotals = useMemo(() => {
    if (biblia.length === 0) return null;
    return calculateBibliaTotals(biblia, shift);
  }, [biblia, shift]);
  const cuadre = useMemo(() => calculateCuadrePV(shift), [shift]);
  const cuadreTotals = useMemo(() => {
    if (!shift || cuadre.length === 0) return null;
    return calculateCuadrePVTotals(cuadre, shift.tasa1, shift.tasa2);
  }, [shift, cuadre]);

  const isNocturno = shift.operatorShiftType === 'NOCTURNO';
  const turnoLabel = isNocturno ? '2TO' : '1TO';
  const tasa1 = shift.tasa1 || 0;
  const tasa2 = shift.tasa2 || 0;
  const hasTasa2 = isNocturno && tasa2 > 0 && tasa2 !== tasa1;
  // ★ FIX: misma lógica que CuadrePV.jsx — tasas iguales cuando tasa2 es 0 o ambas son iguales
  const tasasIguales = tasa2 <= 0 || tasa1 === tasa2;

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const parts = (shift.date || '').split('/');
  const shiftDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
  const dayName = dayNames[shiftDate.getDay()] || '';

  // ── Agrupar surtidores por isla ──
  const pumpsByIsland = useMemo(() => {
    const map = {};
    if (shift.pumpReadings) {
      shift.pumpReadings.forEach((r) => {
        if (!map[r.islandId]) map[r.islandId] = [];
        map[r.islandId].push(r);
      });
    }
    return map;
  }, [shift.pumpReadings]);

  // ── Litros vendidos total — informativo ──
  const totalLitersSold = precioLitroUSD > 0 ? (bibliaTotals?.totalLitersRef || 0) / precioLitroUSD : 0;
  // ── Estilos de celda ──
  const lbl = { ...c, fontWeight: 600, whiteSpace: 'nowrap' };
  const dataCell = { ...c, textAlign: 'center' };
  const infoCell = { ...c, textAlign: 'center', fontStyle: 'italic', color: '#666' };
  const descCell = { ...c, fontStyle: 'italic', fontSize: '0.65rem', color: '#555' };
  const totalValue = { ...tot, bgcolor: '#888', color: '#fff', textAlign: 'center', fontWeight: 800, fontSize: '0.8rem' };

  // ── Resumen calculado — idéntico a Biblia.jsx ──
  const totalBs = bibliaTotals?.totalBs || 0;
  const totalPropinaBs = bibliaTotals?.totalPropinaBs || 0;
  const restoBs = totalBs - totalPropinaBs;
  const bsResumenUSD = bsToUsd(restoBs, tasa1);
  const haySobregiro = bsResumenUSD < 0;
  const sobregiroUSD = haySobregiro ? Math.abs(bsResumenUSD) : 0;

  // ★ FIX: usar resumenItems[] como Biblia.jsx (incluye vales, transferencias Y gastos)
  const itemsTotalUSD = (bibliaTotals?.resumenItems || []).reduce((s, item) => s + item.montoUSD, 0);
  const totalResumenUSD = haySobregiro
    ? (bibliaTotals.totalUsdSinUE + bibliaTotals.totalPunto + bibliaTotals.totalUeUSD + itemsTotalUSD)
    : (bsResumenUSD + bibliaTotals.totalUsdSinUE + bibliaTotals.totalPunto + bibliaTotals.totalUeUSD + itemsTotalUSD);

  // ── Cálculos para tarjetas dinámicas — idénticos a Biblia.jsx ──
  const totalGastosUSD = (bibliaTotals?.resumenItems || [])
    .filter(i => i.tipo === 'Gasto')
    .reduce((s, i) => s + i.montoUSD, 0);

  const netoSinGastosUSD = totalResumenUSD - totalGastosUSD;

  const totalCajaChicaUSD = sobregiroUSD + totalGastosUSD;
  const totalCajaChicaBs = usdToBs(totalCajaChicaUSD, tasa1);

  const totalDolaresAEntregarUSD = (bibliaTotals?.totalUsdSinUE || 0) + (bibliaTotals?.totalUeUSD || 0);

  // ── Render: Tabla Biblia por isla — idéntica a Biblia.jsx ──
  const renderIslaBiblia = (data) => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={sec} colSpan={3}>
              ISLA {data.islandId} &nbsp;|&nbsp; Operador: {data.operatorName || '—'}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Litros:</TableCell>
            <TableCell sx={infoCell}>{precioLitroUSD > 0 && data.litersRef > 0 ? formatNumber(data.litersRef / precioLitroUSD, 0) + ' L' : ''}</TableCell>
            <TableCell sx={infoCell}>{data.litersRef > 0 ? formatUSD(data.litersRef) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Bs.:</TableCell>
            <TableCell sx={dataCell}>{data.bsTotal > 0 ? formatBs(data.bsTotal) : ''}</TableCell>
            <TableCell sx={dataCell}>{data.bsInUSD > 0 ? formatUSD(data.bsInUSD) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>$:</TableCell>
            <TableCell sx={dataCell}></TableCell>
            <TableCell sx={dataCell}>{data.usdSinUE > 0 ? formatUSD(data.usdSinUE) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Punto:</TableCell>
            <TableCell sx={dataCell}></TableCell>
            <TableCell sx={dataCell}>{data.puntoTotal > 0 ? formatUSD(data.puntoTotal) : ''}</TableCell>
          </TableRow>
          {/* ★ FIX: UE$ en vez de UE — igual que Biblia.jsx */}
          <TableRow>
            <TableCell sx={lbl}>UE$:</TableCell>
            <TableCell sx={dataCell}></TableCell>
            <TableCell sx={dataCell}>{data.ueUSD > 0 ? formatUSD(data.ueUSD) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Vale(s):</TableCell>
            <TableCell sx={descCell}>{data.valesDescripcion || ''}</TableCell>
            <TableCell sx={dataCell}>{data.valesMonto > 0 ? formatUSD(data.valesMonto) : ''}</TableCell>
          </TableRow>
          {/* ★ FIX: Transferencia(s) en vez de Transferencias — igual que Biblia.jsx */}
          <TableRow>
            <TableCell sx={lbl}>Transferencia(s):</TableCell>
            <TableCell sx={descCell}>{data.transferenciaDescripcion || ''}</TableCell>
            <TableCell sx={dataCell}>{data.transferenciaMonto > 0 ? formatUSD(data.transferenciaMonto) : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={lbl}>Propina:</TableCell>
            <TableCell sx={dataCell}>{data.propinaBs > 0 ? formatBs(data.propinaBs) : ''}</TableCell>
            <TableCell sx={dataCell}>{data.propinaUSD > 0 ? formatUSD(data.propinaUSD) : ''}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ── Render: Tabla Resumen (2 columnas) — idéntica a Biblia.jsx ──
  const renderResumen = () => {
    // ★ FIX: usar resumenItems[] individuales como Biblia.jsx (incluye gastos)
    const items = bibliaTotals?.resumenItems || [];

    return (
      <TableContainer>
        <Table size="small" sx={{ '& td': { border } }}>
          <TableBody>
            <TableRow>
              <TableCell sx={resumenSec} colSpan={2}>RESUMEN</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={lbl}>Litros Vendidos:</TableCell>
              <TableCell sx={infoCell}>{totalLitersSold > 0 ? formatNumber(totalLitersSold, 2) + ' L' : ''}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={lbl}>Bs.:</TableCell>
              <TableCell sx={dataCell}>{haySobregiro ? '' : (bsResumenUSD > 0 ? formatUSD(bsResumenUSD) : '')}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={lbl}>$:</TableCell>
              <TableCell sx={dataCell}>{bibliaTotals?.totalUsdSinUE > 0 ? formatUSD(bibliaTotals.totalUsdSinUE) : ''}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={lbl}>Punto:</TableCell>
              <TableCell sx={dataCell}>{bibliaTotals?.totalPunto > 0 ? formatUSD(bibliaTotals.totalPunto) : ''}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={lbl}>UE$:</TableCell>
              <TableCell sx={dataCell}>{bibliaTotals?.totalUeUSD > 0 ? formatUSD(bibliaTotals.totalUeUSD) : ''}</TableCell>
            </TableRow>
            {/* ★ FIX: items individuales (vales, transferencias, gastos) igual que Biblia.jsx */}
            {items.map((item, idx) => (
              <TableRow key={`res-item-${idx}`}>
                <TableCell sx={lbl}>
                  {item.tipo}{item.concepto ? `: (${item.concepto})` : ':'}
                </TableCell>
                <TableCell sx={dataCell}>{item.montoUSD > 0 ? formatUSD(item.montoUSD) : ''}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff' }}>Total:</TableCell>
              <TableCell sx={totalValue}>{formatUSD(totalResumenUSD)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // ── Construir grilla de biblia ──
  const allBlocks = [...biblia.map(b => ({ type: 'isla', data: b })), { type: 'resumen' }];
  const gridRows = [];
  for (let i = 0; i < allBlocks.length; i += 2) {
    gridRows.push({ left: allBlocks[i], right: allBlocks[i + 1] || null });
  }

  // ── Total litros por isla (para la tabla de surtidores) ──
  const getIslandLiters = (islandId) => {
    const pumps = pumpsByIsland[islandId] || [];
    return pumps.reduce((sum, r) => sum + Math.max(0, r.litersSold || 0), 0);
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* ═══ Encabezado del informe ═══ */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {cfg.stationLogo ? (
              <Avatar
                src={cfg.stationLogo}
                alt={cfg.stationName}
                sx={{ width: 56, height: 56, borderRadius: 1.5 }}
                variant="rounded"
              />
            ) : (
              <Box sx={{ width: 56, height: 56, borderRadius: 1.5, bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LocalGasStationIcon sx={{ fontSize: 32, color: 'grey.500' }} />
              </Box>
            )}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
                {cfg.stationName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                RIF: {cfg.stationRif}
              </Typography>
              {cfg.stationAddress && (
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  {cfg.stationAddress}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Chip
              icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
              label={shift.date}
              size="small"
              variant="outlined"
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Turno: {turnoLabel} {dayName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Tasa: {formatNumber(tasa1, 2)}</Typography>
              {hasTasa2 && (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Tasa 2: {formatNumber(tasa2, 2)}</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* ═══ Sección 1: Lectura de Surtidores ═══ */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
          Lectura de Surtidores
        </Typography>
        <Grid container spacing={2}>
          {Object.keys(pumpsByIsland)
            .map(Number)
            .sort((a, b) => a - b)
            .map((islandId) => {
              const pumps = pumpsByIsland[islandId] || [];
              const islandTotal = getIslandLiters(islandId);
              return (
                <Grid item xs={12} sm={6} md={4} key={islandId}>
                  <TableContainer>
                    <Table size="small" sx={{ '& td, & th': { border } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={sec} colSpan={4}>
                            {ISLAND_LABELS[islandId]}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#dcdcdc', textAlign: 'center' }}>Surt.</TableCell>
                          <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#dcdcdc', textAlign: 'center' }}>Lect. Inicial</TableCell>
                          <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#dcdcdc', textAlign: 'center' }}>Lect. Final</TableCell>
                          <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#dcdcdc', textAlign: 'center' }}>Litros</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pumps.map((pump, idx) => (
                          <TableRow key={idx}>
                            <TableCell sx={{ ...c, textAlign: 'center' }}>{pump.pumpNumber}</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'center' }}>{formatNumber(pump.initialReading || 0, 0)}</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'center' }}>{formatNumber(pump.finalReading || 0, 0)}</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'center' }}>{formatNumber(Math.max(0, pump.litersSold || 0), 0)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell sx={{ ...tot, textAlign: 'right' }} colSpan={3}>Total Litros:</TableCell>
                          <TableCell sx={{ ...tot, textAlign: 'center' }}>{formatNumber(islandTotal, 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              );
            })}
        </Grid>
        {/* Total Vendido en el Turno */}
        {shift.pumpReadings && shift.pumpReadings.length > 0 && (
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Chip
              label={`Total Vendido en el Turno: ${formatNumber(shift.pumpReadings.reduce((s, r) => s + Math.max(0, r.litersSold || 0), 0), 0)} L`}
              color="primary"
              size="medium"
              sx={{ fontWeight: 800, fontSize: '0.9rem', px: 2, py: 0.5 }}
            />
          </Box>
        )}
      </Paper>

      {/* ═══ Sección 2: Lectura de Tanques ═══ */}
      {shift.tankReadings && shift.tankReadings.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Lectura de Tanques
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { border } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={sec}>Tanque</TableCell>
                  <TableCell sx={sec}>CM</TableCell>
                  <TableCell sx={sec}>Litros</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shift.tankReadings.map((tank) => (
                  <TableRow key={tank.tankId}>
                    <TableCell sx={{ ...c, textAlign: 'center', fontWeight: 600 }}>Tanque {tank.tankId}</TableCell>
                    <TableCell sx={{ ...c, textAlign: 'center' }}>{tank.cm > 0 ? formatNumber(tank.cm, 1) : '—'}</TableCell>
                    <TableCell sx={{ ...c, textAlign: 'center' }}>{tank.liters > 0 ? formatNumber(tank.liters, 0) : '—'}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ ...tot, textAlign: 'right' }}>Total:</TableCell>
                  <TableCell sx={{ ...tot, textAlign: 'center' }}></TableCell>
                  <TableCell sx={{ ...tot, textAlign: 'center' }}>
                    {formatNumber(shift.tankReadings.reduce((s, t) => s + (t.liters || 0), 0), 0)} L
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ═══ Sección 3: Cortes por Isla (Bs / USD) ═══ */}
      {shift.islands && shift.islands.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Cortes por Isla
          </Typography>
          <Grid container spacing={2}>
            {shift.islands.map((island) => {
              const cBs = (island.cortesBs || []).filter(v => v > 0);
              const cUsd = (island.cortesUSD || []).filter(v => v > 0);
              const totalCortesBs = cBs.reduce((s, v) => s + v, 0) + (island.bsAdicionales || 0);
              const totalCortesUSD = cUsd.reduce((s, v) => s + v, 0) + (island.usdAdicionales || 0);
              return (
                <Grid item xs={12} sm={6} md={4} key={island.islandId}>
                  <Typography variant="subtitle2" sx={{
                    bgcolor: '#CE1126', color: 'white', p: '4px 8px', borderRadius: '4px 4px 0 0',
                    fontWeight: 700, fontSize: '0.75rem',
                  }}>
                    {ISLAND_LABELS[island.islandId]} — {island.operatorName || '—'}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border, borderBottom: 'none' }}>
                    {/* Tabla Bs */}
                    <TableContainer sx={{ borderBottom: 'none' }}>
                      <Table size="small" sx={{ '& td': { border } }}>
                        <TableBody>
                          <TableRow><TableCell sx={{ ...sec, bgcolor: '#CE1126' }}>Corte</TableCell><TableCell sx={{ ...sec, bgcolor: '#CE1126' }}>Bs.</TableCell></TableRow>
                          {cBs.length > 0 ? cBs.map((val, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={c}>Corte {idx + 1}</TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right' }}>{formatBs(val)}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell sx={descCell} colSpan={2}>Sin cortes</TableCell></TableRow>
                          )}
                          <TableRow>
                            <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#FFF3E0' }}>UE Bs.</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'right', bgcolor: '#FFF3E0' }}>{formatBs(island.bsAdicionales || 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={tot}>Total Bs.</TableCell>
                            <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatBs(totalCortesBs)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {/* Tabla USD */}
                    <TableContainer sx={{ borderBottom: 'none' }}>
                      <Table size="small" sx={{ '& td': { border } }}>
                        <TableBody>
                          <TableRow><TableCell sx={{ ...sec, bgcolor: '#2E7D32' }}>Corte</TableCell><TableCell sx={{ ...sec, bgcolor: '#2E7D32' }}>$</TableCell></TableRow>
                          {cUsd.length > 0 ? cUsd.map((val, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={c}>Corte {idx + 1}</TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right' }}>{formatUSD(val)}</TableCell>
                            </TableRow>
                          )) : (
                            <TableRow><TableCell sx={descCell} colSpan={2}>Sin cortes</TableCell></TableRow>
                          )}
                          <TableRow>
                            <TableCell sx={{ ...c, fontWeight: 700, bgcolor: '#FFF3E0' }}>UE $</TableCell>
                            <TableCell sx={{ ...c, textAlign: 'right', bgcolor: '#FFF3E0' }}>{formatUSD(island.usdAdicionales || 0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={tot}>Total $</TableCell>
                            <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatUSD(totalCortesUSD)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
          {/* Total General */}
          <Box sx={{
            mt: 2, p: 1.5, bgcolor: '#dcdcdc', borderRadius: 1,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1,
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Total General</Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
                Bs: {formatBs(shift.islands.reduce((s, i) => s + (i.cortesBs || []).reduce((a, v) => a + v, 0) + (i.bsAdicionales || 0), 0))}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
                $: {formatUSD(shift.islands.reduce((s, i) => s + (i.cortesUSD || []).reduce((a, v) => a + v, 0) + (i.usdAdicionales || 0), 0))}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* ═══ Sección 4: Biblia — Resumen Financiero ═══ */}
      {biblia.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Biblia — Resumen Financiero
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}>
            {gridRows.map((row, idx) => (
              <React.Fragment key={idx}>
                <Box>
                  {row.left.type === 'isla'
                    ? renderIslaBiblia(row.left.data)
                    : renderResumen()
                  }
                </Box>
                {row.right ? (
                  <Box>
                    {row.right.type === 'isla'
                      ? renderIslaBiblia(row.right.data)
                      : renderResumen()
                    }
                  </Box>
                ) : (
                  <Box />
                )}
              </React.Fragment>
            ))}
          </Box>

          {/* ★ FIX: Tarjetas dinámicas idénticas a Biblia.jsx */}
          <Box sx={{
            display: 'flex',
            gap: 2,
            mt: 3,
            mx: 'auto',
            maxWidth: 900,
            flexWrap: 'wrap',
          }}>
            {/* SOBREGIRO */}
            {haySobregiro && (
              <Paper sx={{
                flex: '1 1 0',
                minWidth: 200,
                p: 2,
                bgcolor: '#FFF3E0',
                border: '2px solid #E65100',
                borderRadius: 2,
                textAlign: 'center',
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#E65100', letterSpacing: 1 }}>
                  SOBREGIRO
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#BF360C', mt: 1 }}>
                  {formatUSD(sobregiroUSD)}
                </Typography>
              </Paper>
            )}

            {/* TOTAL GASTOS */}
            {totalGastosUSD > 0 && (
              <Paper sx={{
                flex: '1 1 0',
                minWidth: 200,
                p: 2,
                bgcolor: '#E3F2FD',
                border: '2px solid #1565C0',
                borderRadius: 2,
                textAlign: 'center',
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1565C0', letterSpacing: 1 }}>
                  TOTAL GASTOS
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#0D47A1', mt: 1 }}>
                  {formatUSD(totalGastosUSD)}
                </Typography>
              </Paper>
            )}

            {/* TOTAL DOLARES A ENTREGAR */}
            {totalDolaresAEntregarUSD > 0 && (
              <Paper sx={{
                flex: '1 1 0',
                minWidth: 200,
                p: 2,
                bgcolor: '#F3E5F5',
                border: '2px solid #7B1FA2',
                borderRadius: 2,
                textAlign: 'center',
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#7B1FA2', letterSpacing: 1 }}>
                  TOTAL DOLARES A ENTREGAR
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#4A148C', mt: 1 }}>
                  {formatUSD(totalDolaresAEntregarUSD)}
                </Typography>
              </Paper>
            )}

            {/* TOTAL BOLIVARES A ENTREGAR */}
            {!haySobregiro && bsResumenUSD > 0 && (
              <Paper sx={{
                flex: '1 1 0',
                minWidth: 200,
                p: 2,
                bgcolor: '#E8F5E9',
                border: '2px solid #2E7D32',
                borderRadius: 2,
                textAlign: 'center',
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#2E7D32', letterSpacing: 1 }}>
                  TOTAL BOLIVARES A ENTREGAR
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#1B5E20', mt: 1 }}>
                  {formatUSD(bsResumenUSD)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#2E7D32', fontWeight: 600, mt: 0.5 }}>
                  {formatBs(restoBs)}
                </Typography>
              </Paper>
            )}

            {/* TOTAL A TOMAR DE RESERVA — con sobregiro */}
            {haySobregiro && (
              <Paper sx={{
                flex: '1 1 0',
                minWidth: 200,
                p: 2,
                bgcolor: '#E8F5E9',
                border: '2px solid #2E7D32',
                borderRadius: 2,
                textAlign: 'center',
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#2E7D32', letterSpacing: 1 }}>
                  TOTAL A TOMAR DE RESERVA
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#1B5E20', mt: 1 }}>
                  {formatUSD(totalCajaChicaUSD)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#2E7D32', fontWeight: 600, mt: 0.5 }}>
                  {formatBs(totalCajaChicaBs)}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1, fontSize: '0.7rem' }}>
                  <Typography variant="caption" sx={{ color: '#E65100' }}>Sobregiro: {formatUSD(sobregiroUSD)}</Typography>
                  <Typography variant="caption" sx={{ color: '#1565C0' }}>Gastos: {formatUSD(totalGastosUSD)}</Typography>
                </Box>
              </Paper>
            )}
          </Box>
        </Paper>
      )}

      {/* ═══ Sección 5: Cuadre Punto de Venta — idéntico a CuadrePV.jsx ═══ */}
      {cuadre.length > 0 && cuadreTotals && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Cuadre Punto de Venta
          </Typography>
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { border } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={sec}>Isla</TableCell>
                  <TableCell sx={sec}>Bs.</TableCell>
                  <TableCell sx={sec}>$</TableCell>
                  <TableCell sx={sec}>Litros</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cuadre.map((r) => (
                  <React.Fragment key={r.islandId}>
                    <TableRow>
                      <TableCell sx={{ ...sec, bgcolor: '#999' }} colSpan={4}>
                        {ISLAND_LABELS[r.islandId]}
                      </TableCell>
                    </TableRow>
                    {/* ★ FIX: misma lógica que CuadrePV.jsx — tasasIguales combina PV1+PV2 */}
                    {tasasIguales ? (
                      <TableRow>
                        <TableCell sx={{ ...c, fontWeight: 700 }}>({formatBs(tasa1)})</TableCell>
                        <TableCell sx={{ ...c, textAlign: 'right' }}>{formatBs((r.pvTotalBs || 0) + (r.pv2TotalBs || 0))}</TableCell>
                        <TableCell sx={{ ...c, textAlign: 'right' }}>{formatUSD((r.pvTotalUSD || 0) + (r.pv2TotalUSD || 0))}</TableCell>
                        <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 700 }}>{formatNumber((r.pvUSDinLiters || 0) + (r.pv2USDinLiters || 0), 2)}</TableCell>
                      </TableRow>
                    ) : (
                      <>
                        <TableRow>
                          <TableCell sx={{ ...c, fontWeight: 700 }}>Tasa 1 ({formatBs(tasa1)})</TableCell>
                          <TableCell sx={{ ...c, textAlign: 'right' }}>{formatBs(r.pvTotalBs)}</TableCell>
                          <TableCell sx={{ ...c, textAlign: 'right' }}>{formatUSD(r.pvTotalUSD)}</TableCell>
                          <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 700 }}>{formatNumber(r.pvUSDinLiters, 2)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ ...c, fontWeight: 700 }}>Tasa 2 ({formatBs(tasa2)})</TableCell>
                          <TableCell sx={{ ...c, textAlign: 'right' }}>{formatBs(r.pv2TotalBs)}</TableCell>
                          <TableCell sx={{ ...c, textAlign: 'right' }}>{formatUSD(r.pv2TotalUSD)}</TableCell>
                          <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 700 }}>{formatNumber(r.pv2USDinLiters, 2)}</TableCell>
                        </TableRow>
                      </>
                    )}
                  </React.Fragment>
                ))}
                {/* ★ FIX: Totales idénticos a CuadrePV.jsx */}
                {tasasIguales ? (
                  <TableRow>
                    <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'left' }}>Total Turno</TableCell>
                    <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'right' }}>{formatBs(cuadreTotals.grandTotalBs)}</TableCell>
                    <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'right' }}>{formatUSD(cuadreTotals.grandTotalUSD)}</TableCell>
                    <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'right' }}>{formatNumber(cuadreTotals.grandTotalLiters, 2)} L</TableCell>
                  </TableRow>
                ) : (
                  <>
                    <TableRow>
                      <TableCell sx={{ ...tot, textAlign: 'left' }}>Total Tasa 1</TableCell>
                      <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatBs(cuadreTotals.totalPVBs)}</TableCell>
                      <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatUSD(cuadreTotals.totalPVUSD)}</TableCell>
                      <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatNumber(cuadreTotals.totalPVLiters, 2)} L</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ ...tot, textAlign: 'left' }}>Total Tasa 2</TableCell>
                      <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatBs(cuadreTotals.totalPV2Bs)}</TableCell>
                      <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatUSD(cuadreTotals.totalPV2USD)}</TableCell>
                      <TableCell sx={{ ...tot, textAlign: 'right' }}>{formatNumber(cuadreTotals.totalPV2Liters, 2)} L</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'left' }}>Total Turno</TableCell>
                      <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'right' }}>{formatBs(cuadreTotals.grandTotalBs)}</TableCell>
                      <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'right' }}>{formatUSD(cuadreTotals.grandTotalUSD)}</TableCell>
                      <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff', textAlign: 'right' }}>{formatNumber(cuadreTotals.grandTotalLiters, 2)} L</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ═══ Sección 6: Productos Vendidos por Isla ═══ */}
      {shift.islands && shift.islands.some((isl) => isl.productsSold && isl.productsSold.length > 0) && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Productos Vendidos por Isla
          </Typography>
          <Grid container spacing={2}>
            {shift.islands.map((island) => {
              const sold = island.productsSold || [];
              if (sold.length === 0) return null;
              return (
                <Grid item xs={12} sm={6} md={4} key={island.islandId}>
                  <TableContainer>
                    <Table size="small" sx={{ '& td, & th': { border } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ ...sec, bgcolor: '#999' }} colSpan={3}>
                            {ISLAND_LABELS[island.islandId]} — {island.operatorName || '—'}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={sec}>Producto</TableCell>
                          <TableCell sx={sec}>Cant.</TableCell>
                          <TableCell sx={sec}>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sold.map((ps, idx) => {
                          const prod = (products || []).find((p) => p.name === ps.productName);
                          const price = prod?.priceUSD || 0;
                          const total = price * ps.quantity;
                          const method = ps.paymentMethod || 'punto_de_venta';
                          const isCombined = method === 'combinado';

                          let paymentDetail = '';
                          if (isCombined && ps.paymentBreakdown && ps.paymentBreakdown.length > 0) {
                            paymentDetail = ps.paymentBreakdown
                              .filter((bd) => bd.amountUSD > 0)
                              .map((bd) => {
                                const bdLabel = bd.method === 'punto_de_venta' ? 'PV' : bd.method === 'efectivo_bs' ? 'Ef.Bs' : bd.method === 'efectivo_usd' ? 'Ef.$' : bd.method === 'transferencia' ? 'Transf.' : bd.method;
                                const bdShowBs = bd.method === 'punto_de_venta' || bd.method === 'efectivo_bs' || bd.method === 'transferencia';
                                if (bdShowBs) {
                                  return `${bdLabel}: ${formatUSD(bd.amountUSD)} = ${formatBs(usdToBs(bd.amountUSD, tasa1))}`;
                                }
                                return `${bdLabel}: ${formatUSD(bd.amountUSD)}`;
                              })
                              .join(' | ');
                          } else {
                            const methodLabel = method === 'punto_de_venta' ? 'PV' : method === 'efectivo_bs' ? 'Ef.Bs' : method === 'efectivo_usd' ? 'Ef.$' : method === 'transferencia' ? 'Transf.' : method;
                            const showBs = method === 'punto_de_venta' || method === 'efectivo_bs' || method === 'transferencia';
                            if (showBs) {
                              paymentDetail = `${methodLabel}: ${formatUSD(total)} = ${formatBs(usdToBs(total, tasa1))}`;
                            } else {
                              paymentDetail = `(${methodLabel})`;
                            }
                            // ★ Anexar titular de la transferencia al detalle del producto
                            if (method === 'transferencia' && ps.transferenciaTitular) {
                              paymentDetail += ` — Titular: ${ps.transferenciaTitular}`;
                            }
                          }

                          return (
                            <TableRow key={idx}>
                              <TableCell sx={{ ...c, fontSize: '0.65rem' }}>
                                {ps.productName}
                                <Typography variant="caption" sx={{ display: 'block', color: '#555', fontStyle: 'italic', fontSize: '0.58rem' }}>
                                  {paymentDetail}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ ...c, textAlign: 'center' }}>{ps.quantity}</TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 700 }}>{formatUSD(total)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow>
                          <TableCell sx={{ ...tot, textAlign: 'left' }}>Subtotal:</TableCell>
                          <TableCell sx={{ ...tot, textAlign: 'center' }}>
                            {sold.reduce((s, p) => s + (p.quantity || 0), 0)}
                          </TableCell>
                          <TableCell sx={{ ...tot, textAlign: 'right' }}>
                            {formatUSD(sold.reduce((s, ps) => {
                              const prod = (products || []).find((p) => p.name === ps.productName);
                              const price = prod?.priceUSD || 0;
                              return s + price * (ps.quantity || 0);
                            }, 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}

      {/* ═══ Sección 7: Vales y Transferencias por Isla ═══ */}
      {shift.islands && shift.islands.some((isl) => {
        const vales = isl.vales || [];
        const transfers = isl.transferencias || [];
        return vales.length > 0 || transfers.length > 0;
      }) && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#CE1126' }}>
            Vales y Transferencias por Isla
          </Typography>
          <Grid container spacing={2}>
            {shift.islands.map((island) => {
              const vales = island.vales || [];
              const transfers = island.transferencias || [];
              if (vales.length === 0 && transfers.length === 0) return null;
              return (
                <Grid item xs={12} sm={6} md={4} key={island.islandId}>
                  {/* Header isla */}
                  <Typography variant="subtitle2" sx={{
                    bgcolor: '#999',
                    color: 'white',
                    p: '4px 8px',
                    borderRadius: '4px 4px 0 0',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}>
                    {ISLAND_LABELS[island.islandId]} — {island.operatorName || '—'}
                  </Typography>

                  {/* Vales */}
                  {vales.length > 0 && (
                    <TableContainer>
                      <Table size="small" sx={{ '& td, & th': { border } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ ...sec, fontSize: '0.65rem' }} colSpan={2}>Vales</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {vales.map((v, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ ...c, fontStyle: 'italic', fontSize: '0.65rem' }}>
                                {v.descripcion || `Vale ${idx + 1}`}
                              </TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 600 }}>
                                {formatUSD(v.monto || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {vales.length > 1 && (
                            <TableRow>
                              <TableCell sx={{ ...tot, textAlign: 'left' }}>Total Vales</TableCell>
                              <TableCell sx={{ ...tot, textAlign: 'right' }}>
                                {formatUSD(vales.reduce((s, v) => s + (v.monto || 0), 0))}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* Transferencias */}
                  {transfers.length > 0 && (
                    <TableContainer sx={vales.length > 0 ? { mt: 1 } : {}}>
                      <Table size="small" sx={{ '& td, & th': { border } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ ...sec, fontSize: '0.65rem' }} colSpan={2}>Transferencias</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {transfers.map((t, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ ...c, fontStyle: 'italic', fontSize: '0.65rem' }}>
                                {t.descripcion || `Transf. ${idx + 1}`}
                              </TableCell>
                              <TableCell sx={{ ...c, textAlign: 'right', fontWeight: 600 }}>
                                {formatUSD(t.monto || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {transfers.length > 1 && (
                            <TableRow>
                              <TableCell sx={{ ...tot, textAlign: 'left' }}>Total Transf.</TableCell>
                              <TableCell sx={{ ...tot, textAlign: 'right' }}>
                                {formatUSD(transfers.reduce((s, t) => s + (t.monto || 0), 0))}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}
    </Box>
  );
}