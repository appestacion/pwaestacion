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
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { useCierreStore } from '../../store/useCierreStore.js';
import { calculateCuadrePV, calculateCuadrePVTotals } from '../../lib/calculations.js';
import { formatBs, formatUSD, formatNumber } from '../../lib/formatters.js';
import { ISLAND_LABELS } from '../../config/constants.js';

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

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Cuadre Punto de Venta</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Conversión PV a USD y Litros — {currentShift.date}
        </Typography>
      </Box>

      <Card sx={{ mb: 3, overflowX: 'auto' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'secondary.main' }}>
            PV Tasa 1 ({formatBs(currentShift.tasa1)})
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'secondary.main', color: 'white' }}>Isla</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'secondary.main', color: 'white' }} align="right">PV Total USD</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'secondary.main', color: 'white' }} align="right">PV Total Bs</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'secondary.main', color: 'white' }} align="right">USD → Litros</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cuadre.map((r) => (
                  <TableRow key={r.islandId} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{ISLAND_LABELS[r.islandId]}</TableCell>
                    <TableCell align="right">{formatUSD(r.pvTotalUSD)}</TableCell>
                    <TableCell align="right">{formatBs(r.pvTotalBs)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatNumber(r.pvUSDinLiters, 2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#F0F4FF' }}>TOTAL</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F0F4FF' }}>
                    {formatUSD(totals.totalPVUSD)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F0F4FF' }}>
                    {formatBs(totals.totalPVBs)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#E8F5E9' }}>
                    {formatNumber(totals.totalPVLiters, 2)} L
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {currentShift.tasa2 > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'info.main' }}>
                PV Tasa 2 ({formatBs(currentShift.tasa2)})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'info.main', color: 'white' }}>Isla</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'info.main', color: 'white' }} align="right">PV2 Total USD</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'info.main', color: 'white' }} align="right">PV2 Total Bs</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'info.main', color: 'white' }} align="right">USD → Litros</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cuadre.map((r) => (
                      <TableRow key={r.islandId} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{ISLAND_LABELS[r.islandId]}</TableCell>
                        <TableCell align="right">{formatUSD(r.pv2TotalUSD)}</TableCell>
                        <TableCell align="right">{formatBs(r.pv2TotalBs)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatNumber(r.pv2USDinLiters, 2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#E3F2FD' }}>TOTAL</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#E3F2FD' }}>
                        {formatUSD(totals.totalPV2USD)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#E3F2FD' }}>
                        {formatBs(totals.totalPV2Bs)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#E8F5E9' }}>
                        {formatNumber(totals.totalPV2Liters, 2)} L
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* Grand Total */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Gran Total USD</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatUSD(totals.grandTotalUSD)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'secondary.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Gran Total Bs</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                {formatBs(totals.grandTotalBs)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Gran Total Litros</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                {formatNumber(totals.grandTotalLiters, 2)} L
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
