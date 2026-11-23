import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"

import { baseTheme, monospaceFont } from "@/shared-module/common/styles"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import type { GradingFeedbackKey } from "@/util/gradingFeedback"
import { parseFeedback } from "@/util/gradingFeedback"

import { TestResultCard, TestResultHeader, TestResultMessage } from "./AnswerBrowserExercise/styles"

const FEEDBACK_MESSAGE_KEYS = {
  compile_failed: "feedback-compile-failed",
  generic_error: "feedback-generic-error",
  interrupted: "feedback-interrupted",
  timed_out: "feedback-timed-out",
  style_check_failed: "feedback-style-check-failed",
  valgrind_failed: "feedback-valgrind-failed",
  no_project_in_archive: "feedback-no-project-in-archive",
  langs_error: "feedback-langs-error",
  server_error: "feedback-server-error",
} as const satisfies Record<GradingFeedbackKey, string>

/**
 * The grading's message in the viewer's language, falling back to the English `feedback_text` of
 * a grading that has no feedback key. Null when there is nothing to say.
 */
export function feedbackMessage(t: TFunction, grading: ExerciseTaskGradingResult): string | null {
  const feedback = parseFeedback(grading.feedback_json)
  if (feedback?.feedbackKey) {
    return t(FEEDBACK_MESSAGE_KEYS[feedback.feedbackKey], {
      detail: feedback.feedbackDetail ?? "",
    })
  }
  const text = grading.feedback_text?.trim()
  return text ? text : null
}

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
  const logs = Object.entries(feedback?.logs ?? {}).filter(([, log]) => log.trim() !== "")
  const testResults = feedback?.testResults ?? []
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
            <TestResultCard key={`${result.name}-${i.toString()}`} passed={result.successful}>
              <TestResultHeader passed={result.successful}>
                {result.successful ? t("test-result-passed") : t("test-result-failed")}:{" "}
                {result.name}
              </TestResultHeader>
              {result.message !== "" && <TestResultMessage>{result.message}</TestResultMessage>}
              {result.exception.length > 0 && (
                <details>
                  <summary>{t("test-details")}</summary>
                  <TestResultMessage>{result.exception.join("\n")}</TestResultMessage>
                </details>
              )}
            </TestResultCard>
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
          {logs.map(([name, log]) => (
            <div key={name}>
              <strong>{name}</strong>
              <TestResultMessage>{log}</TestResultMessage>
            </div>
          ))}
        </details>
      )}
    </section>
  )
}

export default GradingFeedback
