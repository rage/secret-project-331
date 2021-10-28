import { css } from "@emotion/css"
import sanitizeHtml from "sanitize-html"

import { BlockRendererProps } from "../.."
import {
  CellAttributes,
  Cells,
  TableAttributes,
} from "../../../../../types/GutenbergBlockAttributes"
import { baseTheme } from "../../../../shared-module/styles"
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import colorMapper from "../../../../styles/colorMapper"

const TableBlock: React.FC<BlockRendererProps<TableAttributes>> = ({ data }) => {
  const {
    hasFixedLayout,
    caption,
    anchor,
    backgroundColor,
    // borderColor, // Bordercolor is same as textcolor in our version of Gutenberg
    align,
    className,
    gradient,
    // style,
    textColor,
  } = data.attributes
  const body = data.attributes.body
  const head = data.attributes.head
  const foot = data.attributes.foot

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
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      <table
        className={css`
          ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
          ${gradient && `background: ${colorMapper(gradient)};`}
          ${align !== "center" && `float: ${align};`}
          ${align === "center" && "margin: 0 auto;"}
          color: ${colorMapper(textColor)};
          border-collapse: collapse;
          ${!align && "width: 100%;"}
          td,
          th {
            ${!isStriped && `border: 1px solid currentColor;`}
            white-space: pre-wrap;
            padding: 0.5rem;
            ${hasFixedLayout && "word-break: break-word;"}
          }
          tbody tr:nth-child(odd) {
            ${isStriped && `background-color: ${baseTheme.colors.grey[100]};`}
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
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(
                          cell.content !== "" ? cell.content ?? "&#xFEFF;" : "&#xFEFF;",
                        ),
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
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(
                        cell.content !== "" ? cell.content ?? "&#xFEFF;" : "&#xFEFF;",
                      ),
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
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(
                          cell.content !== "" ? cell.content ?? "&#xFEFF;" : "&#xFEFF;",
                        ),
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
        >
          {caption}
        </caption>
      </table>
    </div>
  )
}

export default withErrorBoundary(TableBlock)
