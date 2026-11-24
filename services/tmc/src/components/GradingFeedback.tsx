import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { baseTheme, monospaceFont } from "@/shared-module/common/styles"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import { feedbackMessage, parseFeedback } from "@/util/gradingFeedback"

import { TestResultCard } from "./AnswerBrowserExercise/components/TestResultCard"
import { TestResultMessage } from "./AnswerBrowserExercise/styles"
import { formatLogsForDisplay } from "./AnswerBrowserExercise/utils"

const sectionStyle = css`
  margin-top: 1rem;
`

interface Props {
  grading: ExerciseTaskGradingResult | null
  /** Show the grading's message too, for views that do not show it elsewhere. */
  showMessage: boolean
}

/** Per-test results, style check errors and run logs of a grading, for students and teachers. */
const GradingFeedback: React.FC<Props> = ({ grading, showMessage }) => {
  const { t } = useTranslation()
  if (grading === null) {
    return null
  }
  const feedback = parseFeedback(grading.feedback_json)
  const message = showMessage ? feedbackMessage(t, grading) : null
  const styleErrors = Object.entries(feedback?.validations?.validation_errors ?? {})
  const logs = Object.entries(feedback?.run?.logs ?? {}).filter(([, log]) => log.trim() !== "")
  const testResults = feedback?.run?.testResults ?? []
  if (
    message === null &&
    testResults.length === 0 &&
    styleErrors.length === 0 &&
    logs.length === 0
  ) {
    return null
  }
  return (
    <section className={sectionStyle}>
      {message !== null && <p>{message}</p>}
      {testResults.length > 0 && (
        <>
          <h3>{t("test-results")}</h3>
          {testResults.map((result, i) => (
            <TestResultCard
              key={`${result.name}-${i.toString()}`}
              name={result.name}
              passed={result.successful}
              message={result.message}
              exception={result.exception}
            />
          ))}
        </>
      )}
      {styleErrors.length > 0 && (
        <div className={sectionStyle}>
          <h3>{t("code-style-errors")}</h3>
          {styleErrors.map(([file, errors]) => (
            <div key={file}>
              <strong>{file}</strong>
              <ul
                className={css`
                  font-family: ${monospaceFont};
                  font-size: 0.8125rem;
                  color: ${baseTheme.colors.gray[700]};
                `}
              >
                {errors.map((error, i) => (
                  // oxlint-disable-next-line i18next/no-literal-string -- file position
                  <li
                    key={i}
                  >{`${error.line.toString()}:${error.column.toString()} ${error.message}`}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {logs.length > 0 && (
        <details className={sectionStyle}>
          <summary>{t("test-logs")}</summary>
          <TestResultMessage>{formatLogsForDisplay(Object.fromEntries(logs))}</TestResultMessage>
        </details>
      )}
    </section>
  )
}

export default GradingFeedback
