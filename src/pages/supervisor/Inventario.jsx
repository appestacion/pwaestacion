// src/pages/supervisor/Inventario.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Paper from '@mui/material/Paper';
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import SaveIcon from '@mui/icons-material/Save';
import AddBoxIcon from '@mui/icons-material/AddBox';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import UndoIcon from '@mui/icons-material/Undo';
import InventoryIcon from '@mui/icons-material/Inventory';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import RemoveShoppingCartIcon from '@mui/icons-material/RemoveShoppingCart';
import CloseIcon from '@mui/icons-material/Close';
import { useCierreStore } from '../../store/useCierreStore.js';
import { useProductStore } from '../../store/useProductStore.js';
import { useInventoryStore } from '../../store/useInventoryStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { ISLAND_LABELS, CATEGORY_ORDER } from '../../config/constants.js';
import { enqueueSnackbar } from 'notistack';

// ── Umbrales de alerta ──
const STOCK_CRITICAL = 0;
const STOCK_LOW = 3;

// ── Paleta de colores por estado ──
const STATUS_COLORS = {
  critical: {
    bg: '#FFEBEE',
    border: '#D32F2F',
    text: '#B71C1C',
    dot: '#D32F2F',
    cell: '#FFCDD2',
    icon: ErrorOutlineIcon,
    label: 'Sin stock',
  },
  low: {
    bg: '#FFF8E1',
    border: '#F57F17',
    text: '#E65100',
    dot: '#F9A825',
    cell: '#FFE082',
    icon: ReportProblemOutlinedIcon,
    label: 'Stock bajo',
  },
  normal: {
    bg: '#E8F5E9',
    border: '#2E7D32',
    text: '#1B5E20',
    dot: '#43A047',
    cell: 'transparent',
    icon: CheckCircleOutlineIcon,
    label: 'Normal',
  },
  empty: {
    bg: 'transparent',
    border: '#E0E0E0',
    text: '#9E9E9E',
    dot: '#BDBDBD',
    cell: 'transparent',
    icon: RemoveShoppingCartIcon,
    label: 'Sin asignar',
  },
};

function getStatus(qty) {
  if (qty <= STOCK_CRITICAL) return 'critical';
  if (qty <= STOCK_LOW) return 'low';
  return 'normal';
}

function getStatusForIsland(islStock, quedan) {
  if (islStock <= 0) return 'empty';
  if (quedan <= STOCK_CRITICAL) return 'critical';
  if (quedan <= STOCK_LOW) return 'low';
  return 'normal';
}

// ── Formatear fecha del sistema ──
function formatDate(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ── Componente: Leyenda de colores ──
function Legend() {
  const items = [
    { status: 'critical', detail: `0 unidades` },
    { status: 'low', detail: `1 – ${STOCK_LOW} unidades` },
    { status: 'normal', detail: `${STOCK_LOW + 1}+ unidades` },
    { status: 'empty', detail: 'Sin asignar a isla' },
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 2,
        bgcolor: '#FAFAFA',
        borderColor: '#E0E0E0',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <LocalGasStationIcon sx={{ fontSize: 16, color: '#666' }} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: '#444',
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize: '0.7rem',
          }}
        >
          Leyenda de estados
        </Typography>
        <Divider sx={{ flex: 1, ml: 1 }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
        {items.map(({ status, detail }) => {
          const c = STATUS_COLORS[status];
          const Icon = c.icon;
          return (
            <Box
              key={status}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1,
                py: 0.4,
                borderRadius: 1.5,
                border: `1.5px solid ${c.border}`,
                bgcolor: c.bg,
              }}
            >
              <Icon sx={{ fontSize: 15, color: c.border }} />
              <Box>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: c.text, lineHeight: 1.1, display: 'block', fontSize: '0.72rem' }}
                >
                  {c.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: c.text, opacity: 0.75, lineHeight: 1.1, display: 'block', fontSize: '0.65rem' }}
                >
                  {detail}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

// ── Componente: Badge de alerta (compacto) ──
function AlertBadge({ count, severity, label }) {
  if (count <= 0) return null;
  const c = severity === 'error' ? STATUS_COLORS.critical : STATUS_COLORS.low;
  const Icon = c.icon;
  return (
    <Tooltip title={`${count} ${label}`}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.4,
          bgcolor: c.bg,
          color: c.text,
          px: 1.2,
          py: 0.35,
          borderRadius: 1.5,
          border: `1.5px solid ${c.border}`,
          fontWeight: 700,
          fontSize: '0.75rem',
        }}
      >
        <Icon sx={{ fontSize: 15 }} />
        {count} {label}
      </Box>
    </Tooltip>
  );
}

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

