import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useStore from '../store/useStore.js';

export default function ProtectedRoute() {
  const user = useStore((state) => state.user);
  const loading = useStore((state) => state.loading);

  if (loading) {
    return null; // App.jsx shows the loading spinner
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
