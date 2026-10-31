/**
 * Textile Industry & Financial Currency Formatters
 */

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatLakhs = (amount: number): string => {
  const lakhs = amount / 100000;
  return `₹ ${lakhs.toFixed(2)} Lakhs`;
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};

export const formatMetres = (metres: number): string => {
  return `${new Intl.NumberFormat('en-IN').format(metres)} m`;
};

