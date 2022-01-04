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
        `}
      >
        <div
          className={css`
            height: 100%;
            width: 100%;
            position: relative;
          `}
        >
          <BorderDiv column={columnLoop} row={rowLoop} matrixSize={matrixSize}></BorderDiv>
          <input
            className={css`
              position: relative;
              font-size: 22px;
              font-family: Josefin Sans, sans-serif;
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
        </div>
      </td>
    </>
  )
}

interface BorderDivProps {
  column: number
  row: number
  matrixSize: number[]
}

const BorderDiv: React.FC<BorderDivProps> = ({ column, row, matrixSize }) => {
  return (
    <>
      {column === 0 && row === 0 ? (
        <div
          className={css`
            position: absolute;
            border-top: 2px solid #333333;
            left: 0;
            top: -2px;
            right: 50%;
            z-index: 1;
          `}
        ></div>
      ) : null}
      {column === matrixSize[1] && row === 0 ? (
        <div
          className={css`
            position: absolute;
            border-top: 2px solid #333333;
            right: 0;
            top: -2px;
            left: 50%;
            z-index: 1;
          `}
        ></div>
      ) : null}
      {column === 0 && row <= matrixSize[0] ? (
        <div
          className={css`
            position: absolute;
            border-left: 2px solid #333333;
            top: -2px;
            bottom: -2px;
            left: -2px;
            z-index: 1;
          `}
        ></div>
      ) : null}
      {column === matrixSize[1] && row <= matrixSize[0] ? (
        <div
          className={css`
            position: absolute;
            border-right: 2px solid #333333;
            top: -2px;
            bottom: -2px;
            right: -2px;
            z-index: 1;
          `}
        ></div>
      ) : null}
      {column === 0 && row === matrixSize[0] ? (
        <div
          className={css`
            position: absolute;
            border-bottom: 2px solid #333333;
            left: 0;
            right: 50%;
            bottom: -2px;
            z-index: 1;
          `}
        ></div>
      ) : null}
      {column === matrixSize[1] && row === matrixSize[0] ? (
        <div
          className={css`
            position: absolute;
            border-bottom: 2px solid #333333;
            right: 0;
            left: 50%;
            bottom: -2px;
            z-index: 1;
          `}
        ></div>
      ) : null}
    </>
  )
}
export default TableCellContent
