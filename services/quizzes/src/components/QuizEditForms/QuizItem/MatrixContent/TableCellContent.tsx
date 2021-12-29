import { css } from "@emotion/css"
import React, { useState } from "react"

import { QuizItemVariables } from "../../../../../types/types"

interface TableCellContentProps {
  rowLoop: number
  columnLoop: number
  variables: QuizItemVariables
  cellText: string
  matrixSize: number[]
  handleTextarea: (text: string, column: number, row: number) => void
}

const TableCellContent: React.FC<TableCellContentProps> = ({
  columnLoop,
  rowLoop,
  cellText,
  handleTextarea,
  matrixSize,
}) => {
  const [IsActive, setIsActive] = useState(false)
  return (
    <>
      <td
        key={`cell ${rowLoop} ${columnLoop}`}
        className={css`
          padding: 0;
          font-size: 22px;
          font-family: Josefin Sans, sans-serif;
        `}
      >
        <input
          className={css`
            display: block;
            width: 50px;
            height: 50px;
            border: 0;
            outline: none;
            text-align: center;
            resize: none;
            ${cellText === "" &&
            (columnLoop > matrixSize[1] || rowLoop > matrixSize[0]) &&
            `
            background-color: #ECECEC;
          `}
            ${(cellText !== "" && columnLoop > matrixSize[1]) ||
            (cellText !== "" &&
              rowLoop > matrixSize[0] &&
              IsActive &&
              cellText.length === 0 &&
              `
              background-color: #DBDBDB;
              `)}
          `}
          value={cellText ?? ""}
          onSelect={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
          onChange={(event) => handleTextarea(event.target.value, columnLoop, rowLoop)}
        ></input>
      </td>
    </>
  )
}
export default TableCellContent
