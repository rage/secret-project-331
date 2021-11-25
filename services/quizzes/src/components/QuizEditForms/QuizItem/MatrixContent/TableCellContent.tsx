/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import React from "react"

import { QuizItemVariables } from "../../../../../types/types"

interface TableCellContentProps {
  rowLoop: number
  columnLoop: number
  variables: QuizItemVariables
  option: null
  handleAddingNewCell: (column: number, row: number) => void
}

const TableCellContent: React.FC<TableCellContentProps> = ({
  columnLoop,
  rowLoop,
  variables,
  handleAddingNewCell,
}) => {
  return (
    <>
      <td
        key={`row index: , ${rowLoop} column index: , ${columnLoop}`}
        className={css`
          padding: 0;
          border-collapse: collapse;
        `}
      >
        <form>
          <textarea
            className={css`
              resize: none;
              background-color: #ececec;
            `}
            placeholder={``}
            cols={1}
            rows={1}
            value={variables.textValue ?? ""}
            onClick={() => handleAddingNewCell(columnLoop, rowLoop)}
          ></textarea>
        </form>
      </td>
    </>
  )
}
export default TableCellContent
