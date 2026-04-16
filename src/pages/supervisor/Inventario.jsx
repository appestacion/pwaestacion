// src/pages/supervisor/Inventario.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import SaveIcon from '@mui/icons-material/Save';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useProductStore } from '../../store/useProductStore.js';
import { useInventoryStore } from '../../store/useInventoryStore.js';
import { calculateInventory } from '../../lib/calculations.js';
import { formatUSD } from '../../lib/formatters.js';
import { enqueueSnackbar } from 'notistack';

export default function Inventario() {
  const { currentShift, loadCurrentShift } = useCierreStore();
  const { products, loadProducts } = useProductStore();
  const { stock, loadStock, updateStockItem } = useInventoryStore();
  const [editingStock, setEditingStock] = useState(false);

  useEffect(() => {
    loadCurrentShift();
    loadProducts();
    loadStock();
  }, [loadCurrentShift, loadProducts, loadStock]);

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);

  const islandsSold = useMemo(() => {
    if (!currentShift) return { 1: [], 2: [], 3: [] };
    return {
      1: currentShift.islands.find((i) => i.islandId === 1)?.productsSold || [],
      2: currentShift.islands.find((i) => i.islandId === 2)?.productsSold || [],
      3: currentShift.islands.find((i) => i.islandId === 3)?.productsSold || [],
    };
  }, [currentShift]);

  const inventory = useMemo(() => {
    return calculateInventory(
      activeProducts.map((p) => ({ name: p.name, priceUSD: p.priceUSD })),
      stock,
      islandsSold
    );
  }, [activeProducts, stock, islandsSold]);

  const totalUSD = inventory.reduce((s, r) => s + r.totalUSD, 0);

  const handleStockChange = (productName, value) => {
    const num = parseInt(value) || 0;
    updateStockItem(productName, num);
  };

  const handleSaveStock = () => {
    setEditingStock(false);
    enqueueSnackbar({ message: 'Stock inicial guardado', variant: 'success' });
  };

  if (!currentShift) {
    return <Alert severity="warning">No hay un turno activo.</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Inventario</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Control de productos por isla — {currentShift.date}
          </Typography>
        </Box>
        {!editingStock ? (
          <Button variant="outlined" onClick={() => setEditingStock(true)}>
            Editar Stock Inicial
          </Button>
        ) : (
          <Button variant="contained" onClick={handleSaveStock} startIcon={<SaveIcon />}>
            Guardar Stock
          </Button>
        )}
      </Box>

      <Card sx={{ mb: 3, overflowX: 'auto' }}>
        <CardContent>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white', minWidth: 200 }}>Producto</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Stock Ini</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Isla 1</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Isla 2</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Isla 3</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Total Ven</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Stock Fin</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }} align="right">Precio $</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#FFD100', color: '#1A1A2E' }} align="right">Total $</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventory.map((row) => (
                  <TableRow key={row.productName} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{row.productName}</TableCell>
                    <TableCell align="right">
                      {editingStock ? (
                        <TextField
                          type="number"
                          variant="standard"
                          value={stock[row.productName] || 0}
                          onChange={(e) => handleStockChange(row.productName, e.target.value)}
                          sx={{ width: 60, '& input': { textAlign: 'right' } }}
                        />
                      ) : (
                        <Typography variant="body2">{row.stockInicial}</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{row.vendidoIsla1}</TableCell>
                    <TableCell align="right">{row.vendidoIsla2}</TableCell>
                    <TableCell align="right">{row.vendidoIsla3}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{row.totalVendido}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: row.stockFinal < 0 ? 'error.main' : 'success.main',
                      }}
                    >
                      {row.stockFinal}
                    </TableCell>
                    <TableCell align="right">{formatUSD(row.priceUSD)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, bgcolor: row.totalUSD > 0 ? '#FFF8E1' : 'transparent' }}
                    >
                      {formatUSD(row.totalUSD)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Productos Activos</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{activeProducts.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Unidades Vendidas</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                {inventory.reduce((s, r) => s + r.totalVendido, 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4}>
          <Card sx={{ borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Total Ventas $</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
                {formatUSD(totalUSD)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
