import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { TableAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const TableBlock: React.FC<BlockRendererProps<TableAttributes>> = ({ data }) => {
  const innerBlocks = data.attributes
  const body = innerBlocks.body
  const head = innerBlocks.head[0]
  const foot = innerBlocks.foot[0]
  return (
    <table
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      {head && (
        <tr>
          {head.cells.map((cell, index) => (
            <th key={index}>{cell.content}</th>
          ))}
        </tr>
      )}
      <tbody>
        {body.map((obj, rowIndex) => {
          return (
            <tr key={rowIndex}>
              {obj.cells.map((o, index) => (
                <td key={index}>{o.content}</td>
              ))}
            </tr>
          )
        })}
      </tbody>
      {foot && (
        <tr>
          {foot.cells.map((cell, index) => (
            <th key={index}>{cell.content}</th>
          ))}
        </tr>
      )}
    </table>
  )
}

export default withErrorBoundary(TableBlock)
