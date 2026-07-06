"use client"

import { css } from "@emotion/css"
import React, { useId, useState } from "react"
import { VisuallyHidden } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

export interface ExerciseSubmitButtonProps {
  /** True while the submission request is in flight. */
  isPending: boolean
  /** True when the user has not yet given a complete, valid answer. */
  answersIncomplete: boolean
  /** Called when the user submits a complete answer. */
  onSubmit: () => void
  buttonClassName?: string
}

const validationMessageStyles = css`
  color: ${baseTheme.colors.red[700]};
  font-size: 1rem;
  line-height: 140%;
  margin-top: 0.5rem;
  text-align: center;
`

/**
 * Submit button for an exercise.
 *
 * Uses `aria-disabled` instead of the `disabled` attribute so the button stays
 * focusable for keyboard and screen reader users, exposes an explanation of why
 * it cannot be used yet via `aria-describedby`, and shows a visible error message
 * if the user tries to submit an incomplete answer.
 */
const ExerciseSubmitButton: React.FC<ExerciseSubmitButtonProps> = ({
  isPending,
  answersIncomplete,
  onSubmit,
  buttonClassName,
}) => {
  const { t } = useTranslation()
  const hintId = useId()
  const [showValidationMessage, setShowValidationMessage] = useState(false)

  const blocked = isPending || answersIncomplete

  return (
    <>
      <button
        className={buttonClassName}
        aria-disabled={blocked}
        aria-describedby={answersIncomplete ? hintId : undefined}
        onClick={() => {
          if (blocked) {
            if (answersIncomplete) {
              setShowValidationMessage(true)
            }
            return
          }
          setShowValidationMessage(false)
          onSubmit()
        }}
      >
        {t("submit-button")}
      </button>
      {answersIncomplete && (
        <VisuallyHidden id={hintId}>{t("answer-the-exercise-before-submitting")}</VisuallyHidden>
      )}
      <div role="alert">
        {showValidationMessage && answersIncomplete && (
          <div className={validationMessageStyles}>
            {t("answer-the-exercise-before-submitting")}
          </div>
        )}
      </div>
    </>
  )
}

export default ExerciseSubmitButton
