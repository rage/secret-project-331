import { css } from "@emotion/css"
import React, { useState } from "react"

import { MatrixItemAnswer, QuizItemVariables } from "../../../../../types/types"

interface TableCellContentProps {
  rowLoop: number
  columnLoop: number
  variables: QuizItemVariables
  option: MatrixItemAnswer
  matrixSize: number[]
  handleTextarea: (text: string, column: number, row: number) => void
}

const TableCellContent: React.FC<TableCellContentProps> = ({
  columnLoop,
  rowLoop,
  option,
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
          font-size: 30px;
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
            ${option.optionId === "" &&
            (columnLoop > matrixSize[0] || rowLoop > matrixSize[1]) &&
            `
            background-color: #ECECEC;
          `}
            ${(option.optionId !== "" && columnLoop > matrixSize[0]) ||
            (option.optionId !== "" &&
              rowLoop > matrixSize[1] &&
              IsActive &&
              option.textData.length === 0 &&
              `
              background-color: #DBDBDB;
              `)}
          `}
          value={option?.textData ?? ""}
          onSelect={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
          onChange={(event) => handleTextarea(event.target.value, columnLoop, rowLoop)}
        ></input>
      </td>
    </>
  )
}
export default TableCellContent
