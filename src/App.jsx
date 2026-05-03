// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import theme from './theme/theme.js';
import useStore from './store/useStore.js';
import { useCierreStore } from './store/useCierreStore.js';
import { useProductStore } from './store/useProductStore.js';
import { useConfigStore } from './store/useConfigStore.js';
import { useInventoryStore } from './store/useInventoryStore.js';
import { useGandolaStore } from './store/useGandolaStore.js';
import { useNetworkStore } from './store/useNetworkStore.js';
import { updatePWAIdentity } from './services/pwaIdentity.js';

// Pages
import Login from './pages/Login.jsx';
import ProtectedRoute from './pages/ProtectedRoute.jsx';

// Admin
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import Usuarios from './pages/admin/Usuarios.jsx';
import Productos from './pages/admin/Productos.jsx';
import Configuracion from './pages/admin/Configuracion.jsx';

// Supervisor
import SupervisorLayout from './pages/supervisor/SupervisorLayout.jsx';
import SupervisorDashboard from './pages/supervisor/Dashboard.jsx';
import Lecturas from './pages/supervisor/Lecturas.jsx';
import CierreTurno from './pages/supervisor/CierreTurno.jsx';
import Biblia from './pages/supervisor/Biblia.jsx';
import CuadrePV from './pages/supervisor/CuadrePV.jsx';
import Inventario from './pages/supervisor/Inventario.jsx';
import RecepcionGandola from './pages/supervisor/RecepcionGandola.jsx';
import GenerarPDF from './pages/supervisor/GenerarPDF.jsx';
import ReporteLecturaRecepcion from './pages/supervisor/ReporteLecturaRecepcion.jsx';
import Estadisticas from './pages/supervisor/Estadisticas.jsx';

function AppInitializer({ children }) {
  const initAuth = useStore((state) => state.initAuth);
  const loadCurrentShift = useCierreStore((state) => state.loadCurrentShift);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const configLoading = useConfigStore((state) => state.loading);
  const loadStock = useInventoryStore((state) => state.loadStock);
  const loadIslandStock = useInventoryStore((state) => state.loadIslandStock);
  const loadCurrentReception = useGandolaStore((state) => state.loadCurrentReception);
  const initNetwork = useNetworkStore((state) => state.init);

  // Suscribirse al nombre, color y logo de la estacion para actualizar PWA
  const config = useConfigStore((state) => state.config);

  // Actualizar la identidad de la PWA cuando cambie la config de la estacion
  useEffect(() => {
    if (config.stationName && config.stationName !== 'Mi Estacion de Servicio') {
      updatePWAIdentity(
        config.stationName,
        config.stationColorPrimary,
        config.stationLogo
      );
    }
  }, [config.stationName, config.stationColorPrimary, config.stationLogo]);

  useEffect(() => {
    initNetwork();
    initAuth();
    loadConfig();
    loadProducts();
    loadStock();
    loadIslandStock();
    loadCurrentShift();
    loadCurrentReception();
  }, [initNetwork, initAuth, loadProducts, loadConfig, loadStock, loadIslandStock, loadCurrentShift, loadCurrentReception]);

  // Mientras la config se carga (primera vez sin cache), mostrar spinner
  // Esto evita el flash de "Mi Estacion de Servicio"
  if (configLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} autoHideDuration={3000}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppInitializer>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Login />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                {/* Admin Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="usuarios" element={<Usuarios />} />
                  <Route path="productos" element={<Productos />} />
                  <Route path="configuracion" element={<Configuracion />} />
                </Route>

                {/* Supervisor Routes */}
                <Route element={<SupervisorLayout />}>
                  <Route index element={<SupervisorDashboard />} />
                  <Route path="lecturas" element={<Lecturas />} />
                  <Route path="cierre" element={<CierreTurno />} />
                  <Route path="reporte" element={<ReporteLecturaRecepcion />} />
                  <Route path="biblia" element={<Biblia />} />
                  <Route path="cuadre-pv" element={<CuadrePV />} />
                  <Route path="inventario" element={<Inventario />} />
                  <Route path="recepcion-gandola" element={<RecepcionGandola />} />
                  <Route path="generar-pdf" element={<GenerarPDF />} />
                  <Route path="estadisticas" element={<Estadisticas />} />
                </Route>
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppInitializer>
        </BrowserRouter>
      </SnackbarProvider>
    </ThemeProvider>
  );
}