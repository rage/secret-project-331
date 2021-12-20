import { css } from "@emotion/css"
import { useState } from "react"

import { MatrixItemAnswer } from "../../../../types/types"

export interface MatrixCellProps {
  row: number
  column: number
  option: MatrixItemAnswer
  findOptionText: (column: number, row: number) => string
  handleOptionSelect: (text: string, option: MatrixItemAnswer, column: number, row: number) => void
  matrixSize: number[]
}

const MatrixCell: React.FunctionComponent<MatrixCellProps> = ({
  row,
  column,
  findOptionText,
  option,
  handleOptionSelect,
  matrixSize,
}) => {
  const [isActive, setIsActive] = useState(false)

  return (
    <td
      key={`cell ${row} ${column}`}
      className={css`
        padding: 0;
        font-size: 22px;
        font-family: Josefin Sans, sans-serif;
      `}
    >
      {
        <input
          // eslint-disable-next-line i18next/no-literal-string
          aria-label={`row: ${row}, column: ${column}`}
          className={css`
            display: block;
            width: 50px;
            height: 50px;
            border: 0;
            outline: none;
            text-align: center;
            resize: none;
            ${findOptionText(column, row).length === 0 &&
            (column > matrixSize[0] || row > matrixSize[1]) &&
            `
                              background-color: #ECECEC;
                            `}
            ${(option.textData !== "" && column > matrixSize[0]) ||
            (option.textData !== "" &&
              row > matrixSize[1] &&
              isActive &&
              findOptionText(column, row).length === 0 &&
              `
                                background-color: #DBDBDB;
                                `)}
          `}
          value={findOptionText(column, row) ?? ""}
          onSelect={() => setIsActive(!isActive)}
          onBlur={() => setIsActive(!isActive)}
          onChange={(event) => handleOptionSelect(event.target.value, option, column, row)}
        ></input>
      }
    </td>
  )
}

export default MatrixCell
