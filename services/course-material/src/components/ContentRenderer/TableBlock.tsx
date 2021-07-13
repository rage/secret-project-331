import { css } from "@emotion/css"

import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"
import { TableAttributes } from "../../types/GutenbergBlockAttributes"

import { BlockRendererProps } from "."

const TableBlock: React.FC<BlockRendererProps<TableAttributes>> = ({ data }) => {
  const innerBlocks: TableAttributes = data.innerBlocks[0].innerBlocks[0].attributes
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
        {head.map((head) => (
          <th key={head.content}>{head.content}</th>
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
      <tr>{foot && foot.map((foot) => <th key={foot.content}>{foot.content}</th>)}</tr>
    </table>
  )
}

export default TableBlock
