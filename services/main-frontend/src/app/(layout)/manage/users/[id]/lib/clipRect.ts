export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Intersection of `rect` with `bounds`, or null when they don't overlap. Stands in for
 * echarts.graphic.clipRectByRect so custom-series bars stay inside the grid when zoomed, without a
 * runtime echarts import (keeps echarts lazy-loaded via the wrapper).
 */
export function clipRect(rect: Rect, bounds: Rect): Rect | null {
  const x1 = Math.max(rect.x, bounds.x)
  const y1 = Math.max(rect.y, bounds.y)
  const x2 = Math.min(rect.x + rect.width, bounds.x + bounds.width)
  const y2 = Math.min(rect.y + rect.height, bounds.y + bounds.height)
  if (x2 <= x1 || y2 <= y1) {
    return null
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}
