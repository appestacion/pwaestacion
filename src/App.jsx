import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';
import theme from './theme/theme.js';
import useStore from './store/useStore.js';
import { initDefaultData } from './services/storage.js';
import { useCierreStore } from './store/useCierreStore.js';
import { useProductStore } from './store/useProductStore.js';
import { useConfigStore } from './store/useConfigStore.js';
import { useInventoryStore } from './store/useInventoryStore.js';
import { useGandolaStore } from './store/useGandolaStore.js';
import { useNetworkStore } from './store/useNetworkStore.js';

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

function AppInitializer({ children }) {
  const initAuth = useStore((state) => state.initAuth);
  const loadCurrentShift = useCierreStore((state) => state.loadCurrentShift);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const loadStock = useInventoryStore((state) => state.loadStock);
  const loadCurrentReception = useGandolaStore((state) => state.loadCurrentReception);
  const initNetwork = useNetworkStore((state) => state.init);

  useEffect(() => {
    initNetwork();
    initAuth();
    initDefaultData();
    loadConfig();
    loadProducts();
    loadStock();
    loadCurrentShift();
    loadCurrentReception();
  }, [initNetwork, initAuth, loadProducts, loadConfig, loadStock, loadCurrentShift, loadCurrentReception]);

  return <>{children}</>;
}

function RoleRedirect() {
  const location = useLocation();
  const user = useStore((state) => state.user);

  if (user?.role === 'administrador' && (location.pathname === '/' || location.pathname === '/lecturas' || location.pathname === '/cierre' || location.pathname === '/biblia' || location.pathname === '/cuadre-pv' || location.pathname === '/inventario' || location.pathname === '/generar-pdf' || location.pathname === '/recepcion-gandola')) {
    return <Navigate to="/admin" replace />;
  }

  if (user?.role === 'supervisor' && location.pathname.startsWith('/admin')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} autoHideDuration={3000}>
        <BrowserRouter>
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
                  <Route path="biblia" element={<Biblia />} />
                  <Route path="cuadre-pv" element={<CuadrePV />} />
                  <Route path="inventario" element={<Inventario />} />
                  <Route path="recepcion-gandola" element={<RecepcionGandola />} />
                  <Route path="generar-pdf" element={<GenerarPDF />} />
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