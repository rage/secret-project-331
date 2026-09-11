"use client"

import { css, cx } from "@emotion/css"
import React, { useEffect, useId, useRef, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import {
  checkableInputCss,
  checkboxMarkCss,
  choiceMarkCss,
  choiceMarkVisibleCss,
  indeterminateMarkCss,
  resolveChoiceIndicatorCss,
} from "./primitives/checkableStyles"
import { ChevronIcon } from "./primitives/ChevronIcon"
import {
  alignCss,
  bodyCellCss,
  captionCss,
  cellCompactCss,
  cellCss,
  checkboxShellCss,
  CONTROL_COLUMN_WIDTH,
  controlCellCss,
  controlColumnWidthCss,
  detailCellCss,
  emptyStateCellCss,
  expandButtonCss,
  expandIconCss,
  expandLabelCss,
  frameCss,
  growFixedCss,
  headerCellCss,
  nowrapCss,
  overflowMaskCss,
  overflowMaskEndCss,
  overflowMaskStartCss,
  overflowMaskVisibleCss,
  rowHoverCss,
  scrollCss,
  sortButtonCss,
  sortIndicatorCss,
  stackCss,
  stackLabelCss,
  stackValueCss,
  stickyCellCss,
  stickyCellScrolledCss,
  stickyOffsetCss,
  tableCompactCss,
  tableCss,
  tableFixedCss,
  wrapCss,
} from "./primitives/tableStyles"

export type TableAlign = "start" | "center" | "end"

/** `compact` trades padding and one type step for rows; use it for logs and operator tables. */
export type TableDensity = "comfortable" | "compact"

export type TableSortDirection = "ascending" | "descending"

/** `stack` turns each row into a labelled list on a narrow screen instead of scrolling sideways. */
export type TableResponsive = "stack"

const CHECKBOX_SIZE = "md" as const
const CHECKBOX_SHAPE = "checkbox" as const
const CHEVRON_RIGHT = "right" as const
const SPAN_ELEMENT = "span" as const

export interface TableColumn<Row> {
  header: React.ReactNode
  cell: (row: Row) => React.ReactNode
  /** Applies to the header and every cell. Defaults to the reading direction. */
  align?: TableAlign
  /**
   * The column's width, as a CSS length; a number is pixels. Giving any column a width switches
   * the whole table to `table-layout: fixed`, where the columns without one share what is left
   * and `minWidth` no longer applies.
   */
  width?: string | number
  /**
   * The column's lower bound, as a CSS length; a number is pixels. Ignored once any column sets
   * `width`, because a fixed layout takes its widths from the columns alone.
   */
  minWidth?: string | number
  /**
   * This column's share of the table's width, as a weight against the other growing columns:
   * `true` counts as `1`, so one growing column takes all the slack while `grow: 2` beside
   * `grow: 1` splits it two to one. Belongs on the columns whose content deserves the room — a
   * name or a title — and never on a column that also sets `width`, which wins outright.
   */
  grow?: boolean | number
  /**
   * Keeps the column on one line. Left unset, the header stays on one line and the cells wrap,
   * which holds the column at least as wide as its own label; pass `false` where a wide label
   * should wrap so the column can be narrower than it.
   */
  nowrap?: boolean
  /**
   * Turns the header into a button and shows a sort indicator. Called with the direction the
   * press asks for, which is the opposite of `sortDirection` once this column is the sorted one.
   * Sorting itself belongs to the caller.
   */
  onSort?: (nextDirection: TableSortDirection) => void
  /** How this column is currently sorted. At most one column should be anything but `null`. */
  sortDirection?: TableSortDirection | null
}

export interface TableSelection<Row> {
  /**
   * The picked rows, keyed by `String(rowKey(row, index))`. Rows outside the page keep their
   * state through a select-all, which only ever adds or drops the keys on screen.
   */
  selectedKeys: Iterable<string>
  onChange: (selectedKeys: Set<string>) => void
  /** Rows that cannot be picked. Their box is disabled and select-all passes over them. */
  isRowSelectable?: (row: Row) => boolean
  /** Accessible name for the header checkbox. Defaults to a shared-module string. */
  selectAllLabel?: string
  /** Accessible name for one row's checkbox, so it can name the row rather than "Select row". */
  rowLabel?: (row: Row) => string
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[]
  rows: Row[]
  /** Stable identity per row; keeps React from reusing the wrong row on reorder. */
  rowKey: (row: Row, index: number) => React.Key
  /** Names the table for assistive tech; visually hidden unless `showCaption`. */
  caption: React.ReactNode
  showCaption?: boolean
  density?: TableDensity
  /**
   * Fills the body with this when there are no rows. Defaults to a translated line, so a
   * forgotten prop still says something; pass `null` for headers alone.
   */
  emptyState?: React.ReactNode
  /** Fades the edge a scrollable table runs off, so a clipped column is visible as clipped. */
  overflowCue?: boolean
  /** Pins the leading column while the rest scrolls under it, checkbox and toggle included. */
  stickyFirstColumn?: boolean
  responsive?: TableResponsive
  rowHover?: boolean
  /**
   * Extra detail for one row, revealed by a toggle in a leading column. Return `null` for a row
   * with nothing to reveal and it gets no toggle. `Table` owns which rows are open.
   */
  expandableRow?: (row: Row) => React.ReactNode
  /** Adds a leading checkbox column. Controlled: hand it the picked keys and handle the change. */
  selection?: TableSelection<Row>
  className?: string
}

function cssLength(value: string | number): string {
  return typeof value === "number" ? `${value}px` : value
}

function widthCss(width: string) {
  return css`
    width: ${width};
  `
}

function minWidthCss(minWidth: string | number) {
  return css`
    min-width: ${cssLength(minWidth)};
  `
}

function growWeightOf<Row>(column: TableColumn<Row>): number {
  if (column.width !== undefined || column.grow === undefined || column.grow === false) {
    return 0
  }
  return column.grow === true ? 1 : Math.max(column.grow, 0)
}

function alignFor<Row>(column: TableColumn<Row>): string | undefined {
  return column.align === undefined ? undefined : alignCss[column.align]
}

function wrapFor<Row>(column: TableColumn<Row>): string | undefined {
  if (column.nowrap === undefined) {
    return undefined
  }
  return column.nowrap ? nowrapCss : wrapCss
}

/** Header content for a sortable column: a press target plus the direction it is sorted in. */
function renderSortableHeader<Row>(
  column: TableColumn<Row> & { onSort: (nextDirection: TableSortDirection) => void },
): React.ReactNode {
  const { onSort, sortDirection } = column
  return (
    <button
      className={sortButtonCss}
      onClick={() => onSort(sortDirection === "ascending" ? "descending" : "ascending")}
      type="button"
    >
      <span>{column.header}</span>
      <span
        aria-hidden="true"
        className={sortIndicatorCss}
        data-direction={sortDirection ?? undefined}
      />
    </button>
  )
}

function stickyOffsetFor(precedingControlColumns: number): string {
  return precedingControlColumns === 0
    ? "0"
    : `calc(${CONTROL_COLUMN_WIDTH} * ${precedingControlColumns})`
}

function TableCheckbox({
  isChecked,
  isDisabled = false,
  isIndeterminate = false,
  label,
  onChange,
}: {
  isChecked: boolean
  isDisabled?: boolean
  isIndeterminate?: boolean
  label: string
  onChange: (isChecked: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current !== null) {
      inputRef.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])

  return (
    // The indicator below is positioned, so it paints over the transparent input and eats the
    // click; a label ancestor is what forwards that click to the input.
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- the input is the child
    <label className={checkboxShellCss} data-disabled={isDisabled ? "true" : "false"}>
      <input
        aria-label={label}
        checked={isChecked}
        className={checkableInputCss}
        disabled={isDisabled}
        onChange={(changeEvent) => onChange(changeEvent.target.checked)}
        ref={inputRef}
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className={resolveChoiceIndicatorCss(CHECKBOX_SIZE, CHECKBOX_SHAPE)}
        data-disabled={isDisabled ? "true" : "false"}
        data-indeterminate={isIndeterminate ? "true" : "false"}
        data-selected={isChecked ? "true" : "false"}
      >
        <span
          className={cx(
            choiceMarkCss,
            checkboxMarkCss,
            isChecked && !isIndeterminate && choiceMarkVisibleCss,
          )}
        />
        <span
          className={cx(
            choiceMarkCss,
            indeterminateMarkCss,
            isIndeterminate && choiceMarkVisibleCss,
          )}
        />
      </span>
    </label>
  )
}

/** Presentational only: sorting, paging and fetching belong outside. */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  caption,
  showCaption = false,
  density = "comfortable",
  emptyState,
  overflowCue = true,
  stickyFirstColumn = false,
  responsive,
  rowHover = false,
  expandableRow,
  selection,
  className,
}: TableProps<Row>) {
  const { t } = useTranslation("shared-module")
  const scrollRef = useRef<HTMLDivElement>(null)
  const detailIdPrefix = useId()
  const [expandedRowIndexes, setExpandedRowIndexes] = useState<ReadonlySet<number>>(() => new Set())
  const [overflow, setOverflow] = useState({ start: false, end: false })

  // Stacking sets `display: block` on the table parts, which drops their implicit roles in most
  // browsers, so a stacking table spells every role out. They are redundant at wide widths.
  const isStacking = responsive === "stack"
  const hasSelection = selection !== undefined
  const hasExpandable = expandableRow !== undefined
  const controlColumnCount = (hasSelection ? 1 : 0) + (hasExpandable ? 1 : 0)
  const totalColumnCount = columns.length + controlColumnCount
  const compact = density === "compact"
  const tracksOverflow = overflowCue || stickyFirstColumn

  useEffect(() => {
    const scroller = scrollRef.current
    if (!tracksOverflow || scroller === null) {
      return
    }

    const measure = () => {
      // RTL counts `scrollLeft` down from zero, so the distance from the start is its magnitude.
      const fromStart = Math.abs(scroller.scrollLeft)
      const scrollable = scroller.scrollWidth - scroller.clientWidth
      setOverflow((previous) => {
        const start = fromStart > 1
        const end = scrollable - fromStart > 1
        return previous.start === start && previous.end === end ? previous : { start, end }
      })
    }

    measure()
    scroller.addEventListener("scroll", measure, { passive: true })
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    observer?.observe(scroller)
    const table = scroller.firstElementChild
    if (table !== null) {
      observer?.observe(table)
    }

    return () => {
      scroller.removeEventListener("scroll", measure)
      observer?.disconnect()
    }
  }, [tracksOverflow])

  const isFixedLayout = columns.some((column) => column.width !== undefined)
  const growWeights = columns.map((column) => growWeightOf(column))
  const totalGrowWeight = growWeights.reduce((sum, weight) => sum + weight, 0)
  const hasUnevenGrowth = new Set(growWeights.filter((weight) => weight > 0)).size > 1
  const explicitWidths = columns.flatMap((column) =>
    column.width === undefined ? [] : [cssLength(column.width)],
  )
  const isSized = isFixedLayout || totalGrowWeight > 0 || controlColumnCount > 0

  const colFor = (column: TableColumn<Row>, columnIndex: number): string | undefined => {
    if (column.width !== undefined) {
      return widthCss(cssLength(column.width))
    }
    const weight = growWeights[columnIndex] ?? 0
    if (weight === 0) {
      return undefined
    }
    if (isFixedLayout) {
      // A fixed layout already hands the leftover to the `auto` columns in equal parts, so the
      // weights only need spelling out when they differ.
      return hasUnevenGrowth
        ? widthCss(
            `calc((100% - (${explicitWidths.join(" + ")})) * ${weight} / ${totalGrowWeight})`,
          )
        : growFixedCss
    }
    const share = Number(((weight / totalGrowWeight) * 100).toFixed(4))
    return widthCss(`${share}%`)
  }

  // One class per column rather than per cell: a long table calls this once, not once a row.
  const columnCss = columns.map((column, columnIndex) => ({
    col: colFor(column, columnIndex),
    cell: cx(
      isFixedLayout || column.minWidth === undefined ? undefined : minWidthCss(column.minWidth),
      wrapFor(column),
      alignFor(column),
    ),
  }))

  // One class per sticky position rather than per cell, for the same reason as the column classes
  // above: every row repeats the same three offsets.
  const stickyClassAt = (precedingControlColumns: number) =>
    stickyFirstColumn
      ? cx(
          stickyCellCss,
          stickyOffsetCss(stickyOffsetFor(precedingControlColumns)),
          overflow.start && stickyCellScrolledCss,
        )
      : undefined
  const stickySelectionCellCss = stickyClassAt(0)
  const stickyExpandCellCss = stickyClassAt(hasSelection ? 1 : 0)
  const stickyFirstDataCellCss = stickyClassAt(controlColumnCount)

  const baseCellCss = cx(cellCss, compact && cellCompactCss)
  const resolvedEmptyState = emptyState === undefined ? t("table.noRows") : emptyState
  const stackClass = isStacking ? stackCss : undefined

  const selectedKeys = new Set(selection?.selectedKeys ?? [])
  const selectableKeys = rows.flatMap((row, rowIndex) =>
    (selection?.isRowSelectable?.(row) ?? true) ? [String(rowKey(row, rowIndex))] : [],
  )
  const selectedHere = selectableKeys.filter((key) => selectedKeys.has(key)).length
  const areAllSelected = selectableKeys.length > 0 && selectedHere === selectableKeys.length

  const toggleAllRows = (isChecked: boolean) => {
    const next = new Set(selectedKeys)
    for (const key of selectableKeys) {
      if (isChecked) {
        next.add(key)
      } else {
        next.delete(key)
      }
    }
    selection?.onChange(next)
  }

  const toggleRow = (key: string, isChecked: boolean) => {
    const next = new Set(selectedKeys)
    if (isChecked) {
      next.add(key)
    } else {
      next.delete(key)
    }
    selection?.onChange(next)
  }

  const toggleExpanded = (rowIndex: number) => {
    setExpandedRowIndexes((previous) => {
      const next = new Set(previous)
      if (next.has(rowIndex)) {
        next.delete(rowIndex)
      } else {
        next.add(rowIndex)
      }
      return next
    })
  }

  const renderCell = (column: TableColumn<Row>, row: Row) =>
    isStacking ? (
      <>
        <span aria-hidden="true" className={stackLabelCss} data-table-stack-label="true">
          {column.header}
        </span>
        <span className={stackValueCss} data-table-stack-value="true">
          {column.cell(row)}
        </span>
      </>
    ) : (
      column.cell(row)
    )

  return (
    <div className={cx(frameCss, stackClass, className)}>
      <div className={scrollCss} ref={scrollRef}>
        <table
          className={cx(
            tableCss,
            isFixedLayout && tableFixedCss,
            compact && tableCompactCss,
            rowHover && rowHoverCss,
          )}
          role={isStacking ? "table" : undefined}
        >
          {showCaption ? (
            <caption className={captionCss}>{caption}</caption>
          ) : (
            // oxlint-disable-next-line i18next/no-literal-string -- element name, not user-facing text
            <VisuallyHidden elementType="caption">{caption}</VisuallyHidden>
          )}
          {isSized ? (
            <colgroup>
              {hasSelection ? <col className={controlColumnWidthCss} /> : null}
              {hasExpandable ? <col className={controlColumnWidthCss} /> : null}
              {columnCss.map((column, columnIndex) => (
                <col className={column.col} key={columnIndex} />
              ))}
            </colgroup>
          ) : null}
          <thead role={isStacking ? "rowgroup" : undefined}>
            <tr role={isStacking ? "row" : undefined}>
              {hasSelection ? (
                <th
                  className={cx(baseCellCss, headerCellCss, controlCellCss, stickySelectionCellCss)}
                  role={isStacking ? "columnheader" : undefined}
                  scope="col"
                >
                  <TableCheckbox
                    isChecked={areAllSelected}
                    isDisabled={selectableKeys.length === 0}
                    isIndeterminate={selectedHere > 0 && !areAllSelected}
                    label={selection.selectAllLabel ?? t("table.selectAllRows")}
                    onChange={toggleAllRows}
                  />
                </th>
              ) : null}
              {hasExpandable ? (
                <th
                  className={cx(baseCellCss, headerCellCss, controlCellCss, stickyExpandCellCss)}
                  role={isStacking ? "columnheader" : undefined}
                  scope="col"
                >
                  <VisuallyHidden elementType={SPAN_ELEMENT}>
                    {t("table.detailsColumn")}
                  </VisuallyHidden>
                </th>
              ) : null}
              {columns.map((column, columnIndex) => (
                <th
                  aria-sort={
                    column.onSort === undefined ? undefined : (column.sortDirection ?? "none")
                  }
                  className={cx(
                    baseCellCss,
                    headerCellCss,
                    columnCss[columnIndex]?.cell,
                    columnIndex === 0 ? stickyFirstDataCellCss : undefined,
                  )}
                  key={columnIndex}
                  role={isStacking ? "columnheader" : undefined}
                  scope="col"
                >
                  {column.onSort === undefined
                    ? column.header
                    : renderSortableHeader({ ...column, onSort: column.onSort })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role={isStacking ? "rowgroup" : undefined}>
            {rows.length === 0 ? (
              resolvedEmptyState === null ? null : (
                <tr role={isStacking ? "row" : undefined}>
                  <td
                    className={cx(baseCellCss, bodyCellCss, emptyStateCellCss)}
                    colSpan={totalColumnCount}
                    data-table-detail="true"
                    role={isStacking ? "cell" : undefined}
                  >
                    {resolvedEmptyState}
                  </td>
                </tr>
              )
            ) : (
              rows.map((row, rowIndex) => {
                const key = rowKey(row, rowIndex)
                const detail = expandableRow?.(row) ?? null
                const isExpanded = expandedRowIndexes.has(rowIndex)
                const detailId = `${detailIdPrefix}-${rowIndex}`

                return (
                  <React.Fragment key={key}>
                    <tr role={isStacking ? "row" : undefined}>
                      {hasSelection ? (
                        <td
                          className={cx(
                            baseCellCss,
                            bodyCellCss,
                            controlCellCss,
                            stickySelectionCellCss,
                          )}
                          data-table-control="true"
                          role={isStacking ? "cell" : undefined}
                        >
                          <TableCheckbox
                            isChecked={selectedKeys.has(String(key))}
                            isDisabled={!(selection.isRowSelectable?.(row) ?? true)}
                            label={selection.rowLabel?.(row) ?? t("table.selectRow")}
                            onChange={(isChecked) => toggleRow(String(key), isChecked)}
                          />
                        </td>
                      ) : null}
                      {hasExpandable ? (
                        <td
                          className={cx(
                            baseCellCss,
                            bodyCellCss,
                            controlCellCss,
                            stickyExpandCellCss,
                          )}
                          data-table-control="true"
                          role={isStacking ? "cell" : undefined}
                        >
                          {detail === null ? null : (
                            <button
                              aria-controls={detailId}
                              aria-expanded={isExpanded}
                              aria-label={
                                isExpanded ? t("table.collapseRow") : t("table.expandRow")
                              }
                              className={expandButtonCss}
                              data-table-expand="true"
                              onClick={() => toggleExpanded(rowIndex)}
                              type="button"
                            >
                              <span
                                className={expandIconCss}
                                data-expanded={isExpanded ? "true" : "false"}
                              >
                                <ChevronIcon direction={CHEVRON_RIGHT} />
                              </span>
                              {isStacking ? (
                                <span
                                  aria-hidden="true"
                                  className={expandLabelCss}
                                  data-table-expand-label="true"
                                >
                                  {isExpanded ? t("table.collapseRow") : t("table.expandRow")}
                                </span>
                              ) : null}
                            </button>
                          )}
                        </td>
                      ) : null}
                      {columns.map((column, columnIndex) => (
                        <td
                          className={cx(
                            baseCellCss,
                            bodyCellCss,
                            columnCss[columnIndex]?.cell,
                            columnIndex === 0 ? stickyFirstDataCellCss : undefined,
                          )}
                          key={columnIndex}
                          role={isStacking ? "cell" : undefined}
                        >
                          {renderCell(column, row)}
                        </td>
                      ))}
                    </tr>
                    {detail !== null && isExpanded ? (
                      <tr role={isStacking ? "row" : undefined}>
                        <td
                          className={cx(detailCellCss, compact && cellCompactCss)}
                          colSpan={totalColumnCount}
                          data-table-detail="true"
                          id={detailId}
                          role={isStacking ? "cell" : undefined}
                        >
                          {detail}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {overflowCue ? (
        <>
          <span
            aria-hidden="true"
            className={cx(
              overflowMaskCss,
              overflowMaskStartCss,
              overflow.start && overflowMaskVisibleCss,
            )}
          />
          <span
            aria-hidden="true"
            className={cx(
              overflowMaskCss,
              overflowMaskEndCss,
              overflow.end && overflowMaskVisibleCss,
            )}
          />
        </>
      ) : null}
    </div>
  )
}
