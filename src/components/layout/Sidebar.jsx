// src/components/layout/Sidebar.jsx
// Sidebar exclusivo para E/S Montaña Fresca.
// Incluye sección colapsable "Funciones Express" para herramientas aisladas.
import React, { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Collapse from '@mui/material/Collapse';
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
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import PaymentsIcon from '@mui/icons-material/Payments';
import LunchDiningIcon from '@mui/icons-material/LunchDining';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import BoltIcon from '@mui/icons-material/Bolt';
import { useLocation, useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';

const DRAWER_WIDTH = 260;

// ── Menú principal (sin funciones express) ──
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

// ── Funciones Express (aisladas, no afectan el turno) ──
const expressMenuItems = [
  { path: '/propina-almuerzo', label: 'Propina Almuerzo', icon: <LunchDiningIcon /> },
  { path: '/estimacion-litros', label: 'Estimación Litros', icon: <PhotoCameraIcon /> },
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

  // ── Estado colapsable de Funciones Express ──
  const [expressOpen, setExpressOpen] = useState(true);

  // Auto-expandir si la ruta actual es una función express
  const isExpressRoute = expressMenuItems.some((item) => item.path === location.pathname);

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
      <List sx={{ flex: 1, py: 1, overflowY: 'auto' }}>
        {user?.role === 'administrador' && (
          <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
            ADMINISTRACIÓN
          </Typography>
        )}

        {/* ── Items principales ── */}
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

        {/* ═══ FUNCIONES EXPRESS (solo supervisor) ═══ */}
        {user?.role !== 'administrador' && (
          <>
            <Divider sx={{ my: 1, mx: 1 }} />

            {/* Header colapsable */}
            <ListItem disablePadding sx={{ px: 1 }}>
              <ListItemButton
                onClick={() => setExpressOpen((prev) => !prev)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  bgcolor: isExpressRoute ? 'rgba(206, 17, 38, 0.08)' : 'transparent',
                  '&:hover': {
                    bgcolor: isExpressRoute ? 'rgba(206, 17, 38, 0.12)' : 'action.hover',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <BoltIcon sx={{ color: '#FF6600' }} />
                </ListItemIcon>
                <ListItemText
                  primary="Funciones Express"
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: '#FF6600',
                  }}
                />
                {(expressOpen || isExpressRoute) ? (
                  <ChevronRightIcon sx={{ fontSize: '1rem', color: '#FF6600', transform: 'rotate(90deg)', transition: 'transform 0.2s' }} />
                ) : (
                  <ChevronRightIcon sx={{ fontSize: '1rem', color: '#FF6600', transition: 'transform 0.2s' }} />
                )}
              </ListItemButton>
            </ListItem>

            {/* Sub-items colapsables */}
            <Collapse in={expressOpen || isExpressRoute} timeout="auto" unmountOnExit={false}>
              <List disablePadding>
                {expressMenuItems.map((item) => (
                  <ListItem key={item.path} disablePadding sx={{ px: 1, pl: 2 }}>
                    <ListItemButton
                      selected={location.pathname === item.path}
                      onClick={() => handleNavigate(item.path)}
                      sx={{
                        borderRadius: 2,
                        mb: 0.5,
                        pl: 3,
                        borderLeft: '3px solid',
                        borderColor: location.pathname === item.path ? '#FF6600' : 'transparent',
                        '&.Mui-selected': {
                          backgroundColor: '#FFF3E0',
                          color: '#E65100',
                          '& .MuiListItemIcon-root': { color: '#E65100' },
                          '&:hover': { backgroundColor: '#FFE0B2' },
                          borderColor: '#FF6600',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: 500 }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>

            {/* Chip indicador cuando está colapsado */}
            {!expressOpen && !isExpressRoute && (
              <Box sx={{ px: 3, py: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', fontSize: '0.65rem' }}>
                  {expressMenuItems.length} herramientas aisladas
                </Typography>
              </Box>
            )}
          </>
        )}
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