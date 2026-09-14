import {
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table"

/** Lets a column whose cell renders React elements declare how wide its content really is. */
export interface StudentsColumnMeta {
  /** Plain-text stand-in for the rendered cell, so widths can be measured without mounting it. */
  measureValue?: (row: never) => string
  /** Width of non-text chrome the text measurement cannot see, such as an avatar or a badge. */
  measureExtraPx?: number
}

// Manual/server-side sorting still needs rowSortingFeature registered for the column
// sort APIs (getCanSort, getIsSorted, getToggleSortingHandler, toggleSorting) even
// though sortedRowModel is never used. columnVisibilityFeature is needed for
// getVisibleCells/getVisibleLeafColumns, used for rendering even without visibility toggling.
// columnSizingFeature supplies getSize/getTotalSize and the minSize clamp; columnResizingFeature
// only supplies getCanResize here, because the drag itself runs through react-aria's useMove.
export const studentsTableFeatures = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnMeta: {} as StudentsColumnMeta,
})
export type StudentsTableFeatures = typeof studentsTableFeatures
