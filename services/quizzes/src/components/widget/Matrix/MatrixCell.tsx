import { css } from "@emotion/css"
import { useState } from "react"

import { PublicQuizItemOption } from "../../../../types/types"

export interface MatrixCellProps {
  row: number
  column: number
  option: PublicQuizItemOption
  findOptionText: (optionId: string) => string
  handleOptionSelect: (
    text: string,
    option: PublicQuizItemOption,
    column: number,
    row: number,
  ) => void
}

const MatrixCell: React.FunctionComponent<MatrixCellProps> = ({
  row,
  column,
  findOptionText,
  option,
  handleOptionSelect,
}) => {
  const [isActive, setIsActive] = useState(false)

  return (
    <td
      key={`cell ${row} ${column}`}
      className={css`
        padding: 0;
        font-size: 30px;
      `}
    >
      {
        <input
          className={css`
            display: block;
            width: 50px;
            height: 50px;
            border: 0;
            outline: none;
            text-align: center;
            resize: none;
            ${findOptionText(option.id).length === 0 &&
            `
                              background-color: #ECECEC;
                            `}
            ${isActive &&
            findOptionText(option.id).length === 0 &&
            `
                                background-color: #DBDBDB;
                                `}
          `}
          value={findOptionText(option.id) ?? ""}
          onSelect={() => setIsActive(!isActive)}
          onBlur={() => setIsActive(!isActive)}
          onChange={(event) => handleOptionSelect(event.target.value, option, column, row)}
        ></input>
      }
    </td>
  )
}

export default MatrixCell