export default function Inventario() {
  const { currentShift, loadCurrentShift } = useCierreStore();
  const { products, loadProducts } = useProductStore();
  const {
    stock, islandStock, loadStock, loadIslandStock,
    addGeneralStock, distributeToIsland, returnFromIsland,
    updateStockItem, updateIslandStockItem,
  } = useInventoryStore();
  const config = useConfigStore((state) => state.config);

  const [tab, setTab] = useState(0);
  const [editingStock, setEditingStock] = useState(false);
  const [editingIslandStock, setEditingIslandStock] = useState(false);

  // ── Estado local para edición (evita race conditions con onSnapshot) ──
  const [editStock, setEditStock] = useState(null);
  const [editIslandStock, setEditIslandStock] = useState(null);
  const [savingStock, setSavingStock] = useState(false);
  const [savingIsland, setSavingIsland] = useState(false);

  // ── Dialog: Agregar stock general ──
  const [dlgGeneral, setDlgGeneral] = useState(false);
  const [dlgGeneralProduct, setDlgGeneralProduct] = useState('');
  const [dlgGeneralQty, setDlgGeneralQty] = useState('');

  // ── Dialog: Distribuir a isla ──
  const [dlgDistribute, setDlgDistribute] = useState(false);
  const [dlgDistProduct, setDlgDistProduct] = useState('');
  const [dlgDistIsland, setDlgDistIsland] = useState('');
  const [dlgDistQty, setDlgDistQty] = useState('');

  // ── Dialog: Retornar de isla ──
  const [dlgReturn, setDlgReturn] = useState(false);
  const [dlgRetProduct, setDlgRetProduct] = useState('');
  const [dlgRetIsland, setDlgRetIsland] = useState('');
  const [dlgRetQty, setDlgRetQty] = useState('');

  const islandCount = config.islandsCount || 3;
  const islandIds = useMemo(() => Array.from({ length: islandCount }, (_, i) => i + 1), [islandCount]);

  useEffect(() => {
    loadCurrentShift();
    loadProducts();
    loadStock();
    loadIslandStock();
  }, [loadCurrentShift, loadProducts, loadStock, loadIslandStock]);

  const activeProducts = useMemo(() => {
    return products
      .filter((p) => p.active)
      .sort((a, b) => {
        const catA = CATEGORY_ORDER.indexOf(a.category ?? 'otro');
        const catB = CATEGORY_ORDER.indexOf(b.category ?? 'otro');
        if (catA !== catB) return catA - catB;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [products]);

  // ── Productos vendidos por isla en el turno actual ──
  const islandsSold = useMemo(() => {
    if (!currentShift) return {};
    const sold = {};
    currentShift.islands.forEach((i) => {
      sold[i.islandId] = i.productsSold || [];
    });
    return sold;
  }, [currentShift]);

  const hasActiveShift = !!currentShift;

  // ── Resumen para inventario por isla ──
  const islandInventoryData = useMemo(() => {
    return activeProducts.map((prod) => {
      const generalQty = stock[prod.name] || 0;

      const perIsland = {};
      let totalEnIslas = 0;
      let totalVendido = 0;

      islandIds.forEach((iid) => {
        const islStock = islandStock[String(iid)]?.[prod.name] || 0;
        const sold = (islandsSold[iid] || []).reduce((s, p) => {
          return p.productName === prod.name ? s + (p.quantity || 0) : s;
        }, 0);
        const quedan = islStock - sold;
        perIsland[iid] = { islStock, sold, quedan };
        totalEnIslas += islStock;
        totalVendido += sold;
      });

      const totalQuedan = totalEnIslas - totalVendido;

      return {
        productName: prod.name,
        generalQty,
        totalEnIslas,
        totalVendido,
        totalQuedan,
        perIsland,
      };
    });
  }, [activeProducts, stock, islandStock, islandsSold, islandIds]);

  // ── Totales generales ──
  const totals = useMemo(() => {
    let totalGeneralUnits = 0;
    let totalDistributed = 0;
    let totalSold = 0;
    let totalRemaining = 0;

    islandInventoryData.forEach((r) => {
      totalGeneralUnits += r.generalQty;
      totalDistributed += r.totalEnIslas;
      totalSold += r.totalVendido;
      totalRemaining += r.totalQuedan;
    });

    return { totalGeneralUnits, totalDistributed, totalSold, totalRemaining };
  }, [islandInventoryData]);

  // ── Alertas de stock general ──
  const alertGeneral = useMemo(() => {
    const critical = [];
    const low = [];
    islandInventoryData.forEach((r) => {
      if (r.generalQty <= STOCK_CRITICAL) {
        critical.push(r.productName);
      } else if (r.generalQty <= STOCK_LOW) {
        low.push(r.productName);
      }
    });
    return { critical, low };
  }, [islandInventoryData]);

  // ── Alertas de stock en islas ──
  const alertIslands = useMemo(() => {
    const critical = [];
    const low = [];
    islandInventoryData.forEach((r) => {
      islandIds.forEach((iid) => {
        const d = r.perIsland[iid];
        if (d.islStock > 0) {
          if (d.quedan <= STOCK_CRITICAL) {
            critical.push({ product: r.productName, island: iid, quedan: d.quedan });
          } else if (d.quedan <= STOCK_LOW) {
            low.push({ product: r.productName, island: iid, quedan: d.quedan });
          }
        }
      });
    });
    return { critical, low };
  }, [islandInventoryData, islandIds]);

  // ── Iniciar edición stock general (clona a estado local) ──
  const startEditStock = () => {
    const copy = {};
    activeProducts.forEach((p) => { copy[p.name] = stock[p.name] || 0; });
    setEditStock(copy);
    setEditingStock(true);
  };

  // ── Iniciar edición stock por isla (clona a estado local) ──
  const startEditIslandStock = () => {
    const copy = {};
    islandIds.forEach((iid) => {
      copy[String(iid)] = {};
      activeProducts.forEach((p) => {
        copy[String(iid)][p.name] = islandStock[String(iid)]?.[p.name] || 0;
      });
    });
    setEditIslandStock(copy);
    setEditingIslandStock(true);
  };

  const cancelEditStock = () => {
    setEditStock(null);
    setEditingStock(false);
  };

  const cancelEditIslandStock = () => {
    setEditIslandStock(null);
    setEditingIslandStock(false);
  };

  // ── Guardar stock general: escribe solo lo que cambió ──
  const handleSaveStock = async () => {
    if (!editStock) return;
    setSavingStock(true);
    try {
      const promises = [];
      for (const [name, qty] of Object.entries(editStock)) {
        const current = stock[name] || 0;
        if (qty !== current) {
          promises.push(updateStockItem(name, qty));
        }
      }
      await Promise.all(promises);
      setEditStock(null);
      setEditingStock(false);
      enqueueSnackbar({ message: 'Stock guardado correctamente', variant: 'success' });
    } catch (err) {
      console.error('Error guardando stock:', err);
      enqueueSnackbar({ message: 'Error al guardar stock', variant: 'error' });
    } finally {
      setSavingStock(false);
    }
  };

  // ── Guardar stock por isla: escribe solo lo que cambió ──
  const handleSaveIslandStock = async () => {
    if (!editIslandStock) return;
    setSavingIsland(true);
    try {
      const promises = [];
      for (const [iid, products] of Object.entries(editIslandStock)) {
        for (const [name, qty] of Object.entries(products)) {
          const current = islandStock[iid]?.[name] || 0;
          if (qty !== current) {
            promises.push(updateIslandStockItem(name, parseInt(iid), qty));
          }
        }
      }
      await Promise.all(promises);
      setEditIslandStock(null);
      setEditingIslandStock(false);
      enqueueSnackbar({ message: 'Stock por isla guardado correctamente', variant: 'success' });
    } catch (err) {
      console.error('Error guardando stock por isla:', err);
      enqueueSnackbar({ message: 'Error al guardar stock por isla', variant: 'error' });
    } finally {
      setSavingIsland(false);
    }
  };

  const handleAddGeneralStock = async () => {
    if (!dlgGeneralProduct || dlgGeneralQty <= 0) {
      enqueueSnackbar({ message: 'Seleccione producto y cantidad', variant: 'warning' });
      return;
    }
    const ok = await addGeneralStock(dlgGeneralProduct, parseInt(dlgGeneralQty));
    if (ok) {
      enqueueSnackbar({ message: `+${dlgGeneralQty} unidades de ${dlgGeneralProduct} agregadas al almacen`, variant: 'success' });
      setDlgGeneral(false);
      setDlgGeneralProduct('');
      setDlgGeneralQty('');
    } else {
      enqueueSnackbar({ message: 'Error al agregar stock', variant: 'error' });
    }
  };

  const handleDistribute = async () => {
    if (!dlgDistProduct || !dlgDistIsland || dlgDistQty <= 0) {
      enqueueSnackbar({ message: 'Complete todos los campos', variant: 'warning' });
      return;
    }
    const islandId = parseInt(dlgDistIsland);
    const available = stock[dlgDistProduct] || 0;
    if (parseInt(dlgDistQty) > available) {
      enqueueSnackbar({ message: `Stock insuficiente. Disponible: ${available}`, variant: 'error' });
      return;
    }
    const ok = await distributeToIsland(dlgDistProduct, islandId, parseInt(dlgDistQty));
    if (ok) {
      enqueueSnackbar({ message: `${dlgDistQty} ${dlgDistProduct} distribuidos a ${ISLAND_LABELS[islandId]}`, variant: 'success' });
      setDlgDistribute(false);
      setDlgDistProduct('');
      setDlgDistIsland('');
      setDlgDistQty('');
    } else {
      enqueueSnackbar({ message: 'Error al distribuir', variant: 'error' });
    }
  };

  const handleReturn = async () => {
    if (!dlgRetProduct || !dlgRetIsland || dlgRetQty <= 0) {
      enqueueSnackbar({ message: 'Complete todos los campos', variant: 'warning' });
      return;
    }
    const islandId = parseInt(dlgRetIsland);
    const iid = String(islandId);
    const available = islandStock[iid]?.[dlgRetProduct] || 0;
    if (parseInt(dlgRetQty) > available) {
      enqueueSnackbar({ message: `Stock insuficiente en isla. Disponible: ${available}`, variant: 'error' });
      return;
    }
    const ok = await returnFromIsland(dlgRetProduct, islandId, parseInt(dlgRetQty));
    if (ok) {
      enqueueSnackbar({ message: `${dlgRetQty} ${dlgRetProduct} retornados de ${ISLAND_LABELS[islandId]}`, variant: 'success' });
      setDlgReturn(false);
      setDlgRetProduct('');
      setDlgRetIsland('');
      setDlgRetQty('');
    } else {
      enqueueSnackbar({ message: 'Error al retornar', variant: 'error' });
    }
  };

  // ── Info del encabezado ──
  let turnoLabel = '—';
  let shiftDateStr = formatDate(new Date());
  let dayName = '';

  if (currentShift) {
    const isNocturno = currentShift.operatorShiftType === 'NOCTURNO';
    turnoLabel = isNocturno ? '2TO' : '1TO';
    const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const parts = (currentShift.date || '').split('/');
    const shiftDate = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
    dayName = dayNames[shiftDate.getDay()] || '';
    shiftDateStr = currentShift.date || shiftDateStr;
  }

  // ── Estilos comunes ──
  const headCell = { fontWeight: 700, bgcolor: '#424242', color: '#fff', fontSize: '0.8rem', p: '8px 10px', border: '1px solid #616161' };
  const bodyCell = { fontSize: '0.85rem', p: '6px 10px', border: '1px solid #e0e0e0' };
  const resumenCell = { ...bodyCell, fontWeight: 700, bgcolor: '#37474F', color: '#fff' };

  return (
    <Box>
      {/* ═══ Encabezado ═══ */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {config.stationLogo ? (
            <Avatar
              src={config.stationLogo}
              alt={config.stationName}
              sx={{ width: 48, height: 48, borderRadius: 1.5 }}
              variant="rounded"
            />
          ) : (
            <Box sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LocalGasStationIcon sx={{ fontSize: 30, color: 'grey.500' }} />
            </Box>
          )}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>Inventario</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {config.stationName}{config.stationRif !== 'J-00000000-0' ? ` — ${config.stationRif}` : ''}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="img" src="/PDVSA.png" alt="PDVSA" sx={{ width: 80, height: 'auto', objectFit: 'contain' }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{shiftDateStr}</Typography>
            </Box>
            {hasActiveShift ? (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Turno: {turnoLabel} {dayName}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <WarningAmberIcon sx={{ fontSize: 15, color: '#F57F17' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#F57F17', fontStyle: 'italic' }}>
                  Sin turno activo
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Aviso sutil cuando no hay turno */}
      {!hasActiveShift && (
        <Alert
          severity="info"
          variant="outlined"
          sx={{ mb: 2, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.85rem' } }}
        >
          No hay un turno activo. Puedes consultar y modificar el inventario general y por isla.
          Las columnas de ventas se actualizaran cuando inicies un turno.
        </Alert>
      )}

      {/* ═══ Tabs ═══ */}
      <Box sx={{ borderBottom: '2px solid #424242', mb: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
          <Tab icon={<InventoryIcon />} iconPosition="start" label="Inventario General" />
          <Tab icon={<StorefrontIcon />} iconPosition="start" label="Inventario por Isla" />
        </Tabs>
      </Box>

      {/* ══════════════════════════════════════════════
          TAB 0 — INVENTARIO GENERAL (Almacen / Cajas)
          ══════════════════════════════════════════════ */}
      <TabPanel value={tab} index={0}>
        <Legend />

        {/* Botones con badges de alerta */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <AlertBadge count={alertGeneral.critical.length} severity="error" label="sin stock" />
            <AlertBadge count={alertGeneral.low.length} severity="warning" label="stock bajo" />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" size="small" startIcon={<AddBoxIcon />} onClick={() => setDlgGeneral(true)}>
              Agregar Stock
            </Button>
            {!editingStock ? (
              <Button variant="outlined" size="small" onClick={startEditStock}>Editar Stock</Button>
            ) : (
              <>
                <Button variant="outlined" color="error" size="small" onClick={cancelEditStock} startIcon={<CloseIcon />}>Cancelar</Button>
                <Button variant="contained" color="success" size="small" onClick={handleSaveStock} startIcon={<SaveIcon />} disabled={savingStock}>
                  {savingStock ? 'Guardando...' : 'Guardar'}
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Tabla — sin columna Estado, las filas tienen color + borde lateral + icono */}
        <Card sx={{ mb: 3, overflowX: 'auto', borderRadius: 2 }}>
          <CardContent sx={{ p: 1 }}>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...headCell, minWidth: 220 }}>Producto</TableCell>
                    <TableCell sx={{ ...headCell, textAlign: 'right', minWidth: 130 }}>Cant. en Almacen</TableCell>
                    <TableCell sx={{ ...headCell, textAlign: 'right', minWidth: 100 }}>En Islas</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {islandInventoryData.map((row) => {
                    const status = getStatus(row.generalQty);
                    const sc = STATUS_COLORS[status];
                    const StatusIcon = sc.icon;

                    return (
                      <TableRow
                        key={row.productName}
                        hover
                        sx={{
                          borderLeft: `4px solid ${sc.border}`,
                          bgcolor: sc.bg,
                          '&:hover': { bgcolor: `${sc.bg}cc` },
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        <TableCell sx={{ ...bodyCell, fontWeight: 600, bgcolor: 'transparent' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <StatusIcon sx={{ fontSize: 18, color: sc.border }} />
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, color: sc.text }}
                            >
                              {row.productName}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: 'right', fontWeight: 700, bgcolor: 'transparent', color: sc.text }}>
                          {editingStock && editStock ? (
                            <TextField
                              type="number"
                              variant="standard"
                              value={editStock[row.productName] ?? 0}
                              onChange={(e) => setEditStock({ ...editStock, [row.productName]: parseInt(e.target.value) || 0 })}
                              sx={{ width: 65, '& input': { textAlign: 'right', fontSize: '0.85rem', fontWeight: 700 } }}
                              inputProps={{ min: 0 }}
                            />
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 700, color: sc.text }}>
                              {row.generalQty}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: 'right', fontWeight: 600, bgcolor: 'transparent' }}>
                          {row.totalEnIslas}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Total */}
                  <TableRow>
                    <TableCell sx={resumenCell}>Total</TableCell>
                    <TableCell sx={{ ...resumenCell, textAlign: 'right' }}>{totals.totalGeneralUnits}</TableCell>
                    <TableCell sx={{ ...resumenCell, textAlign: 'right' }}>{totals.totalDistributed}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Resumen */}
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Card sx={{ borderLeft: '4px solid', borderColor: 'primary.main', borderRadius: 2 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Productos Activos</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{activeProducts.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ borderLeft: '4px solid', borderColor: 'primary.main', borderRadius: 2 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Unidades en Almacen</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>{totals.totalGeneralUnits}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ borderLeft: '4px solid', borderColor: 'info.main', borderRadius: 2 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Distribuidas a Islas</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>{totals.totalDistributed}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{
              borderLeft: '4px solid',
              borderColor: alertGeneral.critical.length > 0 ? STATUS_COLORS.critical.border : STATUS_COLORS.normal.border,
              borderRadius: 2,
            }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Alertas</Typography>
                <Typography variant="h5" sx={{
                  fontWeight: 700,
                  color: alertGeneral.critical.length > 0 ? STATUS_COLORS.critical.text : STATUS_COLORS.normal.text,
                }}>
                  {alertGeneral.critical.length + alertGeneral.low.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ══════════════════════════════════════════════
          TAB 1 — INVENTARIO POR ISLA
          ══════════════════════════════════════════════ */}
      <TabPanel value={tab} index={1}>
        <Legend />

        {/* Botones con badges de alerta */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <AlertBadge count={alertIslands.critical.length} severity="error" label="agotados" />
            <AlertBadge count={alertIslands.low.length} severity="warning" label="stock bajo" />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" size="small" startIcon={<SwapHorizIcon />} onClick={() => { setDlgDistribute(true); setDlgDistProduct(''); setDlgDistIsland(''); setDlgDistQty(''); }}>
              Distribuir
            </Button>
            <Button variant="outlined" size="small" startIcon={<UndoIcon />} onClick={() => { setDlgReturn(true); setDlgRetProduct(''); setDlgRetIsland(''); setDlgRetQty(''); }}>
              Retornar
            </Button>
            {!editingIslandStock ? (
              <Button variant="outlined" size="small" onClick={startEditIslandStock}>Editar Stock Isla</Button>
            ) : (
              <>
                <Button variant="outlined" color="error" size="small" onClick={cancelEditIslandStock} startIcon={<CloseIcon />}>Cancelar</Button>
                <Button variant="contained" color="success" size="small" onClick={handleSaveIslandStock} startIcon={<SaveIcon />} disabled={savingIsland}>
                  {savingIsland ? 'Guardando...' : 'Guardar'}
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Tabla por isla */}
        <Card sx={{ mb: 3, overflowX: 'auto', borderRadius: 2 }}>
          <CardContent sx={{ p: 1 }}>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...headCell, minWidth: 180, position: 'sticky', left: 0, zIndex: 3 }}>Producto</TableCell>
                    {islandIds.map((id) => (
                      <React.Fragment key={id}>
                        <TableCell sx={{ ...headCell, textAlign: 'center', bgcolor: '#37474F', color: '#fff', minWidth: 90 }} colSpan={3}>
                          {ISLAND_LABELS[id]}
                        </TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                  {/* Sub-encabezados */}
                  <TableRow>
                    <TableCell sx={{ ...headCell, position: 'sticky', left: 0, zIndex: 2, bgcolor: '#546E7A' }} />
                    {islandIds.map((id) => (
                      <React.Fragment key={id}>
                        <TableCell sx={{ ...headCell, textAlign: 'right', minWidth: 80, bgcolor: '#546E7A', fontSize: '0.7rem' }}>En Isla</TableCell>
                        <TableCell sx={{ ...headCell, textAlign: 'right', minWidth: 80, bgcolor: '#546E7A', fontSize: '0.7rem' }}>
                          {hasActiveShift ? 'Vendido' : '—'}
                        </TableCell>
                        <TableCell sx={{ ...headCell, textAlign: 'right', minWidth: 80, bgcolor: '#546E7A', fontSize: '0.7rem' }}>
                          {hasActiveShift ? 'Quedan' : 'Stock'}
                        </TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {islandInventoryData.map((row) => {
                    let worstStatus = 'empty';
                    islandIds.forEach((id) => {
                      const d = row.perIsland[id];
                      const s = getStatusForIsland(d.islStock, d.quedan);
                      if (s === 'critical') worstStatus = 'critical';
                      else if (s === 'low' && worstStatus !== 'critical') worstStatus = 'low';
                      else if (s === 'normal' && worstStatus === 'empty') worstStatus = 'normal';
                    });

                    const sc = STATUS_COLORS[worstStatus];
                    const RowIcon = sc.icon;

                    return (
                      <TableRow
                        key={row.productName}
                        hover
                        sx={{
                          borderLeft: `4px solid ${sc.border}`,
                          '&:hover': { bgcolor: `${sc.bg}44` },
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        <TableCell sx={{ ...bodyCell, fontWeight: 600, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <RowIcon sx={{ fontSize: 16, color: sc.border }} />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: sc.text }}>{row.productName}</Typography>
                          </Box>
                        </TableCell>
                        {islandIds.map((id) => {
                          const d = row.perIsland[id];
                          const displayStock = editingIslandStock && editIslandStock
                            ? (editIslandStock[String(id)]?.[row.productName] ?? 0)
                            : d.islStock;

                          const cellStatus = getStatusForIsland(d.islStock, d.quedan);
                          const cellSc = STATUS_COLORS[cellStatus];
                          const isTracked = d.islStock > 0;
                          const quedanDisplay = hasActiveShift ? d.quedan : (d.islStock > 0 ? d.islStock : '');

                          return (
                            <React.Fragment key={id}>
                              <TableCell sx={{
                                ...bodyCell, textAlign: 'right', color: 'info.main', fontWeight: 600,
                                bgcolor: isTracked ? cellSc.bg : 'transparent',
                              }}>
                                {editingIslandStock && editIslandStock ? (
                                  <TextField
                                    type="number"
                                    variant="standard"
                                    value={displayStock}
                                    onChange={(e) => {
                                      const updated = JSON.parse(JSON.stringify(editIslandStock));
                                      if (!updated[String(id)]) updated[String(id)] = {};
                                      updated[String(id)][row.productName] = parseInt(e.target.value) || 0;
                                      setEditIslandStock(updated);
                                    }}
                                    sx={{ width: 50, '& input': { textAlign: 'right', fontSize: '0.85rem' } }}
                                    inputProps={{ min: 0 }}
                                  />
                                ) : (
                                  d.islStock || ''
                                )}
                              </TableCell>
                              <TableCell sx={{
                                ...bodyCell, textAlign: 'right',
                                color: hasActiveShift && d.sold > 0 ? 'success.main' : 'text.disabled',
                                fontWeight: hasActiveShift && d.sold > 0 ? 700 : 400,
                                bgcolor: isTracked ? cellSc.bg : 'transparent',
                              }}>
                                {hasActiveShift ? (d.sold || '') : '—'}
                              </TableCell>
                              <TableCell sx={{
                                ...bodyCell, textAlign: 'right', fontWeight: 800,
                                color: cellSc.text,
                                bgcolor: isTracked ? cellSc.cell : 'transparent',
                                borderBottom: isTracked ? `2px solid ${cellSc.border}` : undefined,
                              }}>
                                {quedanDisplay}
                              </TableCell>
                            </React.Fragment>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                  {/* Total */}
                  <TableRow>
                    <TableCell sx={resumenCell}>Total</TableCell>
                    {islandIds.map((id) => {
                      let islandStockTotal = 0;
                      let islandSoldTotal = 0;
                      let islandRemaining = 0;
                      islandInventoryData.forEach((r) => {
                        islandStockTotal += r.perIsland[id].islStock;
                        islandSoldTotal += r.perIsland[id].sold;
                        islandRemaining += r.perIsland[id].quedan;
                      });
                      return (
                        <React.Fragment key={id}>
                          <TableCell sx={{ ...resumenCell, textAlign: 'right' }}>{islandStockTotal}</TableCell>
                          <TableCell sx={{ ...resumenCell, textAlign: 'right' }}>
                            {hasActiveShift ? islandSoldTotal : '—'}
                          </TableCell>
                          <TableCell sx={{
                            ...resumenCell, textAlign: 'right',
                            color: islandRemaining <= STOCK_CRITICAL ? STATUS_COLORS.critical.text : '#fff',
                            bgcolor: islandRemaining <= STOCK_CRITICAL ? STATUS_COLORS.critical.cell : undefined,
                          }}>
                            {hasActiveShift ? islandRemaining : islandStockTotal}
                          </TableCell>
                        </React.Fragment>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Resumen por Isla */}
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Card sx={{ borderLeft: '4px solid', borderColor: 'info.main', borderRadius: 2 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Distribuidas a Islas</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>{totals.totalDistributed}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ borderLeft: '4px solid', borderColor: hasActiveShift ? 'success.main' : 'grey.400', borderRadius: 2 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {hasActiveShift ? 'Vendidas en Turno' : 'Ventas (con turno)'}
                </Typography>
                <Typography variant="h5" sx={{
                  fontWeight: 700,
                  color: hasActiveShift ? 'success.main' : 'text.disabled',
                }}>
                  {hasActiveShift ? totals.totalSold : '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{
              borderLeft: '4px solid',
              borderColor: (hasActiveShift && totals.totalRemaining < 0) ? STATUS_COLORS.critical.border : 'primary.main',
              borderRadius: 2,
            }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {hasActiveShift ? 'Quedan en Islas' : 'Stock Total en Islas'}
                </Typography>
                <Typography variant="h5" sx={{
                  fontWeight: 700,
                  color: (hasActiveShift && totals.totalRemaining < 0) ? STATUS_COLORS.critical.text : 'primary.main',
                }}>
                  {hasActiveShift ? totals.totalRemaining : totals.totalDistributed}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{
              borderLeft: '4px solid',
              borderColor: alertIslands.critical.length > 0 ? STATUS_COLORS.critical.border : STATUS_COLORS.normal.border,
              borderRadius: 2,
            }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Alertas</Typography>
                <Typography variant="h5" sx={{
                  fontWeight: 700,
                  color: alertIslands.critical.length > 0 ? STATUS_COLORS.critical.text : STATUS_COLORS.normal.text,
                }}>
                  {alertIslands.critical.length + alertIslands.low.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ══════════════════════════════════════════════
          DIALOG: Agregar Stock General
          ══════════════════════════════════════════════ */}
      <Dialog open={dlgGeneral} onClose={() => setDlgGeneral(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Agregar Stock al Almacen</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Producto</InputLabel>
            <Select value={dlgGeneralProduct} label="Producto" onChange={(e) => setDlgGeneralProduct(e.target.value)}>
              {activeProducts.map((p) => (
                <MenuItem key={p.name} value={p.name}>
                  {p.name} (Actual: {stock[p.name] || 0})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            margin="normal"
            label="Cantidad a Agregar"
            type="number"
            value={dlgGeneralQty}
            onChange={(e) => setDlgGeneralQty(e.target.value)}
            inputProps={{ min: 1 }}
            helperText={dlgGeneralProduct ? `Stock actual: ${stock[dlgGeneralProduct] || 0}` : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgGeneral(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddGeneralStock} disabled={!dlgGeneralProduct || dlgGeneralQty <= 0}>
            Agregar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════
          DIALOG: Distribuir a Isla
          ══════════════════════════════════════════════ */}
      <Dialog open={dlgDistribute} onClose={() => setDlgDistribute(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Distribuir a Isla</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Los productos se restaran del inventario general y se agregaran a la isla.
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Producto</InputLabel>
            <Select value={dlgDistProduct} label="Producto" onChange={(e) => setDlgDistProduct(e.target.value)}>
              {activeProducts.map((p) => {
                const avail = stock[p.name] || 0;
                return (
                  <MenuItem key={p.name} value={p.name} disabled={avail <= 0}>
                    {p.name} (Disponible: {avail})
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Isla</InputLabel>
            <Select value={dlgDistIsland} label="Isla" onChange={(e) => setDlgDistIsland(e.target.value)}>
              {islandIds.map((id) => (
                <MenuItem key={id} value={String(id)}>{ISLAND_LABELS[id]}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            margin="normal"
            label="Cantidad a Distribuir"
            type="number"
            value={dlgDistQty}
            onChange={(e) => setDlgDistQty(e.target.value)}
            inputProps={{ min: 1, max: dlgDistProduct ? (stock[dlgDistProduct] || 0) : 9999 }}
            helperText={
              dlgDistProduct
                ? `Disponible en almacen: ${stock[dlgDistProduct] || 0}`
                : 'Seleccione un producto primero'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgDistribute(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleDistribute} disabled={!dlgDistProduct || !dlgDistIsland || dlgDistQty <= 0}>
            Distribuir
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════
          DIALOG: Retornar a Almacen
          ══════════════════════════════════════════════ */}
      <Dialog open={dlgReturn} onClose={() => setDlgReturn(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Retornar a Almacen</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Los productos se quitaran de la isla y se devolveran al inventario general.
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Isla</InputLabel>
            <Select value={dlgRetIsland} label="Isla" onChange={(e) => { setDlgRetIsland(e.target.value); setDlgRetProduct(''); }}>
              {islandIds.map((id) => (
                <MenuItem key={id} value={String(id)}>{ISLAND_LABELS[id]}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Producto</InputLabel>
            <Select value={dlgRetProduct} label="Producto" onChange={(e) => setDlgRetProduct(e.target.value)} disabled={!dlgRetIsland}>
              {activeProducts.map((p) => {
                const iid = dlgRetIsland;
                const inIsland = islandStock[iid]?.[p.name] || 0;
                return (
                  <MenuItem key={p.name} value={p.name} disabled={inIsland <= 0}>
                    {p.name} (En isla: {inIsland})
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            margin="normal"
            label="Cantidad a Retornar"
            type="number"
            value={dlgRetQty}
            onChange={(e) => setDlgRetQty(e.target.value)}
            inputProps={{ min: 1, max: (dlgRetProduct && dlgRetIsland) ? (islandStock[dlgRetIsland]?.[dlgRetProduct] || 0) : 9999 }}
            helperText={
              dlgRetProduct && dlgRetIsland
                ? `Disponible en ${ISLAND_LABELS[parseInt(dlgRetIsland)]}: ${islandStock[dlgRetIsland]?.[dlgRetProduct] || 0}`
                : 'Seleccione isla y producto primero'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgReturn(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleReturn} disabled={!dlgRetProduct || !dlgRetIsland || dlgRetQty <= 0}>
            Retornar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}