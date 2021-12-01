import { css } from "@emotion/css"
import React, { useState } from "react"
import { useDispatch } from "react-redux"

import { NormalizedQuizItemOption, QuizItemVariables } from "../../../../../types/types"
import { editedOptionCorrectAnswer } from "../../../../store/editor/options/optionActions"
import { useTypedSelector } from "../../../../store/store"

interface TableCellContentProps {
  rowLoop: number
  columnLoop: number
  variables: QuizItemVariables
  option: NormalizedQuizItemOption
}

const TableCellContent: React.FC<TableCellContentProps> = ({ columnLoop, rowLoop, option }) => {
  const storeOption = useTypedSelector((state) => state.editor.options[option.id])

  const [IsActive, setIsActive] = useState(false)
  const dispatch = useDispatch()

  const handleTextarea = (text: string) => {
    dispatch(editedOptionCorrectAnswer(text, storeOption.id))
  }
  console.log(storeOption)
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
            ${storeOption.correctAnswer.length === 0 &&
            `
            background-color: #ECECEC;
          `}
            ${IsActive &&
            storeOption.correctAnswer.length === 0 &&
            `
              background-color: #DBDBDB;
              `}
          `}
          value={storeOption.correctAnswer ?? ""}
          onSelect={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
          onChange={(event) => handleTextarea(event.target.value)}
        ></input>
      </td>
    </>
  )
}
export default TableCellContent
