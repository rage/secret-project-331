import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { primaryFont } from "@/shared-module/exercise-react/styles"
import {
  blankCellsInsideShape,
  MATRIX_GRID_SIZE,
  type MatrixShape,
  matrixShape,
} from "@/util/matrix"

/** Grid look shared by the student answer view and the exercise editor. */
export const MatrixTable = styled.table`
  /* Room for the frame brackets, which overhang the grid by 4px and would be clipped by the iframe */
  margin: 4px auto;
  background-color: #e2e4e6;
  border-collapse: collapse;
  td {
    /* Lightest gray with 3:1 against both cell backgrounds (WCAG 1.4.11); kept 1px so the frame dominates */
    border: 1px solid #8b8f96;
  }
  /* Only inner lines, so the grid has no outer edge */
  tr:first-child td {
    border-top: none;
  }
  tr:last-child td {
    border-bottom: none;
  }
  td:first-child {
    border-left: none;
  }
  td:last-child {
    border-right: none;
  }
`

/** True while focus is inside the grid, so gaps aren't flagged in a row that is still being typed. */
const useIsEditingGrid = () => {
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

/** Shape and gaps of an editable grid; gaps are hidden while focus is inside it. */
export const useMatrixGrid = (matrix: string[][]) => {
  const [isEditing, editingHandlers] = useIsEditingGrid()
  const shape = matrixShape(matrix)
  const gaps = isEditing ? [] : blankCellsInsideShape(matrix, shape)
  return { shape, gaps, editingHandlers }
}

const GRID_INDICES = Array.from({ length: MATRIX_GRID_SIZE }, (_unused, index) => index)

interface MatrixInputGridProps extends React.HTMLAttributes<HTMLTableElement> {
  matrix: string[][]
  shape: MatrixShape
  gaps: { row: number; column: number }[]
  onMatrixChange: (matrix: string[][]) => void
}

/** The 6x6 input grid shared by the student answer view and the exercise editor. */
export const MatrixInputGrid: React.FC<MatrixInputGridProps> = ({
  matrix,
  shape,
  gaps,
  onMatrixChange,
  ...tableProps
}) => {
  // An empty grid still frames its first cell
  const frame = { rows: Math.max(1, shape.rows), columns: Math.max(1, shape.columns) }
  const handleChange = (text: string, column: number, row: number) =>
    onMatrixChange(
      matrix.map((rowArray, rowIndex) =>
        rowArray.map((cell, columnIndex) =>
          rowIndex === row && columnIndex === column ? text : cell,
        ),
      ),
    )
  return (
    <MatrixTable {...tableProps}>
      <tbody>
        {GRID_INDICES.map((row) => (
          <tr key={row}>
            {GRID_INDICES.map((column) => (
              <MatrixGridCell
                key={column}
                row={row}
                column={column}
                cellText={matrix[row]?.[column] ?? ""}
                onChange={handleChange}
                frame={frame}
                isGap={gaps.some((gap) => gap.row === row && gap.column === column)}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </MatrixTable>
  )
}

interface CellInputStyleProps {
  row: number
  column: number
  cellText: string
  frame: MatrixShape
  isGap: boolean
}

const cellBackground = ({ column, row, cellText, frame, isGap }: CellInputStyleProps) => {
  if (isGap) {
    // Strongest red tint that keeps 3:1 against the grid lines and focus outline
    return "#FFF4F4"
  }
  if (cellText === "" && (column >= frame.columns || row >= frame.rows)) {
    return "#F5F6F7"
  }
  return "#FFFFFF"
}

// Red inner border makes a gap read as an error even though its tint has to stay pale
const GAP_BORDER = `box-shadow: inset 0 0 0 2px ${baseTheme.colors.red[600]};`

const cellInputStyle = (props: CellInputStyleProps) =>
  `
    position: relative;
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
    background: ${cellBackground(props)};
    ${props.isGap ? GAP_BORDER : ""}
  `

const CellInputContainer = styled.input<CellInputStyleProps>`
  ${cellInputStyle}
`

interface MatrixGridCellProps {
  row: number
  column: number
  cellText: string
  onChange: (text: string, column: number, row: number) => void
  frame: MatrixShape
  isGap: boolean
}

const MatrixGridCell: React.FC<MatrixGridCellProps> = ({
  row,
  column,
  cellText,
  onChange,
  frame,
  isGap,
}) => {
  const { t } = useTranslation()

  return (
    <td
      className={css`
        padding: 0;
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
        <MatrixFrame column={column} row={row} frame={frame} />
        <CellInputContainer
          // 1-based so the label matches how screen readers announce the table cells (WCAG 1.3.1)
          aria-label={t("matrix-cell-aria-label", { row: row + 1, column: column + 1 })}
          column={column}
          data-testid="matrix-cell"
          row={row}
          name={cellText}
          frame={frame}
          cellText={cellText}
          isGap={isGap}
          aria-invalid={isGap || undefined}
          value={cellText}
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

interface MatrixFrameProps {
  column: number
  row: number
  frame: MatrixShape
}

/** Bracket pieces for one cell: a vertical bar on the frame's outer columns, hooks at its corners. */
export const MatrixFrame: React.FC<MatrixFrameProps> = ({ column, row, frame }) => {
  if (row >= frame.rows) {
    return null
  }
  // A one-column frame gets both brackets in the same cell
  // oxlint-disable-next-line i18next/no-literal-string -- CSS side names
  const sides = (["left", "right"] as const).filter((side) =>
    side === "left" ? column === 0 : column === frame.columns - 1,
  )
  return (
    <>
      {sides.map((side) => (
        <React.Fragment key={side}>
          <div
            className={css`
              ${BORDER_STYLES}
              border-${side}: ${BORDER_CONSTANT};
              ${side}: -4px;
              top: -4px;
              bottom: -4px;
            `}
          />
          {row === 0 && (
            <div
              className={css`
                ${BORDER_STYLES}
                border-top: ${BORDER_CONSTANT};
                ${side}: -3px;
                top: -4px;
                width: 14px;
              `}
            />
          )}
          {row === frame.rows - 1 && (
            <div
              className={css`
                ${BORDER_STYLES}
                border-bottom: ${BORDER_CONSTANT};
                ${side}: -3px;
                bottom: -4px;
                width: 14px;
              `}
            />
          )}
        </React.Fragment>
      ))}
    </>
  )
}
