/**
 * Utility functions for date formatting
 */

/**
 * Format a date without timezone information
 * Returns a string in the format: YYYY-MM-DDTHH:mm:ss
 * This is similar to ISO format but without the timezone part
 * @param date The date to format (defaults to current date if not provided)
 * @returns A string representation of the date without timezone information
 */
export function formatDateWithoutTimezone(date: Date = new Date()): string {
  // Format: YYYY-MM-DDTHH:mm:ss
  return date.toISOString().split('.')[0];
}

/**
 * Get current timestamp without timezone information
 * @returns A string representation of the current date without timezone information
 */
export function getCurrentTimestampWithoutTimezone(): string {
  return formatDateWithoutTimezone(new Date());
}
