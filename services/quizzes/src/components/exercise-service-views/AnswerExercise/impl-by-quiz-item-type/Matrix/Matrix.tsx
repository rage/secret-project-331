import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { MatrixGridCell, MatrixTable, useIsEditingGrid } from "@/components/Shared/MatrixGrid"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  blankCellsInsideShape,
  isBlankCell,
  isMalformedNumberCell,
  looksLikeThousandsSeparator,
  MATRIX_GRID_SIZE,
  matrixShape,
  parseCellNumber,
} from "@/util/matrix"

import type { QuizItemComponentProps } from ".."
import type { UserItemAnswerMatrix } from "../../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemMatrix } from "../../../../../../types/quizTypes/publicSpec"

const AnswerMatrixTable = styled(MatrixTable)`
  margin-top: 1rem;
`

/**
 * A submittable answer is a completely filled rectangle anchored at the top-left, because the shape
 * the student types is their claim about the shape of the answer. A number nobody can parse, say
 * `1,234,567`, is still submittable: the grader falls back to comparing it as exact text, and the
 * key can legitimately contain the same unparseable text (blocking it here would make a published
 * key using that exact text unanswerable).
 */
const isSubmittable = (matrix: string[][]): boolean => {
  const shape = matrixShape(matrix)
  if (shape.rows === 0 || shape.columns === 0) {
    return false
  }
  for (let row = 0; row < shape.rows; row++) {
    for (let column = 0; column < shape.columns; column++) {
      if (isBlankCell(matrix[row]?.[column])) {
        return false
      }
    }
  }
  return true
}

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const Matrix: React.FunctionComponent<
  QuizItemComponentProps<PublicSpecQuizItemMatrix, UserItemAnswerMatrix>
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const [matrixActiveSize, setMatrixActiveSize] = useState<number[]>([]) // [row, column]
  const [isEditing, editingHandlers] = useIsEditingGrid()
  const matrixVariable = useMemo(() => {
    const res = quizItemAnswerState?.matrix
    if (res !== null && res !== undefined && Array.isArray(res)) {
      return res
    }
    // Initialize a new empty answer
    const newAnswerMatrix: string[][] = []
    for (let i = 0; i < 6; i++) {
      const columnArray: string[] = []
      for (let j = 0; j < 6; j++) {
        columnArray.push("")
      }
      newAnswerMatrix.push(columnArray)
    }
    return newAnswerMatrix
  }, [quizItemAnswerState?.matrix])
  // The frame is drawn from the last non-blank row and column, so it is expressed as indices while
  // `matrixShape` counts cells.
  const handleSizeChange = useCallback((matrix: string[][]) => {
    const shape = matrixShape(matrix)
    const sizeOfTheMatrix = [Math.max(0, shape.rows - 1), Math.max(0, shape.columns - 1)]
    setMatrixActiveSize(sizeOfTheMatrix)
    return sizeOfTheMatrix
  }, [])

  useEffect(() => {
    handleSizeChange(matrixVariable)
  }, [handleSizeChange, matrixVariable])

  const handleOptionSelect = (text: string, column: number, row: number) => {
    const newMatrix = matrixVariable.map((rowArray, rowIndex) => {
      return rowArray.map((cell, columnIndex) => {
        if (column === columnIndex && row === rowIndex) {
          return text
        }
        return cell
      })
    })
    handleSizeChange(newMatrix)
    let newOptionCells: string[][] = [[]]
    if (newMatrix) {
      newOptionCells = newMatrix
    } else if (quizItemAnswerState?.matrix) {
      newOptionCells = quizItemAnswerState?.matrix
    }
    const isValid = isSubmittable(newOptionCells)
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        type: "matrix",
        matrix: newOptionCells,
        valid: isValid,
      })
      return
    }
    const newItemAnswer: UserItemAnswerMatrix = {
      ...quizItemAnswerState,
      matrix: newOptionCells,
      valid: isValid,
    }
    setQuizItemAnswerState(newItemAnswer)
  }

  const findOptionText = (column: number, row: number): string => {
    return matrixVariable[row]?.[column] ?? ""
  }

  const cellsWithPosition = matrixVariable.flatMap((row, rowIndex) =>
    row.map((cell, columnIndex) => ({ cell, rowIndex, columnIndex })),
  )
  const malformedCells = cellsWithPosition.filter(({ cell }) => isMalformedNumberCell(cell))
  const commaCells = cellsWithPosition.filter(({ cell }) => looksLikeThousandsSeparator(cell))

  const shape = matrixShape(matrixVariable)
  // Gaps are flagged only once focus leaves the grid, so a row typed in order doesn't flash red
  const gaps = isEditing ? [] : blankCellsInsideShape(matrixVariable, shape)
  const isGap = (row: number, column: number) =>
    gaps.some((gap) => gap.row === row && gap.column === column)
  // The frame is only visual, so screen reader users hear the size here instead
  const shapeStatus =
    shape.rows === 0 ? "" : t("matrix-size-status", { rows: shape.rows, columns: shape.columns })

  const tempArray = Array.from({ length: MATRIX_GRID_SIZE }, (_unused, index) => index)
  return (
    <>
      <AnswerMatrixTable {...editingHandlers}>
        <tbody>
          {tempArray.map((rowIndex) => {
            return (
              <tr key={`row${rowIndex}`}>
                {tempArray.map((columnIndex) => {
                  const cellText = findOptionText(columnIndex, rowIndex)
                  if (cellText !== null) {
                    return (
                      <MatrixGridCell
                        key={`${columnIndex} ${rowIndex}`}
                        column={columnIndex}
                        row={rowIndex}
                        cellText={cellText}
                        onChange={handleOptionSelect}
                        matrixSize={matrixActiveSize}
                        isGap={isGap(rowIndex, columnIndex)}
                      ></MatrixGridCell>
                    )
                  }
                  return null
                })}
              </tr>
            )
          })}
        </tbody>
      </AnswerMatrixTable>
      <VisuallyHidden>
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role=status live region; <output> changes styling/semantics */}
        <div role="status" aria-live="polite">
          {shapeStatus}
        </div>
      </VisuallyHidden>
      {/* Always mounted so screen readers announce messages as they appear */}
      <ul
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role=status live region; <output> changes styling/semantics
        role="status"
        aria-live="polite"
        className={css`
          list-style: none;
          margin: 0.5rem auto 0;
          padding: 0;
          max-width: 28rem;
          font-size: 0.875rem;
          color: ${baseTheme.colors.gray[600]};
          text-align: center;
        `}
      >
        {gaps.length > 0 && (
          <li
            className={css`
              color: ${baseTheme.colors.red[700]};
              font-weight: 600;
            `}
          >
            {t("matrix-fill-empty-cells")}
          </li>
        )}
        {malformedCells.map(({ rowIndex, columnIndex }) => (
          <li key={`malformed-${rowIndex}-${columnIndex}`}>{t("matrix-cell-invalid-number")}</li>
        ))}
        {commaCells.map(({ cell, rowIndex, columnIndex }) => (
          <li key={`comma-${rowIndex}-${columnIndex}`}>
            {t("matrix-cell-comma-warning", { value: parseCellNumber(cell) ?? cell })}
          </li>
        ))}
      </ul>
    </>
  )
}

export default withErrorBoundary(Matrix)
