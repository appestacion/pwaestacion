// src/pages/supervisor/CierreTurno.jsx
import React, { useEffect, useState, useMemo } from 'react';
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
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import CurrencyInput from '../../components/common/CurrencyInput.jsx';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useProductStore } from '../../store/useProductStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { calculateBiblia } from '../../lib/calculations.js';
import { formatBs, formatUSD, formatNumber } from '../../lib/formatters.js';

const PAYMENT_METHODS = [
  { value: 'punto_de_venta', label: 'Punto de Venta' },
  { value: 'efectivo_bs', label: 'Efectivo Bolivares' },
  { value: 'efectivo_usd', label: 'Efectivo Dolares' },
];

export default function CierreTurno() {
  const {
    currentShift,
    loadCurrentShift,
    updateIslandField,
    updateCorteBs,
    updateCorteUSD,
    recalcIslandPV,
    addProductSold,
    removeProductSold,
  } = useCierreStore();
  const { products, loadProducts } = useProductStore();
  const maxCortes = useConfigStore((s) => s.config.maxCortes) || 12;
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productQty, setProductQty] = useState(1);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('punto_de_venta');

  useEffect(() => {
    loadCurrentShift();
    loadProducts();
  }, [loadCurrentShift, loadProducts]);

  // Calcular biblia para obtener las propinas por isla
  const bibliaData = useMemo(() => {
    if (!currentShift) return {};
    const biblia = calculateBiblia(currentShift);
    const map = {};
    biblia.forEach((b) => {
      map[b.islandId] = b;
    });
    return map;
  }, [currentShift]);

  const handleAddProduct = (islandId) => {
    if (!selectedProduct) return;
    const existing = currentShift?.islands.find((i) => i.islandId === islandId);
    const already = existing?.productsSold.find(
      (p) => p.productName === selectedProduct && p.paymentMethod === selectedPaymentMethod
    );
    if (already) {
      const newProducts = (existing?.productsSold ?? []).map((p) =>
        p.productName === selectedProduct && p.paymentMethod === selectedPaymentMethod
          ? { ...p, quantity: p.quantity + productQty }
          : p
      );
      updateIslandField(islandId, 'productsSold', newProducts);
    } else {
      addProductSold(islandId, {
        productName: selectedProduct,
        quantity: productQty,
        paymentMethod: selectedPaymentMethod,
      });
    }
    setSelectedProduct('');
    setProductQty(1);
    setSelectedPaymentMethod('punto_de_venta');
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

  const getPaymentLabel = (method) => {
    const found = PAYMENT_METHODS.find((m) => m.value === method);
    return found ? found.label : method;
  };

  if (!currentShift) {
    return <Alert severity="warning">No hay un turno activo. Ve al Dashboard e inicia un turno.</Alert>;
  }

  const activeProducts = products.filter((p) => p.active);
  const tasa1 = currentShift.tasa1 || 1;
  const tasa2 = currentShift.tasa2 || 0;

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
        <Chip label="Auto-guardado en la nube" color="success" size="small" variant="outlined" icon={<CloudSyncIcon />} />
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
        const biblia = bibliaData[iid] || {};
        const cortesBsArray = (island.cortesBs || []).slice(0, maxCortes);
        const cortesUSDArray = (island.cortesUSD || []).slice(0, maxCortes);
        const totalCortesBs = cortesBsArray.reduce((s, v) => s + v, 0) + (island.bsAdicionales || 0);
        const totalCortesBsInUSD = tasa1 > 0 ? totalCortesBs / tasa1 : 0;
        const totalCortesUSD = cortesUSDArray.reduce((s, v) => s + v, 0) + (island.usdAdicionales || 0);
        const totalVales = (island.vales || []).reduce((s, v) => s + (v.monto || 0), 0);
        const totalTransferencias = (island.transferencias || []).reduce((s, t) => s + (t.monto || 0), 0);
        const propinaUSD = biblia.propinaUSD || 0;
        const propinaBs = biblia.propinaBs || 0;

        // Verificar si hay lecturas finales registradas PARA ESTA ISLA
        const hasReadings = (currentShift.pumpReadings || []).some((r) => r.islandId === iid && r.finalReading && r.finalReading > 0);

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
                  {cortesBsArray.map((val, idx) => (
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
                      label="UE Bs."
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
                  {cortesUSDArray.map((val, idx) => (
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
                      label="UE $"
                      value={island.usdAdicionales || 0}
                      onChange={(v) => updateIslandField(iid, 'usdAdicionales', v)}
                      currency="USD"
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 1, textAlign: 'right' }}>
                  <Chip
                    label={`Total: ${formatUSD(totalCortesUSD)}`}
                    color="success"
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>

            {/* PV Tasa 1 — SIEMPRE visible */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'secondary.main' }}>
                  Punto de Venta (Tasa 1: {formatBs(tasa1)})
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
                <Box sx={{ textAlign: 'right' }}>
                  <Chip
                    label={`Total PV Tasa 1: ${formatBs(island.pvTotalBs || 0)} = ${formatUSD(island.pvTotalUSD || 0)}`}
                    color="secondary"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* PV Tasa 2 — SIEMPRE visible */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'info.main' }}>
                  Punto de Venta (Tasa 2: {formatBs(tasa2 || 0)})
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
                <Divider sx={{ my: 2 }} />
                <Box sx={{ textAlign: 'right' }}>
                  <Chip
                    label={`Total PV Tasa 2: ${formatBs(island.pv2TotalBs || 0)} = ${formatUSD(island.pv2TotalUSD || 0)}`}
                    color="info"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              </CardContent>
            </Card>

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

            {/* ===== PROPINA DEL OPERADOR ===== */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#FFD100' }}>
                  Propina del Operador
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, bgcolor: hasReadings ? '#E3F2FD' : '#EEEEEE', borderRadius: 2, textAlign: 'center', minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                        Litros Vendidos
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: hasReadings ? '#1565C0' : '#9E9E9E' }}>
                        {hasReadings ? `${formatNumber(biblia.litersRef || 0, 2)} L` : '—'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, bgcolor: hasReadings ? '#E8F5E9' : '#EEEEEE', borderRadius: 2, textAlign: 'center', minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                        Ingresos Totales
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: hasReadings ? '#2E7D32' : '#9E9E9E' }}>
                        {hasReadings ? formatUSD(biblia.ingresosTotalUSD || 0) : '—'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, bgcolor: hasReadings ? (propinaUSD > 0 ? '#E8F5E9' : '#FFEBEE') : '#EEEEEE', borderRadius: 2, textAlign: 'center', minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                        Propina USD
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: hasReadings ? (propinaUSD > 0 ? '#2E7D32' : '#D32F2F') : '#9E9E9E' }}>
                        {hasReadings ? formatUSD(propinaUSD) : '—'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, bgcolor: hasReadings ? (propinaBs > 0 ? '#E8F5E9' : '#FFEBEE') : '#EEEEEE', borderRadius: 2, textAlign: 'center', minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                        Propina Bs
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: hasReadings ? (propinaBs > 0 ? '#2E7D32' : '#D32F2F') : '#9E9E9E' }}>
                        {hasReadings ? formatBs(propinaBs) : '—'}
                      </Typography>
                    </Paper>
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
                    sx={{ minWidth: 200 }}
                  >
                    {activeProducts.map((p) => (
                      <MenuItem key={p.id} value={p.name}>
                        {p.name} (${p.priceUSD.toFixed(2)})
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Cantidad"
                    type="number"
                    value={productQty}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setProductQty(isNaN(v) || v < 1 ? 1 : v);
                    }}
                    inputProps={{ min: 1 }}
                    sx={{ width: 90 }}
                  />
                  <TextField
                    select
                    size="small"
                    label="Forma de Pago"
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    sx={{ minWidth: 190 }}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <MenuItem key={m.value} value={m.value}>
                        {m.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddProduct(iid)}
                    disabled={!selectedProduct}
                  >
                    Agregar
                  </Button>
                </Box>

                {/* Preview del monto en Bs para Punto de Venta o Efectivo Bolivares */}
                {selectedProduct && (selectedPaymentMethod === 'punto_de_venta' || selectedPaymentMethod === 'efectivo_bs') && (() => {
                  const prod = activeProducts.find((p) => p.name === selectedProduct);
                  const priceUSD = prod?.priceUSD || 0;
                  const totalUSD = priceUSD * productQty;
                  const totalBs = tasa1 > 0 ? totalUSD * tasa1 : 0;
                  const label = selectedPaymentMethod === 'punto_de_venta' ? 'Punto de Venta' : 'Efectivo Bolivares';
                  return (
                    <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#FFF3E0', borderRadius: 1.5, border: '1px solid #FFB74D' }}>
                      <Typography variant="body2" sx={{ color: '#E65100', fontWeight: 600 }}>
                        {label}: {formatUSD(totalUSD)} = {formatBs(totalBs)} (Tasa 1: {formatBs(tasa1)})
                      </Typography>
                    </Paper>
                  );
                })()}

                {(island.productsSold || []).length > 0 && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>Cant.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Precio Unit.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>Forma de Pago</TableCell>
                          <TableCell align="center"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(island.productsSold || []).map((ps, idx) => {
                          const prod = activeProducts.find((p) => p.name === ps.productName);
                          const price = prod?.priceUSD || 0;
                          const totalUSD = price * ps.quantity;
                          const method = ps.paymentMethod || 'punto_de_venta';
                          const showBs = method === 'punto_de_venta' || method === 'efectivo_bs';
                          const totalBs = showBs && tasa1 > 0 ? totalUSD * tasa1 : 0;

                          return (
                            <TableRow key={idx}>
                              <TableCell>{ps.productName}</TableCell>
                              <TableCell align="center">{ps.quantity}</TableCell>
                              <TableCell align="right">{formatUSD(price)}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {formatUSD(totalUSD)}
                                {showBs && (
                                  <Typography variant="caption" sx={{ display: 'block', color: '#E65100', fontWeight: 600 }}>
                                    = {formatBs(totalBs)}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={getPaymentLabel(method)}
                                  size="small"
                                  variant="outlined"
                                  color={
                                    method === 'punto_de_venta' ? 'secondary' :
                                    method === 'efectivo_bs' ? 'primary' :
                                    'success'
                                  }
                                  sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                                />
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