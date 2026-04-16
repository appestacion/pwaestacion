// src/pages/admin/Dashboard.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import SpeedIcon from '@mui/icons-material/Speed';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import FilterListIcon from '@mui/icons-material/FilterList';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  LineChart, Line,
} from 'recharts';
import { useCierreStore } from '../../store/useCierreStore.js';
import useStore from '../../store/useStore.js';
import { useProductStore } from '../../store/useProductStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import { formatBs, formatUSD, formatNumber, getVenezuelaDateString } from '../../lib/formatters.js';
import { enqueueSnackbar } from 'notistack';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ── Color palette ──
const COLORS = {
  primary: '#CE1126',
  secondary: '#003399',
  accent: '#FFD100',
  success: '#00A651',
  purple: '#7B1FA2',
  orange: '#FF6600',
  grey: '#9E9E9E',
};

const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.accent, COLORS.purple, COLORS.orange];

const CHART_GRID = 'rgba(255,255,255,0.08)';
const CHART_TEXT = '#b0b0c0';

// ── Custom dark-theme Recharts Tooltip ──
function ChartTooltipContent({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <Box sx={{
      bgcolor: 'rgba(20,20,40,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 2,
      p: 1.5,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <Typography variant="caption" sx={{ color: '#ccc', fontWeight: 700, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {payload.map((entry, i) => (
        <Typography key={i} variant="caption" sx={{ color: entry.color, display: 'block', lineHeight: 1.6 }}>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : entry.value}</strong>
        </Typography>
      ))}
    </Box>
  );
}

// ── Animated stat card ──
function StatCard({ label, value, icon, color, subtitle, onClick }) {
  return (
    <Card elevation={0} onClick={onClick} sx={{
      background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
      border: `1px solid ${color}25`,
      borderRadius: 3,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 8px 30px ${color}30`, borderColor: `${color}50` },
    }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: '14px',
            background: `linear-gradient(135deg, ${color}25, ${color}10)`,
            color: color, '& .MuiSvgIcon-root': { fontSize: 28 },
          }}>{icon}</Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.68rem' }}>{label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, color }}>{value}</Typography>
            {subtitle && <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>{subtitle}</Typography>}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Animated chart wrapper ──
function AnimatedCard({ children, title, action }) {
  return (
    <Card elevation={0} sx={{
      background: 'linear-gradient(145deg, #1e1e38 0%, #141428 100%)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 3, overflow: 'hidden',
    }}>
      {title && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, pt: 2, pb: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#e0e0f0' }}>{title}</Typography>
          {action}
        </Box>
      )}
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>{children}</CardContent>
    </Card>
  );
}

export default function DashboardAdmin() {
  const { shiftsHistory, loadShiftsHistory } = useCierreStore();
  const getAllUsers = useStore((state) => state.getAllUsers);
  const { products, loadProducts } = useProductStore();
  const config = useConfigStore((state) => state.config);
  const chartsRef = useRef(null);

  const [tabValue, setTabValue] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [users, setUsers] = useState([]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await getAllUsers();
      const arr = Array.isArray(data) ? data : [];
      setUsers(arr);
    } catch (err) {
      console.error('Error loading users:', err);
      setUsers([]);
    }
  }, [getAllUsers]);

  useEffect(() => {
    loadShiftsHistory();
    loadProducts();
    loadUsers();
  }, [loadShiftsHistory, loadProducts, loadUsers]);

  const activeProducts = products.filter((p) => p.active);
  const closedShifts = shiftsHistory.filter((s) => s.status === 'cerrado');

  // ── Date filtering ──
  const filteredShifts = useMemo(() => {
    let shifts = closedShifts;
    if (dateFrom) shifts = shifts.filter((s) => s.date >= dateFrom);
    if (dateTo) shifts = shifts.filter((s) => s.date <= dateTo);
    return shifts;
  }, [closedShifts, dateFrom, dateTo]);

  // ── Aggregate stats ──
  const stats = useMemo(() => {
    let totalLiters = 0, totalUSD = 0, totalBs = 0, totalProductsUSD = 0;
    const islandLiters = { 1: 0, 2: 0, 3: 0 };
    const productCount = {};
    const dailyLiters = {};

    filteredShifts.forEach((shift) => {
      (shift.pumpReadings || []).forEach((r) => {
        totalLiters += r.litersSold || 0;
        islandLiters[r.islandId] = (islandLiters[r.islandId] || 0) + (r.litersSold || 0);
      });
      (shift.islands || []).forEach((isl) => {
        totalUSD += isl.pvTotalUSD || 0;
        totalBs += isl.pvTotalBs || 0;
        (isl.productsSold || []).forEach((p) => {
          const qty = p.quantity || 1;
          totalProductsUSD += qty * (p.priceUSD || 0);
          productCount[p.name] = (productCount[p.name] || 0) + qty;
        });
      });
      const d = shift.date || 'Sin fecha';
      dailyLiters[d] = (dailyLiters[d] || 0) + (shift.pumpReadings || []).reduce((sum, r) => sum + (r.litersSold || 0), 0);
    });

    return { totalLiters, totalUSD, totalBs, totalProductsUSD, islandLiters, productCount, dailyLiters };
  }, [filteredShifts]);

  // ── Chart data ──
  const islandBarData = useMemo(() =>
    Object.entries(stats.islandLiters).map(([id, liters]) => ({
      name: `Isla ${id}`, Litros: Math.round(liters),
      'USD ($)': Math.round((stats.totalUSD / Math.max(stats.totalLiters, 1)) * liters * 100) / 100,
    })), [stats]);

  const dailyAreaData = useMemo(() =>
    Object.entries(stats.dailyLiters).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
      .map(([date, liters]) => ({ date, Litros: Math.round(liters) })), [stats]);

  const productPieData = useMemo(() =>
    Object.entries(stats.productCount)
      .map(([name, count]) => ({ name: name.length > 25 ? name.substring(0, 22) + '...' : name, value: count, fullName: name }))
      .sort((a, b) => b.value - a.value).slice(0, 6), [stats]);

  const revenueLineData = useMemo(() =>
    Object.entries(stats.dailyLiters).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
      .map(([date, liters]) => ({ date, 'Ingresos (Bs)': Math.round(liters * (config.tasa1 || 50)) })), [stats, config.tasa1]);

  const shiftTypePieData = useMemo(() => {
    const counts = { DIURNO: 0, NOCTURNO: 0 };
    filteredShifts.forEach((s) => { if (s.operatorShiftType === 'DIURNO') counts.DIURNO++; else counts.NOCTURNO++; });
    return [{ name: 'Diurno', value: counts.DIURNO }, { name: 'Nocturno', value: counts.NOCTURNO }];
  }, [filteredShifts]);

  // ── PDF Export ──
  const generatePDF = useCallback(() => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const fecha = getVenezuelaDateString();

      doc.setFillColor(206, 17, 38);
      doc.rect(0, 0, 297, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('REPORTE DE ESTACION - DASHBOARD ADMINISTRATIVO', 148.5, 10, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Generado: ${fecha}  |  Tasa BCV: ${config.tasa1 || 0} Bs/$`, 148.5, 17, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text('RESUMEN GENERAL', 14, 32);

      doc.autoTable({
        startY: 35,
        head: [['Metrica', 'Valor', 'Metrica', 'Valor']],
        body: [
          ['Total Usuarios', users.length.toString(), 'Productos Activos', activeProducts.length.toString()],
          ['Turnos Cerrados (periodo)', filteredShifts.length.toString(), 'Litros Totales', formatNumber(stats.totalLiters, 0)],
          ['Ingresos Totales USD', formatUSD(stats.totalUSD), 'Ingresos Totales Bs', formatBs(stats.totalBs)],
          ['Ventas Productos USD', formatUSD(stats.totalProductsUSD), '', ''],
        ],
        theme: 'grid', headStyles: { fillColor: [206, 17, 38], textColor: 255, fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 }, alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      doc.setFontSize(11);
      doc.text('DESEMPENO POR ISLA', 14, doc.lastAutoTable.finalY + 10);
      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 13,
        head: [['Isla', 'Litros Vendidos']],
        body: Object.entries(stats.islandLiters).map(([id, liters]) => [`Isla ${id}`, formatNumber(liters, 0)]),
        theme: 'grid', headStyles: { fillColor: [0, 51, 153], textColor: 255, fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 }, alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      if (productPieData.length > 0) {
        doc.setFontSize(11);
        doc.text('PRODUCTOS MAS VENDIDOS', 14, doc.lastAutoTable.finalY + 10);
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 13,
          head: [['Producto', 'Cantidad Vendida']],
          body: productPieData.map((p) => [p.fullName || p.name, p.value.toString()]),
          theme: 'grid', headStyles: { fillColor: [0, 166, 81], textColor: 255, fontSize: 9 },
          styles: { fontSize: 8, cellPadding: 3 }, alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      if (filteredShifts.length > 0) {
        doc.setFontSize(11);
        doc.text('DETALLE DE TURNOS', 14, doc.lastAutoTable.finalY + 10);
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 13,
          head: [['Fecha', 'Turno', 'Tasa', 'Litros', 'PV USD', 'PV Bs', 'Estado']],
          body: filteredShifts.map((s) => {
            const liters = (s.pumpReadings || []).reduce((sum, r) => sum + (r.litersSold || 0), 0);
            const usd = (s.islands || []).reduce((sum, isl) => sum + (isl.pvTotalUSD || 0), 0);
            const bs = (s.islands || []).reduce((sum, isl) => sum + (isl.pvTotalBs || 0), 0);
            return [s.date || '-', s.operatorShiftType || '-', formatBs(s.tasa1 || 0), formatNumber(liters, 0), formatUSD(usd), formatBs(bs), s.status || '-'];
          }),
          theme: 'grid', headStyles: { fillColor: [206, 17, 38], textColor: 255, fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 }, alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Pagina ${i} de ${pageCount}  |  PDV Estacion de Servicio`, 148.5, 200, { align: 'center' });
      }

      doc.save(`reporte_estacion_${fecha.replace(/\//g, '-')}.pdf`);
      enqueueSnackbar({ message: 'PDF generado exitosamente', variant: 'success' });
    } catch (err) {
      console.error('PDF error:', err);
      enqueueSnackbar({ message: 'Error al generar PDF: ' + err.message, variant: 'error' });
    }
  }, [stats, users, activeProducts, filteredShifts, productPieData, config.tasa1]);

  // ── WhatsApp share ──
  const shareWhatsApp = useCallback(() => {
    const fecha = getVenezuelaDateString();
    const text = `*REPORTE DE ESTACION*\n_Fecha: ${fecha}_\n\n*RESUMEN:*\n- Turnos cerrados: ${filteredShifts.length}\n- Litros totales: ${formatNumber(stats.totalLiters, 0)} L\n- Ingresos USD: ${formatUSD(stats.totalUSD)}\n- Ingresos Bs: ${formatBs(stats.totalBs)}\n- Productos vendidos: ${formatUSD(stats.totalProductsUSD)}\n\n*POR ISLA:*\n${Object.entries(stats.islandLiters).map(([id, liters]) => `- Isla ${id}: ${formatNumber(liters, 0)} L`).join('\n')}\n\n*Tasa BCV: ${config.tasa1 || 0} Bs/$*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    enqueueSnackbar({ message: 'Abriendo WhatsApp...', variant: 'info' });
  }, [stats, filteredShifts, config.tasa1]);

  // ── Tab panel animation wrapper ──
  const chartSection = (children) => (
    <Box sx={{
      animation: 'fadeIn 0.5s ease',
      '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
    }}>{children}</Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#e0e0f0' }}>Dashboard Administrador</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Vision general del sistema con estadisticas detalladas</Typography>
      </Box>

      {/* Date filter */}
      <Card elevation={0} sx={{ mb: 2.5, background: 'linear-gradient(145deg, #1e1e38, #141428)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FilterListIcon sx={{ color: COLORS.accent, fontSize: 20 }} />
            <Typography variant="caption" sx={{ color: '#b0b0c0', fontWeight: 600 }}>FILTRAR POR FECHA:</Typography>
            <TextField size="small" type="date" label="Desde" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&:hover fieldset': { borderColor: COLORS.accent }, '&.Mui-focused fieldset': { borderColor: COLORS.accent } }, '& .MuiInputLabel-root': { color: '#888', fontSize: '0.75rem' }, maxWidth: 170 }} />
            <TextField size="small" type="date" label="Hasta" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&:hover fieldset': { borderColor: COLORS.accent }, '&.Mui-focused fieldset': { borderColor: COLORS.accent } }, '& .MuiInputLabel-root': { color: '#888', fontSize: '0.75rem' }, maxWidth: 170 }} />
            {(dateFrom || dateTo) && (
              <Button size="small" onClick={() => { setDateFrom(''); setDateTo(''); }} sx={{ color: COLORS.grey, fontSize: '0.72rem' }}>Limpiar filtro</Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard label="Usuarios" value={users.length} icon={<PeopleIcon />} color={COLORS.primary}
            subtitle={`${users.filter((u) => u.role === 'administrador').length} admins / ${users.filter((u) => u.role === 'supervisor').length} supervisores`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Productos Activos" value={activeProducts.length} icon={<CategoryIcon />} color={COLORS.secondary}
            subtitle={`de ${products.length} totales`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Litros Totales" value={formatNumber(stats.totalLiters, 0) + ' L'} icon={<LocalGasStationIcon />} color={COLORS.accent}
            subtitle={`${filteredShifts.length} turnos`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Ingresos USD" value={formatUSD(stats.totalUSD)} icon={<AttachMoneyIcon />} color={COLORS.success}
            subtitle={`+ ${formatUSD(stats.totalProductsUSD)} productos`} />
        </Grid>
      </Grid>

      {/* Secondary stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4}>
          <StatCard label="Ingresos Bolivares" value={formatBs(stats.totalBs)} icon={<TrendingUpIcon />} color={COLORS.purple}
            subtitle={`Tasa: ${config.tasa1 || 0} Bs/$`} />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard label="Turnos Cerrados" value={closedShifts.length} icon={<SpeedIcon />} color={COLORS.orange}
            subtitle={filteredShifts.length !== closedShifts.length ? `${filteredShifts.length} en periodo` : 'Total historico'} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Tasa BCV" value={`Bs. ${config.tasa1 || 0}`} icon={<TrendingUpIcon />} color={COLORS.accent}
            subtitle={config.tasa2 ? `Gasolina Premium: Bs. ${config.tasa2}` : 'Solo gasolina regular'} />
        </Grid>
      </Grid>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<FileDownloadIcon />} onClick={generatePDF}
          sx={{ background: 'linear-gradient(135deg, #CE1126, #a00d1e)', borderRadius: 2, px: 3, py: 1, fontWeight: 600, textTransform: 'none', '&:hover': { background: 'linear-gradient(135deg, #e0132a, #CE1126)' } }}>
          Exportar PDF
        </Button>
        <Button variant="contained" startIcon={<WhatsAppIcon />} onClick={shareWhatsApp}
          sx={{ background: 'linear-gradient(135deg, #25D366, #128C7E)', borderRadius: 2, px: 3, py: 1, fontWeight: 600, textTransform: 'none', '&:hover': { background: 'linear-gradient(135deg, #2ed87a, #25D366)' } }}>
          Enviar por WhatsApp
        </Button>
      </Box>

      {/* Tabs */}
      <Card elevation={0} sx={{ mb: 3, background: 'linear-gradient(145deg, #1e1e38, #141428)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}
          sx={{ px: 2, pt: 1, '& .MuiTab-root': { color: '#888', fontWeight: 600, fontSize: '0.78rem', textTransform: 'none', '&.Mui-selected': { color: COLORS.accent } }, '& .MuiTabs-indicator': { backgroundColor: COLORS.accent } }}>
          <Tab label="Ventas por Isla" />
          <Tab label="Tendencia Diaria" />
          <Tab label="Ingresos" />
          <Tab label="Productos" />
          <Tab label="Turnos" />
        </Tabs>
      </Card>

      {/* Chart panels */}
      <Box ref={chartsRef}>
        {/* Tab 0: Island bar chart + shift type pie */}
        {tabValue === 0 && chartSection(
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <AnimatedCard title="Ventas por Isla (Litros y USD)">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={islandBarData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="name" tick={{ fill: CHART_TEXT, fontSize: 12 }} />
                    <YAxis tick={{ fill: CHART_TEXT, fontSize: 11 }} />
                    <RechartsTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#ccc' }} />
                    <Bar dataKey="Litros" fill={COLORS.primary} radius={[6, 6, 0, 0]} animationDuration={1200} animationEasing="ease-out" />
                    <Bar dataKey="USD ($)" fill={COLORS.accent} radius={[6, 6, 0, 0]} animationDuration={1400} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </AnimatedCard>
            </Grid>
            <Grid item xs={12} md={4}>
              <AnimatedCard title="Distribucion por Turno">
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie data={shiftTypePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" animationDuration={1000} animationEasing="ease-out">
                      {shiftTypePieData.map((_, i) => <Cell key={i} fill={i === 0 ? COLORS.accent : COLORS.secondary} />)}
                    </Pie>
                    <RechartsTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#ccc' }} />
                  </PieChart>
                </ResponsiveContainer>
              </AnimatedCard>
            </Grid>
          </Grid>
        )}

        {/* Tab 1: Daily trend area chart */}
        {tabValue === 1 && chartSection(
          <AnimatedCard title="Tendencia de Litros Diarios (ultimos 14 dias)">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={dailyAreaData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <defs><linearGradient id="litersGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} /><stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.05} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={{ fill: CHART_TEXT, fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fill: CHART_TEXT, fontSize: 11 }} />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="Litros" stroke={COLORS.primary} strokeWidth={3} fill="url(#litersGrad)" animationDuration={1500} animationEasing="ease-out"
                  dot={{ r: 4, fill: COLORS.primary, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: COLORS.accent, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </AnimatedCard>
        )}

        {/* Tab 2: Revenue line chart */}
        {tabValue === 2 && chartSection(
          <AnimatedCard title="Ingresos Diarios en Bolivares (ultimos 14 dias)">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={revenueLineData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={{ fill: CHART_TEXT, fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fill: CHART_TEXT, fontSize: 11 }} />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="Ingresos (Bs)" stroke={COLORS.success} strokeWidth={3} animationDuration={1500} animationEasing="ease-out"
                  dot={{ r: 4, fill: COLORS.success, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7, fill: COLORS.accent, stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </AnimatedCard>
        )}

        {/* Tab 3: Products pie chart + ranking */}
        {tabValue === 3 && chartSection(
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <AnimatedCard title="Productos Mas Vendidos">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie data={productPieData} cx="50%" cy="50%" outerRadius={120} paddingAngle={3} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: '#666', strokeWidth: 1 }} animationDuration={1200} animationEasing="ease-out">
                      {productPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </AnimatedCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <AnimatedCard title="Ranking de Productos">
                <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                  {productPieData.length === 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                      <Typography variant="body2" sx={{ color: '#888' }}>Sin datos de productos vendidos</Typography>
                    </Box>
                  ) : productPieData.map((p, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.04)', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ flex: 1, color: '#ccc', fontSize: '0.8rem' }}>{p.fullName || p.name}</Typography>
                      <Chip label={`${p.value} uds`} size="small" sx={{ bgcolor: `${PIE_COLORS[i % PIE_COLORS.length]}20`, color: PIE_COLORS[i % PIE_COLORS.length], fontWeight: 700, fontSize: '0.72rem' }} />
                    </Box>
                  ))}
                </Box>
              </AnimatedCard>
            </Grid>
          </Grid>
        )}

        {/* Tab 4: Shifts table */}
        {tabValue === 4 && chartSection(
          <AnimatedCard title="Detalle de Turnos Cerrados">
            {filteredShifts.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                <Typography variant="body2" sx={{ color: '#888' }}>No hay turnos cerrados{dateFrom || dateTo ? ' en el periodo seleccionado' : ''}</Typography>
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#e0e0f0' }}>Fecha</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#e0e0f0' }}>Turno</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#e0e0f0' }} align="right">Tasa</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#e0e0f0' }} align="right">Litros</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#e0e0f0' }} align="right">PV USD</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#e0e0f0' }} align="right">PV Bs</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#e0e0f0' }} align="center">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredShifts.map((shift) => {
                      const liters = (shift.pumpReadings || []).reduce((sum, r) => sum + (r.litersSold || 0), 0);
                      const usd = (shift.islands || []).reduce((sum, isl) => sum + (isl.pvTotalUSD || 0), 0);
                      const bs = (shift.islands || []).reduce((sum, isl) => sum + (isl.pvTotalBs || 0), 0);
                      return (
                        <TableRow key={shift.id} hover>
                          <TableCell sx={{ color: '#ccc' }}>{shift.date}</TableCell>
                          <TableCell>
                            <Chip label={shift.operatorShiftType || '-'} size="small"
                              sx={{ bgcolor: shift.operatorShiftType === 'DIURNO' ? `${COLORS.accent}25` : `${COLORS.secondary}25`, color: shift.operatorShiftType === 'DIURNO' ? COLORS.accent : COLORS.secondary, fontWeight: 600, fontSize: '0.7rem' }} />
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#ccc' }}>{formatBs(shift.tasa1 || 0)}</TableCell>
                          <TableCell align="right" sx={{ color: '#ccc', fontWeight: 600 }}>{formatNumber(liters, 0)} L</TableCell>
                          <TableCell align="right" sx={{ color: COLORS.success, fontWeight: 600 }}>{formatUSD(usd)}</TableCell>
                          <TableCell align="right" sx={{ color: COLORS.accent, fontWeight: 600 }}>{formatBs(bs)}</TableCell>
                          <TableCell align="center">
                            <Chip label={shift.status === 'cerrado' ? 'Cerrado' : 'En Progreso'} size="small"
                              sx={{ bgcolor: shift.status === 'cerrado' ? `${COLORS.success}25` : `${COLORS.orange}25`, color: shift.status === 'cerrado' ? COLORS.success : COLORS.orange, fontWeight: 600, fontSize: '0.7rem' }} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </AnimatedCard>
        )}
      </Box>
    </Box>
  );
}