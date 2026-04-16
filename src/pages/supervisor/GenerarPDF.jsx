// src/pages/supervisor/GenerarPDF.jsx
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useProductStore } from '../../store/useProductStore.js';
import { useInventoryStore } from '../../store/useInventoryStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { calculateBiblia, calculateCuadrePV, calculateInventory } from '../../lib/calculations.js';
import { generateAllPDFs } from '../../lib/pdfGenerator.js';
import { SHIFT_LABELS, SUPERVISOR_SHIFT_LABELS } from '../../config/constants.js';
import { enqueueSnackbar } from 'notistack';

export default function GenerarPDF() {
  const { currentShift, shiftsHistory, loadCurrentShift, loadShiftsHistory } = useCierreStore();
  const { products, loadProducts } = useProductStore();
  const { stock, loadStock } = useInventoryStore();
  const config = useConfigStore((state) => state.config);

  React.useEffect(() => {
    loadCurrentShift();
    loadProducts();
    loadStock();
    loadShiftsHistory();
  }, [loadCurrentShift, loadProducts, loadStock, loadShiftsHistory]);

  const biblia = useMemo(() => {
    if (!currentShift) return [];
    return calculateBiblia(currentShift);
  }, [currentShift]);

  const cuadre = useMemo(() => {
    if (!currentShift) return [];
    return calculateCuadrePV(currentShift);
  }, [currentShift]);

  const inventory = useMemo(() => {
    if (!currentShift || products.length === 0) return [];
    const islandsSold = {
      1: currentShift.islands.find((i) => i.islandId === 1)?.productsSold || [],
      2: currentShift.islands.find((i) => i.islandId === 2)?.productsSold || [],
      3: currentShift.islands.find((i) => i.islandId === 3)?.productsSold || [],
    };
    return calculateInventory(
      products.filter((p) => p.active).map((p) => ({ name: p.name, priceUSD: p.priceUSD })),
      stock,
      islandsSold
    );
  }, [currentShift, products, stock]);

  const getShiftLabel = (shift) => {
    if (shift.operatorShiftType) {
      return SHIFT_LABELS[shift.operatorShiftType] || shift.operatorShiftType;
    }
    return shift.shiftType || 'N/A';
  };

  const handleGenerateAll = () => {
    if (!currentShift) return;
    try {
      const doc = generateAllPDFs(currentShift, biblia, cuadre, inventory, config);
      const safeName = (config.stationName || 'Estacion').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/ +/g, '_');
      doc.save(`Cierre_${safeName}_${currentShift.date}_${currentShift.operatorShiftType}.pdf`);
      enqueueSnackbar({ message: 'PDF generado correctamente', variant: 'success' });
    } catch (err) {
      console.error(err);
      enqueueSnackbar({ message: 'Error al generar PDF', variant: 'error' });
    }
  };

  const handlePrint = () => {
    if (!currentShift) return;
    try {
      const doc = generateAllPDFs(currentShift, biblia, cuadre, inventory, config);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
      enqueueSnackbar({ message: 'Error al generar PDF', variant: 'error' });
    }
  };

  if (!currentShift) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Generar PDF</Typography>
        {shiftsHistory.length > 0 ? (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Turnos Cerrados</Typography>
              {shiftsHistory.slice(0, 10).map((shift) => (
                <Box key={shift.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box>
                    <Typography variant="body2">{shift.date} — {getShiftLabel(shift)}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Cerrado: {shift.closedAt ? new Date(shift.closedAt).toLocaleString('es-VE') : 'N/A'}
                    </Typography>
                  </Box>
                  <Chip label={shift.status} size="small" color={shift.status === 'cerrado' ? 'success' : 'warning'} />
                </Box>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Alert severity="info">No hay turnos para generar PDF. Inicia y cierra un turno primero.</Alert>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Generar PDF</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Generación de reportes del cierre de turno — {currentShift.date}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Card sx={{ height: '100%', border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <PictureAsPdfIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>PDF Completo</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Genera un PDF con todas las secciones: Cierre, Biblia, Cuadre PV e Inventario
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleGenerateAll}>
                  Descargar
                </Button>
                <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
                  Imprimir
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Resumen del Turno</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  { label: 'Fecha', value: currentShift.date },
                  { label: 'Supervisor', value: SUPERVISOR_SHIFT_LABELS[currentShift.supervisorShiftType] || 'N/A' },
                  { label: 'Operadores', value: SHIFT_LABELS[currentShift.operatorShiftType] || 'N/A' },
                  { label: 'Tasa BCV', value: `${currentShift.tasa1} Bs.` },
                  { label: 'Estado', value: currentShift.status === 'cerrado' ? 'Cerrado' : 'En Progreso' },
                  { label: 'Isla 1', value: currentShift.islands[0]?.operatorName || '—' },
                  { label: 'Isla 2', value: currentShift.islands[1]?.operatorName || '—' },
                  { label: 'Isla 3', value: currentShift.islands[2]?.operatorName || '—' },
                ].map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
