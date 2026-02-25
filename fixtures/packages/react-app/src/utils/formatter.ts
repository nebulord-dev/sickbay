// Uses moment (heavy, should use date-fns or native Intl)
import moment from 'moment';
import { validator } from './validator.js';

export function formatDate(date: Date): string {
  return moment(date).format('MMMM Do YYYY');
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Circular dep: formatter imports validator, validator imports formatter
export function formatAndValidate(value: string): string {
  if (validator.isValid(value)) {
    return value.trim().toUpperCase();
  }
  return '';
}

// Duplicated logic (same as in helpers.ts)
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
