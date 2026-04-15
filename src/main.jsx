import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';
import App from './App.jsx';
import theme from './theme/theme.js';
import useStore from './store/useStore.js';
import './index.css';

// AuthProvider - patrón ondelivery (onAuthStateChanged)
const AuthProvider = ({ children }) => {
  const initAuth = useStore((state) => state.initAuth);
  const loading = useStore((state) => state.loading);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return children;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} autoHideDuration={3000}>
            <App />
          </SnackbarProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
