import { css } from "@emotion/css"
import styled from "@emotion/styled"
import type React from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { primaryFont } from "@/shared-module/exercise-react/styles"

/** Grid look shared by the student answer view and the exercise editor. */
export const MatrixTable = styled.table`
  margin: auto;
  background-color: #e2e4e6;
  border-collapse: collapse;
  /* Lightest gray with 3:1 against both cell backgrounds (WCAG 1.4.11); kept 1px so the frame dominates */
  border: 1px solid #8b8f96;
  td {
    border: 1px solid #8b8f96;
  }
`

/** True while focus is inside the grid, so gaps aren't flagged in a row that is still being typed. */
export const useIsEditingGrid = () => {
  const [isEditing, setIsEditing] = useState(false)
  const handlers = {
    onFocus: () => setIsEditing(true),
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setIsEditing(false)
      }
    },
  }
  return [isEditing, handlers] as const
}

interface CellInputStyleProps {
  row: number
  column: number
  cellText: string
  matrixSize: number[]
  isGap: boolean
}

const cellBackground = (
  column: number,
  row: number,
  cellText: string,
  matrixSize: number[],
  isGap: boolean,
) => {
  if (isGap) {
    // Strongest red tint that keeps 3:1 against the grid lines and focus outline
    return "#FFF4F4"
  }
  if (
    cellText === "" &&
    (column > (matrixSize[1] ?? Number.NaN) || row > (matrixSize[0] ?? Number.NaN))
  ) {
    return "#F5F6F7"
  }
  return "#FFFFFF"
}

// Red inner border makes a gap read as an error even though its tint has to stay pale
const GAP_BORDER = `box-shadow: inset 0 0 0 2px ${baseTheme.colors.red[600]};`

const cellInputStyle = ({ column, row, cellText, matrixSize, isGap }: CellInputStyleProps) =>
  `
    position: relative;
    font-size: 2.8vw;
    font-size: 1.375rem;
    color: #313947;
    font-family: ${primaryFont};
    display: block;
    width: 3.125rem;
    height: 3.125rem;
    border: 0;
    text-align: center;

    &:focus-visible {
      /* Lightest green with 3:1 against both cell backgrounds; 2px meets the AAA minimum (WCAG 2.4.13) */
      outline: 2px solid #519a96;
      outline-offset: -3px;
      z-index: 2;
    }

    resize: none;
    background: ${cellBackground(column, row, cellText, matrixSize, isGap)};
    ${isGap ? GAP_BORDER : ""}
  `

const CellInputContainer = styled.input<CellInputStyleProps>`
  ${cellInputStyle}
`

export interface MatrixGridCellProps {
  row: number
  column: number
  cellText: string
  onChange: (text: string, column: number, row: number) => void
  matrixSize: number[]
  isGap: boolean
}

export const MatrixGridCell: React.FC<MatrixGridCellProps> = ({
  row,
  column,
  cellText,
  onChange,
  matrixSize,
  isGap,
}) => {
  const { t } = useTranslation()

  return (
    <td
      className={css`
        padding: 0;
        font-size: 2.8vw;
        font-size: 1.375rem;
        font-weight: 600;
        font-family: ${primaryFont};
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
          // 1-based so the label matches how screen readers announce the table cells (WCAG 1.3.1)
          aria-label={t("matrix-cell-aria-label", { row: row + 1, column: column + 1 })}
          column={column}
          data-testid="matrix-cell"
          row={row}
          name={cellText}
          matrixSize={matrixSize}
          cellText={cellText}
          isGap={isGap}
          aria-invalid={isGap || undefined}
          value={cellText ?? ""}
          type="text"
          onChange={(event) => onChange(event.target.value, column, row)}
        ></CellInputContainer>
      </div>
    </td>
  )
}

const BORDER_STYLES = `
  position: absolute;
  z-index: 1;
`
// green[600] is ~6:1 against the cell background, so the frame stands out from the grid
const BORDER_CONSTANT = `3px solid ${baseTheme.colors.green[600]}`

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
            left: -3px;
            top: -4px;
            width: 14px;
          `}
        ></div>
      ) : null}
      {column === matrixSize[1] && row === 0 ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-top: ${BORDER_CONSTANT};
            right: -3px;
            top: -4px;
            width: 14px;
          `}
        ></div>
      ) : null}
      {column === 0 && row <= (matrixSize[0] ?? Number.NaN) ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-left: ${BORDER_CONSTANT};
            top: -4px;
            bottom: -4px;
            left: -4px;
          `}
        ></div>
      ) : null}
      {column === matrixSize[1] && row <= (matrixSize[0] ?? Number.NaN) ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-right: ${BORDER_CONSTANT};
            top: -4px;
            bottom: -4px;
            right: -4px;
          `}
        ></div>
      ) : null}
      {column === 0 && row === matrixSize[0] ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-bottom: ${BORDER_CONSTANT};
            left: -3px;
            width: 14px;
            bottom: -4px;
          `}
        ></div>
      ) : null}
      {column === matrixSize[1] && row === matrixSize[0] ? (
        <div
          className={css`
            ${BORDER_STYLES}
            border-bottom: ${BORDER_CONSTANT};
            right: -3px;
            width: 14px;
            bottom: -4px;
          `}
        ></div>
      ) : null}
    </>
  )
}
