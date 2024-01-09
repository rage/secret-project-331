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
    font-size: 1.375rem;
    color: #313947;
    font-family: Josefin Sans, sans-serif;
    display: block;
    width: 3.125rem;
    height: 3.125rem;
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
        font-size: 1.375rem;
        font-weight: 600;
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

const BORDER_STYLES = `
  position: absolute;
  z-index: 1;
`
const BORDER_CONSTANT = "2px solid #718dbf"

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
            ${BORDER_STYLES}
            border-top: ${BORDER_CONSTANT};
            left: -1px;
            top: -2px;
            width: 10px;
            right: 50%;
          `}
        ></div>
      ) : null}
      {column === matrixSize[1] && row === 0 ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-top: ${BORDER_CONSTANT};
            right: -1px;
            top: -2px;
            left: 80%;
            width: 10px;
          `}
        ></div>
      ) : null}
      {column === 0 && row <= matrixSize[0] ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-left: ${BORDER_CONSTANT};
            top: -2px;
            bottom: -2px;
            left: -2px;
          `}
        ></div>
      ) : null}
      {column === matrixSize[1] && row <= matrixSize[0] ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-right: ${BORDER_CONSTANT};
            top: -2px;
            bottom: -2px;
            right: -2px;
          `}
        ></div>
      ) : null}
      {column === 0 && row === matrixSize[0] ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-bottom: ${BORDER_CONSTANT};
            left: -1px;
            right: 50%;
            width: 10px;
            bottom: -2px;
          `}
        ></div>
      ) : null}
      {column === matrixSize[1] && row === matrixSize[0] ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-bottom: ${BORDER_CONSTANT};
            right: -1px;
            left: 80%;
            width: 10px;
            bottom: -2px;
          `}
        ></div>
      ) : null}
    </>
  )
}

export default MatrixCell
