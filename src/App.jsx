import React, { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Backdrop } from '@mui/material';
import useStore from './store/useStore.js';
import { useCierreStore } from './store/useCierreStore.js';
import { useProductStore } from './store/useProductStore.js';
import { useConfigStore } from './store/useConfigStore.js';
import { useInventoryStore } from './store/useInventoryStore.js';
import { useGandolaStore } from './store/useGandolaStore.js';

// Pages
import Login from './pages/Login.jsx';
import ProtectedRoute from './pages/ProtectedRoute.jsx';

// Admin
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import EstadisticasAdmin from './pages/admin/Estadisticas.jsx';
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
import EstadisticasSupervisor from './pages/supervisor/Estadisticas.jsx';

function AppInitializer({ children }) {
  const loadCurrentShift = useCierreStore((state) => state.loadCurrentShift);
  const loadProducts = useProductStore((state) => state.loadProducts);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const loadStock = useInventoryStore((state) => state.loadStock);
  const loadCurrentReception = useGandolaStore((state) => state.loadCurrentReception);

  useEffect(() => {
    loadCurrentShift();
    loadProducts();
    loadConfig();
    loadStock();
    loadCurrentReception();
  }, [loadCurrentShift, loadProducts, loadConfig, loadStock, loadCurrentReception]);

  return <>{children}</>;
}

function RoleRedirect() {
  const location = useLocation();
  const user = useStore((state) => state.user);

  // Admin going to / → redirect to /admin
  if (user?.role === 'administrador' && (location.pathname === '/' || location.pathname === '/lecturas' || location.pathname === '/cierre' || location.pathname === '/biblia' || location.pathname === '/cuadre-pv' || location.pathname === '/inventario' || location.pathname === '/generar-pdf' || location.pathname === '/recepcion-gandola' || location.pathname === '/estadisticas')) {
    return <Navigate to="/admin" replace />;
  }

  // Supervisor going to /admin → redirect to /
  if (user?.role === 'supervisor' && location.pathname.startsWith('/admin')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default function App() {
  const loading = useStore((state) => state.loading);

  if (loading) {
    return (
      <Backdrop sx={{ color: '#fff', zIndex: 1300 }} open>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={40} sx={{ color: '#CE1126' }} />
        </Box>
      </Backdrop>
    );
  }

  return (
    <AppInitializer>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="estadisticas" element={<EstadisticasAdmin />} />
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
            <Route path="estadisticas" element={<EstadisticasSupervisor />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppInitializer>
  );
}
