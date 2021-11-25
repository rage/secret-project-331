/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import React, { useState } from "react"
import { useDispatch } from "react-redux"

import { NormalizedQuizItemOption, QuizItemVariables } from "../../../../../types/types"
import { editedOptionTitle } from "../../../../store/editor/options/optionActions"
import { useTypedSelector } from "../../../../store/store"

interface TableCellOptionContentProps {
  rowLoop: number
  columnLoop: number
  variables: QuizItemVariables
  option: NormalizedQuizItemOption
}

const TableCellOptionContent: React.FC<TableCellOptionContentProps> = ({
  columnLoop,
  rowLoop,
  option,
}) => {
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
          ${storeOption.title.length === 0 &&
          `
          background-color: #DBDBDB;
        `}
        `}
      >
        <form
          className={css`
            input:focus:invalid {
              box-shadow: none;
              border: 2px solid blue !important;
              outline: none;
            }
          `}
        >
          <textarea
            className={css`
              padding: 0;
              resize: none;
              ${IsActive &&
              `
              background-color: #DBDBDB;
              `}
              ${storeOption.title.length === 0 &&
              `
          background-color: #ECECEC;
        `}
            `}
            placeholder={``}
            cols={1}
            rows={1}
            value={storeOption.title ?? ""}
            onSelect={() => setIsActive(true)}
            onBlur={() => setIsActive(false)}
            onChange={(event) => handleTextarea(event.target.value)}
          ></textarea>
        </form>
      </td>
    </>
  )
}
export default TableCellOptionContent
