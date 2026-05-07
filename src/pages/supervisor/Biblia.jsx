// src/pages/supervisor/Biblia.jsx
import React, { useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { calculateBiblia, calculateBibliaTotals } from '../../lib/calculations.js';
import { formatBs, formatUSD, formatNumber } from '../../lib/formatters.js';

// ── Estilos tipo formulario impreso (consistente con ReporteLecturaRecepcion) ──
const b = '1px solid #666';
const c = { border: b, p: '4px 6px', fontSize: '0.72rem', lineHeight: 1.3 };
const tot = { ...c, fontWeight: 700, bgcolor: '#dcdcdc' };
const sec = { ...c, fontWeight: 700, bgcolor: '#bbb', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 };
const resumenSec = { ...sec, bgcolor: '#888', color: '#fff' };

export default function Biblia() {
  const { currentShift, loadCurrentShift } = useCierreStore();
  const config = useConfigStore((s) => s.config);

  useEffect(() => { loadCurrentShift(); }, [loadCurrentShift]);

  const biblia = useMemo(() => {
    if (!currentShift) return [];
    return calculateBiblia(currentShift);
  }, [currentShift]);

  const totals = useMemo(() => {
    if (biblia.length === 0) return null;
    return calculateBibliaTotals(biblia);
  }, [biblia]);

  if (!currentShift) {
    return <Alert severity="warning">No hay un turno activo.</Alert>;
  }

  if (!totals) return null;

  const isNocturno = currentShift.operatorShiftType === 'NOCTURNO';
  const hasTasa2 = isNocturno && (currentShift.tasa2 || 0) > 0 && (currentShift.tasa2 || 0) !== (currentShift.tasa1 || 0);
  const turnoLabel = isNocturno ? '2TO' : '1TO';

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const parts = (currentShift.date || '').split('/');
  const shiftDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
  const dayName = dayNames[shiftDate.getDay()] || '';

  const tasa1 = currentShift.tasa1 || 0;
  const tasa2 = currentShift.tasa2 || 0;

  // ── Cálculo de Bs. en Resumen: (totalBs - propinaBs) / tasa1 ──
  const totalBs = totals.totalBs || 0;
  const totalPropinaBs = totals.totalPropinaBs || 0;
  const restoBs = totalBs - totalPropinaBs;
  const bsResumenUSD = tasa1 > 0 ? restoBs / tasa1 : 0;
  const haySobregiro = bsResumenUSD < 0;
  const sobregiroUSD = haySobregiro ? Math.abs(bsResumenUSD) : 0;
  // Total del Resumen: suma solo lo visible en la tabla
  const totalResumenUSD = haySobregiro
    ? (totals.totalUsdSinUE + totals.totalPunto + totals.totalUeUSD + totals.totalVales + totals.totalTransferencia)
    : totals.totalIngresosUSD;

  // ── Estilos de celda ──
  const lbl = { ...c, fontWeight: 600, whiteSpace: 'nowrap' };
  const dataCell = { ...c, textAlign: 'center' };
  const descCell = { ...c, fontStyle: 'italic', fontSize: '0.65rem', color: '#555' };
  const totalValue = { ...tot, bgcolor: '#888', color: '#fff', textAlign: 'center', fontWeight: 800, fontSize: '0.8rem' };

  // ── Render: Tabla de una Isla ──
  const renderIslaTable = (data) => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border: b } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={sec} colSpan={3}>
              ISLA {data.islandId} &nbsp;|&nbsp; Operador: {data.operatorName || '—'}
            </TableCell>
          </TableRow>
          {/* Bs: valor en Bs izquierda, equivalente USD derecha */}
          <TableRow>
            <TableCell sx={lbl}>Bs.:</TableCell>
            <TableCell sx={dataCell}>{data.bsTotal > 0 ? formatBs(data.bsTotal) : ''}</TableCell>
            <TableCell sx={dataCell}>{data.bsInUSD > 0 ? formatUSD(data.bsInUSD) : ''}</TableCell>
          </TableRow>
          {/* $: celda izquierda vacía, valor USD derecha (cortes sin UE$) */}
          <TableRow>
            <TableCell sx={lbl}>$:</TableCell>
            <TableCell sx={dataCell}></TableCell>
            <TableCell sx={dataCell}>{data.usdSinUE > 0 ? formatUSD(data.usdSinUE) : ''}</TableCell>
          </TableRow>
          {/* Punto: valor en celda derecha */}
          <TableRow>
            <TableCell sx={lbl}>Punto:</TableCell>
            <TableCell sx={dataCell}></TableCell>
            <TableCell sx={dataCell}>{data.puntoTotal > 0 ? formatUSD(data.puntoTotal) : ''}</TableCell>
          </TableRow>
          {/* UE: valor de UE$ en celda derecha */}
          <TableRow>
            <TableCell sx={lbl}>UE:</TableCell>
            <TableCell sx={dataCell}></TableCell>
            <TableCell sx={dataCell}>{data.ueUSD > 0 ? formatUSD(data.ueUSD) : ''}</TableCell>
          </TableRow>
          {/* Vale(s): descripción izquierda, valor derecha */}
          <TableRow>
            <TableCell sx={lbl}>Vale(s):</TableCell>
            <TableCell sx={descCell}>{data.valesDescripcion || ''}</TableCell>
            <TableCell sx={dataCell}>{data.valesMonto > 0 ? formatUSD(data.valesMonto) : ''}</TableCell>
          </TableRow>
          {/* Transferencias: descripción izquierda, valor derecha */}
          <TableRow>
            <TableCell sx={lbl}>Transferencias:</TableCell>
            <TableCell sx={descCell}>{data.transferenciaDescripcion || ''}</TableCell>
            <TableCell sx={dataCell}>{data.transferenciaMonto > 0 ? formatUSD(data.transferenciaMonto) : ''}</TableCell>
          </TableRow>
          {/* Propina: Bs izquierda, USD derecha */}
          <TableRow>
            <TableCell sx={lbl}>Propina:</TableCell>
            <TableCell sx={dataCell}>{data.propinaBs > 0 ? formatBs(data.propinaBs) : ''}</TableCell>
            <TableCell sx={dataCell}>{data.propinaUSD > 0 ? formatUSD(data.propinaUSD) : ''}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ── Render: Tabla RESUMEN (2 columnas) ──
  const renderResumenTable = () => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border: b } }}>
        <TableBody>
          <TableRow>
            <TableCell sx={resumenSec} colSpan={2}>RESUMEN</TableCell>
          </TableRow>
          {/* Bs: (totalBs - propinaBs) / tasa1 */}
          <TableRow>
            <TableCell sx={lbl}>Bs.:</TableCell>
            <TableCell sx={dataCell}>{haySobregiro ? '' : (bsResumenUSD > 0 ? formatUSD(bsResumenUSD) : '')}</TableCell>
          </TableRow>
          {/* $: cortes sin UE$ */}
          <TableRow>
            <TableCell sx={lbl}>$:</TableCell>
            <TableCell sx={dataCell}>{totals.totalUsdSinUE > 0 ? formatUSD(totals.totalUsdSinUE) : ''}</TableCell>
          </TableRow>
          {/* Punto */}
          <TableRow>
            <TableCell sx={lbl}>Punto:</TableCell>
            <TableCell sx={dataCell}>{totals.totalPunto > 0 ? formatUSD(totals.totalPunto) : ''}</TableCell>
          </TableRow>
          {/* UE: suma de UE de cada isla */}
          <TableRow>
            <TableCell sx={lbl}>UE:</TableCell>
            <TableCell sx={dataCell}>{totals.totalUeUSD > 0 ? formatUSD(totals.totalUeUSD) : ''}</TableCell>
          </TableRow>
          {/* Vale(s) */}
          <TableRow>
            <TableCell sx={lbl}>Vale(s):</TableCell>
            <TableCell sx={dataCell}>{totals.totalVales > 0 ? formatUSD(totals.totalVales) : ''}</TableCell>
          </TableRow>
          {/* Transferencias */}
          <TableRow>
            <TableCell sx={lbl}>Transferencias:</TableCell>
            <TableCell sx={dataCell}>{totals.totalTransferencia > 0 ? formatUSD(totals.totalTransferencia) : ''}</TableCell>
          </TableRow>
          {/* Total */}
          <TableRow>
            <TableCell sx={{ ...tot, bgcolor: '#888', color: '#fff' }}>Total:</TableCell>
            <TableCell sx={totalValue}>{formatUSD(totalResumenUSD)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ── Construir grilla ──
  const allBlocks = [...biblia.map(b => ({ type: 'isla', data: b })), { type: 'resumen' }];
  const gridRows = [];
  for (let i = 0; i < allBlocks.length; i += 2) {
    gridRows.push({ left: allBlocks[i], right: allBlocks[i + 1] || null });
  }

  return (
    <Box>
      {/* ═══ Encabezado (estilo consistente con ReporteLecturaRecepcion) ═══ */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {config.stationLogo ? (
            <Avatar
              src={config.stationLogo}
              alt={config.stationName}
              sx={{ width: 64, height: 64, borderRadius: 1.5 }}
              variant="rounded"
            />
          ) : (
            <Box sx={{ width: 64, height: 64, borderRadius: 1.5, bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LocalGasStationIcon sx={{ fontSize: 40, color: 'grey.500' }} />
            </Box>
          )}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
              Biblia
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {config.stationName}{config.stationRif !== 'J-00000000-0' ? ` — ${config.stationRif}` : ''}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            component="img"
            src="/PDVSA.png"
            alt="PDVSA"
            sx={{ width: 100, height: 'auto', objectFit: 'contain' }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Chip
              icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
              label={currentShift.date}
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

      {/* ═══ Tablas en grilla responsive ═══ */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 4,
        maxWidth: 800,
        mx: 'auto',
      }}>
        {gridRows.map((row, idx) => (
          <React.Fragment key={idx}>
            <Box>
              {row.left.type === 'isla'
                ? renderIslaTable(row.left.data)
                : renderResumenTable()
              }
            </Box>
            {row.right ? (
              <Box>
                {row.right.type === 'isla'
                  ? renderIslaTable(row.right.data)
                  : renderResumenTable()
                }
              </Box>
            ) : (
              <Box />
            )}
          </React.Fragment>
        ))}
      </Box>

      {/* ═══ Tarjeta Sobregiro (si aplica) ═══ */}
      {haySobregiro && (
        <Paper sx={{
          mt: 3,
          mx: 'auto',
          maxWidth: 400,
          p: 2,
          bgcolor: '#FFF3E0',
          border: '2px solid #E65100',
          borderRadius: 2,
          textAlign: 'center',
        }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#E65100', letterSpacing: 1 }}>
            SOBREGIRO
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 900, color: '#BF360C', mt: 1 }}>
            {formatUSD(sobregiroUSD)}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}