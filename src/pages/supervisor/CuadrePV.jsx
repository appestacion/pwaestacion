// src/pages/supervisor/CuadrePV.jsx
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
import { useProductStore } from '../../store/useProductStore.js';
import { calculateCuadrePV, calculateCuadrePVTotals } from '../../lib/calculations.js';
import { formatBs, formatUSD, formatNumber } from '../../lib/formatters.js';
import { ISLAND_LABELS } from '../../config/constants.js';

// ── Estilos tipo formulario impreso (consistente con Biblia) ──
const b = '1px solid #666';
const c = { border: b, p: '4px 6px', fontSize: '0.72rem', lineHeight: 1.3 };
const tot = { ...c, fontWeight: 700, bgcolor: '#dcdcdc' };
const sec = { ...c, fontWeight: 700, bgcolor: '#bbb', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 };
const resumenSec = { ...sec, bgcolor: '#888', color: '#fff' };
const lbl = { ...c, fontWeight: 600, whiteSpace: 'nowrap' };
const dataCell = { ...c, textAlign: 'center' };
const descCell = { ...c, fontStyle: 'italic', fontSize: '0.65rem', color: '#555' };
const totalValue = { ...tot, bgcolor: '#888', color: '#fff', textAlign: 'center', fontWeight: 800, fontSize: '0.8rem' };

