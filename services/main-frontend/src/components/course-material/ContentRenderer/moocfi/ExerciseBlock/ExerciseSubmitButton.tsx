"use client"

import { css, cx } from "@emotion/css"
import React, { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

export interface ExerciseSubmitButtonProps {
  isPending: boolean
  /** Already-localized reasons the exercise cannot be submitted yet; empty means submittable. */
  blockers: string[]
  onSubmit: () => void
  buttonClassName?: string
}

const blockerListStyles = css`
  margin-top: 0.5rem;
  color: ${baseTheme.colors.gray[600]};
  font-size: 1rem;
  line-height: 140%;
  text-align: center;

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
`

const blockerListEmphasizedStyles = css`
  color: ${baseTheme.colors.red[700]};
  font-weight: 500;
`

// Uses aria-disabled instead of disabled so the button stays focusable for screen readers, and shows
// the reasons it is disabled right next to it so the student understands why it is greyed out.
const ExerciseSubmitButton: React.FC<ExerciseSubmitButtonProps> = ({
  isPending,
  blockers,
  onSubmit,
  buttonClassName,
}) => {
  const { t } = useTranslation()
  const hintId = useId()
  const [emphasizeReasons, setEmphasizeReasons] = useState(false)

  const hasBlockers = blockers.length > 0
  const blocked = isPending || hasBlockers

  // Drop the emphasis once the exercise becomes submittable again.
  useEffect(() => {
    if (!hasBlockers) {
      setEmphasizeReasons(false)
    }
  }, [hasBlockers])

  return (
    <>
      <button
        className={buttonClassName}
        aria-disabled={blocked}
        aria-describedby={hasBlockers ? hintId : undefined}
        onClick={() => {
          if (blocked) {
            if (hasBlockers) {
              setEmphasizeReasons(true)
            }
            return
          }
          onSubmit()
        }}
      >
        {t("submit-button")}
      </button>
      {hasBlockers && (
        <div
          id={hintId}
          role="status"
          className={cx(blockerListStyles, emphasizeReasons && blockerListEmphasizedStyles)}
        >
          <ul>
            {blockers.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

export default ExerciseSubmitButton
