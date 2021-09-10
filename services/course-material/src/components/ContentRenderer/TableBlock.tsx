import { css } from "@emotion/css"

import { courseMaterialCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { TableAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

interface CellContainer {
  cells: Cell[]
}

interface Cell {
  tag: string
  content: string
}

const TableBlock: React.FC<BlockRendererProps<TableAttributes>> = ({ data }) => {
  const innerBlocks = data.attributes
  const body = innerBlocks.body as CellContainer[]
  const head = innerBlocks.head[0] as CellContainer
  const foot = innerBlocks.foot[0] as CellContainer
  return (
    <table
      className={css`
        ${courseMaterialCenteredComponentStyles}
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
