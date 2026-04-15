import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#CE1126',
      light: '#E84855',
      dark: '#9E0D1E',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#003399',
      light: '#3366CC',
      dark: '#002266',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#FFD100',
      light: '#FFE066',
      dark: '#CCB000',
      contrastText: '#1A1A2E',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A2E',
      secondary: '#4A4A68',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
        containedPrimary: {
          boxShadow: '0 2px 8px rgba(206, 17, 38, 0.3)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(206, 17, 38, 0.4)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#F8F8FA',
        },
      },
    },
  },
});

export default theme;
