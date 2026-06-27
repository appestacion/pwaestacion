// src/pages/supervisor/CalculoPropinaAlmuerzo.jsx
//
// Sección AISLADA de la app — no interactúa con Firestore ni stores del turno.
// Sirve únicamente para calcular el excedente del operador que cubre
// la hora de almuerzo en una isla.
//
// Lógica (igual que Cierre de Turno):
//   Litros Vendidos = Lectura Final - Lectura Inicial
//   Total PV = PV Salida USD − PV Entrada USD
//   Ingresos Totales = Total PV + $ + Bs→USD
//   $ x Litros = Litros Vendidos × precioLitroUSD
//   Excedente USD = Ingresos Totales − $ x Litros  (si > 0)
//   Excedente Bs  = Excedente USD × tasa1  (redondeado a 10)
import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CurrencyInput from '../../components/common/CurrencyInput.jsx';
import { useConfigStore } from '../../store/useConfigStore.js';
import { formatBs, formatUSD, formatNumber, roundDown2, roundDownTo10 } from '../../lib/formatters.js';
import { bsToUsd } from '../../lib/conversions.js';

export default function CalculoPropinaAlmuerzo() {
  const config = useConfigStore((s) => s.config) || {};
  const tasa1 = config.tasa1 || 1;
  const precioLitroUSD = config.precioLitroUSD || 0.50;

  // ── Estado local aislado ──
  const [islandNumber, setIslandNumber] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [lecturaInicial, setLecturaInicial] = useState(0);
  const [lecturaFinal, setLecturaFinal] = useState(0);

  // PV Entrada (3 montos en Bs.)
  const [pvEntrada1, setPvEntrada1] = useState(0);
  const [pvEntrada2, setPvEntrada2] = useState(0);
  const [pvEntrada3, setPvEntrada3] = useState(0);

  // PV Salida (3 montos en Bs.)
  const [pvSalida1, setPvSalida1] = useState(0);
  const [pvSalida2, setPvSalida2] = useState(0);
  const [pvSalida3, setPvSalida3] = useState(0);

  // Efectivo
  const [efectivoUSD, setEfectivoUSD] = useState(0);
  const [efectivoBs, setEfectivoBs] = useState(0);

  // ── Cálculos ──
  const litrosVendidos = useMemo(() => {
    const diff = lecturaFinal - lecturaInicial;
    return diff > 0 ? diff : 0;
  }, [lecturaInicial, lecturaFinal]);

  const pvEntradaTotalBs = useMemo(() => pvEntrada1 + pvEntrada2 + pvEntrada3, [pvEntrada1, pvEntrada2, pvEntrada3]);
  const pvEntradaTotalUSD = useMemo(() => bsToUsd(pvEntradaTotalBs, tasa1), [pvEntradaTotalBs, tasa1]);

  const pvSalidaTotalBs = useMemo(() => pvSalida1 + pvSalida2 + pvSalida3, [pvSalida1, pvSalida2, pvSalida3]);
  const pvSalidaTotalUSD = useMemo(() => bsToUsd(pvSalidaTotalBs, tasa1), [pvSalidaTotalBs, tasa1]);

  const totalPVBs = useMemo(() => pvSalidaTotalBs - pvEntradaTotalBs, [pvSalidaTotalBs, pvEntradaTotalBs]);
  const totalPVUSD = useMemo(() => pvSalidaTotalUSD - pvEntradaTotalUSD, [pvSalidaTotalUSD, pvEntradaTotalUSD]);

  const efectivoBsInUSD = useMemo(() => bsToUsd(efectivoBs, tasa1), [efectivoBs, tasa1]);

  const ingresosTotalUSD = useMemo(
    () => totalPVUSD + efectivoUSD + efectivoBsInUSD,
    [totalPVUSD, efectivoUSD, efectivoBsInUSD],
  );

  const litersRef = useMemo(() => litrosVendidos * precioLitroUSD, [litrosVendidos, precioLitroUSD]);

  const propinaCalculo = useMemo(() => ingresosTotalUSD - litersRef, [ingresosTotalUSD, litersRef]);
  const propinaUSD = useMemo(() => (propinaCalculo > 0 ? roundDown2(propinaCalculo) : 0), [propinaCalculo]);
  const propinaBs = useMemo(
    () => (propinaCalculo > 0 ? roundDownTo10(propinaCalculo * tasa1) : 0),
    [propinaCalculo, tasa1],
  );

  const hasReadings = lecturaFinal > 0 && lecturaFinal > lecturaInicial;

  // ── Reset ──
  const handleReset = () => {
    setIslandNumber('');
    setOperatorName('');
    setLecturaInicial(0);
    setLecturaFinal(0);
    setPvEntrada1(0);
    setPvEntrada2(0);
    setPvEntrada3(0);
    setPvSalida1(0);
    setPvSalida2(0);
    setPvSalida3(0);
    setEfectivoUSD(0);
    setEfectivoBs(0);
  };

  // ── WhatsApp ──
  const handleSendWhatsApp = () => {
    const lines = [
      '🍽️ *CÁLCULO EXCEDENTE ALMUERZO*',
      `Isla: ${islandNumber || '—'}`,
      `Operador: ${operatorName || '—'}`,
      '',
      `📐 Lectura Inicial: ${lecturaInicial} Lts`,
      `📐 Lectura Final: ${lecturaFinal} Lts`,
      `⛽ Litros Vendidos: ${litrosVendidos > 0 ? litrosVendidos.toFixed(2) : '0.00'} Lts`,
      '',
      `📥 PV Entrada: ${formatBs(pvEntradaTotalBs)} = ${formatUSD(pvEntradaTotalUSD)}`,
      `📤 PV Salida: ${formatBs(pvSalidaTotalBs)} = ${formatUSD(pvSalidaTotalUSD)}`,
      `📊 Total PV (Salida - Entrada): ${formatUSD(totalPVUSD)}`,
      '',
      `💵 Efectivo $: ${formatUSD(efectivoUSD)}`,
      `💵 Efectivo Bs: ${formatBs(efectivoBs)} = ${formatUSD(efectivoBsInUSD)}`,
      '',
      `💰 Ingresos Totales: ${formatUSD(ingresosTotalUSD)}`,
      `⛽ $ por Litros: ${formatUSD(litersRef)}`,
      '',
      `✅ *Excedente USD: ${formatUSD(propinaUSD)}*`,
      `✅ *Excedente Bs: ${formatBs(propinaBs)}*`,
      '',
      `Tasa: ${formatBs(tasa1)}`,
    ];

    const text = lines.join('\n');
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // ── Handler para campos de litros ──
  const handleLecturaChange = (setter) => (e) => {
    const v = parseFloat(e.target.value);
    setter(isNaN(v) || v < 0 ? 0 : v);
  };

  const handleLecturaBlur = (setter, value) => () => {
    if (isNaN(value) || value < 0) setter(0);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Cálculo Excedente Almuerzo
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Calcula el excedente del operador que cubre la hora de almuerzo — Tasa: {formatBs(tasa1)}
          </Typography>
        </Box>
        <Chip
          label="Sección aislada — no afecta el turno"
          color="info"
          size="small"
          variant="outlined"
        />
      </Box>

      {/* Isla y Operador */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Isla N°"
                value={islandNumber}
                onChange={(e) => setIslandNumber(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="Nombre del Operador"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                size="small"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Lecturas — son LITROS, no dólares */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
            Lecturas del Surtidor (Litros)
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Lectura Inicial (Lts)"
                type="number"
                value={lecturaInicial || ''}
                onChange={handleLecturaChange(setLecturaInicial)}
                onBlur={handleLecturaBlur(setLecturaInicial, lecturaInicial)}
                size="small"
                inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
                InputProps={{ sx: { '& input': { textAlign: 'right' } } }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Lectura Final (Lts)"
                type="number"
                value={lecturaFinal || ''}
                onChange={handleLecturaChange(setLecturaFinal)}
                onBlur={handleLecturaBlur(setLecturaFinal, lecturaFinal)}
                size="small"
                inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
                InputProps={{ sx: { '& input': { textAlign: 'right' } } }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, bgcolor: '#E3F2FD', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                  Litros Vendidos
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#1565C0' }}>
                  {litrosVendidos > 0 ? formatNumber(litrosVendidos, 2) : '—'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Lts</Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ═══ PV ENTRADA ═══ */}
      <Card sx={{ mb: 2, border: '2px solid', borderColor: 'info.light' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'info.main' }}>
            Resumen PV Entrada (Tasa: {formatBs(tasa1)})
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Montos del punto de venta cuando el operador de almuerzo entra a la isla
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <CurrencyInput
                label="Monto 1 (Bs.)"
                value={pvEntrada1}
                onChange={setPvEntrada1}
                currency="BS"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <CurrencyInput
                label="Monto 2 (Bs.)"
                value={pvEntrada2}
                onChange={setPvEntrada2}
                currency="BS"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <CurrencyInput
                label="Monto 3 (Bs.)"
                value={pvEntrada3}
                onChange={setPvEntrada3}
                currency="BS"
              />
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ textAlign: 'right' }}>
            <Chip
              label={`Total PV Entrada: ${formatBs(pvEntradaTotalBs)} = ${formatUSD(pvEntradaTotalUSD)}`}
              color="info"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* ═══ PV SALIDA ═══ */}
      <Card sx={{ mb: 2, border: '2px solid', borderColor: 'secondary.light' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'secondary.main' }}>
            Resumen PV Salida (Tasa: {formatBs(tasa1)})
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Montos del punto de venta cuando el operador de almuerzo sale de la isla
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <CurrencyInput
                label="Monto 1 (Bs.)"
                value={pvSalida1}
                onChange={setPvSalida1}
                currency="BS"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <CurrencyInput
                label="Monto 2 (Bs.)"
                value={pvSalida2}
                onChange={setPvSalida2}
                currency="BS"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <CurrencyInput
                label="Monto 3 (Bs.)"
                value={pvSalida3}
                onChange={setPvSalida3}
                currency="BS"
              />
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ textAlign: 'right' }}>
            <Chip
              label={`Total PV Salida: ${formatBs(pvSalidaTotalBs)} = ${formatUSD(pvSalidaTotalUSD)}`}
              color="secondary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* ═══ TOTAL RESUMEN PV ═══ */}
      <Card sx={{ mb: 2, bgcolor: '#FFF8E1', border: '2px solid #FFB74D' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#E65100' }}>
            Total Resumen PV (Salida − Entrada)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Paper sx={{ p: 2, bgcolor: 'white', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                  Total PV Bs.
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: totalPVBs >= 0 ? '#1565C0' : '#D32F2F' }}>
                  {formatBs(totalPVBs)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Paper sx={{ p: 2, bgcolor: 'white', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                  Total PV USD
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: totalPVUSD >= 0 ? '#2E7D32' : '#D32F2F' }}>
                  {formatUSD(totalPVUSD)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ═══ EFECTIVO ═══ */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'success.main' }}>
            Efectivo dejado por el operador
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <CurrencyInput
                label="$ (Dólares)"
                value={efectivoUSD}
                onChange={setEfectivoUSD}
                currency="USD"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <CurrencyInput
                label="Bs. (Bolívares)"
                value={efectivoBs}
                onChange={setEfectivoBs}
                currency="BS"
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 1, textAlign: 'right' }}>
            <Chip
              label={`Efectivo Bs en $: ${formatUSD(efectivoBsInUSD)}`}
              color="primary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* ═══ EXCEDENTE DEL OPERADOR ═══ */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#FFD100' }}>
            Excedente del Operador
            {operatorName ? ` — ${operatorName}` : ''}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: hasReadings ? '#E3F2FD' : '#EEEEEE',
                  borderRadius: 2,
                  textAlign: 'center',
                  minHeight: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                  $ por Litros Vendidos
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: hasReadings ? '#1565C0' : '#9E9E9E' }}>
                  {hasReadings ? formatUSD(litersRef) : '—'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: hasReadings ? '#E8F5E9' : '#EEEEEE',
                  borderRadius: 2,
                  textAlign: 'center',
                  minHeight: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                  Ingresos Totales
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: hasReadings ? '#2E7D32' : '#9E9E9E' }}>
                  {hasReadings ? formatUSD(ingresosTotalUSD) : '—'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Desglose de ingresos */}
          {hasReadings && (
            <Box sx={{ mt: 1, mb: 1 }}>
              <Paper sx={{ p: 1.5, bgcolor: '#F5F5F5', borderRadius: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                  Desglose de Ingresos
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Total PV (Salida − Entrada)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatUSD(totalPVUSD)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Efectivo $</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatUSD(efectivoUSD)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Efectivo Bs. → USD</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatUSD(efectivoBsInUSD)}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Total</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatUSD(ingresosTotalUSD)}</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: hasReadings ? (propinaUSD > 0 ? '#E8F5E9' : '#FFEBEE') : '#EEEEEE',
                  borderRadius: 2,
                  textAlign: 'center',
                  minHeight: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                  Excedente USD
                </Typography>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 800, color: hasReadings ? (propinaUSD > 0 ? '#2E7D32' : '#D32F2F') : '#9E9E9E' }}
                >
                  {hasReadings ? formatUSD(propinaUSD) : '—'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: hasReadings ? (propinaBs > 0 ? '#E8F5E9' : '#FFEBEE') : '#EEEEEE',
                  borderRadius: 2,
                  textAlign: 'center',
                  minHeight: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                  Excedente Bs
                </Typography>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 800, color: hasReadings ? (propinaBs > 0 ? '#2E7D32' : '#D32F2F') : '#9E9E9E' }}
                >
                  {hasReadings ? formatBs(propinaBs) : '—'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ═══ Botones: WhatsApp + Limpiar ═══ */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<WhatsAppIcon />}
          onClick={handleSendWhatsApp}
          sx={{
            bgcolor: '#25D366',
            color: 'white',
            borderRadius: 3,
            px: 3,
            py: 1,
            fontWeight: 700,
            '&:hover': { bgcolor: '#1DA851' },
          }}
        >
          Enviar por WhatsApp
        </Button>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={handleReset}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            borderRadius: 3,
            px: 3,
            py: 1,
            fontWeight: 700,
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          Limpiar Todo
        </Button>
      </Box>
    </Box>
  );
}