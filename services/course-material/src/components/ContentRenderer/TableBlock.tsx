import { css } from "@emotion/css"

import { TableAttributes } from "../../../types/GutenbergBlockAttributes"
import { courseMaterialCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import { BlockRendererProps } from "."

const TableBlock: React.FC<BlockRendererProps<TableAttributes>> = ({ data }) => {
  const body = data.attributes.body
  const head = data.attributes.head
  const foot = data.attributes.foot
  // TODO: Styling for table
  return (
    <table
      className={css`
        ${courseMaterialCenteredComponentStyles}
      `}
    >
      {head && (
        <>
          {head.map((cellRows, j) => (
            <tr key={j}>
              {cellRows.cells && cellRows.cells.map((cell, i) => <th key={i}>{cell.content}</th>)}
            </tr>
          ))}
        </>
      )}
      <tbody>
        {body.map((cellRows, j) => (
          <tr key={j}>
            {cellRows.cells && cellRows.cells.map((cell, i) => <td key={i}>{cell.content}</td>)}
          </tr>
        ))}
      </tbody>
      {foot && (
        <>
          {foot.map((cellRows, j) => (
            <tr key={j}>
              {cellRows.cells && cellRows.cells.map((cell, i) => <th key={i}>{cell.content}</th>)}
            </tr>
          ))}
        </>
      )}
    </table>
  )
}

export default withErrorBoundary(TableBlock)
