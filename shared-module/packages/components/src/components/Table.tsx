"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { VisuallyHidden } from "react-aria"

export type TableAlign = "start" | "center" | "end"

export interface TableColumn<Row> {
  header: React.ReactNode
  cell: (row: Row) => React.ReactNode
  /** Applies to the header and every cell. Defaults to the reading direction. */
  align?: TableAlign
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[]
  rows: Row[]
  /**
   * Stable identity per row; keeps React from reusing the wrong row on reorder. Also emitted as
   * the row's `data-row-key`, so a test can scope to one row.
   */
  rowKey: (row: Row, index: number) => React.Key
  /** Names the table for assistive tech; visually hidden unless `showCaption`. */
  caption: React.ReactNode
  showCaption?: boolean
  className?: string
  "data-testid"?: string | undefined
}

const scrollCss = css`
  overflow-x: auto;
`

// 15px rather than a type-scale step: matches the completion tables this replaces.
const tableCss = css`
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
`

const captionCss = css`
  text-align: start;
  padding-bottom: var(--space-3);
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

const cellCss = css`
  text-align: start;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--color-clear-300);
  vertical-align: top;
`

const headerCellCss = css`
  color: var(--color-gray-500);
  font-weight: 600;
  white-space: nowrap;
`

const bodyCellCss = css`
  color: var(--color-gray-700);
  font-variant-numeric: tabular-nums;
`

const alignCss: Record<TableAlign, string> = {
  start: css`
    text-align: start;
  `,
  center: css`
    text-align: center;
  `,
  end: css`
    text-align: end;
  `,
}

/** Presentational only: sorting, paging and fetching belong outside. */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  caption,
  showCaption = false,
  className,
  "data-testid": dataTestId,
}: TableProps<Row>) {
  const alignFor = (column: TableColumn<Row>) => (column.align ? alignCss[column.align] : undefined)

  return (
    <div className={cx(scrollCss, className)} data-testid={dataTestId}>
      <table className={tableCss}>
        {showCaption ? (
          <caption className={captionCss}>{caption}</caption>
        ) : (
          // oxlint-disable-next-line i18next/no-literal-string -- element name, not user-facing text
          <VisuallyHidden elementType="caption">{caption}</VisuallyHidden>
        )}
        <thead>
          <tr>
            {columns.map((column, columnIndex) => (
              <th
                key={columnIndex}
                scope="col"
                className={cx(cellCss, headerCellCss, alignFor(column))}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const key = rowKey(row, rowIndex)
            return (
              <tr key={key} data-row-key={String(key)}>
                {columns.map((column, columnIndex) => (
                  <td key={columnIndex} className={cx(cellCss, bodyCellCss, alignFor(column))}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
