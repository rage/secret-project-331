import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { TableAttributes } from "../../types/GutenbergBlockAttributes"

/* Still working on the tableBlock */

const TableBlock: React.FC<BlockRendererProps<TableAttributes>> = ({ data }) => {
  const innerBlocks: TableAttributes = data.innerBlocks[0].innerBlocks[0].attributes
  const caption: TableAttributes = data.innerBlocks[0].innerBlocks[0].caption
  const body: TableAttributes = innerBlocks.body[0]
  const headers: TableAttributes = innerBlocks.head[0].cells
  const footer: TableAttributes = innerBlocks.foot[0].cells
  return (
    <table
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <tr>
        {headers.map((header) => (
          <th key={header.content}>{header.content}</th>
        ))}
      </tr>
      <tbody>
        {body.map((obj, index) => {
          ;<tr key={index}>
            {Object.values(obj).map((o, index) => {
              return <td key={index}>{o.content}</td>
            })}
          </tr>
        })}
      </tbody>
    </table>
  )
}

export default TableBlock
