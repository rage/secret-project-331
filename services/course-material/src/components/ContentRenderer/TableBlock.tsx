import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { TableAttributes } from "../../types/GutenbergBlockAttributes"

const TableBlock: React.FC<BlockRendererProps<TableAttributes>> = ({ data }) => {
  const innerBlocks: TableAttributes = data.innerBlocks[0].innerBlocks[0].attributes
  const caption: TableAttributes = data.innerBlocks[0].innerBlocks[0].caption
  const body: TableAttributes = innerBlocks.body[0].cells
  const head: TableAttributes = innerBlocks.head[0].cells
  const foot: TableAttributes = innerBlocks.foot[0].cells
  return (
    <table
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <tr>
        {head.map((header) => (
          <th key={header.content}>{header.content}</th>
        ))}
      </tr>
      <tbody>
        {body &&
          body.map((obj, index) => {
            return (
              <tr key={index}>
                {Object.values(obj).map((o, index) => {
                  return <td key={index}>{o.content}</td>
                })}
              </tr>
            )
          })}
      </tbody>
      <tr>{foot && foot.map((footer) => <th key={footer.content}>{footer.content}</th>)}</tr>
    </table>
  )
}

export default TableBlock
