// src/pages/supervisor/CuadrePV.jsx
import React, { useEffect, useMemo } from 'react';
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
import { useCierreStore } from '../../store/useCierreStore.js';
import { calculateCuadrePV, calculateCuadrePVTotals } from '../../lib/calculations.js';
import { formatBs, formatUSD, formatNumber } from '../../lib/formatters.js';
import { ISLAND_LABELS } from '../../config/constants.js';

const PRIMARY_BG = '#FFF3E0';

export default function CuadrePV() {
  const { currentShift, loadCurrentShift } = useCierreStore();

  useEffect(() => {
    loadCurrentShift();
  }, [loadCurrentShift]);

  const cuadre = useMemo(() => {
    if (!currentShift) return [];
    return calculateCuadrePV(currentShift);
  }, [currentShift]);

  const totals = useMemo(() => {
    if (!currentShift || cuadre.length === 0) return null;
    return calculateCuadrePVTotals(cuadre, currentShift.tasa1, currentShift.tasa2);
  }, [currentShift, cuadre]);

  if (!currentShift) {
    return <Alert severity="warning">No hay un turno activo.</Alert>;
  }

  if (!totals) return null;

  const hasTasa2 = (currentShift.tasa2 || 0) > 0;

  const tasa1TotalBs = totals.totalPVBs;
  const tasa1TotalUSD = totals.totalPVUSD;
  const tasa1TotalLiters = totals.totalPVLiters;

  const tasa2TotalBs = totals.totalPV2Bs;
  const tasa2TotalUSD = totals.totalPV2USD;
  const tasa2TotalLiters = totals.totalPV2Liters;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Cuadre Diario Punto de Venta</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {currentShift.date}
        </Typography>
      </Box>

      <Card sx={{ mb: 3, overflowX: 'auto' }}>
        <CardContent sx={{ p: 1.5 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      bgcolor: 'secondary.main',
                      color: 'white',
                      borderBottom: '2px solid #003399',
                      fontSize: '0.875rem',
                      width: '35%',
                    }}
                  >
                    Isla
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      bgcolor: 'secondary.main',
                      color: 'white',
                      borderBottom: '2px solid #003399',
                      fontSize: '0.875rem',
                      textAlign: 'right',
                    }}
                  >
                    Bs.
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      bgcolor: 'secondary.main',
                      color: 'white',
                      borderBottom: '2px solid #003399',
                      fontSize: '0.875rem',
                      textAlign: 'right',
                    }}
                  >
                    $                   </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      bgcolor: 'secondary.main',
                      color: 'white',
                      borderBottom: '2px solid #003399',
                      fontSize: '0.875rem',
                      textAlign: 'right',
                    }}
                  >
                    Litros
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cuadre.map((r) => (
                  <React.Fragment key={r.islandId}>
                    {/* Island header row */}
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        sx={{
                          fontWeight: 800,
                          bgcolor: '#E3F2FD',
                          color: 'secondary.main',
                          fontSize: '0.8rem',
                          py: 0.75,
                          borderBottom: '1px solid #90CAF9',
                        }}
                      >
                        {ISLAND_LABELS[r.islandId]}
                      </TableCell>
                    </TableRow>
                    {/* Tasa 1 row */}
                    <TableRow hover>
                      <TableCell sx={{ pl: 3, fontWeight: 600, color: 'text.secondary', fontSize: '0.85rem' }}>
                        Tasa 1 ({formatBs(currentShift.tasa1)})
                      </TableCell>
                      <TableCell align="right">{formatBs(r.pvTotalBs)}</TableCell>
                      <TableCell align="right">{formatUSD(r.pvTotalUSD)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{formatNumber(r.pvUSDinLiters, 2)}</TableCell>
                    </TableRow>
                    {/* Tasa 2 row — only if applicable */}
                    {hasTasa2 && (
                      <TableRow hover>
                        <TableCell sx={{ pl: 3, fontWeight: 600, color: 'text.secondary', fontSize: '0.85rem' }}>
                          Tasa 2 ({formatBs(currentShift.tasa2)})
                        </TableCell>
                        <TableCell align="right">{formatBs(r.pv2TotalBs)}</TableCell>
                        <TableCell align="right">{formatUSD(r.pv2TotalUSD)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatNumber(r.pv2USDinLiters, 2)}</TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}

                {/* Total Tasa 1 */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#F0F4FF', fontSize: '0.9rem' }}>
                    Total Tasa 1
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F0F4FF' }}>
                    {formatBs(tasa1TotalBs)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F0F4FF' }}>
                    {formatUSD(tasa1TotalUSD)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#E8F5E9' }}>
                    {formatNumber(tasa1TotalLiters, 2)} L
                  </TableCell>
                </TableRow>

                {/* Total Tasa 2 — only if applicable */}
                {hasTasa2 && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#E3F2FD', fontSize: '0.9rem' }}>
                      Total Tasa 2
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#E3F2FD' }}>
                      {formatBs(tasa2TotalBs)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#E3F2FD' }}>
                      {formatUSD(tasa2TotalUSD)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#E8F5E9' }}>
                      {formatNumber(tasa2TotalLiters, 2)} L
                    </TableCell>
                  </TableRow>
                )}

                {/* Total Turno (Gran Total) */}
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 900,
                      bgcolor: PRIMARY_BG,
                      color: '#CE1126',
                      fontSize: '1rem',
                      borderBottom: '2px solid #CE1126',
                    }}
                  >
                    Total Turno
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 800,
                      bgcolor: PRIMARY_BG,
                      color: '#CE1126',
                      fontSize: '0.95rem',
                      borderBottom: '2px solid #CE1126',
                    }}
                  >
                    {formatBs(totals.grandTotalBs)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 800,
                      bgcolor: PRIMARY_BG,
                      color: '#CE1126',
                      fontSize: '0.95rem',
                      borderBottom: '2px solid #CE1126',
                    }}
                  >
                    {formatUSD(totals.grandTotalUSD)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 800,
                      bgcolor: PRIMARY_BG,
                      color: '#2E7D32',
                      fontSize: '0.95rem',
                      borderBottom: '2px solid #2E7D32',
                    }}
                  >
                    {formatNumber(totals.grandTotalLiters, 2)} L
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