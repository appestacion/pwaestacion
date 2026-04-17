// src/pages/admin/Usuarios.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import KeyIcon from '@mui/icons-material/Key';
import useStore from '../../store/useStore.js';
import { enqueueSnackbar } from 'notistack';

export default function Usuarios() {
  const getAllUsers = useStore((state) => state.getAllUsers);
  const createUser = useStore((state) => state.createUser);
  const updateUser = useStore((state) => state.updateUser);
  const deleteUser = useStore((state) => state.deleteUser);
  const sendPasswordReset = useStore((state) => state.sendPasswordReset);

  const [users, setUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'supervisor' });
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await getAllUsers();
      const arr = Array.isArray(data) ? data : [];
      const sorted = [...arr].sort((a, b) => {
        if (a.role === 'administrador' && b.role !== 'administrador') return -1;
        if (a.role !== 'administrador' && b.role === 'administrador') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setUsers(sorted);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setUsers([]);
    }
  }, [getAllUsers]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleOpenNew = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: 'supervisor' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setForm({ name: user.name || '', email: user.email || '', password: '', role: user.role });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) {
      enqueueSnackbar('Nombre y correo electronico son requeridos', { variant: 'error' });
      return;
    }
    if (!editingUser && !form.password) {
      enqueueSnackbar('La contrasena es requerida para nuevos usuarios', { variant: 'error' });
      return;
    }
    if (!editingUser && form.password.length < 6) {
      enqueueSnackbar('La contrasena debe tener al menos 6 caracteres', { variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: form.name,
          role: form.role,
        });
        enqueueSnackbar('Usuario actualizado', { variant: 'success' });
      } else {
        await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          active: true,
        });
        enqueueSnackbar('Usuario creado exitosamente', { variant: 'success' });
      }

      setDialogOpen(false);
      loadUsers();
    } catch (err) {
      enqueueSnackbar(err.message || 'Error al guardar usuario', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { active: !user.active });
      enqueueSnackbar(`Usuario ${user.active ? 'desactivado' : 'activado'}`, { variant: 'info' });
      loadUsers();
    } catch (err) {
      enqueueSnackbar(err.message || 'Error al cambiar estado', { variant: 'error' });
    }
  };

  const handleDelete = async (user) => {
    if (user.email === 'admin@pdv-smf.com') {
      enqueueSnackbar('No se puede eliminar el administrador principal', { variant: 'error' });
      return;
    }
    try {
      await deleteUser(user.id);
      enqueueSnackbar('Usuario eliminado', { variant: 'success' });
      loadUsers();
    } catch (err) {
      enqueueSnackbar(err.message || 'Error al eliminar usuario', { variant: 'error' });
    }
  };

  const handleResetPassword = async (user) => {
    try {
      await sendPasswordReset(user.email);
      enqueueSnackbar(`Correo de recuperacion enviado a ${user.email}`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Error al enviar correo', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Gestion de Usuarios</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {users.filter(u => u.active).length} activos de {users.length} totales
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={handleOpenNew}>
          Nuevo Usuario
        </Button>
      </Box>

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Correo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Rol</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id || user.uid} hover sx={{ opacity: user.active !== false ? 1 : 0.5 }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 32, height: 32, borderRadius: '8px',
                          bgcolor: user.role === 'administrador' ? '#CE112615' : '#00339915',
                          color: user.role === 'administrador' ? '#CE1126' : '#003399',
                        }}>
                          {user.role === 'administrador'
                            ? <AdminPanelSettingsIcon sx={{ fontSize: 18 }} />
                            : <SupervisorAccountIcon sx={{ fontSize: 18 }} />}
                        </Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {user.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role === 'administrador' ? 'Admin' : 'Supervisor'}
                        color={user.role === 'administrador' ? 'error' : 'info'}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={user.active !== false}
                        onChange={() => handleToggleActive(user)}
                        color="success"
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Enviar correo de recuperacion de contrasena">
                        <IconButton size="small" onClick={() => handleResetPassword(user)} color="warning">
                          <KeyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={() => handleOpenEdit(user)} color="primary">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(user)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No hay usuarios registrados
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre Completo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Correo Electronico"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={!!editingUser}
                helperText={editingUser ? 'El correo no se puede cambiar' : ''}
              />
            </Grid>
            {!editingUser && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Contrasena (minimo 6 caracteres)"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={form.role}
                  label="Rol"
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <MenuItem value="supervisor">Supervisor</MenuItem>
                  <MenuItem value="administrador">Administrador</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={loading}>
            {loading ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}