// src/components/layout/Sidebar.jsx
// Sidebar exclusivo para E/S Montaña Fresca.
import React from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import Avatar from '@mui/material/Avatar';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SpeedIcon from '@mui/icons-material/Speed';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BookIcon from '@mui/icons-material/Book';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DescriptionIcon from '@mui/icons-material/Description';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import PaymentsIcon from '@mui/icons-material/Payments';
import { useLocation, useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';

const DRAWER_WIDTH = 260;

const supervisorMenuItems = [
  { path: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/recepcion-gandola', label: 'Recepción Gandola', icon: <LocalShippingIcon /> },
  { path: '/gastos', label: 'Gastos', icon: <PaymentsIcon /> },
  { path: '/lecturas', label: 'Lecturas', icon: <SpeedIcon /> },
  { path: '/cierre', label: 'Cierre de Turno', icon: <ReceiptLongIcon /> },
  { path: '/reporte', label: 'Reporte', icon: <DescriptionIcon /> },
  { path: '/biblia', label: 'Biblia', icon: <BookIcon /> },
  { path: '/cuadre-pv', label: 'Cuadre PV', icon: <PointOfSaleIcon /> },
  { path: '/productos', label: 'Gestión Productos', icon: <CategoryIcon /> },
  { path: '/inventario', label: 'Inventario', icon: <InventoryIcon /> },
  { path: '/historial-cierres', label: 'Historiales', icon: <HistoryIcon /> },
  { path: '/generar-pdf', label: 'Generar PDF', icon: <PictureAsPdfIcon /> },
  { path: '/estadisticas', label: 'Estadísticas', icon: <BarChartIcon /> },
];

const adminMenuItems = [
  { path: '/admin', label: 'Admin Dashboard', icon: <DashboardIcon /> },
  { path: '/admin/usuarios', label: 'Gestión Usuarios', icon: <PeopleIcon /> },
  { path: '/admin/configuracion', label: 'Configuración', icon: <SettingsIcon /> },
];

export default function Sidebar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const setSidebarOpen = useStore((state) => state.setSidebarOpen);
  const user = useStore((state) => state.user);
  const config = useConfigStore((state) => state.config);

  // Logo: prioridad imgbb > LogoMF.jpg local
  const logoSrc = config.stationLogo || '/LogoMF.jpg';

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) {
      setSidebarOpen(false);
      if (document.activeElement) document.activeElement.blur();
    }
  };

  const handleCloseDrawer = () => {
    if (document.activeElement) document.activeElement.blur();
    setSidebarOpen(false);
  };

  const menuItems = user?.role === 'administrador' ? adminMenuItems : supervisorMenuItems;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo / Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : 'flex-end',
          px: 2,
          py: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            src={logoSrc}
            alt="E/S Montaña Fresca"
            sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: 'grey.100' }}
            variant="rounded"
          />
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 800,
                color: 'primary.main',
                lineHeight: 1.2,
                fontSize: '0.85rem',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              E/S Montaña Fresca
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
              RIF: J-30894985-2
            </Typography>
          </Box>
        </Box>
        {isMobile ? (
          <IconButton onClick={() => setSidebarOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        ) : (
          <IconButton onClick={() => setSidebarOpen(false)} size="small">
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* Menu segun rol */}
      <List sx={{ flex: 1, py: 1 }}>
        {user?.role === 'administrador' && (
          <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
            ADMINISTRACIÓN
          </Typography>
        )}
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ px: 1 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigate(item.path)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '& .MuiListItemIcon-root': { color: 'white' },
                  '&:hover': { backgroundColor: 'primary.dark' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem' }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
          © {new Date().getFullYear()} Copyright. Desarrollado por Erick Simosa
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.6rem' }}>
          ericksimosa@gmail.com - 0424 3036024
        </Typography>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={handleCloseDrawer}
        ModalProps={{ keepMounted: true, disablePortal: false, hideBackdrop: false }}
        sx={{
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: 'none' },
        }}
      >
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="persistent"
      open={sidebarOpen}
      sx={{
        width: sidebarOpen ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        transition: 'width 0.2s',
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
