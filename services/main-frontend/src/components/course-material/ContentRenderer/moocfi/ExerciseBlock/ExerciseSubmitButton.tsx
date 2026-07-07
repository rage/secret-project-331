"use client"

import { css } from "@emotion/css"
import React, { useId, useState } from "react"
import { VisuallyHidden } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

export interface ExerciseSubmitButtonProps {
  isPending: boolean
  answersIncomplete: boolean
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

// Uses aria-disabled instead of disabled so the button stays focusable for screen readers.
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
