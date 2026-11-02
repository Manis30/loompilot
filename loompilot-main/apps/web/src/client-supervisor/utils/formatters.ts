/**
 * Textile Industry & Financial Currency Formatters
 */

export const formatCurrency = (amount: number | undefined | null): string => {
  const val = Number(amount);
  if (isNaN(val)) return '₹ 0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const formatLakhs = (amount: number | undefined | null): string => {
  const val = Number(amount);
  if (isNaN(val)) return '₹ 0.00 Lakhs';
  const lakhs = val / 100000;
  return `₹ ${lakhs.toFixed(2)} Lakhs`;
};

export const formatNumber = (num: number | undefined | null): string => {
  const val = Number(num);
  if (isNaN(val)) return '0';
  return new Intl.NumberFormat('en-IN').format(val);
};

export const formatMetres = (metres: number | undefined | null): string => {
  const val = Number(metres);
  if (isNaN(val)) return '0 m';
  return `${new Intl.NumberFormat('en-IN').format(val)} m`;
};

