import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useState } from "react"

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
    color: #313947;
    font-family: Josefin Sans, sans-serif;
    display: block;
    width: 50px;
    height: 50px;
    border: 0;
    outline: none;
    text-align: center;
    resize: none;
    background: #FBFBFC;
    ${
      cellText === "" &&
      (column > matrixSize[1] || row > matrixSize[0]) &&
      `
      background-color: #F5F6F7;
`
    }
    ${
      (cellText !== "" && column > matrixSize[1]) ||
      (cellText !== "" &&
        row > matrixSize[0] &&
        isActive &&
        cellText.length === 0 &&
        `
      background-color: #DBDBDB;
`)
    }
  `

const CellInputContainer = styled.input<CellInputStyleProps>`
  ${cellInputStyle}
`

export interface MatrixCellProps {
  row: number
  column: number
  cellText: string
  handleOptionSelect: (text: string, column: number, row: number) => void
  matrixSize: number[]
}

const MatrixCell: React.FunctionComponent<React.PropsWithChildren<MatrixCellProps>> = ({
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
        font-size: 2.8vw;
        font-size: 22px;
        font-family:
          Josefin Sans,
          sans-serif;
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
          row={row}
          name={cellText}
          matrixSize={matrixSize}
          cellText={cellText}
          isActive={isActive}
          value={cellText ?? ""}
          type="text"
          onSelect={() => setIsActive(!isActive)}
          onBlur={() => setIsActive(!isActive)}
          onChange={(event) => handleOptionSelect(event.target.value, column, row)}
        ></CellInputContainer>
      </div>
    </td>
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
            border-top: 2px solid #718dbf;
            left: -1px;
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
            border-top: 2px solid #718dbf;
            right: -1px;
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
            border-left: 2px solid #718dbf;
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
            border-right: 2px solid #718dbf;
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
            border-bottom: 2px solid #718dbf;
            left: -1px;
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
            border-bottom: 2px solid #718dbf;
            right: -1px;
            left: 50%;
            bottom: -2px;
            z-index: 1;
          `}
        ></div>
      ) : null}
    </>
  )
}

export default MatrixCell
