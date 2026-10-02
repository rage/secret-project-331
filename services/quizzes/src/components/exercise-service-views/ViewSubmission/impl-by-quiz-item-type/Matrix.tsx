import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { CheckCircle, MinusCircle, PlusCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { VisuallyHidden } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { MatrixFrame, MatrixTable } from "@/components/Shared/MatrixGrid"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { primaryFont } from "@/shared-module/exercise-react/styles"
import { type MatrixShape, matrixShape } from "@/util/matrix"

import type { QuizItemSubmissionComponentProps } from "."
import type { UserItemAnswerMatrix } from "../../../../../types/quizTypes/answer"
import type { MatrixCellVerdict } from "../../../../../types/quizTypes/grading"
import type { ModelSolutionQuizItemMatrix } from "../../../../../types/quizTypes/modelSolutionSpec"
import type { PublicSpecQuizItemMatrix } from "../../../../../types/quizTypes/publicSpec"

const SubmissionMatrixTable = styled(MatrixTable)`
  margin-top: 1rem;
`

// Pale tints so the colored icon carries the verdict; every icon keeps over 5:1 on its tint.
// An icon per verdict so color isn't the only signal; `title` alone isn't announced or shown on touch.
const VERDICTS: Record<
  MatrixCellVerdict,
  {
    background: string
    iconColor: string
    Icon: React.ComponentType<{ size?: number; className?: string; color?: string }>
    labelKey:
      | "matrix-cell-verdict-correct"
      | "matrix-cell-verdict-incorrect"
      | "matrix-cell-verdict-missing"
      | "matrix-cell-verdict-extra"
  }
> = {
  correct: {
    background: baseTheme.colors.green[75],
    iconColor: baseTheme.colors.green[600],
    Icon: CheckCircle,
    labelKey: "matrix-cell-verdict-correct",
  },
  incorrect: {
    background: baseTheme.colors.red[75],
    iconColor: baseTheme.colors.red[600],
    Icon: XmarkCircle,
    labelKey: "matrix-cell-verdict-incorrect",
  },
  missing: {
    background: baseTheme.colors.gray[75],
    iconColor: baseTheme.colors.gray[500],
    Icon: MinusCircle,
    labelKey: "matrix-cell-verdict-missing",
  },
  extra: {
    background: baseTheme.colors.yellow[100],
    iconColor: baseTheme.colors.red[600],
    Icon: PlusCircle,
    labelKey: "matrix-cell-verdict-extra",
  },
}

interface RenderedCell {
  text: string
  verdict: MatrixCellVerdict | null
}

const MatrixSubmission: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItemMatrix, UserItemAnswerMatrix>
> = ({ quiz_item_model_solution, user_quiz_item_answer, quiz_item_answer_feedback }) => {
  const { t } = useTranslation()
  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemMatrix | null
  const studentAnswer = user_quiz_item_answer.matrix

  if (!studentAnswer) {
    throw new Error("No student answers")
  }

  const cellFeedbacks = quiz_item_answer_feedback?.matrix_cell_feedbacks ?? null
  const breakdown = quiz_item_answer_feedback?.matrix_score_breakdown ?? null
  const studentShape = matrixShape(studentAnswer)

  // Verdicts come only from the grader; without them (fog of war, old submissions) cells render unmarked.
  const verdictByPosition = new Map<string, MatrixCellVerdict>()
  cellFeedbacks?.forEach(({ row, column, verdict }) => {
    verdictByPosition.set(`${row},${column}`, verdict)
  })

  const rows = Math.max(studentShape.rows, ...(cellFeedbacks?.map(({ row }) => row + 1) ?? [0]))
  const columns = Math.max(
    studentShape.columns,
    ...(cellFeedbacks?.map(({ column }) => column + 1) ?? [0]),
  )

  const cellAt = (row: number, column: number): RenderedCell => ({
    text: studentAnswer[row]?.[column] ?? "",
    verdict: verdictByPosition.get(`${row},${column}`) ?? null,
  })

  const wrongShapeScoredZero =
    breakdown !== null &&
    breakdown.missingCells + breakdown.extraCells > 0 &&
    modelSolution?.partialCreditForWrongShape === false
  let scoreNote: string | null = null
  if (breakdown && modelSolution?.gradingPolicy === "whole-matrix") {
    scoreNote = t("matrix-score-breakdown-whole-matrix-note")
  } else if (breakdown && modelSolution?.gradingPolicy === "per-cell") {
    scoreNote = wrongShapeScoredZero
      ? t("matrix-score-breakdown-wrong-shape-note")
      : t("matrix-score-breakdown-per-cell-note", { keyCells: breakdown.keyCells })
  }

  const answerWasFullyCorrect = quiz_item_answer_feedback?.correctnessCoefficient === 1
  const modelSolutionCells = answerWasFullyCorrect ? null : (modelSolution?.optionCells ?? null)
  const modelSolutionShape = matrixShape(modelSolutionCells)

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        align-items: center;
      `}
    >
      <div
        aria-label={t("matrix-answer-and-solution")}
        className={css`
          display: flex;
          justify-content: space-evenly;
          gap: 2rem;
          flex-wrap: wrap;
        `}
      >
        <div>
          <MatrixGrid rows={rows} columns={columns} frame={studentShape} cellAt={cellAt} />
          <Caption>{t("matrix-your-answer")}</Caption>
        </div>
        {modelSolutionCells && modelSolutionShape.rows > 0 && (
          <div>
            <MatrixGrid
              rows={modelSolutionShape.rows}
              columns={modelSolutionShape.columns}
              frame={modelSolutionShape}
              cellAt={(row, column) => ({
                text: modelSolutionCells[row]?.[column] ?? "",
                verdict: null,
              })}
            />
            <Caption>
              <CheckCircle color={baseTheme.colors.green[600]} size={18} />
              <span>{t("correct-option-tag")}</span>
            </Caption>
          </div>
        )}
      </div>
      {breakdown && (
        <p
          className={css`
            margin-top: 0.75rem;
            font-family: ${primaryFont};
            font-size: 0.875rem;
            color: ${baseTheme.colors.gray[600]};
            text-align: center;
          `}
        >
          <span>
            {t("matrix-score-breakdown", {
              correct: breakdown.correctCells,
              incorrect: breakdown.incorrectCells,
              missing: breakdown.missingCells,
              extra: breakdown.extraCells,
            })}
          </span>
          {scoreNote && <span className={noteLine}>{scoreNote}</span>}
        </p>
      )}
    </div>
  )
}

const noteLine = css`
  display: block;
`

const Caption = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.563rem;
  font-family: ${primaryFont};
  color: ${baseTheme.colors.gray[600]};
  font-weight: 500;
  font-size: 1rem;
`

interface MatrixGridProps {
  rows: number
  columns: number
  /** The submitted shape, which can be smaller than the grid when key cells are shown as missing. */
  frame: MatrixShape
  cellAt: (row: number, column: number) => RenderedCell
}

const MatrixGrid: React.FC<MatrixGridProps> = ({ rows, columns, frame, cellAt }) => {
  const { t } = useTranslation()
  return (
    <SubmissionMatrixTable>
      <tbody>
        {Array.from({ length: rows }, (_unusedRow, row) => (
          <tr key={`row${row}`}>
            {Array.from({ length: columns }, (_unusedCell, column) => {
              const cell = cellAt(row, column)
              const verdict = cell.verdict ? VERDICTS[cell.verdict] : null
              return (
                // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- table cell renders dynamic text, not an interactive control
                <td
                  key={`cell ${row} ${column}`}
                  className={css`
                    padding: 0;
                    font-size: 1.375rem;
                    font-weight: 600;
                    font-family: ${primaryFont};
                  `}
                >
                  <div
                    title={verdict ? t(verdict.labelKey) : undefined}
                    className={css`
                      position: relative;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      width: 3.125rem;
                      height: 3.125rem;
                      /* Nudge the value left of the verdict icon so they don't overlap */
                      padding-right: ${verdict ? "0.5rem" : "0"};
                      box-sizing: border-box;
                      text-align: center;
                      color: ${baseTheme.colors.gray[600]};
                      background-color: ${verdict?.background ?? "#FFFFFF"};
                    `}
                  >
                    <MatrixFrame column={column} row={row} frame={frame} />
                    {cell.text}
                    {verdict && (
                      <>
                        <span aria-hidden="true">
                          <verdict.Icon
                            className={css`
                              position: absolute;
                              top: 0.1875rem;
                              right: 0.1875rem;
                            `}
                            color={verdict.iconColor}
                            size={14}
                          />
                        </span>
                        <VisuallyHidden>{t(verdict.labelKey)}</VisuallyHidden>
                      </>
                    )}
                  </div>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </SubmissionMatrixTable>
  )
}

export default withErrorBoundary(MatrixSubmission)
