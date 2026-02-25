// Uses lodash (unused elsewhere, heavy import)
import _ from 'lodash';

// More duplicated truncate/capitalize logic
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function sortItems<T>(items: T[], key: keyof T): T[] {
  return _.sortBy(items, key);
}

export function groupItems<T>(items: T[], key: keyof T): Record<string, T[]> {
  return _.groupBy(items, key) as Record<string, T[]>;
}

// Dead code - never imported anywhere
export function deepClone<T>(obj: T): T {
  return _.cloneDeep(obj);
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, wait: number) {
  return _.debounce(fn, wait);
}
