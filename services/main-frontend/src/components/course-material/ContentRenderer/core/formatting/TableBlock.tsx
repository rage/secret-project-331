"use client"

import { css, cx } from "@emotion/css"
import React, { createContext, useContext, useMemo, useRef, useState } from "react"

import type { CellAttributes, Cells, TableAttributes } from "@/../types/GutenbergBlockAttributes"
import ParsedText from "@/components/course-material/ParsedText"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { type ScrollOverflow, ScrollRegion } from "@/shared-module/components"
import { richTextToPlainText } from "@/utils/course-material/richTextToPlainText"

import type { BlockRendererProps } from "../.."

interface ExtraAttributes {
  className?: string
}

const scrollContainerStyles = css`
  overflow-x: auto;
  overflow-y: hidden;
`

const scrollWrapperStyles = css`
  position: relative;
`

// Edge fades that hint the table scrolls horizontally. Shown only on the side(s) with hidden content.
const edgeShadowBaseStyles = css`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2rem;
  pointer-events: none;
`

const rightShadowStyles = css`
  right: 0;
  background: linear-gradient(to right, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.16));
`

const leftShadowStyles = css`
  left: 0;
  background: linear-gradient(to left, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.16));
`

// Valid span as a number, else undefined so the attribute is omitted (never "NaN").
const spanOf = (value: string | undefined | null): number | undefined => {
  const n = Number(value)
  return value && Number.isInteger(n) && n > 0 ? n : undefined
}

const fetchAlignment = (align: string | undefined, isNumericColumn = false) => {
  // Doubled class: must beat the table's own cell rule.
  if (align) {
    return css`
      && {
        text-align: ${align};
      }
    `
  }
  if (isNumericColumn) {
    return numericCellStyles
  }
  return undefined
}

const numericCellStyles = css`
  && {
    text-align: right;
  }
`

const NUMBER = /^[-+−]?[\d\s.,:/%€$£]*\d[\d\s.,:/%€$£]*$/

/** True inside a table box, which draws its own header colours and cell padding. */
export const TableBoxContext = createContext(false)

const hasMergedCells = (rows: Cells[]): boolean =>
  rows.some((row) =>
    row.cells?.some((cell) => (spanOf(cell.colspan) ?? 1) > 1 || (spanOf(cell.rowspan) ?? 1) > 1),
  )

/**
 * Columns whose body cells are all numbers (empty cells allowed) line up on the right. Tables with
 * merged cells get none, since a cell's index there isn't its rendered column.
 */
const numericColumns = (head: Cells[] | undefined, body: Cells[]): Set<number> => {
  const result = new Set<number>()
  if (hasMergedCells([...(head ?? []), ...body])) {
    return result
  }
  const columnCount = Math.max(0, ...body.map((row) => row.cells?.length ?? 0))
  for (let column = 0; column < columnCount; column++) {
    const values = body
      .map((row) => richTextToPlainText(row.cells?.[column]?.content ?? "").trim())
      .filter((value) => value !== "")
    if (values.length > 0 && values.every((value) => NUMBER.test(value))) {
      result.add(column)
    }
  }
  return result
}

const TableBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<TableAttributes & ExtraAttributes>>
> = ({ data, dontAllowBlockToBeWiderThanContainerWidth }) => {
  const {
    hasFixedLayout,
    caption,
    className,
    // borderColor, // Bordercolor is same as textcolor in our version of Gutenberg
    // style,
  } = data.attributes
  const body = data.attributes.body
  const head = data.attributes.head
  const foot = data.attributes.foot

  const refsMap = useRef(new Map<string, React.RefObject<HTMLElement | null>>()).current

  const getRef = (key: string) => {
    if (!refsMap.has(key)) {
      refsMap.set(key, React.createRef<HTMLElement>())
    }
    // oxlint-disable-next-line typescript/no-non-null-assertion -- key was just inserted above, so get(key) is defined
    return refsMap.get(key)!
  }

  const hasManyColumns = useMemo(() => {
    for (const row of body) {
      if (row.cells && row.cells.length > 5) {
        return true
      }
    }

    return false
  }, [body])
  const shouldUseSmallerFont = hasManyColumns && dontAllowBlockToBeWiderThanContainerWidth

  const isStriped = className === "is-style-stripes"
  const isInTableBox = useContext(TableBoxContext)
  const numericColumnIndexes = useMemo(() => numericColumns(head, body), [head, body])
  // Authors use one-cell tables as framed boxes, so those keep their frame.
  const isFramedBox =
    !head?.length && !foot?.length && body.length === 1 && body[0]?.cells?.length === 1

  const captionRef = useRef<HTMLElement>(null)

  const [canScroll, setCanScroll] = useState<ScrollOverflow>({ start: false, end: false })
  // Named by the caption when there is one.
  const captionText = caption ? richTextToPlainText(caption) : ""

  return (
    <div className={scrollWrapperStyles}>
      <ScrollRegion
        className={scrollContainerStyles}
        label={captionText || undefined}
        onOverflowChange={setCanScroll}
      >
        <table
          className={css`
            /* Textbook rules: a strong rule under the header and at the end, hairlines between rows,
               no vertical lines. As wide as its content, unless the author fixed the column widths. */
            ${hasFixedLayout && "width: 100%; table-layout: fixed;"}
            border-collapse: collapse;
            font-size: 0.9em;
            line-height: 1.5;
            td,
            th {
              white-space: pre-wrap;
              padding: 0.625rem 1rem;
              text-align: start;
              vertical-align: top;
              font-variant-numeric: tabular-nums;
              ${hasFixedLayout && "overflow-wrap: break-word;"}
            }
            /* Without row shading, the outer columns line up with the text above and below. */
            ${
              !isStriped &&
              !isFramedBox &&
              !isInTableBox &&
              `td:first-child, th:first-child { padding-left: 0; } td:last-child, th:last-child { padding-right: 0; }`
            }
            th {
              font-weight: 600;
            }
            thead th {
              vertical-align: bottom;
              ${!isInTableBox && `color: ${baseTheme.colors.gray[600]};`}
            }
            tbody tr {
              border-bottom: 1px solid ${baseTheme.colors.gray[100]};
            }
            /* stylelint-disable-next-line block-no-empty */
            tbody tr:nth-child(odd) {
              ${isStriped && `background-color: ${baseTheme.colors.gray[50]};`}
            }
            thead {
              border-bottom: 2px solid ${baseTheme.colors.gray[700]};
            }
            ${!foot?.length && `tbody tr:last-child { border-bottom: 2px solid ${baseTheme.colors.gray[700]}; }`}
            tfoot {
              border-top: 1px solid ${baseTheme.colors.gray[700]};
              border-bottom: 2px solid ${baseTheme.colors.gray[700]};
              font-weight: 600;
            }
            ${isFramedBox && `&& td, && th, && tbody tr:last-child { border: 1px solid currentColor; padding: 0.625rem 1rem; }`}

            ${shouldUseSmallerFont && `font-size: 15px;`}
          `}
        >
          {head && (
            <thead>
              {head.map((cellRows: Cells, j: number) => (
                <tr key={j}>
                  {cellRows.cells &&
                    cellRows.cells.map((cell: CellAttributes, i) => (
                      <ParsedText
                        key={i}
                        // oxlint-disable-next-line i18next/no-literal-string
                        text={cell.content !== "" ? (cell.content ?? "&#xFEFF;") : "&#xFEFF;"}
                        tag="th"
                        tagProps={{
                          // oxlint-disable-next-line i18next/no-literal-string
                          scope: "col",
                          className: fetchAlignment(cell.align, numericColumnIndexes.has(i)),
                          colSpan: spanOf(cell.colspan),
                          rowSpan: spanOf(cell.rowspan),
                        }}
                        useWrapperElement={false}
                        // oxlint-disable-next-line i18next/no-literal-string
                        wrapperRef={getRef(`head-${j}-${i}`)}
                      />
                    ))}
                </tr>
              ))}
            </thead>
          )}
          <tbody>
            {body.map((cellRows: Cells, j: number) => (
              <tr key={j}>
                {cellRows.cells &&
                  cellRows.cells.map((cell: CellAttributes, i: number) => (
                    <ParsedText
                      key={i}
                      // oxlint-disable-next-line i18next/no-literal-string
                      text={cell.content !== "" ? (cell.content ?? "&#xFEFF;") : "&#xFEFF;"}
                      tag={cell.tag === "th" ? "th" : "td"}
                      tagProps={{
                        ...(cell.tag === "th"
                          ? // oxlint-disable-next-line i18next/no-literal-string
                            { scope: cell.scope ?? "row" }
                          : {}),
                        className: fetchAlignment(cell.align, numericColumnIndexes.has(i)),
                        colSpan: spanOf(cell.colspan),
                        rowSpan: spanOf(cell.rowspan),
                      }}
                      useWrapperElement={false}
                      // oxlint-disable-next-line i18next/no-literal-string
                      wrapperRef={getRef(`body-${j}-${i}`)}
                    />
                  ))}
              </tr>
            ))}
          </tbody>
          {foot && (
            <tfoot>
              {foot.map((cellRows: Cells, j: number) => (
                <tr key={j}>
                  {cellRows.cells &&
                    cellRows.cells.map((cell: CellAttributes, i: number) => (
                      <ParsedText
                        key={i}
                        // oxlint-disable-next-line i18next/no-literal-string
                        text={cell.content !== "" ? (cell.content ?? "&#xFEFF;") : "&#xFEFF;"}
                        tag="th"
                        tagProps={{
                          // oxlint-disable-next-line i18next/no-literal-string
                          scope: "col",
                          className: fetchAlignment(cell.align, numericColumnIndexes.has(i)),
                          colSpan: spanOf(cell.colspan),
                          rowSpan: spanOf(cell.rowspan),
                        }}
                        useWrapperElement={false}
                        // oxlint-disable-next-line i18next/no-literal-string
                        wrapperRef={getRef(`foot-${j}-${i}`)}
                      />
                    ))}
                </tr>
              ))}
            </tfoot>
          )}
          <ParsedText
            text={caption}
            tag="caption"
            tagProps={{
              className: css`
                caption-side: top;
                text-align: start;
                font-size: 0.875rem;
                line-height: 1.4;
                color: ${baseTheme.colors.gray[500]};
                padding-bottom: 0.5rem;
              `,
            }}
            useWrapperElement={false}
            wrapperRef={captionRef}
          />
        </table>
      </ScrollRegion>
      {canScroll.start && (
        <div aria-hidden className={cx(edgeShadowBaseStyles, leftShadowStyles)} />
      )}
      {canScroll.end && <div aria-hidden className={cx(edgeShadowBaseStyles, rightShadowStyles)} />}
    </div>
  )
}

export default withErrorBoundary(TableBlock)
