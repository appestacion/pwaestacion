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
import { useCierreStore } from '../../store/useCierreStore.js';
import { calculateBiblia, calculateBibliaTotals } from '../../lib/calculations.js';
import { formatBs, formatUSD, formatNumber } from '../../lib/formatters.js';
import { ISLAND_LABELS } from '../../config/constants.js';

export default function Biblia() {
  const { currentShift, loadCurrentShift } = useCierreStore();

  useEffect(() => {
    loadCurrentShift();
  }, [loadCurrentShift]);

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

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Biblia</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Resumen financiero por isla — {currentShift.date} — Tasa: {formatBs(currentShift.tasa1)}
        </Typography>
      </Box>

      <Card sx={{ mb: 3, overflowX: 'auto' }}>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }}>Isla</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }}>Operador</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Lit. Ref</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Bs Total</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Bs→$</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">USD</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">PV</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">UE</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Vales</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Transf.</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Ingresos $</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#FFD100', color: '#1A1A2E' }} align="right">Prop. $</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#FFD100', color: '#1A1A2E' }} align="right">Prop. Bs</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {biblia.map((b) => (
                  <TableRow key={b.islandId} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{ISLAND_LABELS[b.islandId]}</TableCell>
                    <TableCell>{b.operatorName || '—'}</TableCell>
                    <TableCell align="right">{formatNumber(b.litersRef, 2)}</TableCell>
                    <TableCell align="right">{formatBs(b.bsTotal)}</TableCell>
                    <TableCell align="right">{formatUSD(b.bsInUSD)}</TableCell>
                    <TableCell align="right">{formatUSD(b.usdTotal)}</TableCell>
                    <TableCell align="right">{formatUSD(b.puntoTotal)}</TableCell>
                    <TableCell align="right">{formatUSD(b.ueTotal)}</TableCell>
                    <TableCell align="right">{formatUSD(b.valesMonto)}</TableCell>
                    <TableCell align="right">{formatUSD(b.transferenciaMonto)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {formatUSD(b.ingresosTotalUSD)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        bgcolor: '#FFF8E1',
                        color: b.propinaUSD > 0 ? 'success.main' : 'error.main',
                      }}
                    >
                      {formatUSD(b.propinaUSD)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        bgcolor: '#FFF8E1',
                        color: b.propinaBs > 0 ? 'success.main' : 'error.main',
                      }}
                    >
                      {formatBs(b.propinaBs)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#F5F5F5' }} colSpan={2}>
                    TOTAL GENERAL
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F5F5F5' }}>
                    {formatNumber(totals.totalLitersRef, 2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F5F5F5' }}>
                    {formatBs(totals.totalBs)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F5F5F5' }}>
                    {formatUSD(totals.totalBsInUSD)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F5F5F5' }}>
                    {formatUSD(totals.totalUSD)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F5F5F5' }}>
                    {formatUSD(totals.totalPunto)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F5F5F5' }}>
                    {formatUSD(totals.totalUE)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F5F5F5' }}>
                    {formatUSD(totals.totalVales)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#F5F5F5' }}>
                    {formatUSD(totals.totalTransferencia)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#E8F5E9', color: 'success.main' }}>
                    {formatUSD(totals.totalIngresosUSD)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#FFF8E1', color: 'success.main' }}>
                    {formatUSD(totals.totalPropinaUSD)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#FFF8E1', color: 'success.main' }}>
                    {formatBs(totals.totalPropinaBs)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Total Ingresos</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                {formatUSD(totals.totalIngresosUSD)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Propina Total $</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                {formatUSD(totals.totalPropinaUSD)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'secondary.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Propina Total Bs</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                {formatBs(totals.totalPropinaBs)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
