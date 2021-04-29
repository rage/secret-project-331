import { css } from "@emotion/css"
import { BlockRendererProps } from "."
import { normalWidthCenteredComponentStyles } from "../../styles/componentStyles"

/* interface TableBlockInnerBlock {
  attributes: string
  body: string
  head: string
  foot: string
}
interface TableBlockCaption {
  attributes: string
}
interface TableBlockBody {
  body: string
}
interface TableBlockHeader {
  head: string
}
interface TableBlockFooter {
  foot: string
} */

type TableBlockType = {
  tag: string
  content: string
}

type TableBlockAttribute = {
  head: TableBlockCell[]
  foot: TableBlockCell[]
  body: TableBlockCell[]
  caption: string

}

type TableBlockCell = {
  [key:string]: TableBlockType
}


/* const rows = [
  {
    id: 'student-1',
    name: 'Henrik Mikka',
    university: 'Aalto University',
    status: 'student',
  },
  {
    id: 'student-2',
    name: 'Sebastien Makkinen',
    university: 'Univeristy of Helsinki',
    status: 'student',
  },
  {
    id: 'student-3',
    name: 'Linus Torvald',
    university: 'University of Helsinki',
    status: 'alumni',
  },
];
const headers = ['Name', 'University', 'Hobbies']; */

const TableBlock: React.FC<BlockRendererProps<TableBlockAttribute>> = ({ data }) => {
  const innerBlocks: TableBlockAttribute = data.innerBlocks[0].innerBlocks[0].attributes
  const caption: TableBlockAttribute = data.innerBlocks[0].innerBlocks[0].caption
  const body: TableBlockAttribute = innerBlocks.body[0]
  const headers: TableBlockAttribute = innerBlocks.head[0].cells
  const footer: TableBlockAttribute = innerBlocks.foot[0].cells
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
        <tr key={index}>
          {Object.values(obj)
            .map((o,index) => {
              return <td key={index}>{o.content}</td>
            })}
        </tr>
      })}
    </tbody>
    </table>
  )
}

export default TableBlock
