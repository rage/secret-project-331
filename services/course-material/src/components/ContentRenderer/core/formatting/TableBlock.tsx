import { css } from "@emotion/css"
import { useContext } from "react"

import { BlockRendererProps } from "../.."
import {
  CellAttributes,
  Cells,
  TableAttributes,
} from "../../../../../types/GutenbergBlockAttributes"
import { GlossaryContext } from "../../../../contexts/GlossaryContext"
import { baseTheme } from "../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import { stringToNumberOrPlaceholder } from "../../../../shared-module/utils/numbers"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import colorMapper from "../../../../styles/colorMapper"
import { parseText } from "../../util/textParsing"

const TableBlock: React.FC<React.PropsWithChildren<BlockRendererProps<TableAttributes>>> = ({
  data,
}) => {
  const {
    hasFixedLayout,
    caption,
    anchor,
    backgroundColor,
    // borderColor, // Bordercolor is same as textcolor in our version of Gutenberg
    align,
    className,
    gradient,
    fontFamily,
    // style,
    textColor,
  } = data.attributes
  const body = data.attributes.body
  const head = data.attributes.head
  const foot = data.attributes.foot

  const { terms } = useContext(GlossaryContext)
  const isStriped = className === "is-style-stripes"

  const fetchAlignment = (align: string | undefined) => {
    if (align) {
      // eslint-disable-next-line i18next/no-literal-string
      return css`
        text-align: ${align};
      `
    }
    return undefined
  }

  return (
    <div
      className={css`
        max-width: 95vw;
        overflow-x: scroll;
        overflow-y: clip;
        ${respondToOrLarger.sm} {
          overflow-x: unset;
          overflow-y: unset;
        }
      `}
    >
      <table
        className={css`
          ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
          ${gradient && `background: ${colorMapper(gradient)};`}
          ${align !== "center" && `float: ${align};`}
          ${align === "center" && "margin: 0 auto;"}
          ${fontFamily && `font-family: ${fontFamily};`}
          color: ${colorMapper(textColor)};
          border-collapse: collapse;
          ${!align && "width: 100%;"}
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
        `}
        {...(anchor && { id: anchor })}
      >
        {head && (
          <thead>
            {head.map((cellRows: Cells, j: number) => (
              <tr key={j}>
                {cellRows.cells &&
                  cellRows.cells.map((cell: CellAttributes, i) => (
                    <th
                      className={fetchAlignment(cell.align)}
                      key={i}
                      colSpan={stringToNumberOrPlaceholder(cell.colspan, undefined)}
                      rowSpan={stringToNumberOrPlaceholder(cell.rowspan, undefined)}
                      dangerouslySetInnerHTML={{
                        __html: parseText(
                          cell.content !== "" ? cell.content ?? "&#xFEFF;" : "&#xFEFF;",
                          terms,
                        ).parsedText,
                      }}
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
                  <td
                    className={fetchAlignment(cell.align)}
                    key={i}
                    colSpan={stringToNumberOrPlaceholder(cell.colspan, undefined)}
                    rowSpan={stringToNumberOrPlaceholder(cell.rowspan, undefined)}
                    dangerouslySetInnerHTML={{
                      __html: parseText(
                        cell.content !== "" ? cell.content ?? "&#xFEFF;" : "&#xFEFF;",
                        terms,
                      ).parsedText,
                    }}
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
                    <th
                      className={fetchAlignment(cell.align)}
                      key={i}
                      colSpan={stringToNumberOrPlaceholder(cell.colspan, undefined)}
                      rowSpan={stringToNumberOrPlaceholder(cell.rowspan, undefined)}
                      dangerouslySetInnerHTML={{
                        __html: parseText(
                          cell.content !== "" ? cell.content ?? "&#xFEFF;" : "&#xFEFF;",
                          terms,
                        ).parsedText,
                      }}
                    />
                  ))}
              </tr>
            ))}
          </tfoot>
        )}
        <caption
          className={css`
            text-align: center;
            font-size: 0.8125rem;
            caption-side: bottom;
          `}
          dangerouslySetInnerHTML={{
            __html: parseText(caption, terms).parsedText,
          }}
        />
      </table>
    </div>
  )
}

export default withErrorBoundary(TableBlock)
