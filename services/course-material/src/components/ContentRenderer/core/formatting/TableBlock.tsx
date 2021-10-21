import { css } from "@emotion/css"

import { BlockRendererProps } from "../.."
import { baseTheme } from "../../../../shared-module/styles"
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import colorMapper from "../../../../styles/colorMapper"
import { TableAttributes } from "../../../../types/GutenbergBlockAttributes"

const TableBlock: React.FC<BlockRendererProps<TableAttributes>> = ({ data }) => {
  const {
    hasFixedLayout,
    caption,
    anchor,
    backgroundColor,
    // borderColor, // Bordercolor is same as textcolor in Gutenberg
    // align, // figure out alignment later
    className,
    gradient,
    // style,
    textColor,
  } = data.attributes
  const body = data.attributes.body
  const head = data.attributes.head
  const foot = data.attributes.foot

  const isStriped = className === "is-style-stripes"
  const textAndBorderColor = colorMapper(textColor, "#000")

  const fetchAlignment = (align: string | undefined) => {
    if (align) {
      return css`
        text-align: ${align};
      `
    }
    return undefined
  }

  return (
    <table
      className={css`
        ${courseMaterialCenteredComponentStyles}
        ${backgroundColor && `background: ${colorMapper(backgroundColor)};`}
        ${gradient && `background: ${colorMapper(gradient)};`}
        color: ${textAndBorderColor};
        border-collapse: collapse;
        td,
        th {
          ${!isStriped && `border: 1px solid ${textAndBorderColor};`}
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
          {head.map((cellRows, j) => (
            <tr key={j}>
              {cellRows.cells &&
                cellRows.cells.map((cell, i) => (
                  <th className={fetchAlignment(cell.align)} key={i}>
                    {cell.content}
                  </th>
                ))}
            </tr>
          ))}
        </thead>
      )}
      <tbody>
        {body.map((cellRows, j) => (
          <tr key={j}>
            {cellRows.cells &&
              cellRows.cells.map((cell, i) => (
                <td className={fetchAlignment(cell.align)} key={i}>
                  {cell.content}
                </td>
              ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          {foot.map((cellRows, j) => (
            <tr key={j}>
              {cellRows.cells &&
                cellRows.cells.map((cell, i) => (
                  <th className={fetchAlignment(cell.align)} key={i}>
                    {cell.content}
                  </th>
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
  )
}

export default withErrorBoundary(TableBlock)
