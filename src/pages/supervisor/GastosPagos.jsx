// src/pages/supervisor/GastosPagos.jsx
import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import Divider from '@mui/material/Divider';
import CurrencyInput from '../../components/common/CurrencyInput.jsx';
import { useCierreStore } from '../../store/useCierreStore.js';
import { formatBs, formatUSD } from '../../lib/formatters.js';
import { bsToUsd } from '../../lib/conversions.js';

export default function GastosPagos() {
  const {
    currentShift,
    loadCurrentShift,
    addShiftGasto,
    removeShiftGasto,
    updateShiftGasto,
  } = useCierreStore();

  useEffect(() => {
    loadCurrentShift();
  }, [loadCurrentShift]);

  if (!currentShift) {
    return <Alert severity="warning">No hay un turno activo. Ve al Dashboard e inicia un turno.</Alert>;
  }

  const gastos = currentShift.gastos || [];
  const tasa1 = currentShift.tasa1 || 0;

  // Calcular totales en Bs y convertir a USD (igual que Punto de Venta)
  const totalGastosBs = gastos.reduce((s, g) => s + (g.montoBs || 0), 0);
  const totalGastosUSD = bsToUsd(totalGastosBs, tasa1);

  const renderItemCard = (label, color, items, onAdd, onRemove, onUpdate, totalBs, totalUSD) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color }}>
            {label} (Bs.)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={`Total: ${formatBs(totalBs)} = ${formatUSD(totalUSD)}`}
              color={totalBs > 0 ? 'success' : 'default'}
              size="small"
              sx={{ fontWeight: 600 }}
            />
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onAdd}>
              Agregar
            </Button>
          </Box>
        </Box>
        {items.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No hay {label.toLowerCase()} registrados.
          </Typography>
        )}
        <Grid container spacing={1}>
          {items.map((item, idx) => {
            const itemBs = item.montoBs || 0;
            const itemUSD = bsToUsd(itemBs, tasa1);
            return (
              <React.Fragment key={idx}>
                <Grid item xs={12} sm={5}>
                  <CurrencyInput
                    label={`${label.slice(0, -1)} ${idx + 1} (Bs.)`}
                    value={itemBs}
                    onChange={(v) => onUpdate(idx, 'montoBs', v)}
                    currency="BS"
                  />
                </Grid>
                <Grid item xs={9} sm={5}>
                  <TextField
                    fullWidth
                    label="Descripcion"
                    size="small"
                    value={item.descripcion || ''}
                    onChange={(e) => onUpdate(idx, 'descripcion', e.target.value)}
                  />
                </Grid>
                <Grid item xs={3} sm={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  {itemBs > 0 && (
                    <Chip
                      label={formatUSD(itemUSD)}
                      size="small"
                      variant="outlined"
                      color="primary"
                      sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                    />
                  )}
                  <IconButton size="small" color="error" onClick={() => onRemove(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Grid>
                {idx < items.length - 1 && (
                  <Grid item xs={12}><Divider sx={{ my: 0.5 }} /></Grid>
                )}
              </React.Fragment>
            );
          })}
        </Grid>
        {items.length > 0 && (
          <Box sx={{ mt: 1.5, textAlign: 'right' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Tasa: {formatBs(tasa1)} — Equivalencia: 1 USD = {formatBs(tasa1)} Bs.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Gastos</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Registro de gastos del turno — {currentShift.date}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Ingrese montos en Bolívares (Bs.) — se convierten automáticamente a USD
          </Typography>
        </Box>
        <Chip label="Auto-guardado en la nube" color="success" size="small" variant="outlined" icon={<CloudSyncIcon />} />
      </Box>

      {/* Gastos */}
      {renderItemCard(
        'Gastos',
        '#D32F2F',
        gastos,
        () => addShiftGasto({ montoBs: 0, descripcion: '' }),
        (idx) => removeShiftGasto(idx),
        (idx, field, value) => updateShiftGasto(idx, field, value),
        totalGastosBs,
        totalGastosUSD
      )}
    </Box>
  );
}
