import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"

import { baseTheme, primaryFont } from "@/shared-module/common/styles"

interface CellInputStyleProps {
  row: number
  column: number
  cellText: string
  matrixSize: number[]
  isActive: boolean
}

const cellInputStyle = ({ column, row, cellText, matrixSize, isActive }: CellInputStyleProps) =>
  `
    position: relative;
    font-size: 2.8vw;
    font-size: 22px;
    font-family: ${primaryFont};
    display: block;
    width: 50px;
    height: 50px;
    border: 0;
    outline: none;
    text-align: center;
    resize: none;
    ${
      cellText === "" &&
      (column > matrixSize[1] || row > matrixSize[0]) &&
      // eslint-disable-next-line i18next/no-literal-string
      `background-color: ${baseTheme.colors.clear[100]};
`
    }
    ${
      cellText === "" &&
      isActive &&
      (column > matrixSize[1] || row > matrixSize[0]) &&
      // eslint-disable-next-line i18next/no-literal-string
      `background-color: ${baseTheme.colors.clear[300]};`
    }
  `

const CellInputContainer = styled.input<CellInputStyleProps>`
  ${cellInputStyle}
`

interface TableCellContentProps {
  rowLoop: number
  columnLoop: number
  cellText: string
  matrixSize: number[]
  handleTextarea: (text: string, column: number, row: number) => void
}

const TableCellContent: React.FC<React.PropsWithChildren<TableCellContentProps>> = ({
  columnLoop: column,
  rowLoop: row,
  cellText,
  handleTextarea,
  matrixSize,
}) => {
  const [isActive, setIsActive] = useState(false)
  return (
    <>
      <td
        key={`cell ${row} ${column}`}
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
          <BorderDiv column={column} row={row} matrixSize={matrixSize}></BorderDiv>
          <CellInputContainer
            // eslint-disable-next-line i18next/no-literal-string
            aria-label={`row: ${row}, column: ${column}`}
            column={column}
            data-testid="matrix-cell"
            row={row}
            matrixSize={matrixSize}
            cellText={cellText}
            isActive={isActive}
            value={cellText ?? ""}
            onSelect={() => setIsActive(true)}
            onBlur={() => setIsActive(false)}
            onChange={(event) => handleTextarea(event.target.value, column, row)}
          ></CellInputContainer>
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

const BorderDiv: React.FC<React.PropsWithChildren<BorderDivProps>> = ({
  column,
  row,
  matrixSize,
}) => {
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
