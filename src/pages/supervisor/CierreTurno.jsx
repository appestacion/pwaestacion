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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CurrencyInput from '../../components/common/CurrencyInput.jsx';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useProductStore } from '../../store/useProductStore.js';
import { formatBs, formatUSD } from '../../lib/formatters.js';
import { ISLAND_LABELS } from '../../config/constants.js';
import { enqueueSnackbar } from 'notistack';

export default function CierreTurno() {
  const {
    currentShift,
    loadCurrentShift,
    updateIslandField,
    updateCorteBs,
    updateCorteUSD,
    recalcIslandPV,
    saveCurrentShift,
    addProductSold,
    removeProductSold,
  } = useCierreStore();
  const { products, loadProducts } = useProductStore();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productQty, setProductQty] = useState(1);

  useEffect(() => {
    loadCurrentShift();
    loadProducts();
  }, [loadCurrentShift, loadProducts]);

  const handleSave = () => {
    [1, 2, 3].forEach((id) => recalcIslandPV(id));
    saveCurrentShift();
    enqueueSnackbar({ message: 'Cierre guardado correctamente', variant: 'success' });
  };

  const handleAddProduct = (islandId) => {
    if (!selectedProduct) return;
    const existing = currentShift?.islands.find((i) => i.islandId === islandId);
    const already = existing?.productsSold.find((p) => p.productName === selectedProduct);
    if (already) {
      const newProducts = (existing?.productsSold ?? []).map((p) =>
        p.productName === selectedProduct ? { ...p, quantity: p.quantity + productQty } : p
      );
      updateIslandField(islandId, 'productsSold', newProducts);
    } else {
      addProductSold(islandId, { productName: selectedProduct, quantity: productQty });
    }
    setSelectedProduct('');
    setProductQty(1);
  };

  if (!currentShift) {
    return <Alert severity="warning">No hay un turno activo. Ve al Dashboard e inicia un turno.</Alert>;
  }

  const activeProducts = products.filter((p) => p.active);
  // NOCTURNO (7PM-7AM) uses 2 tasas, DIURNO (7AM-7PM) uses 1 tasa
  const isNocturno = currentShift.operatorShiftType === 'NOCTURNO';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Cierre de Turno</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Registro de cortes, PV, vales y productos — {currentShift.date}
          </Typography>
        </Box>
        <Button variant="contained" onClick={handleSave} startIcon={<SaveIcon />}>
          Guardar Cierre
        </Button>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, '& .MuiTab-root': { fontWeight: 600 } }}
      >
        <Tab label={ISLAND_LABELS[1]} />
        <Tab label={ISLAND_LABELS[2]} />
        <Tab label={ISLAND_LABELS[3]} />
      </Tabs>

      {[1, 2, 3].map((islandId) => {
        const island = currentShift.islands.find((i) => i.islandId === islandId);
        if (activeTab !== islandId - 1) return null;

        return (
          <Box key={islandId}>
            {/* Operator Name */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={`Operador ${ISLAND_LABELS[islandId]}`}
                      value={island.operatorName}
                      onChange={(e) => updateIslandField(islandId, 'operatorName', e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Cortes en Bs. */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
                  Cortes en Bolivares
                </Typography>
                <Grid container spacing={1}>
                  {island.cortesBs.map((val, idx) => (
                    <Grid item xs={6} sm={4} md={3} key={idx}>
                      <CurrencyInput
                        label={`Corte ${idx + 1}`}
                        value={val}
                        onChange={(v) => updateCorteBs(islandId, idx, v)}
                        currency="BS"
                      />
                    </Grid>
                  ))}
                  <Grid item xs={6} sm={4} md={3}>
                    <CurrencyInput
                      label="Bs. Adicionales"
                      value={island.bsAdicionales}
                      onChange={(v) => updateIslandField(islandId, 'bsAdicionales', v)}
                      currency="BS"
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 1, textAlign: 'right' }}>
                  <Chip label={`Total Bs: ${formatBs(island.cortesBs.reduce((s, v) => s + v, 0) + island.bsAdicionales)}`} color="primary" size="small" />
                </Box>
              </CardContent>
            </Card>

            {/* Cortes en USD */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'success.main' }}>
                  Cortes en Dolares
                </Typography>
                <Grid container spacing={1}>
                  {island.cortesUSD.map((val, idx) => (
                    <Grid item xs={6} sm={4} md={3} key={idx}>
                      <CurrencyInput
                        label={`Corte ${idx + 1}`}
                        value={val}
                        onChange={(v) => updateCorteUSD(islandId, idx, v)}
                        currency="USD"
                      />
                    </Grid>
                  ))}
                  <Grid item xs={6} sm={4} md={3}>
                    <CurrencyInput
                      label="$ Adicionales"
                      value={island.usdAdicionales}
                      onChange={(v) => updateIslandField(islandId, 'usdAdicionales', v)}
                      currency="USD"
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 1, textAlign: 'right' }}>
                  <Chip label={`Total $: ${formatUSD(island.cortesUSD.reduce((s, v) => s + v, 0) + island.usdAdicionales)}`} color="success" size="small" />
                </Box>
              </CardContent>
            </Card>

            {/* PV (Punto de Venta) - Tasa 1 */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'secondary.main' }}>
                  Punto de Venta (Tasa 1)
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <CurrencyInput
                      label="Monto 1 ($)"
                      value={island.pvMonto1}
                      onChange={(v) => {
                        updateIslandField(islandId, 'pvMonto1', v);
                        setTimeout(() => recalcIslandPV(islandId), 0);
                      }}
                      currency="USD"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <CurrencyInput
                      label="Monto 2 ($)"
                      value={island.pvMonto2}
                      onChange={(v) => {
                        updateIslandField(islandId, 'pvMonto2', v);
                        setTimeout(() => recalcIslandPV(islandId), 0);
                      }}
                      currency="USD"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <CurrencyInput
                      label="Monto 3 ($)"
                      value={island.pvMonto3}
                      onChange={(v) => {
                        updateIslandField(islandId, 'pvMonto3', v);
                        setTimeout(() => recalcIslandPV(islandId), 0);
                      }}
                      currency="USD"
                    />
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Total PV:</strong> {formatUSD(island.pvTotalUSD)} = {formatBs(island.pvTotalBs)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* PV Tasa 2 - ONLY for NOCTURNO shift (7PM-7AM) */}
            {isNocturno && (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'info.main' }}>
                    Punto de Venta (Tasa 2) — Turno Nocturno
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <CurrencyInput
                        label="PV2 Monto 1 ($)"
                        value={island.pv2Monto1}
                        onChange={(v) => {
                          updateIslandField(islandId, 'pv2Monto1', v);
                          setTimeout(() => recalcIslandPV(islandId), 0);
                        }}
                        currency="USD"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CurrencyInput
                        label="PV2 Monto 2 ($)"
                        value={island.pv2Monto2}
                        onChange={(v) => {
                          updateIslandField(islandId, 'pv2Monto2', v);
                          setTimeout(() => recalcIslandPV(islandId), 0);
                        }}
                        currency="USD"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CurrencyInput
                        label="PV2 Monto 3 ($)"
                        value={island.pv2Monto3}
                        onChange={(v) => {
                          updateIslandField(islandId, 'pv2Monto3', v);
                          setTimeout(() => recalcIslandPV(islandId), 0);
                        }}
                        currency="USD"
                      />
                    </Grid>
                  </Grid>
                  {island.pv2TotalUSD > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Total PV2:</strong> {formatUSD(island.pv2TotalUSD)} = {formatBs(island.pv2TotalBs)}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* UE, Vales, Transferencias */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                  Otros Ingresos
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <CurrencyInput
                      label="UE ($)"
                      value={island.ueUSD}
                      onChange={(v) => updateIslandField(islandId, 'ueUSD', v)}
                      currency="USD"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <CurrencyInput
                      label="Vales ($)"
                      value={island.valesMonto}
                      onChange={(v) => updateIslandField(islandId, 'valesMonto', v)}
                      currency="USD"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <CurrencyInput
                      label="Transferencia ($)"
                      value={island.transferenciaMonto}
                      onChange={(v) => updateIslandField(islandId, 'transferenciaMonto', v)}
                      currency="USD"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Descripcion Vales"
                      value={island.valesDescripcion}
                      onChange={(e) => updateIslandField(islandId, 'valesDescripcion', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Descripcion Transferencia"
                      value={island.transferenciaDescripcion}
                      onChange={(e) => updateIslandField(islandId, 'transferenciaDescripcion', e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Products Sold */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                  Productos Vendidos
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <TextField
                    select
                    size="small"
                    label="Producto"
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    sx={{ minWidth: 250 }}
                  >
                    {activeProducts.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} (${p.priceUSD.toFixed(2)})
                      </option>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Cantidad"
                    type="number"
                    value={productQty}
                    onChange={(e) => setProductQty(parseInt(e.target.value) || 1)}
                    sx={{ width: 100 }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddProduct(islandId)}
                    disabled={!selectedProduct}
                  >
                    Agregar
                  </Button>
                </Box>

                {island.productsSold.length > 0 && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>Cantidad</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Precio Unit.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                          <TableCell align="center"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {island.productsSold.map((ps, idx) => {
                          const prod = activeProducts.find((p) => p.name === ps.productName);
                          const price = prod?.priceUSD || 0;
                          return (
                            <TableRow key={idx}>
                              <TableCell>{ps.productName}</TableCell>
                              <TableCell align="center">{ps.quantity}</TableCell>
                              <TableCell align="right">{formatUSD(price)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {formatUSD(price * ps.quantity)}
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => removeProductSold(islandId, idx)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        );
      })}
    </Box>
  );
}
