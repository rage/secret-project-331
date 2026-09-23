import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { primaryFont } from "@/shared-module/exercise-react/styles"
import { matrixShape } from "@/util/matrix"

import type { QuizItemSubmissionComponentProps } from "."
import type { UserItemAnswerMatrix } from "../../../../../types/quizTypes/answer"
import type { MatrixCellVerdict } from "../../../../../types/quizTypes/grading"
import type { ModelSolutionQuizItemMatrix } from "../../../../../types/quizTypes/modelSolutionSpec"
import type { PublicSpecQuizItemMatrix } from "../../../../../types/quizTypes/publicSpec"

const MatrixTableContainer = styled.table`
  margin: auto;
  margin-top: 1rem;
  border-collapse: collapse;

  tbody {
    border-left: 0.125rem solid #718dbf;
    border-right: 0.125rem solid #718dbf;
    position: relative;
  }
`

const VERDICT_BACKGROUNDS: Record<MatrixCellVerdict, string> = {
  correct: baseTheme.colors.green[100],
  incorrect: baseTheme.colors.red[100],
  missing: baseTheme.colors.gray[200],
  extra: baseTheme.colors.yellow[100],
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

  // Correctness comes from the grader alone. Comparing here would contradict it the moment a
  // student writes `0,5` against a `0.5` key; no verdicts means an older submission or fog of war,
  // and the cells then render unmarked.
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
          <MatrixGrid rows={rows} columns={columns} cellAt={cellAt} />
          <Caption>{t("matrix-your-answer")}</Caption>
        </div>
        {modelSolutionCells && modelSolutionShape.rows > 0 && (
          <div>
            <MatrixGrid
              rows={modelSolutionShape.rows}
              columns={modelSolutionShape.columns}
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
          </span>{" "}
          {modelSolution?.gradingPolicy === "per-cell" && (
            <span>
              {t("matrix-score-breakdown-per-cell-note", { keyCells: breakdown.keyCells })}
            </span>
          )}
          {modelSolution?.gradingPolicy === "whole-matrix" && (
            <span>{t("matrix-score-breakdown-whole-matrix-note")}</span>
          )}
        </p>
      )}
    </div>
  )
}

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
  cellAt: (row: number, column: number) => RenderedCell
}

const MatrixGrid: React.FC<MatrixGridProps> = ({ rows, columns, cellAt }) => {
  const { t } = useTranslation()
  const verdictLabels: Record<MatrixCellVerdict, string> = {
    correct: t("matrix-cell-verdict-correct"),
    incorrect: t("matrix-cell-verdict-incorrect"),
    missing: t("matrix-cell-verdict-missing"),
    extra: t("matrix-cell-verdict-extra"),
  }

  return (
    <MatrixTableContainer>
      <tbody>
        {Array.from({ length: rows }, (_unusedRow, row) => (
          <tr key={`row${row}`}>
            {Array.from({ length: columns }, (_unusedCell, column) => {
              const cell = cellAt(row, column)
              return (
                // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- table cell renders dynamic text, not an interactive control
                <td
                  key={`cell ${row} ${column}`}
                  className={css`
                    padding: 0;
                    font-size: 1.375rem;
                    font-family: ${primaryFont};
                  `}
                >
                  <div
                    title={cell.verdict ? verdictLabels[cell.verdict] : undefined}
                    className={css`
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      width: 3.125rem;
                      height: 3.125rem;
                      text-align: center;
                      color: ${baseTheme.colors.gray[700]};
                      background-color: ${
                        cell.verdict
                          ? VERDICT_BACKGROUNDS[cell.verdict]
                          : baseTheme.colors.clear[200]
                      };
                    `}
                  >
                    {cell.text}
                  </div>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </MatrixTableContainer>
  )
}

export default withErrorBoundary(MatrixSubmission)
