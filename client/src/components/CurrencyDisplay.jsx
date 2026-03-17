import React from 'react';

export default function CurrencyDisplay({ value, className = '' }) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return <span className={className}>{formatted}</span>;
}

export function formatGBP(value) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
