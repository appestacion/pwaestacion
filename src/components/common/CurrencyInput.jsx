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
      onChange={(e) => {
        const val = parseFloat(e.target.value) || 0;
        onChange(val);
      }}
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
      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
    />
  );
}
