import { columnVisibilityFeature, rowSortingFeature, tableFeatures } from "@tanstack/react-table"

// Manual/server-side sorting still needs rowSortingFeature registered for the column
// sort APIs (getCanSort, getIsSorted, getToggleSortingHandler, toggleSorting) even
// though sortedRowModel is never used. columnVisibilityFeature is needed for
// getVisibleCells/getVisibleLeafColumns, used for rendering even without visibility toggling.
export const studentsTableFeatures = tableFeatures({ rowSortingFeature, columnVisibilityFeature })
export type StudentsTableFeatures = typeof studentsTableFeatures
