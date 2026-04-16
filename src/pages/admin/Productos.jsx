// src/pages/admin/Productos.jsx
import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useProductStore } from '../../store/useProductStore.js';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../config/constants.js';
import { formatUSD } from '../../lib/formatters.js';
import { enqueueSnackbar } from 'notistack';

export default function Productos() {
  const { products, loadProducts, addProduct, updateProduct } = useProductStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: '', priceUSD: 0, category: 'otro' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenNew = () => {
    setEditingProduct(null);
    setForm({ name: '', priceUSD: 0, category: 'otro' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setForm({ name: product.name, priceUSD: product.priceUSD, category: product.category });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || form.priceUSD <= 0) {
      enqueueSnackbar({ message: 'Nombre y precio son requeridos', variant: 'error' });
      return;
    }

    if (editingProduct) {
      updateProduct(editingProduct.id, { name: form.name.toUpperCase(), priceUSD: form.priceUSD, category: form.category });
      enqueueSnackbar({ message: 'Producto actualizado', variant: 'success' });
    } else {
      addProduct(form.name, form.priceUSD, form.category);
      enqueueSnackbar({ message: 'Producto agregado', variant: 'success' });
    }

    setDialogOpen(false);
  };

  const handleToggleActive = (product) => {
    updateProduct(product.id, { active: !product.active });
    enqueueSnackbar({ message: `Producto ${product.active ? 'desactivado' : 'activado'}`, variant: 'info' });
  };

  const categories = ['aditivo', 'aceite', 'refrigerante', 'freno', 'extintor', 'otro'];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Gestión de Productos</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {products.filter((p) => p.active).length} productos activos de {products.length} totales
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenNew}>
          Nuevo Producto
        </Button>
      </Box>

      <TextField
        fullWidth
        label="Buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Categoría</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Precio USD</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} hover sx={{ opacity: product.active ? 1 : 0.5 }}>
                    <TableCell sx={{ fontWeight: 500 }}>{product.name}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={CATEGORY_LABELS[product.category]}
                        size="small"
                        sx={{
                          bgcolor: `${CATEGORY_COLORS[product.category]}20`,
                          color: CATEGORY_COLORS[product.category],
                          fontWeight: 600,
                          fontSize: '0.7rem',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatUSD(product.priceUSD)}
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={product.active}
                        onChange={() => handleToggleActive(product)}
                        color="success"
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenEdit(product)} color="primary">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre del Producto"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Precio USD"
                type="number"
                value={form.priceUSD || ''}
                onChange={(e) => setForm({ ...form, priceUSD: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>$</span> }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Categoría</InputLabel>
                <Select
                  value={form.category}
                  label="Categoría"
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleSave} variant="contained">
            {editingProduct ? 'Guardar Cambios' : 'Agregar Producto'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
