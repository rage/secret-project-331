"use client"
import { css } from "@emotion/css"
import React, { useMemo, useRef } from "react"

import { BlockRendererProps } from "../.."
import { parseText } from "../../util/textParsing"

import { CellAttributes, Cells, TableAttributes } from "@/../types/GutenbergBlockAttributes"
import ParsedText from "@/components/ParsedText"
import { GlossaryContext } from "@/contexts/course-material/GlossaryContext"
import { baseTheme } from "@/shared-module/common/styles"
import { stringToNumberOrPlaceholder } from "@/shared-module/common/utils/numbers"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ExtraAttributes {
  className?: string
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

  const captionRef = useRef<HTMLElement>(null)

  const fetchAlignment = (align: string | undefined) => {
    if (align) {
      return css`
        text-align: ${align};
      `
    }
    return undefined
  }

  return (
    <div
      className={css`
        overflow-x: auto;
        overflow-y: hidden;
      `}
    >
      <table
        className={css`
          border-collapse: collapse;
          td,
          th {
            ${!isStriped && `border: 1px solid currentColor;`}
            white-space: pre-wrap;
            padding: 0.5rem;
            ${hasFixedLayout && "overflow-wrap: break-word;"}
          }
          /* stylelint-disable-next-line block-no-empty */
          tbody tr:nth-child(odd) {
            ${isStriped && `background-color: ${baseTheme.colors.gray[100]};`}
          }
          ${hasFixedLayout && "table-layout: fixed;"}
          thead {
            border-bottom: 3px solid;
          }
          tfoot {
            border-top: 3px solid;
          }

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
                      // eslint-disable-next-line i18next/no-literal-string
                      text={cell.content !== "" ? (cell.content ?? "&#xFEFF;") : "&#xFEFF;"}
                      tag="th"
                      tagProps={{
                        className: fetchAlignment(cell.align),
                        colSpan: stringToNumberOrPlaceholder(cell.colspan, undefined),
                        rowSpan: stringToNumberOrPlaceholder(cell.rowspan, undefined),
                      }}
                      useWrapperElement={false}
                      // eslint-disable-next-line i18next/no-literal-string
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
                    // eslint-disable-next-line i18next/no-literal-string
                    text={cell.content !== "" ? (cell.content ?? "&#xFEFF;") : "&#xFEFF;"}
                    tag="td"
                    tagProps={{
                      className: fetchAlignment(cell.align),
                      colSpan: stringToNumberOrPlaceholder(cell.colspan, undefined),
                      rowSpan: stringToNumberOrPlaceholder(cell.rowspan, undefined),
                    }}
                    useWrapperElement={false}
                    // eslint-disable-next-line i18next/no-literal-string
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
                      // eslint-disable-next-line i18next/no-literal-string
                      text={cell.content !== "" ? (cell.content ?? "&#xFEFF;") : "&#xFEFF;"}
                      tag="th"
                      tagProps={{
                        className: fetchAlignment(cell.align),
                        colSpan: stringToNumberOrPlaceholder(cell.colspan, undefined),
                        rowSpan: stringToNumberOrPlaceholder(cell.rowspan, undefined),
                      }}
                      useWrapperElement={false}
                      // eslint-disable-next-line i18next/no-literal-string
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
              text-align: center;
              font-size: 0.8125rem;
              caption-side: bottom;
            `,
          }}
          useWrapperElement={false}
          wrapperRef={captionRef}
        />
      </table>
    </div>
  )
}

export default withErrorBoundary(TableBlock)
