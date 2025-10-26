/**
 * Input Validation Utilities
 * Provides reusable validation functions with consistent error messages
 */

import { ValidationError } from './errors';

/**
 * Validates that a string is not empty
 */
export function validateRequired(value: any, fieldName: string): string {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new ValidationError(`${fieldName} is required`);
  }
  return String(value).trim();
}

/**
 * Validates email format
 */
export function validateEmail(email: string): string {
  const trimmed = validateRequired(email, 'Email');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    throw new ValidationError('Invalid email format');
  }

  return trimmed;
}

/**
 * Validates string length
 */
export function validateLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): string {
  const trimmed = validateRequired(value, fieldName);

  if (min !== undefined && trimmed.length < min) {
    throw new ValidationError(`${fieldName} must be at least ${min} characters`);
  }

  if (max !== undefined && trimmed.length > max) {
    throw new ValidationError(`${fieldName} must be at most ${max} characters`);
  }

  return trimmed;
}

/**
 * Validates that a value is a valid UUID
 */
export function validateUUID(value: string, fieldName: string = 'ID'): string {
  const trimmed = validateRequired(value, fieldName);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(trimmed)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }

  return trimmed;
}

/**
 * Validates that a value is a number within range
 */
export function validateNumber(
  value: any,
  fieldName: string,
  min?: number,
  max?: number
): number {
  const num = Number(value);

  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a valid number`);
  }

  if (min !== undefined && num < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }

  if (max !== undefined && num > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`);
  }

  return num;
}

/**
 * Validates that a value is one of the allowed values
 */
export function validateEnum<T extends string>(
  value: any,
  fieldName: string,
  allowedValues: readonly T[]
): T {
  const trimmed = validateRequired(value, fieldName);

  if (!allowedValues.includes(trimmed as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    );
  }

  return trimmed as T;
}

/**
 * Validates that a value is a boolean
 */
export function validateBoolean(value: any, fieldName: string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === '1' || value === 1) {
    return true;
  }

  if (value === 'false' || value === '0' || value === 0) {
    return false;
  }

  throw new ValidationError(`${fieldName} must be a boolean value`);
}

/**
 * Validates URL format
 */
export function validateURL(url: string, fieldName: string = 'URL'): string {
  const trimmed = validateRequired(url, fieldName);

  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}

/**
 * Validates child's age (for children's book context)
 */
export function validateChildAge(age: any): number {
  const ageNum = validateNumber(age, 'Child age', 2, 12);
  return ageNum;
}

/**
 * Validates child's name
 */
export function validateChildName(name: string): string {
  return validateLength(name, 'Child name', 1, 50);
}

/**
 * Validates array has items
 */
export function validateArray<T>(
  value: any,
  fieldName: string,
  minLength: number = 1
): T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  if (value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must contain at least ${minLength} item(s)`
    );
  }

  return value;
}

/**
 * Validates illustration style
 */
export const ILLUSTRATION_STYLES = [
  'watercolour',
  'digital-art',
  'cartoon',
  'storybook-classic',
  'modern-minimal',
] as const;

export type IllustrationStyle = typeof ILLUSTRATION_STYLES[number];

export function validateIllustrationStyle(style: any): IllustrationStyle {
  return validateEnum(style, 'Illustration style', ILLUSTRATION_STYLES);
}

/**
 * Sanitizes user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export function validatePagination(
  page?: any,
  limit?: any
): PaginationParams {
  return {
    page: page ? validateNumber(page, 'Page', 1) : 1,
    limit: limit ? validateNumber(limit, 'Limit', 1, 100) : 20,
  };
}

export default {
  validateRequired,
  validateEmail,
  validateLength,
  validateUUID,
  validateNumber,
  validateEnum,
  validateBoolean,
  validateURL,
  validateChildAge,
  validateChildName,
  validateArray,
  validateIllustrationStyle,
  sanitizeInput,
  validatePagination,
  ILLUSTRATION_STYLES,
};
