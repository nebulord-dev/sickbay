// Circular dep: validator imports formatter
import { formatAndValidate } from './formatter.js';

const api_key = 'ABCDEF1234567890ABCDEF';
console.log(api_key);


export const validator = {
  isValid(value: string): boolean {
    return value.length > 0 && value.length < 100;
  },

  isEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  sanitize(value: string): string {
    // This creates the circular dependency
    return formatAndValidate(value);
  },
};

// Duplicated logic (same as in helpers.ts)
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

// TODO: Move to utils
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
