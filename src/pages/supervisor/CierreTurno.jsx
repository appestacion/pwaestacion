// src/pages/supervisor/CierreTurno.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { useInventoryStore } from '../../store/useInventoryStore.js';
import { enqueueSnackbar } from 'notistack';
import { calculateBiblia } from '../../lib/calculations.js';
import { formatBs, formatUSD, formatNumber, roundDownTo10 } from '../../lib/formatters.js';
import { bsToUsd, usdToBs } from '../../lib/conversions.js';
import { CATEGORY_ORDER, ISLAND_LABELS } from '../../config/constants.js';

const PAYMENT_METHODS = [
  { value: 'punto_de_venta', label: 'Punto de Venta' },
  { value: 'efectivo_bs', label: 'Efectivo Bolivares' },
  { value: 'efectivo_usd', label: 'Efectivo Dolares' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'combinado', label: 'Pago Combinado' },
];

// Sub-opciones para el pago combinado (sin incluir "combinado" para evitar recursión)
const COMBINED_PAYMENT_OPTIONS = [
  { value: 'punto_de_venta', label: 'Punto de Venta' },
  { value: 'efectivo_bs', label: 'Efectivo Bolivares' },
  { value: 'efectivo_usd', label: 'Efectivo Dolares' },
  { value: 'transferencia', label: 'Transferencia' },
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
  const config = useConfigStore((s) => s.config) || {};
  // ★ Acceso al inventario por isla para validar stock antes de agregar venta.
  const islandStock = useInventoryStore((s) => s.islandStock);
  const getIslandStockItem = useInventoryStore((s) => s.getIslandStockItem);
  const maxCortes = config.maxCortes || 12;
  const precioLitroUSD = config.precioLitroUSD || 0.50;
  const porcentajeRecaudacion = config.porcentajeRecaudacion != null ? config.porcentajeRecaudacion / 100 : 0.10;
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productQty, setProductQty] = useState(1);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('punto_de_venta');
  // ★ Titular de la transferencia — solo aplica cuando la forma de pago es 'transferencia'.
  // Se persiste en el producto vendido como `transferenciaTitular` para mostrarlo en la
  // tabla de productos, en el reporte y en el PDF.
  const [transferenciaTitular, setTransferenciaTitular] = useState('');

  // Estado para pago combinado: lista de { method, amountUSD }
  const [combinedPayments, setCombinedPayments] = useState([
    { method: 'punto_de_venta', amountUSD: 0 },
  ]);

  // Ref para debounce del recálculo PV — evita múltiples recalculaciones
  // cuando el usuario teclea rápido en un campo de montos.
  const recalcTimerRef = useRef(null);

  // Actualiza un campo PV y recalcula los totales de forma segura.
  // Se ejecuta de forma síncrona (sin setTimeout) para evitar race conditions
  // con el listener onSnapshot de Firestore. Un debounce ligero (50ms)
  // evita calcular N veces por N keystrokes rápidos.
  const handlePVFieldChange = useCallback((islandId, field, value) => {
    updateIslandField(islandId, field, value);

    // Limpiar el timer anterior y programar uno nuevo
    if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    recalcTimerRef.current = setTimeout(() => {
      recalcIslandPV(islandId);
      recalcTimerRef.current = null;
    }, 50);
  }, [updateIslandField, recalcIslandPV]);

  // Limpiar el timer al desmontar
  useEffect(() => {
    return () => {
      if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    };
  }, []);

  useEffect(() => {
    loadCurrentShift();
    loadProducts();
  }, [loadCurrentShift, loadProducts]);

  // Calcular biblia para obtener las propinas por isla
  const bibliaData = useMemo(() => {
    if (!currentShift) return {};
    const biblia = calculateBiblia(currentShift, precioLitroUSD);
    const map = {};
    biblia.forEach((b) => {
      map[b.islandId] = b;
    });
    return map;
  }, [currentShift, precioLitroUSD]);

  // Calcular el total USD del producto seleccionado
  // ★ Guardamos contra productQty === 0 (campo vacío) para evitar NaN en previews.
  const selectedProductTotalUSD = useMemo(() => {
    if (!selectedProduct) return 0;
    const prod = products.find((p) => p.name === selectedProduct);
    return (prod?.priceUSD || 0) * (productQty || 0);
  }, [selectedProduct, productQty, products]);

  // Calcular cuánto falta por asignar en el pago combinado
  const combinedRemainingUSD = useMemo(() => {
    if (selectedPaymentMethod !== 'combinado') return 0;
    const assigned = combinedPayments.reduce((s, p) => s + (p.amountUSD || 0), 0);
    return selectedProductTotalUSD - assigned;
  }, [selectedPaymentMethod, combinedPayments, selectedProductTotalUSD]);

  // Calcular monto total de pagos combinados (para validación)
  const combinedAssignedUSD = useMemo(() => {
    return combinedPayments.reduce((s, p) => s + (p.amountUSD || 0), 0);
  }, [combinedPayments]);

  // Resetear pagos combinados cuando cambia el método de pago
  useEffect(() => {
    if (selectedPaymentMethod === 'combinado') {
      setCombinedPayments([{ method: 'punto_de_venta', amountUSD: 0 }]);
    }
  }, [selectedPaymentMethod]);

  // ── Handlers para pago combinado ──
  const handleAddCombinedEntry = () => {
    // Filtrar métodos ya usados para sugerir el siguiente disponible
    const usedMethods = combinedPayments.map((p) => p.method);
    const available = COMBINED_PAYMENT_OPTIONS.find((o) => !usedMethods.includes(o.value));
    setCombinedPayments([
      ...combinedPayments,
      { method: available ? available.value : 'efectivo_usd', amountUSD: 0 },
    ]);
  };

  const handleRemoveCombinedEntry = (idx) => {
    if (combinedPayments.length <= 1) return;
    setCombinedPayments(combinedPayments.filter((_, i) => i !== idx));
  };

  const handleUpdateCombinedEntry = (idx, field, value) => {
    const updated = [...combinedPayments];
    updated[idx] = { ...updated[idx], [field]: value };

    // ★ VALIDACIÓN: No permitir que el monto total combinado exceda el precio del producto
    if (field === 'amountUSD' && selectedPaymentMethod === 'combinado') {
      const otherEntriesTotal = updated.reduce((s, p, i) => i === idx ? s : s + (p.amountUSD || 0), 0);
      const maxAllowed = Math.max(0, selectedProductTotalUSD - otherEntriesTotal);
      if (value > maxAllowed) {
        updated[idx].amountUSD = parseFloat(maxAllowed.toFixed(2));
      }
    }

    setCombinedPayments(updated);
  };

  const handleAddProduct = (islandId) => {
    if (!selectedProduct) return;

    // ★ VALIDACIÓN DE CANTIDAD: No permitir agregar si el campo está vacío o es < 1.
    // Esto permite que el usuario borre el "1" por defecto para escribir otra cantidad
    // sin que el input se regenere automáticamente a 1 (UX incómoda).
    if (!productQty || productQty < 1) {
      enqueueSnackbar({
        message: 'Ingrese una cantidad válida (mínimo 1) para el producto.',
        variant: 'warning',
        autoHideDuration: 3000,
      });
      return;
    }

    // ★ VALIDACIÓN DE STOCK: Antes de agregar, verificar que haya suficiente
    // stock en la isla para el producto. Se descuenta lo que ya se agregó en
    // este turno (porque el stock real solo se descuenta al cerrar el turno).
    const existingIsland = currentShift?.islands.find((i) => i.islandId === islandId);
    const yaAgregadoTurno = (existingIsland?.productsSold ?? [])
      .filter((p) => p.productName === selectedProduct)
      .reduce((s, p) => s + (parseInt(p.quantity, 10) || 0), 0);
    const stockIsland = parseInt(getIslandStockItem(selectedProduct, islandId), 10) || 0;
    const disponible = stockIsland - yaAgregadoTurno;

    if (disponible <= 0) {
      enqueueSnackbar({
        message: `No hay stock de "${selectedProduct}" en ${ISLAND_LABELS[islandId] || 'Isla ' + islandId}. Stock actual: ${stockIsland}.`,
        variant: 'error',
        autoHideDuration: 5000,
      });
      return;
    }
    if (productQty > disponible) {
      enqueueSnackbar({
        message: `Stock insuficiente de "${selectedProduct}". Disponible: ${disponible} (stock: ${stockIsland}, ya agregado en este turno: ${yaAgregadoTurno}).`,
        variant: 'error',
        autoHideDuration: 6000,
      });
      return;
    }

    if (selectedPaymentMethod === 'combinado') {
      // Validar que el monto total de pagos combinados coincida con el precio del producto
      if (Math.abs(combinedAssignedUSD - selectedProductTotalUSD) > 0.01) {
        return; // No agregar si no coincide
      }
      // Filtrar entradas con monto > 0
      const breakdown = combinedPayments
        .filter((p) => p.amountUSD > 0)
        .map((p) => ({ method: p.method, amountUSD: p.amountUSD }));

      if (breakdown.length === 0) return;

      addProductSold(islandId, {
        productName: selectedProduct,
        quantity: productQty,
        paymentMethod: 'combinado',
        paymentBreakdown: breakdown,
      });
    } else {
      // ★ Validar titular para transferencia — evitar productos sin titular asignado.
      if (selectedPaymentMethod === 'transferencia' && !transferenciaTitular.trim()) {
        enqueueSnackbar({
          message: 'Ingrese el nombre del titular de la transferencia.',
          variant: 'warning',
          autoHideDuration: 3000,
        });
        return;
      }

      const already = existingIsland?.productsSold.find(
        (p) => p.productName === selectedProduct && p.paymentMethod === selectedPaymentMethod
      );
      if (already) {
        const newProducts = (existingIsland?.productsSold ?? []).map((p) =>
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
          // ★ Guardar titular solo cuando es transferencia (no contaminar otros métodos).
          ...(selectedPaymentMethod === 'transferencia'
            ? { transferenciaTitular: transferenciaTitular.trim() }
            : {}),
        });
      }
    }
    setSelectedProduct('');
    setProductQty(1);
    setSelectedPaymentMethod('punto_de_venta');
    setTransferenciaTitular('');
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

  const getCombinedPaymentLabel = (method) => {
    const found = COMBINED_PAYMENT_OPTIONS.find((m) => m.value === method);
    return found ? found.label : method;
  };

  const getPaymentChipColor = (method) => {
    switch (method) {
      case 'punto_de_venta': return 'secondary';
      case 'efectivo_bs': return 'primary';
      case 'efectivo_usd': return 'success';
      case 'transferencia': return 'info';
      case 'combinado': return 'warning';
      default: return 'default';
    }
  };

  if (!currentShift) {
    return <Alert severity="warning">No hay un turno activo. Ve al Dashboard e inicia un turno.</Alert>;
  }

  const activeProducts = products
    .filter((p) => p.active)
    .sort((a, b) => {
      const idxA = CATEGORY_ORDER.indexOf(a.category);
      const idxB = CATEGORY_ORDER.indexOf(b.category);
      if (idxA !== idxB) return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      return a.name.localeCompare(b.name);
    });
  const tasa1 = currentShift.tasa1 || 1;
  const tasa2 = currentShift.tasa2 || 0;

  // 2TS (PM) = operador DIURNO → una sola tasa, una sola tarjeta PV
  // 1TS (AM) = operador NOCTURNO → dos tasas, dos tarjetas PV
  const is2TS = currentShift.operatorShiftType !== 'NOCTURNO';

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
        const totalCortesBsInUSD = bsToUsd(totalCortesBs, tasa1);
        const totalCortesUSD = cortesUSDArray.reduce((s, v) => s + v, 0) + (island.usdAdicionales || 0);
        const totalVales = (island.vales || []).reduce((s, v) => s + (v.monto || 0), 0);
        const totalTransferencias = (island.transferencias || []).reduce((s, t) => s + (t.monto || 0), 0);
        const propinaUSD = biblia.propinaUSD || 0;
        const propinaBs = biblia.propinaBs || 0;

        // ★ CAMBIO 1: Total combinado de ambos PV en USD (solo para 1TS/NOCTURNO con Tasa 2)
        const combinedPVTotalUSD = (island.pvTotalUSD || 0) + (island.pv2TotalUSD || 0);

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

            {/* ═══ PUNTO DE VENTA ═══ */}
            {/* 2TS (PM) → una sola tarjeta PV con tasa1 */}
            {is2TS ? (
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
                        onChange={(v) => handlePVFieldChange(iid, 'pvMonto1', v)}
                        currency="BS"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CurrencyInput
                        label="Monto 2 (Bs.)"
                        value={island.pvMonto2 || 0}
                        onChange={(v) => handlePVFieldChange(iid, 'pvMonto2', v)}
                        currency="BS"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <CurrencyInput
                        label="Monto 3 (Bs.)"
                        value={island.pvMonto3 || 0}
                        onChange={(v) => handlePVFieldChange(iid, 'pvMonto3', v)}
                        currency="BS"
                      />
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip
                      label={`Total PV: ${formatBs(island.pvTotalBs || 0)} = ${formatUSD(island.pvTotalUSD || 0)}`}
                      color="secondary"
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                </CardContent>
              </Card>
            ) : (
              /* 1TS (AM) → dos tarjetas PV (Tasa 1 y Tasa 2) */
              <>
                {/* PV Tasa 1 */}
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
                          onChange={(v) => handlePVFieldChange(iid, 'pvMonto1', v)}
                          currency="BS"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <CurrencyInput
                          label="Monto 2 (Bs.)"
                          value={island.pvMonto2 || 0}
                          onChange={(v) => handlePVFieldChange(iid, 'pvMonto2', v)}
                          currency="BS"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <CurrencyInput
                          label="Monto 3 (Bs.)"
                          value={island.pvMonto3 || 0}
                          onChange={(v) => handlePVFieldChange(iid, 'pvMonto3', v)}
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

                {/* PV Tasa 2 */}
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
                          onChange={(v) => handlePVFieldChange(iid, 'pv2Monto1', v)}
                          currency="BS"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <CurrencyInput
                          label="PV2 Monto 2 (Bs.)"
                          value={island.pv2Monto2 || 0}
                          onChange={(v) => handlePVFieldChange(iid, 'pv2Monto2', v)}
                          currency="BS"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <CurrencyInput
                          label="PV2 Monto 3 (Bs.)"
                          value={island.pv2Monto3 || 0}
                          onChange={(v) => handlePVFieldChange(iid, 'pv2Monto3', v)}
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
                      {/* ★ CAMBIO 1: Chip con total en dólares de ambos PV (solo cuando hay Tasa 1 y Tasa 2) */}
                      {tasa2 > 0 && (
                        <Chip
                          label={`Total PV Ambas Tasas: ${formatUSD(combinedPVTotalUSD)}`}
                          color="warning"
                          size="small"
                          sx={{ fontWeight: 700, ml: 1 }}
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </>
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
                    {/* ★ FIX: Mostrar total en USD y equivalente en Bs (usando tasa1) */}
                    <Chip
                      label={`Total: ${formatUSD(totalTransferencias)} = ${formatBs(totalTransferencias * tasa1)}`}
                      color="success"
                      size="small"
                    />
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

            {/* ===== EXCEDENTE DEL OPERADOR ===== */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#FFD100' }}>
                  Excedente del Operador
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, bgcolor: hasReadings ? '#E3F2FD' : '#EEEEEE', borderRadius: 2, textAlign: 'center', minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                        $ por Litros Vendidos
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: hasReadings ? '#1565C0' : '#9E9E9E' }}>
                        {hasReadings ? formatUSD(biblia.litersRef || 0) : '—'}
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
                        Excedente USD
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: hasReadings ? (propinaUSD > 0 ? '#2E7D32' : '#D32F2F') : '#9E9E9E' }}>
                        {hasReadings ? formatUSD(propinaUSD) : '—'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, bgcolor: hasReadings ? (propinaBs > 0 ? '#E8F5E9' : '#FFEBEE') : '#EEEEEE', borderRadius: 2, textAlign: 'center', minHeight: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                        Excedente Bs
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: hasReadings ? (propinaBs > 0 ? '#2E7D32' : '#D32F2F') : '#9E9E9E' }}>
                        {hasReadings ? formatBs(propinaBs) : '—'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
                {/* ★ Recaudación — porcentaje configurable desde admin */}
                <Box sx={{ mt: 1, textAlign: 'right' }}>
                  <Chip
                    label={`Recaudación ${config.porcentajeRecaudacion != null ? config.porcentajeRecaudacion : 10}%: ${hasReadings && propinaBs > 0 ? formatBs(roundDownTo10(propinaBs * porcentajeRecaudacion)) : '—'}`}
                    color="warning"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
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
                    {activeProducts.map((p) => {
                      // ★ Mostrar stock disponible en el menú por isla.
                      const stockVal = parseInt(getIslandStockItem(p.name, iid), 10) || 0;
                      return (
                        <MenuItem key={p.id} value={p.name} disabled={stockVal <= 0}>
                          {p.name} (${p.priceUSD.toFixed(2)}) — Stock: {stockVal}
                          {stockVal <= 0 ? ' (agotado)' : ''}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                  <TextField
                    size="small"
                    label="Cantidad"
                    type="number"
                    value={productQty === 0 ? '' : productQty}
                    onChange={(e) => {
                      // ★ FIX UX: Permitir campo vacío mientras el usuario escribe.
                      // Antes, el handler forzaba setProductQty(1) cuando el input
                      // quedaba vacío (parseInt('') => NaN), impidiendo borrar el "1"
                      // por defecto para escribir otra cantidad. Ahora usamos 0 como
                      // sentinel de "vacío" y validamos en handleAddProduct.
                      const raw = e.target.value;
                      if (raw === '') {
                        setProductQty(0);
                        return;
                      }
                      const v = parseInt(raw, 10);
                      if (isNaN(v) || v < 0) {
                        setProductQty(0);
                        return;
                      }
                      setProductQty(v);
                    }}
                    inputProps={{ min: 0 }}
                    error={productQty === 0}
                    helperText={productQty === 0 ? 'Requerido' : ''}
                    sx={{ width: 90 }}
                  />
                  <TextField
                    select
                    size="small"
                    label="Forma de Pago"
                    value={selectedPaymentMethod}
                    onChange={(e) => {
                      setSelectedPaymentMethod(e.target.value);
                      // ★ Resetear titular cuando se cambia de método (limpieza de estado).
                      if (e.target.value !== 'transferencia') {
                        setTransferenciaTitular('');
                      }
                    }}
                    sx={{ minWidth: 190 }}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <MenuItem key={m.value} value={m.value}>
                        {m.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  {/* ★ Campo Titular de Transferencia — solo visible cuando la forma de pago es 'transferencia'. */}
                  {selectedPaymentMethod === 'transferencia' && (
                    <TextField
                      size="small"
                      label="Titular de la Transferencia"
                      value={transferenciaTitular}
                      onChange={(e) => setTransferenciaTitular(e.target.value)}
                      placeholder="Nombre de quien transfiere"
                      error={selectedPaymentMethod === 'transferencia' && !transferenciaTitular.trim()}
                      helperText={selectedPaymentMethod === 'transferencia' && !transferenciaTitular.trim() ? 'Requerido' : ''}
                      sx={{ minWidth: 240 }}
                    />
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddProduct(iid)}
                    disabled={!selectedProduct || !productQty || productQty < 1 || (
                      selectedPaymentMethod === 'transferencia' && !transferenciaTitular.trim()
                    ) || (
                      selectedPaymentMethod === 'combinado'
                        ? Math.abs(combinedAssignedUSD - selectedProductTotalUSD) > 0.01 || combinedAssignedUSD === 0
                        : false
                    )}
                  >
                    Agregar
                  </Button>
                </Box>

                {/* ★ Indicador de stock disponible para el producto seleccionado en esta isla */}
                {selectedProduct && (() => {
                  const stockVal = parseInt(getIslandStockItem(selectedProduct, iid), 10) || 0;
                  const yaAgregado = (currentShift?.islands.find((i) => i.islandId === iid)?.productsSold ?? [])
                    .filter((p) => p.productName === selectedProduct)
                    .reduce((s, p) => s + (parseInt(p.quantity, 10) || 0), 0);
                  const disp = stockVal - yaAgregado;
                  const sinStock = disp <= 0;
                  const pocoStock = disp > 0 && disp <= 3;
                  return (
                    <Paper
                      sx={{
                        p: 1.5,
                        mb: 2,
                        borderRadius: 1.5,
                        bgcolor: sinStock ? '#FFEBEE' : pocoStock ? '#FFF8E1' : '#E8F5E9',
                        border: '1px solid',
                        borderColor: sinStock ? '#EF5350' : pocoStock ? '#FFB74D' : '#81C784',
                      }}
                    >
                      <Typography variant="body2" sx={{
                        fontWeight: 700,
                        color: sinStock ? '#B71C1C' : pocoStock ? '#E65100' : '#2E7D32',
                      }}>
                        {sinStock
                          ? `Sin stock disponible de "${selectedProduct}" en ${ISLAND_LABELS[iid] || 'Isla ' + iid}.`
                          : `Stock disponible de "${selectedProduct}": ${disp} unidad${disp === 1 ? '' : 'es'} (stock: ${stockVal}, ya agregado: ${yaAgregado}).`}
                      </Typography>
                    </Paper>
                  );
                })()}

                {/* Preview del monto en Bs para Punto de Venta, Efectivo Bolivares o Transferencia */}
                {selectedProduct && selectedPaymentMethod !== 'combinado' && (selectedPaymentMethod === 'punto_de_venta' || selectedPaymentMethod === 'efectivo_bs' || selectedPaymentMethod === 'transferencia') && (() => {
                  const prod = activeProducts.find((p) => p.name === selectedProduct);
                  const priceUSD = prod?.priceUSD || 0;
                  const totalUSD = priceUSD * productQty;
                  const totalBs = usdToBs(totalUSD, tasa1);
                  const labelMap = {
                    punto_de_venta: 'Punto de Venta',
                    efectivo_bs: 'Efectivo Bolivares',
                    transferencia: 'Transferencia',
                  };
                  const label = labelMap[selectedPaymentMethod];
                  return (
                    <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#FFF3E0', borderRadius: 1.5, border: '1px solid #FFB74D' }}>
                      <Typography variant="body2" sx={{ color: '#E65100', fontWeight: 600 }}>
                        {label}: {formatUSD(totalUSD)} = {formatBs(totalBs)} (Tasa: {formatBs(tasa1)})
                      </Typography>
                    </Paper>
                  );
                })()}

                {/* Preview del monto en USD para Efectivo Dolares */}
                {selectedProduct && selectedPaymentMethod === 'efectivo_usd' && (() => {
                  const prod = activeProducts.find((p) => p.name === selectedProduct);
                  const priceUSD = prod?.priceUSD || 0;
                  const totalUSD = priceUSD * productQty;
                  return (
                    <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#E8F5E9', borderRadius: 1.5, border: '1px solid #81C784' }}>
                      <Typography variant="body2" sx={{ color: '#2E7D32', fontWeight: 600 }}>
                        Efectivo Dolares: {formatUSD(totalUSD)}
                      </Typography>
                    </Paper>
                  );
                })()}

                {/* ★ CAMBIO 2: Panel de Pago Combinado */}
                {selectedPaymentMethod === 'combinado' && selectedProduct && (
                  <Paper
                    sx={{
                      p: 2, mb: 2,
                      bgcolor: combinedAssignedUSD > 0 && Math.abs(combinedRemainingUSD) < 0.01
                        ? '#E8F5E9' : '#FFF8E1',
                      borderRadius: 1.5,
                      border: combinedAssignedUSD > 0 && Math.abs(combinedRemainingUSD) < 0.01
                        ? '2px solid #81C784'
                        : '2px solid #FFB74D',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#E65100' }}>
                        Pago Combinado — Total: {formatUSD(selectedProductTotalUSD)}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={handleAddCombinedEntry}
                        disabled={combinedPayments.length >= COMBINED_PAYMENT_OPTIONS.length}
                        sx={{ minWidth: 0, px: 1.5 }}
                      >
                        <AddIcon fontSize="small" />
                      </Button>
                    </Box>

                    {combinedPayments.map((entry, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          gap: 1,
                          alignItems: 'center',
                          mb: 1,
                        }}
                      >
                        <TextField
                          select
                          size="small"
                          value={entry.method}
                          onChange={(e) => handleUpdateCombinedEntry(idx, 'method', e.target.value)}
                          sx={{ minWidth: 170, flex: '0 0 auto' }}
                        >
                          {COMBINED_PAYMENT_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          size="small"
                          label="Monto ($)"
                          type="number"
                          value={entry.amountUSD || ''}
                          onChange={(e) => {
                            let v = parseFloat(e.target.value);
                            if (isNaN(v) || v < 0) v = 0;
                            // ★ Clamp: no exceder el monto restante disponible
                            const otherTotal = combinedPayments.reduce((s, p, i) => i === idx ? s : s + (p.amountUSD || 0), 0);
                            const maxAllowed = Math.max(0, selectedProductTotalUSD - otherTotal);
                            if (v > maxAllowed) v = parseFloat(maxAllowed.toFixed(2));
                            handleUpdateCombinedEntry(idx, 'amountUSD', v);
                          }}
                          error={combinedAssignedUSD > selectedProductTotalUSD + 0.01}
                          helperText={combinedAssignedUSD > selectedProductTotalUSD + 0.01 ? 'Excede el total' : ''}
                          inputProps={{ min: 0, step: 0.01, max: selectedProductTotalUSD }}
                          sx={{ flex: 1, minWidth: 120 }}
                        />
                        {(entry.method === 'punto_de_venta' || entry.method === 'efectivo_bs' || entry.method === 'transferencia') && entry.amountUSD > 0 && (
                          <Typography variant="caption" sx={{ color: '#E65100', fontWeight: 600, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
                            = {formatBs(usdToBs(entry.amountUSD, tasa1))}
                          </Typography>
                        )}
                        {combinedPayments.length > 1 && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveCombinedEntry(idx)}
                            sx={{ flex: '0 0 auto' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    ))}

                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Asignado: {formatUSD(combinedAssignedUSD)} / {formatUSD(selectedProductTotalUSD)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: Math.abs(combinedRemainingUSD) < 0.01
                            ? '#2E7D32'
                            : combinedAssignedUSD > selectedProductTotalUSD + 0.01
                              ? '#D32F2F'
                              : '#E65100',
                        }}
                      >
                        {Math.abs(combinedRemainingUSD) < 0.01
                          ? 'Completo'
                          : combinedAssignedUSD > selectedProductTotalUSD + 0.01
                            ? `Excede: ${formatUSD(combinedAssignedUSD - selectedProductTotalUSD)}`
                            : `Faltan: ${formatUSD(Math.abs(combinedRemainingUSD))}`}
                      </Typography>
                    </Box>
                  </Paper>
                )}

                {(island.productsSold || []).length > 0 && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>Cant.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Precio Unit.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                          <TableCell align="left" sx={{ fontWeight: 700 }}>Forma de Pago</TableCell>
                          <TableCell align="center"></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(island.productsSold || []).map((ps, idx) => {
                          const prod = activeProducts.find((p) => p.name === ps.productName);
                          const price = prod?.priceUSD || 0;
                          const totalUSD = price * ps.quantity;
                          const method = ps.paymentMethod || 'punto_de_venta';
                          const isCombined = method === 'combinado';
                          const showBs = !isCombined && (method === 'punto_de_venta' || method === 'efectivo_bs' || method === 'transferencia');
                          const totalBs = showBs ? usdToBs(totalUSD, tasa1) : 0;

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
                              {/* ★ CAMBIO 3: Chips de forma de pago alineados a la izquierda */}
                              <TableCell align="left">
                                {isCombined && ps.paymentBreakdown && ps.paymentBreakdown.length > 0 ? (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                                    {ps.paymentBreakdown.map((bd, bdIdx) => (
                                      <Box key={bdIdx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Chip
                                          label={getCombinedPaymentLabel(bd.method)}
                                          size="small"
                                          variant="outlined"
                                          color={getPaymentChipColor(bd.method)}
                                          sx={{ fontSize: '0.65rem', fontWeight: 600, height: 22 }}
                                        />
                                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                          {formatUSD(bd.amountUSD)}
                                          {(bd.method === 'punto_de_venta' || bd.method === 'efectivo_bs' || bd.method === 'transferencia') && bd.amountUSD > 0 && (
                                            <Typography component="span" variant="caption" sx={{ color: '#E65100', ml: 0.5 }}>
                                              ({formatBs(usdToBs(bd.amountUSD, tasa1))})
                                            </Typography>
                                          )}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Box>
                                ) : (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                                    <Chip
                                      label={getPaymentLabel(method)}
                                      size="small"
                                      variant="outlined"
                                      color={getPaymentChipColor(method)}
                                      sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                                    />
                                    {/* ★ Mostrar titular de la transferencia debajo del chip */}
                                    {method === 'transferencia' && ps.transferenciaTitular && (
                                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#0277BD', fontStyle: 'italic', fontWeight: 600 }}>
                                        Titular: {ps.transferenciaTitular}
                                      </Typography>
                                    )}
                                  </Box>
                                )}
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