import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import WarningInfobox from "@/shared-module/common/components/WarningInfobox"
import { primaryFont } from "@/shared-module/exercise-react/styles"
import { matrixKeyDiagnostics, type MatrixCellPosition } from "@/util/matrixKeyDiagnostics"

import type {
  MatrixGradingPolicy,
  PrivateSpecQuizItemMatrix,
} from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import findQuizItem from "../../utils/general"
import NumericField from "../common/NumericField"
import ToggleCard from "../common/ToggleCard"

const WHOLE_MATRIX: MatrixGradingPolicy = "whole-matrix"
const PER_CELL: MatrixGradingPolicy = "per-cell"

interface MatrixGradingSettingsProps {
  quizItemId: string
}

const describeCells = (cells: MatrixCellPosition[]): string =>
  cells.map(({ row, column }) => `(${row + 1}, ${column + 1})`).join(", ")

const MatrixGradingSettings: React.FC<MatrixGradingSettingsProps> = ({ quizItemId }) => {
  const { t } = useTranslation()
  const { selected, updateState } = useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemMatrix>(
    (quiz) => {
      // oxlint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemMatrix>(quiz, quizItemId, "matrix")
    },
  )

  if (!selected) {
    return null
  }

  const gradesPerCell = selected.gradingPolicy === PER_CELL
  const diagnostics = matrixKeyDiagnostics(selected.optionCells, selected.tolerance)
  const toleranceIsNegative = selected.tolerance < 0
  const toleranceTooLarge =
    !toleranceIsNegative &&
    diagnostics.largestSafeTolerance !== null &&
    selected.tolerance > diagnostics.largestSafeTolerance
  const zeroMatrixScorePercentage =
    diagnostics.zeroMatrixScore === null ? null : Math.round(diagnostics.zeroMatrixScore * 100)

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      `}
    >
      <SelectField
        id={`matrix-grading-${quizItemId}`}
        className={css`
          width: 100%;
        `}
        label={t("matrix-grading-policy")}
        defaultValue={selected.gradingPolicy}
        options={[
          { value: WHOLE_MATRIX, label: t("matrix-grading-policy-whole-matrix") },
          { value: PER_CELL, label: t("matrix-grading-policy-per-cell") },
        ]}
        onChangeByValue={(value) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.gradingPolicy = value === PER_CELL ? PER_CELL : WHOLE_MATRIX
          })
        }}
      />
      <span
        className={css`
          color: #414246;
          font-size: 14px;
          font-family: ${primaryFont};
          display: block;
        `}
      >
        {gradesPerCell
          ? t("matrix-grading-policy-per-cell-description")
          : t("matrix-grading-policy-whole-matrix-description")}
      </span>
      {gradesPerCell && zeroMatrixScorePercentage !== null && zeroMatrixScorePercentage > 0 && (
        <WarningInfobox>
          {t("matrix-warning-zero-matrix-score", { percentage: zeroMatrixScorePercentage })}
        </WarningInfobox>
      )}
      <ToggleCard
        title={t("matrix-partial-credit-for-wrong-shape")}
        description={t("matrix-partial-credit-for-wrong-shape-description")}
        disabled={!gradesPerCell}
        state={selected.partialCreditForWrongShape}
        onChange={(partialCreditForWrongShape) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.partialCreditForWrongShape = partialCreditForWrongShape
          })
        }}
      />
      <ToggleCard
        title={t("fog-of-war")}
        description={t("matrix-fog-of-war-description")}
        state={selected.fogOfWar}
        onChange={(fogOfWar) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.fogOfWar = fogOfWar
          })
        }}
      />
      <NumericField
        value={selected.tolerance}
        label={t("numeric-tolerance")}
        min={0}
        onCommit={(tolerance) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.tolerance = tolerance
          })
        }}
      />
      <span
        className={css`
          color: #414246;
          font-size: 14px;
          font-family: ${primaryFont};
          display: block;
        `}
      >
        {t("matrix-tolerance-description")}
      </span>
      {toleranceIsNegative && (
        <WarningInfobox>{t("matrix-warning-tolerance-negative")}</WarningInfobox>
      )}
      {toleranceTooLarge && (
        <WarningInfobox>
          {t("matrix-warning-tolerance-too-large", { limit: diagnostics.largestSafeTolerance })}
        </WarningInfobox>
      )}
      {diagnostics.gaps.length > 0 && (
        <WarningInfobox>
          {t("matrix-warning-key-has-gaps", { positions: describeCells(diagnostics.gaps) })}
        </WarningInfobox>
      )}
      {diagnostics.commaAsThousandsSeparator.length > 0 && (
        <WarningInfobox>
          {t("matrix-warning-comma-as-thousands-separator", {
            cells: describeCells(diagnostics.commaAsThousandsSeparator),
          })}
        </WarningInfobox>
      )}
      {diagnostics.malformedNumbers.length > 0 && (
        <WarningInfobox>
          {t("matrix-warning-malformed-number", {
            cells: describeCells(diagnostics.malformedNumbers),
          })}
        </WarningInfobox>
      )}
    </div>
  )
}

export default MatrixGradingSettings
