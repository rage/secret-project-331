/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import React, { useState } from "react"
import { useDispatch } from "react-redux"

import { NormalizedQuizItemOption, QuizItemVariables } from "../../../../../types/types"
import { editedOptionTitle } from "../../../../store/editor/options/optionActions"
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
    dispatch(editedOptionTitle(text, storeOption.id))
  }
  console.log(storeOption)
  return (
    <>
      <td
        key={`row index: , ${rowLoop} column index: , ${columnLoop}`}
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
            ${storeOption.title.length === 0 &&
            `
            background-color: #ECECEC;
          `}
            ${IsActive &&
            storeOption.title.length === 0 &&
            `
              background-color: #DBDBDB;
              `}
          `}
          value={storeOption.title ?? ""}
          onSelect={() => setIsActive(true)}
          onBlur={() => setIsActive(false)}
          onChange={(event) => handleTextarea(event.target.value)}
        ></input>
      </td>
    </>
  )
}
export default TableCellContent
