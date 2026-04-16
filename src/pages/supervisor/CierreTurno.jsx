// src/pages/supervisor/Biblia.jsx
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
    const ids = (currentShift?.islands || []).map((i) => i.islandId);
    ids.forEach((id) => recalcIslandPV(id));
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

  const handleAddVale = (islandId) => {
    const existing = currentShift?.islands.find((i) => i.islandId === islandId);
    const vales = [...(existing?.vales || []), { monto: 0, descripcion: '' }];
    updateIslandField(islandId, 'vales', vales);
  };

  const handleRemoveVale = (islandId, idx) => {
    const existing = currentShift?.islands.find((i) => i.islandId === islandId);
    const vales = [...(existing?.vales || [])];
    vales.splice(idx, 1);
    updateIslandField(islandId, 'vales', vales);
  };

  const handleUpdateVale = (islandId, idx, field, value) => {
    const existing = currentShift?.islands.find((i) => i.islandId === islandId);
    const vales = [...(existing?.vales || [])];
    vales[idx] = { ...vales[idx], [field]: value };
    updateIslandField(islandId, 'vales', vales);
  };

  const handleAddTransferencia = (islandId) => {
    const existing = currentShift?.islands.find((i) => i.islandId === islandId);
    const transferencias = [...(existing?.transferencias || []), { monto: 0, descripcion: '' }];
    updateIslandField(islandId, 'transferencias', transferencias);
  };

  const handleRemoveTransferencia = (islandId, idx) => {
    const existing = currentShift?.islands.find((i) => i.islandId === islandId);
    const transferencias = [...(existing?.transferencias || [])];
    transferencias.splice(idx, 1);
    updateIslandField(islandId, 'transferencias', transferencias);
  };

  const handleUpdateTransferencia = (islandId, idx, field, value) => {
    const existing = currentShift?.islands.find((i) => i.islandId === islandId);
    const transferencias = [...(existing?.transferencias || [])];
    transferencias[idx] = { ...transferencias[idx], [field]: value };
    updateIslandField(islandId, 'transferencias', transferencias);
  };

  if (!currentShift) {
    return <Alert severity="warning">No hay un turno activo. Ve al Dashboard e inicia un turno.</Alert>;
  }

  const activeProducts = products.filter((p) => p.active);
  const isNocturno = currentShift.operatorShiftType === 'NOCTURNO';
  const tasa1 = currentShift.tasa1 || 1;

  const islandLabels = {};
  (currentShift.islands || []).forEach((isl, idx) => {
    islandLabels[isl.islandId] = `Isla ${isl.islandId}`;
  });

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
        {(currentShift.islands || []).map((isl) => (
          <Tab key={isl.islandId} label={islandLabels[isl.islandId]} />
        ))}
      </Tabs>

      {(currentShift.islands || []).map((island, tabIndex) => {
        if (activeTab !== tabIndex) return null;
        const iid = island.islandId;
        const totalCortesBs = (island.cortesBs || []).reduce((s, v) => s + v, 0) + (island.bsAdicionales || 0);
        const totalCortesBsInUSD = tasa1 > 0 ? totalCortesBs / tasa1 : 0;
        const totalVales = (island.vales || []).reduce((s, v) => s + (v.monto || 0), 0);
        const totalTransferencias = (island.transferencias || []).reduce((s, t) => s + (t.monto || 0), 0);

        return (
          <Box key={iid}>
            {/* Operator Name */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={`Operador ${islandLabels[iid]}`}
                      value={island.operatorName || ''}
                      onChange={(e) => updateIslandField(iid, 'operatorName', e.target.value)}
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
                  {(island.cortesBs || []).map((val, idx) => (
                    <Grid item xs={6} sm={4} md={3} key={idx}>
                      <CurrencyInput
                        label={`Corte ${idx + 1}`}
                        value={val}
                        onChange={(v) => updateCorteBs(iid, idx, v)}
                        currency="BS"
                      />
                    </Grid>
                  ))}
                  <Grid item xs={6} sm={4} md={3}>
                    <CurrencyInput
                      label="Bs. Adicionales"
                      value={island.bsAdicionales || 0}
                      onChange={(v) => updateIslandField(iid, 'bsAdicionales', v)}
                      currency="BS"
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 1, textAlign: 'right' }}>
                  <Chip
                    label={`Total: ${formatBs(totalCortesBs)} = ${formatUSD(totalCortesBsInUSD)}`}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
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
                  {(island.cortesUSD || []).map((val, idx) => (
                    <Grid item xs={6} sm={4} md={3} key={idx}>
                      <CurrencyInput
                        label={`Corte ${idx + 1}`}
                        value={val}
                        onChange={(v) => updateCorteUSD(iid, idx, v)}
                        currency="USD"
                      />
                    </Grid>
                  ))}
                  <Grid item xs={6} sm={4} md={3}>
                    <CurrencyInput
                      label="$ Adicionales"
                      value={island.usdAdicionales || 0}
                      onChange={(v) => updateIslandField(iid, 'usdAdicionales', v)}
                      currency="USD"
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 1, textAlign: 'right' }}>
                  <Chip
                    label={`Total: ${formatUSD((island.cortesUSD || []).reduce((s, v) => s + v, 0) + (island.usdAdicionales || 0))}`}
                    color="success"
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>

            {/* PV (Punto de Venta) - Tasa 1 */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'secondary.main' }}>
                  Punto de Venta (Tasa: {formatBs(tasa1)})
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <CurrencyInput
                      label="Monto 1 (Bs.)"
                      value={island.pvMonto1 || 0}
                      onChange={(v) => {
                        updateIslandField(iid, 'pvMonto1', v);
                        setTimeout(() => recalcIslandPV(iid), 0);
                      }}
                      currency="BS"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <CurrencyInput
                      label="Monto 2 (Bs.)"
                      value={island.pvMonto2 || 0}
                      onChange={(v) => {
                        updateIslandField(iid, 'pvMonto2', v);
                        setTimeout(() => recalcIslandPV(iid), 0);
                      }}
                      currency="BS"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <CurrencyInput
                      label="Monto 3 (Bs.)"
                      value={island.pvMonto3 || 0}
                      onChange={(v) => {
                        updateIslandField(iid, 'pvMonto3', v);
                        setTimeout(() => recalcIslandPV(iid), 0);
                      }}
                      currency="BS"
                    />
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Total PV:</strong> {formatBs(island.pvTotalBs || 0)} = {formatUSD(island.pvTotalUSD || 0)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* PV Tasa 2 - SOLO para turno NOCTURNO */}
            {isNocturno && (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'info.main' }}>
                    Punto de Venta (Tasa: {formatBs(currentShift.tasa2 || 0)})
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <CurrencyInput
                        label="PV2 Monto 1 (Bs.)"
                        value={island.pv2Monto1 || 0}
                        onChange={(v) => {
                          updateIslandField(iid, 'pv2Monto1', v);
                          setTimeout(() => recalcIslandPV(iid), 0);
                        }}
                        currency="BS"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CurrencyInput
                        label="PV2 Monto 2 (Bs.)"
                        value={island.pv2Monto2 || 0}
                        onChange={(v) => {
                          updateIslandField(iid, 'pv2Monto2', v);
                          setTimeout(() => recalcIslandPV(iid), 0);
                        }}
                        currency="BS"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CurrencyInput
                        label="PV2 Monto 3 (Bs.)"
                        value={island.pv2Monto3 || 0}
                        onChange={(v) => {
                          updateIslandField(iid, 'pv2Monto3', v);
                          setTimeout(() => recalcIslandPV(iid), 0);
                        }}
                        currency="BS"
                      />
                    </Grid>
                  </Grid>
                  {(island.pv2TotalBs || 0) > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Total PV2:</strong> {formatBs(island.pv2TotalBs || 0)} = {formatUSD(island.pv2TotalUSD || 0)}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Vales */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Vales ($)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label={`Total: ${formatUSD(totalVales)}`} color="success" size="small" />
                    <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => handleAddVale(iid)}>
                      Agregar
                    </Button>
                  </Box>
                </Box>
                {(island.vales || []).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>No hay vales registrados.</Typography>
                )}
                <Grid container spacing={1}>
                  {(island.vales || []).map((vale, idx) => (
                    <React.Fragment key={idx}>
                      <Grid item xs={5} sm={4}>
                        <CurrencyInput
                          label={`Vale ${idx + 1} ($)`}
                          value={vale.monto || 0}
                          onChange={(v) => handleUpdateVale(iid, idx, 'monto', v)}
                          currency="USD"
                        />
                      </Grid>
                      <Grid item xs={5} sm={6}>
                        <TextField
                          fullWidth
                          label="Descripcion"
                          size="small"
                          value={vale.descripcion || ''}
                          onChange={(e) => handleUpdateVale(iid, idx, 'descripcion', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={2} sm={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconButton size="small" color="error" onClick={() => handleRemoveVale(iid, idx)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </React.Fragment>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            {/* Transferencias */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Transferencias ($)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label={`Total: ${formatUSD(totalTransferencias)}`} color="success" size="small" />
                    <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => handleAddTransferencia(iid)}>
                      Agregar
                    </Button>
                  </Box>
                </Box>
                {(island.transferencias || []).length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>No hay transferencias registradas.</Typography>
                )}
                <Grid container spacing={1}>
                  {(island.transferencias || []).map((transf, idx) => (
                    <React.Fragment key={idx}>
                      <Grid item xs={5} sm={4}>
                        <CurrencyInput
                          label={`Transf. ${idx + 1} ($)`}
                          value={transf.monto || 0}
                          onChange={(v) => handleUpdateTransferencia(iid, idx, 'monto', v)}
                          currency="USD"
                        />
                      </Grid>
                      <Grid item xs={5} sm={6}>
                        <TextField
                          fullWidth
                          label="Descripcion"
                          size="small"
                          value={transf.descripcion || ''}
                          onChange={(e) => handleUpdateTransferencia(iid, idx, 'descripcion', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={2} sm={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconButton size="small" color="error" onClick={() => handleRemoveTransferencia(iid, idx)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </React.Fragment>
                  ))}
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
                    onClick={() => handleAddProduct(iid)}
                    disabled={!selectedProduct}
                  >
                    Agregar
                  </Button>
                </Box>

                {(island.productsSold || []).length > 0 && (
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
                        {(island.productsSold || []).map((ps, idx) => {
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
                                  onClick={() => removeProductSold(iid, idx)}
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