import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { MatrixInputGrid, useMatrixGrid } from "@/components/Shared/MatrixGrid"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  emptyMatrixGrid,
  isFilledRectangle,
  isMalformedNumberCell,
  looksLikeThousandsSeparator,
  parseCellNumber,
} from "@/util/matrix"

import type { QuizItemComponentProps } from ".."
import type { UserItemAnswerMatrix } from "../../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemMatrix } from "../../../../../../types/quizTypes/publicSpec"

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const Matrix: React.FunctionComponent<
  QuizItemComponentProps<PublicSpecQuizItemMatrix, UserItemAnswerMatrix>
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const matrixVariable = useMemo(() => {
    const res = quizItemAnswerState?.matrix
    if (res !== null && res !== undefined && Array.isArray(res)) {
      return res
    }
    return emptyMatrixGrid()
  }, [quizItemAnswerState?.matrix])
  // Gaps are flagged only once focus leaves the grid, so a row typed in order doesn't flash red
  const { shape, gaps, editingHandlers } = useMatrixGrid(matrixVariable)

  const handleMatrixChange = (newMatrix: string[][]) => {
    // Unparseable numbers stay submittable: the grader compares them as text, and the key may hold the same text
    const isValid = isFilledRectangle(newMatrix)
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        type: "matrix",
        matrix: newMatrix,
        valid: isValid,
      })
      return
    }
    setQuizItemAnswerState({ ...quizItemAnswerState, matrix: newMatrix, valid: isValid })
  }

  const cellsWithPosition = matrixVariable.flatMap((row, rowIndex) =>
    row.map((cell, columnIndex) => ({ cell, rowIndex, columnIndex })),
  )
  const malformedCells = cellsWithPosition.filter(({ cell }) => isMalformedNumberCell(cell))
  const commaCells = cellsWithPosition.filter(({ cell }) => looksLikeThousandsSeparator(cell))

  // The frame is only visual, so screen reader users hear the size here instead
  const shapeStatus =
    shape.rows === 0 ? "" : t("matrix-size-status", { rows: shape.rows, columns: shape.columns })

  return (
    <>
      <MatrixInputGrid
        className={css`
          margin-top: 1rem;
        `}
        matrix={matrixVariable}
        shape={shape}
        gaps={gaps}
        onMatrixChange={handleMatrixChange}
        {...editingHandlers}
      />
      <VisuallyHidden>
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role=status live region; <output> changes styling/semantics */}
        <div role="status" aria-live="polite">
          {shapeStatus}
        </div>
      </VisuallyHidden>
      {/* Always mounted so screen readers announce messages as they appear; role=status isn't allowed on <ul> */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role=status live region; <output> changes styling/semantics */}
      <div role="status" aria-live="polite">
        <ul
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
      </div>
    </>
  )
}

export default withErrorBoundary(Matrix)
