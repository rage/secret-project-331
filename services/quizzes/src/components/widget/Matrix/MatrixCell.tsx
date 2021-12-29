import { css } from "@emotion/css"
import { useState } from "react"

export interface MatrixCellProps {
  row: number
  column: number
  cellText: string
  handleOptionSelect: (text: string, column: number, row: number) => void
  matrixSize: number[]
}

const MatrixCell: React.FunctionComponent<MatrixCellProps> = ({
  row,
  column,
  cellText,
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
            ${cellText.length === 0 &&
            (column > matrixSize[1] || row > matrixSize[0]) &&
            `
                              background-color: #ECECEC;
                            `}
            ${(cellText !== "" && column > matrixSize[1]) ||
            (cellText !== "" &&
              row > matrixSize[0] &&
              isActive &&
              cellText.length === 0 &&
              `
                                background-color: #DBDBDB;
                                `)}
          `}
          name={cellText}
          value={cellText ?? ""}
          type="text"
          onSelect={() => setIsActive(!isActive)}
          onBlur={() => setIsActive(!isActive)}
          onChange={(event) => handleOptionSelect(event.target.value, column, row)}
        ></input>
      }
    </td>
  )
}

export default MatrixCell
