import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import { useConfigStore } from '../../store/useConfigStore.js';
import { enqueueSnackbar } from 'notistack';

export default function Configuracion() {
  const { config, loadConfig, updateConfig, resetConfig } = useConfigStore();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    loadConfig();
    if (config.stationLogo) {
      setPreview(config.stationLogo);
    }
  }, [loadConfig]);

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      enqueueSnackbar({ message: 'Solo se permiten archivos de imagen', variant: 'error' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      enqueueSnackbar({ message: 'La imagen no debe superar 2MB', variant: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setPreview(base64);
      updateConfig({ stationLogo: base64 });
      enqueueSnackbar({ message: 'Logo actualizado correctamente', variant: 'success' });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setPreview('');
    updateConfig({ stationLogo: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    enqueueSnackbar({ message: 'Logo eliminado', variant: 'info' });
  };

  const handleReset = () => {
    if (window.confirm('¿Estás seguro de restaurar la configuración por defecto? Se perderán todos los cambios.')) {
      resetConfig();
      setPreview('');
      enqueueSnackbar({ message: 'Configuración restaurada por defecto', variant: 'info' });
    }
  };

  const handleSave = () => {
    enqueueSnackbar({ message: 'Configuración guardada correctamente', variant: 'success' });
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Configuración</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Personaliza el sistema con los datos de tu estación de servicio
        </Typography>
      </Box>

      {/* Station Identity */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
            Identidad de la Estación
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombre de la Estación"
                value={config.stationName}
                onChange={(e) => updateConfig({ stationName: e.target.value })}
                placeholder="Ej: Estación de Servicio Los Andes"
                helperText="Este nombre aparecerá en toda la aplicación y en los PDFs generados"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="RIF"
                value={config.stationRif}
                onChange={(e) => updateConfig({ stationRif: e.target.value })}
                placeholder="Ej: J-12345678-9"
                helperText="Registro de Información Fiscal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Dirección"
                value={config.stationAddress}
                onChange={(e) => updateConfig({ stationAddress: e.target.value })}
                placeholder="Ej: Av. Principal, Caracas, Venezuela"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Teléfono"
                value={config.stationPhone}
                onChange={(e) => updateConfig({ stationPhone: e.target.value })}
                placeholder="Ej: +58 212-1234567"
              />
            </Grid>
          </Grid>

          {/* Logo */}
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>
            Logo de la Estación
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            {preview ? (
              <Avatar
                src={preview}
                alt={config.stationName}
                sx={{ width: 80, height: 80, borderRadius: 2, bgcolor: 'grey.100' }}
                variant="rounded"
              />
            ) : (
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: 2,
                  bgcolor: 'grey.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LocalGasStationIcon sx={{ fontSize: 40, color: 'grey.400' }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleLogoUpload}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                Subir Logo
              </Button>
              {preview && (
                <Button
                  variant="text"
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleRemoveLogo}
                >
                  Eliminar Logo
                </Button>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Imagen PNG o JPG, máximo 2MB. Se muestra en el login y sidebar.
              </Typography>
            </Box>
          </Box>

          {/* Preview */}
          {preview && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
              Vista previa: El logo aparecerá en la pantalla de login, en el menú lateral (sidebar) y en la cabecera de los reportes PDF generados.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Exchange Rate */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'secondary.main' }}>
            Tasa de Cambio BCV
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Tasa 1 (Bs. por $)"
                type="number"
                value={config.tasa1 || ''}
                onChange={(e) => updateConfig({ tasa1: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
                helperText="Tasa principal para el turno PM"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Tasa 2 (Bs. por $)"
                type="number"
                value={config.tasa2 || ''}
                onChange={(e) => updateConfig({ tasa2: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>Bs.</span> }}
                helperText="Segunda tasa para el turno AM"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Station Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: 'warning.main' }}>
            Configuración de la Estación
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Define la cantidad de islas, surtidores por isla y tanques. Los cambios se reflejarán en los formularios de lecturas y cierre.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Islas"
                type="number"
                value={config.islandsCount || 3}
                onChange={(e) => updateConfig({ islandsCount: parseInt(e.target.value) || 3 })}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Surtidores por Isla"
                type="number"
                value={config.pumpsPerIsland || 2}
                onChange={(e) => updateConfig({ pumpsPerIsland: parseInt(e.target.value) || 2 })}
                inputProps={{ min: 1, max: 6 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Tanques"
                type="number"
                value={config.tanksCount || 3}
                onChange={(e) => updateConfig({ tanksCount: parseInt(e.target.value) || 3 })}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Máx. Cortes"
                type="number"
                value={config.maxCortes || 12}
                onChange={(e) => updateConfig({ maxCortes: parseInt(e.target.value) || 12 })}
                inputProps={{ min: 1, max: 20 }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* About */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            Acerca del Sistema
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                <strong>Sistema de Cierre de Estación de Servicio</strong> v1.0.0
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Aplicación PWA para gestión de cierres de turno, lecturas de surtidores y tanques, control financiero (Biblia, Cuadre PV), inventario de productos, recepción de gandolas y generación de reportes en PDF.
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Configuración de turnos: Supervisor (6:00 AM - 2:00 PM / 2:00 PM - 10:00 PM), Operadores (7:00 AM - 7:00 PM / 7:00 PM - 7:00 AM).
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Zona horaria: America/Caracas (UTC-4) | Moneda: Bolívares (Bs.) / Dólares ($)
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Actions */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
        >
          Restaurar Valores por Defecto
        </Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
          Guardar Configuración
        </Button>
      </Box>
    </Box>
  );
}
