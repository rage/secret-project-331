import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { UseMutationResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { ExerciseTaskGradingResult } from "../../../shared-module/bindings"
import DebugModal from "../../../shared-module/components/DebugModal"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

interface PlaygroundAnswersProps {
  userAnswer: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submitAnswerMutation: UseMutationResult<ExerciseTaskGradingResult, unknown, any, unknown>
}

const StyledPre = styled.pre`
  background-color: rgba(218, 230, 229, 0.4);
  border-radius: 6px;
  padding: 1rem;
  font-size: 13px;
  width: 100%;
  max-height: 700px;
  overflow: scroll;
  white-space: pre-wrap;
  resize: vertical;

  &[style*="height"] {
    max-height: unset;
  }
`

const PlaygroudAnswers: React.FC<PlaygroundAnswersProps> = ({
  userAnswer,
  submitAnswerMutation,
}) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        padding: 2rem;
      `}
    >
      <div>
        <div
          className={css`
            display: flex;
            h3 {
              margin-right: 1rem;
            }
          `}
        >
          <h3>{t("title-user-answer")}</h3>{" "}
          <DebugModal
            data={userAnswer}
            readOnly={false}
            updateDataOnClose={(newValue) => {
              submitAnswerMutation.mutate(newValue)
            }}
          />
        </div>
        <p
          className={css`
            margin-bottom: 0.5rem;
          `}
        >
          {t("user-answer-explanation")}
        </p>
        {userAnswer ? (
          <StyledPre>{JSON.stringify(userAnswer, undefined, 2)}</StyledPre>
        ) : (
          <div>{t("error-no-user-answer")}</div>
        )}
      </div>

      <div>
        <h3>{t("title-grading")}</h3>

        <p
          className={css`
            margin-bottom: 0.5rem;
          `}
        >
          {t("grading-explanation")}
        </p>

        {submitAnswerMutation.isSuccess && !submitAnswerMutation.isPending ? (
          <StyledPre>{JSON.stringify(submitAnswerMutation.data, undefined, 2)}</StyledPre>
        ) : (
          <div>{t("error-no-grading-long")}</div>
        )}
      </div>
    </div>
  )
}

export default withErrorBoundary(PlaygroudAnswers)
