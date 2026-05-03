// src/components/common/CurrencyInput.jsx
import React from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Box from '@mui/material/Box';

export default function CurrencyInput({
  label,
  value,
  onChange,
  currency = 'BS',
  size = 'small',
  fullWidth = true,
  disabled = false,
  sx = {},
}) {
  const symbol = currency === 'BS' ? 'Bs.' : '$';

  const handleKeyDown = (e) => {
    if (e.key === '-' || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-') {
      onChange(0);
      return;
    }
    const val = parseFloat(raw);
    if (isNaN(val)) {
      onChange(0);
      return;
    }
    onChange(Math.max(0, val));
  };

  const handleBlur = () => {
    if (isNaN(value) || value < 0) {
      onChange(0);
    }
  };

  return (
    <TextField
      label={label}
      type="number"
      value={value || ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Box component="span" sx={{ fontWeight: 600, fontSize: '0.85rem', color: currency === 'USD' ? 'success.main' : 'text.secondary' }}>
              {symbol}
            </Box>
          </InputAdornment>
        ),
      }}
      sx={sx}
      inputProps={{ inputMode: 'decimal', min: 0, style: { textAlign: 'right' } }}
    />
  );
}