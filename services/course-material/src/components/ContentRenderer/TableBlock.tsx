import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

/* Still working on the tableBlock */

type TableBlockType = {
  tag: string
  content: string
}

type TableBlockCell = {
  [key: string]: TableBlockType
}

const TableBlock: React.FC<BlockRendererProps<any>> = ({ data }) => {
  const innerBlocks: any = data.innerBlocks[0].innerBlocks[0].attributes
  const caption: string = data.innerBlocks[0].innerBlocks[0].caption
  const body: TableBlockCell[] = innerBlocks.body[0]
  const headers: TableBlockCell = innerBlocks.head[0].cells
  const footer: TableBlockCell = innerBlocks.foot[0].cells
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
