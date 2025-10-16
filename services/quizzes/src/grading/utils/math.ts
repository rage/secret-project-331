/**
 * Safe division that handles divide-by-zero cases
 * @param numerator - The numerator
 * @param denominator - The denominator
 * @param fallback - Value to return when denominator is 0 (default: 0)
 * @returns The result of division or fallback value
 */
export const safeDivide = (numerator: number, denominator: number, fallback = 0): number => {
  return denominator === 0 ? fallback : numerator / denominator
}

/**
 * Clamps a value between 0 and 1
 * @param value - The value to clamp
 * @returns The clamped value
 */
export const clamp01 = (value: number): number => {
  return Math.max(0, Math.min(1, value))
}

/**
 * Checks if a value is a valid finite number
 * @param value - The value to check
 * @returns True if the value is a valid finite number
 */
export const isValidNumber = (value: number): boolean => {
  return Number.isFinite(value) && !Number.isNaN(value)
}