export default function CuadrePV() {
  const { currentShift, loadCurrentShift } = useCierreStore();
  const config = useConfigStore((s) => s.config);
  const { products, loadProducts } = useProductStore();

  useEffect(() => { loadCurrentShift(); loadProducts(); }, [loadCurrentShift, loadProducts]);

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

  const isNocturno = currentShift.operatorShiftType === 'NOCTURNO';
  const turnoLabel = isNocturno ? '2TO' : '1TO';
  const tasa1 = currentShift.tasa1 || 0;
  const tasa2 = currentShift.tasa2 || 0;

  // Tasas iguales (o sin tasa2) → una sola fila combinada
  // Tasas diferentes → dos filas separadas con gran total
  const tasasIguales = tasa2 <= 0 || tasa1 === tasa2;

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const parts = (currentShift.date || '').split('/');
  const shiftDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
  const dayName = dayNames[shiftDate.getDay()] || '';

  // ── Render: Tabla Cuadre PV (por isla) ──
  const renderCuadreTable = () => (
    <TableContainer>
      <Table size="small" sx={{ '& td': { border: b } }}>
        <TableBody>
          {/* Encabezado de tabla */}
          <TableRow>
            <TableCell sx={sec} style={{ width: '35%' }}>Isla</TableCell>
            <TableCell sx={sec}>Bs.</TableCell>
            <TableCell sx={sec}>$</TableCell>
            <TableCell sx={sec}>Litros</TableCell>
          </TableRow>

          {cuadre.map((r) => (
            <React.Fragment key={r.islandId}>
              {/* Fila de encabezado de isla */}
              <TableRow>
                <TableCell sx={{ ...sec, bgcolor: '#999', color: '#fff', fontSize: '0.75rem' }} colSpan={4}>
                  {ISLAND_LABELS[r.islandId]}
                </TableCell>
              </TableRow>

              {/* ── TASAS IGUALES: una sola fila combinada (PV1 + PV2) ── */}
              {tasasIguales && (
                <TableRow hover>
                  <TableCell sx={lbl}>
                    ({formatBs(tasa1)})
                  </TableCell>
                  <TableCell sx={dataCell}>{formatBs((r.pvTotalBs || 0) + (r.pv2TotalBs || 0))}</TableCell>
                  <TableCell sx={dataCell}>{formatUSD((r.pvTotalUSD || 0) + (r.pv2TotalUSD || 0))}</TableCell>
                  <TableCell sx={{ ...dataCell, fontWeight: 600 }}>{formatNumber((r.pvUSDinLiters || 0) + (r.pv2USDinLiters || 0), 2)}</TableCell>
                </TableRow>
              )}

              {/* ── TASAS DIFERENTES: fila Tasa 1 ── */}
              {!tasasIguales && (
                <TableRow hover>
                  <TableCell sx={lbl}>
                    Tasa 1 ({formatBs(tasa1)})
                  </TableCell>
                  <TableCell sx={dataCell}>{formatBs(r.pvTotalBs)}</TableCell>
                  <TableCell sx={dataCell}>{formatUSD(r.pvTotalUSD)}</TableCell>
                  <TableCell sx={{ ...dataCell, fontWeight: 600 }}>{formatNumber(r.pvUSDinLiters, 2)}</TableCell>
                </TableRow>
              )}

              {/* ── TASAS DIFERENTES: fila Tasa 2 ── */}
              {!tasasIguales && (
                <TableRow hover>
                  <TableCell sx={lbl}>
                    Tasa 2 ({formatBs(tasa2)})
                  </TableCell>
                  <TableCell sx={dataCell}>{formatBs(r.pv2TotalBs)}</TableCell>
                  <TableCell sx={dataCell}>{formatUSD(r.pv2TotalUSD)}</TableCell>
                  <TableCell sx={{ ...dataCell, fontWeight: 600 }}>{formatNumber(r.pv2USDinLiters, 2)}</TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}

          {/* ── TASAS IGUALES: solo Total Turno (suma combinada) ── */}
          {tasasIguales && (
            <TableRow>
              <TableCell sx={resumenSec}>Total Turno</TableCell>
              <TableCell sx={totalValue}>{formatBs(totals.grandTotalBs)}</TableCell>
              <TableCell sx={totalValue}>{formatUSD(totals.grandTotalUSD)}</TableCell>
              <TableCell sx={{ ...totalValue, color: '#c8e6c9' }}>{formatNumber(totals.grandTotalLiters, 2)} L</TableCell>
            </TableRow>
          )}

          {/* ── TASAS DIFERENTES: Total Tasa 1 ── */}
          {!tasasIguales && (
            <TableRow>
              <TableCell sx={tot}>Total Tasa 1</TableCell>
              <TableCell sx={{ ...tot, textAlign: 'center' }}>{formatBs(totals.totalPVBs)}</TableCell>
              <TableCell sx={{ ...tot, textAlign: 'center' }}>{formatUSD(totals.totalPVUSD)}</TableCell>
              <TableCell sx={{ ...tot, textAlign: 'center', fontWeight: 600 }}>{formatNumber(totals.totalPVLiters, 2)} L</TableCell>
            </TableRow>
          )}

          {/* ── TASAS DIFERENTES: Total Tasa 2 ── */}
          {!tasasIguales && (
            <TableRow>
              <TableCell sx={tot}>Total Tasa 2</TableCell>
              <TableCell sx={{ ...tot, textAlign: 'center' }}>{formatBs(totals.totalPV2Bs)}</TableCell>
              <TableCell sx={{ ...tot, textAlign: 'center' }}>{formatUSD(totals.totalPV2USD)}</TableCell>
              <TableCell sx={{ ...tot, textAlign: 'center', fontWeight: 600 }}>{formatNumber(totals.totalPV2Liters, 2)} L</TableCell>
            </TableRow>
          )}

          {/* ── TASAS DIFERENTES: Gran Total Turno ── */}
          {!tasasIguales && (
            <TableRow>
              <TableCell sx={resumenSec}>Total Turno</TableCell>
              <TableCell sx={totalValue}>{formatBs(totals.grandTotalBs)}</TableCell>
              <TableCell sx={totalValue}>{formatUSD(totals.grandTotalUSD)}</TableCell>
              <TableCell sx={{ ...totalValue, color: '#c8e6c9' }}>{formatNumber(totals.grandTotalLiters, 2)} L</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ── Render: Vales / Transferencias / Productos por Isla ──
  const renderIslandDetails = () => {
    const islands = currentShift.islands || [];
    const hasAny = islands.some((island) => {
      const v = island.vales || [];
      const t = island.transferencias || [];
      const p = island.productsSold || [];
      return v.length > 0 || t.length > 0 || p.length > 0;
    });
    if (!hasAny) return null;

    return islands.map((island) => {
      const iid = island.islandId;
      const vales = island.vales || [];
      const transferencias = island.transferencias || [];
      const productsSold = island.productsSold || [];
      const hasContent = vales.length > 0 || transferencias.length > 0 || productsSold.length > 0;
      if (!hasContent) return null;

      const totalVales = vales.reduce((s, v) => s + (v.monto || 0), 0);
      const totalTransf = transferencias.reduce((s, t) => s + (t.monto || 0), 0);

      return (
        <Box key={iid} sx={{ mb: 2 }}>
          {/* Encabezado de isla */}
          <TableContainer>
            <Table size="small" sx={{ '& td': { border: b } }}>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ ...sec, bgcolor: '#999', color: '#fff', fontSize: '0.75rem' }} colSpan={3}>
                    {ISLAND_LABELS[iid]}
                  </TableCell>
                </TableRow>

                {/* ── Vales ── */}
                {vales.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell sx={sec} colSpan={3}>Vales</TableCell>
                    </TableRow>
                    {vales.map((v, idx) => (
                      <TableRow key={`v-${idx}`}>
                        <TableCell sx={descCell}>
                          {v.descripcion || `Vale ${idx + 1}`}
                        </TableCell>
                        <TableCell sx={dataCell} colSpan={2}>
                          {formatUSD(v.monto || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {vales.length > 1 && (
                      <TableRow>
                        <TableCell sx={tot}>Total Vales</TableCell>
                        <TableCell sx={{ ...tot, textAlign: 'center' }} colSpan={2}>
                          {formatUSD(totalVales)}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}

                {/* ── Transferencias ── */}
                {transferencias.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell sx={sec} colSpan={3}>Transferencias</TableCell>
                    </TableRow>
                    {transferencias.map((t, idx) => (
                      <TableRow key={`t-${idx}`}>
                        <TableCell sx={descCell}>
                          {t.descripcion || `Transf. ${idx + 1}`}
                        </TableCell>
                        <TableCell sx={dataCell} colSpan={2}>
                          {formatUSD(t.monto || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {transferencias.length > 1 && (
                      <TableRow>
                        <TableCell sx={tot}>Total Transferencias</TableCell>
                        <TableCell sx={{ ...tot, textAlign: 'center' }} colSpan={2}>
                          {formatUSD(totalTransf)}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}

                {/* ── Productos Vendidos ── */}
                {productsSold.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell sx={sec}>Producto</TableCell>
                      <TableCell sx={{ ...sec, textAlign: 'center' }}>Cant.</TableCell>
                      <TableCell sx={{ ...sec, textAlign: 'center' }}>Total</TableCell>
                    </TableRow>
                    {productsSold.map((ps, idx) => {
                      const prod = products.find((p) => p.name === ps.productName);
                      const price = prod?.priceUSD || 0;
                      const total = price * ps.quantity;
                      const method = ps.paymentMethod || 'punto_de_venta';
                      const showBs = method === 'punto_de_venta' || method === 'efectivo_bs';
                      const totalBs = showBs && tasa1 > 0 ? total * tasa1 : 0;
                      const methodLabel = method === 'punto_de_venta' ? 'PV'
                        : method === 'efectivo_bs' ? 'Ef.Bs'
                        : 'Ef.$';

                      return (
                        <TableRow key={`p-${idx}`}>
                          <TableCell sx={lbl}>
                            {ps.productName}
                            {showBs && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#555', fontStyle: 'italic' }}>
                                {formatBs(totalBs)} ({methodLabel})
                              </Typography>
                            )}
                            {!showBs && (
                              <Typography variant="caption" sx={{ display: 'block', color: '#555', fontStyle: 'italic' }}>
                                ({methodLabel})
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={dataCell}>{ps.quantity}</TableCell>
                          <TableCell sx={{ ...dataCell, fontWeight: 700 }}>{formatUSD(total)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    });
  };

  return (
    <Box>
      {/* ═══ Encabezado (estilo consistente con Biblia) ═══ */}
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
              Cuadre Punto de Venta
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
              {!tasasIguales && (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Tasa 2: {formatNumber(tasa2, 2)}</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* ═══ Tabla Cuadre PV (carta vertical) ═══ */}
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {renderCuadreTable()}
      </Box>

      {/* ═══ Vales, Transferencias y Productos Vendidos por Isla ═══ */}
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 3 }}>
        {renderIslandDetails()}
      </Box>
    </Box>
  );
}